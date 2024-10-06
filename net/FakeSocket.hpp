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

#include "Util.hpp"

#if MOBILEAPP

#include <string>

#include <poll.h>

#ifndef __linux__
#  ifndef SOCK_NONBLOCK
#    define SOCK_NONBLOCK 0x100
#  endif
#  ifndef SOCK_CLOEXEC
#    define SOCK_CLOEXEC 0x200
#  endif
#endif

void fakeSocketSetLoggingCallback(void (*)(const std::string&));

int fakeSocketSocket();

int fakeSocketPipe2(int pipefd[2]);

int fakeSocketPoll(struct pollfd *fds, int nfds, int timeout);

int fakeSocketListen(int fd);

int fakeSocketConnect(int fd1, int fd2);

int fakeSocketAccept4(int fd);

int fakeSocketPeer(int fd);

ssize_t fakeSocketAvailableDataLength(int fd);

ssize_t fakeSocketRead(int fd, void *buf, size_t nbytes);

ssize_t fakeSocketWrite(int fd, const void *buf, size_t nbytes);

int fakeSocketShutdown(int fd);

int fakeSocketClose(int fd);

void fakeSocketDumpState();

#else

inline void fakeSocketSetLoggingCallback(void (*)(const std::string&))
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
}

inline int fakeSocketSocket()
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

inline int fakeSocketPipe2(int[2])
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

inline int fakeSocketPoll(struct pollfd*, int, int)
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

inline int fakeSocketListen(int)
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

inline int fakeSocketConnect(int, int)
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

inline int fakeSocketAccept4(int)
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

inline int fakeSocketPeer(int)
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

inline ssize_t fakeSocketAvailableDataLength(int)
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

inline ssize_t fakeSocketRead(int, void*, size_t)
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

inline ssize_t fakeSocketWrite(int, const void*, size_t)
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

inline int fakeSocketShutdown(int)
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

inline int fakeSocketClose(int)
{
    assert(Util::isMobileApp() && "Never used in non-mobile builds");
    return -1;
}

#endif // !MOBILEAPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
