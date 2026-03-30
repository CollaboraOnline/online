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

/*
 * Socket API emulation for mobile platforms (iOS/Android).
 * Functions: fakeSocket* family (Socket, Poll, Listen, Connect, etc.)
 */

#pragma once

#include <common/Util.hpp>

#if MOBILEAPP

#include <string>

#ifndef _WIN32
#include <poll.h>
#endif

EXTERNC
void fakeSocketSetLoggingCallback(void (*)(const std::string&));

EXTERNC
int fakeSocketSocket();

EXTERNC
int fakeSocketPipe2(int pipefd[2]);

EXTERNC
void fakeSocketWaitAny(int timeoutUs);

EXTERNC
int fakeSocketPoll(struct pollfd *fds, int nfds, int timeout);

EXTERNC
int fakeSocketListen(int fd);

EXTERNC
int fakeSocketConnect(int fd1, int fd2);

EXTERNC
int fakeSocketAccept4(int fd);

EXTERNC
int fakeSocketPeer(int fd);

EXTERNC
ssize_t fakeSocketAvailableDataLength(int fd);

EXTERNC
ssize_t fakeSocketRead(int fd, void *buf, size_t nbytes);

EXTERNC
ssize_t fakeSocketWrite(int fd, const void *buf, size_t nbytes);

EXTERNC
int fakeSocketShutdown(int fd);

EXTERNC
int fakeSocketClose(int fd);

EXTERNC
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

inline ssize_t fakeSocketWriteQueue(int fd, const void *buf, size_t nbytes)
{
    return fakeSocketWrite(fd, buf, nbytes);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
