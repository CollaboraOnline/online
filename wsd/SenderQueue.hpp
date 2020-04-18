/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <condition_variable>
#include <deque>
#include <memory>
#include <mutex>
#include <thread>
#include <vector>

#include <Poco/Dynamic/Var.h>
#include <Poco/JSON/JSON.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>

#include "common/SigUtil.hpp"
#include "Log.hpp"
#include "TileDesc.hpp"

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
        std::unique_lock<std::mutex> lock(_mutex);

        if (!_queue.empty() && !SigUtil::getTerminationFlag())
        {
            item = _queue.front();
            _queue.pop_front();
            return true;
        }
        else
        {
            if (SigUtil::getTerminationFlag())
                LOG_DBG("SenderQueue: TerminationFlag is set");
            return false;
        }
    }

    size_t size() const
    {
        std::lock_guard<std::mutex> lock(_mutex);
        return _queue.size();
    }

    void dumpState(std::ostream& os)
    {
        os << "\n\t\tqueue size " << _queue.size() << "\n";
        std::lock_guard<std::mutex> lock(_mutex);
        for (const Item &item : _queue)
        {
            os << "\t\t\ttype: " << (item->isBinary() ? "binary" : "text") << "\n";
            os << "\t\t\t" << item->abbr() << "\n";
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
                    return cur->firstToken() == "tile:" &&
                           newTile == TileDesc::parse(cur->firstLine());
                });

            if (pos != _queue.end())
                _queue.erase(pos);
        }
        else if (command == "statusindicatorsetvalue:" ||
                 command == "invalidatecursor:" ||
                 command == "setpart:")
        {
            // Remove previous identical enties of this command,
            // if any, and use most recent (incoming).
            const auto& pos = std::find_if(_queue.begin(), _queue.end(),
                [&command](const queue_item_t& cur)
                {
                    return cur->firstToken() == command;
                });

            if (pos != _queue.end())
                _queue.erase(pos);
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
                    if (cur->firstToken() == command)
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
