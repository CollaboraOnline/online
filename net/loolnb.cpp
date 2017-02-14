/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <unistd.h>

#include <poll.h>

#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>

#include <atomic>
#include <cassert>
#include <cerrno>
#include <clocale>
#include <condition_variable>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <fstream>
#include <functional>
#include <iostream>
#include <map>
#include <mutex>
#include <sstream>
#include <thread>

#include <Poco/Net/SocketAddress.h>

#include "Common.hpp"

using Poco::Net::SocketAddress;

constexpr int PortNumber = 9191;

/// A non-blocking, streaming socket.
class Socket
{
public:
    Socket() :
        _fd(socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0))
    {
    }

    ~Socket()
    {
        //TODO: Should we shutdown here or up to the client?

        // Doesn't block on sockets; no error handling needed.
        close(_fd);
    }

    // Returns the OS native socket fd.
    int fd() const { return _fd; }

    /// Sets the send buffer in size bytes.
    /// Must be called before accept or connect.
    /// Note: TCP will allocate twice this size for admin purposes,
    /// so a subsequent call to getSendBufferSize will return
    /// the larger (actual) buffer size, if this succeeds.
    /// Note: the upper limit is set via /proc/sys/net/core/wmem_max,
    /// and there is an unconfigurable lower limit as well.
    /// Returns true on success only.
    bool setSendBufferSize(const int size)
    {
        constexpr unsigned int len = sizeof(size);
        const int rc = ::setsockopt(_fd, SOL_SOCKET, SO_SNDBUF, &size, len);
        return (rc == 0);
    }

    /// Gets the actual send buffer size in bytes, -1 for failure.
    int getSendBufferSize() const
    {
        int size;
        unsigned int len = sizeof(size);
        const int rc = ::getsockopt(_fd, SOL_SOCKET, SO_SNDBUF, &size, &len);
        return (rc == 0 ? size : -1);
    }

    /// Sets the receive buffer size in bytes.
    /// Must be called before accept or connect.
    /// Note: TCP will allocate twice this size for admin purposes,
    /// so a subsequent call to getSendBufferSize will return
    /// the larger (actual) buffer size, if this succeeds.
    /// Note: the upper limit is set via /proc/sys/net/core/rmem_max,
    /// and there is an unconfigurable lower limit as well.
    /// Returns true on success only.
    bool setReceiveBufferSize(const int size)
    {
        constexpr unsigned int len = sizeof(size);
        const int rc = ::setsockopt(_fd, SOL_SOCKET, SO_RCVBUF, &size, len);
        return (rc == 0);
    }

    /// Gets the actual receive buffer size in bytes, -1 on error.
    int getReceiveBufferSize() const
    {
        int size;
        unsigned int len = sizeof(size);
        const int rc = ::getsockopt(_fd, SOL_SOCKET, SO_RCVBUF, &size, &len);
        return (rc == 0 ? size : -1);
    }

    /// Gets the error code.
    /// Sets errno on success and returns it.
    /// Returns -1 on failure to get the error code.
    int getError() const
    {
        int error;
        unsigned int len = sizeof(error);
        const int rc = ::getsockopt(_fd, SOL_SOCKET, SO_ERROR, &error, &len);
        if (rc == 0)
        {
            // Set errno so client can use strerror etc.
            errno = error;
            return error;
        }

        return rc;
    }

    /// Connect to a server address.
    /// Does not retry on error.
    /// timeoutMs can be 0 to avoid waiting, or -1 to wait forever.
    /// Returns true on success only.
    /// Note: when succceeds, caller must check for
    /// EINPROGRESS and poll for write, then getError(),
    /// only when the latter returns 0 we are connected.
    bool connect(const SocketAddress& address, const int timeoutMs = 0)
    {
        const int rc = ::connect(_fd, address.addr(), address.length());
        if (rc == 0)
        {
            return true;
        }

        if (errno != EINPROGRESS)
        {
            return false;
        }

        // Wait for writable, then check again.
        pollWrite(timeoutMs);

        // Now check if we connected, not, or not yet.
        return (getError() == 0 || errno == EINPROGRESS);
    }

    /// Binds to a local address (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool bind(const SocketAddress& address)
    {
        // Enable address reuse to avoid stalling after
        // recycling, when previous socket is TIME_WAIT.
        //TODO: Might be worth refactoring out.
        const int reuseAddress = 1;
        constexpr unsigned int len = sizeof(reuseAddress);
        ::setsockopt(_fd, SOL_SOCKET, SO_REUSEADDR, &reuseAddress, len);

        const int rc = ::bind(_fd, address.addr(), address.length());
        return (rc == 0);
    }

    /// Listen to incoming connections (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool listen(const int backlog = 64)
    {
        const int rc = ::listen(_fd, backlog);
        return (rc == 0);
    }

    /// Accepts an incoming connection (Servers only).
    /// Does not retry on error.
    /// Returns a valid Socket shared_ptr on success only.
    std::shared_ptr<Socket> accept()
    {
        // Accept a connection (if any) and set it to non-blocking.
        // We don't care about the client's address, so ignored.
        const int rc = ::accept4(_fd, nullptr, nullptr, SOCK_NONBLOCK);
        return std::shared_ptr<Socket>(rc != -1 ? new Socket(rc) : nullptr);
    }

    /// Send data to our peer.
    /// Returns the number of bytes sent, -1 on error.
    int send(const void* buf, const size_t len)
    {
        // Don't SIGPIPE when the other end closes.
        const int rc = ::send(_fd, buf, len, MSG_NOSIGNAL);
        return rc;
    }

    /// Receive data from our peer.
    /// Returns the number of bytes received, -1 on error,
    /// and 0 when the peer has performed an orderly shutdown.
    int recv(void* buf, const size_t len)
    {
        const int rc = ::recv(_fd, buf, len, 0);
        return rc;
    }

    /// Poll the socket for either read, write, or both.
    /// Returns -1 on failure/error (query socket error), 0 for timeout,
    /// otherwise, depending on events, the respective bits set.
    int poll(const int timeoutMs, const int events = POLLIN | POLLOUT)
    {
        // Use poll(2) as it has lower overhead for up to
        // a few hundred sockets compared to epoll(2).
        // Also it has a more intuitive API and portable.
        pollfd poll;
        memset(&poll, 0, sizeof(poll));

        poll.fd = _fd;
        poll.events |= events;

        int rc;
        do
        {
            // Technically, on retrying we should wait
            // the _remaining_ time, alas simplicity wins.
            rc = ::poll(&poll, 1, timeoutMs);
        }
        while (rc < 0 && errno == EINTR);

        if (rc <= 0)
        {
            return rc;
        }

        int revents = 0;
        if (rc == 1)
        {
            if (poll.revents & (POLLERR|POLLHUP|POLLNVAL))
            {
                // Probe socket for error.
                return -1;
            }

            if (poll.revents & (POLLIN|POLLPRI))
            {
                // Data ready to read.
                revents |= POLLIN;
            }

            if (poll.revents & POLLOUT)
            {
                // Ready for write.
                revents |= POLLOUT;
            }
        }

        return revents;
    }

    /// Poll the socket for readability.
    /// Returns true when there is data to read, otherwise false.
    bool pollRead(const int timeoutMs)
    {
        const int rc = poll(timeoutMs, POLLIN);
        return (rc > 0 && (rc & POLLIN));
    }

    /// Poll the socket for writability.
    /// Returns true when socket is ready for writing, otherwise false.
    bool pollWrite(const int timeoutMs)
    {
        const int rc = poll(timeoutMs, POLLOUT);
        return (rc > 0 && (rc & POLLOUT));
    }

private:

    /// Construct based on an existing socket fd.
    /// Used by accept() only.
    Socket(const int fd) :
        _fd(fd)
    {
    }

private:
    const int _fd;
};

/// Handles non-blocking socket event polling.
/// Only polls on N-Sockets and invokes callback and
/// doesn't manage buffers or client data.
/// Note: uses poll(2) since it has very good performance
/// compared to epoll up to a few hundred sockets and
/// doesn't suffer select(2)'s poor API. Since this will
/// be used per-document we don't expect to have several
/// hundred users on same document to suffer poll(2)'s
/// scalability limit. Meanwhile, epoll(2)'s high
/// overhead to adding/removing sockets is not helpful.
template <typename T>
class SocketPoll
{
public:
    SocketPoll()
    {
        // Create the wakeup fd.
        if (::pipe2(_wakeup, O_CLOEXEC | O_NONBLOCK) == -1)
        {
            //FIXME: Can't have wakeup pipe, should we exit?
            _wakeup[0] = -1;
            _wakeup[1] = -1;
        }

        createPollFds();
    }

    ~SocketPoll()
    {
        ::close(_wakeup[0]);
        ::close(_wakeup[1]);
    }

    /// Poll the sockets for available data to read or buffer to write.
    void poll(const int timeoutMs, const std::function<bool(const std::shared_ptr<T>&, const int)>& handler)
    {
        const size_t size = _pollSockets.size();

        int rc;
        do
        {
            rc = ::poll(&_pollFds[0], size + 1, timeoutMs);
        }
        while (rc < 0 && errno == EINTR);

        // Fire the callback and remove dead fds.
        for (int i = static_cast<int>(size) - 1; i >= 0; --i)
        {
            if (_pollFds[i].revents)
            {
                if (!handler(_pollSockets[i], _pollFds[i].revents))
                {
                    std::cout << "Removing: " << _pollFds[i].fd << std::endl;
                    _pollSockets.erase(_pollSockets.begin() + i);
                    // Don't remove from pollFds; we'll recreate below.
                }
            }
        }

        // Process the wakeup pipe (always the last entry).
        if (_pollFds[size].revents)
        {
            // Add new sockets first.
            addNewSocketsToPoll();

            // Recreate the poll fds array.
            createPollFds();

            // Clear the data.
            int dump;
            if (::read(_wakeup[0], &dump, sizeof(4)) == -1)
            {
                // Nothing to do.
            }
        }
        else if (_pollFds.size() != (_pollSockets.size() + 1))
        {
            createPollFds();
        }
    }

    /// Insert a new socket to be polled.
    /// Sockets are removed only when the handler return false.
    void insertNewSocket(const std::shared_ptr<Socket>& newSocket)
    {
        std::lock_guard<std::mutex> lock(_mutex);

        _newSockets.emplace_back(newSocket);

        // wakeup the main-loop.
        if (::write(_wakeup[1], "w", 1) == -1)
        {
            // No wake up then.
        }
    }

private:

    /// Add the new sockets to list of those to poll.
    void addNewSocketsToPoll()
    {
        std::lock_guard<std::mutex> lock(_mutex);

        // Copy the new sockets over and clear.
        _pollSockets.insert(_pollSockets.end(), _newSockets.begin(), _newSockets.end());
        _newSockets.clear();
    }

    /// Create the poll fds array.
    void createPollFds()
    {
        const size_t size = _pollSockets.size();
        std::cout << "creating poll fds " << size << std::endl;

        _pollFds.resize(size + 1); // + wakeup pipe

        for (size_t i = 0; i < size; ++i)
        {
            _pollFds[i].fd = _pollSockets[i]->fd();
            _pollFds[i].events = POLLIN | POLLOUT; //TODO: Get from the socket.
            _pollFds[i].revents = 0;
        }

        // Add the read-end of the wake pipe.
        _pollFds[size].fd = _wakeup[0];
        _pollFds[size].events = POLLIN;
        _pollFds[size].revents = 0;
    }

private:
    /// main-loop wakeup pipe
    int _wakeup[2];
    /// The sockets we're controlling
    std::vector<std::shared_ptr<Socket>> _pollSockets;
    /// Protects _newSockets
    std::mutex _mutex;
    std::vector<std::shared_ptr<Socket>> _newSockets;
    /// The fds to poll.
    std::vector<pollfd> _pollFds;
};

/// Generic thread class.
class Thread
{
public:
    Thread(const std::function<void(std::atomic<bool>&)>& cb) :
        _cb(cb),
        _stop(false)
    {
        _thread = std::thread([this]() { _cb(_stop); });
    }

    Thread(Thread&& other) = delete;
    const Thread& operator=(Thread&& other) = delete;

    ~Thread()
    {
        stop();
        if (_thread.joinable())
        {
            _thread.join();
        }
    }

    void stop()
    {
        _stop = true;
    }

private:
    const std::function<void(std::atomic<bool>&)> _cb;
    std::atomic<bool> _stop;
    std::thread _thread;
};

std::shared_ptr<Socket> connectClient(const int timeoutMs)
{
    SocketAddress addr("127.0.0.1", PortNumber);

    const auto client = std::make_shared<Socket>();
    if (!client->connect(addr, timeoutMs) && errno != EINPROGRESS)
    {
        const std::string msg = "Failed to call connect. (errno: ";
        throw std::runtime_error(msg + std::strerror(errno) + ")");
    }

    std::cout << "Connected " << client->fd() << std::endl;

    return client;
}

int main(int argc, const char**)
{
    SocketAddress addr("127.0.0.1", PortNumber);

    if (argc > 1)
    {
        // Client.
        auto client = connectClient(0);
        client->send("1", 1);
        int sent = 1;
        while (sent > 0 && client->pollRead(5000))
        {
            char buf[1024];
            const int recv = client->recv(buf, sizeof(buf));
            if (recv <= 0)
            {
                perror("recv");
                break;
            }
            else
            {
                const std::string msg = std::string(buf, recv);
                const int num = stoi(msg);
                const std::string new_msg = std::to_string(num + 1);
                sent = client->send(new_msg.data(), new_msg.size());
            }
        }

        return 0;
    }

    // Used to poll client sockets.
    SocketPoll<Socket> poller;

    // Start the client polling thread.
    Thread threadPoll([&poller](std::atomic<bool>& stop)
    {
        while (!stop)
        {
            poller.poll(5000, [](const std::shared_ptr<Socket>& socket, const int events)
            {
                if (events & POLLIN)
                {
                    char buf[1024];
                    const int recv = socket->recv(buf, sizeof(buf));
                    if (recv <= 0)
                    {
                        perror("recv");
                        return false;
                    }

                    if (events & POLLOUT)
                    {
                        const std::string msg = std::string(buf, recv);
                        const int num = stoi(msg);
                        if ((num % (1<<16)) == 1)
                        {
                            std::cout << "Client #" << socket->fd() << ": " << msg << std::endl;
                        }
                        const std::string new_msg = std::to_string(num + 1);
                        const int sent = socket->send(new_msg.data(), new_msg.size());
                        if (sent != static_cast<int>(new_msg.size()))
                        {
                            perror("send");
                            return false;
                        }
                    }
                    else
                    {
                        // Normally we'd buffer the response, but for now...
                        std::cerr << "Client #" << socket->fd()
                                << ": ERROR - socket not ready for write." << std::endl;
                    }
                }

                return true;
            });
        }
    });

    // Start server.
    auto server = std::make_shared<Socket>();
    if (!server->bind(addr))
    {
        const std::string msg = "Failed to bind. (errno: ";
        throw std::runtime_error(msg + std::strerror(errno) + ")");
    }

    if (!server->listen())
    {
        const std::string msg = "Failed to listen. (errno: ";
        throw std::runtime_error(msg + std::strerror(errno) + ")");
    }

    std::cout << "Listening." << std::endl;
    for (;;)
    {
        if (server->pollRead(30000))
        {
            std::shared_ptr<Socket> clientSocket = server->accept();
            if (!clientSocket)
            {
                const std::string msg = "Failed to accept. (errno: ";
                throw std::runtime_error(msg + std::strerror(errno) + ")");
            }

            std::cout << "Accepted client #" << clientSocket->fd() << std::endl;
            poller.insertNewSocket(clientSocket);
        }
    }

    std::cout << "Shutting down server." << std::endl;

    threadPoll.stop();

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
