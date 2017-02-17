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

#include "ssl.hpp"

/// A non-blocking, streaming socket.
class Socket
{
public:
    Socket() :
        _fd(socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0))
    {
    }

    virtual ~Socket()
    {
        //TODO: Should we shutdown here or up to the client?

        // Doesn't block on sockets; no error handling needed.
        close(_fd);
    }

    // Returns the OS native socket fd.
    int getFD() const { return _fd; }

    /// Return a mask of events we should be polling for
    virtual int getPollEvents() = 0;

    /// Handle results of events returned from poll
    enum HandleResult { CONTINUE, SOCKET_CLOSED };
    virtual HandleResult handlePoll( int events ) = 0;


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
class SocketPoll
{
public:
    SocketPoll()
    {
        // Create the wakeup fd.
        if (::pipe2(_wakeup, O_CLOEXEC | O_NONBLOCK) == -1)
        {
            // FIXME: Can't have wakeup pipe, should we exit?
            // FIXME: running out of sockets should be a case we handle elegantly here - and also in our accept / ClientSocket creation I guess.
            _wakeup[0] = -1;
            _wakeup[1] = -1;
        }
    }

    ~SocketPoll()
    {
        ::close(_wakeup[0]);
        ::close(_wakeup[1]);
    }

    /// Poll the sockets for available data to read or buffer to write.
    void poll(const int timeoutMs)
    {
        const size_t size = _pollSockets.size();

        // The events to poll on change each spin of the loop.
        setupPollFds();

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
                if (_pollSockets[i]->handlePoll(_pollFds[i].revents) ==
                    Socket::HandleResult::SOCKET_CLOSED)
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

            // Clear the data.
            int dump;
            while (::read(_wakeup[0], &dump, sizeof(dump)) == -1 && errno == EINTR)
            {
                // Nothing to do.
            }
        }
    }

    /// Insert a new socket to be polled.
    /// Sockets are removed only when the handler return false.
    void insertNewSocket(const std::shared_ptr<Socket>& newSocket)
    {
        std::lock_guard<std::mutex> lock(_mutex);

        _newSockets.emplace_back(newSocket);

        // wakeup the main-loop.
        int rc;
        do
        {
            // wakeup pipe is already full.
            rc = ::write(_wakeup[1], "w", 1);
        }
        while (rc == -1 && errno == EINTR);

        if (rc == -1)
        {
            assert(errno == EAGAIN || errno == EWOULDBLOCK);
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

    void removeSocketFromPoll(const std::shared_ptr<Socket>& socket)
    {
        auto it = std::find(_pollSockets.begin(), _pollSockets.end(), socket);
        assert (it != _pollSockets.end());
        _pollSockets.erase(it);
    }

    /// Initialize the poll fds array with the right events
    void setupPollFds()
    {
        const size_t size = _pollSockets.size();

        _pollFds.resize(size + 1); // + wakeup pipe

        for (size_t i = 0; i < size; ++i)
        {
            _pollFds[i].fd = _pollSockets[i]->getFD();
            _pollFds[i].events = _pollSockets[i]->getPollEvents();
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

/// Abstract buffering socket.
class BufferingSocket : public Socket
{
public:
    BufferingSocket() :
        Socket()
    {
    }

    HandleResult handlePoll( int events ) override
    {
        bool closeSocket = false;

        // FIXME: need to close input, but not output (?)
        if (events & POLLIN)
            closeSocket = !readIncomingData();

        if (events & POLLOUT)
            writeOutgoingData();

        if (events & (POLLHUP | POLLERR | POLLNVAL))
            closeSocket = true;

        return closeSocket ? HandleResult::SOCKET_CLOSED :
                             HandleResult::CONTINUE;
    }

    /// Override to reading data from socket.
    virtual bool readIncomingData() = 0;

    /// Override to write data out to socket.
    virtual void writeOutgoingData() = 0;

    int getPollEvents() override
    {
        int pollFor = POLLIN;
        if (_outBuffer.size() > 0)
            pollFor |= POLLOUT;
        return pollFor;
    }

    /// Override to handle read data.
    /// Called after successful socket reads.
    virtual void handleIncomingMessage() = 0;

protected:
    BufferingSocket(const int fd) :
        Socket(fd)
    {
    }

    std::vector< char > _inBuffer;
    std::vector< char > _outBuffer;
};

/// A plain, non-blocking, data streaming socket.
class StreamSocket : public BufferingSocket
{
public:
    StreamSocket() :
        BufferingSocket()
    {
    }

    bool readIncomingData() override
    {
        ssize_t len;
        char buf[4096];
        do {
            len = ::read(getFD(), buf, sizeof(buf));
        } while (len < 0 && errno == EINTR);
        if (len > 0)
        {
            assert (len < ssize_t(sizeof(buf)));
            _inBuffer.insert(_inBuffer.end(), &buf[0], &buf[len]);
            handleIncomingMessage();
        }
        // else poll will handle errors.

        return len != 0; // zero is eof / clean socket close.
    }

    void writeOutgoingData() override
    {
        assert (_outBuffer.size() > 0);
        ssize_t len;
        do {
            len = ::write(getFD(), &_outBuffer[0], _outBuffer.size());
        } while (len < 0 && errno == EINTR);
        if (len > 0)
        {
            _outBuffer.erase(_outBuffer.begin(),
                             _outBuffer.begin() + len);
        }
        // else poll will handle errors
    }

protected:
    StreamSocket(const int fd) :
        BufferingSocket(fd)
    {
    }

    friend class ServerSocket;
};

/// A SSL/TSL, non-blocking, data streaming socket.
class SslStreamSocket : public BufferingSocket
{
public:
    SslStreamSocket() :
        BufferingSocket()
    {
    }

    bool readIncomingData() override
    {
        //TODO:
        return true;
    }

    void writeOutgoingData() override
    {
        //TODO;
    }

protected:
    SslStreamSocket(const int fd) :
        BufferingSocket(fd),
        _ssl(nullptr)
    {
        BIO* bio = BIO_new(BIO_s_socket());
        if (bio == nullptr)
        {
            throw std::runtime_error("Failed to create SSL BIO.");
        }

        BIO_set_fd(bio, fd, BIO_NOCLOSE);

        _ssl = SslContext::newSsl();
        if (!_ssl)
        {
            BIO_free(bio);
            throw std::runtime_error("Failed to create SSL.");
        }

        SSL_set_bio(_ssl, bio, bio);

        // We are a server-side socket.
        SSL_set_accept_state(_ssl);
    }

    friend class ServerSocket;

private:
    SSL* _ssl;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
