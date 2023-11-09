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

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <Poco/Util/LayeredConfiguration.h>

class UnitWOPILoadEncoded : public WopiTestServer
{
    STATE_ENUM(Phase, LoadEncoded, CloseDoc, Done)
    _phase;

public:
    UnitWOPILoadEncoded()
        : WopiTestServer("UnitWOPILoadEncoded")
        , _phase(Phase::LoadEncoded)
    {
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::LoadEncoded:
            {
                TRANSITION_STATE(_phase, Phase::CloseDoc);

                initWebsocket("/wopi/files/3?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());

                break;
            }
            case Phase::CloseDoc:
            {
                TRANSITION_STATE(_phase, Phase::Done);

                WSD_CMD("closedocument");
                break;
            }
            case Phase::Done:
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
