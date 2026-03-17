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

/*
 * Unit test for disabled timeout functionality.
 */

#include <config.h>

#include <string>

#include <HttpRequest.hpp>
#include <Socket.hpp>

#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <UserMessages.hpp>
#include <common/Util.hpp>
#include <helpers.hpp>

#include <UnitTimeoutBase.hpp>

/// Base test suite class for connection limit (no limits) using HTTP and WS sessions.
class UnitTimeoutNone : public UnitTimeoutBase1
{
    const size_t _connectionLimit;
    const size_t _connectionCount;

    void configure(Poco::Util::LayeredConfiguration& /* config */) override
    {
        // Keep original values -> No timeout
    }

public:
    UnitTimeoutNone(size_t connectionLimit, size_t connectionCount)
        : UnitTimeoutBase1("UnitTimeoutNone")
        , _connectionLimit(connectionLimit)
        , _connectionCount(connectionCount)
    {
    }

    void invokeWSDTest() override;
};

void UnitTimeoutNone::invokeWSDTest()
{
    UnitBase::TestResult result;

    result = testHttp(_connectionLimit, _connectionCount);
    if (result != TestResult::Ok)
        exitTest(result);

    result = testWSPing(_connectionLimit, _connectionCount);
    if (result != TestResult::Ok)
        exitTest(result);

    result = testWSDChatPing(_connectionLimit, _connectionCount);
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitTimeoutNone(9999, 9); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
