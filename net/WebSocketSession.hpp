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

#include <chrono>
#include <cstdint>
#include <iostream>
#include <fstream>
#include <memory>
#include <condition_variable>
#include <mutex>
#include <sstream>
#include <string>

#include "Common.hpp"
#include <common/MessageQueue.hpp>
#include "NetUtil.hpp"
#include "SigUtil.hpp"
#include <net/Socket.hpp>
#include <net/HttpRequest.hpp>
#include <net/WebSocketHandler.hpp>
#include <utility>
#if ENABLE_SSL
#include <net/SslSocket.hpp>
#endif
#include "Log.hpp"
#include "Util.hpp"

// This is a partial implementation of RFC 6455
// The WebSocket Protocol.

namespace http
{
/// A client socket for asynchronous Web-Socket protocol.
class WebSocketSession final : public WebSocketHandler
{
public:
    enum class Protocol
    {
        HttpUnencrypted,
        HttpSsl,
    };

private:
    WebSocketSession(const std::string& hostname, Protocol protocolType, int portNumber)
        : WebSocketHandler(/* isClient = */ true, /* isMasking = */ true)
        , _host(hostname)
        , _port(std::to_string(portNumber))
        , _protocol(protocolType)
        , _disconnected(true)
        , _shutdown(false)
    {
    }

    /// Returns the given protocol's scheme.
    static const char* getProtocolScheme(Protocol protocol)
    {
        switch (protocol)
        {
            case Protocol::HttpUnencrypted:
                return "ws";
            case Protocol::HttpSsl:
                return "wss";
        }

        return "";
    }

public:
    /// Destroy WebSocketSession.
    /// Note: must never be called with the owning poll thread still active.
    ~WebSocketSession() { shutdown(); }

    /// Create a new HTTP WebSocketSession to the given host.
    /// The port defaults to the protocol's default port.
    static std::shared_ptr<WebSocketSession> create(const std::string& host, Protocol protocol,
                                                    int port = 0)
    {
        port = (port > 0 ? port : getDefaultPort(protocol));
        return std::shared_ptr<WebSocketSession>(new WebSocketSession(host, protocol, port));
    }

    /// Create a new HTTP WebSocketSession to the given URI.
    /// The @uri must include the scheme, e.g. https://domain.com:9980
    static std::shared_ptr<WebSocketSession> create(const std::string& uri)
    {
        std::string scheme;
        std::string host;
        std::string port;
        if (!net::parseUri(uri, scheme, host, port))
        {
            LOG_ERR_S("Invalid URI while creating WebSocketSession: " << uri);
            return nullptr;
        }

        const std::string lowerScheme = Util::toLower(scheme);
        if (!Util::startsWith(lowerScheme, "http") && !Util::startsWith(lowerScheme, "ws"))
        {
            LOG_ERR_S("Unsupported scheme in URI while creating WebSocketSession: " << uri);
            return nullptr;
        }

        const bool secure
            = Util::startsWith(lowerScheme, "https") || Util::startsWith(lowerScheme, "wss");

        const int portInt = port.empty() ? 0 : std::stoi(port);
        return create(host, secure ? Protocol::HttpSsl : Protocol::HttpUnencrypted, portInt);
    }

    /// Create a WebSocketSession and make a request to given @url.
    static std::shared_ptr<WebSocketSession> create(const std::shared_ptr<SocketPoll>& socketPoll,
                                                    const std::string& uri, const std::string& url)
    {
        auto session = create(uri);
        if (session)
        {
            http::Request req(url);
            session->asyncRequest(req, socketPoll);
        }

        return session;
    }

    /// Returns the given protocol's default port.
    static int getDefaultPort(Protocol protocol)
    {
        switch (protocol)
        {
            case Protocol::HttpUnencrypted:
                return 80;
            case Protocol::HttpSsl:
                return 443;
        }

        return 0;
    }

    /// Returns the current protocol scheme.
    const char* getProtocolScheme() const { return getProtocolScheme(_protocol); }

    const std::string& host() const { return _host; }
    const std::string& port() const { return _port; }
    Protocol protocol() const { return _protocol; }
    bool secure() const { return _protocol == Protocol::HttpSsl; }

    bool asyncRequest(http::Request& req, const std::shared_ptr<SocketPoll>& socketPoll)
    {
        LOG_TRC("asyncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                 << req.getUrl());

        if (!socketPoll)
        {
            LOG_ERR("Invalid SocketPoll instance while creating asyncRequest in WebSocketSession.");
            return false;
        }

        _socketPoll = socketPoll;
        return wsRequest(req, host(), port(), secure(), *socketPoll);
    }

    /// Poll for messages and invoke the given callback.
    /// Returns only when the callback returns true, or,
    /// when no new messages are received within the given timeout.
    std::vector<char> poll(const std::function<bool(const std::vector<char>&)>& cb,
                           std::chrono::milliseconds timeout,
                           const std::string& context = std::string())
    {
        LOG_DBG(context << "Polling for " << timeout);

        // Note: ideally, this lock will be timed, but that
        // might prove expensive and we don't expect draining
        // the queue to take anywhere close to the timeout.
        std::unique_lock<std::mutex> lock(_inMutex);

        Util::Stopwatch sw;
        for (;;)
        {
            // Drain the queue, first.
            while (!_inQueue.isEmpty())
            {
                std::vector<char> message = _inQueue.pop();
                if (cb(message))
                    return message;
            }

            if (SigUtil::getShutdownRequestFlag())
                break;

            // Timed wait, if we must.
            const std::chrono::milliseconds elapsed = sw.elapsed<std::chrono::milliseconds>();
            if (elapsed >= timeout)
                break;

            const std::chrono::milliseconds remaining = timeout - elapsed;
            _inCv.wait_for(lock, remaining / 20,
                           [this]()
                           { return !_inQueue.isEmpty() || SigUtil::getShutdownRequestFlag(); });
        }

        LOG_DBG(context << "Giving up polling after " << sw.elapsed());
        return std::vector<char>();
    }

    /// Wait until the given prefix is matched and return the payload.
    std::vector<char> waitForMessage(const std::string& prefix, std::chrono::milliseconds timeout,
                                     const std::string& context = std::string())
    {
        LOG_DBG(context << "Waiting for [" << prefix << "] for " << timeout);

        return poll(
            [&](const std::vector<char>& message) {
                return matchMessage(prefix, message, context);
            },
            timeout, context);
    }

    /// Wait until one of the given prefixes is matched and return the payload.
    std::vector<char> waitForMessageAny(const std::vector<std::string>& prefixes,
                                        std::chrono::milliseconds timeout,
                                        const std::string& context = std::string())
    {
        LOG_DBG(context << "Waiting for any [" << Util::join(prefixes) << "] for " << timeout);

        return poll(
            [&](const std::vector<char>& message)
            {
                for (const std::string& prefix : prefixes)
                {
                    if (matchMessage(prefix, message, context))
                    {
                        return true;
                    }
                }

                return false;
            },
            timeout, context);
    }

    /// Send a text message to our peer.
    void sendMessage(const std::string& msg)
    {
        {
            std::unique_lock<std::mutex> lock(_outMutex);
            _outQueue.put(std::vector<char>(msg.data(), msg.data() + msg.size()));
        }

        const auto pollPtr = _socketPoll.lock();
        if (pollPtr)
            pollPtr->wakeup();
    }

    /// Shutdown the WebSocket, either asynchronously or synchronously,
    /// depending on whether we have a SocketPoll or not.
    void shutdownWS()
    {
        if (!_disconnected)
        {
            const auto pollPtr = _socketPoll.lock();
            if (pollPtr && pollPtr->isAlive())
            {
                // Delegate, never call shutdown when our poller is active.
                LOG_TRC("WebSocketSession: queueing shutdown");
                std::weak_ptr<WebSocketSession> weakptr
                    = std::static_pointer_cast<WebSocketSession>(shared_from_this());
                pollPtr->addCallback([weakptr]() {
                    auto ws = weakptr.lock();
                    if (ws)
                    {
                        LOG_TRC_S("WebSocketSession: shutdown");
                        ws->shutdown(true, "Shutting down");
                    }
                });
            }
            else
            {
                LOG_TRC("WebSocketSession: shutdown");
                shutdown(true, "Shutting down");
            }
        }
    }

    /// Flags to shutdown after sending all the data.
    void asyncShutdown()
    {
        _shutdown = true;
        if (!_disconnected)
        {
            const auto pollPtr = _socketPoll.lock();
            if (pollPtr && pollPtr->isAlive())
            {
                pollPtr->wakeup();
            }
            else
            {
                LOG_WRN("WebSocketSession: No SocketPoll to issue asyncShutdown. Shutting down "
                        "directly.");
                shutdown(true, "Async shutting down");
            }
        }
    }

    /// Wait until disconnected.
    /// Returns true iff we are disconnected, otherwise false,
    /// if we timed out without disconnecting.
    bool waitForDisconnection(const std::chrono::milliseconds timeout)
    {
        std::unique_lock<std::mutex> lock(_outMutex);

        if (_disconnected)
            return true;

        _disconnectCv.wait_for(lock, timeout, [this]() { return _disconnected.load(); });
        return _disconnected;
    }

private:
    void handleMessage(const std::vector<char>& data) override
    {
        LOG_TRC("Got message: " << COOLProtocol::getAbbreviatedMessage(data));
        {
            std::unique_lock<std::mutex> lock(_inMutex);
            _inQueue.put(data);
        }

        _inCv.notify_one();
    }

    bool matchMessage(const std::string& prefix, const std::vector<char>& message,
                      const std::string& context)
    {
        const auto header = COOLProtocol::getFirstLine(message);
        const bool match = COOLProtocol::matchPrefix(prefix, header);
        LOG_DBG(context << (match ? " Matched" : " Skipped") << " message [" << prefix
                        << "]: " << header);
        return match;
    }

    int getPollEvents(std::chrono::steady_clock::time_point /*now*/,
                      int64_t& /*timeoutMaxMicroS*/) override
    {
        std::unique_lock<std::mutex> lock(_outMutex);
        if (!_outQueue.isEmpty() || _shutdown) // Graceful disconnection needs to send a frame.
            return POLLIN | POLLOUT;
        return POLLIN;
    }

    void performWrites(std::size_t capacity) override
    {
        LOG_TRC("WebSocketSession: performing writes, up to " << capacity << " bytes.");

        std::unique_lock<std::mutex> lock(_outMutex);

        std::size_t wrote = 0;
        try
        {
            // Drain the queue, for efficient communication.
            while (capacity > wrote && !_outQueue.isEmpty())
            {
                std::vector<char> item = _outQueue.get();
                const auto size = item.size();
                assert(size && "Zero-sized messages must never be queued for sending.");

                sendTextMessage(item.data(), size);

                wrote += size;
                LOG_TRC("WebSocketSession: wrote " << size << ", total " << wrote << " bytes.");
            }

            if (_shutdown && _outQueue.isEmpty())
            {
                sendCloseFrame();
            }
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("WebSocketSession: Failed to send message: " << ex.what());
        }

        LOG_TRC("WebSocketSession: performed write, wrote " << wrote << " bytes.");
    }

    // Make these inaccessible since they must only be called from the poll thread.
    using WebSocketHandler::sendBinaryMessage;
    using WebSocketHandler::sendMessage;
    using WebSocketHandler::sendTextMessage;

    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _disconnected = false;
        WebSocketHandler::onConnect(socket);
    }

    void onDisconnect() override
    {
        {
            std::unique_lock<std::mutex> lock(_outMutex);
            _disconnected = true;
        }

        _disconnectCv.notify_all();
    }

private:
    const std::string _host;
    const std::string _port;
    const Protocol _protocol;
    Request _request;
    MessageQueue _inQueue; //< The incoming message queue.
    std::condition_variable _inCv; //< The incoming queue cond_var.
    std::mutex _inMutex; //< The incoming queue lock.
    MessageQueue _outQueue; //< The outgoing message queue.
    std::mutex _outMutex; //< The outgoing queue lock.
    std::condition_variable _disconnectCv; //< Traps disconnections.
    std::mutex _disconnectMutex; //< The disconnection event lock.
    std::atomic_bool _disconnected; //< True iff we are disconnected.
    std::atomic_bool _shutdown; //< Whether we should shutdown after sending all the data.
    std::weak_ptr<SocketPoll> _socketPoll;
};

} // namespace http

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
