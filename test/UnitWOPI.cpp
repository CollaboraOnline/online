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

#include "Util.hpp"
#include "lokassert.hpp"

#include <WopiTestServer.hpp>

#include <wsd/DocumentBroker.hpp>
#include <wsd/Process.hpp>

#include <Poco/Net/HTTPRequest.h>

#include <thread>
#include <sys/types.h>
#include <unistd.h>

class UnitWOPI : public WopiTestServer
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus, Done) _phase;

    STATE_ENUM(SavingPhase, Unmodified, Modified) _savingPhase;

    bool _finishedSaveUnmodified;
    bool _finishedSaveModified;

public:
    UnitWOPI()
        : WopiTestServer("UnitWOPI")
        , _phase(Phase::Load)
        , _savingPhase(SavingPhase::Unmodified)
        , _finishedSaveUnmodified(false)
        , _finishedSaveModified(false)
    {
    }

    bool isAutosave() override
    {
        TST_LOG("In SavingPhase " << name(_savingPhase));

        // we fake autosave when saving the modified document
        const bool res = _savingPhase == SavingPhase::Modified;
        TST_LOG("isAutosave: " << std::boolalpha << res);
        return res;
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        TST_LOG("In SavingPhase " << name(_savingPhase));

        if (_savingPhase == SavingPhase::Unmodified)
        {
            LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

            // the document is not modified
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsModifiedByUser"));

            // but the save action is an explicit user's request
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsAutosave"));

            _finishedSaveUnmodified = true;

            // Modify to test the modified phase.
            TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);
            WSD_CMD("key type=input char=97 key=0");
            WSD_CMD("key type=up char=0 key=512");
        }
        else if (_savingPhase == SavingPhase::Modified)
        {
            LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

            // the document is modified
            LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsModifiedByUser"));

            // and this test fakes that it's an autosave
            LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsAutosave"));

            // Check that we get the extended data.
            LOK_ASSERT_EQUAL(std::string("CustomFlag=Custom Value;AnotherFlag=AnotherValue"),
                             request.get("X-COOL-WOPI-ExtendedData"));

            _finishedSaveModified = true;

            TRANSITION_STATE(_phase, Phase::Done);
        }

        if (_finishedSaveUnmodified && _finishedSaveModified)
            passTest("Headers for both modified and unmodified received as expected.");

        return nullptr;
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        TST_LOG("In SavingPhase " << name(_savingPhase) << ": [" << message << ']');
        LOK_ASSERT_STATE(_savingPhase, SavingPhase::Unmodified);
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        // Save unmodified.
        WSD_CMD("save dontTerminateEdit=1 dontSaveIfUnmodified=0");
        return true;
    }

    bool onDocumentModified(const std::string& message) override
    {
        TST_LOG("In SavingPhase " << name(_savingPhase) << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        TRANSITION_STATE(_savingPhase, SavingPhase::Modified);

        // Save modified.
        WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0 "
                "extendedData=CustomFlag%3DCustom%20Value%3BAnotherFlag%3DAnotherValue");

        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                TST_LOG("Load: initWebsocket.");
                initWebsocket("/wopi/files/0?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
            }
            break;

            case Phase::WaitLoadStatus:
            case Phase::WaitModifiedStatus:
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

class UnitOverload : public WopiTestServer
{
    STATE_ENUM(Phase, HalfOpen, Load, WaitLoadStatus, WaitModifiedStatus, Done) _phase;

    std::thread _dosThread;
    std::vector<pid_t> _children;
    std::vector<std::shared_ptr<http::WebSocketSession>> _webSessions;
    int _count;

    std::size_t getMemoryUsage() const
    {
        std::size_t total = Util::getMemoryUsageRSS(getpid()) + Util::getMemoryUsagePSS(getpid());
        for (const pid_t pid : _children)
            total += Util::getMemoryUsageRSS(pid) + Util::getMemoryUsagePSS(pid);

        return total;
    }

public:
    UnitOverload()
        : WopiTestServer("UnitOverload")
        , _phase(Phase::Load)
        , _count(0)
    {
    }

    void newChild(const std::shared_ptr<ChildProcess>& child) override
    {
        _children.emplace_back(child->getPid());
        TST_LOG(">>> Child #" << _children.size());
    }

    virtual std::unique_ptr<http::Response>
    assertCheckFileInfoRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        TST_LOG(">>> CheckFileInfo #" << _count << ", total memory: " << getMemoryUsage() << " KB");

        SocketPoll::wakeupWorld();
        return std::make_unique<http::Response>(http::StatusCode::NotFound);
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::HalfOpen:
            {
                TRANSITION_STATE(_phase, Phase::Done);
                ++_count;
                TST_LOG("Open #" << _count);
                initWebsocket("/wopi/files/" + std::to_string(_count) + "?access_token=anything");
            }
            break;

            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::Done);
                _dosThread = std::thread(
                    [this]
                    {
                        for (;;)
                        {
                            ++_count;
                            TST_LOG(">>> Open #" << _count << ", total memory: " << getMemoryUsage()
                                                 << " KB");

                            const std::string wopiPath = "/wopi/files/invalid_" +
                                                         std::to_string(_count) +
                                                         "?access_token=anything";
                            const Poco::URI wopiURL(helpers::getTestServerURI() + wopiPath +
                                                    "&testname=" + getTestname());

                            const std::string wopiSrc = Uri::encode(wopiURL.toString());
                            const std::string documentURL = "/cool/" + wopiSrc + "/ws";

                            // This is just a client connection that is used from the tests.
                            TST_LOG("Connecting test client to COOL (#"
                                    << _count << " connection): " << documentURL);

                            Poco::URI uri(helpers::getTestServerURI());

                            std::shared_ptr<http::WebSocketSession> ws =
                                http::WebSocketSession::create(uri.toString());
                            TST_LOG("Connection to " << uri.toString() << " is "
                                                     << (ws->secure() ? "secure" : "plain"));

                            http::Request req(documentURL);
                            if (ws->asyncRequest(req, socketPoll()))
                            {
                                _webSessions.emplace_back(ws);
                                TST_LOG("Load #" << _count);
                                helpers::sendTextFrame(ws, "load url=" + wopiSrc, getTestname());
                            }
                            else
                            {
                                TST_LOG("Failed async request #" << _count << " to "
                                                                 << documentURL);
                            }
                        }
                    });
            }
            break;

            case Phase::WaitLoadStatus:
            case Phase::WaitModifiedStatus:
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

/// This is to test that when the WOPI host is
/// unavailable, we are still able to unload.
class UnitWopiUnavailable : public WopiTestServer
{
    using Base = WopiTestServer;

    STATE_ENUM(Phase, Load, WaitLoadStatus, Done)
    _phase;

    std::string _lockState;
    std::string _lockToken;

    std::chrono::steady_clock::time_point _refreshTime;

    std::atomic_bool _saved;
    std::atomic_bool _uploaded;
    int _cfiCount;
    int _lockCount;

    static constexpr int RefreshPeriodSeconds = 1;

public:
    UnitWopiUnavailable()
        : WopiTestServer("UnitWopiUnavailable")
        , _phase(Phase::Load)
        , _lockState("UNLOCK")
        , _saved(false)
        , _uploaded(false)
        , _cfiCount(0)
        , _lockCount(0)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        WopiTestServer::configure(config);

        config.setUInt("storage.wopi.locking.refresh", RefreshPeriodSeconds);
    }

    void configCheckFileInfo(const Poco::Net::HTTPRequest& /*request*/,
                             Poco::JSON::Object::Ptr& fileInfo) override
    {
        fileInfo->set("SupportsLocks", "true");
    }

    bool handleCheckFileInfoRequest(const Poco::Net::HTTPRequest& request,
                                    const std::shared_ptr<StreamSocket>& socket) override
    {
        ++_cfiCount;

        if (_cfiCount == 1)
        {
            // The first one must succeed to load the document.
            TST_LOG("Succeeding the CheckFileInfo request (default handler)");
            return WopiTestServer::handleCheckFileInfoRequest(request, socket);
        }

        if (_lockCount > 1)
        {
            TST_LOG("Failing the CheckFileInfo request (Unauthorized): lock count=" << _lockCount);
            std::unique_ptr<http::Response> httpResponse =
                std::make_unique<http::Response>(http::StatusCode::Unauthorized);
            socket->sendAndShutdown(*httpResponse);
        }

        return true;
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsModifiedByUser"));
        LOK_ASSERT_EQUAL(false, request.has("X-LOOL-WOPI-IsModifiedByUser"));

        LOK_ASSERT_EQUAL(true, request.has("X-COOL-WOPI-IsAutosave"));
        LOK_ASSERT_EQUAL(false, request.has("X-LOOL-WOPI-IsAutosave"));

        // Triggered while closing.
        LOK_ASSERT_EQUAL(true, request.has("X-COOL-WOPI-IsExitSave"));
        LOK_ASSERT_EQUAL(false, request.has("X-LOOL-WOPI-IsExitSave"));

        // Fail with error.
        TST_LOG("Returning 500 to simulate PutFile failure");
        return std::make_unique<http::Response>(http::StatusCode::InternalServerError);
    }

    std::unique_ptr<http::Response>
    assertLockRequest(const Poco::Net::HTTPRequest& request) override
    {
        const std::string lockToken = request.get("X-WOPI-Lock", std::string());
        const std::string newLockState = request.get("X-WOPI-Override", std::string());
        TST_LOG("In " << name(_phase) << ", X-WOPI-Lock: " << lockToken << ", X-WOPI-Override: "
                      << newLockState << ", for URI: " << request.getURI());

        ++_lockCount;

        if (_lockCount == 2)
        {
            TST_LOG("Disconnecting");
            deleteSocketAt(0);
        }

        if (_lockCount > 1)
        {
            // Fail with error.
            TST_LOG("Returning 503 to simulate Lock failure");
            return std::make_unique<http::Response>(http::StatusCode::ServiceUnavailable);
        }

        if ("LOCK" == newLockState)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:LOCK", std::string("LOCK"),
                                     newLockState);
            LOK_ASSERT_MESSAGE("Lock token cannot be empty", !lockToken.empty());
            _lockState = newLockState;
            _lockToken = lockToken;

            _refreshTime = std::chrono::steady_clock::now();

            return nullptr; // Succeed in locking.
        }
        else if ("UNLOCK" == newLockState)
        {
            LOK_ASSERT_EQUAL_MESSAGE("Expected X-WOPI-Override:UNLOCK", std::string("UNLOCK"),
                                     newLockState);
            LOK_ASSERT_EQUAL_MESSAGE("Document is not locked", std::string("LOCK"), _lockState);
            LOK_ASSERT_EQUAL_MESSAGE("The lock token has changed", _lockToken, lockToken);
        }
        else
        {
            LOK_ASSERT_FAIL("Unexpected lock-state change while in " << name(_phase));
        }

        // Fail with error.
        TST_LOG("Returning 503 to simulate Lock failure");
        return std::make_unique<http::Response>(http::StatusCode::ServiceUnavailable);
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        TST_LOG("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TST_LOG("Modifying the document");
        TRANSITION_STATE(_phase, Phase::Done);

        // Modify the currently opened document; type 'a'.
        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        return true;
    }

    bool onDataLoss(const std::string& reason) override
    {
        passTest("Finished with the data-loss check: " + reason);
        return failed();
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                TST_LOG("Load: initWebsocket.");
                initWebsocket("/wopi/files/0?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
                break;
            }
            case Phase::WaitLoadStatus:
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
    // return new UnitBase* [3] { new UnitWOPI(), new UnitOverload(), nullptr };
    return new UnitBase*[3]{ new UnitWOPI(), new UnitWopiUnavailable(), nullptr };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
