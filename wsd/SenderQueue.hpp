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
            _queue.push_back(item);
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
    mutable std::mutex _mutex;
    std::condition_variable _cv;
    std::deque<Item> _queue;
    std::atomic<bool> _stop;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
