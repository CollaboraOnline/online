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

#include <Poco/StringTokenizer.h>

#include <TileDesc.hpp>
#include <Log.hpp>

using Poco::StringTokenizer;

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
    const auto msg = std::string(value.data(), value.size());
    Log::trace() << "Pushing into MQ [" << msg << "]" << Log::end;
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

void TileQueue::put_impl(const Payload& value)
{
    const auto msg = std::string(value.data(), value.size());
    Log::trace() << "Putting [" << msg << "]" << Log::end;

    if (msg.compare(0, 11, "canceltiles") == 0)
    {
        Log::trace("Processing " + msg);
        Log::trace() << "Before canceltiles have " << _queue.size() << " in queue." << Log::end;
        const auto seqs = msg.substr(12);
        StringTokenizer tokens(seqs, ",", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        _queue.erase(std::remove_if(_queue.begin(), _queue.end(),
                [&tokens](const Payload& v)
                {
                    const std::string s(v.data(), v.size());
                    for (size_t i = 0; i < tokens.count(); ++i)
                    {
                        if (s.find("ver=" + tokens[i]) != std::string::npos)
                        {
                            Log::trace("Matched " + tokens[i] + ", Removing [" + s + "]");
                            return true;
                        }
                    }

                    return false;

                }), _queue.end());

        // Don't push canceltiles into the queue.
        Log::trace() << "After canceltiles have " << _queue.size() << " in queue." << Log::end;
        return;
    }
    else if (msg.compare(0, 10, "tilecombine") == 0)
    {
        // Breakup tilecombine and deduplicate.
        const auto tileCombined = TileCombined::parse(msg);
        for (auto& tile : tileCombined.getTiles())
        {
            const auto newMsg = tile.serialize("tile");
            _queue.push_back(Payload(newMsg.data(), newMsg.data() + newMsg.size()));
        }
    }

    if (!_queue.empty())
    {
        // TODO probably we could do the same with the invalidation callbacks
        // (later one wins).
        if (msg.compare(0, 4, "tile") == 0)
        {
            const auto newMsg = msg.substr(0, msg.find(" ver"));

            for (size_t i = 0; i < _queue.size(); ++i)
            {
                auto& it = _queue[i];
                const std::string old(it.data(), it.size());
                const auto oldMsg = old.substr(0, old.find(" ver"));
                if (newMsg == oldMsg)
                {
                    Log::debug() << "Remove duplicate message: " << old << " -> " << msg << Log::end;
                    _queue.erase(_queue.begin() + i);
                    break;
                }
            }
        }
    }

    MessageQueue::put_impl(value);
}

bool TileQueue::priority(const std::string& tileMsg)
{
    if (tileMsg.compare(0, 5, "tile ") != 0)
    {
        return false;
    }

    auto tile = TileDesc::parse(tileMsg); //FIXME: Expensive, avoid.

    for (int view : _viewOrder)
    {
        auto& cursor = _cursorPositions[view];
        if (tile.intersectsWithRect(cursor.X, cursor.Y, cursor.Width, cursor.Height))
            return true;
    }

    return false;
}

MessageQueue::Payload TileQueue::get_impl()
{
    std::vector<TileDesc> tiles;
    const auto front = _queue.front();

    auto msg = std::string(front.data(), front.size());
    Log::trace() << "MessageQueue Get, Size: " << _queue.size() << ", Front: " << msg << Log::end;

    if (msg.compare(0, 5, "tile ") != 0 || msg.find("id=") != std::string::npos)
    {
        // Don't combine non-tiles or tiles with id.
        Log::trace() << "MessageQueue res: " << msg << Log::end;
        _queue.pop_front();
        return front;
    }

    // We are handling a tile; first try to find one that is at the cursor's
    // position, otherwise handle the one that is at the front
    bool foundPrioritized = false;
    for (size_t i = 0; i < _queue.size(); ++i)
    {
        auto& it = _queue[i];
        const std::string prio(it.data(), it.size());
        if (priority(prio))
        {
            Log::debug() << "Handling a priority message: " << prio << Log::end;
            _queue.erase(_queue.begin() + i);
            msg = prio;
            foundPrioritized = true;
            break;
        }
    }

    if (!foundPrioritized)
        _queue.pop_front();

    tiles.emplace_back(TileDesc::parse(msg));

    // Combine as many tiles as possible with the top one.
    bool added;
    do
    {
        added = false;
        for (size_t i = 0; i < _queue.size(); )
        {
            auto& it = _queue[i];
            msg = std::string(it.data(), it.size());
            if (msg.compare(0, 5, "tile ") != 0 ||
                msg.find("id=") != std::string::npos)
            {
                // Don't combine non-tiles or tiles with id.
                ++i;
                continue;
            }

            auto tile2 = TileDesc::parse(msg);
            Log::trace() << "combining candidate: " << msg << Log::end;

            // Check if adjacent tiles.
            bool found = false;
            for (auto& tile : tiles)
            {
                if (tile.isAdjacent(tile2))
                {
                    tiles.emplace_back(tile2);
                    _queue.erase(_queue.begin() + i);
                    found = true;
                    added = true;
                    break;
                }
            }

            i += !found;
        }
    }
    while (added);

    Log::trace() << "Combined " << tiles.size() << " tiles, leaving " << _queue.size() << " in queue." << Log::end;

    if (tiles.size() == 1)
    {
        msg = tiles[0].serialize("tile");
        return Payload(msg.data(), msg.data() + msg.size());
    }

    auto tileCombined = TileCombined::create(tiles).serialize("tilecombine");
    Log::trace() << "MessageQueue res: " << tileCombined << Log::end;
    return Payload(tileCombined.data(), tileCombined.data() + tileCombined.size());
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
