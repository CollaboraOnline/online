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

#include <atomic>
#include <condition_variable>
#include <mutex>
#include <thread>

class BackgroundSaveWatchdog
{
public:
    BackgroundSaveWatchdog(unsigned mobileAppDocId, int savingTid);
    ~BackgroundSaveWatchdog();
    void complete();

private:
    std::atomic_bool _saveCompleted; ///< Defend against spurious wakes.
    std::condition_variable _watchdogCV;
    std::mutex _watchdogMutex;
    std::thread _watchdogThread;

public:
    static std::unique_ptr<BackgroundSaveWatchdog> Instance;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
