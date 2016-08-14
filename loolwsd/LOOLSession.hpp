/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLSESSION_HPP
#define INCLUDED_LOOLSESSION_HPP

#include <atomic>
#include <cassert>
#include <memory>
#include <mutex>
#include <ostream>

#include <Poco/Net/WebSocket.h>
#include <Poco/Buffer.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Types.h>

#include "MessageQueue.hpp"
#include "TileCache.hpp"

class LOOLSession
{
public:
    /// We have three kinds of Websocket sessions
    /// 1) Between the master loolwsd server to the end-user LOOL client
    /// 2) Between the master loolwsd server and a jailed child process, in the master process
    /// 3) Ditto, in the jailed process
    enum class Kind { ToClient, ToPrisoner, ToMaster };

    const std::string& getId() const { return _id; }
    const std::string& getName() const { return _name; }
    bool isDisconnected() const { return _disconnected; }

    void sendTextFrame(const std::string& text);
    void sendBinaryFrame(const char *buffer, int length);

    virtual bool getStatus(const char *buffer, int length) = 0;

    virtual bool getCommandValues(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    virtual bool getPartPageRectangles(const char *buffer, int length) = 0;

    bool handleInput(const char *buffer, int length);

    /// Invoked when we want to disconnect a session.
    virtual void disconnect();

    /// Called to handle disconnection command from socket.
    virtual bool handleDisconnect();

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

    Kind getKind() const { return _kind; }

protected:
    LOOLSession(const std::string& id, const Kind kind,
                std::shared_ptr<Poco::Net::WebSocket> ws);
    virtual ~LOOLSession();

    void setId(const std::string& id)
    {
        _id = id;
        _name = _kindString + '-' + id;
    }

    /// Parses the options of the "load" command, shared between MasterProcessSession::loadDocument() and ChildProcessSession::loadDocument().
    void parseDocOptions(const Poco::StringTokenizer& tokens, int& part, std::string& timestamp);

    virtual bool loadDocument(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    virtual void sendFontRendering(const char *buffer, int length, Poco::StringTokenizer& tokens) = 0;

    void updateLastActivityTime()
    {
        _lastActivityTime = std::chrono::steady_clock::now();
    }

    // Fields common to sessions in master and jailed processes:

    // Our kind signifies to what we are connected to.
    const Kind _kind;

    // The kind cached as a string.
    const std::string _kindString;

    // In the master process, the websocket to the LOOL client or the jailed child process. In a
    // jailed process, the websocket to the parent.
    std::shared_ptr<Poco::Net::WebSocket> _ws;

    // The actual URL, also in the child, even if the child never accesses that.
    std::string _docURL;

    // The Jailed document path.
    std::string _jailedFilePath;

    // Password provided, if any, to open the document
    std::string _docPassword;

    // If password is provided or not
    bool _haveDocPassword;

    // Whether document has been opened succesfuly
    bool _isDocLoaded;

    // Whether document is password protected
    bool _isDocPasswordProtected;

    /// Document options: a JSON string, containing options (rendering, also possibly load in the future).
    std::string _docOptions;

    // Whether websocket received close frame.  Closing Handshake
    std::atomic<bool> _isCloseFrame;

    /// Name of the user to whom the session belongs to
    std::string _userName;

private:

    virtual bool _handleInput(const char *buffer, int length) = 0;

private:
    /// A session ID specific to an end-to-end connection (from user to lokit).
    std::string _id;
    /// A readable name that identifies our peer and ID.
    std::string _name;
    /// True if we have been disconnected.
    bool _disconnected;
    /// True if the user is active, otherwise false (switched tabs).
    bool _isActive;

    std::chrono::steady_clock::time_point _lastActivityTime;

    std::mutex _mutex;

    static constexpr auto InactivityThresholdMS = 120 * 1000;
};

template<typename charT, typename traits>
inline std::basic_ostream<charT, traits> & operator <<(std::basic_ostream<charT, traits> & stream, LOOLSession::Kind kind)
{
    switch (kind)
    {
    case LOOLSession::Kind::ToClient:
        return stream << "TO_CLIENT";
    case LOOLSession::Kind::ToPrisoner:
        return stream << "TO_PRISONER";
    case LOOLSession::Kind::ToMaster:
        return stream << "TO_MASTER";
    default:
        assert(false);
        return stream << "UNK_" + std::to_string(static_cast<int>(kind));
    }
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
