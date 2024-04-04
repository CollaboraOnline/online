/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

class RandomStream : public Socket
{
    int _devFd;
public:
    RandomStream(const int randomFd)
        : Socket(randomFd, Socket::Type::Unix)
    {
        _devFd = open("/dev/urandom", O_RDONLY);
        if (_devFd < 0)
            LOG_SYS("Failed to open /dev/urandom for reading: ");
    }
    ~RandomStream()
    {
        close(_devFd);
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t & /* timeoutMaxMicroS */) override
    {
        return POLLOUT;
    }

    void handlePoll(SocketDisposition & /* disposition */,
                    std::chrono::steady_clock::time_point /* now */,
                    int events) override
    {
        if (events | POLLOUT)
        {
            char buffer[256];
            int len = read(_devFd, buffer, sizeof(buffer));
            if (len <= 0)
            {
                LOG_SYS("Failed to read bytes from random device");
            }
            else
            {
                // short reads & writes are no problem - we just spin again.
                int lenWritten = write(getFD(), buffer, len);
                if (lenWritten < 0)
                    LOG_SYS("Error writing to fifo");
                LOG_TRC("Wrote hard randomness to #" << getFD() << " of length " <<
                        len << " with " << lenWritten << " bytes written");
            }
        }
        // else HUP etc.
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
