/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_SESSION_HPP
#define INCLUDED_SESSION_HPP

#include <atomic>
#include <cassert>
#include <memory>
#include <mutex>
#include <ostream>

#include <Poco/Buffer.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Types.h>

#include "Protocol.hpp"
#include "Log.hpp"
#include "MessageQueue.hpp"
#include "Message.hpp"
#include "TileCache.hpp"
#include "WebSocketHandler.hpp"

/// Base class of a WebSocket session.
class Session : public WebSocketHandler
{
public:
    const std::string& getId() const { return _id; }
    const std::string& getName() const { return _name; }
    bool isDisconnected() const { return _disconnected; }

    virtual bool sendBinaryFrame(const char* buffer, int length);
    virtual bool sendTextFrame(const char* buffer, const int length);
    bool sendTextFrame(const std::string& text)
    {
        return sendTextFrame(text.data(), text.size());
    }

    virtual void handleMessage(bool fin, WSOpCode code, std::vector<char> &data) override;

    /// Invoked when we want to disconnect a session.
    virtual void disconnect();

    /// Called to handle disconnection command from socket.
    virtual bool handleDisconnect();

    void shutdown(const WebSocketHandler::StatusCodes statusCode = WebSocketHandler::StatusCodes::NORMAL_CLOSE,
                  const std::string& statusMessage = "");

    bool isActive() const { return _isActive; }
    void setIsActive(bool active) { _isActive = active; }

    /// Returns the inactivity time of the client in milliseconds.
    double getInactivityMS() const
    {
        const auto duration = (std::chrono::steady_clock::now() - _lastActivityTime);
        return std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
    }

    void closeFrame() { _isCloseFrame = true; };
    bool isCloseFrame() const { return _isCloseFrame; }

protected:
    Session(const std::string& name, const std::string& id);
    virtual ~Session();

    /// Parses the options of the "load" command, shared between MasterProcessSession::loadDocument() and ChildProcessSession::loadDocument().
    void parseDocOptions(const std::vector<std::string>& tokens, int& part, std::string& timestamp);

    void updateLastActivityTime()
    {
        _lastActivityTime = std::chrono::steady_clock::now();
    }

    /// Internal lock shared with derived classes.
    std::unique_lock<std::mutex> getLock()
    {
        return std::unique_lock<std::mutex>(_mutex);
    }

private:
    virtual bool _handleInput(const char* buffer, int length) = 0;

private:
    /// A session ID specific to an end-to-end connection (from user to lokit).
    const std::string _id;

    /// A readable name that identifies our peer and ID.
    const std::string _name;

    /// True if we have been disconnected.
    std::atomic<bool> _disconnected;
    /// True if the user is active, otherwise false (switched tabs).
    std::atomic<bool> _isActive;

    std::chrono::steady_clock::time_point _lastActivityTime;

    // Whether websocket received close frame.  Closing Handshake
    std::atomic<bool> _isCloseFrame;

    std::mutex _mutex;

protected:
    /// The actual URL, also in the child, even if the child never accesses that.
    std::string _docURL;

    /// The Jailed document path.
    std::string _jailedFilePath;

    /// Password provided, if any, to open the document
    std::string _docPassword;

    /// If password is provided or not
    bool _haveDocPassword;

    /// Whether document is password protected
    bool _isDocPasswordProtected;

    /// Document options: a JSON string, containing options (rendering, also possibly load in the future).
    std::string _docOptions;

    /// Id of the user to whom the session belongs to
    std::string _userId;

    /// Name of the user to whom the session belongs to
    std::string _userName;

    /// Language for the document based on what the user has in the UI.
    std::string _lang;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
