/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "lokassert.hpp"
#include "Unit.hpp"
#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <helpers.hpp>
#include <wsd/ClientSession.hpp>

#include <Poco/Net/HTTPRequest.h>

#include <chrono>

/// This is to test that dropping connection is seen as leaving the document
class SecondJoinQuit : public WopiTestServer
{
    STATE_ENUM(Phase, LoadUser1, WaitUser1Loaded, User1Loaded, LoadUser2, WaitUser2Loaded, User2Loaded, DropUser2, ModifyDoc, Done) _phase;

    bool _earlyQuit;

    std::size_t _checkFileInfoCount;
    std::size_t _viewCount;
    std::size_t _viewsActive;

public:
    SecondJoinQuit(const std::string& name, bool earlyQuit)
        : WopiTestServer(name)
        , _phase(Phase::LoadUser1)
        , _earlyQuit(earlyQuit)
        , _checkFileInfoCount(0)
        , _viewCount(0)
        , _viewsActive(0)
    {
    }

    void configCheckFileInfo(const Poco::Net::HTTPRequest& /*request*/,
                             Poco::JSON::Object::Ptr& fileInfo) override
    {
        const bool firstView = _checkFileInfoCount++ == 0;

        LOG_TST("CheckFileInfo: " << (firstView ? "User#1" : "User#2"));

        fileInfo->set("UserCanWrite", "true");
    }

    bool onFilterSendWebSocketMessage(const char* data, const std::size_t len,
                                      const WSOpCode /* code */, const bool /* flush */,
                                      int& /*unitReturn*/) override
    {
        const std::string message(data, len);

        if (message.starts_with("viewinfo:"))
        {
            Poco::JSON::Parser parser0;
            Poco::JSON::Array::Ptr array = parser0.parse(message.substr(9)).extract<Poco::JSON::Array::Ptr>();
            _viewsActive = array->size();
            if (_phase == Phase::Done && _viewsActive == 1)
                passTest("View disconnection seen");
        }

        return false;
    }

    void onDocBrokerViewLoaded(const std::string&,
                               const std::shared_ptr<ClientSession>& session) override
    {
        LOG_TST("View #" << _viewCount + 1 << " [" << session->getName() << "] loaded");

        ++_viewCount;

        if (_viewCount == 1 && _phase == Phase::WaitUser1Loaded)
            TRANSITION_STATE(_phase, Phase::User1Loaded);

        if (_viewCount == 2 && _phase == Phase::WaitUser2Loaded)
            TRANSITION_STATE(_phase, Phase::User2Loaded);
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::LoadUser1:
            {
                // Always transition before issuing commands.
                TRANSITION_STATE(_phase, Phase::WaitUser1Loaded);

                LOG_TST("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                LOG_TST("Loading first view");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());
                break;
            }
            case Phase::User1Loaded:
            {
                TRANSITION_STATE(_phase, Phase::LoadUser2);
                break;
            }
            case Phase::LoadUser2:
            {
                if (!_earlyQuit)
                {
                    // normal case, user 2 loads then then quits after
                    // they have joined
                    TRANSITION_STATE(_phase, Phase::WaitUser2Loaded);
                }
                else
                {
                    // abnormal case, user 2 loses connection right
                    // after launching their load
                    TRANSITION_STATE(_phase, Phase::DropUser2);
                }

                LOG_TST("Creating second connection");
                addWebSocket();

                LOG_TST("Loading second view");
                WSD_CMD_BY_CONNECTION_INDEX(1, "load url=" + getWopiSrc());
                break;
            }
            case Phase::User2Loaded:
            {
                TRANSITION_STATE(_phase, Phase::DropUser2);
                break;
            }
            case Phase::DropUser2:
            {
                TRANSITION_STATE(_phase, Phase::ModifyDoc);

                LOG_TST("Disconnecting first view right after load start");
                deleteSocketAt(1);
                break;
            }
            case Phase::ModifyDoc:
            {
                TRANSITION_STATE(_phase, Phase::Done);

                // Modify the document.
                LOG_TST("Modifying");
                WSD_CMD_BY_CONNECTION_INDEX(0, "key type=input char=97 key=0");
                WSD_CMD_BY_CONNECTION_INDEX(0, "key type=up char=0 key=512");
                break;
            }
            case Phase::WaitUser1Loaded:
            case Phase::WaitUser2Loaded:
            case Phase::Done:
                break;
        }
    }
};

class SecondJoinQuitNormal : public SecondJoinQuit
{
public:
    SecondJoinQuitNormal()
        : SecondJoinQuit("SecondJoinQuitNormal", false)
    {
    }
};

#if 1

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase* [2]
    {
        new SecondJoinQuitNormal(), nullptr
    };
}

#else

/* In this case, we are currently failing.

   We have one user connected, the 2nd user join, and immediately drop
   connection after "load" is dispatched. While in the normal case we wait
   until the 2nd user join has completed, and then close the connection.

   In both cases we receive:

     ToClient-007: Send: [viewinfo: [{"id":4,...},
                                     {"id":5,...}]]| common/Session.cpp:62

   so two users are seen as joined, but in the 2nd case we don't get a
   follow up indicating that the 2nd user has dropped.
*/
class SecondJoinQuitEarly : public SecondJoinQuit
{
public:
    SecondJoinQuitEarly()
        : SecondJoinQuit("SecondJoinQuitNormal", true)
    {
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase* [3]
    {
        new SecondJoinQuitNormal(), new SecondJoinQuitEarly(), nullptr
    };
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
