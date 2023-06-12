/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <lokassert.hpp>

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

    std::unique_ptr<http::Response> assertPutFileRequest(const Poco::Net::HTTPRequest&) override
    {
        failTest("Unexpected PutFile when there should be no file on disk to upload");

        return nullptr;
    }

    void onDocBrokerAttachKitProcess(const std::string& docBroker, int pid) override
    {
        LOG_TST("DocBroker [" << docBroker << "] attached to pid: " << pid);
        _pid = pid;
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

        LOG_TST("Modifying");
        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        return true;
    }

    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        TRANSITION_STATE(_phase, Phase::WaitDocClose);

        LOG_TST("Killing Kit with PID " << _pid);
        if (kill(_pid, SIGKILL) == -1)
        {
            const int onrre = errno;
            LOG_TST("kill(" << _pid << ", SIGKILL) failed: " << Util::symbolicErrno(onrre) << ": "
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

                LOG_TST("Load: initWebsocket.");
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

UnitBase* unit_create_wsd(void) { return new UnitWOPICrashModified(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
