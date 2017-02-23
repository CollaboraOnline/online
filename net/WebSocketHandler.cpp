/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "WebSocketHandler.hpp"

#include <Poco/MemoryStream.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/StringTokenizer.h>

void WebSocketHandler::handleWebsocketUpgrade()
{
    int number = 0;
    Poco::MemoryInputStream message(&_socket->_inBuffer[0], _socket->_inBuffer.size());
    Poco::Net::HTTPRequest req;
    req.read(message);

    // if we succeeded - remove that from our input buffer
    // FIXME: We should check if this is GET or POST. For GET, we only
    // can have a single request (headers only). For POST, we can/should
    // use Poco HTMLForm to parse the post message properly.
    // Otherwise, we should catch exceptions from the previous read/parse
    // and assume we don't have sufficient data, so we wait some more.
    _socket->_inBuffer.clear();

    Poco::StringTokenizer tokens(req.getURI(), "/?");
    if (tokens.count() == 4)
    {
        std::string subpool = tokens[2];
        number = std::stoi(tokens[3]);

        // complex algorithmic core:
        number = number + 1;

        std::string numberString = std::to_string(number);
        std::ostringstream oss;
        oss << "HTTP/1.1 200 OK\r\n"
            << "Date: Once, Upon a time GMT\r\n" // Mon, 27 Jul 2009 12:28:53 GMT
            << "Server: madeup string (Linux)\r\n"
            << "Content-Length: " << numberString.size() << "\r\n"
            << "Content-Type: text/plain\r\n"
            << "Connection: Closed\r\n"
            << "\r\n"
            << numberString;
        ;
        std::string str = oss.str();
        _socket->_outBuffer.insert(_socket->_outBuffer.end(), str.begin(), str.end());
    }
    else if (tokens.count() == 2 && tokens[1] == "ws")
    { // create our websocket goodness ...
        _wsVersion = std::stoi(req.get("Sec-WebSocket-Version", "13"));
        _wsKey = req.get("Sec-WebSocket-Key", "");
        _wsProtocol = req.get("Sec-WebSocket-Protocol", "chat");
        std::cerr << "version " << _wsVersion << " key '" << _wsKey << "\n";
        // FIXME: other sanity checks ...

        std::ostringstream oss;
        oss << "HTTP/1.1 101 Switching Protocols\r\n"
            << "Upgrade: websocket\r\n"
            << "Connection: Upgrade\r\n"
            << "Sec-Websocket-Accept: " << computeAccept(_wsKey) << "\r\n"
            << "\r\n";
        std::string str = oss.str();
        _socket->_outBuffer.insert(_socket->_outBuffer.end(), str.begin(), str.end());
        _wsState = WEBSOCKET;
    }
    else
        std::cerr << " unknown tokens " << tokens.count() << std::endl;
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
