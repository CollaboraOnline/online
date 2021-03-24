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
#include <sstream>
#include <string>

#include "Common.hpp"
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
/// A client socket to make asynchronous HTTP requests.
/// Designed to be reused for multiple requests.
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
        : _host(hostname)
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

    /// Create a new unencrypted HTTP WebSocketSession to the given host.
    /// @port <= 0 will default to the http default port.
    static std::shared_ptr<WebSocketSession> createHttp(const std::string& host, int port = 0)
    {
        return create(host, Protocol::HttpUnencrypted, port);
    }

    /// Create a new SSL HTTP WebSocketSession to the given host.
    /// @port <= 0 will default to the https default port.
    static std::shared_ptr<WebSocketSession> createHttpSsl(const std::string& host, int port = 0)
    {
        return create(host, Protocol::HttpSsl, port);
    }

    /// Create a new HTTP WebSocketSession to the given URI.
    /// The @uri must include the scheme, e.g. https://domain.com:9980
    static std::shared_ptr<WebSocketSession> create(const std::string& uri)
    {
        const std::string lowerUri = Util::toLower(uri);
        if (!Util::startsWith(lowerUri, "http"))
        {
            LOG_ERR("Unsupported scheme in URI: " << uri);
            return nullptr;
        }

        std::string hostPort;
        bool secure = false;
        if (Util::startsWith(uri, "http://"))
        {
            hostPort = uri.substr(7);
        }
        else if (Util::startsWith(uri, "https://"))
        {
            hostPort = uri.substr(8);
            secure = true;
        }
        else
        {
            LOG_ERR("Invalid URI: " << uri);
            return nullptr;
        }

        int port = 0;
        const auto tokens = Util::tokenize(hostPort, ':');
        if (tokens.size() > 1)
        {
            port = std::stoi(tokens[1]);
        }

        return create(tokens[0], secure ? Protocol::HttpSsl : Protocol::HttpUnencrypted, port);
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

    bool asyncRequest(Request req, SocketPoll& poll)
    {
        LOG_TRC("asyncRequest: " << req.getVerb() << ' ' << host() << ':' << port() << ' '
                                 << req.getUrl());

        // FIXME: Generate key.
        std::string key = "fxTaWTEMVhq1PkWsMoLxGw==";

        _request = std::move(req);
        _request.set("Host", host()); // Make sure the host is set.
        _request.set("Date", Util::getHttpTimeNow());
        _request.set("User-Agent", HTTP_AGENT_STRING);

        _request.set("Connection", "Upgrade");
        _request.set("Upgrade", "websocket");
        _request.set("Sec-WebSocket-Version", "13");
        _request.set("Sec-WebSocket-Key", key);

        auto socket = net::connect(_host, _port, isSecure(), shared_from_this());
        if (!socket)
        {
            LOG_ERR("Failed to connect to " << _host << ':' << _port);
            return false;
        }

        onConnect(socket);

        if (socket->send(_request))
        {
            poll.insertNewSocket(socket);

            return true;
        }

        LOG_ERR("Failed to make WebSocket request.");
        return false;
    }

    /// Upgrade the socket to WebSocket and migrate to the given handler.
    std::shared_ptr<WebSocketHandler> upgradeToWebSocket();

private:
    const std::string _host;
    const std::string _port;
    const Protocol _protocol;
    Request _request;
};

} // namespace http

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
