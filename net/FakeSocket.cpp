/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <errno.h>
#include <fcntl.h>

#include <condition_variable>
#include <mutex>
#include <vector>

#ifdef TEST
#include <iostream>
#define MOBILEAPP
#endif

#include "FakeSocket.hpp"

struct FakeSocketPair
{
    int fd[2];
    bool listening;
    int connectingFd;
    bool nonblocking[2];
    std::vector<char> buffer[2];
    int readp[2];
    std::mutex *mutex;
    std::condition_variable *cv;

    FakeSocketPair()
    {
        fd[0] = -1;
        fd[1] = -1;
        listening = false;
        readp[0] = readp[1] = 0;
        mutex = new std::mutex();
        cv = new std::condition_variable();
    }
};

static std::mutex fdsMutex;

static std::vector<FakeSocketPair> fds;

int fakeSocketSocket(int domain, int type, int protocol)
{
    if (domain == AF_INET && (type & ~SOCK_NONBLOCK) == SOCK_STREAM && protocol == 0)
    {
        std::lock_guard<std::mutex> fdsLock(fdsMutex);
        size_t i;
        for (i = 0; i < fds.size(); i++)
        {
            if (fds[i].fd[0] == -1 && fds[i].fd[1] == -1)
                break;
        }
        if (i == fds.size())
            fds.resize(fds.size() + 1);

        FakeSocketPair& result = fds[i];

        result.fd[0] = i*2;
        result.fd[1] = -1;
        result.listening = false;
        result.nonblocking[0] = !!(type & SOCK_NONBLOCK);
        result.buffer[0].resize(0);
        result.buffer[1].resize(0);

        return i*2;
    }

    errno = EACCES;
    return -1;
}

int fakeSocketPipe2(int pipefd[2], int flags)
{
    pipefd[0] = fakeSocketSocket(AF_INET, SOCK_STREAM, ((flags & O_NONBLOCK) ? SOCK_NONBLOCK : 0));

    FakeSocketPair& pair = fds[pipefd[0]/2];

    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);

    assert(pair.fd[0] == pipefd[0]);

    pair.fd[1] = pair.fd[0] + 1;
    pair.nonblocking[1] = pair.nonblocking[0];
    pipefd[1] = pair.fd[1];

    return 0;
}

int fakeSocketPoll(struct pollfd *fds, int nfds, int timeout)
{
    return -1;
}

int fakeSocketListen(int fd, int backlog)
{
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        errno = EBADF;
        return -1;
    }
    
    FakeSocketPair& pair = fds[fd/2];
    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);
    fdsLock.unlock();

    if (fd&1 || pair.fd[1] != -1)
    {
        errno = EISCONN;
        return -1;
    }
    
    if (pair.listening)
    {
        errno = EIO;
        return -1;
    }

    pair.listening = true;
    pair.connectingFd = -1;

    return 0;
}

int fakeSocketConnect(int fd1, int fd2)
{
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd1 < 0 || fd2 < 0 || fd1/2 >= fds.size() || fd2/2 >= fds.size())
    {
        errno = EBADF;
        return -1;
    }
    if (fd1/2 == fd2/2)
    {
        errno = EBADF;
        return -1;
    }

    FakeSocketPair& pair1 = fds[fd1/2];
    FakeSocketPair& pair2 = fds[fd2/2];

    std::unique_lock<std::mutex> fdLock1(pair1.mutex[0]);
    std::unique_lock<std::mutex> fdLock2(pair2.mutex[0]);
    fdsLock.unlock();

    if ((fd1&1) || (fd2&1))
    {
        errno = EISCONN;
        return -1;
    }

    if (!pair2.listening || pair2.connectingFd != -1)
    {
        errno = ECONNREFUSED;
        return -1;
    }

    pair2.connectingFd = fd1;
    pair2.cv->notify_all();

    fdLock2.unlock();
    while (pair1.fd[1] == -1)
        pair1.cv->wait(fdLock1);

    assert(pair1.fd[1] == pair1.fd[0] + 1);

    return 0;
}

int fakeSocketAccept4(int fd, struct sockaddr *addr, socklen_t *addrlen, int flags)
{
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        errno = EBADF;
        return -1;
    }

    if (fd & 1)
    {
        errno = EISCONN;
        return -1;
    }

    FakeSocketPair& pair = fds[fd/2];

    if (!pair.listening)
    {
        errno = EIO;
        return -1;
    }

    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);
    fdsLock.unlock();

    while (pair.connectingFd == -1)
        pair.cv->wait(fdLock);
    
    assert(pair.connectingFd >= 0 && pair.connectingFd/2 < fds.size());

    FakeSocketPair& pair1 = fds[pair.connectingFd/2];
    
    std::unique_lock<std::mutex> fdLock1(pair1.mutex[0]);

    assert(pair1.fd[1] == -1);
    assert(pair1.fd[0] == pair.connectingFd);

    pair.connectingFd = -1;
    fdLock.unlock();

    pair1.fd[1] = pair1.fd[0] + 1;

    pair1.cv->notify_one();

    return pair1.fd[1];
}

ssize_t fakeSocketRead(int fd, void *buf, size_t nbytes)
{
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        errno = EBADF;
        return -1;
    }

    FakeSocketPair& pair = fds[fd/2];

    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);
    fdsLock.unlock();

    // K: for this fd
    const int K = (fd&1);

    if (pair.nonblocking[K])
    {
        if (pair.fd[K] == -1)
        {
            errno = EBADF;
            return -1;
        }

        if (pair.buffer[K].size() == 0)
        {
            errno = EAGAIN;
            return -1;
        }
    }
    else
    {
        while (pair.fd[K] != -1 && pair.buffer[K].size() == 0)
            pair.cv->wait(fdLock);

        if (pair.fd[K] == -1)
        {
            errno = EBADF;
            return -1;
        }
    }

    ssize_t result = std::min(nbytes, pair.buffer[K].size() - pair.readp[K]);

    memmove(buf, pair.buffer[K].data() + pair.readp[K], result);
    if (pair.readp[K] + result < pair.buffer[K].size())
        pair.readp[K] += result;
    else
        pair.buffer[K].resize(0);

    pair.cv->notify_one();

    return nbytes;
}

ssize_t fakeSocketWrite(int fd, const void *buf, size_t nbytes)
{
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        errno = EBADF;
        return -1;
    }

    FakeSocketPair& pair = fds[fd/2];

    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);
    fdsLock.unlock();

    // K: for this fd
    // N: for its peer, whose read buffer we want to write into
    const int K = (fd&1);
    const int N = 1 - K;

    if (pair.nonblocking[K])
    {
        if (pair.fd[K] == -1)
        {
            errno = EBADF;
            return -1;
        }

        if (pair.buffer[N].size() != 0)
        {
            errno = EAGAIN;
            return -1;
        }
    }
    else
    {
        while (pair.fd[K] != -1 && pair.buffer[N].size() != 0)
            pair.cv->wait(fdLock);

        if (pair.fd[K] == -1)
        {
            errno = EBADF;
            return -1;
        }
    }

    pair.buffer[N].resize(nbytes);
    memmove(pair.buffer[N].data(), buf, nbytes);
    pair.readp[N] = 0;

    pair.cv->notify_one();

    return nbytes;
}

int fakeSocketClose(int fd)
{
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        errno = EBADF;
        return -1;
    }

    FakeSocketPair& pair = fds[fd/2];

    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);
    fdsLock.unlock();

    assert(pair.fd[fd&1] == fd);

    pair.fd[fd&1] = -1;

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
