/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include "MessageQueue.hpp"

#include <algorithm>

#include <Poco/JSON/JSON.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/StringTokenizer.h>

#include <Protocol.hpp>
#include <Log.hpp>
#include <TileDesc.hpp>

using Poco::StringTokenizer;

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

            removeTileDuplicate(newMsg);

            MessageQueue::put_impl(Payload(newMsg.data(), newMsg.data() + newMsg.size()));
        }
        return;
    }
    else if (firstToken == "tile")
    {
        removeTileDuplicate(msg);

        MessageQueue::put_impl(value);
        return;
    }
    else if (firstToken == "callback")
    {
        const std::string newMsg = removeCallbackDuplicate(msg);

        if (newMsg.empty())
        {
            MessageQueue::put_impl(value);
        }
        else
        {
            MessageQueue::put_impl(Payload(newMsg.data(), newMsg.data() + newMsg.size()));
        }

        return;
    }

    MessageQueue::put_impl(value);
}

void TileQueue::removeTileDuplicate(const std::string& tileMsg)
{
    assert(LOOLProtocol::matchPrefix("tile", tileMsg, /*ignoreWhitespace*/ true));

    // Ver is always provided at this point and it is necessary to
    // return back to clients the last rendered version of a tile
    // in case there are new invalidations and requests while rendering.
    // Here we compare duplicates without 'ver' since that's irrelevant.
    auto newMsgPos = tileMsg.find(" ver");
    if (newMsgPos == std::string::npos)
    {
        newMsgPos = tileMsg.size() - 1;
    }

    for (size_t i = 0; i < _queue.size(); ++i)
    {
        auto& it = _queue[i];
        if (it.size() > newMsgPos &&
            strncmp(tileMsg.data(), it.data(), newMsgPos) == 0)
        {
            LOG_TRC("Remove duplicate tile request: " << std::string(it.data(), it.size()) << " -> " << tileMsg);
            _queue.erase(_queue.begin() + i);
            break;
        }
    }
}

namespace {

/// Read the viewId from the tokens.
std::string extractViewId(const std::string& origMsg, const std::vector<std::string>& tokens)
{
    size_t nonJson = tokens[0].size() + tokens[1].size() + tokens[2].size() + 3; // including spaces
    std::string jsonString(origMsg.data() + nonJson, origMsg.size() - nonJson);

    Poco::JSON::Parser parser;
    const auto result = parser.parse(jsonString);
    const auto& json = result.extract<Poco::JSON::Object::Ptr>();
    return json->get("viewId").toString();
}

/// Extract the .uno: command ID from the potential command.
std::string extractUnoCommand(const std::string& command)
{
    if (!LOOLProtocol::matchPrefix(".uno:", command))
        return std::string();

    size_t equalPos = command.find('=');
    if (equalPos != std::string::npos)
        return command.substr(0, equalPos);

    return command;
}

/// Extract rectangle from the invalidation callback
bool extractRectangle(const std::vector<std::string>& tokens, int& x, int& y, int& w, int& h, int& part)
{
    x = 0;
    y = 0;
    w = INT_MAX;
    h = INT_MAX;
    part = 0;

    if (tokens.size() < 5)
        return false;

    if (tokens[3] == "EMPTY,")
    {
        part = std::atoi(tokens[4].c_str());
        return true;
    }

    if (tokens.size() < 8)
        return false;

    x = std::atoi(tokens[3].c_str());
    y = std::atoi(tokens[4].c_str());
    w = std::atoi(tokens[5].c_str());
    h = std::atoi(tokens[6].c_str());
    part = std::atoi(tokens[7].c_str());

    return true;
}

}

std::string TileQueue::removeCallbackDuplicate(const std::string& callbackMsg)
{
    assert(LOOLProtocol::matchPrefix("callback", callbackMsg, /*ignoreWhitespace*/ true));

    std::vector<std::string> tokens = LOOLProtocol::tokenize(callbackMsg);

    if (tokens.size() < 3)
        return std::string();

    // the message is "callback <view> <id> ..."
    const std::string& callbackType = tokens[2];

    if (callbackType == "0")        // invalidation
    {
        int msgX, msgY, msgW, msgH, msgPart;

        if (!extractRectangle(tokens, msgX, msgY, msgW, msgH, msgPart))
            return std::string();

        bool performedMerge = false;

        // we always travel the entire queue
        size_t i = 0;
        while (i < _queue.size())
        {
            auto& it = _queue[i];

            std::vector<std::string> queuedTokens = LOOLProtocol::tokenize(it.data(), it.size());
            if (queuedTokens.size() < 3)
            {
                ++i;
                continue;
            }

            // not a invalidation callback
            if (queuedTokens[0] != tokens[0] || queuedTokens[1] != tokens[1] || queuedTokens[2] != tokens[2])
            {
                ++i;
                continue;
            }

            int queuedX, queuedY, queuedW, queuedH, queuedPart;

            if (!extractRectangle(queuedTokens, queuedX, queuedY, queuedW, queuedH, queuedPart))
            {
                ++i;
                continue;
            }

            if (msgPart != queuedPart)
            {
                ++i;
                continue;
            }

            // the invalidation in the queue is fully covered by the message,
            // just remove it
            if (msgX <= queuedX && queuedX + queuedW <= msgX + msgW && msgY <= queuedY && queuedY + queuedH <= msgY + msgH)
            {
                LOG_TRC("Removing smaller invalidation: " << std::string(it.data(), it.size()) << " -> " <<
                        tokens[0] << " " << tokens[1] << " " << tokens[2] << " " << msgX << " " << msgY << " " << msgW << " " << msgH << " " << msgPart);

                // remove from the queue
                _queue.erase(_queue.begin() + i);
                continue;
            }

            // the invalidation just intersects, join those (if the result is
            // small)
            if (TileDesc::rectanglesIntersect(msgX, msgY, msgW, msgH, queuedX, queuedY, queuedW, queuedH))
            {
                int joinX = std::min(msgX, queuedX);
                int joinY = std::min(msgY, queuedY);
                int joinW = std::max(msgX + msgW, queuedX + queuedW) - joinX;
                int joinH = std::max(msgY + msgH, queuedY + queuedH) - joinY;

                const int reasonableSizeX = 4*3840; // 4x tile at 100% zoom
                const int reasonableSizeY = 2*3840; // 2x tile at 100% zoom
                if (joinW > reasonableSizeX || joinH > reasonableSizeY)
                {
                    ++i;
                    continue;
                }

                LOG_TRC("Merging invalidations: " << std::string(it.data(), it.size()) << " and " <<
                        tokens[0] << " " << tokens[1] << " " << tokens[2] << " " << msgX << " " << msgY << " " << msgW << " " << msgH << " " << msgPart << " -> " <<
                        tokens[0] << " " << tokens[1] << " " << tokens[2] << " " << joinX << " " << joinY << " " << joinW << " " << joinH << " " << msgPart);

                msgX = joinX;
                msgY = joinY;
                msgW = joinW;
                msgH = joinH;
                performedMerge = true;

                // remove from the queue
                _queue.erase(_queue.begin() + i);
                continue;
            }

            ++i;
        }

        if (performedMerge)
        {
            size_t pre = tokens[0].size() + tokens[1].size() + tokens[2].size() + 3;
            size_t post = pre + tokens[3].size() + tokens[4].size() + tokens[5].size() + tokens[6].size() + 4;

            std::string result = callbackMsg.substr(0, pre) +
                std::to_string(msgX) + ", " +
                std::to_string(msgY) + ", " +
                std::to_string(msgW) + ", " +
                std::to_string(msgH) + ", " + callbackMsg.substr(post);

            LOG_TRC("Merge result: " << result);

            return result;
        }
    }
    else if (callbackType == "8")        // state changed
    {
        if (tokens.size() < 4)
            return std::string();

        std::string unoCommand = extractUnoCommand(tokens[3]);
        if (unoCommand.empty())
            return std::string();

        // remove obsolete states of the same .uno: command
        for (size_t i = 0; i < _queue.size(); ++i)
        {
            auto& it = _queue[i];

            std::vector<std::string> queuedTokens = LOOLProtocol::tokenize(it.data(), it.size());
            if (queuedTokens.size() < 4)
                continue;

            if (queuedTokens[0] != tokens[0] || queuedTokens[1] != tokens[1] || queuedTokens[2] != tokens[2])
                continue;

            // callback, the same target, state changed; now check it's
            // the same .uno: command
            std::string queuedUnoCommand = extractUnoCommand(queuedTokens[3]);
            if (queuedUnoCommand.empty())
                continue;

            if (unoCommand == queuedUnoCommand)
            {
                LOG_TRC("Remove obsolete uno command: " << std::string(it.data(), it.size()) << " -> " << callbackMsg);
                _queue.erase(_queue.begin() + i);
                break;
            }
        }
    }
    else if (callbackType == "1" || // the cursor has moved
            callbackType == "5" ||  // the cursor visibility has changed
            callbackType == "10" || // setting the indicator value
            callbackType == "13" || // setting the document size
            callbackType == "17" || // the cell cursor has moved
            callbackType == "24" || // the view cursor has moved
            callbackType == "26" || // the view cell cursor has moved
            callbackType == "28")   // the view cursor visibility has changed
    {
        const bool isViewCallback = (callbackType == "24" || callbackType == "26" || callbackType == "28");

        std::string viewId;
        if (isViewCallback)
        {
            viewId = extractViewId(callbackMsg, tokens);
        }

        for (size_t i = 0; i < _queue.size(); ++i)
        {
            auto& it = _queue[i];

            // skip non-callbacks quickly
            if (!LOOLProtocol::matchPrefix("callback", it))
                continue;

            std::vector<std::string> queuedTokens = LOOLProtocol::tokenize(it.data(), it.size());
            if (queuedTokens.size() < 3)
                continue;

            if (!isViewCallback && (queuedTokens[1] == tokens[1] && queuedTokens[2] == tokens[2]))
            {
                LOG_TRC("Remove obsolete callback: " << std::string(it.data(), it.size()) << " -> " << callbackMsg);
                _queue.erase(_queue.begin() + i);
                break;
            }
            else if (isViewCallback && (queuedTokens[1] == tokens[1] && queuedTokens[2] == tokens[2]))
            {
                // we additionally need to ensure that the payload is about
                // the same viewid (otherwise we'd merge them all views into
                // one)
                const std::string queuedViewId = extractViewId(std::string(it.data(), it.size()), queuedTokens);

                if (viewId == queuedViewId)
                {
                    LOG_TRC("Remove obsolete view callback: " << std::string(it.data(), it.size()) << " -> " << callbackMsg);
                    _queue.erase(_queue.begin() + i);
                    break;
                }
            }
        }
    }

    return std::string();
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
        if (!LOOLProtocol::matchPrefix("tile", message) ||
            !LOOLProtocol::getTokenStringFromMessage(message, "id", id))
        {
            break;
        }

        _queue.erase(_queue.begin());
        _queue.push_back(front);
    }
}

TileQueue::Payload TileQueue::get_impl()
{
    LOG_TRC("MessageQueue depth: " << _queue.size());

    const auto front = _queue.front();

    auto msg = std::string(front.data(), front.size());

    std::string id;
    bool isTile = LOOLProtocol::matchPrefix("tile", msg);
    bool isPreview = isTile && LOOLProtocol::getTokenStringFromMessage(msg, "id", id);
    if (!isTile || isPreview)
    {
        // Don't combine non-tiles or tiles with id.
        LOG_TRC("MessageQueue res: " << msg);
        _queue.erase(_queue.begin());

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
        if (!LOOLProtocol::matchPrefix("tile", prio) ||
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
        if (!LOOLProtocol::matchPrefix("tile", msg) ||
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
