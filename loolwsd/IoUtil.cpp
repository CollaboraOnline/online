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

#include <Poco/Exception.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Thread.h>

#include "Common.hpp"
#include "IoUtil.hpp"
#include "Util.hpp"

namespace IoUtil
{

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
