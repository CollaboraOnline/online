/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "MessageQueue.hpp"
#include <climits>
#include <algorithm>
#include <iostream>

#include <Poco/JSON/JSON.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>

#include "Protocol.hpp"
#include "Log.hpp"
#include <TileDesc.hpp>

void TileQueue::put_impl(const Payload& value)
{
    const std::string firstToken = COOLProtocol::getFirstToken(value);

    if (firstToken == "canceltiles")
    {
        // #6514 given that all messages that can have "ver=" in them will
        // also have "nviewid=", "oldwid=" and "wid=" then "id=" is always
        // hit and this loop doesn't achieve anything, disable this for
        // now and either drop canceltiles or repair it to do something
#if 0
        const std::string msg = std::string(value.data(), value.size());
        LOG_TRC("Processing [" << COOLProtocol::getAbbreviatedMessage(msg)
                               << "]. Before canceltiles have " << getQueue().size()
                               << " in queue.");
        const std::string seqs = msg.substr(12);
        StringVector tokens(StringVector::tokenize(seqs, ','));
        getQueue().erase(std::remove_if(getQueue().begin(), getQueue().end(),
                [&tokens](const Payload& v)
                {
                    const std::string s(v.data(), v.size());
                    // Tile is for a thumbnail, don't cancel it
                    if (s.find("id=") != std::string::npos)
                        return false;
                    for (size_t i = 0; i < tokens.size(); ++i)
                    {
                        if (s.find("ver=" + tokens[i]) != std::string::npos)
                        {
                            LOG_TRC("Matched " << tokens[i] << ", Removing [" << s << ']');
                            return true;
                        }
                    }

                    return false;

                }), getQueue().end());

        // Don't push canceltiles into the queue.
        LOG_TRC("After canceltiles have " << getQueue().size() << " in queue.");
#endif
        return;
    }
    else if (firstToken == "tilecombine")
    {
        // Breakup tilecombine and deduplicate (we are re-combining the tiles
        // in the get_impl() again)
        const std::string msg = std::string(value.data(), value.size());
        const TileCombined tileCombined = TileCombined::parse(msg);
        for (const auto& tile : tileCombined.getTiles())
        {
            const std::string newMsg = tile.serialize("tile");

            removeTileDuplicate(newMsg);

            MessageQueue::put_impl(Payload(newMsg.data(), newMsg.data() + newMsg.size()));
        }
        return;
    }
    else if (firstToken == "tile")
    {
        removeTileDuplicate(std::string(value.data(), value.size()));

        MessageQueue::put_impl(value);
        return;
    }
    else if (firstToken == "callback")
    {
        const std::string newMsg = removeCallbackDuplicate(std::string(value.data(), value.size()));

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
    assert(COOLProtocol::matchPrefix("tile", tileMsg, /*ignoreWhitespace*/ true));

    // Ver is always provided at this point and it is necessary to
    // return back to clients the last rendered version of a tile
    // in case there are new invalidations and requests while rendering.
    // Here we compare duplicates without 'ver' since that's irrelevant.
    size_t newMsgPos = tileMsg.find(" ver");
    if (newMsgPos == std::string::npos)
    {
        newMsgPos = tileMsg.size() - 1;
    }

    for (size_t i = 0; i < getQueue().size(); ++i)
    {
        auto& it = getQueue()[i];
        if (it.size() > newMsgPos &&
            strncmp(tileMsg.data(), it.data(), newMsgPos) == 0)
        {
            LOG_TRC("Remove duplicate tile request: " << std::string(it.data(), it.size()) << " -> " << COOLProtocol::getAbbreviatedMessage(tileMsg));
            getQueue().erase(getQueue().begin() + i);
            break;
        }
    }
}

namespace {

/// Read the viewId from the tokens.
std::string extractViewId(const std::string& origMsg, const StringVector& tokens)
{
    size_t nonJson = tokens[0].size() + tokens[1].size() + tokens[2].size() + 3; // including spaces
    std::string jsonString(origMsg.data() + nonJson, origMsg.size() - nonJson);

    Poco::JSON::Parser parser;
    const Poco::Dynamic::Var result = parser.parse(jsonString);
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

bool containsUnoCommand(const std::string_view token, const std::string_view command)
{
    if (!COOLProtocol::matchPrefix(".uno:", token))
        return false;

    size_t equalPos = token.find('=');
    if (equalPos != std::string::npos)
        return token.substr(0, equalPos) == command;

    return token == command;
}

/// Extract rectangle from the invalidation callback
bool extractRectangle(const StringVector& tokens, int& x, int& y, int& w, int& h, int& part, int& mode)
{
    x = 0;
    y = 0;
    w = INT_MAX;
    h = INT_MAX;
    part = 0;
    mode = 0;

    if (tokens.size() < 5)
        return false;

    if (tokens.equals(3, "EMPTY,"))
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

    if (tokens.size() == 9)
        mode = std::atoi(tokens[8].c_str());

    return true;
}

class isDuplicateCommand
{
private:
    const std::string& m_unoCommand;
    const StringVector& m_tokens;
    bool m_is_duplicate_command;
public:
    isDuplicateCommand(const std::string& unoCommand, const StringVector& tokens)
        : m_unoCommand(unoCommand)
        , m_tokens(tokens)
        , m_is_duplicate_command(false)
    {
    }

    bool get_is_duplicate_command() const
    {
        return m_is_duplicate_command;
    }

    void reset()
    {
        m_is_duplicate_command = false;
    }

    bool operator()(size_t nIndex, std::string_view token)
    {
        switch (nIndex)
        {
            case 0:
            case 1:
            case 2:
                // returns true to end tokenization as one of first 3 token doesn't match
                return token != m_tokens[nIndex];
            case 3:
                // callback, the same target, state changed; now check it's
                // the same .uno: command
                m_is_duplicate_command = containsUnoCommand(token, m_unoCommand);
                // returns true to end tokenization as 4 is all we need
                return true;
            break;
        }
        return false;
    };
};

}

std::string TileQueue::removeCallbackDuplicate(const std::string& callbackMsg)
{
    assert(COOLProtocol::matchPrefix("callback", callbackMsg, /*ignoreWhitespace*/ true));

    StringVector tokens = StringVector::tokenize(callbackMsg);

    if (tokens.size() < 3)
        return std::string();

    // the message is "callback <view> <id> ..."
    const auto pair = Util::i32FromString(tokens[2]);
    if (!pair.second)
        return std::string();

    const auto callbackType = static_cast<LibreOfficeKitCallbackType>(pair.first);

    switch (callbackType)
    {
        case LOK_CALLBACK_INVALIDATE_TILES: // invalidation
        {
            int msgX, msgY, msgW, msgH, msgPart, msgMode;

            if (!extractRectangle(tokens, msgX, msgY, msgW, msgH, msgPart, msgMode))
                return std::string();

            bool performedMerge = false;

            // we always travel the entire queue
            std::size_t i = 0;
            while (i < getQueue().size())
            {
                auto& it = getQueue()[i];

                StringVector queuedTokens = StringVector::tokenize(it.data(), it.size());
                if (queuedTokens.size() < 3)
                {
                    ++i;
                    continue;
                }

                // not a invalidation callback
                if (queuedTokens[0] != tokens[0] || queuedTokens[1] != tokens[1]
                    || queuedTokens[2] != tokens[2])
                {
                    ++i;
                    continue;
                }

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

                // the invalidation in the queue is fully covered by the message,
                // just remove it
                if (msgX <= queuedX && queuedX + queuedW <= msgX + msgW && msgY <= queuedY
                    && queuedY + queuedH <= msgY + msgH)
                {
                    LOG_TRC("Removing smaller invalidation: "
                            << std::string(it.data(), it.size()) << " -> " << tokens[0] << ' '
                            << tokens[1] << ' ' << tokens[2] << ' ' << msgX << ' ' << msgY << ' '
                            << msgW << ' ' << msgH << ' ' << msgPart << ' ' << msgMode);

                    // remove from the queue
                    getQueue().erase(getQueue().begin() + i);
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
                            << std::string(it.data(), it.size()) << " and "
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
                    getQueue().erase(getQueue().begin() + i);
                    continue;
                }

                ++i;
            }

            if (performedMerge)
            {
                std::size_t pre = tokens[0].size() + tokens[1].size() + tokens[2].size() + 3;
                std::size_t post = pre + tokens[3].size() + tokens[4].size() + tokens[5].size()
                              + tokens[6].size() + 4;

                std::string result = callbackMsg.substr(0, pre) + std::to_string(msgX) + ", "
                                     + std::to_string(msgY) + ", " + std::to_string(msgW) + ", "
                                     + std::to_string(msgH) + ", " + callbackMsg.substr(post);

                LOG_TRC("Merge result: " << result);

                return result;
            }
        }
        break;

        case LOK_CALLBACK_STATE_CHANGED: // state changed
        {
            if (tokens.size() < 4)
                return std::string();

            std::string unoCommand = extractUnoCommand(tokens[3]);
            if (unoCommand.empty())
                return std::string();

            // This is needed because otherwise it creates some problems when
            // a save occurs while a cell is still edited in Calc.
            if (unoCommand == ".uno:ModifiedStatus")
                return std::string();

            if (getQueue().empty())
                return std::string();

            // remove obsolete states of the same .uno: command
            isDuplicateCommand functor(unoCommand, tokens);
            for (std::size_t i = 0; i < getQueue().size(); ++i)
            {
                auto& it = getQueue()[i];

                StringVector::tokenize_foreach(functor, it.data(), it.size());

                if (functor.get_is_duplicate_command())
                {
                    LOG_TRC("Remove obsolete uno command: "
                            << std::string(it.data(), it.size()) << " -> "
                            << COOLProtocol::getAbbreviatedMessage(callbackMsg));
                    getQueue().erase(getQueue().begin() + i);
                    break;
                }
                functor.reset();
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
            const bool isViewCallback = (callbackType == LOK_CALLBACK_INVALIDATE_VIEW_CURSOR
                                         || callbackType == LOK_CALLBACK_CELL_VIEW_CURSOR
                                         || callbackType == LOK_CALLBACK_VIEW_CURSOR_VISIBLE);

            const std::string viewId
                = (isViewCallback ? extractViewId(callbackMsg, tokens) : std::string());

            for (std::size_t i = 0; i < getQueue().size(); ++i)
            {
                const auto& it = getQueue()[i];

                // skip non-callbacks quickly
                if (!COOLProtocol::matchPrefix("callback", it))
                    continue;

                StringVector queuedTokens = StringVector::tokenize(it.data(), it.size());
                if (queuedTokens.size() < 3)
                    continue;

                if (!isViewCallback
                    && (queuedTokens.equals(1, tokens, 1) && queuedTokens.equals(2, tokens, 2)))
                {
                    LOG_TRC("Remove obsolete callback: "
                            << std::string(it.data(), it.size()) << " -> "
                            << COOLProtocol::getAbbreviatedMessage(callbackMsg));
                    getQueue().erase(getQueue().begin() + i);
                    break;
                }
                else if (isViewCallback
                         && (queuedTokens.equals(1, tokens, 1)
                             && queuedTokens.equals(2, tokens, 2)))
                {
                    // we additionally need to ensure that the payload is about
                    // the same viewid (otherwise we'd merge them all views into
                    // one)
                    const std::string queuedViewId
                        = extractViewId(std::string(it.data(), it.size()), queuedTokens);

                    if (viewId == queuedViewId)
                    {
                        LOG_TRC("Remove obsolete view callback: "
                                << std::string(it.data(), it.size()) << " -> "
                                << COOLProtocol::getAbbreviatedMessage(callbackMsg));
                        getQueue().erase(getQueue().begin() + i);
                        break;
                    }
                }
            }
        }
        break;

        default:
        break;

    } // switch

    return std::string();
}

int TileQueue::priority(const std::string& tileMsg)
{
    TileDesc tile = TileDesc::parse(tileMsg); //FIXME: Expensive, avoid.

    for (int i = static_cast<int>(_viewOrder.size()) - 1; i >= 0; --i)
    {
        auto& cursor = _cursorPositions[_viewOrder[i]];
        if (tile.intersectsWithRect(cursor.getX(), cursor.getY(), cursor.getWidth(),
                                    cursor.getHeight()))
            return i;
    }

    return -1;
}

void TileQueue::deprioritizePreviews()
{
    for (size_t i = 0; i < getQueue().size(); ++i)
    {
        const Payload front = getQueue().front();
        const std::string message(front.data(), front.size());

        // stop at the first non-tile or non-'id' (preview) message
        std::string id;
        if (!COOLProtocol::matchPrefix("tile", message) ||
            !COOLProtocol::getTokenStringFromMessage(message, "id", id))
        {
            break;
        }

        getQueue().erase(getQueue().begin());
        getQueue().push_back(front);
    }
}

TileQueue::Payload TileQueue::get_impl()
{
    LOG_TRC("MessageQueue depth: " << getQueue().size());

    const Payload front = getQueue().front();

    std::string msg(front.data(), front.size());

    std::string id;
    bool isTile = COOLProtocol::matchPrefix("tile", msg);
    bool isPreview = isTile && COOLProtocol::getTokenStringFromMessage(msg, "id", id);
    if (!isTile || isPreview)
    {
        // Don't combine non-tiles or tiles with id.
        LOG_TRC("MessageQueue res: " << COOLProtocol::getAbbreviatedMessage(msg));
        getQueue().erase(getQueue().begin());

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
    for (size_t i = 0; i < getQueue().size(); ++i)
    {
        auto& it = getQueue()[i];
        const std::string prio(it.data(), it.size());

        // avoid starving - stop the search when we reach a non-tile,
        // otherwise we may keep growing the queue of unhandled stuff (both
        // tiles and non-tiles)
        if (!COOLProtocol::matchPrefix("tile", prio) ||
            COOLProtocol::getTokenStringFromMessage(prio, "id", id))
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

    getQueue().erase(getQueue().begin() + prioritized);

    std::vector<TileDesc> tiles;
    tiles.emplace_back(TileDesc::parse(msg));

    // Combine as many tiles as possible with the top one.
    for (size_t i = 0; i < getQueue().size(); )
    {
        auto& it = getQueue()[i];
        msg = std::string(it.data(), it.size());
        if (!COOLProtocol::matchPrefix("tile", msg) ||
            COOLProtocol::getTokenStringFromMessage(msg, "id", id))
        {
            // Don't combine non-tiles or tiles with id.
            ++i;
            continue;
        }

        TileDesc tile2 = TileDesc::parse(msg);
        LOG_TRC("Combining candidate: " << COOLProtocol::getAbbreviatedMessage(msg));

        // Check if it's on the same row.
        if (tiles[0].canCombine(tile2))
        {
            tiles.emplace_back(tile2);
            getQueue().erase(getQueue().begin() + i);
        }
        else
        {
            ++i;
        }
    }

    LOG_TRC("Combined " << tiles.size() << " tiles, leaving " << getQueue().size() << " in queue.");

    if (tiles.size() == 1)
    {
        msg = tiles[0].serialize("tile");
        LOG_TRC("MessageQueue res: " << COOLProtocol::getAbbreviatedMessage(msg));
        return Payload(msg.data(), msg.data() + msg.size());
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
                LOG_TRC("MessageQueue: dropping duplicate tile: " <<
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
    std::string tileCombined = combined.serialize("tilecombine");
    LOG_TRC("MessageQueue res: " << COOLProtocol::getAbbreviatedMessage(tileCombined));
    return Payload(tileCombined.data(), tileCombined.data() + tileCombined.size());
}

void TileQueue::dumpState(std::ostream& oss)
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
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
