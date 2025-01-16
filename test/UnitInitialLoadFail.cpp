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

/// This is to test that: if a file initially fails to load for some transient
/// reason, f.e. timeout, then a subsequent load where there is no such failure
/// should succeed.
class InitialLoadFail : public WopiTestServer
{
    STATE_ENUM(Phase, LoadAttempt, WaitLoad, LoadSuccess, Done) _phase;

    std::size_t _getFileCount;

public:
    InitialLoadFail()
        : WopiTestServer("Initial Load Fail")
        , _phase(Phase::LoadAttempt)
        , _getFileCount(0)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);

        config.setInt("net.connection_timeout_secs", 3);
    }

    bool handleHttpRequest(const Poco::Net::HTTPRequest& request,
                           Poco::MemoryInputStream& message,
                           std::shared_ptr<StreamSocket>& socket) override
    {
        return WopiTestServer::handleHttpRequest(request, message, socket);
    }

    std::map<std::string, std::string>
        parallelizeCheckInfo(const Poco::Net::HTTPRequest& request,
                             Poco::MemoryInputStream& /*message*/,
                             std::shared_ptr<StreamSocket>& /*socket*/) override
    {
        std::string uri = Uri::decode(request.getURI());
        LOG_TST("parallelizeCheckInfo requested: " << uri);
        return std::map<std::string, std::string>{
            {"wopiSrc", "/wopi/files/0"},
            {"accessToken", "anything"},
            {"permission", ""},
            {"configid", ""}
        };
    }

    bool handleGetFileRequest(const Poco::Net::HTTPRequest& request,
                              std::shared_ptr<StreamSocket>& socket) override
    {
        if (_getFileCount++ == 0)
        {
            LOG_TST("handleGetFileRequest: force timeout for 1st load\n");
            std::this_thread::sleep_for(std::chrono::milliseconds(5000));
            return true;
        }
        return WopiTestServer::handleGetFileRequest(request, socket);
    }

    void configCheckFileInfo(const Poco::Net::HTTPRequest& /*request*/,
                             Poco::JSON::Object::Ptr& fileInfo) override
    {
        fileInfo->set("UserCanWrite", "true");
    }

    bool onFilterSendWebSocketMessage(const char* data, const std::size_t len,
                                      const WSOpCode /* code */, const bool /* flush */,
                                      int& /*unitReturn*/) override
    {
        const std::string message(data, len);

        LOG_TST("onFilterSendWebSocketMessage:" << message);

        if (message.starts_with("session "))
        {
            LOG_TST("PASS, session seen: " << message);
            TRANSITION_STATE(_phase, Phase::LoadSuccess);
        }

        if (message.starts_with("error: cmd=storage"))
        {
            LOG_TST("Load failed, explicit retry: " << message);
            TRANSITION_STATE(_phase, Phase::LoadAttempt);
        }

        return false;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::LoadAttempt:
            {
                // Always transition before issuing commands.
                TRANSITION_STATE(_phase, Phase::WaitLoad);

                LOG_TST("Attempt first load which should timeout once");

                initWebsocket("/wopi/files/0?access_token=anything");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());

                break;
            }
            case Phase::LoadSuccess:
            {
                TRANSITION_STATE(_phase, Phase::Done);
                passTest("Load Succeeded");
                break;
            }
            case Phase::WaitLoad:
            case Phase::Done:
                break;
        }
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase* [2]
    {
        new InitialLoadFail(), nullptr
    };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
