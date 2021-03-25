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
    bool isSecure() const { return _protocol == Protocol::HttpSsl; }

    bool asyncRequest(http::Request req, SocketPoll& poll)
    {
        LOG_TRC("asyncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                 << req.getUrl());

        return wsRequest(req, host(), port(), isSecure(), poll);
    }

    /// Wait until the given prefix is matched and return the payload.
    std::vector<char> waitForMessage(const std::string& prefix, std::chrono::milliseconds timeout)
    {
        const auto deadline = std::chrono::steady_clock::now() + timeout;
        LOG_DBG("Waiting for [" << prefix << "] for " << timeout);

        std::unique_lock<std::mutex> lock(_mutex);
        do
        {
            // Drain the queue, first.
            while (!_queue.isEmpty())
            {
                std::vector<char> message = _queue.pop();
                if (matchMessage(prefix, message))
                    return message;
            }

            // Timed wait, if we must.
        } while (_cv.wait_until(lock, deadline, [this]() { return !_queue.isEmpty(); }));

        LOG_DBG("Giving up waiting for [" << prefix << "] after " << timeout);
        return std::vector<char>();
    }

private:
    void handleMessage(const std::vector<char>& data) override
    {
        LOG_DBG("Got message: " << LOOLProtocol::getFirstLine(data));
        std::unique_lock<std::mutex> lock(_mutex);
        _queue.put(data);
        _cv.notify_one();
    }

    bool matchMessage(const std::string& prefix, const std::vector<char>& message)
    {
        const auto header = LOOLProtocol::getFirstLine(message);
        LOG_DBG("Evaluating message: " << header);
        return LOOLProtocol::matchPrefix(prefix, header);
    }

private:
    const std::string _host;
    const std::string _port;
    const Protocol _protocol;
    Request _request;
    MessageQueue _queue; //< The incoming message queue.
    std::condition_variable _cv;
    std::mutex _mutex; //< The queue lock.
};

} // namespace http

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
