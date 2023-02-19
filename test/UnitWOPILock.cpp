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

/// This is to test that we unlock before unloading the last editor.
class UnitWopiLock : public WopiTestServer
{
    STATE_ENUM(Phase, Load, LockDocument, UnlockDocument, Done) _phase;

    std::string _lockState;
    std::string _lockToken;
    std::size_t _checkFileInfoCount;
    std::size_t _viewCount;

public:
    UnitWopiLock()
        : WopiTestServer("UnitWopiLock")
        , _phase(Phase::Load)
        , _lockState("UNLOCK")
        , _checkFileInfoCount(0)
        , _viewCount(0)
    {
    }

    void configCheckFileInfo(Poco::JSON::Object::Ptr fileInfo) override
    {
        // Make the first session the editor, subsequent ones read-only.
        const bool firstView = _checkFileInfoCount == 0;
        ++_checkFileInfoCount;

        LOG_TST("CheckFileInfo: " << (firstView ? "editor" : "viewer"));

        fileInfo->set("SupportsLocks", "true");
        fileInfo->set("UserCanWrite", firstView ? "true" : "false");

        // An extension that doesn't allow commenting. By omitting this,
        // the test fails because we allow commenting and consider the
        // document editable, and don't unlock when the editor disconnects.
        fileInfo->set("BaseFileName", "doc.odt");
    }

    std::unique_ptr<http::Response>
    assertLockRequest(const Poco::Net::HTTPRequest& request) override
    {
        const std::string lock = request.get("X-WOPI-Lock", std::string());
        const std::string newLockState = request.get("X-WOPI-Override", std::string());
        LOG_TST("In " << toString(_phase) << ", X-WOPI-Lock: " << lock << ", X-WOPI-Override: "
                      << newLockState << ", for URI: " << request.getURI());

        if (_phase == Phase::LockDocument)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:LOCK", std::string("LOCK"),
                                     newLockState);
            LOK_ASSERT_MESSAGE("Lock token cannot be empty", !lock.empty());
            _lockState = newLockState;
            _lockToken = lock;
        }
        else if (_phase == Phase::UnlockDocument)
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

    void onDocBrokerViewLoaded(const std::string&,
                               const std::shared_ptr<ClientSession>& session) override
    {
        LOG_TST("View #" << _viewCount + 1 << " [" << session->getName() << "] loaded");

        ++_viewCount;
        if (_viewCount == 2)
        {
            // Transition before disconnecting.
            TRANSITION_STATE(_phase, Phase::UnlockDocument);

            // force kill the session with edit permission
            LOG_TST("Disconnecting first connection with edit permission");
            deleteSocketAt(0);
        }
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

UnitBase* unit_create_wsd(void) { return new UnitWopiLock(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
