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
 * Unit test for WOPI owner termination scenarios.
 */

#include <config.h>

#include <common/Unit.hpp>
#include <common/Util.hpp>
#include <test/WopiTestServer.hpp>
#include <test/lokassert.hpp>

#include <Poco/Net/HTTPRequest.h>

#include <csignal>

using namespace std::literals;

/// This tests the rejection logic and messages that
/// happen when a document is connected to while
/// it is being unloaded.
/// Unfortunately, there is an inherent race here
/// in that we might have already unloaded by the
/// time we request loading via a different
/// connection. This race becomes more common the
/// faster we unload. Also, the test is poorly named.
class UnitWopiOwnertermination : public WopiTestServer
{
    STATE_ENUM(Phase, Start, Load, WaitLoadStatus, WaitModifiedStatus, WaitDocClose, Done) _phase;

    int _loadedIndex; ///< The connection index that is loaded now.

public:
    UnitWopiOwnertermination()
        : WopiTestServer("UnitWOPIOwnerTermination")
        , _phase(Phase::Start)
        , _loadedIndex(0)
    {
        setTimeout(1min);
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        // Load again, while we are still unloading.
        TRANSITION_STATE(_phase, Phase::Load);

        return nullptr;
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        TST_LOG("Loaded #" << (_loadedIndex + 1) << ": [" << message << ']');

        TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

        // Modify the document.
        TST_LOG("Modifying");
        WSD_CMD_BY_CONNECTION_INDEX(_loadedIndex, "key type=input char=97 key=0");
        WSD_CMD_BY_CONNECTION_INDEX(_loadedIndex, "key type=up char=0 key=512");

        return true;
    }

    /// The document is modified. Save, modify, and close it.
    bool onDocumentModified(const std::string& message) override
    {
        TST_LOG("Modified #" << (_loadedIndex + 1) << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        TRANSITION_STATE(_phase, Phase::WaitDocClose);

        TST_LOG("Closing");
        WSD_CMD_BY_CONNECTION_INDEX(_loadedIndex, "closedocument");

        return true;
    }

    bool onDocumentError(const std::string& message) override
    {
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        LOK_ASSERT_EQUAL_MESSAGE("Expect only documentunloading errors",
                                 std::string("error: cmd=load kind=docunloading"), message);

        TRANSITION_STATE(_phase, Phase::Done);

        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Start:
            {
                // First time loading, transition.
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                TST_LOG("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                TST_LOG("Loading through first connection");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());

                break;
            }
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                ++_loadedIndex;

                TST_LOG("Creating connection #" << (_loadedIndex + 1));
                addWebSocket();
                TST_LOG("Loading through connection #" << (_loadedIndex + 1));
                WSD_CMD_BY_CONNECTION_INDEX(_loadedIndex, "load url=" + getWopiSrc());

                break;
            }
            case Phase::WaitLoadStatus:
            case Phase::WaitModifiedStatus:
            case Phase::WaitDocClose:
                break;
            case Phase::Done:
                passTest("Reload while unloading failed as expected");
                break;
        }
    }
};

/// Test crashing a document after modifications.
class UnitWOPICrashModified : public WopiTestServer
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus, WaitDocClose) _phase;

    /// The PID of the Kit process.
    int _pid;

public:
    UnitWOPICrashModified()
        : WopiTestServer("UnitWOPICrashModified")
        , _phase(Phase::Load)
        , _pid(-1)
    {
    }

    void kitSegfault(int /* count */) override { /* ignore */ }

    std::unique_ptr<http::Response> assertPutFileRequest(const Poco::Net::HTTPRequest&) override
    {
        failTest("Unexpected PutFile when there should be no file on disk to upload");

        return nullptr;
    }

    void onDocBrokerAttachKitProcess(const std::string& docBroker, int pid) override
    {
        TST_LOG("DocBroker [" << docBroker << "] attached to pid: " << pid);
        _pid = pid;
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        TST_LOG("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

        TST_LOG("Modifying");
        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        return true;
    }

    bool onDocumentModified(const std::string& message) override
    {
        TST_LOG("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        TRANSITION_STATE(_phase, Phase::WaitDocClose);

        TST_LOG("Killing Kit with PID " << _pid);
        if (kill(_pid, SIGKILL) == -1)
        {
            const int onrre = errno;
            TST_LOG("kill(" << _pid << ", SIGKILL) failed: " << Util::symbolicErrno(onrre) << ": "
                            << std::strerror(onrre));
        }

        return true;
    }

    bool onDataLoss(const std::string& reason) override
    {
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);
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
            case Phase::WaitModifiedStatus:
            case Phase::WaitDocClose:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase*[3]{ new UnitWopiOwnertermination(), new UnitWOPICrashModified(), nullptr };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
