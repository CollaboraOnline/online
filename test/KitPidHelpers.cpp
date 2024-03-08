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
#include "KitPidHelpers.hpp"

#include <set>
#include <chrono>
#include <iostream>
#include <thread>

#include <wsd/COOLWSD.hpp>
#include <Common.hpp>
#include <Util.hpp>

#include <lokassert.hpp>
#include <test.hpp>
#include <testlog.hpp>

std::string getPidList(std::set<pid_t> pids);

std::set<pid_t> helpers::getKitPids() { return COOLWSD::getKitPids(); }

std::set<pid_t> helpers::getSpareKitPids() { return COOLWSD::getSpareKitPids(); }

std::set<pid_t> helpers::getDocKitPids() { return COOLWSD::getDocKitPids(); }

/// Get the PID of the forkit
std::set<pid_t> helpers::getForKitPids()
{
    std::set<pid_t> pids;
    if (COOLWSD::ForKitProcId >= 0)
        pids.emplace(COOLWSD::ForKitProcId);
    return pids;
}

/// How many live coolkit processes do we have ?
int helpers::getCoolKitProcessCount()
{
    return getKitPids().size();
}

int helpers::countCoolKitProcesses(const int expected)
{
    std::chrono::milliseconds timeoutMs = std::chrono::milliseconds(COMMAND_TIMEOUT_MS) * 8;
    const auto testname = "countCoolKitProcesses ";
    TST_LOG_BEGIN("Waiting until coolkit processes are exactly " << expected << ". Coolkits: ");

    Util::Stopwatch stopwatch;

    // This does not need to depend on any constant from Common.hpp.
    // The shorter the better (the quicker the test runs).
    constexpr int sleepMs = 10;

    // This has to cause waiting for at least COMMAND_TIMEOUT_MS. Tolerate more for safety.
    const std::size_t repeat = (timeoutMs.count() / sleepMs);
    int count = getCoolKitProcessCount();
    for (std::size_t i = 0; i < repeat; ++i)
    {
        TST_LOG_APPEND(count << ' ');
        if (count == expected)
        {
            break;
        }

        // Give polls in the cool processes time to time out etc
        std::this_thread::sleep_for(std::chrono::milliseconds(sleepMs));

        const int newCount = getCoolKitProcessCount();
        if (count != newCount)
        {
            // Allow more time until the number settles.
            i = 0;
            count = newCount;
        }
    }

    TST_LOG_END;
    LOK_ASSERT(expected == count);
    if (expected != count)
    {
        TST_LOG_BEGIN("Found " << count << " LoKit processes but was expecting " << expected << ": [");
        for (pid_t i : getKitPids())
        {
            TST_LOG_APPEND(i << ' ');
        }
        TST_LOG_APPEND(']');
        TST_LOG_END;

    }

    std::set<pid_t> pids = getKitPids();
    std::ostringstream oss;
    oss << "Test kit pids are [";
    for (pid_t i : pids)
        oss << i << ' ';
    oss << "] after waiting for " << stopwatch.elapsed();
    TST_LOG(oss.str());

    return count;
}

void helpers::testCountHowManyCoolkits()
{
    const char testname[] = "countHowManyCoolkits ";
    resetTestStartTime();

    countCoolKitProcesses(InitialCoolKitCount);
    TST_LOG("Initial coolkit count is " << InitialCoolKitCount);
    LOK_ASSERT(InitialCoolKitCount > 0);

    resetTestStartTime();
}

void helpers::testNoExtraCoolKitsLeft()
{
    const char testname[] = "noExtraCoolKitsLeft ";
    const int countNow = countCoolKitProcesses(InitialCoolKitCount);
    LOK_ASSERT_EQUAL(InitialCoolKitCount, countNow);

    const auto durationMs = timeSinceTestStartMs();

    TST_LOG(" (" << durationMs << ')');
}

void helpers::waitForKitProcessToStop(
        const pid_t pid,
        const std::string& testname,
        const std::chrono::milliseconds timeoutMs /* = COMMAND_TIMEOUT_MS * 8 */,
        const std::chrono::milliseconds retryMs /* = 10ms */)
{
    TST_LOG("Waiting for kit process " << pid << " to stop.");

    std::set<pid_t> pids = getDocKitPids();
    TST_LOG("Active kit pids are: " << getPidList(pids));

    int tries = (timeoutMs / retryMs);
    while(pids.contains(pid) && tries >= 0)
    {
        std::this_thread::sleep_for(retryMs);
        pids = getDocKitPids();
        tries--;
    }

    if (pids.contains(pid))
    {
        std::ostringstream oss;
        oss << "Timed out waiting for kit process " << pid << " to stop. Active kit pids are: " << getPidList(pids);
        LOK_ASSERT_FAIL(oss.str());
    }
    else
    {
        TST_LOG("Finished waiting for kit process " << pid << " to stop.");
        TST_LOG("Active kit pids are: " << getPidList(pids));
    }
}

std::string getPidList(std::set<pid_t> pids)
{
    std::ostringstream oss;
    oss << "[";
    for (pid_t i : pids)
    {
        oss << i << ", ";
    }
    oss << "]";
    return oss.str();
}
