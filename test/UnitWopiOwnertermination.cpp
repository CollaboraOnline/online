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

class UnitWopiOwnertermination : public WopiTestServer
{
    enum class Phase
    {
        Load,
        Modify,
        OwnerTermination,
        Polling
    } _phase;

public:
    UnitWopiOwnertermination() :
        _phase(Phase::Load)
    {
    }

    void assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        if (_phase == Phase::Polling)
        {
            // Document got saved, that's what we wanted
            exitTest(TestResult::Ok);
        }
    }

    void invokeTest() override
    {
        constexpr char testName[] = "UnitWopiOwnertermination";

        switch (_phase)
        {
            case Phase::Load:
            {
                initWebsocket("/wopi/files/0?access_token=anything");

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "load url=" + getWopiSrc(), testName);

                _phase = Phase::Modify;
                break;
            }
            case Phase::Modify:
            {
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=input char=97 key=0", testName);
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=up char=0 key=512", testName);

                _phase = Phase::OwnerTermination;
                SocketPoll::wakeupWorld();
                break;
            }
	        case Phase::OwnerTermination:
            {
                _phase = Phase::Polling;
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "closedocument", testName);
                break;
            }
            case Phase::Polling:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitWopiOwnertermination();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
