/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "WebSocketHandler.hpp"

#include <Poco/Net/WebSocket.h>

void WebSocketHandler::upgradeToWebSocket(const Poco::Net::HTTPRequest& req)
{
    LOG_TRC("Upgrading to WebSocket");

    // create our websocket goodness ...
    _wsVersion = std::stoi(req.get("Sec-WebSocket-Version", "13"));
    _wsKey = req.get("Sec-WebSocket-Key", "");
    _wsProtocol = req.get("Sec-WebSocket-Protocol", "chat");
    // FIXME: other sanity checks ...
    LOG_INF("WebSocket version " << _wsVersion << " key '" << _wsKey << "'.");

    std::ostringstream oss;
    oss << "HTTP/1.1 101 Switching Protocols\r\n"
        << "Upgrade: websocket\r\n"
        << "Connection: Upgrade\r\n"
        << "Sec-Websocket-Accept: " << computeAccept(_wsKey) << "\r\n"
        << "\r\n";
    std::string str = oss.str();
    _socket->_outBuffer.insert(_socket->_outBuffer.end(), str.begin(), str.end());
}

namespace {

/// To make the protected 'computeAccept' accessible.
class PublicComputeAccept : public Poco::Net::WebSocket {
public:
    static std::string doComputeAccept(const std::string &key)
    {
        return computeAccept(key);
    }
};

}

std::string WebSocketHandler::computeAccept(const std::string &key)
{
    return PublicComputeAccept::doComputeAccept(key);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
