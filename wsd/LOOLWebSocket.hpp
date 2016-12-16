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

#include "config.h"

#include <cstdlib>
#include <mutex>
#include <thread>

#include <Poco/Net/WebSocket.h>

#include <Common.hpp>
#include <Protocol.hpp>
#include <Log.hpp>

/// WebSocket that is thread safe, and handles large frames transparently.
/// Careful - sendFrame and receiveFrame are _not_ virtual,
/// we need to make sure that we use LOOLWebSocket all over the place.
/// It would be a kind of more natural to encapsulate Poco::Net::WebSocket
/// instead of inheriting (from that reason,) but that would requite much
/// larger code changes.
class LOOLWebSocket : public Poco::Net::WebSocket
{
private:
    std::mutex _mutex;

#if ENABLE_DEBUG
    std::chrono::milliseconds getWebSocketDelay()
    {
        unsigned long baseDelay = 0;
        unsigned long jitter = 0;
        if (std::getenv("LOOL_WS_DELAY"))
        {
            baseDelay = std::stoul(std::getenv("LOOL_WS_DELAY"));
        }
        if (std::getenv("LOOL_WS_JITTER"))
        {
            jitter = std::stoul(std::getenv("LOOL_WS_JITTER"));
        }

        return std::chrono::milliseconds(baseDelay + (jitter > 0 ? (std::rand() % jitter) : 0));
    }
#endif

public:
    LOOLWebSocket(const Socket& socket) :
        Poco::Net::WebSocket(socket)
    {
    }

    LOOLWebSocket(Poco::Net::HTTPServerRequest& request,
                  Poco::Net::HTTPServerResponse& response) :
        Poco::Net::WebSocket(request, response)
    {
    }

    LOOLWebSocket(Poco::Net::HTTPClientSession& cs,
                  Poco::Net::HTTPRequest& request,
                  Poco::Net::HTTPResponse& response) :
        Poco::Net::WebSocket(cs, request, response)
    {
    }

    LOOLWebSocket(Poco::Net::HTTPClientSession& cs,
                  Poco::Net::HTTPRequest& request,
                  Poco::Net::HTTPResponse& response,
                  Poco::Net::HTTPCredentials& credentials) :
        Poco::Net::WebSocket(cs, request, response, credentials)
    {
    }

    /// Wrapper for Poco::Net::WebSocket::receiveFrame() that handles PING frames
    /// (by replying with a PONG frame) and PONG frames. PONG frames are ignored.
    /// Should we also factor out the handling of non-final and continuation frames into this?
    int receiveFrame(char* buffer, const int length, int& flags)
    {
#if ENABLE_DEBUG
        // Delay receiving the frame
        std::this_thread::sleep_for(getWebSocketDelay());
#endif
        // Timeout given is in microseconds.
        static const Poco::Timespan waitTime(POLL_TIMEOUT_MS * 1000);

        while (poll(waitTime, Poco::Net::Socket::SELECT_READ))
        {
            const int n = Poco::Net::WebSocket::receiveFrame(buffer, length, flags);
            if ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_PING)
            {
                sendFrame(buffer, n, WebSocket::FRAME_FLAG_FIN | WebSocket::FRAME_OP_PONG);
            }
            else if ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_PONG)
            {
                // In case we do send pongs in the future.
            }
            else
            {
                return n;
            }
        }

        return -1;
    }

    /// Wrapper for Poco::Net::WebSocket::sendFrame() that handles large frames.
    int sendFrame(const char* buffer, const int length, const int flags = FRAME_TEXT)
    {
#if ENABLE_DEBUG
        // Delay sending the frame
        std::this_thread::sleep_for(getWebSocketDelay());
#endif
        std::unique_lock<std::mutex> lock(_mutex);

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

        const int result = Poco::Net::WebSocket::sendFrame(buffer, length, flags);

        lock.unlock();

        if (result != length)
        {
            LOG_ERR("Sent incomplete message, expected " << length << " bytes but sent " << result <<
                    " while sending: " << LOOLProtocol::getAbbreviatedMessage(buffer, length));
        }
        else
        {
            LOG_DBG("Sent frame: " << LOOLProtocol::getAbbreviatedMessage(buffer, length));
        }

        return result;
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
