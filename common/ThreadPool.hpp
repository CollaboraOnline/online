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

#include <cassert>
#include <memory>
#include <queue>
#include <thread>
#include <condition_variable>
#include <fstream>
#include <unordered_map>
#include <vector>

class ThreadPool
{
    std::mutex _mutex;
    std::condition_variable _cond;
    std::condition_variable _complete;
    typedef std::function<void()> ThreadFn;
    std::queue<ThreadFn> _work;
    std::vector<std::thread> _threads;
    size_t _working;
    bool _shutdown;
    std::atomic<bool> _running;

public:
    ThreadPool()
        : _working(0)
        , _shutdown(false)
        , _running(false)
    {
        int maxConcurrency = 2;
#if WASMAPP
        // Leave it at that.
#elif MOBILEAPP && !defined(GTKAPP)
        maxConcurrency = std::max<int>(std::thread::hardware_concurrency(), 2);
#else
        // coverity[tainted_return_value] - we trust the contents of this variable
        const char* max = getenv("MAX_CONCURRENCY");
        if (max)
            maxConcurrency = atoi(max);
#endif
        LOG_TRC("PNG compression thread pool size " << maxConcurrency);
        for (int i = 1; i < maxConcurrency; ++i)
            _threads.push_back(std::thread(&ThreadPool::work, this));
    }

    ~ThreadPool() { stop(); }

    void stop()
    {
        {
            std::unique_lock<std::mutex> lock(_mutex);
            assert(_working == 0);
            _shutdown = true;
        }
        _cond.notify_all();
        for (auto& it : _threads)
            it.join();
    }

    size_t count() const { return _work.size(); }

    void pushWork(const ThreadFn& fn)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        assert(!_running);
        assert(_working == 0);
        _work.push(fn);
    }

    void runOne(std::unique_lock<std::mutex>& lock)
    {
        assert(_running);
        assert(!_work.empty());

        ThreadFn fn = _work.front();
        _work.pop();
        _working++;
        lock.unlock();

        try
        {
            fn();
        }
        catch (...)
        {
            LOG_ERR("Exception in thread pool execution.");
        }

        lock.lock();
        _working--;
        if (_work.empty() && _working == 0)
            _complete.notify_all();
    }

    void run()
    {
        std::unique_lock<std::mutex> lock(_mutex);
        assert(!_running);
        assert(_working == 0);

        _running = true;

        // Avoid notifying threads if we don't need to.
        bool useThreads = _threads.size() > 1 && _work.size() > 1;
        if (useThreads)
            _cond.notify_all();

        while (!_work.empty())
            runOne(lock);

        if (useThreads && (_working > 0 || !_work.empty()))
            _complete.wait(lock, [this]() { return _working == 0 && _work.empty(); });

        _running = false;

        assert(_working == 0);
        assert(_work.empty());
    }

    void work()
    {
        std::unique_lock<std::mutex> lock(_mutex);
        while (!_shutdown)
        {
            _cond.wait(lock);
            while (!_shutdown && !_work.empty() && _running)
                runOne(lock);
        }
    }

    void dumpState(std::ostream& oss)
    {
        oss << "\tthreadPool:"
            << "\n\t\tshutdown: " << _shutdown << "\n\t\tworking: " << _working
            << "\n\t\twork count: " << count() << "\n\t\tthread count " << _threads.size() << "\n";
    }
};
