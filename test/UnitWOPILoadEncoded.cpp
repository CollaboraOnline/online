/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Util/LayeredConfiguration.h>

class UnitWOPILoadEncoded : public WopiTestServer
{
    enum class Phase
    {
        LoadEncoded,
        CloseDoc,
        Polling
    } _phase;

public:
    UnitWOPILoadEncoded() :
        _phase(Phase::LoadEncoded)
    {
    }

    void invokeTest() override
    {
        constexpr char testName[] = "UnitWOPILoadEncoded";

        switch (_phase)
        {
            case Phase::LoadEncoded:
            {
                initWebsocket("/wopi/files/3?access_token=anything");

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "load url=" + getWopiSrc(), testName);
                SocketPoll::wakeupWorld();

                _phase = Phase::CloseDoc;
                break;
            }
            case Phase::CloseDoc:
            {
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "closedocument", testName);
                _phase = Phase::Polling;
                break;
            }
            case Phase::Polling:
            {
                exitTest(TestResult::Ok);
                break;
            }
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitWOPILoadEncoded();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
