/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_FAKESOCKET_H
#define INCLUDED_FAKESOCKET_H

#ifdef MOBILEAPP

#include <poll.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

#ifndef SOCK_NONBLOCK
#define SOCK_NONBLOCK 0x100
#endif

int fakeSocketSocket(int domain, int type, int protocol);

int fakeSocketPipe2(int pipefd[2], int flags);

int fakeSocketPoll(struct pollfd *fds, int nfds, int timeout);

int fakeSocketListen(int fd, int backlog);

int fakeSocketConnect(int fd1, int fd2);

int fakeSocketAccept4(int fd, struct sockaddr *addr, socklen_t *addrlen, int flags);

ssize_t fakeSocketAvailableDataLength(int fd);

ssize_t fakeSocketRead(int fd, void *buf, size_t nbytes);

ssize_t fakeSocketWrite(int fd, const void *buf, size_t nbytes);

int fakeSocketClose(int fd);

inline int socket(int domain, int type, int protocol)
{
    return fakeSocketSocket(domain, type, protocol);
}

inline int pipe2(int pipefd[2], int flags)
{
    return fakeSocketPipe2(pipefd, flags);
}

inline int poll(struct pollfd *fds, int nfds, int timeout)
{
    return fakeSocketPoll(fds, nfds, timeout);
}

inline int listen(int fd, int backlog)
{
    return fakeSocketListen(fd, backlog);
}

inline int accept4(int fd, struct sockaddr *addr, socklen_t *addrlen, int flags)
{
    return fakeSocketAccept4(fd, addr, addrlen, flags);
}

inline ssize_t read(int fd, void *buf, size_t nbytes)
{
    return fakeSocketRead(fd, buf, nbytes);
}

inline ssize_t write(int fd, const void *buf, size_t nbytes)
{
    return fakeSocketWrite(fd, buf, nbytes);
}

inline int close(int fd)
{
    return fakeSocketClose(fd);
}

#endif // MOBILEAPP

#endif // INCLUDED_FAKESOCKET_H

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
