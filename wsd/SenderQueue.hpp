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

#include <condition_variable>
#include <deque>
#include <memory>
#include <mutex>
#include <vector>

#include "common/SigUtil.hpp"
#include "LOOLWebSocket.hpp"
#include "Log.hpp"
#include "TileDesc.hpp"

/// The payload type used to send/receive data.
class MessagePayload
{
public:

    enum class Type { Text, Binary };

    /// Construct a text message.
    /// message must include the full first-line.
    MessagePayload(const std::string& message) :
        _data(message.data(), message.data() + message.size()),
        _tokens(LOOLProtocol::tokenize(_data.data(), _data.size())),
        _firstLine(LOOLProtocol::getFirstLine(_data.data(), _data.size())),
        _abbreviation(LOOLProtocol::getAbbreviatedMessage(_data.data(), _data.size())),
        _type(Type::Text)
    {
    }

    /// Construct a message from a string with type and
    /// reserve extra space (total, including message).
    /// message must include the full first-line.
    MessagePayload(const std::string& message,
                   const enum Type type,
                   const size_t reserve = 0) :
        _data(reserve),
        _tokens(LOOLProtocol::tokenize(_data.data(), _data.size())),
        _firstLine(LOOLProtocol::getFirstLine(_data.data(), _data.size())),
        _abbreviation(LOOLProtocol::getAbbreviatedMessage(_data.data(), _data.size())),
        _type(type)
    {
        _data.resize(message.size());
        std::memcpy(_data.data(), message.data(), message.size());
    }

    /// Construct a message from a character array with type.
    /// data must be include the full first-line.
    MessagePayload(const char* data,
                   const size_t size,
                   const enum Type type) :
        _data(data, data + size),
        _tokens(LOOLProtocol::tokenize(_data.data(), _data.size())),
        _firstLine(LOOLProtocol::getFirstLine(_data.data(), _data.size())),
        _abbreviation(LOOLProtocol::getAbbreviatedMessage(_data.data(), _data.size())),
        _type(type)
    {
    }

    size_t size() const { return _data.size(); }
    const std::vector<char>& data() const { return _data; }

    const std::vector<std::string>& tokens() const { return _tokens; }
    const std::string& firstToken() const { return _tokens[0]; }
    const std::string& firstLine() const { return _firstLine; }
    const std::string& abbreviation() const { return _abbreviation; }

    /// Append more data to the message.
    void append(const char* data, const size_t size)
    {
        const auto curSize = _data.size();
        _data.resize(curSize + size);
        std::memcpy(_data.data() + curSize, data, size);
    }

    /// Returns true if and only if the payload is considered Binary.
    bool isBinary() const { return _type == Type::Binary; }

private:
    std::vector<char> _data;
    const std::vector<std::string> _tokens;
    const std::string _firstLine;
    const std::string _abbreviation;
    const Type _type;
};

struct SendItem
{
    std::weak_ptr<LOOLWebSocket> Socket;
    std::shared_ptr<MessagePayload> Data;
    std::string Meta;
    std::chrono::steady_clock::time_point BirthTime;
};

/// A queue of data to send to certain Session's WS.
template <typename Item>
class SenderQueue final
{
public:

    SenderQueue() :
        _stop(false)
    {
    }

    bool stopping() const { return _stop || TerminationFlag; }
    void stop()
    {
        _stop = true;
        _cv.notify_all();
    }

    size_t enqueue(const Item& item)
    {
        std::unique_lock<std::mutex> lock(_mutex);
        if (!stopping())
        {
            if (deduplicate(item))
            {
                _queue.push_back(item);
            }
        }

        const size_t queuesize = _queue.size();
        lock.unlock();

        _cv.notify_one();
        return queuesize;
    }

    bool waitDequeue(Item& item,
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

            LOG_DBG("SenderQueue: stopping");
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
    /// Deduplicate messages based on the new one.
    /// Returns true if the new message should be
    /// enqueued, otherwise false.
    bool deduplicate(const Item& item)
    {
        const std::string command = item->firstToken();
        if (command == "tile:")
        {
            TileDesc newTile = TileDesc::parse(item->firstLine());
            auto begin = std::remove_if(_queue.begin(), _queue.end(),
            [&newTile](const queue_item_t& cur)
            {
                const std::string curCommand = cur->firstToken();
                if (curCommand == "tile:")
                {
                    return (newTile == TileDesc::parse(cur->firstLine()));
                }

                return false;
            });

            _queue.erase(begin, _queue.end());
        }

        return true;
    }

private:
    mutable std::mutex _mutex;
    std::condition_variable _cv;
    std::deque<Item> _queue;
    typedef typename std::deque<Item>::value_type queue_item_t;
    std::atomic<bool> _stop;
};

/// Pool of sender threads.
/// These are dedicated threads that only dequeue from
/// the SenderQueue and send to the target Session's WS.
/// This pool has long-running threads that grow
/// only on congention and shrink otherwise.
class SenderThreadPool final
{
public:
    SenderThreadPool() :
        _optimalThreadCount(std::min(2U, std::thread::hardware_concurrency())),
        _maxThreadCount(_optimalThreadCount),
        _idleThreadCount(0),
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
        //SenderQueue::instance().stop();

        for (const auto& threadData : _threads)
        {
            if (threadData && threadData->joinable())
            {
                threadData->join();
            }
        }
    }

    void stop() { _stop = true; }
    bool stopping() const { return _stop || TerminationFlag; }

    void incMaxThreadCount() { ++_maxThreadCount; }
    void decMaxThreadCount() { --_maxThreadCount; }

private:

    /// Count idle threads safely.
    /// Decrements count on ctor, and increments on dtor.
    class IdleCountGuard final
    {
    public:
        IdleCountGuard(std::atomic<size_t>& var) :
            _var(var)
        {
            --_var;
        }

        ~IdleCountGuard()
        {
            ++_var;
        }

    private:
        std::atomic<size_t>& _var;
    };

    typedef std::thread ThreadData;

    /// Dequeue a SendItem and send it.
    bool dispatchItem(const size_t timeoutMs);

    /// Create a new thread and add to the pool.
    std::shared_ptr<ThreadData> createThread();

    /// Rebalance the number of threads.
    /// Returns true if we need to reduce the threads.
    bool rebalance();

    /// Grow the pool if congestion is detected.
    void checkAndGrow();

    /// The worker thread entry function.
    void threadFunction(const std::shared_ptr<ThreadData>& data);

private:
    /// A minimum of 2, but ideally as many as cores.
    const size_t _optimalThreadCount;

    /// Never exceed this number of threads.
    size_t _maxThreadCount;

    /// The number of threads not sending data.
    std::atomic<size_t> _idleThreadCount;

    /// Stop condition to take the pool down.
    std::atomic<bool> _stop;

    std::vector<std::shared_ptr<ThreadData>> _threads;
    mutable std::mutex _mutex;

    /// How often to do housekeeping when we idle.
    static constexpr size_t HousekeepIdleIntervalMs = 60000;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
