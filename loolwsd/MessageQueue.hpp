/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_MESSAGEQUEUE_HPP
#define INCLUDED_MESSAGEQUEUE_HPP

#include <algorithm>
#include <condition_variable>
#include <functional>
#include <deque>
#include <map>
#include <mutex>
#include <vector>

/** Thread-safe message queue (FIFO).
*/
class MessageQueue
{
public:

    typedef std::vector<char> Payload;

    MessageQueue()
    {
    }

    virtual ~MessageQueue();

    MessageQueue(const MessageQueue&) = delete;
    MessageQueue& operator=(const MessageQueue&) = delete;

    /// Thread safe insert the message.
    void put(const Payload& value);
    void put(const std::string& value)
    {
        put(Payload(value.data(), value.data() + value.size()));
    }

    /// Thread safe obtaining of the message.
    /// timeoutMs can be 0 to signify infinity.
    Payload get(const unsigned timeoutMs = 0);

    /// Thread safe removal of all the pending messages.
    void clear();

    /// Thread safe remove_if.
    void remove_if(const std::function<bool(const Payload&)>& pred);

private:
    std::mutex _mutex;
    std::condition_variable _cv;

protected:
    virtual void put_impl(const Payload& value);

    bool wait_impl() const;

    virtual Payload get_impl();

    void clear_impl();

    std::deque<Payload> _queue;
};

/** MessageQueue specialized for priority handling of tiles.
*/
class TileQueue : public MessageQueue
{
    friend class TileQueueTests;

private:
    class CursorPosition
    {
    public:
        int Part;
        int X;
        int Y;
        int Width;
        int Height;
    };

public:
    void updateCursorPosition(int viewId, int part, int x, int y, int width, int height)
    {
        auto cursorPosition = CursorPosition({ part, x, y, width, height });
        auto it = _cursorPositions.find(viewId);
        if (it != _cursorPositions.end())
        {
            it->second = cursorPosition;
        }
        else
        {
            _cursorPositions[viewId] = cursorPosition;
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
    void removeDuplicate(const std::string& tileMsg);

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

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
