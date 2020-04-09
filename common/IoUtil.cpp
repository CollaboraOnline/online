/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "IoUtil.hpp"

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
#include <Poco/Thread.h>
#include <Poco/URI.h>

#include "Common.hpp"
#include "Protocol.hpp"
#include "LOOLWebSocket.hpp"
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
    static const Poco::Timespan waitTime(POLL_TIMEOUT_MICRO_S);
    int flags = 0;
    int n = -1;
    bool stop = false;
    std::vector<char> payload(READ_BUFFER_SIZE);
    payload.resize(0);
    try
    {
        // We poll, no need for timeout.
        ws->setReceiveTimeout(0);

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
                // If SELECT_READ fails, it might mean the socket is in error.
                if (ws->poll(Poco::Timespan(0), Poco::Net::Socket::SELECT_ERROR))
                {
                    LOG_WRN("SocketProcessor [" << name << "]: Socket error.");
                    closeFrame();
                    break;
                }

                // Wait some more.
                continue;
            }

            try
            {
                payload.resize(payload.capacity());
                n = -1; // In case receiveFrame throws we log dropped data below.
                (void)n;
                n = ws->receiveFrame(payload.data(), payload.size(), flags);
                payload.resize(std::max(n, 0));
            }
            catch (const Poco::TimeoutException&)
            {
                LOG_DBG("SocketProcessor [" << name << "]: Spurious TimeoutException, ignored");
                continue;
            }

            if (n == 0 || ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_CLOSE))
            {
                LOG_WRN("SocketProcessor [" << name << "]: Connection closed.");
                closeFrame();
                break;
            }
            else if (n < 0)
            {
                LOG_DBG("SocketProcessor [" << name << "]: was not an interesting frame, nothing to do here");
                continue;
            }

            LOG_CHECK(n > 0);

            if ((flags & WebSocket::FrameFlags::FRAME_FLAG_FIN) != WebSocket::FrameFlags::FRAME_FLAG_FIN)
            {
                // One WS message split into multiple frames.
                // TODO: Is this even possible with Poco if we never construct such messages ourselves?
                LOG_WRN("SocketProcessor [" << name << "]: Receiving multi-part frame.");
                while (true)
                {
                    char buffer[READ_BUFFER_SIZE];
                    n = ws->receiveFrame(buffer, sizeof(buffer), flags);
                    if (n == 0 || (flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_CLOSE)
                    {
                        LOG_WRN("SocketProcessor [" << name << "]: Connection closed while reading multiframe message.");
                        closeFrame();
                        break;
                    }
                    else if (n < 0)
                    {
                        LOG_DBG("SocketProcessor [" << name << "]: was not an interesting frame, nothing to do here");
                        continue;
                    }

                    payload.insert(payload.end(), buffer, buffer + n);
                    if ((flags & WebSocket::FrameFlags::FRAME_FLAG_FIN) == WebSocket::FrameFlags::FRAME_FLAG_FIN)
                    {
                        // No more frames.
                        break;
                    }
                }
            }

            LOG_CHECK(n > 0);

            // Call the handler.
            const bool success = handler(payload);
            payload.resize(0);

            if (!success)
            {
                LOG_INF("SocketProcessor [" << name << "]: Handler flagged to finish.");
                break;
            }

            if (payload.capacity() > READ_BUFFER_SIZE * 4)
            {
                LOG_INF("Compacting buffer of SocketProcessor [" << name << "] from " <<
                        payload.capacity() / 1024 << "KB to " << READ_BUFFER_SIZE / 1024 << "KB.");
                payload = std::vector<char>(READ_BUFFER_SIZE);
                payload.resize(0);
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

ssize_t writeToPipe(int pipe, const char* buffer, ssize_t size)
{
    ssize_t count = 0;
    for (;;)
    {
        LOG_TRC("Writing to pipe. Data: [" << Util::formatLinesForLog(std::string(buffer, size)) << "].");
        const ssize_t bytes = write(pipe, buffer + count, size - count);
        if (bytes < 0)
        {
            if (errno == EINTR || errno == EAGAIN)
            {
                continue;
            }

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
    const int pollTimeoutMs = 500;
    int maxPollCount = std::max<int>((POLL_TIMEOUT_MICRO_S / 1000) / pollTimeoutMs, 1);
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
            const ssize_t bytes = readFromPipe(_pipe, buffer, sizeof(buffer));
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
                const std::string tail(static_cast<const char*>(buffer), endOfLine);
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
