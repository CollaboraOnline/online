/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "lokassert.hpp"

#include <WopiTestServer.hpp>
#include <Poco/Net/HTTPRequest.h>

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

UnitBase* unit_create_wsd(void) { return new UnitWOPI(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
