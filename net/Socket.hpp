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
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <memory>
#include <mutex>
#include <sstream>
#include <thread>
#include <chrono>

#include <Poco/Net/HTTPResponse.h>

#include "Common.hpp"
#include "Log.hpp"
#include "Util.hpp"
#include "SigUtil.hpp"

/// A non-blocking, streaming socket.
class Socket
{
public:
    static const int DefaultSendBufferSize = 16 * 1024;
    static const int MaximumSendBufferSize = 128 * 1024;

    Socket() :
        _fd(socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)),
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
    enum class HandleResult { CONTINUE, SOCKET_CLOSED, MOVED };
    virtual HandleResult handlePoll(std::chrono::steady_clock::time_point now, int events) = 0;

    /// manage latency issues around packet aggregation
    void setNoDelay(bool noDelay = true)
    {
        int val = noDelay ? 1 : 0;
        setsockopt (_fd, IPPROTO_TCP, TCP_NODELAY,
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
    void setThreadOwner(const std::thread::id &id)
    {
#if ENABLE_DEBUG
        if (id != _owner)
        {
            LOG_DBG("#" << _fd << " Thread affinity set to 0x" << std::hex <<
                    id << " (was 0x" << _owner << ")." << std::dec);
            _owner = id;
        }
#else
       (void)id;
#endif
    }

    virtual bool isCorrectThread(bool hard = false)
    {
#if ENABLE_DEBUG
        const bool sameThread = std::this_thread::get_id() == _owner;
        if (!sameThread)
            LOG_WRN("#" << _fd << " Invoked from foreign thread. Expected: 0x" << std::hex <<
                    _owner << " but called from 0x" << std::this_thread::get_id() << " (" <<
                    std::dec << Util::getThreadId() << ").");

        if (hard)
            return sameThread;
        else
            return !getenv("LOOL_CHECK_THREADS") || sameThread;
#else
        (void)hard;
        return true;
#endif
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
#if ENABLE_DEBUG
        _owner = std::this_thread::get_id();
        LOG_DBG("#" << _fd << " Thread affinity set to 0x" << std::hex <<
                _owner << "." << std::dec);

        const int oldSize = getSocketBufferSize();
        setSocketBufferSize(0);
        LOG_TRC("#" << _fd << ": Buffer size: " << getSendBufferSize() <<
                " (was " << oldSize << ")");
#endif
    }

private:
    const int _fd;
    int _sendBufferSize;
    // always enabled to avoid ABI change in debug mode ...
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

    /// Stop the polling thread.
    void stop()
    {
        _stop = true;
        wakeup();
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
    bool isCorrectThread() const
    {
        if (std::this_thread::get_id() != _owner)
            LOG_WRN("Incorrect thread affinity for " << _name << ". Expected: 0x" << std::hex <<
                    _owner << " (" << std::dec << Util::getThreadId() << ") but called from 0x" <<
                    std::hex << std::this_thread::get_id() << std::dec << ", stop: " << _stop);

        return _stop || std::this_thread::get_id() == _owner;
    }

    /// Poll the sockets for available data to read or buffer to write.
    void poll(int timeoutMaxMs)
    {
        assert(isCorrectThread());

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

        // Fire the callback and remove dead fds.
        std::chrono::steady_clock::time_point newNow =
            std::chrono::steady_clock::now();
        for (int i = static_cast<int>(size) - 1; i >= 0; --i)
        {
            Socket::HandleResult res = Socket::HandleResult::SOCKET_CLOSED;
            try
            {
                res = _pollSockets[i]->handlePoll(newNow, _pollFds[i].revents);
            }
            catch (const std::exception& exc)
            {
                LOG_ERR("Error while handling poll for socket #" <<
                        _pollFds[i].fd << " in " << _name << ": " << exc.what());
            }

            if (res == Socket::HandleResult::SOCKET_CLOSED ||
                res == Socket::HandleResult::MOVED)
            {
                LOG_DBG("Removing socket #" << _pollFds[i].fd << " (of " <<
                        _pollSockets.size() << ") from " << _name);
                _pollSockets.erase(_pollSockets.begin() + i);
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

                // Update thread ownership.
                for (auto &i : _newSockets)
                    i->setThreadOwner(std::this_thread::get_id());

                _newSockets.clear();

                // Extract list of callbacks to process
                std::swap(_newCallbacks, invoke);
            }

            for (size_t i = 0; i < invoke.size(); ++i)
                invoke[i]();

            wakeupHook();
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
            LOG_WRN("wakeup socket #" << fd << " is closd at wakeup? error: " << errno);
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
            // Beware - _thread may not be created & started yet.
            newSocket->setThreadOwner(_thread.get_id());
            LOG_DBG("Inserting socket #" << newSocket->getFD() << " into " << _name);
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
        assert(isCorrectThread());
        assert(socket->isCorrectThread(true));
        auto it = std::find(_pollSockets.begin(), _pollSockets.end(), socket);
        assert(it != _pollSockets.end());

        _pollSockets.erase(it);
        LOG_TRC("Release socket #" << socket->getFD() << " from " << _name <<
                " leaving " << _pollSockets.size());
    }

    size_t getSocketCount() const
    {
        assert(isCorrectThread());
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
            _pollFds[i].fd = _pollSockets[i]->getFD();
            _pollFds[i].events = _pollSockets[i]->getPollEvents(now, timeoutMaxMs);
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

            // Invoke the virtual implementation.
            pollingThread();
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
    /// Called when the socket is newly created to
    /// set the socket associated with this ResponseClient.
    /// Will be called exactly once.
    virtual void onConnect(const std::shared_ptr<StreamSocket>& socket) = 0;

    enum class SocketOwnership
    {
        UNCHANGED,  //< Same socket poll, business as usual.
        MOVED       //< The socket poll is now different.
    };

    /// Called after successful socket reads.
    virtual SocketHandlerInterface::SocketOwnership handleIncomingMessage() = 0;

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
            _socketHandler->onDisconnect();

        if (!_shutdownSignalled)
        {
            _shutdownSignalled = true;
            closeConnection();
        }
    }

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
        assert(isCorrectThread());
        int events = _socketHandler->getPollEvents(now, timeoutMaxMs);
        if (!_outBuffer.empty() || _shutdownSignalled)
            events |= POLLOUT;
        return events;
    }

    /// Send data to the socket peer.
    void send(const char* data, const int len, const bool flush = true)
    {
        assert(isCorrectThread(true));
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
    void send(Poco::Net::HTTPResponse& response)
    {
        response.set("User-Agent", HTTP_AGENT_STRING);
        std::ostringstream oss;
        response.write(oss);
        send(oss.str());
    }

    /// Reads data by invoking readData() and buffering.
    /// Return false iff the socket is closed.
    virtual bool readIncomingData()
    {
        assert(isCorrectThread());

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

protected:

    /// Called when a polling event is received.
    /// @events is the mask of events that triggered the wake.
    HandleResult handlePoll(std::chrono::steady_clock::time_point now,
                            const int events) override
    {
        assert(isCorrectThread(true));

        _socketHandler->checkTimeout(now);

        if (!events)
            return Socket::HandleResult::CONTINUE;

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
            if (_socketHandler->handleIncomingMessage() == SocketHandlerInterface::SocketOwnership::MOVED)
                return Socket::HandleResult::MOVED;
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

        return _closed ? HandleResult::SOCKET_CLOSED :
                         HandleResult::CONTINUE;
    }

    /// Override to write data out to socket.
    virtual void writeOutgoingData()
    {
        assert(isCorrectThread(true));
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
        assert(isCorrectThread());
        return ::read(getFD(), buf, len);
    }

    /// Override to handle writing data to socket differently.
    virtual int writeData(const char* buf, const int len)
    {
        assert(isCorrectThread());
        return ::write(getFD(), buf, len);
    }

    void dumpState(std::ostream& os) override;

protected:
    /// Client handling the actual data.
    std::shared_ptr<SocketHandlerInterface> _socketHandler;

    /// True if we are already closed.
    bool _closed;

    /// True when shutdown was requested via shutdown().
    bool _shutdownSignalled;

    std::vector< char > _inBuffer;
    std::vector< char > _outBuffer;

    // To be able to access _inBuffer and _outBuffer.
    // TODO we probably need accessors to the _inBuffer & _outBuffer
    // instead of this many friends...
    friend class WebSocketHandler;
    friend class ClientRequestDispatcher;
    friend class PrisonerRequestDispatcher;
    friend class SimpleResponseClient;
};

namespace HttpHelper
{
    void sendFile(const std::shared_ptr<StreamSocket>& socket, const std::string& path,
                  Poco::Net::HTTPResponse& response, bool noCache = false, bool deflate = false);

    inline void sendFile(const std::shared_ptr<StreamSocket>& socket, const std::string& path,
                         const std::string& mediaType, bool noCache = false, bool deflate = false)
    {
        Poco::Net::HTTPResponse response;
        response.setContentType(mediaType);
        sendFile(socket, path, response, noCache, deflate);
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
