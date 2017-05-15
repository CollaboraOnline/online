/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include "Session.hpp"

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
#include <Poco/Path.h>
#include <Poco/String.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include "Common.hpp"
#include "IoUtil.hpp"
#include "Protocol.hpp"
#include "Log.hpp"
#include "TileCache.hpp"
#include "Util.hpp"
#include "Unit.hpp"

using namespace LOOLProtocol;

using Poco::Exception;

Session::Session(const std::string& name, const std::string& id, bool readOnly) :
    _id(id),
    _name(name),
    _disconnected(false),
    _isActive(true),
    _lastActivityTime(std::chrono::steady_clock::now()),
    _isCloseFrame(false),
    _isReadOnly(readOnly),
    _docPassword(""),
    _haveDocPassword(false),
    _isDocPasswordProtected(false)
{
}

Session::~Session()
{
}

bool Session::sendTextFrame(const char* buffer, const int length)
{
    LOG_TRC(getName() << ": Send: [" << getAbbreviatedMessage(buffer, length) << "].");
    return sendMessage(buffer, length, WSOpCode::Text) >= length;
}

bool Session::sendBinaryFrame(const char *buffer, int length)
{
    LOG_TRC(getName() << ": Send: " << std::to_string(length) << " binary bytes.");
    return sendMessage(buffer, length, WSOpCode::Binary) >= length;
}

void Session::parseDocOptions(const std::vector<std::string>& tokens, int& part, std::string& timestamp)
{
    // First token is the "load" command itself.
    size_t offset = 1;
    if (tokens.size() > 2 && tokens[1].find("part=") == 0)
    {
        getTokenInteger(tokens[1], "part", part);
        ++offset;
    }

    for (size_t i = offset; i < tokens.size(); ++i)
    {
        // FIXME use any kind of startsWith() instead of find(...) == 0
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
        else if (tokens[i].find("readonly=") == 0)
        {
            _isReadOnly = tokens[i].substr(strlen("readonly=")) != "0";
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
        else if (tokens[i].find("lang=") == 0)
        {
            _lang = tokens[i].substr(strlen("lang="));
            ++offset;
        }
    }

    if (tokens.size() > offset)
    {
        if (getTokenString(tokens[offset], "options", _docOptions))
        {
            if (tokens.size() > offset + 1)
                _docOptions += Poco::cat(std::string(" "), tokens.begin() + offset + 1, tokens.end());
        }
    }
}

void Session::disconnect()
{
    if (!_disconnected)
    {
        _disconnected = true;
        shutdown();
    }
}

bool Session::handleDisconnect()
{
    _disconnected = true;
    shutdown();
    return false;
}

void Session::shutdown(const WebSocketHandler::StatusCodes statusCode, const std::string& statusMessage)
{
    LOG_TRC("Shutting down WS [" << getName() << "] with statusCode [" <<
            static_cast<unsigned>(statusCode) << "] and reason [" << statusMessage << "].");

    // See protocol.txt for this application-level close frame.
    const std::string msg = "close: " + statusMessage;
    sendTextFrame(msg.data(), msg.size());

    WebSocketHandler::shutdown(statusCode, statusMessage);
}

void Session::handleMessage(bool /*fin*/, WSOpCode /*code*/, std::vector<char> &data)
{
    try
    {
        std::unique_ptr< std::vector<char> > replace;
        if (UnitBase::get().filterSessionInput(this, &data[0], data.size(), replace))
        {
            _handleInput(replace->data(), replace->size());
            return;
        }

        if (!data.empty())
            _handleInput(&data[0], data.size());
    }
    catch (const Exception& exc)
    {
        LOG_ERR("Session::handleInput: Exception while handling [" <<
                getAbbreviatedMessage(data) <<
                "] in " << getName() << ": " << exc.displayText() <<
                (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Session::handleInput: Exception while handling [" <<
                getAbbreviatedMessage(data) << "]: " << exc.what());
    }
}

void Session::dumpState(std::ostream& os)
{
    WebSocketHandler::dumpState(os);

    os <<   "\t\tid: " << _id
       << "\n\t\tname: " << _name
       << "\n\t\tdisconnected: " << _disconnected
       << "\n\t\tisActive: " << _isActive
       << "\n\t\tisCloseFrame: " << _isCloseFrame
       << "\n\t\tisReadOnly: " << _isReadOnly
       << "\n\t\tdocURL: " << _docURL
       << "\n\t\tjailedFilePath: " << _jailedFilePath
       << "\n\t\tdocPwd: " << _docPassword
       << "\n\t\thaveDocPwd: " << _haveDocPassword
       << "\n\t\tisDocPwdProtected: " << _isDocPasswordProtected
       << "\n\t\tDocOptions: " << _docOptions
       << "\n\t\tuserId: " << _userId
       << "\n\t\tuserName: " << _userName
       << "\n\t\tlang: " << _lang
       << "\n";
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
