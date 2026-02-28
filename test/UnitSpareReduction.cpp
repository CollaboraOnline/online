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

/*
 * Test that idle subforkits have their spare children reduced to 1,
 * and that spares are restored when a new document is opened.
 *
 * The spare reduction only applies to subforkits with active documents
 * whose lastSpareConsumed time exceeds the idle timeout. cleanupDocBrokers
 * runs when a document broker finishes. So we open two documents with the
 * same configId, wait for idle timeout, then close one doc (triggering
 * cleanup). The other doc keeps the subforkit in activeConfigs, and the
 * idle spare timeout triggers reduction to 1.
 */

#include <config.h>

#include <WopiTestServer.hpp>
#include <Unit.hpp>
#include <lokassert.hpp>
#include <testlog.hpp>
#include <wsd/DocumentBroker.hpp>
#include <wsd/Process.hpp>

#include <Poco/Net/HTTPRequest.h>

class UnitSpareReduction : public WopiTestServer
{
    using Base = WopiTestServer;

    STATE_ENUM(Phase,
        LoadFirst,              // Load first document to create the subforkit
        WaitCreateSubForKit,    // Wait for subforkit creation
        WaitFirstLoad,          // Wait for first document to load
        LoadSecond,             // Load second document (same configId, different file)
        WaitSecondLoad,         // Wait for second document to load
        WaitIdleTimeout,        // Wait for spare idle timeout before closing
        CloseFirstDoc,          // Close first doc to trigger cleanup
        WaitSparesReduced,      // Wait for spares to be reduced to 1
        LoadThird,              // Load third doc to trigger spare restoration
        WaitThirdLoad,          // Wait for third document to load
        WaitSparesRestored,     // Wait for spares to be restored
        Done) _phase;

    std::string _configId;
    int _sparesForConfig;
    int _docsLoaded;
    std::chrono::steady_clock::time_point _lastLoadTime;
    std::string _firstDocWopiSrc;

public:
    UnitSpareReduction()
        : Base("UnitSpareReduction")
        , _phase(Phase::LoadFirst)
        , _configId("sparereduction")
        , _sparesForConfig(0)
        , _docsLoaded(0)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        Base::configure(config);

        // Use 3 prespawned children so we can observe the reduction
        config.setUInt("num_prespawn_children", 3);
        // Short idle timeout so spares are reduced quickly
        config.setUInt("serverside_config.idle_timeout_secs", 2);
    }

    void newSubForKit(const std::shared_ptr<ForKitProcess>& /*subforkit*/, const std::string& configId) override
    {
        TST_LOG("New SubForKit: " << configId);
        if (configId.find(_configId) == std::string::npos)
            return;

        if (_phase == Phase::WaitCreateSubForKit)
            TRANSITION_STATE(_phase, Phase::WaitFirstLoad);
    }

    void newChild(const std::shared_ptr<ChildProcess>& child) override
    {
        if (child->getConfigId().find(_configId) == std::string::npos)
            return;

        ++_sparesForConfig;
        TST_LOG("newChild for " << _configId << ", spare count now " << _sparesForConfig);

        if (_phase == Phase::WaitSparesRestored && _sparesForConfig >= 3)
        {
            TST_LOG("Spares restored to " << _sparesForConfig << ", test passed");
            TRANSITION_STATE(_phase, Phase::Done);
            passTest("Spare children reduced and restored successfully");
        }
    }

    void sparesReduced(const std::string& configId, int64_t excess) override
    {
        if (configId.find(_configId) == std::string::npos)
            return;

        TST_LOG("sparesReduced for " << configId << " by " << excess
                << ", spare count was " << _sparesForConfig);

        LOK_ASSERT(_sparesForConfig > 1);

        _sparesForConfig -= excess;
        TST_LOG("sparesReduced: spare count now " << _sparesForConfig);

        if (_phase == Phase::WaitSparesReduced)
        {
            LOK_ASSERT_EQUAL(1, _sparesForConfig);
            TST_LOG("Spares reduced to 1, now loading third document to restore");
            TRANSITION_STATE(_phase, Phase::LoadThird);
        }
    }

    void onDocBrokerDestroy(const std::string& docKey) override
    {
        TST_LOG("onDocBrokerDestroy: " << docKey);
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        TST_LOG("onDocumentLoaded: [" << message << ']');

        // One spare was consumed to load this document
        --_sparesForConfig;
        ++_docsLoaded;
        _lastLoadTime = std::chrono::steady_clock::now();
        TST_LOG("Document #" << _docsLoaded << " loaded, spare consumed, count now " << _sparesForConfig);

        if (_phase == Phase::WaitFirstLoad)
        {
            LOK_ASSERT(_sparesForConfig >= 1);
            TRANSITION_STATE(_phase, Phase::LoadSecond);
        }
        else if (_phase == Phase::WaitSecondLoad)
        {
            LOK_ASSERT(_sparesForConfig >= 0);
            TST_LOG("Two docs loaded. Waiting for spare idle timeout before closing first.");
            TRANSITION_STATE(_phase, Phase::WaitIdleTimeout);
        }
        else if (_phase == Phase::WaitThirdLoad)
        {
            TST_LOG("Third document loaded, spare consumed, count now " << _sparesForConfig
                    << ", waiting for spares to be restored");
            TRANSITION_STATE(_phase, Phase::WaitSparesRestored);
            if (_sparesForConfig >= 3)
            {
                TST_LOG("Spares already restored to " << _sparesForConfig << ", test passed");
                TRANSITION_STATE(_phase, Phase::Done);
                passTest("Spare children reduced and restored successfully");
            }
        }

        return true;
    }

    void configCheckFileInfo(const Poco::Net::HTTPRequest& request,
                             Poco::JSON::Object::Ptr& fileInfo) override
    {
        const Poco::URI uriReq(request.getURI());
        Poco::JSON::Object::Ptr sharedSettings = new Poco::JSON::Object();
        std::string uri = helpers::getTestServerURI() + "/wopi/settings/sharedconfig.json?testname=UnitSpareReduction";
        sharedSettings->set("uri", Util::trim(uri));
        sharedSettings->set("stamp", _configId);
        fileInfo->set("SharedSettings", sharedSettings);
    }

    std::map<std::string, std::string>
        parallelizeCheckInfo(const Poco::Net::HTTPRequest& request,
                             std::istream& /*message*/,
                             const std::shared_ptr<StreamSocket>& /*socket*/) override
    {
        std::string uri = Uri::decode(request.getURI());
        TST_LOG("parallelizeCheckInfo requested: " << uri);

        // Extract the file id from the URI path to use the same path for checkfileinfo
        std::string wopiSrc = "/wopi/files/0";
        if (uri.find("/wopi/files/1") != std::string::npos || uri.find("files%2F1") != std::string::npos)
            wopiSrc = "/wopi/files/1";
        else if (uri.find("/wopi/files/2") != std::string::npos || uri.find("files%2F2") != std::string::npos)
            wopiSrc = "/wopi/files/2";

        return std::map<std::string, std::string>{
            {"wopiSrc", wopiSrc},
            {"accessToken", "anything"},
            {"noAuthHeader", ""},
            {"permission", ""},
            {"configid", _configId}
        };
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::LoadFirst:
            {
                TRANSITION_STATE(_phase, Phase::WaitCreateSubForKit);

                TST_LOG("Creating first connection");
                _firstDocWopiSrc = initWebsocket("/wopi/files/0?access_token=anything");

                TST_LOG("Loading first document");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());
                break;
            }
            case Phase::LoadSecond:
            {
                TRANSITION_STATE(_phase, Phase::WaitSecondLoad);

                TST_LOG("Creating second connection (different file, same configId)");
                initWebsocket("/wopi/files/1?access_token=anything");

                TST_LOG("Loading second document");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());
                break;
            }
            case Phase::WaitIdleTimeout:
            {
                // Wait for the spare idle timeout to expire
                auto elapsed = std::chrono::steady_clock::now() - _lastLoadTime;
                if (elapsed >= std::chrono::seconds(3))
                {
                    TST_LOG("Spare idle timeout expired, closing first document to trigger cleanup");
                    TRANSITION_STATE(_phase, Phase::WaitSparesReduced);
                    // Close the first document by disconnecting its websocket.
                    // The second document keeps the configId in activeConfigs.
                    deleteSocketAt(1);  // index 1 is the first connection (initWebsocket inserts at front)
                }
                break;
            }
            case Phase::LoadThird:
            {
                TRANSITION_STATE(_phase, Phase::WaitThirdLoad);

                TST_LOG("Creating third connection");
                initWebsocket("/wopi/files/2?access_token=anything");

                TST_LOG("Loading third document");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());
                break;
            }
            default:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase*[2]{
        new UnitSpareReduction(), nullptr
    };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
