/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "IoUtil.hpp"
#include "config.h"

#include <sys/poll.h>

#include <cassert>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <mutex>
#include <sstream>
#include <string>

#include <Poco/Net/NetException.h>
#include <Poco/Net/Socket.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Thread.h>
#include <Poco/URI.h>

#include "Common.hpp"
#include "LOOLProtocol.hpp"
#include "Log.hpp"
#include "Util.hpp"

using Poco::Net::Socket;
using Poco::Net::WebSocket;

namespace IoUtil
{

int receiveFrame(WebSocket& socket, void* buffer, int length, int& flags)
{
    while (!TerminationFlag)
    {
        int n = socket.receiveFrame(buffer, length, flags);
        if ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_PING)
        {
            socket.sendFrame(buffer, n, WebSocket::FRAME_FLAG_FIN | WebSocket::FRAME_OP_PONG);
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

// Synchronously process WebSocket requests and dispatch to handler.
// Handler returns false to end.
void SocketProcessor(const std::shared_ptr<WebSocket>& ws,
                     const std::function<bool(const std::vector<char>&)>& handler,
                     const std::function<void()>& closeFrame,
                     const std::function<bool()>& stopPredicate)
{
    Log::info("SocketProcessor starting.");

    // Timeout given is in microseconds.
    static const Poco::Timespan waitTime(POLL_TIMEOUT_MS * 1000);
    try
    {
        ws->setReceiveTimeout(0);

        int flags = 0;
        int n = 0;
        bool stop = false;
        std::vector<char> payload(READ_BUFFER_SIZE * 100);
        payload.resize(0);

        for (;;)
        {
            stop = stopPredicate();
            if (stop)
            {
                Log::info("Termination flagged. Finishing.");
                break;
            }

            if (!ws->poll(waitTime, Poco::Net::Socket::SELECT_READ) ||
                stopPredicate())
            {
                // Wait some more.
                continue;
            }

            payload.resize(payload.capacity());
            try
            {
                n = receiveFrame(*ws, payload.data(), payload.capacity(), flags);
            }
            catch (const Poco::TimeoutException&)
            {
                Log::debug("SocketProcessor: Spurious TimeoutException, ignored");
                continue;
            }
            payload.resize(n > 0 ? n : 0);

            if (n <= 0 || ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_CLOSE))
            {
                closeFrame();
                Log::warn("Connection closed.");
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
                        closeFrame();
                        Log::warn("Connection closed while reading multiframe message.");
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
                closeFrame();
                Log::warn("Connection closed.");
                break;
            }

            // Call the handler.
            const auto success = handler(payload);
            payload.resize(0);

            if (!success)
            {
                Log::info("Socket handler flagged to finish.");
                break;
            }
        }

        Log::info() << "SocketProcessor finishing. stop: " << (stop ? "true" : "false")
                     << ", n: " << n
                     << ", payload size: " << payload.size()
                     << ", flags: " << std::hex << flags << Log::end;

        if ((flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE && payload.size() > 1)
        {
            std::string msg;
            Poco::URI::encode(std::string(payload.data(), payload.size()), "", msg);
            Log::warn("Last message (" + std::to_string(payload.size()) +
                      " bytes) will not be processed: [" + msg + "].");
        }
    }
    catch (const std::exception& exc)
    {
        Log::error("SocketProcessor: exception: " + std::string(exc.what()));
    }

    Log::info("SocketProcessor finished.");
}

void shutdownWebSocket(const std::shared_ptr<Poco::Net::WebSocket>& ws)
{
    try
    {
        // Calling WebSocket::shutdown, in case of error, would try to send a 'close' frame
        // which won't work in case of broken pipe or timeout from peer. Just close the
        // socket in that case preventing 'close' frame from being sent.
        if (ws && ws->poll(Poco::Timespan(0), Socket::SelectMode::SELECT_ERROR))
            ws->close();
        else if (ws)
            ws->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        Log::warn("Util::shutdownWebSocket: Exception: " + exc.displayText() + (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
    }

}

ssize_t writeFIFO(int pipe, const char* buffer, ssize_t size)
{
    ssize_t count = 0;
    while(true)
    {
        Log::trace("Writing to pipe. Data: [" + Util::formatLinesForLog(std::string(buffer, size)) + "].");
        const auto bytes = write(pipe, buffer + count, size - count);
        if (bytes < 0)
        {
            if (errno == EINTR || errno == EAGAIN)
                continue;

            Log::syserror("Failed to write to pipe. Data: [" + std::string(buffer, size) + "].");
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

/// Reads a single line from a pipe.
/// Returns 0 for timeout, <0 for error, and >0 on success.
/// On success, line will contain the read message.
int PipeReader::readLine(std::string& line,
                         const std::function<bool()>& stopPredicate)
{
    const char *endOfLine = static_cast<const char *>(std::memchr(_data.data(), '\n', _data.size()));
    if (endOfLine != nullptr)
    {
        // We have a line cached, return it.
        line += std::string(_data.data(), endOfLine);
        _data.erase(0, endOfLine - _data.data() + 1); // Including the '\n'.
        Log::trace() << "Read existing line from pipe: " << _name << ", line: ["
                     << line << "], data: [" << Util::formatLinesForLog(_data) << "]." << Log::end;
        return 1;
    }

    // Poll in short intervals to check for stop condition.
    const auto pollTimeoutMs = 500;
    auto maxPollCount = POLL_TIMEOUT_MS / pollTimeoutMs;
    while (maxPollCount-- > 0)
    {
        if (stopPredicate())
        {
            Log::info() << "Stop requested for pipe: " << _name << '.' << Log::end;
            return -1;
        }

        struct pollfd pipe;
        pipe.fd = _pipe;
        pipe.events = POLLIN;
        pipe.revents = 0;
        const int ready = poll(&pipe, 1, pollTimeoutMs);
        if (ready == 0)
        {
            // Timeout.
            continue;
        }
        else if (ready < 0)
        {
            // error.
            return ready;
        }
        else if (pipe.revents & (POLLIN | POLLPRI))
        {
            char buffer[READ_BUFFER_SIZE];
            const auto bytes = readFIFO(_pipe, buffer, sizeof(buffer));
            Log::trace() << "readFIFO for pipe: " << _name << " returned: " << bytes << Log::end;
            if (bytes < 0)
            {
                return -1;
            }

            endOfLine = static_cast<const char *>(std::memchr(buffer, '\n', bytes));
            if (endOfLine != nullptr)
            {
                // Got end of line.
                line = _data;
                const auto tail = std::string(static_cast<const char*>(buffer), endOfLine);
                line += tail;
                _data = std::string(endOfLine + 1, bytes - tail.size() - 1); // Exclude the '\n'.
                Log::trace() << "Read line from pipe: " << _name << ", line: [" << line
                             << "], data: [" << Util::formatLinesForLog(_data) << "]." << Log::end;
                return 1;
            }
            else
            {
                // More data, keep going.
                _data += std::string(buffer, bytes);
                Log::trace() << "data appended to pipe: " << _name << ", data: " << _data << Log::end;
            }
        }
        else if (pipe.revents & (POLLERR | POLLHUP | POLLNVAL))
        {
            return -1;
        }
    }

    // Timeout.
    return 0;
}

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
