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

#include <Common.hpp>
#include <FileUtil.hpp>
#include <Protocol.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <helpers.hpp>
#include <net/HttpRequest.hpp>
#include <net/Socket.hpp>
#include <wsd/ProxyPoll.hpp>

using namespace std::literals;

/// Test the internal ProxyPoll functionality.
class UnitInternalProxy : public UnitWSD
{
    bool _tested;

public:
    UnitInternalProxy()
        : UnitWSD("UnitInternalProxy")
        , _tested(false)
    {
        setTimeout(10s);
    }

    void invokeWSDTest() override
    {
        if (_tested)
            return;
        _tested = true;

        TST_LOG("Testing ProxyPoll singleton...");

        ProxyPoll& poll = ProxyPoll::instance();
        TST_LOG("ProxyPoll instance obtained: " << poll.name());

        // ProxyPoll thread is alive
        LOK_ASSERT_MESSAGE("ProxyPoll should be alive", poll.isAlive());
        TST_LOG("ProxyPoll is alive: " << poll.isAlive());

        // ProxyPoll name is correct
        LOK_ASSERT_EQUAL(std::string("proxy-poll"), poll.name());
        TST_LOG("ProxyPoll name verified: " << poll.name());

        TST_LOG("All ProxyPoll tests passed!");
        exitTest(TestResult::Ok);
    }
};

UnitBase* unit_create_wsd(void) { return new UnitInternalProxy(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
