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

#include "Util.hpp"

namespace Util
{
bool isMobileApp() { return true; }

/// No-op implementation of desktop only functions
DirectoryCounter::DirectoryCounter(const char* procPath) {}
DirectoryCounter::~DirectoryCounter() {}
int DirectoryCounter::count() { return 0; }
int spawnProcess(const std::string& cmd, const StringVector& args) { return 0; }

std::string getHumanizedBytes(unsigned long nBytes) { return std::string(); }
size_t getTotalSystemMemoryKb() { return 0; }
std::size_t getFromFile(const char* path) { return 0; }
std::size_t getCGroupMemLimit() { return 0; }
std::size_t getCGroupMemSoftLimit() { return 0; }
size_t getMemoryUsagePSS(const pid_t pid) { return 0; }
size_t getMemoryUsageRSS(const pid_t pid) { return 0; }
size_t getCurrentThreadCount() { return 0; }
std::string getMemoryStats(FILE* file) { return std::string(); }
std::pair<size_t, size_t> getPssAndDirtyFromSMaps(FILE* file) { return std::make_pair(0, 0); }
size_t getCpuUsage(const pid_t pid) { return 0; }
size_t getStatFromPid(const pid_t pid, int ind) { return 0; }
void setProcessAndThreadPriorities(const pid_t pid, int prio) {}

std::string getLinuxVersion() { return "unknown"; }

void alertAllUsers(const std::string&) {}
void alertAllUsers(const std::string&, const std::string&) {}
}
