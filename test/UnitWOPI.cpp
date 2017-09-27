/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include "WopiTestServer.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"
#include "helpers.hpp"
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Util/LayeredConfiguration.h>

class UnitWOPI : public WopiTestServer
{
    enum class Phase
    {
        LoadAndSave,
        Modify,
        SaveModified,
        Finish
    } _phase;

    enum class SavingPhase
    {
        Unmodified,
        Modified
    } _savingPhase;

    bool _finishedSaveUnmodified;
    bool _finishedSaveModified;

    std::unique_ptr<UnitWebSocket> _ws;

public:
    UnitWOPI() :
        _phase(Phase::LoadAndSave),
        _finishedSaveUnmodified(false),
        _finishedSaveModified(false)
    {
    }

    void assertCheckFileInfoRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        // nothing to assert in CheckFileInfo
    }

    void assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        // nothing to assert in GetFile
    }

    void assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        if (_savingPhase == SavingPhase::Unmodified)
        {
            CPPUNIT_ASSERT_EQUAL(std::string("false"), request.get("X-LOOL-WOPI-IsModifiedByUser"));
            _finishedSaveUnmodified = true;
        }
        else if (_savingPhase == SavingPhase::Modified)
        {
            CPPUNIT_ASSERT_EQUAL(std::string("true"), request.get("X-LOOL-WOPI-IsModifiedByUser"));
            _finishedSaveModified = true;
        }
    }

    void invokeTest() override
    {
        constexpr char testName[] = "UnitWOPI";

        switch (_phase)
        {
            case Phase::LoadAndSave:
            {
                Poco::URI wopiURL(helpers::getTestServerURI() + "/wopi/files/0?access_token=anything");
                std::string wopiSrc;
                Poco::URI::encode(wopiURL.toString(), ":/?", wopiSrc);
                Poco::URI loolUri(helpers::getTestServerURI());

                LOG_INF("Connecting to the fake WOPI server: /lool/" << wopiSrc << "/ws");

                _ws.reset(new UnitWebSocket("/lool/" + wopiSrc + "/ws"));
                assert(_ws.get());

                helpers::sendTextFrame(*_ws->getLOOLWebSocket(), "load url=" + wopiSrc, testName);
                helpers::sendTextFrame(*_ws->getLOOLWebSocket(), "save dontTerminateEdit=1 dontSaveIfUnmodified=0", testName);

                _phase = Phase::Modify;
                _savingPhase = SavingPhase::Unmodified;
                break;
            }
            case Phase::Modify:
            {
                helpers::sendTextFrame(*_ws->getLOOLWebSocket(), "key type=input char=97 key=0", testName);
                helpers::sendTextFrame(*_ws->getLOOLWebSocket(), "key type=up char=0 key=512", testName);

                _phase = Phase::SaveModified;
                break;
            }
            case Phase::SaveModified:
            {
                helpers::sendTextFrame(*_ws->getLOOLWebSocket(), "save dontTerminateEdit=0 dontSaveIfUnmodified=0", testName);

                _phase = Phase::Finish;
                _savingPhase = SavingPhase::Modified;
                break;
            }
            case Phase::Finish:
            {
                CPPUNIT_ASSERT(_finishedSaveUnmodified && _finishedSaveModified);
                exitTest(TestResult::Ok);
                break;
            }
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitWOPI();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
