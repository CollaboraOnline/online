/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <iostream>
#include <thread>

#include <cppunit/extensions/HelperMacros.h>

#include <Poco/DirectoryIterator.h>
#include <Poco/FileStream.h>
#include <Poco/StreamCopier.h>

#include <Common.hpp>
#include "test.hpp"
#include "helpers.hpp"

static int countLoolKitProcesses(const int expected)
{
    const auto testname = "countLoolKitProcesses ";
    TST_LOG_BEGIN("Waiting until loolkit processes are exactly " << expected << ". Loolkits: ");

    // This does not need to depend on any constant from Common.hpp.
    // The shorter the better (the quicker the test runs).
    const int sleepMs = 50;

    // This has to cause waiting for at least COMMAND_TIMEOUT_MS. Tolerate more for safety.
    const size_t repeat = ((COMMAND_TIMEOUT_MS * 8) / sleepMs);
    int count = getLoolKitProcessCount();
    for (size_t i = 0; i < repeat; ++i)
    {
        TST_LOG_APPEND(count << ' ');
        if (count == expected)
        {
            break;
        }

        // Give polls in the lool processes time to time out etc
        std::this_thread::sleep_for(std::chrono::milliseconds(sleepMs));

        const int newCount = getLoolKitProcessCount();
        if (count != newCount)
        {
            // Allow more time until the number settles.
            i = 0;
            count = newCount;
        }
    }

    TST_LOG_END;
    if (expected != count)
    {
        TST_LOG_BEGIN("Found " << count << " LoKit processes but was expecting " << expected << ": [");
        for (int i : getKitPids())
        {
            TST_LOG_APPEND(i << ' ');
        }
        TST_LOG_APPEND(']');
        TST_LOG_END;

    }

    std::vector<int> pids = getKitPids();
    std::ostringstream oss;
    oss << "Test kit pids are ";
    for (auto i : pids)
        oss << i << ' ';
    TST_LOG(oss.str());

    return count;
}

// FIXME: we probably should make this extern
// and reuse it. As it stands now, it is per
// translation unit, which isn't desirable if
// (in the non-ideal event that) it's not 1,
// it will cause testNoExtraLoolKitsLeft to
// wait unnecessarily and fail.
static int InitialLoolKitCount = 1;
static std::chrono::steady_clock::time_point TestStartTime;

static void testCountHowManyLoolkits()
{
    const char testname[] = "countHowManyLoolkits ";
    TestStartTime = std::chrono::steady_clock::now();

    InitialLoolKitCount = countLoolKitProcesses(InitialLoolKitCount);
    TST_LOG("Initial loolkit count is " << InitialLoolKitCount);
    LOK_ASSERT(InitialLoolKitCount > 0);

    TestStartTime = std::chrono::steady_clock::now();
}

static void testNoExtraLoolKitsLeft()
{
    const char testname[] = "noExtraLoolKitsLeft ";
    const int countNow = countLoolKitProcesses(InitialLoolKitCount);
    LOK_ASSERT_EQUAL(InitialLoolKitCount, countNow);

    const auto duration = (std::chrono::steady_clock::now() - TestStartTime);
    const std::chrono::milliseconds::rep durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();

    TST_LOG(" (" << durationMs << " ms)");
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
