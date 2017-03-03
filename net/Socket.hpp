/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_SOCKET_HPP
#define INCLUDED_SOCKET_HPP

#include "config.h"

#include <poll.h>
#include <unistd.h>
#include <sys/stat.h>

#include <atomic>
#include <cassert>
#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <memory>
#include <mutex>
#include <sstream>

#include <Poco/Timespan.h>
#include <Poco/Timestamp.h>
#include <Poco/Net/SocketAddress.h>
#include <Poco/Net/HTTPResponse.h>

#include "Common.hpp"
#include "Log.hpp"
#include "Util.hpp"

/// A non-blocking, streaming socket.
class Socket
{
public:
    Socket() :
        _fd(socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0))
    {
        setNoDelay();
    }

    virtual ~Socket()
    {
        //TODO: Should we shutdown here or up to the client?

        // Doesn't block on sockets; no error handling needed.
        close(_fd);
    }

    /// Returns the OS native socket fd.
    int getFD() const { return _fd; }

    /// Shutdown the socket.
    /// TODO: Support separate read/write shutdown.
    virtual void shutdown()
    {
        ::shutdown(_fd, SHUT_RDWR);
    }

    /// Return a mask of events we should be polling for
    virtual int getPollEvents() = 0;

    /// Contract the poll timeout to match our needs
    virtual void updateTimeout(Poco::Timestamp &/*timeout*/) { /* do nothing */ }

    /// Handle results of events returned from poll
    enum class HandleResult { CONTINUE, SOCKET_CLOSED };
    virtual HandleResult handlePoll(const Poco::Timestamp &now, int events) = 0;

    /// manage latency issues around packet aggregation
    void setNoDelay(bool noDelay = true)
    {
        int val = noDelay ? 1 : 0;
        setsockopt (_fd, IPPROTO_TCP, TCP_NODELAY,
                    (char *) &val, sizeof(val));
    }

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

    virtual void dumpState() {}

protected:

    /// Construct based on an existing socket fd.
    /// Used by accept() only.
    Socket(const int fd) :
        _fd(fd)
    {
        setNoDelay();
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
    /// Create a socket poll, called rather infrequently.
    SocketPoll();
    ~SocketPoll();

    /// Poll the sockets for available data to read or buffer to write.
    void poll(const int timeoutMaxMs)
    {
        const size_t size = _pollSockets.size();

        Poco::Timestamp now;
        Poco::Timestamp timeout = now;
        timeout += Poco::Timespan(0 /* s */, timeoutMaxMs * 1000 /* us */);

        // The events to poll on change each spin of the loop.
        setupPollFds(timeout);

        int rc;
        do
        {
            rc = ::poll(&_pollFds[0], size + 1, (timeout - now)/1000);
        }
        while (rc < 0 && errno == EINTR);

        // Fire the callback and remove dead fds.
        Poco::Timestamp newNow;
        for (int i = static_cast<int>(size) - 1; i >= 0; --i)
        {
            if (_pollFds[i].revents)
            {
                Socket::HandleResult res = Socket::HandleResult::SOCKET_CLOSED;
                try
                {
                    res = _pollSockets[i]->handlePoll(newNow, _pollFds[i].revents);
                }
                catch (const std::exception& exc)
                {
                    LOG_ERR("Error while handling poll for socket #" <<
                            _pollFds[i].fd << ": " << exc.what());
                }

                if (res == Socket::HandleResult::SOCKET_CLOSED)
                {
                    LOG_DBG("Removing client #" << _pollFds[i].fd);
                    _pollSockets.erase(_pollSockets.begin() + i);
                    // Don't remove from pollFds; we'll recreate below.
                }
            }
        }

        // Process the wakeup pipe (always the last entry).
        if (_pollFds[size].revents)
        {
            std::vector<CallbackFn> invoke;
            {
                std::lock_guard<std::mutex> lock(_mutex);

                // Clear the data.
                int dump = ::read(_wakeup[0], &dump, sizeof(dump));

                // Copy the new sockets over and clear.
                _pollSockets.insert(_pollSockets.end(),
                                    _newSockets.begin(), _newSockets.end());
                _newSockets.clear();

                // Extract list of callbacks to process
                std::swap(_newCallbacks, invoke);
            }

            for (size_t i = 0; i < invoke.size(); ++i)
                invoke[i]();
        }
    }

    /// Write to a wakeup descriptor
    static void wakeup (int fd)
    {
        // wakeup the main-loop.
        int rc;
        do {
            rc = ::write(fd, "w", 1);
        } while (rc == -1 && errno == EINTR);

        assert (rc != -1 || errno == EAGAIN || errno == EWOULDBLOCK);
    }

    /// Wakeup the main polling loop in another thread
    void wakeup()
    {
        wakeup(_wakeup[1]);
    }

    /// Global wakeup - signal safe: wakeup all socket polls.
    static void wakeupWorld();

    /// Insert a new socket to be polled.
    /// Sockets are removed only when the handler return false.
    void insertNewSocket(const std::shared_ptr<Socket>& newSocket)
    {
        if (newSocket)
        {
            std::lock_guard<std::mutex> lock(_mutex);
            _newSockets.emplace_back(newSocket);
            wakeup();
        }
    }

    typedef std::function<void()> CallbackFn;

    /// Add a callback to be invoked in the polling thread
    void addCallback(CallbackFn fn)
    {
        std::lock_guard<std::mutex> lock(_mutex);
        _newCallbacks.emplace_back(fn);
        wakeup();
    }

    void dumpState();

private:

    void removeSocketFromPoll(const std::shared_ptr<Socket>& socket)
    {
        auto it = std::find(_pollSockets.begin(), _pollSockets.end(), socket);
        assert (it != _pollSockets.end());
        _pollSockets.erase(it);
    }

    /// Initialize the poll fds array with the right events
    void setupPollFds(Poco::Timestamp &timeout)
    {
        const size_t size = _pollSockets.size();

        _pollFds.resize(size + 1); // + wakeup pipe

        for (size_t i = 0; i < size; ++i)
        {
            _pollFds[i].fd = _pollSockets[i]->getFD();
            _pollFds[i].events = _pollSockets[i]->getPollEvents();
            _pollSockets[i]->updateTimeout(timeout);
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
    std::vector<CallbackFn> _newCallbacks;
    /// The fds to poll.
    std::vector<pollfd> _pollFds;
};

class StreamSocket;

/// Interface that handles the actual incoming message.
class SocketHandlerInterface
{
public:
    /// Called when the socket is newly created to
    /// set the socket associated with this ResponseClient.
    /// Will be called exactly once.
    virtual void onConnect(const std::weak_ptr<StreamSocket>& socket) = 0;

    /// Called after successful socket reads.
    virtual void handleIncomingMessage() = 0;

    /// Called when the is disconnected and will be destroyed.
    /// Will be called exactly once.
    virtual void onDisconnect()
    {
    }
};

/// A plain, non-blocking, data streaming socket.
class StreamSocket : public Socket
{
public:
    /// Create a StreamSocket from native FD and take ownership of handler instance.
    StreamSocket(const int fd, std::unique_ptr<SocketHandlerInterface> socketHandler) :
        Socket(fd),
        _socketHandler(std::move(socketHandler)),
        _closed(false)
    {
        // Without a handler we make no sense.
        if (!_socketHandler)
            throw std::runtime_error("StreamSocket expects a valid SocketHandler instance.");
    }

    ~StreamSocket()
    {
        if (!_closed)
            _socketHandler->onDisconnect();
    }

    int getPollEvents() override
    {
        // Only poll for read if we have nothing to write.
        return (_outBuffer.empty() ? POLLIN : POLLIN | POLLOUT);
    }

    /// Send data to the socket peer.
    void send(const char* data, const int len, const bool flush = true)
    {
        if (data != nullptr && len > 0)
        {
            auto lock = getWriteLock();
            _outBuffer.insert(_outBuffer.end(), data, data + len);
            if (flush)
                writeOutgoingData();
        }
    }

    /// Send a string to the socket peer.
    void send(const std::string& str, const bool flush = true)
    {
        send(str.data(), str.size(), flush);
    }

    void send(Poco::Net::HTTPResponse& response)
    {
        response.set("User-Agent", HTTP_AGENT_STRING);
        std::ostringstream oss;
        response.write(oss);
        LOG_INF(oss.str());
        send(oss.str());
    }

    /// Reads data by invoking readData() and buffering.
    /// Return false iff the socket is closed.
    virtual bool readIncomingData()
    {
        // SSL decodes blocks of 16Kb, so for efficiency we use the same.
        char buf[16 * 1024];
        ssize_t len;
        do
        {
            // Drain the read buffer.
            // TODO: Cap the buffer size, lest we grow beyond control.
            do
            {
                len = readData(buf, sizeof(buf));
            }
            while (len < 0 && errno == EINTR);

            if (len > 0)
            {
                assert (len <= ssize_t(sizeof(buf)));
                _inBuffer.insert(_inBuffer.end(), &buf[0], &buf[len]);
            }
            // else poll will handle errors.
        }
        while (len == (sizeof(buf)));

        return len != 0; // zero is eof / clean socket close.
    }

    /// Create a socket of type TSocket given an FD and a handler.
    /// We need this helper since the handler needs a shared_ptr to the socket
    /// but we can't have a shared_ptr in the ctor.
    template <typename TSocket>
    static
    std::shared_ptr<TSocket> create(const int fd, std::unique_ptr<SocketHandlerInterface> handler)
    {
        SocketHandlerInterface* pHandler = handler.get();
        auto socket = std::make_shared<TSocket>(fd, std::move(handler));
        pHandler->onConnect(socket);
        return socket;
    }

protected:

    /// Called when a polling event is received.
    /// @events is the mask of events that triggered the wake.
    HandleResult handlePoll(const Poco::Timestamp & /* now */,
                            const int events) override
    {
        // FIXME: need to close input, but not output (?)
        bool closed = (events & (POLLHUP | POLLERR | POLLNVAL));

        // Always try to read.
        closed = !readIncomingData() || closed;

        auto& log = Log::logger();
        if (log.trace()) {
            LOG_TRC("#" << getFD() << ": Incoming data buffer " << _inBuffer.size() <<
                    " bytes, closeSocket? " << closed);
            // log.dump("", &_inBuffer[0], _inBuffer.size());
        }

        // If we have data, allow the app to consume.
        size_t oldSize = 0;
        while (!_inBuffer.empty() && oldSize != _inBuffer.size())
        {
            oldSize = _inBuffer.size();
            _socketHandler->handleIncomingMessage();
        }

        // SSL might want to do handshake,
        // even if we have no data to write.
        if ((events & POLLOUT) || !_outBuffer.empty())
        {
            std::unique_lock<std::mutex> lock(_writeMutex, std::defer_lock);

            // The buffer could have been flushed while we waited for the lock.
            if (lock.try_lock() && !_outBuffer.empty())
                writeOutgoingData();

            closed = closed || (errno == EPIPE);
        }

        if (closed)
        {
            _closed = true;
            _socketHandler->onDisconnect();
        }

        return _closed ? HandleResult::SOCKET_CLOSED :
                         HandleResult::CONTINUE;
    }

    /// Override to write data out to socket.
    virtual void writeOutgoingData()
    {
        Util::assertIsLocked(_writeMutex);
        assert(!_outBuffer.empty());
        do
        {
            ssize_t len;
            do
            {
                len = writeData(&_outBuffer[0], _outBuffer.size());

                auto& log = Log::logger();
                if (log.trace() && len > 0) {
                    LOG_TRC("#" << getFD() << ": Wrote outgoing data " << len << " bytes");
                    // log.dump("", &_outBuffer[0], len);
                }

                if (len <= 0)
                    LOG_SYS("#" << getFD() << ": Wrote outgoing data " << len << " bytes");
            }
            while (len < 0 && errno == EINTR);

            if (len > 0)
            {
                _outBuffer.erase(_outBuffer.begin(), _outBuffer.begin() + len);
            }
            else
            {
                // Poll will handle errors.
                break;
            }
        }
        while (!_outBuffer.empty());
    }

    /// Override to handle reading of socket data differently.
    virtual int readData(char* buf, int len)
    {
        return ::read(getFD(), buf, len);
    }

    /// Override to handle writing data to socket differently.
    virtual int writeData(const char* buf, const int len)
    {
        return ::write(getFD(), buf, len);
    }

    void dumpState() override
    {
        std::cerr << "\t" << getFD() << "\t" << getPollEvents() << "\t"
            << _inBuffer.size() << "\t" << _outBuffer.size() << "\t"
            << "\n";
        // FIXME: hex dump buffer contents if we have them.
    }

    /// Get the Write Lock.
    std::unique_lock<std::mutex> getWriteLock() { return std::unique_lock<std::mutex>(_writeMutex); }

protected:
    /// Client handling the actual data.
    std::unique_ptr<SocketHandlerInterface> _socketHandler;

    /// True if we are already closed.
    bool _closed;

    std::vector< char > _inBuffer;
    std::vector< char > _outBuffer;

    std::mutex _writeMutex;

    // To be able to access _inBuffer and _outBuffer.
    // TODO we probably need accessors to the _inBuffer & _outBuffer
    // instead of this many friends...
    friend class WebSocketHandler;
    friend class ClientRequestDispatcher;
    friend class SimpleResponseClient;
};

namespace HttpHelper
{
    inline void sendFile(const std::shared_ptr<StreamSocket>& socket, const std::string& path,
                         Poco::Net::HTTPResponse& response)
    {
        struct stat st;
        if (stat(path.c_str(), &st) != 0)
        {
            LOG_WRN("Failed to stat [" << path << "]. File will not be sent.");
            throw Poco::FileNotFoundException("Failed to stat [" + path + "]. File will not be sent.");
            return;
        }

        response.setContentLength(st.st_size);
        response.set("User-Agent", HTTP_AGENT_STRING);
        std::ostringstream oss;
        response.write(oss);
        LOG_INF(oss.str());
        socket->send(oss.str());

        std::ifstream file(path, std::ios::binary);
        do
        {
            char buf[16 * 1024];
            file.read(buf, sizeof(buf));
            const int size = file.gcount();
            if (size > 0)
                socket->send(buf, size);
            else
                break;
        }
        while (file);
    }

    inline void sendFile(const std::shared_ptr<StreamSocket>& socket, const std::string& path,
                         const std::string& mediaType)
    {
        Poco::Net::HTTPResponse response;
        response.setContentType(mediaType);
        sendFile(socket, path, response);
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
