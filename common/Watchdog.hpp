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

#include <thread>
#include <chrono>
#include <mutex>
#include <condition_variable>

extern "C"
{
    void watchdog_probe();
}

/*
 * A class to watch to see when threads are not making progress.
 */
class Watchdog : private std::thread
{
    std::atomic<bool> _exit;
    std::unique_ptr<std::thread> _thread;
    std::mutex _lock;
    std::condition_variable _condition;
    std::vector<std::atomic<uint64_t>*> _times;

    static const uint64_t MsToTrigger = 100;

public:
    Watchdog()
    {
        startThread();
    }

    ~Watchdog()
    {
        joinThread();
    }

    static uint64_t getDisableStamp() { return 0; }

    static uint64_t getTimestamp()
    {
        return std::chrono::duration_cast<std::chrono::milliseconds>(
                   std::chrono::steady_clock::now().time_since_epoch())
            .count();
    }

    void startThread()
    {
        assert(!_thread);
        _exit = false;
        _thread.reset(new std::thread(&Watchdog::checkTime, this));
    }

    void joinThread()
    {
        if (_thread)
        {
            _exit = true;
            _condition.notify_all();
            _thread->join();
            _thread.reset();
        }
    }

    void checkTime()
    {
        std::unique_lock<std::mutex> guard(_lock);
        while (!_exit)
        {
            {
                uint64_t msSinceEpoc = getTimestamp();
                for (auto i : _times)
                {
                    uint64_t snapshot = *i; // one atomic read
                    if (snapshot == 0) // sleeping / polling
                        continue;
                    // out of the poll for longer than threshold:
                    if (msSinceEpoc - snapshot > MsToTrigger)
                    {
                        watchdog_probe();
                        break;
                    }
                }
            }
            _condition.wait_for(guard, std::chrono::milliseconds(20));
        }
    }

    void addTime(std::atomic<uint64_t> *timeRef)
    {
        std::lock_guard<std::mutex> guard(_lock);
        _times.push_back(timeRef);
    }

    void removeTime(std::atomic<uint64_t> *timeRef)
    {
        std::lock_guard<std::mutex> guard(_lock);
        auto it = std::find(_times.begin(), _times.end(), timeRef);
        if (it != _times.end())
            _times.erase(it);
        else
            assert("missing time to remove" && false);
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
