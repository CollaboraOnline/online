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

#include <chrono>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>
#include <vector>

#include "FakeSocket.hpp"

struct FakeSocketPair
{
    int fd[2];
    bool listening;
    int connectingFd;
    std::vector<char> buffer[2];
    std::mutex *mutex;
    // std::condition_variable *cv;

    FakeSocketPair()
    {
        fd[0] = -1;
        fd[1] = -1;
        listening = false;
        connectingFd = -1;
        mutex = new std::mutex();
        // cv = new std::condition_variable();
    }
};

static std::mutex fdsMutex;
static std::condition_variable cv;

// Avoid problems with order of initialisation of static globals.
static std::vector<FakeSocketPair>& getFds()
{
    static std::vector<FakeSocketPair> fds;

    return fds;
}

int fakeSocketSocket()
{
    std::vector<FakeSocketPair>& fds = getFds();
    std::cerr << "----- &fds=" << &fds << " size=" << fds.size() << std::endl;

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
    result.connectingFd = -1;
    result.buffer[0].resize(0);
    result.buffer[1].resize(0);

    std::cerr << "+++++ Created a FakeSocket " << i*2 << "\n";

    return i*2;
}

int fakeSocketPipe2(int pipefd[2])
{
    pipefd[0] = fakeSocketSocket();
    assert(pipefd[0] >= 0);

    std::vector<FakeSocketPair>& fds = getFds();
    FakeSocketPair& pair = fds[pipefd[0]/2];

    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);

    assert(pair.fd[0] == pipefd[0]);

    pair.fd[1] = pair.fd[0] + 1;
    pipefd[1] = pair.fd[1];

    std::cerr << "+++++ Created a FakeSocket pipe (" << pipefd[0] << "," << pipefd[1] << ")\n";

    return 0;
}

static bool someFdReadable(struct pollfd *pollfds, int nfds)
{
    std::vector<FakeSocketPair>& fds = getFds();
    bool retval = false;
    for (int i = 0; i < nfds; i++)
    {
        pollfds[i].revents = 0;
        const int K = ((pollfds[i].fd)&1);
        if (pollfds[i].events & POLLIN)
            if (fds[pollfds[i].fd/2].fd[K] != -1 && fds[pollfds[i].fd/2].buffer[K].size() > 0)
            {
                pollfds[i].revents = POLLIN;
                retval = true;
            }
    }
    return retval;
}

int fakeSocketPoll(struct pollfd *pollfds, int nfds, int timeout)
{
    std::cerr << "+++++ Polling " << nfds << " fds: ";
    for (int i = 0; i < nfds; i++)
    {
        if (i > 0)
            std::cerr << ",";
        std::cerr << pollfds[i].fd;
    }
    std::cerr << "\n";

    std::vector<FakeSocketPair>& fds = getFds();
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    for (int i = 0; i < nfds; i++)
    {
        if (pollfds[i].fd < 1 || pollfds[i].fd/2 >= fds.size())
        {
            errno = EBADF;
            return -1;
        }
    }
    // Here we lock just the first FakeSocketPair struct, hmm
    std::unique_lock<std::mutex> fdLock(fds[pollfds[0].fd/2].mutex[0]);
    fdsLock.unlock();

    while (!someFdReadable(pollfds, nfds))
        cv.wait(fdLock);

    return 0;
}

int fakeSocketListen(int fd)
{
    std::vector<FakeSocketPair>& fds = getFds();
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        std::cerr << "+++++ EBADF: Listening on fd " << fd << "\n";
        errno = EBADF;
        return -1;
    }
    
    FakeSocketPair& pair = fds[fd/2];
    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);
    fdsLock.unlock();

    if (fd&1 || pair.fd[1] != -1)
    {
        std::cerr << "+++++ EISCONN: Listening on fd " << fd << "\n";
        errno = EISCONN;
        return -1;
    }
    
    if (pair.listening)
    {
        std::cerr << "+++++ EIO: Listening on fd " << fd << "\n";
        errno = EIO;
        return -1;
    }

    pair.listening = true;
    pair.connectingFd = -1;

    std::cerr << "+++++ Listening on fd " << fd << "\n";

    return 0;
}

int fakeSocketConnect(int fd1, int fd2)
{
    std::vector<FakeSocketPair>& fds = getFds();
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd1 < 0 || fd2 < 0 || fd1/2 >= fds.size() || fd2/2 >= fds.size())
    {
        std::cerr << "+++++ EBADF: Connect fd " << fd1 << " to " << fd2 << "\n";
        errno = EBADF;
        return -1;
    }
    if (fd1/2 == fd2/2)
    {
        std::cerr << "+++++ EBADF: Connect fd " << fd1 << " to " << fd2 << "\n";
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
        std::cerr << "+++++ EISCONN: Connect fd " << fd1 << " to " << fd2 << "\n";
        errno = EISCONN;
        return -1;
    }

    if (!pair2.listening || pair2.connectingFd != -1)
    {
        std::cerr << "+++++ ECONNREFUSED: Connect fd " << fd1 << " to " << fd2 << "\n";
        errno = ECONNREFUSED;
        return -1;
    }

    pair2.connectingFd = fd1;
    // pair2.cv->notify_all();
    cv.notify_all();

    fdLock2.unlock();
    while (pair1.fd[1] == -1)
        // pair1.cv->wait(fdLock1);
        cv.wait(fdLock1);

    assert(pair1.fd[1] == pair1.fd[0] + 1);

    std::cerr << "+++++ Connect fd " << fd1 << " to " << fd2 << "\n";

    return 0;
}

int fakeSocketAccept4(int fd, int flags)
{
    std::vector<FakeSocketPair>& fds = getFds();
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        std::cerr << "+++++ EBADF: Accept fd " << fd << "\n";
        errno = EBADF;
        return -1;
    }

    if (fd & 1)
    {
        std::cerr << "+++++ EISCONN: Accept fd " << fd << "\n";
        errno = EISCONN;
        return -1;
    }

    FakeSocketPair& pair = fds[fd/2];

    if (!pair.listening)
    {
        std::cerr << "+++++ EIO: Accept fd " << fd << "\n";
        errno = EIO;
        return -1;
    }

    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);
    fdsLock.unlock();

    while (pair.connectingFd == -1)
        // pair.cv->wait(fdLock);
        cv.wait(fdLock);
    
    assert(pair.connectingFd >= 0 && pair.connectingFd/2 < fds.size());

    FakeSocketPair& pair1 = fds[pair.connectingFd/2];
    
    std::unique_lock<std::mutex> fdLock1(pair1.mutex[0]);

    assert(pair1.fd[1] == -1);
    assert(pair1.fd[0] == pair.connectingFd);

    pair.connectingFd = -1;
    fdLock.unlock();

    pair1.fd[1] = pair1.fd[0] + 1;

    // pair1.cv->notify_one();
    cv.notify_one();

    std::cerr << "+++++ Accept fd " << fd << ": " << pair1.fd[1] << "\n";

    return pair1.fd[1];
}

int fakeSocketPeer(int fd)
{
    std::vector<FakeSocketPair>& fds = getFds();
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        errno = EBADF;
        return -1;
    }

    FakeSocketPair& pair = fds[fd/2];

    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);
    fdsLock.unlock();

    const int K = (fd&1);
    const int N = 1 - K;

    return pair.fd[N];
}

ssize_t fakeSocketAvailableDataLength(int fd)
{
    std::vector<FakeSocketPair>& fds = getFds();
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

    return pair.buffer[K].size();
}

ssize_t fakeSocketRead(int fd, void *buf, size_t nbytes)
{
    std::vector<FakeSocketPair>& fds = getFds();
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        std::cerr << "+++++ EBADF: Read from fd " << fd << ", " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";
        errno = EBADF;
        return -1;
    }

    FakeSocketPair& pair = fds[fd/2];

    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);
    fdsLock.unlock();

    // K: for this fd
    const int K = (fd&1);

    if (pair.fd[K] == -1)
    {
        std::cerr << "+++++ EBADF: Read from fd " << fd << ", " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";
        errno = EBADF;
        return -1;
    }

    if (pair.buffer[K].size() == 0)
    {
        std::cerr << "+++++ EAGAIN: Read from fd " << fd << ", " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";
        errno = EAGAIN;
        return -1;
    }

    // These sockets are record-oriented!
    ssize_t result = pair.buffer[K].size();
    if (nbytes < result)
    {
        std::cerr << "+++++ EAGAIN: Read from fd " << fd << ", " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";
        errno = EAGAIN; // Not the right errno, but what would be?q
        return -1;
    }

    memmove(buf, pair.buffer[K].data(), result);
    pair.buffer[K].resize(0);

    // pair.cv->notify_one();
    cv.notify_one();

    std::cerr << "+++++ Read from fd " << fd << ": " << result << (result == 1 ? " byte" : " bytes") << "\n";

    return result;
}

ssize_t fakeSocketFeed(int fd, const void *buf, size_t nbytes)
{
    std::vector<FakeSocketPair>& fds = getFds();
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        std::cerr << "+++++ EBADF: Feed to fd " << fd << ", " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";
        errno = EBADF;
        return -1;
    }

    FakeSocketPair& pair = fds[fd/2];

    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);
    fdsLock.unlock();

    // K: for this fd, whose read buffer we want to write into
    const int K = (fd&1);

    if (pair.fd[K] == -1)
    {
        std::cerr << "+++++ EBADF: Feed to fd " << fd << ", " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";
        errno = EBADF;
        return -1;
    }

    if (pair.buffer[K].size() != 0)
    {
        std::cerr << "+++++ EAGAIN: Feed to fd " << fd << ", " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";
        errno = EAGAIN;
        return -1;
    }

    pair.buffer[K].resize(nbytes);
    memmove(pair.buffer[K].data(), buf, nbytes);

    // pair.cv->notify_one();
    cv.notify_one();

    std::cerr << "+++++ Feed to fd " << fd << ": " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";

    return nbytes;
}

ssize_t fakeSocketWrite(int fd, const void *buf, size_t nbytes)
{
    std::vector<FakeSocketPair>& fds = getFds();
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        std::cerr << "+++++ EBADF: Write to fd " << fd << ", " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";
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

    if (pair.fd[K] == -1)
    {
        std::cerr << "+++++ EBADF: Write to fd " << fd << ", " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";
        errno = EBADF;
        return -1;
    }

    if (pair.buffer[N].size() != 0)
    {
        std::cerr << "+++++ EAGAIN: Write to fd " << fd << ", " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";
        errno = EAGAIN;
        return -1;
    }

    pair.buffer[N].resize(nbytes);
    memmove(pair.buffer[N].data(), buf, nbytes);

    // pair.cv->notify_one();
    cv.notify_one();

    std::cerr << "+++++ Write to fd " << fd << ": " << nbytes << (nbytes == 1 ? " byte" : " bytes") << "\n";
    return nbytes;
}

int fakeSocketClose(int fd)
{
    std::vector<FakeSocketPair>& fds = getFds();
    std::unique_lock<std::mutex> fdsLock(fdsMutex);
    if (fd < 0 || fd/2 >= fds.size())
    {
        std::cerr << "+++++ EBADF: Close fd " << fd << "\n";
        errno = EBADF;
        return -1;
    }

    FakeSocketPair& pair = fds[fd/2];

    std::unique_lock<std::mutex> fdLock(pair.mutex[0]);
    fdsLock.unlock();

    assert(pair.fd[fd&1] == fd);

    pair.fd[fd&1] = -1;

    std::cerr << "+++++ Close fd " << fd << "\n";

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
