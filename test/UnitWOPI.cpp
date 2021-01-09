/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "lokassert.hpp"
#include <config.h>

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Util/LayeredConfiguration.h>

class UnitWOPI : public WopiTestServer
{
    enum class Phase
    {
        Load,
        WaitLoadStatus,
        Modify,
        WaitModifiedStatus,
        Polling
    } _phase;

    enum class SavingPhase
    {
        Unmodified,
        Modified
    } _savingPhase;

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
        // we fake autosave when saving the modified document
        const bool res = _savingPhase == SavingPhase::Modified;
        LOG_TST("isAutosave: " << std::boolalpha << res);
        return res;
    }

    void assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        if (_savingPhase == SavingPhase::Unmodified)
        {
            LOG_TST("assertPutFileRequest: SavingPhase::Unmodified");

            // the document is not modified
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-LOOL-WOPI-IsModifiedByUser"));

            // but the save action is an explicit user's request
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-LOOL-WOPI-IsAutosave"));

            _finishedSaveUnmodified = true;
        }
        else if (_savingPhase == SavingPhase::Modified)
        {
            LOG_TST("assertPutFileRequest: SavingPhase::Modified");

            // the document is modified
            LOK_ASSERT_EQUAL(std::string("true"), request.get("X-LOOL-WOPI-IsModifiedByUser"));

            // and this test fakes that it's an autosave
            LOK_ASSERT_EQUAL(std::string("true"), request.get("X-LOOL-WOPI-IsAutosave"));

            // Check that we get the extended data.
            LOK_ASSERT_EQUAL(std::string("CustomFlag=Custom Value;AnotherFlag=AnotherValue"),
                             request.get("X-LOOL-WOPI-ExtendedData"));

            _finishedSaveModified = true;
        }

        if (_finishedSaveUnmodified && _finishedSaveModified)
            passTest("Headers for both modified and unmodified received as expected.");
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitLoadStatus",
                           _phase == Phase::WaitLoadStatus);

        LOG_TST("onDocumentModified: Switching to Phase::Modify, SavingPhase::Unmodified");
        _savingPhase = SavingPhase::Unmodified;
        _phase = Phase::Modify;

        helpers::sendTextFrame(*getWs()->getLOOLWebSocket(),
                               "save dontTerminateEdit=1 dontSaveIfUnmodified=0", getTestname());

        SocketPoll::wakeupWorld();
        return true;
    }

    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("onDocumentModified: Doc (WaitModifiedStatus): [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitModified",
                           _phase == Phase::WaitModifiedStatus);
        {
            LOG_TST("onDocumentModified: Switching to Phase::Polling, SavingPhase::Modified");
            _phase = Phase::Polling;
            _savingPhase = SavingPhase::Modified;

            helpers::sendTextFrame(
                *getWs()->getLOOLWebSocket(),
                "save dontTerminateEdit=0 dontSaveIfUnmodified=0 "
                "extendedData=CustomFlag%3DCustom%20Value%3BAnotherFlag%3DAnotherValue",
                getTestname());

            SocketPoll::wakeupWorld();
        }

        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                _phase = Phase::WaitLoadStatus;

                LOG_TST("Load: initWebsocket.");
                initWebsocket("/wopi/files/0?access_token=anything");

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "load url=" + getWopiSrc(),
                                       getTestname());
                break;
            }
            case Phase::Modify:
            {
                LOG_TST("Modify => WaitModified");
                _phase = Phase::WaitModifiedStatus;

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=input char=97 key=0",
                                       getTestname());
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=up char=0 key=512",
                                       getTestname());

                break;
            }
            case Phase::WaitLoadStatus:
            case Phase::WaitModifiedStatus:
            case Phase::Polling:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPI(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
