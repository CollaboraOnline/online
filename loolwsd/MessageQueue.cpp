/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "MessageQueue.hpp"

#include <algorithm>

#include <Log.hpp>

MessageQueue::~MessageQueue()
{
    clear();
}

void MessageQueue::put(const Payload& value)
{
    std::unique_lock<std::mutex> lock(_mutex);
    put_impl(value);
    lock.unlock();
    _cv.notify_one();
}

MessageQueue::Payload MessageQueue::get()
{
    std::unique_lock<std::mutex> lock(_mutex);
    _cv.wait(lock, [this] { return wait_impl(); });
    return get_impl();
}

void MessageQueue::clear()
{
    std::unique_lock<std::mutex> lock(_mutex);
    clear_impl();
}

void MessageQueue::remove_if(const std::function<bool(const Payload&)>& pred)
{
    std::unique_lock<std::mutex> lock(_mutex);
    std::remove_if(_queue.begin(), _queue.end(), pred);
}

void MessageQueue::put_impl(const Payload& value)
{
    _queue.push_back(value);
}

bool MessageQueue::wait_impl() const
{
    return _queue.size() > 0;
}

MessageQueue::Payload MessageQueue::get_impl()
{
    auto result = _queue.front();
    _queue.pop_front();
    return result;
}

void MessageQueue::clear_impl()
{
    _queue.clear();
}

void BasicTileQueue::put_impl(const Payload& value)
{
    const auto msg = std::string(&value[0], value.size());
    if (msg == "canceltiles")
    {
        // remove all the existing tiles from the queue
        _queue.erase(std::remove_if(_queue.begin(), _queue.end(),
                    [](const Payload& v)
                    {
                        // must not remove the tiles with 'id=', they are special, used
                        // eg. for previews etc.
                        const auto tmp = std::string(&v[0], v.size());
                        return (tmp.compare(0, 5, "tile ") == 0) && (tmp.find("id=") == std::string::npos);
                    }
                    ),
                _queue.end());

        // put the "canceltiles" in front of other messages
        _queue.push_front(value);
    }
    else
    {
        MessageQueue::put_impl(value);
    }
}

void TileQueue::put_impl(const Payload& value)
{
    if (!_queue.empty())
    {
        const auto msg = std::string(value.data(), value.size());
        if (msg.compare(0, 4, "tile") == 0 || msg.compare(0, 10, "tilecombine") == 0)
        {
            const auto newMsg = msg.substr(0, msg.find(" ver"));

            // TODO: implement a real re-ordering here, so that the tiles closest to
            // the cursor are returned first.
            // * we will want to put just a general "tile" message to the queue
            // * add a std::set that handles the tiles
            // * change the get_impl() to decide which tile is the correct one to
            //   be returned
            // * we will also need to be informed about the position of the cursor
            //   so that get_impl() returns optimal results
            //
            // For now: just don't put duplicates into the queue
            for (size_t i = 0; i < _queue.size(); ++i)
            {
                auto& it = _queue[i];
                const std::string old(it.data(), it.size());
                const auto oldMsg = old.substr(0, old.find(" ver"));
                Log::error(std::to_string(i) + ": " + oldMsg);
                if (newMsg == oldMsg)
                {
                    Log::trace("Replacing duplicate tile: " + oldMsg + " -> " + newMsg);
                    _queue[i] = value;
                    return;
                }
            }
        }
    }

    BasicTileQueue::put_impl(value);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
