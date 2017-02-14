/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <poll.h>
#include <unistd.h>

#include <atomic>
#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <sstream>

#include <Poco/Net/SocketAddress.h>

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

        poll.fd = fd();
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

protected:

    /// Construct based on an existing socket fd.
    /// Used by accept() only.
    Socket(const int fd) :
        _fd(fd)
    {
    }

private:
    const int _fd;
};

/// A non-blocking, client socket.
class ClientSocket : public Socket
{
public:
    ClientSocket() :
        Socket()
    {
    }

    /// Connect to a server address.
    /// Does not retry on error.
    /// timeoutMs can be 0 to avoid waiting, or -1 to wait forever.
    /// Returns true on success only.
    /// Note: when succceeds, caller must check for
    /// EINPROGRESS and poll for write, then getError(),
    /// only when the latter returns 0 we are connected.
    bool connect(const Poco::Net::SocketAddress& address, const int timeoutMs = 0)
    {
        const int rc = ::connect(fd(), address.addr(), address.length());
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

    /// Send data to our peer.
    /// Returns the number of bytes sent, -1 on error.
    int send(const void* buf, const size_t len)
    {
        // Don't SIGPIPE when the other end closes.
        const int rc = ::send(fd(), buf, len, MSG_NOSIGNAL);
        return rc;
    }

    /// Receive data from our peer.
    /// Returns the number of bytes received, -1 on error,
    /// and 0 when the peer has performed an orderly shutdown.
    int recv(void* buf, const size_t len)
    {
        const int rc = ::recv(fd(), buf, len, 0);
        return rc;
    }

protected:
    ClientSocket(const int fd) :
        Socket(fd)
    {
    }

    friend class ServerSocket;
};

/// A non-blocking, streaming socket.
class ServerSocket : public Socket
{
public:

    /// Binds to a local address (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool bind(const Poco::Net::SocketAddress& address)
    {
        // Enable address reuse to avoid stalling after
        // recycling, when previous socket is TIME_WAIT.
        //TODO: Might be worth refactoring out.
        const int reuseAddress = 1;
        constexpr unsigned int len = sizeof(reuseAddress);
        ::setsockopt(fd(), SOL_SOCKET, SO_REUSEADDR, &reuseAddress, len);

        const int rc = ::bind(fd(), address.addr(), address.length());
        return (rc == 0);
    }

    /// Listen to incoming connections (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool listen(const int backlog = 64)
    {
        const int rc = ::listen(fd(), backlog);
        return (rc == 0);
    }

    /// Accepts an incoming connection (Servers only).
    /// Does not retry on error.
    /// Returns a valid Socket shared_ptr on success only.
    std::shared_ptr<ClientSocket> accept()
    {
        // Accept a connection (if any) and set it to non-blocking.
        // We don't care about the client's address, so ignored.
        const int rc = ::accept4(fd(), nullptr, nullptr, SOCK_NONBLOCK);
        return std::shared_ptr<ClientSocket>(rc != -1 ? new ClientSocket(rc) : nullptr);
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
