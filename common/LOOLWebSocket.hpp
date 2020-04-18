/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <cstdlib>
#include <mutex>
#include <thread>

#include <Poco/Net/WebSocket.h>

#include <Common.hpp>
#include <Protocol.hpp>
#include <Log.hpp>

/// Deprecated: do not use ... replaced by net/Socket.hpp
///
/// WebSocket that is thread safe, and handles large frames transparently.
/// Careful - sendFrame and receiveFrame are _not_ virtual,
/// we need to make sure that we use LOOLWebSocket all over the place.
/// It would be a kind of more natural to encapsulate Poco::Net::WebSocket
/// instead of inheriting (from that reason,) but that would requite much
/// larger code changes.
class LOOLWebSocket : public Poco::Net::WebSocket
{
public:
    LOOLWebSocket(const Socket& socket) :
        Poco::Net::WebSocket(socket)
    {
    }

    LOOLWebSocket(Poco::Net::HTTPClientSession& cs,
                  Poco::Net::HTTPRequest& request,
                  Poco::Net::HTTPResponse& response) :
        Poco::Net::WebSocket(cs, request, response)
    {
    }

    /// Wrapper for Poco::Net::WebSocket::receiveFrame() that handles PING frames
    /// (by replying with a PONG frame) and PONG frames. PONG frames are ignored.

    /// Returns number of bytes received, or 0 if the Poco receiveFrame() returned 0,
    /// or -1 if no "interesting" (not PING or PONG) frame was actually received).

    /// Should we also factor out the handling of non-final and continuation frames into this?
    int receiveFrame(char* buffer, const int length, int& flags)
    {
        // Timeout is in microseconds. We don't need this, except to yield the cpu.
        static const Poco::Timespan waitTime(POLL_TIMEOUT_MICRO_S / 10);
        static const Poco::Timespan waitZero(0);

        while (poll(waitTime, Poco::Net::Socket::SELECT_READ))
        {
            const int n = Poco::Net::WebSocket::receiveFrame(buffer, length, flags);

            if (n <= 0)
                LOG_TRC("Got nothing (" << n << ")");
            else
                LOG_TRC("Got frame: " << LOOLProtocol::getAbbreviatedFrameDump(buffer, n, flags));

            if ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_CLOSE)
            {
                // Nothing to do.
                return n;
            }

            if ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_PING)
            {
                // Echo back the ping message.
                if (Poco::Net::WebSocket::sendFrame(buffer, n, static_cast<int>(WebSocket::FRAME_FLAG_FIN) | WebSocket::FRAME_OP_PONG) != n)
                {
                    LOG_WRN("Sending Pong failed.");
                    return -1;
                }
            }
            else if ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_PONG)
            {
                // In case we do send pings in the future.
            }
            else
            {
                return n;
            }
        }

        // Not ready for read.
        return -1;
    }

    /// Wrapper for Poco::Net::WebSocket::sendFrame() that handles large frames.
    int sendFrame(const char* buffer, const int length, const int flags = FRAME_TEXT)
    {
        static const Poco::Timespan waitZero(0);

        const int result = Poco::Net::WebSocket::sendFrame(buffer, length, flags);

        if (result != length)
        {
            LOG_ERR("Sent incomplete message, expected " << length << " bytes but sent " << result <<
                    " for: " << LOOLProtocol::getAbbreviatedFrameDump(buffer, length, flags));
        }
        else
        {
            LOG_TRC("Sent frame: " << LOOLProtocol::getAbbreviatedFrameDump(buffer, length, flags));
        }

        return result;
    }

    /// Safe shutdown by sending a normal close frame, if socket is not in error,
    /// or, otherwise, close the socket without sending close frame, if it is.
    void shutdown()
    {
        shutdown(Poco::Net::WebSocket::StatusCodes::WS_NORMAL_CLOSE);
    }

    /// Safe shutdown by sending a specific close frame, if socket is not in error,
    /// or, otherwise, close the socket without sending close frame, if it is.
    void shutdown(Poco::UInt16 statusCode, const std::string& statusMessage = "")
    {
        try
        {
            // Calling shutdown, in case of error, would try to send a 'close' frame
            // which won't work in case of broken pipe or timeout from peer. Just close the
            // socket in that case preventing 'close' frame from being sent.
            if (Poco::Net::WebSocket::poll(Poco::Timespan(0), Socket::SelectMode::SELECT_ERROR))
            {
                Poco::Net::WebSocket::close();
            }
            else
            {
                Poco::Net::WebSocket::shutdown(statusCode, statusMessage);
            }
        }
        catch (const Poco::Exception& exc)
        {
            LOG_WRN("LOOLWebSocket::shutdown: Exception: " << exc.displayText() <<
                    (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));

            // Just close it.
            try
            {
                Poco::Net::WebSocket::close();
            }
            catch (const std::exception&)
            {
                // Nothing we can do.
            }
        }
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
