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

#include <string>

#include <HttpRequest.hpp>
#include <Socket.hpp>

#include <Poco/Util/LayeredConfiguration.h>
#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <UserMessages.hpp>
#include <Util.hpp>
#include <helpers.hpp>

#include "UnitTimeoutBase.hpp"

static constexpr size_t ConnectionLimit = 5;
static constexpr size_t ConnectionCount = 9;

/// Base test suite class for connection limit (limited) using HTTP and WS sessions.
class UnitTimeoutConnections : public UnitTimeoutBase1
{
    void configNet(net::Defaults& defaults) override
    {
        // defaults.InactivityTimeout = std::chrono::seconds(3600);
        // defaults.WSPingTimeout = std::chrono::seconds(2);
        // defaults.WSPingPeriod = std::chrono::seconds(3);
        // defaults.HTTPTimeout = std::chrono::seconds(30);
        // defaults.MaxConnections = 9999;
        defaults.MaxConnections = ConnectionLimit;
        // defaults.SocketPollTimeout = std::chrono::seconds(64);
    }

public:
    UnitTimeoutConnections()
        : UnitTimeoutBase1("UnitTimeoutConnections")
    {
    }

    void invokeWSDTest() override;
};

void UnitTimeoutConnections::invokeWSDTest()
{
    UnitBase::TestResult result = TestResult::Ok;

    result = testHttp(ConnectionLimit, ConnectionCount);
    if (result != TestResult::Ok)
        exitTest(result);

    result = testWSPing(ConnectionLimit, ConnectionCount);
    if (result != TestResult::Ok)
        exitTest(result);

    result = testWSDChatPing(ConnectionLimit, ConnectionCount);
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitTimeoutConnections(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
