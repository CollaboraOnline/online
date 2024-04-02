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
        LOG_TST("In SavingPhase " << name(_savingPhase));

        // we fake autosave when saving the modified document
        const bool res = _savingPhase == SavingPhase::Modified;
        LOG_TST("isAutosave: " << std::boolalpha << res);
        return res;
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        LOG_TST("In SavingPhase " << name(_savingPhase));

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
        LOG_TST("In SavingPhase " << name(_savingPhase) << ": [" << message << ']');
        LOK_ASSERT_STATE(_savingPhase, SavingPhase::Unmodified);
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        // Save unmodified.
        WSD_CMD("save dontTerminateEdit=1 dontSaveIfUnmodified=0");
        return true;
    }

    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("In SavingPhase " << name(_savingPhase) << ": [" << message << ']');
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

                LOG_TST("Load: initWebsocket.");
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
        LOG_TST(">>> Child #" << _children.size());
    }

    virtual std::unique_ptr<http::Response>
    assertCheckFileInfoRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST(">>> CheckFileInfo #" << _count << ", total memory: " << getMemoryUsage() << " KB");

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
                LOG_TST("Open #" << _count);
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
                            LOG_TST(">>> Open #" << _count << ", total memory: " << getMemoryUsage()
                                                 << " KB");

                            const std::string wopiPath = "/wopi/files/invalid_" +
                                                         std::to_string(_count) +
                                                         "?access_token=anything";
                            const Poco::URI wopiURL(helpers::getTestServerURI() + wopiPath +
                                                    "&testname=" + getTestname());

                            const std::string wopiSrc =
                                Util::encodeURIComponent(wopiURL.toString());
                            const std::string documentURL = "/cool/" + wopiSrc + "/ws";

                            // This is just a client connection that is used from the tests.
                            LOG_TST("Connecting test client to COOL (#"
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
                                LOG_TST("Load #" << _count);
                                helpers::sendTextFrame(ws, "load url=" + wopiSrc, getTestname());
                            }
                            else
                            {
                                LOG_TST("Failed async request #" << _count << " to "
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

UnitBase** unit_create_wsd_multi(void)
{
    // return new UnitBase* [3] { new UnitWOPI(), new UnitOverload(), nullptr };
    return new UnitBase* [2] { new UnitWOPI(), nullptr };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
