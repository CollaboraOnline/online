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

class UnitWopiLock : public WopiTestServer
{
    STATE_ENUM(Phase, Load, LockDocument, UnlockDocument, Done) _phase;

    std::string _lockState;
    std::string _lockString;
    std::size_t _sessionCount;

public:
    UnitWopiLock()
        : WopiTestServer("UnitWopiLock")
        , _phase(Phase::Load)
        , _lockState("UNLOCK")
        , _sessionCount(0)
    {
    }

    void configCheckFileInfo(Poco::JSON::Object::Ptr fileInfo) override
    {
        LOG_TST("CheckFileInfo: Have " << _sessionCount << " sessions");

        fileInfo->set("SupportsLocks", "true");

        // Make the first session the editor, the second one read-only.
        fileInfo->set("UserCanWrite", _sessionCount ? "false" : "true");
    }

    void assertLockRequest(const Poco::Net::HTTPRequest& request) override
    {
        const std::string lock = request.get("X-WOPI-Lock", std::string());
        const std::string newLockState = request.get("X-WOPI-Override", std::string());
        LOG_TST("In " << toString(_phase) << ", X-WOPI-Lock: " << lock << ", X-WOPI-Override: "
                      << newLockState << ", for URI: " << request.getURI());

        if (_phase == Phase::LockDocument)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:LOCK", std::string("LOCK"),
                                     newLockState);
            LOK_ASSERT_MESSAGE("Lock String cannot be empty", !lock.empty());
            _lockState = newLockState;
            _lockString = lock;
        }
        else if (_phase == Phase::UnlockDocument)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:UNLOCK", std::string("UNLOCK"),
                                     newLockState);
            LOK_ASSERT_MESSAGE("Document is not unlocked", _lockState != "UNLOCK");
            LOK_ASSERT_EQUAL(_lockString, lock);
            TRANSITION_STATE(_phase, Phase::Done);
            exitTest(TestResult::Ok);
        }
        else
        {
            LOK_ASSERT_FAIL("Unexpected lock-state change while in " + toString(_phase));
        }
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
        LOG_TST("View for session [" << session->getName() << "] loaded.");

        if (_sessionCount == 2)
        {
            // Transition before disconnecting.
            TRANSITION_STATE(_phase, Phase::UnlockDocument);

            // force kill the session with edit permission
            LOG_TST("Disconnecting first connection with edit permission");
            deleteSocketAt(0);
        }
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
                TRANSITION_STATE(_phase, Phase::LockDocument);

                LOG_TST("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                LOG_TST("Creating second connection");
                addWebSocket();

                LOG_TST("Loading first view (editor)");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());
                LOG_TST("Loading second view (viewer)");
                WSD_CMD_BY_CONNECTION_INDEX(1, "load url=" + getWopiSrc());
                break;
            }
            case Phase::LockDocument:
            case Phase::UnlockDocument:
                break;
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitWopiLock();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
