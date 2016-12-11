/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_SENDERQUEUE_HPP
#define INCLUDED_SENDERQUEUE_HPP

#include <deque>
#include <memory>
#include <vector>

#include "common/SigUtil.hpp"
#include "Session.hpp"
#include "Log.hpp"

/// The payload type used to send/receive data.
class MessagePayload
{
public:

    enum class Type { Text, Binary };

    MessagePayload(const size_t size, enum Type type) :
        _data(size),
        _type(type)
    {
    }

    std::vector<char>& data() { return _data; }

    /// Returns true if and only if the payload is considered Binary.
    bool isBinary() const { return _type == Type::Binary; }

private:
    std::vector<char> _data;
    Type _type;
};

struct SendItem
{
    std::weak_ptr<LOOLSession> Session;
    std::shared_ptr<MessagePayload> Data;
    std::chrono::steady_clock::time_point BirthTime;
};

/// A queue of data to send to certain Sessions.
class SenderQueue
{
public:

    static SenderQueue& instance() { return TheQueue; }

    bool stopping() const { return _stop || TerminationFlag; }
    void stop()
    {
         _stop = true;
         _cv.notify_all();
    }

    size_t enqueue(const std::weak_ptr<LOOLSession>& session,
                   const std::shared_ptr<MessagePayload>& data)
    {
        SendItem item = { session, data, std::chrono::steady_clock::now() };

        std::unique_lock<std::mutex> lock(_mutex);
        _queue.push_back(item);
        const size_t size = _queue.size();
        lock.unlock();

        _cv.notify_one();
        return size;
    }

    bool waitDequeue(SendItem& item,
                     const size_t timeoutMs = std::numeric_limits<size_t>::max())
    {
        const auto timeToWait = std::chrono::milliseconds(timeoutMs);

        std::unique_lock<std::mutex> lock(_mutex);

        if (!_queue.empty() ||
            _cv.wait_for(lock, timeToWait, [this](){ return !_queue.empty() || stopping(); }))
        {
            if (!stopping())
            {
                item = _queue.front();
                _queue.pop_front();
                return true;
            }

            LOG_WRN("SenderQueue: stopping");
            return false;
        }

        return false;
    }

    size_t size() const
    {
        std::lock_guard<std::mutex> lock(_mutex);
        return _queue.size();
    }

private:
    mutable std::mutex _mutex;
    std::condition_variable _cv;
    std::deque<SendItem> _queue;
    std::atomic<bool> _stop;

    /// The only SenderQueue instance.
    static SenderQueue TheQueue;
};

/// Pool of sender threads.
/// These are dedicated threads that only dequeue from
/// the SenderQueue and send to the target Session.
/// This pool has long-running threads that grow
/// only on congention and shrink otherwise.
class SenderThreadPool
{
public:
    SenderThreadPool() :
        _optimalThreadCount(std::min(2U, std::thread::hardware_concurrency())),
        _stop(false)
    {
        LOG_INF("Creating SenderThreadPool with " << _optimalThreadCount << " optimal threads.");
        for (size_t i = 0; i < _optimalThreadCount; ++i)
        {
            _threads.push_back(createThread());
        }
    }

    ~SenderThreadPool()
    {
        // Stop us and the queue.
        stop();
        SenderQueue::instance().stop();

        for (const auto& threadData : _threads)
        {
            if (threadData && threadData->joinable())
            {
                threadData->join();
            }
        }
    }

    SenderThreadPool& instance() { return ThePool; }

    void stop() { _stop = true; }
    bool stopping() const { return _stop || TerminationFlag; }

private:

    typedef std::thread ThreadData;

    /// Dequeue a SendItem and send it.
    bool dispatchItem(const size_t timeoutMs);

    /// Create a new thread and add to the pool.
    std::shared_ptr<ThreadData> createThread();

    /// Rebalance the number of threads.
    /// Returns true if we need to reduce the threads.
    bool rebalance();

    /// The worker thread entry function.
    void threadFunction(const std::shared_ptr<ThreadData>& data);

private:
    /// A minimum of 2, but ideally as many as cores.
    const size_t _optimalThreadCount;

    /// Stop condition to take the pool down.
    std::atomic<bool> _stop;

    std::vector<std::shared_ptr<ThreadData>> _threads;
    mutable std::mutex _mutex;

    /// How often to do housekeeping when we idle.
    static constexpr size_t HousekeepIdleIntervalMs = 60000;

    /// The only pool.
    static SenderThreadPool ThePool;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
