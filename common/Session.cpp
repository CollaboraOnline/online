/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "Session.hpp"

#include <Poco/Exception.h>
#include <Poco/Path.h>
#include <Poco/String.h>
#include <Poco/URI.h>

#include "Common.hpp"
#include "Protocol.hpp"
#include "Log.hpp"
#include "Util.hpp"

using namespace COOLProtocol;

using Poco::Exception;

Session::Session(const std::shared_ptr<ProtocolHandlerInterface> &protocol,
                 const std::string& name, const std::string& id, bool readOnly) :
    MessageHandlerInterface(protocol),
    _id(id),
    _name(name),
    _disconnected(false),
    _isActive(true),
    _lastActivityTime(std::chrono::steady_clock::now()),
    _isCloseFrame(false),
    _isWritable(readOnly),
    _isReadOnly(readOnly),
    _isAllowChangeComments(false),
    _haveDocPassword(false),
    _isDocPasswordProtected(false),
    _watermarkOpacity(0.2),
    _enableAccessibility(false)
{
}

Session::~Session()
{
}

bool Session::sendTextFrame(const char* buffer, const int length)
{
    if (!_protocol)
    {
        LOG_TRC("ERR - missing protocol " << getName() << ": Send: ["
                                          << getAbbreviatedMessage(buffer, length) << ']');
        return false;
    }

    LOG_TRC("Send: [" << getAbbreviatedMessage(buffer, length) << ']');
    return _protocol->sendTextMessage(buffer, length) >= length;
}

bool Session::sendBinaryFrame(const char *buffer, int length)
{
    if (!_protocol)
    {
        LOG_TRC("ERR - missing protocol " << getName() << ": Send: " << std::to_string(length)
                                          << " binary bytes");
        return false;
    }

    LOG_TRC("Send: " << std::to_string(length) << " binary bytes");
    return _protocol->sendBinaryMessage(buffer, length) >= length;
}

void Session::parseDocOptions(const StringVector& tokens, int& part, std::string& timestamp, std::string& doctemplate)
{
    // First token is the "load" command itself.
    std::size_t offset = 1;
    if (tokens.size() > 2 && tokens[1].find("part=") == 0)
    {
        getTokenInteger(tokens[1], "part", part);
        ++offset;
    }

    for (std::size_t i = offset; i < tokens.size(); ++i)
    {
        std::string name;
        std::string value;
        if (!COOLProtocol::parseNameValuePair(tokens[i], name, value))
        {
            LOG_WRN("Unexpected doc options token [" << tokens[i] << "]. Skipping.");
            continue;
        }

        if (name == "url")
        {
            _docURL = value;
            ++offset;
        }
        else if (name == "jail")
        {
            _jailedFilePath = value;
            ++offset;
        }
        else if (name == "xjail")
        {
            _jailedFilePathAnonym = value;
            ++offset;
        }
        else if (name == "authorid")
        {
            Poco::URI::decode(value, _userId);
            ++offset;
        }
        else if (name == "xauthorid")
        {
            Poco::URI::decode(value, _userIdAnonym);
            ++offset;
        }
        else if (name == "author")
        {
            Poco::URI::decode(value, _userName);
            ++offset;
        }
        else if (name == "xauthor")
        {
            Poco::URI::decode(value, _userNameAnonym);
            ++offset;
        }
        else if (name == "authorextrainfo")
        {
            Poco::URI::decode(value, _userExtraInfo);
            ++offset;
        }
        else if (name == "authorprivateinfo")
        {
            Poco::URI::decode(value, _userPrivateInfo);
            ++offset;
        }
        else if (name == "readonly")
        {
            _isReadOnly = value != "0";
            ++offset;
        }
        else if (name == "password")
        {
            _docPassword = value;
            _haveDocPassword = true;
            ++offset;
        }
        else if (name == "lang")
        {
            if (value == "en")
                _lang = "en-US";
            else
                _lang = value;
            ++offset;
        }
        else if (name == "timezone")
        {
            _timezone= value;
            ++offset;
        }
        else if (name == "watermarkText")
        {
            Poco::URI::decode(value, _watermarkText);
            ++offset;
        }
        else if (name == "watermarkOpacity")
        {
            _watermarkOpacity = std::stod(value);
            ++offset;
        }
        else if (name == "timestamp")
        {
            timestamp = value;
            ++offset;
        }
        else if (name == "template")
        {
            doctemplate = value;
            ++offset;
        }
        else if (name == "deviceFormFactor")
        {
            _deviceFormFactor = value;
            ++offset;
        }
        else if (name == "spellOnline")
        {
            _spellOnline = value;
            ++offset;
        }
        else if (name == "batch")
        {
            _batch = value;
            ++offset;
        }
        else if (name == "enableMacrosExecution")
        {
            _enableMacrosExecution = value;
            ++offset;
        }
        else if (name == "macroSecurityLevel")
        {
            _macroSecurityLevel = value;
            ++offset;
        }
        else if (name == "enableAccessibility")
        {
            _enableAccessibility = value == "true";
            ++offset;
        }
    }

    Util::mapAnonymized(_userId, _userIdAnonym);
    Util::mapAnonymized(_userName, _userNameAnonym);
    Util::mapAnonymized(_jailedFilePath, _jailedFilePathAnonym);

    if (tokens.size() > offset)
    {
        if (getTokenString(tokens[offset], "options", _docOptions))
        {
            if (tokens.size() > offset + 1)
                _docOptions += tokens.cat(' ', offset + 1);
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

void Session::shutdown(bool goingAway, const std::string& statusMessage)
{
    LOG_TRC("Shutting down WS [" << getName() << "] " << (goingAway ? "going" : "normal")
                                 << " and reason [" << statusMessage << ']');

    // See protocol.txt for this application-level close frame.
    if (_protocol)
    {
        // skip the queue; FIXME: should we flush SessionClient's queue ?
        std::string closeMsg = "close: " + statusMessage;
        _protocol->sendTextMessage(closeMsg.c_str(), closeMsg.size());
        _protocol->shutdown(goingAway, statusMessage);
    }
}

void Session::handleMessage(const std::vector<char> &data)
{
    try
    {
        std::unique_ptr< std::vector<char> > replace;
        if (UnitBase::isUnitTesting() && !Util::isFuzzing() && UnitBase::get().filterSessionInput(this, &data[0], data.size(), replace))
        {
            if (!replace || replace->empty())
                _handleInput(replace->data(), replace->size());
            return;
        }

        if (!data.empty())
            _handleInput(&data[0], data.size());
    }
    catch (const Exception& exc)
    {
        LOG_ERR("Exception while handling ["
                << getAbbreviatedMessage(data) << "] in " << getName() << ": " << exc.displayText()
                << (exc.nested() ? " (" + exc.nested()->displayText() + ')' : ""));
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Exception while handling [" << getAbbreviatedMessage(data) << "]: " << exc.what());
    }
}

void Session::getIOStats(uint64_t &sent, uint64_t &recv)
{
    if (!_protocol)
    {
        LOG_TRC("ERR - missing protocol " << getName() << ": Get IO stats.");
        sent = 0; recv = 0;
        return;
    }

    _protocol->getIOStats(sent, recv);
}

void Session::dumpState(std::ostream& os)
{
    os << "\n\t\tid: " << _id
       << "\n\t\tname: " << _name
       << "\n\t\tdisconnected: " << _disconnected
       << "\n\t\tisActive: " << _isActive
       << "\n\t\tisCloseFrame: " << _isCloseFrame
       << "\n\t\tisWritable: " << _isWritable
       << "\n\t\tisReadOnly: " << _isReadOnly
       << "\n\t\tisAllowChangeComments: " << _isAllowChangeComments
       << "\n\t\tisEditable: " << isEditable()
       << "\n\t\tdocURL: " << _docURL
       << "\n\t\tjailedFilePath: " << _jailedFilePath
       << "\n\t\tdocPwd: " << _docPassword
       << "\n\t\thaveDocPwd: " << _haveDocPassword
       << "\n\t\tisDocPwdProtected: " << _isDocPasswordProtected
       << "\n\t\tDocOptions: " << _docOptions
       << "\n\t\tuserId: " << _userId
       << "\n\t\tuserName: " << _userName
       << "\n\t\tlang: " << _lang
       << "\n\t\ttimezone: " << _timezone
       << '\n';
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
