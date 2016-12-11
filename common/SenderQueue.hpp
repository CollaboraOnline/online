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

#include <functional>

#include <Poco/NotificationQueue.h>
#include <Poco/Runnable.h>
#include <Poco/ThreadPool.h>

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

    Type getType() const { return _type; }
    void setType(const Type type) { _type = type; }

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

        LOG_TRC("SenderQueue size: " << _queue.size());
        if (!_queue.empty() ||
            _cv.wait_for(lock, timeToWait, [this](){ return !_queue.empty(); }))
        {
            item = _queue.front();
            _queue.pop_front();
            return true;
        }

        LOG_WRN("SenderQueue: timeout");
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

    /// The only SenderQueue instance.
    static SenderQueue TheQueue;
};

/// Dequeue a SendItem and send it.
bool DispatchSendItem(const size_t timeoutMs = std::numeric_limits<size_t>::max());

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
