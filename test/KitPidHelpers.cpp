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
#include <algorithm>
#include <thread>
#include <string>

#include <wsd/COOLWSD.hpp>

#include <lokassert.hpp>
#include <testlog.hpp>

std::string getPidList(const std::set<pid_t>& pids);

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

std::string getPidList(const std::set<pid_t>& pids)
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

void helpers::waitForKitPidsReady(
        const std::string& testname,
        const std::chrono::milliseconds timeoutMs /* = KIT_PID_TIMEOUT_MS */,
        const std::chrono::milliseconds retryMs /* = KIT_PID_RETRY_MS */)
{
    // It is generally not a great idea to look for exactly <N> processes
    const int targetDocKits = 0;
    const int targetSpareKits = 1;

    TST_LOG("Waiting for kit processes to close, with one spare kit");

    std::set<pid_t> docKitPids;
    std::set<pid_t> spareKitPids;

    bool pass = false;
    int tries = timeoutMs / retryMs;

    while (tries >= 0 && !pass)
    {
        docKitPids = helpers::getDocKitPids();
        spareKitPids = helpers::getSpareKitPids();
        pass = (docKitPids.size() == static_cast<size_t>(targetDocKits) &&
                spareKitPids.size() == static_cast<size_t>(targetSpareKits));
        tries--;

        TST_LOG("Current kit processes: "
                << "Doc Kits: " << getPidList(docKitPids)
                << " Spare Kits: " << getPidList(spareKitPids));

        if (!pass)
            std::this_thread::sleep_for(retryMs);
    }

    if (pass)
    {
        TST_LOG("Finished waiting for kit processes to close");
    }
    else
    {
        std::ostringstream oss;
        oss << "Current kit processes:"
            << " Doc Kits: " << getPidList(docKitPids)
            << " Spare Kits: " << getPidList(spareKitPids);
        LOK_ASSERT_FAIL("Timed out waiting for kit processes to close: " + oss.str());
    }
}

void helpers::killPid(const std::string& testname, const pid_t pid)
{
    TST_LOG("Killing " << pid);
    if (kill(pid, SIGKILL) == -1)
        TST_LOG("kill(" << pid << ", SIGKILL) failed: " <<
                Util::symbolicErrno(errno) << ": " << std::strerror(errno));
}

void helpers::killAllKitProcesses(
    const std::string& testname,
    const std::chrono::milliseconds timeoutMs /* = COMMAND_TIMEOUT_MS * 8 */,
    const std::chrono::milliseconds retryMs /* = 10ms */)
{
    auto before = getKitPids();
    for (pid_t pid : before)
        killPid(testname, pid);

    TST_LOG("Waiting for these kit processes to close: " << getPidList(before));

    bool pass = false;
    int tries = (timeoutMs / retryMs);

    std::set<pid_t> inters;
    while (tries >= 0 && !pass)
    {
        std::this_thread::sleep_for(retryMs);

        auto current = getKitPids();

        inters.clear();
        std::set_intersection(
            current.begin(), current.end(), before.begin(), before.end(),
            std::inserter(inters, inters.begin()));

        pass = inters.empty();
        tries--;

        TST_LOG("Current kit processes: " << getPidList(current));
    }

    TST_LOG("Finished waiting for all previous kit processes to close"
            << " before: " << getPidList(before)
            << " current: " << getPidList(getKitPids())
            << " intersection: " << getPidList(inters));

    LOK_ASSERT_MESSAGE_SILENT("Timed out waiting for these kit processes to close", pass);
}
