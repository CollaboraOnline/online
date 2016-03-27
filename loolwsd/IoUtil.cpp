/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <sys/poll.h>
#include <sys/prctl.h>

#include <cassert>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <mutex>
#include <sstream>
#include <string>

#include <Poco/StringTokenizer.h>
#include <Poco/Net/HTTPServerResponse.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Net/NetException.h>
#include <Poco/Thread.h>

#include "Common.hpp"
#include "LOOLProtocol.hpp"
#include "IoUtil.hpp"
#include "Util.hpp"

namespace IoUtil
{
using Poco::Net::WebSocket;
using Poco::Net::WebSocketException;

// Synchronously process WebSocket requests and dispatch to handler.
// Handler returns false to end.
void SocketProcessor(std::shared_ptr<WebSocket> ws,
                     Poco::Net::HTTPServerResponse& response,
                     std::function<bool(const std::vector<char>&)> handler,
                     std::function<bool()> stopPredicate,
                     std::string name,
                     const size_t pollTimeoutMs)
{
    if (!name.empty())
    {
        name = "[" + name + "] ";
    }

    Log::info(name + "Starting Socket Processor.");

    // Timeout given is in microseconds.
    const Poco::Timespan waitTime(pollTimeoutMs * 1000);
    try
    {
        ws->setReceiveTimeout(0);

        int flags = 0;
        int n = 0;
        bool stop = false;
        std::vector<char> payload(READ_BUFFER_SIZE * 100);

        for (;;)
        {
            stop = stopPredicate();
            if (stop)
            {
                Log::info(name + "Termination flagged. Finishing.");
                break;
            }

            if (!ws->poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                // Wait some more.
                continue;
            }

            payload.resize(payload.capacity());
            n = ws->receiveFrame(payload.data(), payload.capacity(), flags);
            if (n >= 0)
            {
                payload.resize(n);
            }

            if ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_PING)
            {
                // Echo back the ping payload as pong.
                // Technically, we should send back a PONG control frame.
                // However Firefox (probably) or Node.js (possibly) doesn't
                // like that and closes the socket when we do.
                // Echoing the payload as a normal frame works with Firefox.
                ws->sendFrame(payload.data(), n /*, WebSocket::FRAME_OP_PONG*/);
                continue;
            }
            else if ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_PONG)
            {
                // In case we do send pings in the future.
                continue;
            }
            else if (n <= 0 || ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_CLOSE))
            {
                Log::warn(name + "Connection closed.");
                break;
            }

            assert(n > 0);

            const std::string firstLine = LOOLProtocol::getFirstLine(payload);
            if ((flags & WebSocket::FrameFlags::FRAME_FLAG_FIN) != WebSocket::FrameFlags::FRAME_FLAG_FIN)
            {
                // One WS message split into multiple frames.
                while (true)
                {
                    char buffer[READ_BUFFER_SIZE * 10];
                    n = ws->receiveFrame(buffer, sizeof(buffer), flags);
                    if (n <= 0 || (flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_CLOSE)
                    {
                        break;
                    }

                    payload.insert(payload.end(), buffer, buffer + n);
                    if ((flags & WebSocket::FrameFlags::FRAME_FLAG_FIN) == WebSocket::FrameFlags::FRAME_FLAG_FIN)
                    {
                        // No more frames.
                        break;
                    }
                }
            }
            else
            {
                int size = 0;
                Poco::StringTokenizer tokens(firstLine, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
                if (tokens.count() == 2 &&
                    tokens[0] == "nextmessage:" && LOOLProtocol::getTokenInteger(tokens[1], "size", size) && size > 0)
                {
                    // Check if it is a "nextmessage:" and in that case read the large
                    // follow-up message separately, and handle that only.
                    payload.resize(size);

                    n = ws->receiveFrame(payload.data(), size, flags);
                }
            }

            if (n <= 0 || (flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_CLOSE)
            {
                Log::warn(name + "Connection closed.");
                break;
            }

            if (firstLine == "eof")
            {
                Log::info(name + "Received EOF. Finishing.");
                break;
            }

            // Call the handler.
            if (!handler(payload))
            {
                Log::info(name + "Socket handler flagged to finish.");
                break;
            }
        }

        Log::debug() << name << "Finishing SocketProcessor. TerminationFlag: " << stop
                     << ", payload size: " << payload.size()
                     << ", flags: " << std::hex << flags << Log::end;
        if (!payload.empty())
        {
            Log::warn(name + "Last message will not be processed: [" +
                      LOOLProtocol::getAbbreviatedMessage(payload.data(), payload.size()) + "].");
        }
    }
    catch (const WebSocketException& exc)
    {
        Log::error("SocketProcessor: WebSocketException: " + exc.message());
        switch (exc.code())
        {
        case WebSocket::WS_ERR_HANDSHAKE_UNSUPPORTED_VERSION:
            response.set("Sec-WebSocket-Version", WebSocket::WEBSOCKET_VERSION);
            // fallthrough
        case WebSocket::WS_ERR_NO_HANDSHAKE:
        case WebSocket::WS_ERR_HANDSHAKE_NO_VERSION:
        case WebSocket::WS_ERR_HANDSHAKE_NO_KEY:
            response.setStatusAndReason(Poco::Net::HTTPResponse::HTTP_BAD_REQUEST);
            response.setContentLength(0);
            response.send();
            break;
        }
    }

    Log::info(name + "Finished Socket Processor.");
}

void shutdownWebSocket(std::shared_ptr<Poco::Net::WebSocket> ws)
{
    try
    {
        if (ws)
            ws->shutdown();
    }
    catch (const Poco::IOException& exc)
    {
        Log::warn("Util::shutdownWebSocket: IOException: " + exc.message());
    }
}

ssize_t writeFIFO(int pipe, const char* buffer, ssize_t size)
{
    ssize_t bytes = -1;
    ssize_t count = 0;

    while(true)
    {
        bytes = write(pipe, buffer + count, size - count);
        if (bytes < 0)
        {
            if (errno == EINTR || errno == EAGAIN)
                continue;

            count = -1;
            break;
        }
        else if (count + bytes < size)
        {
            count += bytes;
        }
        else
        {
            count += bytes;
            break;
        }
    }

    return count;
}

ssize_t readFIFO(int pipe, char* buffer, ssize_t size)
{
    ssize_t bytes;
    do
    {
        bytes = read(pipe, buffer, size);
    }
    while (bytes < 0 && errno == EINTR);

    return bytes;
}

ssize_t readMessage(int pipe, char* buffer, ssize_t size)
{
    struct pollfd pollPipe;

    pollPipe.fd = pipe;
    pollPipe.events = POLLIN;
    pollPipe.revents = 0;

    const int nPoll = poll(&pollPipe, 1, CHILD_TIMEOUT_SECS * 1000);
    if ( nPoll < 0 )
        return -1;

    if ( nPoll == 0 )
        errno = ETIME;

    if( (pollPipe.revents & POLLIN) != 0 )
        return readFIFO(pipe, buffer, size);

    return -1;
}

void pollPipeForReading(pollfd& pollPipe, const std::string& targetPipeName , const int& targetPipe,
                        std::function<void(std::string& message)> handler)
{
    std::string message;
    char buffer[READ_BUFFER_SIZE];
    char* start = buffer;
    char* end = buffer;
    ssize_t bytes = -1;

    while (!TerminationFlag)
    {
        if (start == end)
        {
            if (poll(&pollPipe, 1, POLL_TIMEOUT_MS) < 0)
            {
                Log::error("Failed to poll pipe [" + targetPipeName + "].");
                continue;
            }
            else if (pollPipe.revents & (POLLIN | POLLPRI))
            {
                bytes = readFIFO(targetPipe, buffer, sizeof(buffer));
                if (bytes < 0)
                {
                    start = end = nullptr;
                    Log::error("Error reading message from pipe [" + targetPipeName + "].");
                    continue;
                }
                start = buffer;
                end = buffer + bytes;
            }
            else if (pollPipe.revents & (POLLERR | POLLHUP))
            {
                Log::error("Broken pipe [" + targetPipeName + "] with wsd.");
                break;
            }
        }

        if (start != end)
        {
            char byteChar = *start++;
            while (start != end && byteChar != '\r' && byteChar != '\n')
            {
                message += byteChar;
                byteChar = *start++;
            }

            if (byteChar == '\r' && *start == '\n')
            {
                start++;
                Log::debug(targetPipeName + " recv: " + message);
                if (message == "eof")
                    break;

                handler(message);
                message.clear();
            }
        }
    }
}

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
