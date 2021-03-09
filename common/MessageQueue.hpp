/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <algorithm>
#include <condition_variable>
#include <functional>
#include <map>
#include <mutex>
#include <string>
#include <vector>

/// Thread-safe message queue (FIFO).
template <typename T>
class MessageQueueBase
{
public:
    typedef T Payload;

    MessageQueueBase()
    {
    }

    virtual ~MessageQueueBase()
    {
        clear();
    }

    MessageQueueBase(const MessageQueueBase&) = delete;
    MessageQueueBase& operator=(const MessageQueueBase&) = delete;

    /// Thread safe insert the message.
    void put(const Payload& value)
    {
        if (value.empty())
        {
            throw std::runtime_error("Cannot queue empty item.");
        }

        put_impl(value);
    }

    void put(const std::string& value)
    {
        put(Payload(value.data(), value.data() + value.size()));
    }

    /// Thread safe obtaining of the message.
    /// timeoutMs can be 0 to signify infinity.
    /// Returns an empty payload on timeout.
    Payload get()
    {
        return get_impl();
    }

    /// Get a message without waiting
    Payload pop()
    {
        if (_queue.empty())
            return Payload();
        return get_impl();
    }

    /// Anything in the queue ?
    bool isEmpty()
    {
        return _queue.empty();
    }

    /// Thread safe removal of all the pending messages.
    void clear()
    {
        clear_impl();
    }

    /// Thread safe remove_if.
    void remove_if(const std::function<bool(const Payload&)>& pred)
    {
        std::remove_if(_queue.begin(), _queue.end(), pred);
    }

protected:
    virtual void put_impl(const Payload& value)
    {
        _queue.emplace_back(value);
    }

    virtual Payload get_impl()
    {
        Payload result = _queue.front();
        _queue.erase(_queue.begin());
        return result;
    }

    void clear_impl()
    {
        _queue.clear();
    }

    std::vector<Payload>& getQueue() { return _queue; }

private:
    std::vector<Payload> _queue;
};

typedef MessageQueueBase<std::vector<char>> MessageQueue;

/// MessageQueue specialized for priority handling of tiles.
class TileQueue : public MessageQueue
{
    friend class TileQueueTests;

private:
    class CursorPosition
    {
    public:
        CursorPosition() {}
        CursorPosition(int part, int x, int y, int width, int height)
            : _part(part)
            , _x(x)
            , _y(y)
            , _width(width)
            , _height(height)
        {
        }

        int getPart() const { return _part; }
        int getX() const { return _x; }
        int getY() const { return _y; }
        int getWidth() const { return _width; }
        int getHeight() const { return _height; }

    private:
        int _part = 0;
        int _x = 0;
        int _y = 0;
        int _width = 0;
        int _height = 0;
    };

public:
    void updateCursorPosition(int viewId, int part, int x, int y, int width, int height)
    {
        const TileQueue::CursorPosition cursorPosition = CursorPosition(part, x, y, width, height);

        auto it = _cursorPositions.lower_bound(viewId);
        if (it != _cursorPositions.end() && it->first == viewId)
        {
            it->second = cursorPosition;
        }
        else
        {
            _cursorPositions.insert(it, std::make_pair(viewId, cursorPosition));
        }

        // Move to front, so the current front view
        // becomes the second.
        const auto view = std::find(_viewOrder.begin(), _viewOrder.end(), viewId);
        if (view != _viewOrder.end())
        {
            _viewOrder.erase(view);
        }

        _viewOrder.push_back(viewId);
    }

    void removeCursorPosition(int viewId)
    {
        const auto view = std::find(_viewOrder.begin(), _viewOrder.end(), viewId);
        if (view != _viewOrder.end())
        {
            _viewOrder.erase(view);
        }

        _cursorPositions.erase(viewId);
    }

protected:
    virtual void put_impl(const Payload& value) override;

    virtual Payload get_impl() override;

private:
    /// Search the queue for a duplicate tile and remove it (if present).
    void removeTileDuplicate(const std::string& tileMsg);

    /// Search the queue for a duplicate callback and remove it (if present).
    ///
    /// This removes also callbacks that are made invalid by the current
    /// message, like the new cursor position invalidates the old one etc.
    ///
    /// @return New message to put into the queue.  If empty, use what was in callbackMsg.
    std::string removeCallbackDuplicate(const std::string& callbackMsg);

    /// De-prioritize the previews (tiles with 'id') - move them to the end of
    /// the queue.
    void deprioritizePreviews();

    /// Priority of the given tile message.
    /// -1 means the lowest prio (the tile does not intersect any of the cursors),
    /// the higher the number, the bigger is priority [up to _viewOrder.size()-1].
    int priority(const std::string& tileMsg);

private:
    std::map<int, CursorPosition> _cursorPositions;

    /// Check the views in the order of how the editing (cursor movement) has
    /// been happening (0 == oldest, size() - 1 == newest).
    std::vector<int> _viewOrder;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
