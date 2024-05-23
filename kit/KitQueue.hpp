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

#include <stdexcept>
#include <algorithm>
#include <functional>
#include <map>
#include <string>
#include <vector>

#include "Log.hpp"
#include "TileDesc.hpp"
#include "Protocol.hpp"

/// Queue for handling the Kit's messaging needs
class KitQueue
{
    friend class KitQueueTests;

public:
    typedef std::vector<char> Payload;

    KitQueue() { }
    ~KitQueue() { }

    KitQueue(const KitQueue&) = delete;
    KitQueue& operator=(const KitQueue&) = delete;

    /// insert the message.
    void put(const Payload& value);
    void put(const std::string& value)
    {
        put(Payload(value.data(), value.data() + value.size()));
    }

    struct Callback {
        int _view; // -1 for all
        int _type;
        std::string _payload;

        Callback() : _view(-1), _type(-1) { }
        Callback(int view, int type, const std::string payload) :
            _view(view), _type(type), _payload(payload) { }

        static std::string toString(int view, int type, const std::string payload);
    };

    /// Queue a LibreOfficeKit callback for later emission
    void putCallback(int view, int type, const std::string &message);

    /// Work back over the queue to simplify & return false if we should not queue.
    bool elideDuplicateCallback(int view, int type, const std::string &message);

    /// Obtain the next message.
    /// timeoutMs can be 0 to signify infinity.
    /// Returns an empty payload on timeout.
    Payload pop();
    Payload get() { return pop(); }

    /// Tiles are special manage a separate queue of them
    void clearTileQueue() { _tileQueue.clear(); }
    void pushTileQueue(const Payload &value);
    void pushTileCombineRequest(const Payload &value);
    Payload popTileQueue();
    std::vector<TileCombined> popWholeTileQueue();
    size_t getTileQueueSize() const { return _tileQueue.size(); }

    /// Obtain the next callback
    Callback getCallback()
    {
        assert(_callbacks.size() > 0);
        const Callback front = _callbacks.front();
        _callbacks.erase(_callbacks.begin());
        return front;
    }

    bool getCallback(Callback &callback)
    {
        if (_callbacks.size() == 0)
            return false;
        callback = std::move(_callbacks.front());
        _callbacks.erase(_callbacks.begin());
        return true;
    }

    /// Anything in the queue ?
    bool isEmpty()
    {
        return _queue.empty();
    }

    size_t size() const
    {
        return _queue.size();
    }

    size_t callbackSize() const
    {
        return _callbacks.size();
    }

    /// Removal of all the pending messages.
    void clear()
    {
        _queue.clear();
        _callbacks.clear();
    }

    void dumpState(std::ostream& oss);

protected:
    /// Search the queue for a previous textinput message and if found, remove it and combine its
    /// input with that in the current textinput message. We check that there aren't any interesting
    /// messages inbetween that would make it wrong to merge the textinput messages.
    ///
    /// @return New message to put into the queue. If empty, use what we got.
    std::string combineTextInput(const StringVector& tokens);

    /// Search the queue for a previous removetextcontext message (which actually means "remove text
    /// content", the word "context" is because of some misunderstanding lost in history) and if
    /// found, remove it and combine its input with that in the current removetextcontext message.
    /// We check that there aren't any interesting messages inbetween that would make it wrong to
    /// merge the removetextcontext messages.
    ///
    /// @return New message to put into the queue. If empty, use what we got.
    std::string combineRemoveText(const StringVector& tokens);

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
    void updateCursorPosition(int viewId, int part, int x, int y, int width, int height);
    void removeCursorPosition(int viewId);

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
    /// The incoming underlying queue
    std::vector<Payload> _queue;

    /// Incoming tile request queue
    std::vector<Payload> _tileQueue;

    /// Outgoing queued callbacks
    std::vector<Callback> _callbacks;

    std::map<int, CursorPosition> _cursorPositions;

    /// Check the views in the order of how the editing (cursor movement) has
    /// been happening (0 == oldest, size() - 1 == newest).
    std::vector<int> _viewOrder;
};

inline std::ostream& operator<<(std::ostream& os, const KitQueue::Callback &c)
{
    os << KitQueue::Callback::toString(c._view, c._type, c._payload);
    return os;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
