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

#pragma once

#include <config.h>

#include <chrono>
#include <set>

#include <Common.hpp>

namespace helpers
{

constexpr int KIT_PID_TIMEOUT_MS = 20000 * TRACE_MULTIPLIER;
constexpr int KIT_PID_RETRY_MS = 50;

/*
 * Get the list of all kit pids
 */
std::set<pid_t> getKitPids();

/*
 * Get the list of spare (unused) kit pids
 */
std::set<pid_t> getSpareKitPids();

/*
 * Get the list of doc (loaded) kit pids
 */
std::set<pid_t> getDocKitPids();

/*
 * Get the pid of the coolforkit process
 */
pid_t getForKitPid();

/*
 * Log the current doc and spare kit pids
 * Useful for debugging
 */
void logKitProcesses(const std::string& testname);

/*
 * Wait until the number of kit processes matches the desired count.
 * Set numDocKits and numSpareKits to -1 to skip counting those processes
 */
void waitForKitProcessCount(const std::string& testname, int numDocKits, int numSpareKits,
        const std::chrono::milliseconds timeoutMs,
        const std::chrono::milliseconds retryMs);

/*
 * Wait until ready with 0 doc kits and 1 spare kit
 * Used to wait for spare kit to start up before use
 * or to wait for doc kits to shut down after
 */
void waitForKitPidsReady(
        const std::string& testname,
        const std::chrono::milliseconds timeoutMs = std::chrono::milliseconds(KIT_PID_TIMEOUT_MS),
        const std::chrono::milliseconds retryMs = std::chrono::milliseconds(KIT_PID_RETRY_MS));

/*
 * Wait until all doc and spare kits are closed
 */
void waitForKitPidsKilled(
        const std::string& testname,
        const std::chrono::milliseconds timeoutMs = std::chrono::milliseconds(KIT_PID_TIMEOUT_MS),
        const std::chrono::milliseconds retryMs = std::chrono::milliseconds(KIT_PID_RETRY_MS));

} // namespace helpers
