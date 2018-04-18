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

#include <poll.h>
#include <unistd.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/tcp.h>

#include <atomic>
#include <cassert>
#include <cerrno>
#include <chrono>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <functional>
#include <iostream>
#include <memory>
#include <mutex>
#include <sstream>
#include <thread>
#include <atomic>

#include "common/Common.hpp"
#include "common/Log.hpp"
#include "common/Util.hpp"
#include "common/SigUtil.hpp"

namespace Poco
{
    class MemoryInputStream;
    namespace Net
    {
        class HTTPRequest;
        class HTTPResponse;
    }
}

class Socket;

/// Helper to allow us to easily defer the movement of a socket
/// between polls to clarify thread ownership.
class SocketDisposition
{
    typedef std::function<void(const std::shared_ptr<Socket> &)> MoveFunction;
    enum class Type { CONTINUE, CLOSED, MOVE };

    Type _disposition;
    MoveFunction _socketMove;
    std::shared_ptr<Socket> _socket;

public:
    SocketDisposition(const std::shared_ptr<Socket> &socket) :
        _disposition(Type::CONTINUE),
        _socket(socket)
    {}
    ~SocketDisposition()
    {
        assert (!_socketMove);
    }
    void setMove()
    {
        _disposition = Type::MOVE;
    }
    void setMove(MoveFunction moveFn)
    {
        _socketMove = std::move(moveFn);
        _disposition = Type::MOVE;
    }
    void setClosed()
    {
        _disposition = Type::CLOSED;
    }
    bool isMove() { return _disposition == Type::MOVE; }
    bool isClosed() { return _disposition == Type::CLOSED; }

    /// Perform the queued up work.
    void execute();
};

/// A non-blocking, streaming socket.
class Socket
{
public:
    static const int DefaultSendBufferSize = 16 * 1024;
    static const int MaximumSendBufferSize = 128 * 1024;
    static std::atomic<bool> InhibitThreadChecks;
    std::string _clientAddress;

    enum Type { IPv4, IPv6, All };

    Socket(Type type) :
        _fd(createSocket(type)),
        _sendBufferSize(DefaultSendBufferSize),
        _owner(std::this_thread::get_id())
    {
        init();
    }

    virtual ~Socket()
    {
        LOG_TRC("#" << getFD() << " Socket dtor.");

        // Doesn't block on sockets; no error handling needed.
        close(_fd);
    }

    /// Create socket of the given type.
    static int createSocket(Type type);

    /// Returns the OS native socket fd.
    int getFD() const { return _fd; }

    /// Shutdown the socket.
    /// TODO: Support separate read/write shutdown.
    virtual void shutdown()
    {
        LOG_TRC("#" << _fd << ": socket shutdown RDWR.");
        ::shutdown(_fd, SHUT_RDWR);
    }

    /// Prepare our poll record; adjust @timeoutMaxMs downwards
    /// for timeouts, based on current time @now.
    /// @returns POLLIN and POLLOUT if output is expected.
    virtual int getPollEvents(std::chrono::steady_clock::time_point now,
                              int &timeoutMaxMs) = 0;

    /// Handle results of events returned from poll
    virtual void handlePoll(SocketDisposition &disposition,
                            std::chrono::steady_clock::time_point now,
                            int events) = 0;

    /// manage latency issues around packet aggregation
    void setNoDelay()
    {
        const int val = 1;
        ::setsockopt(_fd, IPPROTO_TCP, TCP_NODELAY,
                     (char *) &val, sizeof(val));
    }

    /// Sets the kernel socket send buffer in size bytes.
    /// Note: TCP will allocate twice this size for admin purposes,
    /// so a subsequent call to getSendBufferSize will return
    /// the larger (actual) buffer size, if this succeeds.
    /// Note: the upper limit is set via /proc/sys/net/core/wmem_max,
    /// and there is an unconfigurable lower limit as well.
    /// Returns true on success only.
    bool setSocketBufferSize(const int size)
    {
        int rc = ::setsockopt(_fd, SOL_SOCKET, SO_SNDBUF, &size, sizeof(size));

        _sendBufferSize = getSocketBufferSize();
        if (rc != 0 || _sendBufferSize < 0 )
        {
            LOG_ERR("#" << _fd << ": Error getting socket buffer size " << errno);
            _sendBufferSize = DefaultSendBufferSize;
            return false;
        }
        else
        {
            if (_sendBufferSize > MaximumSendBufferSize * 2)
            {
                LOG_TRC("#" << _fd << ": Clamped send buffer size to " <<
                        MaximumSendBufferSize << " from " << _sendBufferSize);
                _sendBufferSize = MaximumSendBufferSize;
            }
            else
                LOG_TRC("#" << _fd << ": Set socket buffer size to " << _sendBufferSize);
            return true;
        }
    }

    /// Gets the actual send buffer size in bytes, -1 for failure.
    int getSocketBufferSize() const
    {
        int size;
        unsigned int len = sizeof(size);
        const int rc = ::getsockopt(_fd, SOL_SOCKET, SO_SNDBUF, &size, &len);
        return rc == 0 ? size : -1;
    }

    /// Gets our fast cache of the socket buffer size
    int getSendBufferSize() const
    {
        return _sendBufferSize;
    }

    /// Sets the receive buffer size in bytes.
    /// Note: TCP will allocate twice this size for admin purposes,
    /// so a subsequent call to getReceieveBufferSize will return
    /// the larger (actual) buffer size, if this succeeds.
    /// Note: the upper limit is set via /proc/sys/net/core/rmem_max,
    /// and there is an unconfigurable lower limit as well.
    /// Returns true on success only.
    bool setReceiveBufferSize(const int size)
    {
        constexpr unsigned int len = sizeof(size);
        const int rc = ::setsockopt(_fd, SOL_SOCKET, SO_RCVBUF, &size, len);
        return rc == 0;
    }

    /// Gets the actual receive buffer size in bytes, -1 on error.
    int getReceiveBufferSize() const
    {
        int size;
        unsigned int len = sizeof(size);
        const int rc = ::getsockopt(_fd, SOL_SOCKET, SO_RCVBUF, &size, &len);
        return rc == 0 ? size : -1;
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

    virtual void dumpState(std::ostream&) {}

    /// Set the thread-id we're bound to
    virtual void setThreadOwner(const std::thread::id &id)
    {
        if (id != _owner)
        {
            LOG_DBG("#" << _fd << " Thread affinity set to " << Log::to_string(id) <<
                    " (was " << Log::to_string(_owner) << ").");
            _owner = id;
        }
    }

    const std::thread::id &getThreadOwner()
    {
        return _owner;
    }

    /// Asserts in the debug builds, otherwise just logs.
    void assertCorrectThread()
    {
        if (InhibitThreadChecks)
            return;
        // 0 owner means detached and can be invoked by any thread.
        const bool sameThread = (_owner == std::thread::id(0) || std::this_thread::get_id() == _owner);
        if (!sameThread)
            LOG_ERR("#" << _fd << " Invoked from foreign thread. Expected: " <<
                    Log::to_string(_owner) << " but called from " <<
                    std::this_thread::get_id() << " (" << Util::getThreadId() << ").");

        assert(sameThread);
    }

protected:

    /// Construct based on an existing socket fd.
    /// Used by accept() only.
    Socket(const int fd) :
        _fd(fd)
    {
        init();
    }

    void init()
    {
        setNoDelay();
        _sendBufferSize = DefaultSendBufferSize;
        _owner = std::this_thread::get_id();
        LOG_DBG("#" << _fd << " Thread affinity set to " << Log::to_string(_owner) << ".");

#if ENABLE_DEBUG
        if (std::getenv("LOOL_ZERO_BUFFER_SIZE"))
        {
            const int oldSize = getSocketBufferSize();
            setSocketBufferSize(0);
            LOG_TRC("#" << _fd << ": Buffer size: " << getSendBufferSize() <<
                    " (was " << oldSize << ")");
        }
#endif
    }

private:
    const int _fd;
    int _sendBufferSize;

    /// We check the owner even in the release builds, needs to be always correct.
    std::thread::id _owner;
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
    SocketPoll(const std::string& threadName);
    ~SocketPoll();

    /// Default poll time - useful to increase for debugging.
    static int DefaultPollTimeoutMs;
    static std::atomic<bool> InhibitThreadChecks;

    /// Stop the polling thread.
    void stop()
    {
        LOG_DBG("Stopping " << _name << ".");
        _stop = true;
        wakeup();
    }

    void removeSockets()
    {
        LOG_DBG("Removing all sockets from " << _name << ".");
        assertCorrectThread();

        while (!_pollSockets.empty())
        {
            const std::shared_ptr<Socket>& socket = _pollSockets.back();
            assert(socket);

            LOG_DBG("Removing socket #" << socket->getFD() << " from " << _name);
            socket->assertCorrectThread();
            socket->setThreadOwner(std::thread::id(0));

            _pollSockets.pop_back();
        }
    }

    bool isAlive() const { return _threadStarted && !_threadFinished; }

    /// Check if we should continue polling
    virtual bool continuePolling()
    {
        return !_stop;
    }

    /// Executed inside the poll in case of a wakeup
    virtual void wakeupHook() {}

    /// The default implementation of our polling thread
    virtual void pollingThread()
    {
        while (continuePolling())
        {
            poll(DefaultPollTimeoutMs);
        }
    }

    /// Are we running in either shutdown, or the polling thread.
    /// Asserts in the debug builds, otherwise just logs.
    void assertCorrectThread() const
    {
        if (InhibitThreadChecks)
            return;
        // 0 owner means detached and can be invoked by any thread.
        const bool sameThread = (!isAlive() || _owner == std::thread::id(0) || std::this_thread::get_id() == _owner);
        if (!sameThread)
            LOG_ERR("Incorrect thread affinity for " << _name << ". Expected: " <<
                    Log::to_string(_owner) << " (" << Util::getThreadId() <<
                    ") but called from " << std::this_thread::get_id() << ", stop: " << _stop);

        assert(_stop || sameThread);
    }

    /// Poll the sockets for available data to read or buffer to write.
    void poll(int timeoutMaxMs)
    {
        assertCorrectThread();

        std::chrono::steady_clock::time_point now =
            std::chrono::steady_clock::now();

        // The events to poll on change each spin of the loop.
        setupPollFds(now, timeoutMaxMs);
        const size_t size = _pollSockets.size();

        int rc;
        do
        {
            rc = ::poll(&_pollFds[0], size + 1, std::max(timeoutMaxMs,0));
        }
        while (rc < 0 && errno == EINTR);
        LOG_TRC("Poll completed with " << rc << " live polls max (" <<
                timeoutMaxMs << "ms)" << ((rc==0) ? "(timedout)" : ""));

        // First process the wakeup pipe (always the last entry).
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

                // Update thread ownership.
                for (auto &i : _newSockets)
                    i->setThreadOwner(std::this_thread::get_id());

                _newSockets.clear();

                // Extract list of callbacks to process
                std::swap(_newCallbacks, invoke);
            }

            for (const auto& callback : invoke)
            {
                try
                {
                    callback();
                }
                catch (const std::exception& exc)
                {
                    LOG_ERR("Exception while invoking poll [" << _name <<
                            "] callback: " << exc.what());
                }
            }

            try
            {
                wakeupHook();
            }
            catch (const std::exception& exc)
            {
                LOG_ERR("Exception while invoking poll [" << _name <<
                        "] wakeup hook: " << exc.what());
            }
        }

        // This should only happen when we're stopping.
        if (_pollSockets.size() != size)
            return;

        // Fire the poll callbacks and remove dead fds.
        std::chrono::steady_clock::time_point newNow =
            std::chrono::steady_clock::now();

        for (int i = static_cast<int>(size) - 1; i >= 0; --i)
        {
            SocketDisposition disposition(_pollSockets[i]);
            try
            {
                _pollSockets[i]->handlePoll(disposition, newNow,
                                            _pollFds[i].revents);
            }
            catch (const std::exception& exc)
            {
                LOG_ERR("Error while handling poll for socket #" <<
                        _pollFds[i].fd << " in " << _name << ": " << exc.what());
                disposition.setClosed();
            }

            if (disposition.isMove() || disposition.isClosed())
            {
                LOG_DBG("Removing socket #" << _pollFds[i].fd << " (of " <<
                        _pollSockets.size() << ") from " << _name);
                _pollSockets.erase(_pollSockets.begin() + i);
            }

            disposition.execute();
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

        if (rc == -1 && errno != EAGAIN && errno != EWOULDBLOCK)
            LOG_SYS("wakeup socket #" << fd << " is closed at wakeup?");
    }

    /// Wakeup the main polling loop in another thread
    void wakeup()
    {
        if (!isAlive())
            LOG_WRN("Waking up dead poll thread [" << _name << "], started: " <<
                    _threadStarted << ", finished: " << _threadFinished);

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
            LOG_DBG("Inserting socket #" << newSocket->getFD() << " into " << _name);
            // sockets in transit are un-owned.
            newSocket->setThreadOwner(std::thread::id(0));
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

    virtual void dumpState(std::ostream& os);

    /// Removes a socket from this poller.
    /// NB. this must be called from the socket poll that
    /// owns the socket.
    void releaseSocket(const std::shared_ptr<Socket>& socket)
    {
        assert(socket);
        assertCorrectThread();
        socket->assertCorrectThread();
        auto it = std::find(_pollSockets.begin(), _pollSockets.end(), socket);
        assert(it != _pollSockets.end());

        _pollSockets.erase(it);
        LOG_DBG("Removing socket #" << socket->getFD() << " (of " <<
                _pollSockets.size() << ") from " << _name);
    }

    size_t getSocketCount() const
    {
        assertCorrectThread();
        return _pollSockets.size();
    }

    const std::string& name() const { return _name; }

    /// Start the polling thread (if desired)
    void startThread();

    /// Stop and join the polling thread before returning (if active)
    void joinThread();

private:
    /// Initialize the poll fds array with the right events
    void setupPollFds(std::chrono::steady_clock::time_point now,
                      int &timeoutMaxMs)
    {
        const size_t size = _pollSockets.size();

        _pollFds.resize(size + 1); // + wakeup pipe

        for (size_t i = 0; i < size; ++i)
        {
            int events = _pollSockets[i]->getPollEvents(now, timeoutMaxMs);
            if (events < 0) // timeout on dead socket
            {
                _pollFds[i].fd = _wakeup[0];
                _pollFds[i].events = 0;
            }
            else
            {
                _pollFds[i].fd = _pollSockets[i]->getFD();
                _pollFds[i].events = events;
            }
            _pollFds[i].revents = 0;
        }

        // Add the read-end of the wake pipe.
        _pollFds[size].fd = _wakeup[0];
        _pollFds[size].events = POLLIN;
        _pollFds[size].revents = 0;
    }

    /// The polling thread entry.
    /// Used to set the thread name and mark the thread as stopped when done.
    void pollingThreadEntry()
    {
        try
        {
            Util::setThreadName(_name);
            LOG_INF("Starting polling thread [" << _name << "].");

            _owner = std::this_thread::get_id();
            LOG_DBG("Thread affinity of " << _name << " set to " <<
                    Log::to_string(_owner) << ".");

            // Invoke the virtual implementation.
            pollingThread();

            // Release sockets.
            _pollSockets.clear();
            _newSockets.clear();
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Exception in polling thread [" << _name << "]: " << exc.what());
        }

        _threadFinished = true;
    }

private:
    /// Debug name used for logging.
    const std::string _name;

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

protected:
    /// Flag the thread to stop.
    std::atomic<bool> _stop;
    /// The polling thread.
    std::thread _thread;
    std::atomic<bool> _threadStarted;
    std::atomic<bool> _threadFinished;
    std::thread::id _owner;
};

class StreamSocket;

/// Interface that handles the actual incoming message.
class SocketHandlerInterface
{
public:
    virtual ~SocketHandlerInterface() {}
    /// Called when the socket is newly created to
    /// set the socket associated with this ResponseClient.
    /// Will be called exactly once.
    virtual void onConnect(const std::shared_ptr<StreamSocket>& socket) = 0;

    /// Called after successful socket reads.
    virtual void handleIncomingMessage(SocketDisposition &disposition) = 0;

    /// Prepare our poll record; adjust @timeoutMaxMs downwards
    /// for timeouts, based on current time @now.
    /// @returns POLLIN and POLLOUT if output is expected.
    virtual int getPollEvents(std::chrono::steady_clock::time_point now,
                              int &timeoutMaxMs) = 0;

    /// Do we need to handle a timeout ?
    virtual void checkTimeout(std::chrono::steady_clock::time_point /* now */) {}

    /// Do some of the queued writing.
    virtual void performWrites() = 0;

    /// Called when the is disconnected and will be destroyed.
    /// Will be called exactly once.
    virtual void onDisconnect() {}

    /// Append pretty printed internal state to a line
    virtual void dumpState(std::ostream& os) { os << "\n"; }
};

/// A plain, non-blocking, data streaming socket.
class StreamSocket : public Socket, public std::enable_shared_from_this<StreamSocket>
{
public:
    /// Create a StreamSocket from native FD and take ownership of handler instance.
    StreamSocket(const int fd, std::shared_ptr<SocketHandlerInterface> socketHandler) :
        Socket(fd),
        _socketHandler(std::move(socketHandler)),
        _bytesSent(0),
        _bytesRecvd(0),
        _wsState(WSState::HTTP),
        _closed(false),
        _shutdownSignalled(false)
    {
        LOG_DBG("StreamSocket ctor #" << fd);

        // Without a handler we make no sense object.
        if (!_socketHandler)
            throw std::runtime_error("StreamSocket expects a valid SocketHandler instance.");
    }

    ~StreamSocket()
    {
        LOG_DBG("StreamSocket dtor #" << getFD());

        if (!_closed)
        {
            assertCorrectThread();
            _socketHandler->onDisconnect();
        }

        if (!_shutdownSignalled)
        {
            _shutdownSignalled = true;
            StreamSocket::closeConnection();
        }
    }

    bool isClosed() const { return _closed; }
    bool isWebSocket() const { return _wsState == WSState::WS; }
    void setWebSocket() { _wsState = WSState::WS; }

    /// Just trigger the async shutdown.
    virtual void shutdown() override
    {
        _shutdownSignalled = true;
        LOG_TRC("#" << getFD() << ": Async shutdown requested.");
    }

    /// Perform the real shutdown.
    virtual void closeConnection()
    {
        Socket::shutdown();
    }

    int getPollEvents(std::chrono::steady_clock::time_point now,
                      int &timeoutMaxMs) override
    {
        // cf. SslSocket::getPollEvents
        assertCorrectThread();
        int events = _socketHandler->getPollEvents(now, timeoutMaxMs);
        if (!_outBuffer.empty() || _shutdownSignalled)
            events |= POLLOUT;
        return events;
    }

    /// Send data to the socket peer.
    void send(const char* data, const int len, const bool flush = true)
    {
        assertCorrectThread();
        if (data != nullptr && len > 0)
        {
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

    /// Sends HTTP response.
    /// Adds Date and User-Agent.
    void send(Poco::Net::HTTPResponse& response);

    /// Reads data by invoking readData() and buffering.
    /// Return false iff the socket is closed.
    virtual bool readIncomingData()
    {
        assertCorrectThread();

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
                _bytesRecvd += len;
                _inBuffer.insert(_inBuffer.end(), &buf[0], &buf[len]);
            }
            // else poll will handle errors.
        }
        while (len == (sizeof(buf)));

        return len != 0; // zero is eof / clean socket close.
    }

    /// Replace the existing SocketHandler with a new one.
    void setHandler(std::shared_ptr<SocketHandlerInterface> handler)
    {
        _socketHandler = std::move(handler);
        _socketHandler->onConnect(shared_from_this());
    }

    /// Create a socket of type TSocket given an FD and a handler.
    /// We need this helper since the handler needs a shared_ptr to the socket
    /// but we can't have a shared_ptr in the ctor.
    template <typename TSocket>
    static
    std::shared_ptr<TSocket> create(const int fd, std::shared_ptr<SocketHandlerInterface> handler)
    {
        SocketHandlerInterface* pHandler = handler.get();
        auto socket = std::make_shared<TSocket>(fd, std::move(handler));
        pHandler->onConnect(socket);
        return socket;
    }

    /// Remove the first @count bytes from input buffer
    void eraseFirstInputBytes(size_t count)
    {
        _inBuffer.erase(_inBuffer.begin(), _inBuffer.begin() + count);
    }

    /// Detects if we have an HTTP header in the provided message and
    /// populates a request for that.
    bool parseHeader(const char *clientLoggingName,
                     Poco::MemoryInputStream &message,
                     Poco::Net::HTTPRequest &request,
                     size_t *requestSize = nullptr);

    /// Get input/output statistics on this stream
    void getIOStats(uint64_t &sent, uint64_t &recv)
    {
        sent = _bytesSent;
        recv = _bytesRecvd;
    }

    const std::string clientAddress()
    {
        return _clientAddress;
    }

protected:

    /// Called when a polling event is received.
    /// @events is the mask of events that triggered the wake.
    void handlePoll(SocketDisposition &disposition,
                    std::chrono::steady_clock::time_point now,
                    const int events) override
    {
        assertCorrectThread();

        _socketHandler->checkTimeout(now);

        if (!events)
            return;

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
            _socketHandler->handleIncomingMessage(disposition);
            if (disposition.isMove())
                return;
        }

        do
        {
            // If we have space for writing and that was requested
            if ((events & POLLOUT) && _outBuffer.empty())
                _socketHandler->performWrites();

            // perform the shutdown if we have sent everything.
            if (_shutdownSignalled && _outBuffer.empty())
            {
                closeConnection();
                closed = true;
                break;
            }

            oldSize = _outBuffer.size();

            // Write if we can and have data to write.
            if ((events & POLLOUT) && !_outBuffer.empty())
            {
                writeOutgoingData();
                closed = closed || (errno == EPIPE);
            }
        }
        while (oldSize != _outBuffer.size());

        if (closed)
        {
            LOG_TRC("#" << getFD() << ": Closed. Firing onDisconnect.");
            _closed = true;
            _socketHandler->onDisconnect();
        }

        if (_closed)
            disposition.setClosed();
    }

    /// Override to write data out to socket.
    virtual void writeOutgoingData()
    {
        assertCorrectThread();
        assert(!_outBuffer.empty());
        do
        {
            ssize_t len;
            do
            {
                // Writing more than we can absorb in the kernel causes SSL wasteage.
                len = writeData(&_outBuffer[0], std::min((int)_outBuffer.size(),
                                                         getSendBufferSize()));

                auto& log = Log::logger();
                if (log.trace() && len > 0) {
                    LOG_TRC("#" << getFD() << ": Wrote outgoing data " << len << " bytes.");
                    // log.dump("", &_outBuffer[0], len);
                }

                if (len <= 0 && errno != EAGAIN && errno != EWOULDBLOCK)
                    LOG_SYS("#" << getFD() << ": Wrote outgoing data " << len << " bytes.");
            }
            while (len < 0 && errno == EINTR);

            if (len > 0)
            {
                _bytesSent += len;
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
        assertCorrectThread();
        return ::read(getFD(), buf, len);
    }

    /// Override to handle writing data to socket differently.
    virtual int writeData(const char* buf, const int len)
    {
        assertCorrectThread();
        return ::write(getFD(), buf, len);
    }

    void dumpState(std::ostream& os) override;

protected:
    /// Client handling the actual data.
    std::shared_ptr<SocketHandlerInterface> _socketHandler;

    std::vector<char> _inBuffer;
    std::vector<char> _outBuffer;

    uint64_t _bytesSent;
    uint64_t _bytesRecvd;

    enum class WSState { HTTP, WS } _wsState;

    /// True if we are already closed.
    bool _closed;

    /// True when shutdown was requested via shutdown().
    bool _shutdownSignalled;

    // To be able to access _inBuffer and _outBuffer.
    // TODO we probably need accessors to the _inBuffer & _outBuffer
    // instead of this many friends...
    friend class WebSocketHandler;
    friend class ClientRequestDispatcher;
    friend class PrisonerRequestDispatcher;
    friend class SimpleResponseClient;
};

enum class WSOpCode : unsigned char {
    Continuation = 0x0,
    Text         = 0x1,
    Binary       = 0x2,
    Reserved1    = 0x3,
    Reserved2    = 0x4,
    Reserved3    = 0x5,
    Reserved4    = 0x6,
    Reserved5    = 0x7,
    Close        = 0x8,
    Ping         = 0x9,
    Pong         = 0xa
    // ... reserved
};

namespace HttpHelper
{
    /// Sends file as HTTP response.
    void sendFile(const std::shared_ptr<StreamSocket>& socket, const std::string& path, const std::string& mediaType,
                  Poco::Net::HTTPResponse& response, bool noCache = false, bool deflate = false,
                  const bool headerOnly = false);
}
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
