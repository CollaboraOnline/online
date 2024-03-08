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

const int InitialCoolKitCount = 1;
void testCountHowManyCoolkits();
void testNoExtraCoolKitsLeft();

int countCoolKitProcesses(const int expected);/*,
                                 std::chrono::milliseconds timeoutMs
                                 = std::chrono::milliseconds(COMMAND_TIMEOUT_MS * 8));
                                 */

/// Get the list of all kit PIDs
std::set<pid_t> getKitPids();
/// Get the list of spare (unused) kit PIDs
std::set<pid_t> getSpareKitPids();
/// Get the list of doc (loaded) kit PIDs
std::set<pid_t> getDocKitPids();

/// Get the PID of the forkit
std::set<pid_t> getForKitPids();

/// How many live coolkit processes do we have ?
int getCoolKitProcessCount();

void waitForKitProcessToStop(
        const pid_t pid,
        const std::string& testname,
        const std::chrono::milliseconds timeoutMs = std::chrono::milliseconds(COMMAND_TIMEOUT_MS * 8),
        const std::chrono::milliseconds retryMs = std::chrono::milliseconds(10));

}
