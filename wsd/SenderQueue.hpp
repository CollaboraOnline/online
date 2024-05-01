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

#include "common/SigUtil.hpp"
#include "Log.hpp"
#include "TileDesc.hpp"
#include "JsonUtil.hpp"

#include <deque>
#include <mutex>

/// A queue of data to send to certain Session's WS.
template <typename Item>
class SenderQueue final
{
public:

    SenderQueue()
    {
    }

    size_t enqueue(const Item& item)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        if (!SigUtil::getTerminationFlag() && deduplicate(item))
            _queue.push_back(item);

        return _queue.size();
    }

    /// Dequeue an item if we have one - @returns true if we do, else false.
    bool dequeue(Item& item)
    {
        // This check is always thread-safe.
        if (SigUtil::getTerminationFlag())
        {
            LOG_DBG("SenderQueue: TerminationFlag is set");
            return false;
        }

        std::unique_lock<std::mutex> lock(_mutex);

        if (!_queue.empty())
        {
            item = _queue.front();
            _queue.pop_front();
            return true;
        }

        return false;
    }

    size_t size() const
    {
        std::lock_guard<std::mutex> lock(_mutex);
        return _queue.size();
    }

    void dumpState(std::ostream& os)
    {
        os << "\n\t\tqueue size " << _queue.size() << '\n';
        std::lock_guard<std::mutex> lock(_mutex);
        for (const Item &item : _queue)
        {
            os << "\t\t\ttype: " << (item->isBinary() ? "binary\n" : "text\n");
            os << "\t\t\t" << item->abbr() << '\n';
        }
    }

private:
    /// Deduplicate messages based on the new one.
    /// Returns true if the new message should be
    /// enqueued, otherwise false.
    bool deduplicate(const Item& item)
    {
        // Deduplicate messages based on the incoming one.
        const std::string command = item->firstToken();
        if (command == "tile:")
        {
            // Remove previous identical tile, if any, and use most recent (incoming).
            const TileDesc newTile = TileDesc::parse(item->firstLine());
            const auto& pos = std::find_if(_queue.begin(), _queue.end(),
                [&newTile](const queue_item_t& cur)
                {
                    return cur->firstTokenMatches("tile:") &&
                           newTile == TileDesc::parse(cur->firstLine());
                });

            if (pos != _queue.end())
                _queue.erase(pos);
        }
        else if (command == "invalidatecursor:" ||
                 command == "setpart:")
        {
            // Remove previous identical entries of this command,
            // if any, and use most recent (incoming).
            const auto& pos = std::find_if(_queue.begin(), _queue.end(),
                [&command](const queue_item_t& cur)
                {
                    return cur->firstTokenMatches(command);
                });

            if (pos != _queue.end())
                _queue.erase(pos);
        }
        else if (command == "progress:")
        {
            // find other progress commands with similar content
            static const std::string setvalueTag = "\"id\":\"setvalue\"";
            if (item->contains(setvalueTag))
            {
                const auto& pos = std::find_if(_queue.begin(), _queue.end(),
                                               [&command](const queue_item_t& cur)
                {
                    return cur->firstTokenMatches(command) &&
                           cur->contains(setvalueTag);
                });

                if (pos != _queue.end())
                    _queue.erase(pos);
            }
        }
        else if (command == "invalidateviewcursor:")
        {
            // Remove previous cursor invalidation for same view,
            // if any, and use most recent (incoming).
            const std::string newMsg = item->jsonString();
            Poco::JSON::Parser newParser;
            const Poco::Dynamic::Var newResult = newParser.parse(newMsg);
            const auto& newJson = newResult.extract<Poco::JSON::Object::Ptr>();
            const std::string viewId = newJson->get("viewId").toString();
            const auto& pos = std::find_if(_queue.begin(), _queue.end(),
                [command, viewId](const queue_item_t& cur)
                {
                    if (cur->firstTokenMatches(command))
                    {
                        const std::string msg = cur->jsonString();
                        Poco::JSON::Parser parser;
                        const Poco::Dynamic::Var result = parser.parse(msg);
                        const auto& json = result.extract<Poco::JSON::Object::Ptr>();
                        return viewId == json->get("viewId").toString();
                    }

                    return false;
                });

            if (pos != _queue.end())
                _queue.erase(pos);
        }

        return true;
    }

private:
    mutable std::mutex _mutex;
    std::deque<Item> _queue;
    typedef typename std::deque<Item>::value_type queue_item_t;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
