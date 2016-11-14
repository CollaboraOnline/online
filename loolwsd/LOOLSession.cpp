/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "LOOLSession.hpp"
#include "config.h"

#include <sys/stat.h>
#include <sys/types.h>
#include <ftw.h>
#include <utime.h>

#include <cassert>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <map>
#include <memory>
#include <mutex>
#include <set>

#include <Poco/Exception.h>
#include <Poco/Net/Socket.h>
#include <Poco/Path.h>
#include <Poco/String.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include "Common.hpp"
#include "IoUtil.hpp"
#include "LOOLProtocol.hpp"
#include <LOOLWebSocket.hpp>
#include "Log.hpp"
#include "TileCache.hpp"
#include "Util.hpp"

using namespace LOOLProtocol;

using Poco::Exception;
using Poco::IOException;
using Poco::Net::Socket;
using Poco::Net::WebSocket;
using Poco::StringTokenizer;

LOOLSession::LOOLSession(const std::string& id, const Kind kind,
                         std::shared_ptr<LOOLWebSocket> ws) :
    _id(id),
    _kind(kind),
    _kindString(kind == Kind::ToClient ? "ToClient" :
                kind == Kind::ToMaster ? "ToMaster" : "ToPrisoner"),
    _name(_kindString + '-' + id),
    _ws(std::move(ws)),
    _disconnected(false),
    _isActive(true),
    _lastActivityTime(std::chrono::steady_clock::now()),
    _isCloseFrame(false),
    _mutex(),
    _docPassword(""),
    _haveDocPassword(false),
    _isDocPasswordProtected(false)
{
}

LOOLSession::~LOOLSession()
{
}

bool LOOLSession::sendTextFrame(const char* buffer, const int length)
{
    LOG_TRC(getName() << ": Send: " << getAbbreviatedMessage(buffer, length));
    try
    {
        std::unique_lock<std::mutex> lock(_mutex);

        if (!_ws || _ws->poll(Poco::Timespan(0), Socket::SelectMode::SELECT_ERROR))
        {
            LOG_ERR(getName() << ": Bad socket while sending [" << getAbbreviatedMessage(buffer, length) << "].");
            return false;
        }

        _ws->sendFrame(buffer, length);
        return true;
    }
    catch (const Exception& exc)
    {
        LOG_ERR("LOOLSession::sendTextFrame: Exception: " << exc.displayText() <<
                (exc.nested() ? "( " + exc.nested()->displayText() + ")" : ""));
    }

    return false;
}

bool LOOLSession::sendBinaryFrame(const char *buffer, int length)
{
    LOG_TRC(getName() << ": Send: " << std::to_string(length) << " bytes.");
    try
    {
        std::unique_lock<std::mutex> lock(_mutex);

        if (!_ws || _ws->poll(Poco::Timespan(0), Socket::SelectMode::SELECT_ERROR))
        {
            LOG_ERR(getName() << ": Bad socket while sending binary frame of " << length << " bytes.");
            return false;
        }

        _ws->sendFrame(buffer, length, WebSocket::FRAME_BINARY);
        return true;
    }
    catch (const Exception& exc)
    {
        LOG_ERR("LOOLSession::sendBinaryFrame: Exception: " << exc.displayText() <<
                (exc.nested() ? "( " + exc.nested()->displayText() + ")" : ""));
    }

    return false;
}

void LOOLSession::parseDocOptions(const StringTokenizer& tokens, int& part, std::string& timestamp)
{
    // First token is the "load" command itself.
    size_t offset = 1;
    if (tokens.count() > 2 && tokens[1].find("part=") == 0)
    {
        getTokenInteger(tokens[1], "part", part);
        ++offset;
    }

    for (size_t i = offset; i < tokens.count(); ++i)
    {
        if (tokens[i].find("url=") == 0)
        {
            _docURL = tokens[i].substr(strlen("url="));
            ++offset;
        }
        else if (tokens[i].find("jail=") == 0)
        {
            _jailedFilePath = tokens[i].substr(strlen("jail="));
            ++offset;
        }
        else if (tokens[i].find("authorid=") == 0)
        {
            std::string userId = tokens[i].substr(strlen("authorid="));
            Poco::URI::decode(userId, _userId);
            ++offset;
        }
        else if (tokens[i].find("author=") == 0)
        {
            std::string userName = tokens[i].substr(strlen("author="));
            Poco::URI::decode(userName, _userName);
            ++offset;
        }
        else if (tokens[i].find("timestamp=") == 0)
        {
            timestamp = tokens[i].substr(strlen("timestamp="));
            ++offset;
        }
        else if (tokens[i].find("password=") == 0)
        {
            _docPassword = tokens[i].substr(strlen("password="));
            _haveDocPassword = true;
            ++offset;
        }
    }

    if (tokens.count() > offset)
    {
        if (getTokenString(tokens[offset], "options", _docOptions))
        {
            if (tokens.count() > offset + 1)
                _docOptions += Poco::cat(std::string(" "), tokens.begin() + offset + 1, tokens.end());
        }
    }
}

void LOOLSession::disconnect()
{
    try
    {
        if (!_disconnected)
        {
            _disconnected = true;
            IoUtil::shutdownWebSocket(_ws);
        }
    }
    catch (const IOException& exc)
    {
        LOG_ERR("LOOLSession::disconnect: Exception: " << exc.displayText() <<
                (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
    }
}

bool LOOLSession::handleDisconnect()
{
    _disconnected = true;
    IoUtil::shutdownWebSocket(_ws);
    return false;
}

void LOOLSession::shutdown(Poco::UInt16 statusCode, const std::string& statusMessage)
{
    if (_ws)
    {
        try
        {
            LOG_TRC("Shutting down WS [" << getName() << "] with statusCode [" << statusCode << "] and reason [" << statusMessage << "].");
            _ws->shutdown(statusCode, statusMessage);
        }
        catch (const Poco::Exception &exc)
        {
            LOG_WRN("LOOLSession::shutdown LOOLWebSocket: Exception: " <<
                    exc.displayText() << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
        }
    }
}

bool LOOLSession::handleInput(const char *buffer, int length)
{
    assert(buffer != nullptr);

    const auto summary = getAbbreviatedMessage(buffer, length);
    try
    {
        LOG_TRC(getName() << ": Recv: " << summary);

        return _handleInput(buffer, length);
    }
    catch (const Exception& exc)
    {
        LOG_ERR("LOOLSession::handleInput: Exception while handling [" << summary <<
                "] in " << getName() << ": " << exc.displayText() <<
                (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("LOOLSession::handleInput: Exception while handling [" << summary << "]: " << exc.what());
    }

    return false;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
