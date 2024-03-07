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
#include <string>

#include <wsd/COOLWSD.hpp>

#include <lokassert.hpp>
#include <testlog.hpp>

std::string getPidList(std::set<pid_t> pids);

std::set<pid_t> helpers::getKitPids() { return COOLWSD::getKitPids(); }

std::set<pid_t> helpers::getSpareKitPids() { return COOLWSD::getSpareKitPids(); }

std::set<pid_t> helpers::getDocKitPids() { return COOLWSD::getDocKitPids(); }

pid_t helpers::getForKitPid()
{
    std::string testname = "getForKitPid";
    pid_t pid = COOLWSD::ForKitProcId;
    LOK_ASSERT_MESSAGE("Expected forkit process id to be >= 0", pid > 0);
    return pid;
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

void helpers::logKitProcesses(const std::string& testname)
{
    std::set<pid_t> docKitPids = getDocKitPids();
    std::set<pid_t> spareKitPids = getSpareKitPids();
    TST_LOG("Current kit processes: "
            << "Doc Kits: " << getPidList(docKitPids)
            << " Spare Kits: " << getPidList(spareKitPids));
}

void helpers::waitForKitProcessCount(
        const std::string& testname,
        int numDocKits,
        int numSpareKits /* = -1 */,
        const std::chrono::milliseconds timeoutMs /* = COMMAND_TIMEOUT_MS * 8 */,
        const std::chrono::milliseconds retryMs /* = 10ms */)
{
    TST_LOG("Waiting for kit process count: "
            << (numDocKits >= 0 ? "Doc Kits: " + std::to_string(numDocKits) + " " : "")
            << (numSpareKits >= 0 ? " Spare Kits: " + std::to_string(numSpareKits) + " " : ""));

    std::set<pid_t> docKitPids = getDocKitPids();
    std::set<pid_t> spareKitPids = getSpareKitPids();
    bool pass = (numDocKits < 0 || docKitPids.size() == static_cast<size_t>(numDocKits)) &&
        (numSpareKits < 0 || spareKitPids.size() == static_cast<size_t>(numSpareKits));
    int tries = (timeoutMs / retryMs);

    TST_LOG("Current kit processes: "
            << "Doc Kits: " << getPidList(docKitPids)
            << " Spare Kits: " << getPidList(spareKitPids));

    while (tries >= 0 && !pass)
    {
        std::this_thread::sleep_for(retryMs);

        docKitPids = getDocKitPids();
        spareKitPids = getSpareKitPids();
        pass = (numDocKits < 0 || docKitPids.size() == static_cast<size_t>(numDocKits)) &&
            (numSpareKits < 0 || spareKitPids.size() == static_cast<size_t>(numSpareKits));
        tries--;

        TST_LOG("Current kit processes: "
                << "Doc Kits: " << getPidList(docKitPids)
                << " Spare Kits: " << getPidList(spareKitPids));
    }

    if (pass)
    {
        TST_LOG("Finished waiting for kit process count: "
                << (numDocKits >= 0 ? "Doc Kits: " + std::to_string(numDocKits) + " " : "")
                << (numSpareKits >= 0 ? " Spare Kits: " + std::to_string(numSpareKits) + " " : ""));
    }
    else
    {
        std::ostringstream oss;
        oss << (numDocKits >= 0 ? "Doc Kits: " + std::to_string(numDocKits) + " " : "")
            << (numSpareKits >= 0 ? " Spare Kits: " + std::to_string(numSpareKits) + " " : "")
            << "Current kit processes: "
            << "Doc Kits: " << getPidList(docKitPids)
            << " Spare Kits: " << getPidList(spareKitPids);
        LOK_ASSERT_FAIL("Timed out waiting for kit process count: " + oss.str());
    }
}

void helpers::waitForKitPidsReady(
        const std::string& testname,
        const std::chrono::milliseconds timeoutMs /* = KIT_PID_TIMEOUT_MS */,
        const std::chrono::milliseconds retryMs /* = KIT_PID_RETRY_MS */)
{
    waitForKitProcessCount(testname, 0, 1, timeoutMs, retryMs);
}

void helpers::waitForKitPidsKilled(
        const std::string& testname,
        const std::chrono::milliseconds timeoutMs /* = KIT_PID_TIMEOUT_MS */,
        const std::chrono::milliseconds retryMs /* = KIT_PID_RETRY_MS */)
{
    waitForKitProcessCount(testname, 0, 0, timeoutMs, retryMs);
}
