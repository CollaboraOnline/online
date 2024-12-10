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

#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <UserMessages.hpp>
#include <Util.hpp>
#include <helpers.hpp>

#include "UnitTimeoutBase.hpp"

static constexpr size_t ConnectionLimit = 9999;
static constexpr size_t ConnectionCount = 9;

/// Base test suite class for connection limit (no limits) using HTTP and WS sessions.
class UnitTimeoutNone : public UnitTimeoutBase1
{
    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        // Keep original values -> No timeout

        // Disable `net::Defaults.maxExtConnections` instrument, i.e. setting it to zero (skipping system default)
        config.setInt64("net.max_ext_connections", -1);
    }

public:
    UnitTimeoutNone()
        : UnitTimeoutBase1("UnitTimeoutNone")
    {
    }

    void invokeWSDTest() override;
};

void UnitTimeoutNone::invokeWSDTest()
{
    UnitBase::TestResult result;

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

UnitBase* unit_create_wsd(void) { return new UnitTimeoutNone(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
