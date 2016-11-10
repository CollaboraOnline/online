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

#include <Poco/Buffer.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Types.h>

#include "LOOLProtocol.hpp"
#include <LOOLWebSocket.hpp>
#include "Log.hpp"
#include "MessageQueue.hpp"
#include "TileCache.hpp"

/// Base class of a LOOLWebSocket session.
class LOOLSession
{
public:
    /// We have three kinds of Websocket sessions
    /// 1) Between the master loolwsd server to the end-user LOOL client
    /// 2) Between the master loolwsd server and a jailed child process, in the master process
    /// 3) Ditto, in the jailed process
    enum class Kind
    {
        ToClient,
        ToPrisoner,
        ToMaster
    };

    const std::string& getId() const { return _id; }
    const std::string& getName() const { return _name; }
    bool isDisconnected() const { return _disconnected; }

    virtual bool sendBinaryFrame(const char* buffer, int length);
    virtual bool sendTextFrame(const char* buffer, const int length);
    bool sendTextFrame(const std::string& text)
    {
        return sendTextFrame(text.data(), text.size());
    }

    bool handleInput(const char* buffer, int length);

    /// Invoked when we want to disconnect a session.
    virtual void disconnect();

    /// Called to handle disconnection command from socket.
    virtual bool handleDisconnect();

    void shutdown(Poco::UInt16 statusCode, const std::string& statusMessage = "");

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

    bool isHeadless() const { return _ws == nullptr; }

protected:
    LOOLSession(const std::string& id, const Kind kind,
                std::shared_ptr<LOOLWebSocket> ws);
    virtual ~LOOLSession();

    /// Parses the options of the "load" command, shared between MasterProcessSession::loadDocument() and ChildProcessSession::loadDocument().
    void parseDocOptions(const Poco::StringTokenizer& tokens, int& part, std::string& timestamp);

    void updateLastActivityTime()
    {
        _lastActivityTime = std::chrono::steady_clock::now();
    }

    template <typename T>
    bool forwardToPeer(T& p, const char* buffer, int length, const bool binary)
    {
        const auto message = LOOLProtocol::getAbbreviatedMessage(buffer, length);

        auto peer = p.lock();
        if (!peer)
        {
            throw Poco::ProtocolException(getName() + ": no peer to forward to: [" + message + "].");
        }
        else if (peer->isCloseFrame())
        {
            LOG_TRC(getName() << ": peer began the closing handshake. Dropping forward message [" << message << "].");
            return true;
        }
        else if (peer->isHeadless())
        {
            // Fail silently and return as there is no actual websocket
            // connection in this case.
            LOG_INF(getName() << ": Headless peer, not forwarding message [" << message << "].");
            return true;
        }

        LOG_TRC(getName() << " -> " << peer->getName() << ": " << message);
        return binary ? peer->sendBinaryFrame(buffer, length)
                      : peer->sendTextFrame(buffer, length);
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

    // Our kind signifies to what we are connected to.
    const Kind _kind;

    // The kind cached as a string.
    const std::string _kindString;

    /// A readable name that identifies our peer and ID.
    const std::string _name;

    // In the master process, the websocket to the LOOL client or the jailed child process. In a
    // jailed process, the websocket to the parent.
    std::shared_ptr<LOOLWebSocket> _ws;

    /// True if we have been disconnected.
    std::atomic<bool> _disconnected;
    /// True if the user is active, otherwise false (switched tabs).
    std::atomic<bool> _isActive;

    std::chrono::steady_clock::time_point _lastActivityTime;

    // Whether websocket received close frame.  Closing Handshake
    std::atomic<bool> _isCloseFrame;

    std::mutex _mutex;

protected:
    // The actual URL, also in the child, even if the child never accesses that.
    std::string _docURL;

    // The Jailed document path.
    std::string _jailedFilePath;

    // Password provided, if any, to open the document
    std::string _docPassword;

    // If password is provided or not
    bool _haveDocPassword;

    // Whether document is password protected
    bool _isDocPasswordProtected;

    /// Document options: a JSON string, containing options (rendering, also possibly load in the future).
    std::string _docOptions;

    /// Id of the user to whom the session belongs to
    std::string _userId;

    /// Name of the user to whom the session belongs to
    std::string _userName;
};

template <typename charT, typename traits>
inline std::basic_ostream<charT, traits>& operator<<(std::basic_ostream<charT, traits>& stream, LOOLSession::Kind kind)
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
