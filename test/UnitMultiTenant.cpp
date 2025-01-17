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

#include "config.h"

#include "WopiTestServer.hpp"
#include "WOPIUploadConflictCommon.hpp"
#include "Unit.hpp"
#include "lokassert.hpp"
#include "testlog.hpp"
#include "FileUtil.hpp"
#include <wsd/DocumentBroker.hpp>
#include <wsd/Process.hpp>

#include <Poco/Net/HTTPRequest.h>
#include <csignal>
#include <ctime>

/// This test simulates a crashing kit with modifications.
class UnitSubForKit : public WopiTestServer
{
    using Base = WopiTestServer;

    STATE_ENUM(Phase, Load, WaitCreateSubForKit, WaitLoadStatus, WaitDocClose, WaitKillSubForKit, Finish, Done) _phase;

    std::string _configId;

public:
    UnitSubForKit()
        : Base("UnitSubForKit")
        , _phase(Phase::Load)
        , _configId("someconfigid")
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        Base::configure(config);

        // Set to 0 to immediately discard any unused subforkits
        config.setUInt("serverside_config.idle_timeout_secs", 0);
    }

    void newSubForKit(const std::shared_ptr<ForKitProcess>& /*subforkit*/, const std::string& configId) override
    {
        LOG_TST("New SubForKit: " << configId);
        if (configId.find(_configId) == std::string::npos)
            failTest("unexpected subforkit configId");
        LOK_ASSERT_STATE(_phase, Phase::WaitCreateSubForKit);

        TRANSITION_STATE(_phase, Phase::WaitLoadStatus);
    }

    void killSubForKit(const std::string& configId) override
    {
        LOK_ASSERT_STATE(_phase, Phase::WaitKillSubForKit);
        LOG_TST("Killed SubForKit: " << configId);
        if (_configId == "someconfigid")
        {
            _configId = "someotherconfig";
            LOG_TST("reload with a different server config" << _configId);
            TRANSITION_STATE(_phase, Phase::Load);
        }
        else
            TRANSITION_STATE(_phase, Phase::Finish);
    }

    void onDocBrokerDestroy(const std::string& /*docKey*/) override
    {
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);
        TRANSITION_STATE(_phase, Phase::WaitKillSubForKit);
        SocketPoll::wakeupWorld();
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);


        TRANSITION_STATE(_phase, Phase::WaitDocClose);
        WSD_CMD("closedocument");

        return true;
    }

    void configCheckFileInfo(const Poco::Net::HTTPRequest& request,
                             Poco::JSON::Object::Ptr& fileInfo) override
    {
        const Poco::URI uriReq(request.getURI());
        Poco::JSON::Object::Ptr sharedSettings = new Poco::JSON::Object();
        std::string uri = helpers::getTestServerURI() + "/wopi/settings/sharedconfig.json?testname=UnitSubForKit";
        sharedSettings->set("uri", Util::trim(uri));
        sharedSettings->set("stamp", _configId);
        fileInfo->set("SharedSettings", sharedSettings);
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
            {"configid", _configId}
        };
    }

    // on loading this document, a new subforkit is needed, so that should
    // be created on demand, and then the document loaded via that subforkit
    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                // Always transition before issuing commands.
                TRANSITION_STATE(_phase, Phase::WaitCreateSubForKit);

                LOG_TST("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                LOG_TST("Loading view");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());
                break;
            }
            case Phase::WaitCreateSubForKit:
            case Phase::WaitKillSubForKit:
            case Phase::WaitLoadStatus:
            case Phase::WaitDocClose:
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
            case Phase::Finish:
            {
                TRANSITION_STATE(_phase, Phase::Done);
                passTest("Document loaded successfully");
            }
        }
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase*[2]{
        new UnitSubForKit(), nullptr
    };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
