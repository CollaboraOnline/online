/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <poll.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/tcp.h>

#include <atomic>
#include <cassert>
#include <cerrno>
#include <chrono>
#include <climits>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <functional>
#include <iostream>
#include <memory>
#include <mutex>
#include <sstream>
#include <thread>

#include "Common.hpp"
#include "FakeSocket.hpp"
#include "Log.hpp"
#include "Util.hpp"
#include "Protocol.hpp"
#include "Buffer.hpp"
#include "SigUtil.hpp"

#ifdef __linux__
#define HAVE_ABSTRACT_UNIX_SOCKETS
#endif

// Enable to dump socket traffic as hex in logs.
// #define LOG_SOCKET_DATA ENABLE_DEBUG

#define ASSERT_CORRECT_SOCKET_THREAD(socket) \
    socket->assertCorrectThread(__FILE__, __LINE__);

namespace http
{
class Request;
class Response;
}
namespace Poco
{
    class MemoryInputStream;
    namespace Net
    {
        class HTTPRequest;
        class HTTPResponse;
    }
    class URI;
}

class Socket;
class SocketPoll;

/// Helper to allow us to easily defer the movement of a socket
/// between polls to clarify thread ownership.
class SocketDisposition final
{
    enum class Type { CONTINUE, CLOSED, MOVE, TRANSFER };

public:
    typedef std::function<void(const std::shared_ptr<Socket> &)> MoveFunction;

    SocketDisposition(const std::shared_ptr<Socket> &socket) :
        _disposition(Type::CONTINUE),
        _toPoll(nullptr),
        _socket(socket)
    {}
    ~SocketDisposition()
    {
        assert (!_socketMove);
    }
    // not the method you want.
    void setMove(MoveFunction moveFn)
    {
        _socketMove = std::move(moveFn);
        _disposition = Type::MOVE;
    }
    /** move, correctly change ownership of and insert into a new poll.
     * @transferFn is called as a callback inside the new poll, which
     * has its thread started if it is not already.
     * @moveFn can be used for optional setup.
     */
    void setTransfer(SocketPoll &poll, MoveFunction transferFn)
    {
        _socketMove = std::move(transferFn);
        _disposition = Type::TRANSFER;
        _toPoll = &poll; // rely on the closure to ensure lifetime
    }
    void setClosed()
    {
        _disposition = Type::CLOSED;
    }
    std::shared_ptr<Socket> getSocket() const
    {
        return _socket;
    }
    bool isMove() const { return _disposition == Type::MOVE; }
    bool isClosed() const { return _disposition == Type::CLOSED; }
    bool isTransfer() const { return  _disposition == Type::TRANSFER; }
    bool isContinue() const { return _disposition == Type::CONTINUE; }

    /// Perform the queued up work.
    void execute();

private:
    Type _disposition;
    MoveFunction _socketMove;
    SocketPoll *_toPoll;
    std::shared_ptr<Socket> _socket;
};

/// A non-blocking, streaming socket.
class Socket
{
public:
    static constexpr int DefaultSendBufferSize = 16 * 1024;
    static constexpr int MaximumSendBufferSize = 128 * 1024;
    static std::atomic<bool> InhibitThreadChecks;

    enum Type { IPv4, IPv6, All, Unix };

    // NB. see other Socket::Socket by init below.
    Socket(Type type)
        : _fd(createSocket(type))
    {
        init();
    }

    virtual ~Socket()
    {
        LOG_TRC("Socket dtor");

        // Doesn't block on sockets; no error handling needed.
#if !MOBILEAPP
        ::close(_fd);
        LOG_DBG("Closed socket to [" << clientAddress() << ']');
#else
        fakeSocketClose(_fd);
#endif
    }

    /// Create socket of the given type.
    static int createSocket(Type type);

    void setClientAddress(const std::string& address)
    {
        _clientAddress = address;
    }

    const std::string& clientAddress() const
    {
        return _clientAddress;
    }

    /// Returns the OS native socket fd.
    int getFD() const { return _fd; }

    /// Shutdown the socket.
    /// TODO: Support separate read/write shutdown.
    virtual void shutdown()
    {
        LOG_TRC("Socket shutdown RDWR.");
#if !MOBILEAPP
        ::shutdown(_fd, SHUT_RDWR);
#else
        fakeSocketShutdown(_fd);
#endif
    }

    /// Prepare our poll record; adjust @timeoutMaxMs downwards
    /// for timeouts, based on current time @now.
    /// @returns POLLIN and POLLOUT if output is expected.
    virtual int getPollEvents(std::chrono::steady_clock::time_point now,
                              int64_t &timeoutMaxMicroS) = 0;

    /// Handle results of events returned from poll
    virtual void handlePoll(SocketDisposition &disposition,
                            std::chrono::steady_clock::time_point now,
                            int events) = 0;

    /// Do we have internally queued incoming / outgoing data ?
    virtual bool hasBuffered() const { return false; }

    /// manage latency issues around packet aggregation
    void setNoDelay()
    {
#if !MOBILEAPP
        const int val = 1;
        ::setsockopt(_fd, IPPROTO_TCP, TCP_NODELAY,
                     (char *) &val, sizeof(val));
#endif
    }

#if !MOBILEAPP
    /// Uses peercreds to get prisoner PID if present or -1
    int getPid() const;

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
            _sendBufferSize = DefaultSendBufferSize;
            LOG_SYS("Error getting socket buffer size. Using default size of " << _sendBufferSize
                                                                               << " bytes.");
            return false;
        }
        else
        {
            if (_sendBufferSize > MaximumSendBufferSize * 2)
            {
                LOG_TRC("Clamped send buffer size to " << MaximumSendBufferSize << " from "
                                                       << _sendBufferSize);
                _sendBufferSize = MaximumSendBufferSize;
            }
            else
                LOG_TRC("Set socket buffer size to " << _sendBufferSize);
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
#endif

    /// Gets our fast cache of the socket buffer size
    int getSendBufferSize() const
    {
#if !MOBILEAPP
        return _sendBufferSize;
#else
        return INT_MAX; // We want to always send a single record in one go
#endif
    }

#if !MOBILEAPP
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
#endif

    // Does this socket come from the localhost ?
    bool isLocal() const;

    virtual void dumpState(std::ostream&) {}

    /// Set the thread-id we're bound to
    void setThreadOwner(const std::thread::id &id)
    {
        if (id != _owner)
        {
            LOG_TRC("Thread affinity set to " << Log::to_string(id) << " (was "
                                              << Log::to_string(_owner) << ')');
            _owner = id;
        }
    }

    /// Reset the thread-id while it's in transition.
    void resetThreadOwner()
    {
        if (std::thread::id() != _owner)
        {
            LOG_TRC("Resetting thread affinity while in transit (was " << Log::to_string(_owner)
                                                                       << ')');
            _owner = std::thread::id();
        }
    }

    /// Returns the owner thread's id.
    const std::thread::id& getThreadOwner() const { return _owner; }

    /// Asserts in the debug builds, otherwise just logs.
    void assertCorrectThread(const char* fileName, int lineNo)
    {
        if (InhibitThreadChecks)
            return;
        // uninitialized owner means detached and can be invoked by any thread.
        const bool sameThread = (_owner == std::thread::id() || std::this_thread::get_id() == _owner);
        if (!sameThread)
            LOG_ERR("Invoked from foreign thread. Expected: "
                    << Log::to_string(_owner) << " but called from "
                    << Log::to_string(std::this_thread::get_id()) << " (" << Util::getThreadId()
                    << ")"
                    << " (" << fileName << ":" << lineNo << ")");

        // assert(sameThread);
    }

    bool ignoringInput() const { return _ignoreInput; }

    // Ensure that no further input is processed from this socket
    virtual void ignoreInput()
    {
        LOG_TRC("Ignore further input on socket.");
        _ignoreInput = true;
    }
protected:
    /// Construct based on an existing socket fd.
    /// Used by accept() only.
    Socket(const int fd)
        : _fd(fd)
    {
        init();
    }

    void init()
    {
        setNoDelay();
        _ignoreInput = false;
        _sendBufferSize = DefaultSendBufferSize;
        _owner = std::this_thread::get_id();
        LOG_TRC("Created socket. Thread affinity set to " << Log::to_string(_owner));

#if !MOBILEAPP
#if ENABLE_DEBUG
        if (std::getenv("COOL_ZERO_BUFFER_SIZE"))
        {
            const int oldSize = getSocketBufferSize();
            setSocketBufferSize(0);
            LOG_TRC("Buffer size: " << getSendBufferSize() << " (was " << oldSize << ')');
        }
#endif
#endif
    }

    inline void logPrefix(std::ostream& os) const { os << '#' << _fd << ": "; }

private:
    std::string _clientAddress;
    const int _fd;

    // If _ignoreInput is true no more input from this socket will be processed.
    bool _ignoreInput;

    int _sendBufferSize;

    /// We check the owner even in the release builds, needs to be always correct.
    std::thread::id _owner;
};

class StreamSocket;
class MessageHandlerInterface;

/// Interface that decodes the actual incoming message.
class ProtocolHandlerInterface :
    public std::enable_shared_from_this<ProtocolHandlerInterface>
{
    int _fdSocket; //< The socket file-descriptor.

protected:
    /// We own a message handler, after decoding the socket data we pass it on as messages.
    std::shared_ptr<MessageHandlerInterface> _msgHandler;

    /// Sets the context used by logPrefix.
    void setLogContext(int fd) { _fdSocket = fd; }

    /// Used by the logging macros to automatically log a context prefix.
    inline void logPrefix(std::ostream& os) const { os << '#' << _fdSocket << ": "; }

public:
    ProtocolHandlerInterface()
        : _fdSocket(-1)
    {
    }

    // ------------------------------------------------------------------
    // Interface for implementing low level socket goodness from streams.
    // ------------------------------------------------------------------
    virtual ~ProtocolHandlerInterface() { }

    /// Called when the socket is newly created to
    /// set the socket associated with this ResponseClient.
    /// Will be called exactly once.
    virtual void onConnect(const std::shared_ptr<StreamSocket>& socket) = 0;

    /// Enable/disable processing of incoming data at socket level.
    virtual void enableProcessInput(bool /*enable*/){};
    virtual bool processInputEnabled() const { return true; };

    /// Called after successful socket reads.
    virtual void handleIncomingMessage(SocketDisposition &disposition) = 0;

    /// Prepare our poll record; adjust @timeoutMaxMs downwards
    /// for timeouts, based on current time @now.
    /// @returns POLLIN and POLLOUT if output is expected.
    virtual int getPollEvents(std::chrono::steady_clock::time_point now,
                              int64_t &timeoutMaxMicroS) = 0;

    /// Do we need to handle a timeout ?
    virtual void checkTimeout(std::chrono::steady_clock::time_point /* now */) {}

    /// Do some of the queued writing.
    virtual void performWrites(std::size_t capacity) = 0;

    /// Called when the socket is disconnected and will be destroyed.
    /// Will be called exactly once.
    virtual void onDisconnect() {}

    // -----------------------------------------------------------------
    //            Interface for external MessageHandlers
    // -----------------------------------------------------------------
public:
    void setMessageHandler(const std::shared_ptr<MessageHandlerInterface> &msgHandler)
    {
        _msgHandler = msgHandler;
    }

    /// Clear all external references
    virtual void dispose() { _msgHandler.reset(); }

    /// Sends a text message.
    /// Returns the number of bytes written (including frame overhead) on success,
    /// 0 for closed/invalid socket, and -1 for other errors.
    virtual int sendTextMessage(const char* msg, const size_t len, bool flush = false) const = 0;

    /// Sends a binary message.
    /// Returns the number of bytes written (including frame overhead) on success,
    /// 0 for closed/invalid socket, and -1 for other errors.
    virtual int sendBinaryMessage(const char *data, const size_t len, bool flush = false) const = 0;

    /// Shutdown the socket and specify if the endpoint is going away or not (useful for WS).
    /// Optionally provide a message sent in the close frame (useful for WS).
    virtual void shutdown(bool goingAway = false,
                          const std::string& statusMessage = std::string()) = 0;

    virtual void getIOStats(uint64_t &sent, uint64_t &recv) = 0;

    /// Append pretty printed internal state to a line
    virtual void dumpState(std::ostream& os) { os << '\n'; }
};

// Forward declare WebSocketHandler, which is inherited from ProtocolHandlerInterface.
class WebSocketHandler;

/// A ProtocolHandlerInterface with dummy sending API.
class SimpleSocketHandler : public ProtocolHandlerInterface
{
public:
    SimpleSocketHandler() {}
    int sendTextMessage(const char*, const size_t, bool) const override { return 0; }
    int sendBinaryMessage(const char*, const size_t, bool) const override { return 0; }
    void shutdown(bool, const std::string &) override {}
    void getIOStats(uint64_t &, uint64_t &) override {}
};

/// Interface that receives and sends incoming messages.
class MessageHandlerInterface :
    public std::enable_shared_from_this<MessageHandlerInterface>
{
protected:
    std::shared_ptr<ProtocolHandlerInterface> _protocol;
    MessageHandlerInterface(std::shared_ptr<ProtocolHandlerInterface> protocol)
        : _protocol(std::move(protocol))
    {
    }

    virtual ~MessageHandlerInterface() {}

public:
    /// Setup, after construction for shared_from_this
    void initialize()
    {
        if (_protocol)
            _protocol->setMessageHandler(shared_from_this());
    }

    /// Clear all external references
    virtual void dispose()
    {
        if (_protocol)
        {
            _protocol->dispose();
            _protocol.reset();
        }
    }

    std::shared_ptr<ProtocolHandlerInterface> getProtocol() const
    {
        return _protocol;
    }

    /// Do we have something to send ?
    virtual bool hasQueuedMessages() const = 0;
    /// Please send them to me then.
    /// Write queued messages into the socket, at least capacity bytes,
    /// and up to the next message boundary.
    virtual void writeQueuedMessages(std::size_t capacity) = 0;
    /// We just got a message - here it is
    virtual void handleMessage(const std::vector<char> &data) = 0;
    /// Get notified that the underlying transports disconnected
    virtual void onDisconnect() = 0;
    /// Append pretty printed internal state to a line
    virtual void dumpState(std::ostream& os) = 0;
};

class InputProcessingManager
{
public:
    InputProcessingManager(const std::shared_ptr<ProtocolHandlerInterface> &protocol, bool inputProcess)
    : _protocol(protocol)
    {
        if (_protocol)
        {
            // Save previous state to be restored in destructor
            _prevInputProcess = _protocol->processInputEnabled();
            protocol->enableProcessInput(inputProcess);
        }
    }

    ~InputProcessingManager()
    {
        // Restore previous state
        if (_protocol)
            _protocol->enableProcessInput(_prevInputProcess);
    }

private:
    std::shared_ptr<ProtocolHandlerInterface> _protocol;
    bool _prevInputProcess;
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
    explicit SocketPoll(std::string threadName);
    virtual ~SocketPoll();

    /// Default poll time - useful to increase for debugging.
    static constexpr std::chrono::microseconds DefaultPollTimeoutMicroS = std::chrono::seconds(5);
    static std::atomic<bool> InhibitThreadChecks;

    /// Stop the polling thread.
    void stop()
    {
        LOG_DBG("Stopping SocketPoll thread " << _name);
        _stop = true;
#if MOBILEAPP
        {
            // We don't want to risk some callbacks in _newCallbacks being invoked when we start
            // running a thread for this SocketPoll again.
            std::lock_guard<std::mutex> lock(_mutex);
            if (_newCallbacks.size() > 0)
            {
                LOG_WRN("_newCallbacks is non-empty when stopping, clearing it.");
                _newCallbacks.clear();
            }
        }
#endif
        wakeup();
    }

    void removeSockets()
    {
        LOG_DBG("Removing all sockets from SocketPoll thread " << _name);
        assertCorrectThread();

        while (!_pollSockets.empty())
        {
            const std::shared_ptr<Socket>& socket = _pollSockets.back();
            assert(socket);

            LOG_DBG("Removing socket #" << socket->getFD() << " from " << _name);
            ASSERT_CORRECT_SOCKET_THREAD(socket);
            socket->resetThreadOwner();

            _pollSockets.pop_back();
        }
    }

    bool isAlive() const { return (_threadStarted && !_threadFinished) || _runOnClientThread; }

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
            poll(DefaultPollTimeoutMicroS);
        }
    }

    const std::thread::id &getThreadOwner()
    {
        return _owner;
    }

    /// Are we running in either shutdown, or the polling thread.
    /// Asserts in the debug builds, otherwise just logs.
    void assertCorrectThread() const
    {
        if (InhibitThreadChecks)
            return;
        // uninitialized owner means detached and can be invoked by any thread.
        const bool sameThread = (!isAlive() || _owner == std::thread::id() || std::this_thread::get_id() == _owner);
        if (!sameThread)
            LOG_ERR("Incorrect thread affinity for "
                    << _name << ". Expected: " << _owner << " (" << Util::getThreadId()
                    << ") but called from " << std::this_thread::get_id() << ", stop: " << _stop);

        assert(_stop || sameThread);
    }

    /// Kit poll can be called from LOK's Yield in any thread, adapt to that.
    void checkAndReThread()
    {
        if (InhibitThreadChecks)
            return; // in late shutdown
        const std::thread::id us = std::this_thread::get_id();
        if (_owner == us)
            return; // all well
        LOG_DBG("Unusual - SocketPoll used from a new thread");
        _owner = us;
        for (const auto& it : _pollSockets)
            it->setThreadOwner(us);
        // _newSockets are adapted as they are inserted.
    }

    /// Poll the sockets for available data to read or buffer to write.
    /// Returns the return-value of poll(2): 0 on timeout,
    /// -1 for error, and otherwise the number of events signalled.
    int poll(std::chrono::microseconds timeoutMax) { return poll(timeoutMax.count()); }

    /// Poll the sockets for available data to read or buffer to write.
    /// Returns the return-value of poll(2): 0 on timeout,
    /// -1 for error, and otherwise the number of events signalled.
    /// Takes the deadline, instead of a timeout.
    int poll(std::chrono::steady_clock::time_point deadline)
    {
        const auto now = std::chrono::steady_clock::now();
        return poll(std::chrono::duration_cast<std::chrono::microseconds>(deadline - now));
    }

    /// Write to a wakeup descriptor
    static void wakeup (int fd)
    {
        // wakeup the main-loop.
        int rc;
        do {
#if !MOBILEAPP
            rc = ::write(fd, "w", 1);
#else
            rc = fakeSocketWrite(fd, "w", 1);
#endif
        } while (rc == -1 && errno == EINTR);

        if (rc == -1 && errno != EAGAIN && errno != EWOULDBLOCK)
            LOG_SYS("wakeup socket #" << fd << " is closed at wakeup?");
    }

    /// Wakeup the main polling loop in another thread
    void wakeup()
    {
        // There is a race when shutting down because
        // SocketPoll threads exit when shutting down.
        if (!isAlive() && !SigUtil::getShutdownRequestFlag())
            LOG_WRN("Waking up dead poll thread ["
                    << _name << "], started: " << (_threadStarted ? "true" : "false")
                    << ", finished: " << _threadFinished);

        wakeup(_wakeup[1]);
    }

    /// Global wakeup - signal safe: wakeup all socket polls.
    static void wakeupWorld();

    /// Insert a new socket to be polled.
    /// A socket is removed when it is closed, readIncomingData
    /// returns false, or when removeSockets is called (which is
    /// done automatically when SocketPoll is stopped via joinThread).
    void insertNewSocket(std::shared_ptr<Socket> newSocket)
    {
        if (newSocket)
        {
            LOG_TRC("Inserting socket #" << newSocket->getFD() << ", address ["
                                         << newSocket->clientAddress() << "], into " << _name);
            // sockets in transit are un-owned.
            newSocket->resetThreadOwner();

            std::lock_guard<std::mutex> lock(_mutex);
            _newSockets.emplace_back(std::move(newSocket));
            wakeup();
        }
    }

#if !MOBILEAPP
    /// Inserts a new remote websocket to be polled.
    /// NOTE: The DNS lookup is synchronous.
    void insertNewWebSocketSync(const Poco::URI& uri,
                                const std::shared_ptr<WebSocketHandler>& websocketHandler);

    bool insertNewUnixSocket(
        const std::string &location,
        const std::string &pathAndQuery,
        const std::shared_ptr<WebSocketHandler>& websocketHandler,
        const int shareFD = -1);
#else
    void insertNewFakeSocket(
        int peerSocket,
        const std::shared_ptr<ProtocolHandlerInterface>& websocketHandler);
#endif

    typedef std::function<void()> CallbackFn;

    /// Add a callback to be invoked in the polling thread
    void addCallback(const CallbackFn& fn)
    {
        std::lock_guard<std::mutex> lock(_mutex);
        bool wasEmpty = _newCallbacks.empty();
        _newCallbacks.emplace_back(fn);
        if (wasEmpty)
            wakeup();
    }

    virtual void dumpState(std::ostream& os);

    size_t getSocketCount() const
    {
        assertCorrectThread();
        return _pollSockets.size();
    }

    const std::string& name() const { return _name; }

    /// Start the polling thread (if desired)
    /// Mutually exclusive with runOnClientThread().
    bool startThread();

    /// Stop and join the polling thread before returning (if active)
    void joinThread();

    /// Called to prevent starting own poll thread
    /// when polling is done on the client's thread.
    /// Mutually exclusive with startThread().
    bool runOnClientThread()
    {
        assert(!_threadStarted);

        if (!_threadStarted)
        {
            // TODO: should avoid wakeup resource creation too.
            _runOnClientThread = true;
            return true;
        }

        return false;
    }

protected:
    bool isStop() const
    {
        return _stop;
    }
    bool hasCallbacks()
    {
        std::lock_guard<std::mutex> lock(_mutex);
        return _newCallbacks.size() > 0;
    }

    bool hasBuffered() const
    {
        for (const auto& it : _pollSockets)
            if (it->hasBuffered())
                return true;
        return false;
    }

private:
    /// Actual poll implementation
    int poll(int64_t timeoutMaxMicroS);

    /// Initialize the poll fds array with the right events
    void setupPollFds(std::chrono::steady_clock::time_point now,
                      int64_t &timeoutMaxMicroS)
    {
        const size_t size = _pollSockets.size();

        _pollFds.resize(size + 1); // + wakeup pipe

        for (size_t i = 0; i < size; ++i)
        {
            int events = _pollSockets[i]->getPollEvents(now, timeoutMaxMicroS);
            assert(events >= 0 && "The events bitmask must be non-negative, where 0 means skip all events.");

            if (_pollSockets[i]->ignoringInput())
                events &= ~POLLIN; // mask out input.

            _pollFds[i].fd = _pollSockets[i]->getFD();
            _pollFds[i].events = events;
            _pollFds[i].revents = 0;
            LOG_TRC('#' << _pollFds[i].fd << ": setupPollFds getPollEvents: 0x" << std::hex
                        << events << std::dec);
        }

        // Add the read-end of the wake pipe.
        _pollFds[size].fd = _wakeup[0];
        _pollFds[size].events = POLLIN;
        _pollFds[size].revents = 0;
    }

    /// The polling thread entry.
    /// Used to set the thread name and mark the thread as stopped when done.
    void pollingThreadEntry();

    /// Debug name used for logging.
    const std::string _name;

    /// main-loop wakeup pipe
    int _wakeup[2];
    /// The sockets we're controlling
    std::vector<std::shared_ptr<Socket>> _pollSockets;
    /// We start handling the poll results of the above sockets at a different index each time, to
    /// not arbitrarily prioritize some
    size_t _pollStartIndex;
    /// Protects _newSockets and _newCallbacks
    std::mutex _mutex;
    std::vector<std::shared_ptr<Socket>> _newSockets;
    std::vector<CallbackFn> _newCallbacks;
    /// The fds to poll.
    std::vector<pollfd> _pollFds;

    /// Flag the thread to stop.
    std::atomic<bool> _stop;
    /// The polling thread.
    std::thread _thread;
    std::atomic<int64_t> _threadStarted;
    std::atomic<bool> _threadFinished;
    std::atomic<bool> _runOnClientThread;
    std::thread::id _owner;
};

/// A SocketPoll that will stop polling and
/// terminate when the TerminationFlag is set.
class TerminatingPoll : public SocketPoll
{
public:
    TerminatingPoll(const std::string &threadName) :
        SocketPoll(threadName) {}

    bool continuePolling() override
    {
        return SocketPoll::continuePolling() && !SigUtil::getTerminationFlag();
    }
};

/// A plain, non-blocking, data streaming socket.
class StreamSocket : public Socket,
                     public std::enable_shared_from_this<StreamSocket>
{
public:
    enum ReadType
    {
        NormalRead,
        UseRecvmsgExpectFD
    };

    /// Create a StreamSocket from native FD.
    StreamSocket(std::string host, const int fd, bool /* isClient */,
                 std::shared_ptr<ProtocolHandlerInterface> socketHandler,
                 ReadType readType = NormalRead) :
        Socket(fd),
        _hostname(std::move(host)),
        _socketHandler(std::move(socketHandler)),
        _bytesSent(0),
        _bytesRecvd(0),
        _wsState(WSState::HTTP),
        _closed(false),
        _sentHTTPContinue(false),
        _shutdownSignalled(false),
        _incomingFD(-1),
        _readType(readType),
        _inputProcessingEnabled(true)
    {
        LOG_TRC("StreamSocket ctor");

        // Without a handler we make no sense object.
        if (!_socketHandler)
            throw std::runtime_error("StreamSocket " + std::to_string(fd) +
                                     " expects a valid SocketHandler instance.");
    }

    ~StreamSocket()
    {
        LOG_TRC("StreamSocket dtor called with pending write: " << _outBuffer.size()
                                                                << ", read: " << _inBuffer.size());

        if (!_closed)
        {
            ASSERT_CORRECT_SOCKET_THREAD(this);
            _socketHandler->onDisconnect();
            _socketHandler.reset();
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

    /// Returns the peer hostname, if set.
    const std::string& hostname() const { return _hostname; }

    /// Just trigger the async shutdown.
    virtual void shutdown() override
    {
        _shutdownSignalled = true;
        LOG_TRC("Async shutdown requested.");
    }

    virtual void ignoreInput() override
    {
        Socket::ignoreInput();
        _inBuffer.clear();
    }

    /// Perform the real shutdown.
    virtual void closeConnection()
    {
        Socket::shutdown();
    }

    int getPollEvents(std::chrono::steady_clock::time_point now,
                      int64_t &timeoutMaxMicroS) override
    {
        // cf. SslSocket::getPollEvents
        ASSERT_CORRECT_SOCKET_THREAD(this);
        int events = _socketHandler->getPollEvents(now, timeoutMaxMicroS);
        if (!_outBuffer.empty() || _shutdownSignalled)
            events |= POLLOUT;
        return events;
    }

    virtual bool hasBuffered() const override
    {
        return !_outBuffer.empty() || !_inBuffer.empty();
    }

    /// Send data to the socket peer.
    void send(const char* data, const int len, const bool doFlush = true)
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);
        if (data != nullptr && len > 0)
        {
            _outBuffer.append(data, len);
            if (doFlush)
                writeOutgoingData();
        }
    }

    /// Send a string to the socket peer.
    void send(const std::string& str, const bool doFlush = true)
    {
        send(str.data(), str.size(), doFlush);
    }

    /// Sends HTTP response.
    /// Adds Date and User-Agent.
    void send(Poco::Net::HTTPResponse& response);

    /// Send an http::Request and flush.
    /// Does not add any fields to the header.
    /// Will shutdown the socket upon error and return false.
    bool send(http::Request& request);

    /// Send an http::Response and flush.
    /// Does not add any fields to the header.
    /// Will shutdown the socket upon error and return false.
    bool send(const http::Response& response);

    /// Send an http::Response, flush, and shutdown.
    /// Will set 'Connection: close' header.
    /// Returns true if no errors are encountered.
    /// Will always shutdown the socket.
    bool sendAndShutdown(http::Response& response);

    /// Safely flush any outgoing data.
    inline void flush()
    {
        if (!_outBuffer.empty())
            writeOutgoingData();
    }

    /// Sends data with file descriptor as control data.
    /// Can be used only with Unix sockets.
    void sendFD(const char* data, const uint64_t len, int fd)
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);

        // Flush existing non-ancillary data
        // so that our non-ancillary data will
        // match ancillary data.
        flush();

        msghdr msg;
        iovec iov[1];

        iov[0].iov_base = const_cast<char*>(data);
        iov[0].iov_len = len;

        msg.msg_name = nullptr;
        msg.msg_namelen = 0;
        msg.msg_iov = &iov[0];
        msg.msg_iovlen = 1;

        char adata[CMSG_SPACE(sizeof(int))];
        cmsghdr *cmsg = (cmsghdr*)adata;
        cmsg->cmsg_type = SCM_RIGHTS;
        cmsg->cmsg_level = SOL_SOCKET;
        cmsg->cmsg_len = CMSG_LEN(sizeof(int));
        *(int *)CMSG_DATA(cmsg) = fd;

        msg.msg_control = const_cast<char*>(adata);
        msg.msg_controllen = CMSG_LEN(sizeof(int));
        msg.msg_flags = 0;

#ifdef LOG_SOCKET_DATA
        if (len > 0)
            LOG_TRC("(Unix) outBuffer (" << len << " bytes):\n"
                                         << Util::dumpHex(std::string(data, len)));
#endif

        //FIXME: retry on EINTR?
        const auto wrote = sendmsg(getFD(), &msg, 0);
        if (wrote < 0)
            LOG_SYS("Failed to send message to unix socket");
        else
            LOG_TRC("Wrote " << wrote << " bytes of " << len);
    }

    /// Reads data by invoking readData() and buffering.
    /// Returns the last return from writeData. 0 implies socket is closed.
    virtual int readIncomingData()
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);

        if (ignoringInput())
        {
            LOG_WRN("Ignoring attempted read from " << getFD());
            return false; // error - close it.
        }

#if !MOBILEAPP
        // SSL decodes blocks of 16Kb, so for efficiency we use the same.
        char buf[16 * 1024];
        ssize_t len = 0;
        int last_errno = 0;
        do
        {
            // Drain the read buffer.
            // Note: we read as much as possible as
            // we are typically capped by hardware buffer
            // size anyway, and better to drain it fast.
            do
            {
                len = readData(buf, sizeof(buf));
                if (len < 0)
                    last_errno = errno; // Save only on error.

                if (len < 0 && last_errno != EAGAIN && last_errno != EWOULDBLOCK)
                    LOG_SYS_ERRNO(last_errno,
                                  "Read failed, have " << _inBuffer.size() << " buffered bytes");
                else if (len < 0)
                    LOG_TRC("Read failed ("
                            << len << "), have " << _inBuffer.size() << " buffered bytes ("
                            << Util::symbolicErrno(last_errno) << ": " << std::strerror(last_errno)
                            << ')');
                else if (len == 0)
                    LOG_TRC("Read closed (0), have " << _inBuffer.size() << " buffered bytes");
                else // Success.
                    LOG_TRC("Read " << len << " bytes in addition to " << _inBuffer.size()
                                    << " buffered bytes"
#ifdef LOG_SOCKET_DATA
                            << (len ? Util::dumpHex(std::string(buf, len), ":\n") : std::string())
#endif
                    );
            } while (len < 0 && last_errno == EINTR);

            if (len > 0)
            {
                LOG_ASSERT_MSG(len <= ssize_t(sizeof(buf)),
                               "Read more data than the buffer size");
                _bytesRecvd += len;
                _inBuffer.append(&buf[0], len);
            }
            // else poll will handle errors.
        }
        while (len == (sizeof(buf)));

        // Restore errno from the read call.
        errno = last_errno;
#else
        LOG_TRC("readIncomingData #" << getFD());
        ssize_t available = fakeSocketAvailableDataLength(getFD());
        ssize_t len;
        if (available == -1)
            len = -1;
        else if (available == 0)
            len = 0;
        else
        {
            std::vector<char>buf(available);
            len = readData(buf.data(), available);
            assert(len == available);
            _bytesRecvd += len;
            assert(_inBuffer.empty());
            _inBuffer.append(buf.data(), len);
        }
#endif

        return len;
    }

    /// Replace the existing SocketHandler with a new one.
    void setHandler(std::shared_ptr<ProtocolHandlerInterface> handler)
    {
        _socketHandler = std::move(handler);
        _socketHandler->onConnect(shared_from_this());
    }

    /// Create a socket of type TSocket given an FD and a handler.
    /// We need this helper since the handler needs a shared_ptr to the socket
    /// but we can't have a shared_ptr in the ctor.
    template <typename TSocket>
    static std::shared_ptr<TSocket> create(std::string hostname, const int fd, bool isClient,
                                           std::shared_ptr<ProtocolHandlerInterface> handler,
                                           ReadType readType = NormalRead)
    {
        ProtocolHandlerInterface* pHandler = handler.get();
        auto socket = std::make_shared<TSocket>(std::move(hostname), fd, isClient,
                                                std::move(handler), readType);
        pHandler->onConnect(socket);
        return socket;
    }

        /// Messages can be in chunks, only parts of message being valid.
    struct MessageMap {
        MessageMap() : _headerSize(0), _messageSize(0) {}
        /// Size of HTTP headers
        size_t _headerSize;
        /// Entire size of data associated with this message
        size_t _messageSize;
        // offset + lengths to collate into the real stream
        std::vector<std::pair<size_t, size_t>> _spans;
    };

    /// remove all queued input bytes
    void clearInput()
    {
        _inBuffer.clear();
    }

    /// Remove the first @count bytes from input buffer
    void eraseFirstInputBytes(const MessageMap &map)
    {
        eraseFirstInputBytes(map._headerSize);
    }

    /// Remove the first @count bytes from input buffer
    void eraseFirstInputBytes(const std::size_t count)
    {
        size_t toErase = std::min(count, _inBuffer.size());
        if (toErase < count)
            LOG_ERR("Attempted to remove: " << count << " which is > size: " << _inBuffer.size()
                                            << " clamped to " << toErase);
        if (toErase > 0)
            _inBuffer.eraseFirst(count);
    }

    /// Compacts chunk headers away leaving just the data we want
    /// returns true if we did any re-sizing/movement of _inBuffer.
    bool compactChunks(MessageMap *map);

    /// Detects if we have an HTTP header in the provided message and
    /// populates a request for that.
    bool parseHeader(const char *clientLoggingName,
                     Poco::MemoryInputStream &message,
                     Poco::Net::HTTPRequest &request,
                     MessageMap *map = nullptr);

    /// Get input/output statistics on this stream
    void getIOStats(uint64_t &sent, uint64_t &recv)
    {
        sent = _bytesSent;
        recv = _bytesRecvd;
    }

    Buffer& getInBuffer() { return _inBuffer; }

    Buffer& getOutBuffer()
    {
        return _outBuffer;
    }

    int getIncomingFD()
    {
        return _incomingFD;
    }

    bool processInputEnabled() const { return _inputProcessingEnabled; }
    void enableProcessInput(bool enable = true){ _inputProcessingEnabled = enable; }

    /// The available number of bytes in the socket
    /// buffer for an optimal transmission.
    int getSendBufferCapacity() const
    {
#if !MOBILEAPP
        const int capacity = getSendBufferSize();
        return std::max<int>(0, capacity - _outBuffer.size());
#else
        return INT_MAX; // We want to always send a single record in one go
#endif
    }

protected:

    std::vector<std::pair<size_t, size_t>> findChunks(Poco::Net::HTTPRequest &request);

    /// Called when a polling event is received.
    /// @events is the mask of events that triggered the wake.
    void handlePoll(SocketDisposition &disposition,
                    std::chrono::steady_clock::time_point now,
                    const int events) override
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);

        LOG_TRC("Revents: 0x" << std::hex << events << std::dec);

        _socketHandler->checkTimeout(now);

        if (!events && _inBuffer.empty())
            return;

        bool closed = (events & (POLLHUP | POLLERR | POLLNVAL));

        if (events & POLLIN)
        {
            // readIncomingData returns false only if the read len is 0 (closed).
            // Oddly enough, we don't necessarily get POLLHUP after read(2) returns 0.
            const int read = readIncomingData();
            const int last_errno = errno;
            LOG_TRC("Incoming data buffer "
                    << _inBuffer.size() << " bytes, read result: " << read << ", events: 0x"
                    << std::hex << events << std::dec << " (" << (closed ? "closed" : "not closed")
                    << ')'
#ifdef LOG_SOCKET_DATA
                    << (!_inBuffer.empty() ? Util::dumpHex(_inBuffer, ":\n") : std::string())
#endif
            );
            if (read > 0 && closed)
            {
                // We might have outstanding data to read, wait until readIncomingData returns closed state.
                LOG_DBG("Closed but will drain incoming data per POLLIN");
                closed = false;
            }
            else if (read == 0 || (read < 0 && (last_errno == EPIPE || last_errno == ECONNRESET)))
            {
                LOG_DBG("Closed after reading");
                closed = true;
            }
        }

        // If we have data, allow the app to consume.
        size_t oldSize = 0;
        while (!_inBuffer.empty() && oldSize != _inBuffer.size() && processInputEnabled())
        {
            oldSize = _inBuffer.size();

            try
            {
                _socketHandler->handleIncomingMessage(disposition);
            }
            catch (const std::exception& exception)
            {
                LOG_ERR("Error during handleIncomingMessage: " << exception.what());
            }
            catch (...)
            {
                LOG_ERR("Error during handleIncomingMessage.");
            }

            if (disposition.isMove() || disposition.isTransfer())
                return;
        }

        do
        {
            // If we have space for writing and that was requested
            if (events & POLLOUT)
            {
                // Try to get multiple blocks at a time.
                const int capacity = getSendBufferCapacity();
                if (capacity > 0)
                    _socketHandler->performWrites(capacity);
            }

            // perform the shutdown if we have sent everything.
            if (_shutdownSignalled && _outBuffer.empty())
            {
                LOG_TRC("Shutdown Signaled. Close Connection.");
                closeConnection();
                closed = true;
                break;
            }

            oldSize = _outBuffer.size();

            // Write if we can and have data to write.
            if ((events & POLLOUT) && !_outBuffer.empty())
            {
                if (writeOutgoingData() < 0)
                {
                    const int last_errno = errno;
                    if (last_errno == EPIPE || last_errno == ECONNRESET)
                    {
                        LOG_DBG("Disconnected while writing (" << Util::symbolicErrno(last_errno)
                                                               << "): " << std::strerror(last_errno)
                                                               << ')');
                        closed = true;
                        break;
                    }
                }
            }
        }
        while (oldSize != _outBuffer.size());

        if (closed)
        {
            LOG_TRC("Closed. Firing onDisconnect.");
            _closed = true;
            _socketHandler->onDisconnect();
        }

        if (_closed)
            disposition.setClosed();
    }

public:
    /// Override to write data out to socket.
    /// Returns the last return from writeData.
    virtual int writeOutgoingData()
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);
        assert(!_outBuffer.empty());
        ssize_t len = 0;
        int last_errno = 0;
        do
        {
            do
            {
                // Writing much more than we can absorb in the kernel causes wastage.
                const int size = std::min((int)_outBuffer.getBlockSize(), getSendBufferSize());
                if (size == 0)
                    break;

                len = writeData(_outBuffer.getBlock(), size);
                if (len < 0)
                    last_errno = errno; // Save only on error.

                // 0 len is unspecified result, according to man write(2).
                if (len < 0 && last_errno != EAGAIN && last_errno != EWOULDBLOCK)
                    LOG_SYS_ERRNO(last_errno, "Socket write returned " << len);
                else if (len <= 0) // Trace errno for debugging, even for "unspecified result."
                    LOG_TRC("Write failed, have " << _outBuffer.size() << " buffered bytes ("
                                                  << Util::symbolicErrno(last_errno) << ": "
                                                  << std::strerror(last_errno) << ')');
                else // Success.
                    LOG_TRC("Wrote " << len << " bytes of " << _outBuffer.size() << " buffered data"
#ifdef LOG_SOCKET_DATA
                            << (len ? Util::dumpHex(std::string(_outBuffer.getBlock(), len), ":\n")
                                    : std::string())
#endif
                    );
            }
            while (len < 0 && last_errno == EINTR);

            if (len > 0)
            {
                LOG_ASSERT_MSG(len <= ssize_t(_outBuffer.size()),
                               "Consumed more data than available");
                _bytesSent += len;
                _outBuffer.eraseFirst(len);
            }
            else
            {
                // Poll will handle errors.
                break;
            }
        }
        while (!_outBuffer.empty());

        // Restore errno from the write call.
        errno = last_errno;
        return len;
    }

    /// Does it look like we have some TLS / SSL where we don't expect it ?
    bool sniffSSL() const;

    void dumpState(std::ostream& os) override;

protected:
    /// Reads data with file descriptor as control data if received.
    /// Can be used only with Unix sockets.
    int readFD(char* buf, int len, int& fd)
    {
        msghdr msg;
        iovec iov[1];
        /// We don't expect more than one FD
        char ctrl[CMSG_SPACE(sizeof(int))];
        int ctrlLen = sizeof(ctrl);

        iov[0].iov_base = buf;
        iov[0].iov_len = len;

        msg.msg_name = nullptr;
        msg.msg_namelen = 0;
        msg.msg_iov = &iov[0];
        msg.msg_iovlen = 1;
        msg.msg_control = ctrl;
        msg.msg_controllen = ctrlLen;
        msg.msg_flags = 0;

        int ret = recvmsg(getFD(), &msg, 0);
        if (ret > 0 && msg.msg_controllen)
        {
            cmsghdr *cmsg = CMSG_FIRSTHDR(&msg);
            if (cmsg && cmsg->cmsg_type == SCM_RIGHTS && cmsg->cmsg_len == CMSG_LEN(sizeof(int)))
            {
                fd = *(int*)CMSG_DATA(cmsg);
                if (_readType == UseRecvmsgExpectFD)
                {
                    _readType = NormalRead;
                }
            }
        }

        return ret;
    }

    /// Override to handle reading of socket data differently.
    virtual int readData(char* buf, int len)
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);

        // avoided in readIncomingData
        if (ignoringInput())
            return -1;

#if !MOBILEAPP
        if (_readType == UseRecvmsgExpectFD)
            return readFD(buf, len, _incomingFD);

#if ENABLE_DEBUG
        if (simulateSocketError(true))
            return -1;
#endif

        return ::read(getFD(), buf, len);
#else
        return fakeSocketRead(getFD(), buf, len);
#endif
    }

    /// Override to handle writing data to socket differently.
    virtual int writeData(const char* buf, const int len)
    {
        ASSERT_CORRECT_SOCKET_THREAD(this);
#if !MOBILEAPP
#if ENABLE_DEBUG
        if (simulateSocketError(false))
            return -1;
#endif
        return ::write(getFD(), buf, len);
#else
        return fakeSocketWrite(getFD(), buf, len);
#endif
    }

    void setShutdownSignalled()
    {
        _shutdownSignalled = true;
    }

    bool isShutdownSignalled() const
    {
        return _shutdownSignalled;
    }

    const std::shared_ptr<ProtocolHandlerInterface>& getSocketHandler() const
    {
        return _socketHandler;
    }

protected:
#if ENABLE_DEBUG
    /// Return true and set errno to simulate an error
    bool simulateSocketError(bool read);
#endif

private:
    /// The hostname (or IP) of the peer we are connecting to.
    const std::string _hostname;

    /// Client handling the actual data.
    std::shared_ptr<ProtocolHandlerInterface> _socketHandler;

    Buffer _inBuffer;
    Buffer _outBuffer;

    uint64_t _bytesSent;
    uint64_t _bytesRecvd;

    enum class WSState { HTTP, WS } _wsState;

    /// True if we are already closed.
    bool _closed;

    /// True if we've received a Continue in response to an Expect: 100-continue
    bool _sentHTTPContinue;

    /// True when shutdown was requested via shutdown().
    bool _shutdownSignalled;
    int _incomingFD;
    ReadType _readType;
    std::atomic_bool _inputProcessingEnabled;
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
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
