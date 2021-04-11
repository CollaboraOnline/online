/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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
        : WebSocketHandler(true)
        , _host(hostname)
        , _port(std::to_string(portNumber))
        , _protocol(protocolType)
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
            LOG_ERR("Invalid URI while creating WebSocketSession: " << uri);
            return nullptr;
        }

        const std::string lowerScheme = Util::toLower(scheme);
        if (!Util::startsWith(lowerScheme, "http") && !Util::startsWith(lowerScheme, "ws"))
        {
            LOG_ERR("Unsupported scheme in URI while creating WebSocketSession: " << uri);
            return nullptr;
        }

        const bool secure
            = Util::startsWith(lowerScheme, "https") || Util::startsWith(lowerScheme, "wss");

        const int portInt = port.empty() ? 0 : std::stoi(port);
        return create(host, secure ? Protocol::HttpSsl : Protocol::HttpUnencrypted, portInt);
    }

    /// Create a WebSocketSession and make a request to given @url.
    static std::shared_ptr<WebSocketSession> create(SocketPoll& socketPoll, const std::string& uri,
                                                    const std::string& url)
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

    bool asyncRequest(http::Request& req, SocketPoll& poll)
    {
        LOG_TRC("asyncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                 << req.getUrl());

        return wsRequest(req, host(), port(), secure(), poll);
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
        do
        {
            // Drain the queue, first.
            while (!_inQueue.isEmpty())
            {
                std::vector<char> message = _inQueue.pop();
                if (cb(message))
                    return message;
            }

            // Timed wait, if we must.
        } while (_inCv.wait_for(lock, timeout, [this]() { return !_inQueue.isEmpty(); }));

        LOG_DBG(context << "Giving up polling after " << timeout);
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

    /// Send a text message to our peer.
    void sendMessage(const std::string& msg)
    {
        std::unique_lock<std::mutex> lock(_outMutex);
        _outQueue.put(std::vector<char>(msg.data(), msg.data() + msg.size()));
    }

private:
    void handleMessage(const std::vector<char>& data) override
    {
        LOG_DBG("Got message: " << LOOLProtocol::getFirstLine(data));
        std::unique_lock<std::mutex> lock(_inMutex);
        _inQueue.put(data);
        _inCv.notify_one();
    }

    bool matchMessage(const std::string& prefix, const std::vector<char>& message,
                      const std::string& context)
    {
        const auto header = LOOLProtocol::getFirstLine(message);
        const bool match = LOOLProtocol::matchPrefix(prefix, header);
        LOG_DBG(context << (match ? "Matched" : "Skipped") << " message [" << prefix
                        << "]: " << header);
        return match;
    }

    void performWrites() override
    {
        LOG_TRC("WebSocketSession: performing writes.");

        std::unique_lock<std::mutex> lock(_outMutex);

        std::size_t wrote = 0;
        try
        {
            // Drain the queue, for efficient communication.
            if (!_outQueue.isEmpty())
            {
                std::vector<char> item = _outQueue.get();
                const auto size = item.size();
                assert(size && "Zero-sized messages must never be queued for sending.");

                sendTextMessage(item.data(), size);

                wrote += size;
                LOG_TRC("WebSocketSession: wrote " << size << ", total " << wrote << " bytes.");
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
    using WebSocketHandler::shutdown;

    void shutdown()
    {
        LOG_TRC("shutdown");
        shutdown(true, "Shutting down");
    }

private:
    const std::string _host;
    const std::string _port;
    const Protocol _protocol;
    Request _request;
    MessageQueue _inQueue; //< The incoming message queue.
    std::condition_variable _inCv; //< The incoming queue cond_var.
    std::mutex _inMutex; //< The incoming queue lock.
    MessageQueueBase<std::vector<char>> _outQueue; //< The outgoing message queue.
    std::mutex _outMutex; //< The outgoing queue lock.
};

} // namespace http

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
