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

class TilePrioritizer
{
public:
    virtual ~TilePrioritizer() {}

    enum class Priority {
        NONE = -1,  // an error
        LOWEST,
        LOW,
        NORMAL,
        HIGH,
        VERYHIGH,
        ULTRAHIGH
    };
    virtual Priority getTilePriority(const TileDesc &) const { return Priority::NORMAL; }

    typedef std::pair<int, float> ViewIdInactivity;
    virtual std::vector<ViewIdInactivity> getViewIdsByInactivity() const { return {}; }
};

/// Queue for handling the Kit's messaging needs
class KitQueue
{
    friend class KitQueueTests;

    const TilePrioritizer &_prio;
public:
    typedef std::vector<char> Payload;

    KitQueue(const TilePrioritizer &prio) : _prio(prio) { }
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
        Callback(const Callback&) = default;
        Callback(Callback&&) = default;
        Callback& operator=(const Callback&) = default;
        Callback& operator=(Callback&&) = default;
        Callback(int view, int type, std::string payload)
            : _view(view)
            , _type(type)
            , _payload(std::move(payload))
        {
        }

        static std::string toString(int view, int type, const std::string& payload);
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

    /// Tiles are special manage separate queues of them
    void clearTileQueue() { _tileQueues.clear(); }
    void pushTileQueue(const Payload &value);
    void pushTileCombineRequest(const Payload &value);
    /// Pops the highest priority TileCombined from the
    /// render queue, with it's priority.
    TileCombined popTileQueue(TilePrioritizer::Priority& priority);
    size_t getTileQueueSize() const;
    bool isTileQueueEmpty() const;

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
    /// Search the queue for a duplicate tile and remove it (if present).
    void removeTileDuplicate(const TileDesc &desc);

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

    std::vector<TileDesc>* getTileQueue(int viewid);
    std::vector<TileDesc>& ensureTileQueue(int viewid);
    TileCombined popTileQueue(std::vector<TileDesc>& tileQueue, TilePrioritizer::Priority &priority);

private:
    /// Queue of incoming messages from coolwsd
    std::vector<Payload> _queue;

    /// Queues of incoming tile requests from coolwsd
    typedef std::pair<int, std::vector<TileDesc>> viewTileQueue;
    std::vector<viewTileQueue> _tileQueues;

    /// Queue of callbacks from Kit to send out to coolwsd
    std::vector<Callback> _callbacks;
};

inline std::ostream& operator<<(std::ostream& os, const KitQueue::Callback &c)
{
    os << KitQueue::Callback::toString(c._view, c._type, c._payload);
    return os;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
