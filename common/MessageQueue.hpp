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
#include "Protocol.hpp"

/// Thread-safe message queue (FIFO).
class MessageQueue
{
public:
    typedef std::vector<char> Payload;

    MessageQueue()
    {
    }

    virtual ~MessageQueue()
    {
        clear();
    }

    MessageQueue(const MessageQueue&) = delete;
    MessageQueue& operator=(const MessageQueue&) = delete;

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

    bool size()
    {
        return _queue.size();
    }

    /// Thread safe removal of all the pending messages.
    void clear()
    {
        clear_impl();
    }

protected:
    virtual void put_impl(const Payload& value)
    {
        StringVector tokens = StringVector::tokenize(value.data(), value.size());
        if (tokens.equals(1, "textinput"))
        {
            const std::string newMsg = combineTextInput(tokens);
            if (!newMsg.empty())
            {
                _queue.push_back(Payload(newMsg.data(), newMsg.data() + newMsg.size()));
                return;
            }
        }
        else if (tokens.equals(1, "removetextcontext"))
        {
            const std::string newMsg = combineRemoveText(tokens);
            if (!newMsg.empty())
            {
                _queue.push_back(Payload(newMsg.data(), newMsg.data() + newMsg.size()));
                return;
            }
        }

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

    /// Search the queue for a previous textinput message and if found, remove it and combine its
    /// input with that in the current textinput message. We check that there aren't any interesting
    /// messages inbetween that would make it wrong to merge the textinput messages.
    ///
    /// @return New message to put into the queue. If empty, use what we got.
    std::string combineTextInput(const StringVector& tokens)
    {
        std::string id;
        std::string text;
        if (!COOLProtocol::getTokenString(tokens, "id", id) ||
            !COOLProtocol::getTokenString(tokens, "text", text))
            return std::string();

        int i = getQueue().size() - 1;
        while (i >= 0)
        {
            auto& it = getQueue()[i];

            const std::string queuedMessage(it.data(), it.size());
            StringVector queuedTokens = StringVector::tokenize(it.data(), it.size());

            // If any messages of these types are present before the current ("textinput") message,
            // no combination is possible.
            if (queuedTokens.size() == 1 ||
                (queuedTokens.equals(0, tokens, 0) &&
                 (queuedTokens.equals(1, "key") ||
                  queuedTokens.equals(1, "mouse") ||
                  queuedTokens.equals(1, "removetextcontext") ||
                  queuedTokens.equals(1, "windowkey"))))
                return std::string();

            std::string queuedId;
            std::string queuedText;
            if (queuedTokens.equals(0, tokens, 0) &&
                queuedTokens.equals(1, "textinput") &&
                COOLProtocol::getTokenString(queuedTokens, "id", queuedId) &&
                queuedId == id &&
                COOLProtocol::getTokenString(queuedTokens, "text", queuedText))
            {
                // Remove the queued textinput message and combine it with the current one
                getQueue().erase(getQueue().begin() + i);

                std::string newMsg;
                newMsg.reserve(it.size() * 2);
                newMsg.append(queuedTokens[0]);
                newMsg.append(" textinput id=");
                newMsg.append(id);
                newMsg.append(" text=");
                newMsg.append(queuedText);
                newMsg.append(text);

                LOG_TRC("Combined [" << queuedMessage << "] with current message to [" << newMsg
                                     << ']');

                return newMsg;
            }

            --i;
        }

        return std::string();
    }

    /// Search the queue for a previous removetextcontext message (which actually means "remove text
    /// content", the word "context" is because of some misunderstanding lost in history) and if
    /// found, remove it and combine its input with that in the current removetextcontext message.
    /// We check that there aren't any interesting messages inbetween that would make it wrong to
    /// merge the removetextcontext messages.
    ///
    /// @return New message to put into the queue. If empty, use what we got.
    std::string combineRemoveText(const StringVector& tokens)
    {
        std::string id;
        int before = 0;
        int after = 0;
        if (!COOLProtocol::getTokenString(tokens, "id", id) ||
            !COOLProtocol::getTokenInteger(tokens, "before", before) ||
            !COOLProtocol::getTokenInteger(tokens, "after", after))
            return std::string();

        int i = getQueue().size() - 1;
        while (i >= 0)
        {
            auto& it = getQueue()[i];

            const std::string queuedMessage(it.data(), it.size());
            StringVector queuedTokens = StringVector::tokenize(it.data(), it.size());

            // If any messages of these types are present before the current (removetextcontext)
            // message, no combination is possible.
            if (queuedTokens.size() == 1 ||
                (queuedTokens.equals(0, tokens, 0) &&
                 (queuedTokens.equals(1, "key") ||
                  queuedTokens.equals(1, "mouse") ||
                  queuedTokens.equals(1, "textinput") ||
                  queuedTokens.equals(1, "windowkey"))))
                return std::string();

            std::string queuedId;
            int queuedBefore = 0;
            int queuedAfter = 0;
            if (queuedTokens.equals(0, tokens, 0) &&
                queuedTokens.equals(1, "removetextcontext") &&
                COOLProtocol::getTokenStringFromMessage(queuedMessage, "id", queuedId) &&
                queuedId == id &&
                COOLProtocol::getTokenIntegerFromMessage(queuedMessage, "before", queuedBefore) &&
                COOLProtocol::getTokenIntegerFromMessage(queuedMessage, "after", queuedAfter))
            {
                // Remove the queued removetextcontext message and combine it with the current one
                getQueue().erase(getQueue().begin() + i);

                std::string newMsg = queuedTokens[0] + " removetextcontext id=" + id +
                    " before=" + std::to_string(queuedBefore + before) +
                    " after=" + std::to_string(queuedAfter + after);

                LOG_TRC("Combined [" << queuedMessage << "] with current message to [" << newMsg << "]");

                return newMsg;
            }

            --i;
        }

        return std::string();
    }

    void dumpState(std::ostream& oss);

private:
    std::vector<Payload> _queue;
};

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

    void dumpState(std::ostream& oss);

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
