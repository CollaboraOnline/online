/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_LOOLWEBSOCKET_HPP
#define INCLUDED_LOOLWEBSOCKET_HPP

#include <mutex>

#include <Poco/Net/WebSocket.h>

#include <Common.hpp>
#include <LOOLProtocol.hpp>
#include <Log.hpp>

/// WebSocket that is thread safe, and handles large frames transparently.
class LOOLWebSocket : public Poco::Net::WebSocket
{
    std::mutex _mutex;

public:
    LOOLWebSocket(const Socket & socket) :
        Poco::Net::WebSocket(socket),
        _mutex()
    {
    }

    LOOLWebSocket(Poco::Net::HTTPServerRequest & request, Poco::Net::HTTPServerResponse & response) :
        Poco::Net::WebSocket(request, response),
        _mutex()
    {
    }

    LOOLWebSocket(Poco::Net::HTTPClientSession & cs, Poco::Net::HTTPRequest & request, Poco::Net::HTTPResponse & response) :
        Poco::Net::WebSocket(cs, request, response),
        _mutex()
    {
    }

    LOOLWebSocket(Poco::Net::HTTPClientSession & cs, Poco::Net::HTTPRequest & request, Poco::Net::HTTPResponse & response, Poco::Net::HTTPCredentials & credentials) :
        Poco::Net::WebSocket(cs, request, response, credentials),
        _mutex()
    {
    }

    /// Careful - sendFrame is _not_ virtual, we need to make sure that we use
    /// LOOLWebSocket all over the place
    /// It would be a kind of more natural to encapsulate Poco::Net::WebSocket
    /// instead of inheriting (from that reason), but that would requite much
    /// larger code changes.
    int sendFrame(const void * buffer, int length, int flags = FRAME_TEXT)
    {
        std::lock_guard<std::mutex> lock(_mutex);

        // Size after which messages will be sent preceded with
        // 'nextmessage' frame to let the receiver know in advance
        // the size of larger coming message. All messages up to this
        // size are considered small messages.
        constexpr int SMALL_MESSAGE_SIZE = READ_BUFFER_SIZE / 2;

        if (length > SMALL_MESSAGE_SIZE)
        {
            const std::string nextmessage = "nextmessage: size=" + std::to_string(length);
            Poco::Net::WebSocket::sendFrame(nextmessage.data(), nextmessage.size());
            Log::debug("Message is long, sent " + nextmessage);
        }

        int result = Poco::Net::WebSocket::sendFrame(buffer, length, flags);
        Log::debug("Sent frame: " + LOOLProtocol::getAbbreviatedMessage(static_cast<const char*>(buffer), length));

        return result;
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
