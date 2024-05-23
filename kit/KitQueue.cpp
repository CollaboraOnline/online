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

#include <config.h>

#include "KitQueue.hpp"

#include <string.h>
#include <climits>
#include <algorithm>
#include <string>
#include <string_view>
#include <iostream>

#include "JsonUtil.hpp"

/* static */ std::string KitQueue::Callback::toString(int view, int type, const std::string payload)
{
    std::ostringstream str;
    str << view << " " << lokCallbackTypeToString(type) << " "
        << COOLProtocol::getAbbreviatedMessage(payload);
    return str.str();
}

namespace {
    bool textItem(const KitQueue::Payload &value, const std::string &firstToken, bool &removeText)
    {
        size_t offset = firstToken.size(); // in this case a session
        if (value.size() < offset + 3)
            return false;

        size_t remaining = value.size() - firstToken.size();

        if (!memcmp(value.data() + offset + 1, "textinput", std::min(remaining - 1, size_t(9))))
        {
            removeText = false;
            return true;
        }

        if (!memcmp(value.data() + offset + 1, "removetextcontext", std::min(remaining - 1, size_t(17))))
        {
            removeText = true;
            return true;
        }
        return false;
    }
}

void KitQueue::put(const Payload& value)
{
    if (value.empty())
        throw std::runtime_error("Cannot queue empty item.");

    const std::string firstToken = COOLProtocol::getFirstToken(value);

    bool removeText = false;

    if (firstToken == "tilecombine")
        pushTileCombineRequest(value);

    else if (firstToken == "tile")
        pushTileQueue(value);

    else if (firstToken == "callback")
        assert(false && "callbacks should not come from the client");

    else if (textItem(value, firstToken, removeText))
    {
        StringVector tokens = StringVector::tokenize(value.data(), value.size());

        std::string newMsg = !removeText ? combineTextInput(tokens)
            : combineRemoveText(tokens);

        if (!newMsg.empty())
            _queue.emplace_back(newMsg.data(), newMsg.data() + newMsg.size());
        else
            _queue.emplace_back(value);
    }
    else // not so special
        _queue.emplace_back(value);
}

void KitQueue::removeTileDuplicate(const TileDesc &desc)
{
    for (size_t i = 0; i < _tileQueue.size(); ++i)
    {
        auto& it = _tileQueue[i];
        if (it == desc)
        {
            LOG_TRC("Remove duplicate tile request: " << it.serialize() <<
                    " -> " << desc.serialize());
            _tileQueue.erase(_tileQueue.begin() + i);
            break;
        }
    }
}

namespace {

/// Read the viewId from the payload.
std::string extractViewId(const std::string& payload)
{
    Poco::JSON::Parser parser;
    const Poco::Dynamic::Var result = parser.parse(payload);
    const auto& json = result.extract<Poco::JSON::Object::Ptr>();
    return json->get("viewId").toString();
}

/// Extract the .uno: command ID from the potential command.
std::string extractUnoCommand(const std::string& command)
{
    if (!COOLProtocol::matchPrefix(".uno:", command))
        return std::string();

    size_t equalPos = command.find('=');
    if (equalPos != std::string::npos)
        return command.substr(0, equalPos);

    return command;
}

/// Extract rectangle from the invalidation callback payload
bool extractRectangle(const StringVector& tokens, int& x, int& y, int& w, int& h, int& part, int& mode)
{
    x = 0;
    y = 0;
    w = INT_MAX;
    h = INT_MAX;
    part = 0;
    mode = 0;

    if (tokens.size() < 2)
        return false;

    if (tokens.equals(0, "EMPTY,"))
    {
        part = std::atoi(tokens[1].c_str());
        return true;
    }

    if (tokens.size() < 5)
        return false;

    x = std::atoi(tokens[0].c_str());
    y = std::atoi(tokens[1].c_str());
    w = std::atoi(tokens[2].c_str());
    h = std::atoi(tokens[3].c_str());
    part = std::atoi(tokens[4].c_str());

    if (tokens.size() == 6)
        mode = std::atoi(tokens[5].c_str());

    return true;
}

}

void KitQueue::putCallback(int view, int type, const std::string &payload)
{
    if (!elideDuplicateCallback(view, type, payload))
        _callbacks.emplace_back(view, type, payload);
}

bool KitQueue::elideDuplicateCallback(int view, int type, const std::string &payload)
{
    const auto callbackType = static_cast<LibreOfficeKitCallbackType>(type);

    // Nothing to combine in this case:
    if (_callbacks.size() == 0)
        return false;

    switch (callbackType)
    {
        case LOK_CALLBACK_INVALIDATE_TILES: // invalidation
        {
            StringVector tokens = StringVector::tokenize(payload);

            int msgX, msgY, msgW, msgH, msgPart, msgMode;
            if (!extractRectangle(tokens, msgX, msgY, msgW, msgH, msgPart, msgMode))
                return false;

            bool performedMerge = false;

            // we always travel the entire queue
            std::size_t i = 0;
            while (i < _callbacks.size())
            {
                auto& it = _callbacks[i];

                if (it._type != type || it._view != view)
                {
                    ++i;
                    continue;
                }
                StringVector queuedTokens = StringVector::tokenize(it._payload);

                int queuedX, queuedY, queuedW, queuedH, queuedPart, queuedMode;

                if (!extractRectangle(queuedTokens, queuedX, queuedY, queuedW, queuedH, queuedPart, queuedMode))
                {
                    ++i;
                    continue;
                }

                if (msgPart != queuedPart)
                {
                    ++i;
                    continue;
                }

                if (msgMode != queuedMode)
                {
                    ++i;
                    continue;
                }

                // the invalidation in the queue is fully covered by the payload,
                // just remove it
                if (msgX <= queuedX && queuedX + queuedW <= msgX + msgW && msgY <= queuedY
                    && queuedY + queuedH <= msgY + msgH)
                {
                    LOG_TRC("Removing smaller invalidation: "
                            << it._payload << " -> " << ' ' << msgX << ' ' << msgY << ' '
                            << msgW << ' ' << msgH << ' ' << msgPart << ' ' << msgMode);

                    // remove from the queue
                    _callbacks.erase(_callbacks.begin() + i);
                    continue;
                }

                // the invalidation just intersects, join those (if the result is
                // small)
                if (TileDesc::rectanglesIntersect(msgX, msgY, msgW, msgH, queuedX, queuedY, queuedW,
                                                  queuedH))
                {
                    int joinX = std::min(msgX, queuedX);
                    int joinY = std::min(msgY, queuedY);
                    int joinW = std::max(msgX + msgW, queuedX + queuedW) - joinX;
                    int joinH = std::max(msgY + msgH, queuedY + queuedH) - joinY;

                    const int reasonableSizeX = 4 * 3840; // 4x tile at 100% zoom
                    const int reasonableSizeY = 2 * 3840; // 2x tile at 100% zoom
                    if (joinW > reasonableSizeX || joinH > reasonableSizeY)
                    {
                        ++i;
                        continue;
                    }

                    LOG_TRC("Merging invalidations: "
                            << Callback::toString(view, type, payload) << " and "
                            << tokens[0] << ' ' << tokens[1] << ' ' << tokens[2] << ' '
                            << msgX << ' ' << msgY << ' ' << msgW << ' ' << msgH << ' '
                            << msgPart << ' ' << msgMode << " -> "
                            << tokens[0] << ' ' << tokens[1] << ' ' << tokens[2] << ' '
                            << joinX << ' ' << joinY << ' ' << joinW << ' ' << joinH << ' '
                            << msgPart << ' ' << msgMode);

                    msgX = joinX;
                    msgY = joinY;
                    msgW = joinW;
                    msgH = joinH;
                    performedMerge = true;

                    // remove from the queue
                    _callbacks.erase(_callbacks.begin() + i);
                    continue;
                }

                ++i;
            }

            if (performedMerge)
            {
                std::string newPayload =
                    std::to_string(msgX) + ", " + std::to_string(msgY) + ", " +
                    std::to_string(msgW) + ", " + std::to_string(msgH) + ", " +
                    tokens.cat(' ', 4); // part etc. ...

                LOG_TRC("Merge result: " << newPayload);

                _callbacks.emplace_back(view, type, newPayload);
                return true; // elide the original - use this instead
            }
        }
        break;

        case LOK_CALLBACK_STATE_CHANGED: // state changed
        {
            std::string unoCommand = extractUnoCommand(payload);
            if (unoCommand.empty())
                return false;

            // This is needed because otherwise it creates some problems when
            // a save occurs while a cell is still edited in Calc.
            if (unoCommand == ".uno:ModifiedStatus")
                return false;

            // remove obsolete states of the same .uno: command
            size_t unoCommandLen = unoCommand.size();
            for (size_t i = 0; i < _callbacks.size(); ++i)
            {
                Callback& it = _callbacks[i];
                if (it._type != type || it._view != view)
                    continue;

                size_t payloadLen = it._payload.size();
                if (payloadLen < unoCommandLen + 1 ||
                    unoCommand.compare(0, unoCommandLen, it._payload) != 0 ||
                    it._payload[unoCommandLen] != '=')
                    continue;

                LOG_TRC("Remove obsolete uno command: " << it << " -> "
                        << Callback::toString(view, type, payload));
                _callbacks.erase(_callbacks.begin() + i);
                break;
            }
        }
        break;

        case LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR: // the cursor has moved
        case LOK_CALLBACK_CURSOR_VISIBLE: // the cursor visibility has changed
        case LOK_CALLBACK_STATUS_INDICATOR_SET_VALUE: // setting the indicator value
        case LOK_CALLBACK_DOCUMENT_SIZE_CHANGED: // setting the document size
        case LOK_CALLBACK_CELL_CURSOR: // the cell cursor has moved
        case LOK_CALLBACK_INVALIDATE_VIEW_CURSOR: // the view cursor has moved
        case LOK_CALLBACK_CELL_VIEW_CURSOR: // the view cell cursor has moved
        case LOK_CALLBACK_VIEW_CURSOR_VISIBLE: // the view cursor visibility has changed
        {
            const bool isViewCallback = (callbackType == LOK_CALLBACK_INVALIDATE_VIEW_CURSOR ||
                                         callbackType == LOK_CALLBACK_CELL_VIEW_CURSOR ||
                                         callbackType == LOK_CALLBACK_VIEW_CURSOR_VISIBLE);

            const std::string viewId
                = (isViewCallback ? extractViewId(payload) : std::string());

            for (std::size_t i = 0; i < _callbacks.size(); ++i)
            {
                const auto& it = _callbacks[i];

                if (it._type != type || it._view != view)
                    continue;

                if (!isViewCallback)
                {
                    LOG_TRC("Remove obsolete callback: " << it <<  " -> "
                            << Callback::toString(view, type, payload));
                    _callbacks.erase(_callbacks.begin() + i);
                    break;
                }
                else if (isViewCallback)
                {
                    // we additionally need to ensure that the payload is about
                    // the same viewid (otherwise we'd merge them all views into
                    // one)
                    const std::string queuedViewId = extractViewId(it._payload);
                    if (viewId == queuedViewId)
                    {
                        LOG_TRC("Remove obsolete view callback: " << it << " -> "
                                << Callback::toString(view, type, payload));
                        _callbacks.erase(_callbacks.begin() + i);
                        break;
                    }
                }
            }
        }
        break;

        default:
        break;

    } // switch

    // Append the new command to the callbacks list
    return false;
}

int KitQueue::priority(const TileDesc &tile)
{
    for (int i = static_cast<int>(_viewOrder.size()) - 1; i >= 0; --i)
    {
        auto& cursor = _cursorPositions[_viewOrder[i]];
        if (tile.intersectsWithRect(cursor.getX(), cursor.getY(), cursor.getWidth(),
                                    cursor.getHeight()))
            return i;
    }

    return -1;
}

// FIXME: it's not that clear what good this does for us ...
// we process all previews in the same batch of rendering
void KitQueue::deprioritizePreviews()
{
    for (size_t i = 0; i < _tileQueue.size(); ++i)
    {
        const TileDesc front = _tileQueue.front();

        // stop at the first non-tile or non-'id' (preview) message
        if (!front.isPreview())
            break;

        _tileQueue.erase(_tileQueue.begin());
        _tileQueue.push_back(front);
    }
}

KitQueue::Payload KitQueue::pop()
{
    if (_queue.empty())
        return Payload();

    const Payload front = _queue.front();

    LOG_TRC("KitQueue(" << _queue.size() << ") - pop " <<
            COOLProtocol::getAbbreviatedMessage(front));

    _queue.erase(_queue.begin());

    return front;
}

std::vector<TileCombined> KitQueue::popWholeTileQueue()
{
    std::vector<TileCombined> result;

    while (!_tileQueue.empty())
        result.emplace_back(popTileQueue());

    return result;
}

TileCombined KitQueue::popTileQueue()
{
    assert(!_tileQueue.empty());

    LOG_TRC("KitQueue depth: " << _tileQueue.size());

    TileDesc msg = _tileQueue.front();

    std::vector<TileDesc> tiles;

    if (msg.isPreview())
    {
        // Don't combine non-tiles or tiles with id.
        LOG_TRC("KitQueue res: " << msg.serialize());
        _tileQueue.erase(_tileQueue.begin());

        // de-prioritize the other tiles with id - usually the previews in
        // Impress
        deprioritizePreviews();

        return TileCombined(msg);
    }

    // We are handling a tile; first try to find one that is at the cursor's
    // position, otherwise handle the one that is at the front
    int prioritized = 0;
    int prioritySoFar = -1;
    for (size_t i = 0; i < _tileQueue.size(); ++i)
    {
        auto& prio = _tileQueue[i];

        // FIXME: does this make any sense ?
        //
        // avoid starving - stop the search when we reach a non-tile,
        // otherwise we may keep growing the queue of unhandled stuff (both
        // tiles and non-tiles)
        if (prio.isPreview())
            break;

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

    _tileQueue.erase(_tileQueue.begin() + prioritized);

    tiles.emplace_back(msg);

    // Combine as many tiles as possible with the top one.
    for (size_t i = 0; i < _tileQueue.size(); )
    {
        auto& it = _tileQueue[i];
        if (it.isPreview())
        {
            // Don't combine non-tiles or tiles with id.
            ++i;
            continue;
        }

        LOG_TRC("Combining candidate: " << it.serialize());

        // Check if it's on the same row.
        if (tiles[0].canCombine(it))
        {
            tiles.emplace_back(it);
            _tileQueue.erase(_tileQueue.begin() + i);
        }
        else
        {
            ++i;
        }
    }

    LOG_TRC("Combined " << tiles.size() << " tiles, leaving " << _tileQueue.size() << " in queue.");

    if (tiles.size() == 1)
    {
        LOG_TRC("KitQueue res: " << tiles[0].serialize());
        return TileCombined(tiles[0]);
    }

    // n^2 but lists are short.
    for (size_t i = 0; i < tiles.size() - 1; ++i)
    {
        const auto &a = tiles[i];
        for (size_t j = i + 1; j < tiles.size();)
        {
            const auto &b = tiles[j];
            assert(a.getPart() == b.getPart());
            assert(a.getEditMode() == b.getEditMode());
            assert(a.getWidth() == b.getWidth());
            assert(a.getHeight() == b.getHeight());
            assert(a.getTileWidth() == b.getTileWidth());
            assert(a.getTileHeight() == b.getTileHeight());
            if (a.getTilePosX() == b.getTilePosX() &&
                a.getTilePosY() == b.getTilePosY())
            {
                LOG_TRC("KitQueue: dropping duplicate tile: " <<
                        j << " vs. " << i << " at: " <<
                        a.getTilePosX() << "," << b.getTilePosY());
                tiles.erase(tiles.begin() + j);
            }
            else
                j++;
        }
    }

    TileCombined combined = TileCombined::create(tiles);
    assert(!combined.hasDuplicates());
    LOG_TRC("KitQueue res: " << combined.serialize());
    return combined;
}

std::string KitQueue::combineTextInput(const StringVector& tokens)
{
    std::string id;
    std::string text;
    if (!COOLProtocol::getTokenString(tokens, "id", id) ||
        !COOLProtocol::getTokenString(tokens, "text", text))
        return std::string();

    int i = _queue.size() - 1;
    while (i >= 0)
    {
        auto& it = _queue[i];

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
            _queue.erase(_queue.begin() + i);

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

void KitQueue::pushTileCombineRequest(const Payload &value)
{
    assert(COOLProtocol::getFirstToken(value) == "tilecombine");

    // Breakup tilecombine and deduplicate (we are re-combining
    // the tiles inside popTileQueue() again)
    const std::string msg = std::string(value.data(), value.size());
    const TileCombined tileCombined = TileCombined::parse(msg);
    for (const auto& tile : tileCombined.getTiles())
    {
        removeTileDuplicate(tile);
        _tileQueue.emplace_back(tile);
    }
}

void KitQueue::pushTileQueue(const Payload &value)
{
    const std::string msg = std::string(value.data(), value.size());
    const TileDesc desc = TileDesc::parse(msg);
    removeTileDuplicate(desc);
    _tileQueue.push_back(desc);
}

std::string KitQueue::combineRemoveText(const StringVector& tokens)
{
    std::string id;
    int before = 0;
    int after = 0;
    if (!COOLProtocol::getTokenString(tokens, "id", id) ||
        !COOLProtocol::getTokenInteger(tokens, "before", before) ||
        !COOLProtocol::getTokenInteger(tokens, "after", after))
        return std::string();

    int i = _queue.size() - 1;
    while (i >= 0)
    {
        auto& it = _queue[i];

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
            _queue.erase(_queue.begin() + i);

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

void KitQueue::updateCursorPosition(int viewId, int part, int x, int y, int width, int height)
{
    const KitQueue::CursorPosition cursorPosition = CursorPosition(part, x, y, width, height);

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
        _viewOrder.erase(view);

    _viewOrder.push_back(viewId);
}

void KitQueue::removeCursorPosition(int viewId)
{
    const auto view = std::find(_viewOrder.begin(), _viewOrder.end(), viewId);
    if (view != _viewOrder.end())
        _viewOrder.erase(view);

    _cursorPositions.erase(viewId);
}

void KitQueue::dumpState(std::ostream& oss)
{
    oss << "\ttileQueue:"
        << "\n\t\tcursorPositions:";
    for (const auto &it : _cursorPositions)
    {
        oss << "\n\t\t\tviewId: "
            << it.first
            << " part: " << it.second.getPart()
            << " x: " << it.second.getX()
            << " y: " << it.second.getY()
            << " width: " << it.second.getWidth()
            << " height: " << it.second.getHeight();
    }

    oss << "\n\t\tviewOrder: [";
    std::string separator;
    for (const auto& viewId : _viewOrder)
    {
        oss << separator << viewId;
        separator = ", ";
    }
    oss << "]\n";

    oss << "\tQueue size: " << _queue.size() << "\n";
    size_t i = 0;
    for (Payload &it : _queue)
        oss << "\t\t" << i++ << ": " << COOLProtocol::getFirstLine(it) << "\n";

    oss << "\tCallbacks size: " << _callbacks.size() << "\n";
    i = 0;
    for (auto &it : _callbacks)
        oss << "\t\t" << i++ << ": " << it << "\n";
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
