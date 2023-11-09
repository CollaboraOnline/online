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

#include "Unit.hpp"
#include "WopiTestServer.hpp"

using namespace helpers;

class UnitStorage : public WopiTestServer
{
    STATE_ENUM(Phase,
               Load, // load the document
               Filter, // throw filter exception
               Reload, // re-load the document
               Done)
    _phase;

public:
    UnitStorage()
        : WopiTestServer("UnitStorage")
        , _phase(Phase::Load)
    {
    }

    bool filterCheckDiskSpace(const std::string& /* path */, bool& newResult) override
    {
        // Fail the disk-space check in Filter phase.
        newResult = _phase != Phase::Filter;
        LOG_TST("Result: " << (newResult ? "success" : "out-of-disk-space"));
        return true;
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("Loaded: [" << message << ']');

        LOK_ASSERT_STATE(_phase, Phase::Done);
        passTest("Loaded successfully");

        return true;
    }

    bool onDocumentError(const std::string& message) override
    {
        // This may trigger multiple times.
        LOK_ASSERT_EQUAL_MESSAGE("Expect only documentunloading errors",
                                 std::string("error: cmd=internal kind=diskfull"), message);

        LOK_ASSERT_STATE(_phase, Phase::Filter);

        return true;
    }

    // When we fail to load, we must destroy the DocBroker.
    void onDocBrokerDestroy(const std::string&) override
    {
        if (_phase == Phase::Filter)
        {
            TRANSITION_STATE(_phase, Phase::Reload);
        }
    }

    void invokeWSDTest() override
    {
        LOG_TRC("invokeWSDTest: " << toString(_phase));
        switch (_phase)
        {
            case Phase::Load:
                TRANSITION_STATE(_phase, Phase::Filter);
                initWebsocket("/wopi/files/0?access_token=anything");
                WSD_CMD("load url=" + getWopiSrc());
                break;
            case Phase::Filter:
                break;
            case Phase::Reload:
                LOG_TST("Reloading the document");
                TRANSITION_STATE(_phase, Phase::Done);
                initWebsocket("/wopi/files/0?access_token=anything");
                WSD_CMD("load url=" + getWopiSrc());
                break;
            case Phase::Done:
                break;
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitStorage(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
