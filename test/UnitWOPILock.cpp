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

/// This is to test that we unlock before unloading the last editor.
class UnitWopiLock : public WopiTestServer
{
    STATE_ENUM(Phase, Load, Lock, Unlock, Done) _phase;

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

    void configCheckFileInfo(const Poco::Net::HTTPRequest& /*request*/,
                             Poco::JSON::Object::Ptr& fileInfo) override
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
        const std::string lockToken = request.get("X-WOPI-Lock", std::string());
        const std::string newLockState = request.get("X-WOPI-Override", std::string());
        LOG_TST("In " << toString(_phase) << ", X-WOPI-Lock: " << lockToken << ", X-WOPI-Override: "
                      << newLockState << ", for URI: " << request.getURI());

        if (_phase == Phase::Lock)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:LOCK", std::string("LOCK"),
                                     newLockState);
            LOK_ASSERT_MESSAGE("Lock token cannot be empty", !lockToken.empty());
            _lockState = newLockState;
            _lockToken = lockToken;
        }
        else if (_phase == Phase::Unlock)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:UNLOCK", std::string("UNLOCK"),
                                     newLockState);
            LOK_ASSERT_EQUAL_MESSAGE("Document is not locked", std::string("LOCK"), _lockState);
            LOK_ASSERT_EQUAL_MESSAGE("The lock token has changed", _lockToken, lockToken);

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
            TRANSITION_STATE(_phase, Phase::Unlock);

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
                TRANSITION_STATE(_phase, Phase::Lock);

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
            case Phase::Lock:
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

/// This is to test that we unlock before unloading the last editor
/// when the first view is read-only.
class UnitWopiLockReadOnly : public WopiTestServer
{
    STATE_ENUM(Phase, LoadViewer, LoadEditor, Lock, WaitModify, Unlock, WaitUnload, Done) _phase;

    std::string _lockState;
    std::string _lockToken;
    std::size_t _checkFileInfoCount;
    std::size_t _viewCount;

public:
    UnitWopiLockReadOnly()
        : WopiTestServer("UnitWopiLockReadOnly")
        , _phase(Phase::LoadViewer)
        , _lockState("UNLOCK")
        , _checkFileInfoCount(0)
        , _viewCount(0)
    {
    }

    void configCheckFileInfo(const Poco::Net::HTTPRequest& /*request*/,
                             Poco::JSON::Object::Ptr& fileInfo) override
    {
        // Make the first session the editor, subsequent ones read-only.
        const bool firstView = _checkFileInfoCount == 0;
        ++_checkFileInfoCount;

        LOG_TST("CheckFileInfo: " << (firstView ? "viewer" : "editor"));

        fileInfo->set("SupportsLocks", "true");
        fileInfo->set("UserCanWrite", firstView ? "false" : "true");

        // An extension that doesn't allow commenting. By omitting this,
        // the test fails because we allow commenting and consider the
        // document editable, and don't unlock when the editor disconnects.
        fileInfo->set("BaseFileName", "doc.odt");
    }

    std::unique_ptr<http::Response>
    assertLockRequest(const Poco::Net::HTTPRequest& request) override
    {
        const std::string lockToken = request.get("X-WOPI-Lock", std::string());
        const std::string newLockState = request.get("X-WOPI-Override", std::string());
        LOG_TST("In " << toString(_phase) << ", X-WOPI-Lock: " << lockToken << ", X-WOPI-Override: "
                      << newLockState << ", for URI: " << request.getURI());

        if (_phase == Phase::Lock)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:LOCK", std::string("LOCK"),
                                     newLockState);
            LOK_ASSERT_MESSAGE("Lock token cannot be empty", !lockToken.empty());
            _lockState = newLockState;
            _lockToken = lockToken;
        }
        else if (_phase == Phase::Unlock)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:UNLOCK", std::string("UNLOCK"),
                                     newLockState);
            LOK_ASSERT_EQUAL_MESSAGE("Document is not locked", std::string("LOCK"), _lockState);
            LOK_ASSERT_EQUAL_MESSAGE("The lock token has changed", _lockToken, lockToken);

            // TRANSITION_STATE(_phase, Phase::Done);
            // exitTest(TestResult::Ok);
        }
        else
        {
            LOK_ASSERT_FAIL("Unexpected lock-state change while in " + toString(_phase));
        }

        return nullptr; // Success.
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        LOK_ASSERT_STATE(_phase, Phase::Unlock);
        TRANSITION_STATE(_phase, Phase::WaitUnload);

        // The document is modified.
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsModifiedByUser"));
        LOK_ASSERT_EQUAL(false, request.has("X-LOOL-WOPI-IsModifiedByUser"));

        // Triggered manually or during closing, not auto-save.
        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsAutosave"));
        LOK_ASSERT_EQUAL(false, request.has("X-LOOL-WOPI-IsAutosave"));

        // The only editor goes away.
        // LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsExitSave"));
        // LOK_ASSERT_EQUAL(std::string("true"), request.get("X-LOOL-WOPI-IsExitSave"));

        // Simulate the viewer closing browser.
        LOG_TST("Disconnecting Viewer");
        deleteSocketAt(0);

        return nullptr; // Success.
    }

    void onDocBrokerViewLoaded(const std::string&,
                               const std::shared_ptr<ClientSession>& session) override
    {
        LOG_TST("View #" << _viewCount + 1 << " [" << session->getName() << "] loaded");

        ++_viewCount;
        if (_viewCount == 1)
        {
            LOK_ASSERT_STATE(_phase, Phase::LoadEditor);
            TRANSITION_STATE(_phase, Phase::Lock);

            LOG_TST("Loading second view (editor)");
            WSD_CMD_BY_CONNECTION_INDEX(1, "load url=" + getWopiSrc());
        }
        else if (_viewCount == 2)
        {
            // Transition before modifying.
            TRANSITION_STATE(_phase, Phase::WaitModify);

            // Modify the doc.
            LOG_TST("Modifying (editor)");
            WSD_CMD_BY_CONNECTION_INDEX(1, "key type=input char=97 key=0");
            WSD_CMD_BY_CONNECTION_INDEX(1, "key type=up char=0 key=512");
        }
    }

    /// The document is modified. Disconnect editor.
    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("onDocumentModified: [" << message << ']');

        if (_phase != Phase::Unlock)
        {
            LOK_ASSERT_STATE(_phase, Phase::WaitModify);
            TRANSITION_STATE(_phase, Phase::Unlock);
        }

        // Simulate the editor closing browser.
        LOG_TST("Disconnecting Editor");
        deleteSocketAt(1);

        return true;
    }

    void onDocBrokerRemoveSession(const std::string&,
                                  const std::shared_ptr<ClientSession>& session) override
    {
        LOG_TST("Removing session [" << session->getName() << ']');
        if (_phase == Phase::Unlock)
        {
            // LOK_ASSERT_STATE(_phase, Phase::WaitUnload);
        }
    }

    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Destroyed dockey [" << docKey << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitUnload);

        TRANSITION_STATE(_phase, Phase::Done);
        passTest("No modification or unexpected PutFile on read-only doc");
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::LoadViewer:
            {
                // Always transition before issuing commands.
                TRANSITION_STATE(_phase, Phase::LoadEditor);

                LOG_TST("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                LOG_TST("Creating second connection");
                addWebSocket();

                LOG_TST("Loading first view (viewer)");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());
                break;
            }
            case Phase::LoadEditor:
            case Phase::Lock:
            case Phase::WaitModify:
            case Phase::Unlock:
            case Phase::WaitUnload:
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

/// This is to test the behavior when locking fails.
class UnitWopiLockFail : public WopiTestServer
{
    STATE_ENUM(Phase, Load, Lock, RefreshLock, Done) _phase;

    std::string _lockState;
    std::string _lockToken;
    std::size_t _lockRefreshCount;
    std::chrono::steady_clock::time_point _refreshTime;

    static constexpr int RefreshPeriodSeconds = 2;

public:
    UnitWopiLockFail()
        : WopiTestServer("UnitWopiLockFail")
        , _phase(Phase::Load)
        , _lockState("UNLOCK")
        , _lockRefreshCount(0)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        WopiTestServer::configure(config);

        // Small value to shorten the test run time.
        config.setUInt("storage.wopi.locking.refresh", RefreshPeriodSeconds);
    }

    void configCheckFileInfo(const Poco::Net::HTTPRequest& /*request*/,
                             Poco::JSON::Object::Ptr& fileInfo) override
    {
        fileInfo->set("SupportsLocks", "true");
    }

    std::unique_ptr<http::Response>
    assertLockRequest(const Poco::Net::HTTPRequest& request) override
    {
        const std::string lockToken = request.get("X-WOPI-Lock", std::string());
        const std::string newLockState = request.get("X-WOPI-Override", std::string());
        LOG_TST("In " << toString(_phase) << ", X-WOPI-Lock: " << lockToken << ", X-WOPI-Override: "
                      << newLockState << ", for URI: " << request.getURI());

        if (_phase == Phase::Lock)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:LOCK", std::string("LOCK"),
                                     newLockState);
            LOK_ASSERT_MESSAGE("Lock token cannot be empty", !lockToken.empty());
            _lockState = newLockState;
            _lockToken = lockToken;

            _refreshTime = std::chrono::steady_clock::now();
            TRANSITION_STATE(_phase, Phase::RefreshLock);
        }
        else if (_phase == Phase::RefreshLock)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:LOCK", std::string("LOCK"),
                                     newLockState);
            LOK_ASSERT_EQUAL_MESSAGE("Document is not locked", std::string("LOCK"), _lockState);
            LOK_ASSERT_EQUAL_MESSAGE("The lock token has changed", _lockToken, lockToken);

            ++_lockRefreshCount;
            LOK_ASSERT_EQUAL_MESSAGE("Lock refresh with expired token", 1UL, _lockRefreshCount);

            // Internal Server Error.
            return std::make_unique<http::Response>(http::StatusCode::Unauthorized);
        }
        else
        {
            LOK_ASSERT_FAIL("Unexpected lock-state change while in " + toString(_phase));
        }

        return nullptr; // Success.
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

                LOG_TST("Loading first view (editor)");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());
                break;
            }
            case Phase::Lock:
                break;
            case Phase::RefreshLock:
            {
                // Wait for the modified status (and fail) in onDocumentModified.
                // Otherwise, save the document and wait for upload.
                const auto now = std::chrono::steady_clock::now();
                const auto elapsed =
                    std::chrono::duration_cast<std::chrono::milliseconds>(now - _refreshTime);
                if (_lockRefreshCount == 1 &&
                    elapsed >= std::chrono::seconds(RefreshPeriodSeconds * 3))
                {
                    TRANSITION_STATE(_phase, Phase::Done);
                    exitTest(TestResult::Ok);
                }
            }
            break;
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

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

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        WopiTestServer::configure(config);

        // Do *not* refresh.
        config.setUInt("storage.wopi.locking.refresh", 0);
    }

    void configCheckFileInfo(const Poco::Net::HTTPRequest& /*request*/,
                             Poco::JSON::Object::Ptr& fileInfo) override
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
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase* [5]
    {
        new UnitWopiLock(), new UnitWopiLockReadOnly(), new UnitWopiLockFail(),
            new UnitWopiUnlock(), nullptr
    };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
