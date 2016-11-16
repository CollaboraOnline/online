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

#include <LOOLProtocol.hpp>
#include <Log.hpp>
#include <TileDesc.hpp>

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

MessageQueue::Payload MessageQueue::get(const unsigned timeoutMs)
{
    std::unique_lock<std::mutex> lock(_mutex);

    if (timeoutMs > 0)
    {
        if (!_cv.wait_for(lock, std::chrono::milliseconds(timeoutMs),
                          [this] { return wait_impl(); }))
        {
            throw std::runtime_error("Timed out waiting to get queue item.");
        }
    }
    else
    {
        _cv.wait(lock, [this] { return wait_impl(); });
    }

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
    _queue.push_back(value);
}

bool MessageQueue::wait_impl() const
{
    return _queue.size() > 0;
}

MessageQueue::Payload MessageQueue::get_impl()
{
    Payload result = _queue.front();
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
    const std::string firstToken = LOOLProtocol::getFirstToken(value);

    if (firstToken == "canceltiles")
    {
        LOG_TRC("Processing [" << msg << "]. Before canceltiles have " << _queue.size() << " in queue.");
        const auto seqs = msg.substr(12);
        StringTokenizer tokens(seqs, ",", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        _queue.erase(std::remove_if(_queue.begin(), _queue.end(),
                [&tokens](const Payload& v)
                {
                    const std::string s(v.data(), v.size());
                    // Tile is for a thumbnail, don't cancel it
                    if (s.find("id=") != std::string::npos)
                        return false;
                    for (size_t i = 0; i < tokens.count(); ++i)
                    {
                        if (s.find("ver=" + tokens[i]) != std::string::npos)
                        {
                            LOG_TRC("Matched " << tokens[i] << ", Removing [" << s << "]");
                            return true;
                        }
                    }

                    return false;

                }), _queue.end());

        // Don't push canceltiles into the queue.
        LOG_TRC("After canceltiles have " << _queue.size() << " in queue.");
        return;
    }
    else if (firstToken == "tilecombine")
    {
        // Breakup tilecombine and deduplicate (we are re-combining the tiles
        // in the get_impl() again)
        const auto tileCombined = TileCombined::parse(msg);
        for (auto& tile : tileCombined.getTiles())
        {
            const std::string newMsg = tile.serialize("tile");

            removeDuplicate(newMsg);

            MessageQueue::put_impl(Payload(newMsg.data(), newMsg.data() + newMsg.size()));
        }
        return;
    }
    else if (firstToken == "tile")
    {
        removeDuplicate(msg);

        MessageQueue::put_impl(value);
        return;
    }

    // TODO probably we could deduplacite the invalidation callbacks (later
    // one wins) the same way as we do for the tiles - to be tested.

    MessageQueue::put_impl(value);
}

void TileQueue::removeDuplicate(const std::string& tileMsg)
{
    assert(LOOLProtocol::getFirstToken(tileMsg) == "tile");

    // FIXME: This looks rather fragile; but OTOH if I understand correctly this doesn't handle
    // input from clients, but strings we have created ourselves here in C++ code, so probably we
    // can be sure that the "ver" parameter is always in such a location that this does what we
    // mean.
    // FIXME: also the ver=... is only for debugging from what I can see, so
    // double-check if we can actually avoid the 'ver' everywhere in the non-debug
    // builds
    const std::string newMsg = tileMsg.substr(0, tileMsg.find(" ver"));

    for (size_t i = 0; i < _queue.size(); ++i)
    {
        auto& it = _queue[i];
        const std::string old(it.data(), it.size());
        const std::string oldMsg = old.substr(0, old.find(" ver"));
        if (newMsg == oldMsg)
        {
            LOG_DBG("Remove duplicate message: " << old << " -> " << tileMsg);
            _queue.erase(_queue.begin() + i);
            break;
        }
    }
}

int TileQueue::priority(const std::string& tileMsg)
{
    auto tile = TileDesc::parse(tileMsg); //FIXME: Expensive, avoid.

    for (int i = static_cast<int>(_viewOrder.size()) - 1; i >= 0; --i)
    {
        auto& cursor = _cursorPositions[_viewOrder[i]];
        if (tile.intersectsWithRect(cursor.X, cursor.Y, cursor.Width, cursor.Height))
            return i;
    }

    return -1;
}

void TileQueue::deprioritizePreviews()
{
    for (size_t i = 0; i < _queue.size(); ++i)
    {
        const auto front = _queue.front();
        const std::string message(front.data(), front.size());

        // stop at the first non-tile or non-'id' (preview) message
        std::string id;
        if (LOOLProtocol::getFirstToken(message) != "tile" ||
            !LOOLProtocol::getTokenStringFromMessage(message, "id", id))
        {
            break;
        }

        _queue.pop_front();
        _queue.push_back(front);
    }
}

MessageQueue::Payload TileQueue::get_impl()
{
    const auto front = _queue.front();

    auto msg = std::string(front.data(), front.size());

    std::string id;
    bool isTile = (LOOLProtocol::getFirstToken(msg) == "tile");
    bool isPreview = isTile && LOOLProtocol::getTokenStringFromMessage(msg, "id", id);
    if (!isTile || isPreview)
    {
        // Don't combine non-tiles or tiles with id.
        LOG_TRC("MessageQueue res: " << msg);
        _queue.pop_front();

        // de-prioritize the other tiles with id - usually the previews in
        // Impress
        if (isPreview)
            deprioritizePreviews();

        return front;
    }

    // We are handling a tile; first try to find one that is at the cursor's
    // position, otherwise handle the one that is at the front
    int prioritized = 0;
    int prioritySoFar = -1;
    for (size_t i = 0; i < _queue.size(); ++i)
    {
        auto& it = _queue[i];
        const std::string prio(it.data(), it.size());

        // avoid starving - stop the search when we reach a non-tile,
        // otherwise we may keep growing the queue of unhandled stuff (both
        // tiles and non-tiles)
        if (LOOLProtocol::getFirstToken(prio) != "tile" ||
            LOOLProtocol::getTokenStringFromMessage(prio, "id", id))
        {
            break;
        }

        const int p = priority(prio);
        if (p > prioritySoFar)
        {
            prioritySoFar = p;
            prioritized = i;
            msg = prio;

            // found the highest priority already?
            if (prioritySoFar == static_cast<int>(_viewOrder.size()) - 1)
            {
                break;
            }
        }
    }

    _queue.erase(_queue.begin() + prioritized);

    std::vector<TileDesc> tiles;
    tiles.emplace_back(TileDesc::parse(msg));

    // Combine as many tiles as possible with the top one.
    for (size_t i = 0; i < _queue.size(); )
    {
        auto& it = _queue[i];
        msg = std::string(it.data(), it.size());
        if (LOOLProtocol::getFirstToken(msg) != "tile" ||
            LOOLProtocol::getTokenStringFromMessage(msg, "id", id))
        {
            // Don't combine non-tiles or tiles with id.
            ++i;
            continue;
        }

        auto tile2 = TileDesc::parse(msg);
        LOG_TRC("Combining candidate: " << msg);

        // Check if it's on the same row.
        if (tiles[0].onSameRow(tile2))
        {
            tiles.emplace_back(tile2);
            _queue.erase(_queue.begin() + i);
        }
        else
        {
            ++i;
        }
    }

    LOG_TRC("Combined " << tiles.size() << " tiles, leaving " << _queue.size() << " in queue.");

    if (tiles.size() == 1)
    {
        msg = tiles[0].serialize("tile");
        LOG_TRC("MessageQueue res: " << msg);
        return Payload(msg.data(), msg.data() + msg.size());
    }

    auto tileCombined = TileCombined::create(tiles).serialize("tilecombine");
    LOG_TRC("MessageQueue res: " << tileCombined);
    return Payload(tileCombined.data(), tileCombined.data() + tileCombined.size());
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
