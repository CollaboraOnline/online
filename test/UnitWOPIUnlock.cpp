/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "lokassert.hpp"
#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <helpers.hpp>
#include <wsd/ClientSession.hpp>

#include <Poco/Net/HTTPRequest.h>

/// This is to test that we do not unlock before uploading
/// the document, right before unloading the last view.
class UnitWopiUnlock : public WopiTestServer
{
    STATE_ENUM(Phase, Load, Lock, Modify, Upload, Unlock, Done) _phase;

    std::string _lockState;
    std::string _lockToken;
    std::size_t _sessionCount;

public:
    UnitWopiUnlock()
        : WopiTestServer("UnitWopiUnlock")
        , _phase(Phase::Load)
        , _lockState("UNLOCK")
        , _sessionCount(0)
    {
    }

    void configCheckFileInfo(Poco::JSON::Object::Ptr fileInfo) override
    {
        fileInfo->set("SupportsLocks", "true");
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("assertPutFileRequest");
        LOK_ASSERT_STATE(_phase, Phase::Upload);

        TRANSITION_STATE(_phase, Phase::Unlock);
        return nullptr;
    }

    std::unique_ptr<http::Response>
    assertLockRequest(const Poco::Net::HTTPRequest& request) override
    {
        const std::string lock = request.get("X-WOPI-Lock", std::string());
        const std::string newLockState = request.get("X-WOPI-Override", std::string());
        LOG_TST("In " << toString(_phase) << ", X-WOPI-Lock: " << lock << ", X-WOPI-Override: "
                      << newLockState << ", for URI: " << request.getURI());

        if (_phase == Phase::Lock)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:LOCK", std::string("LOCK"),
                                     newLockState);
            LOK_ASSERT_MESSAGE("Lock token cannot be empty", !lock.empty());
            _lockState = newLockState;
            _lockToken = lock;
            TRANSITION_STATE(_phase, Phase::Modify);
        }
        else if (_phase == Phase::Unlock)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:UNLOCK", std::string("UNLOCK"),
                                     newLockState);
            LOK_ASSERT_EQUAL_MESSAGE("Document is not unlocked", std::string("LOCK"), _lockState);
            LOK_ASSERT_EQUAL_MESSAGE("The lock token has changed", _lockToken, lock);

            TRANSITION_STATE(_phase, Phase::Done);
            exitTest(TestResult::Ok);
        }
        else
        {
            LOK_ASSERT_FAIL("Unexpected lock-state change while in " + toString(_phase));
        }

        return nullptr; // Success.
    }

    /// Called when a new client session is added to a DocumentBroker.
    void onDocBrokerAddSession(const std::string&,
                               const std::shared_ptr<ClientSession>& session) override
    {
        ++_sessionCount;
        LOG_TST("New Session [" << session->getName() << "] added. Have " << _sessionCount
                                << " sessions.");
    }

    void onDocBrokerViewLoaded(const std::string&,
                               const std::shared_ptr<ClientSession>& session) override
    {
        LOG_TST("View for session [" << session->getName() << "] loaded. Have " << _sessionCount
                                     << " sessions.");
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::Modify);

        // Modify the doc.
        LOG_TST("Modifying");
        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        return true;
    }

    /// The document is modified. Load the viewer session.
    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("onDocumentModified: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::Modify);

        TRANSITION_STATE(_phase, Phase::Upload);

        LOG_TST("Disconnecting");
        deleteSocketAt(0);

        return true;
    }

    /// Called when a client session is removed to a DocumentBroker.
    void onDocBrokerRemoveSession(const std::string&,
                                  const std::shared_ptr<ClientSession>& session) override
    {
        --_sessionCount;
        LOG_TST("Session [" << session->getName() << "] removed. Have " << _sessionCount
                            << " sessions.");
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                // Always transition before issuing commands.
                TRANSITION_STATE(_phase, Phase::Lock);

                LOG_TST("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                LOG_TST("Loading view");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());
                break;
            }
            case Phase::Lock:
            case Phase::Modify:
            case Phase::Upload:
            case Phase::Unlock:
                break;
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWopiUnlock(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
