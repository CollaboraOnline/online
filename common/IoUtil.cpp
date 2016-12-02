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
#include <Poco/StringTokenizer.h>
#include <Poco/Thread.h>
#include <Poco/URI.h>

#include "Common.hpp"
#include "Protocol.hpp"
#include <LOOLWebSocket.hpp>
#include "Log.hpp"
#include "Util.hpp"

using Poco::Net::Socket;
using Poco::Net::WebSocket;

namespace IoUtil
{

// Synchronously process LOOLWebSocket requests and dispatch to handler.
// Handler returns false to end.
void SocketProcessor(const std::shared_ptr<LOOLWebSocket>& ws,
                     const std::string& name,
                     const std::function<bool(const std::vector<char>&)>& handler,
                     const std::function<void()>& closeFrame,
                     const std::function<bool()>& stopPredicate)
{
    LOG_INF("SocketProcessor [" << name << "] starting.");

    // Timeout given is in microseconds.
    static const Poco::Timespan waitTime(POLL_TIMEOUT_MS * 1000);
    const auto bufferSize = READ_BUFFER_SIZE * 100;
    int flags = 0;
    int n = -1;
    bool stop = false;
    std::vector<char> payload(bufferSize);
    try
    {
        ws->setReceiveTimeout(0);

        payload.resize(0);

        for (;;)
        {
            stop = stopPredicate();
            if (stop)
            {
                LOG_INF("SocketProcessor [" << name << "]: Stop flagged.");
                break;
            }

            if (!ws->poll(waitTime, Poco::Net::Socket::SELECT_READ) ||
                stopPredicate())
            {
                // Wait some more.
                continue;
            }

            try
            {
                payload.resize(payload.capacity());
                n = -1;
                n = ws->receiveFrame(payload.data(), payload.capacity(), flags);
                payload.resize(n > 0 ? n : 0);
            }
            catch (const Poco::TimeoutException&)
            {
                LOG_DBG("SocketProcessor [" << name << "]: Spurious TimeoutException, ignored");
                continue;
            }

            if (n == -1)
            {
                LOG_DBG("SocketProcessor [" << name << "]: was not an interesting frame, nothing to do here");
                continue;
            }
            else if (n == 0 || ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_CLOSE))
            {
                LOG_WRN("SocketProcessor [" << name << "]: Connection closed.");
                closeFrame();
                break;
            }

            assert(n > 0);

            const std::string firstLine = LOOLProtocol::getFirstLine(payload);
            if ((flags & WebSocket::FrameFlags::FRAME_FLAG_FIN) != WebSocket::FrameFlags::FRAME_FLAG_FIN)
            {
                // One WS message split into multiple frames.
                // TODO: Is this even possible with Poco if we never construct such messages outselves?
                LOG_WRN("SocketProcessor [" << name << "]: Receiving multi-parm frame.");
                while (true)
                {
                    char buffer[READ_BUFFER_SIZE * 10];
                    n = ws->receiveFrame(buffer, sizeof(buffer), flags);
                    if (n <= 0 || (flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_CLOSE)
                    {
                        LOG_WRN("SocketProcessor [" << name << "]: Connection closed while reading multiframe message.");
                        closeFrame();
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
                // Check if it is a "nextmessage:" and in that case read the large
                // follow-up message separately, and handle that only.
                if (tokens.count() == 2 && tokens[0] == "nextmessage:" &&
                    LOOLProtocol::getTokenInteger(tokens[1], "size", size) && size > 0)
                {
                    LOG_TRC("SocketProcessor [" << name << "]: Getting large message of " << size << " bytes.");
                    if (size > MAX_MESSAGE_SIZE)
                    {
                        LOG_ERR("SocketProcessor [" << name << "]: Large-message size (" << size << ") over limit or invalid.");
                    }
                    else
                    {
                        payload.resize(size);
                        continue;
                    }
                }
            }

            if (n <= 0 || (flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_CLOSE)
            {
                closeFrame();
                LOG_WRN("SocketProcessor [" << name << "]: Connection closed.");
                break;
            }

            // Call the handler.
            const auto success = handler(payload);
            payload.resize(0);

            if (!success)
            {
                LOG_INF("SocketProcessor [" << name << "]: Handler flagged to finish.");
                break;
            }
        }
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("SocketProcessor [" << name << "]: Exception: " << exc.what());
    }

    if ((flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE && n > 0 && payload.size() > 0)
    {
        std::string msg;
        Poco::URI::encode(std::string(payload.data(), payload.size()), "", msg);
        LOG_WRN("SocketProcessor [" << name << "]: Last message (" << payload.size() <<
                " bytes) will not be processed: [" << msg << "].");
    }

    LOG_INF("SocketProcessor [" << name << "] finished. stop: " << (stop ? "true" : "false") <<
            ", n: " << n << ", payload size: " << payload.size() <<
            ", flags: " << std::hex << flags);
}

void shutdownWebSocket(const std::shared_ptr<LOOLWebSocket>& ws)
{
    try
    {
        // Calling LOOLWebSocket::shutdown, in case of error, would try to send a 'close' frame
        // which won't work in case of broken pipe or timeout from peer. Just close the
        // socket in that case preventing 'close' frame from being sent.
        if (ws && ws->poll(Poco::Timespan(0), Socket::SelectMode::SELECT_ERROR))
            ws->close();
        else if (ws)
            ws->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        LOG_WRN("Util::shutdownWebSocket: Exception: " << exc.displayText() <<
                (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
    }
}

ssize_t writeToPipe(int pipe, const char* buffer, ssize_t size)
{
    ssize_t count = 0;
    while(true)
    {
        LOG_TRC("Writing to pipe. Data: [" << Util::formatLinesForLog(std::string(buffer, size)) << "].");
        const auto bytes = write(pipe, buffer + count, size - count);
        if (bytes < 0)
        {
            if (errno == EINTR || errno == EAGAIN)
                continue;

            LOG_SYS("Failed to write to pipe. Data: [" << std::string(buffer, size) << "].");
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

ssize_t readFromPipe(int pipe, char* buffer, ssize_t size)
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
        LOG_TRC("Read existing line from pipe: " << _name << ", line: [" <<
                line << "], data: [" << Util::formatLinesForLog(_data) << "].");
        return 1;
    }

    // Poll in short intervals to check for stop condition.
    const auto pollTimeoutMs = 500;
    auto maxPollCount = std::max<int>(POLL_TIMEOUT_MS / pollTimeoutMs, 1);
    while (maxPollCount-- > 0)
    {
        if (stopPredicate())
        {
            LOG_INF("Stop requested for pipe: " << _name << '.');
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
            if (errno != EINTR)
            {
                LOG_SYS("Pipe polling failed.");
            }

            return ready;
        }
        else if (pipe.revents & (POLLIN | POLLPRI))
        {
            char buffer[READ_BUFFER_SIZE];
            const auto bytes = readFromPipe(_pipe, buffer, sizeof(buffer));
            LOG_TRC("readFromPipe for pipe: " << _name << " returned: " << bytes);
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
                LOG_TRC("Read line from pipe: " << _name << ", line: [" << line <<
                        "], data: [" << Util::formatLinesForLog(_data) << "].");
                return 1;
            }
            else
            {
                // More data, keep going.
                _data += std::string(buffer, bytes);
                LOG_TRC("data appended to pipe: " << _name << ", data: " << _data);
            }
        }
        else if (pipe.revents & (POLLERR | POLLHUP | POLLNVAL))
        {
            LOG_FTL("Pipe closed.");
            return -1;
        }
    }

    // Timeout.
    return 0;
}

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
