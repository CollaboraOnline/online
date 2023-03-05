/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "Socket.hpp"

#include <cstring>
#include <ctype.h>
#include <iomanip>
#include <memory>
#include <sstream>
#include <stdio.h>
#include <string>
#include <unistd.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/un.h>
#ifdef __FreeBSD__
#include <sys/ucred.h>
#endif

#include <Poco/MemoryStream.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/URI.h>
#if ENABLE_SSL
#include <Poco/Net/X509Certificate.h>
#endif

#include <SigUtil.hpp>
#include "ServerSocket.hpp"
#if !MOBILEAPP && ENABLE_SSL
#include <net/SslSocket.hpp>
#include <openssl/x509v3.h>
#endif
#include "WebSocketHandler.hpp"
#include <net/HttpRequest.hpp>
#include <NetUtil.hpp>
#include <Log.hpp>

// Bug in pre C++17 where static constexpr must be defined. Fixed in C++17.
constexpr std::chrono::microseconds SocketPoll::DefaultPollTimeoutMicroS;
constexpr std::chrono::microseconds WebSocketHandler::InitialPingDelayMicroS;
constexpr std::chrono::microseconds WebSocketHandler::PingFrequencyMicroS;

std::atomic<bool> SocketPoll::InhibitThreadChecks(false);
std::atomic<bool> Socket::InhibitThreadChecks(false);

#define SOCKET_ABSTRACT_UNIX_NAME "0coolwsd-"

int Socket::createSocket(Socket::Type type)
{
#if !MOBILEAPP
    int domain = AF_UNSPEC;
    switch (type)
    {
    case Type::IPv4: domain = AF_INET;  break;
    case Type::IPv6: domain = AF_INET6; break;
    case Type::All:  domain = AF_INET6; break;
    case Type::Unix: domain = AF_UNIX;  break;
    default: assert(!"Unknown Socket::Type"); break;
    }

    return socket(domain, SOCK_STREAM | SOCK_NONBLOCK, 0);
#else
    (void) type;
    return fakeSocketSocket();
#endif
}

#if ENABLE_DEBUG
static std::atomic<long> socketErrorCount;

bool StreamSocket::simulateSocketError(bool read)
{
    if ((socketErrorCount++ % 7) == 0)
    {
        LOG_TRC("Simulating socket error during " << (read ? "read." : "write."));
        errno = EAGAIN;
        return true;
    }

    return false;
}
#endif //ENABLE_DEBUG

#if ENABLE_SSL
static std::string X509_NAME_to_utf8(X509_NAME* name)
{
    BIO* bio = BIO_new(BIO_s_mem());
    X509_NAME_print_ex(bio, name, 0,
                       (ASN1_STRFLGS_RFC2253 | XN_FLAG_SEP_COMMA_PLUS | XN_FLAG_FN_SN |
                        XN_FLAG_DUMP_UNKNOWN_FIELDS) &
                           ~ASN1_STRFLGS_ESC_MSB);
    BUF_MEM* buf;
    BIO_get_mem_ptr(bio, &buf);
    std::string text = std::string(buf->data, buf->length);
    BIO_free(bio);
    return text;
}

bool SslStreamSocket::verifyCertificate()
{
    if (_verification == ssl::CertificateVerification::Disabled || net::isLocalhost(hostname()))
    {
        return true;
    }

    LOG_TRC("Verifying certificate of [" << hostname() << ']');
    X509* x509 = SSL_get_peer_certificate(_ssl);
    if (x509)
    {
        // Dump cert info, for debugging only.
        const std::string issuerName = X509_NAME_to_utf8(X509_get_issuer_name(x509));
        const std::string subjectName = X509_NAME_to_utf8(X509_get_subject_name(x509));
        std::string serialNumber;
        BIGNUM* pBN = ASN1_INTEGER_to_BN(X509_get_serialNumber(const_cast<X509*>(x509)), 0);
        if (pBN)
        {
            char* pSN = BN_bn2hex(pBN);
            if (pSN)
            {
                serialNumber = pSN;
                OPENSSL_free(pSN);
            }

            BN_free(pBN);
        }

        LOG_TRC("SSL cert issuer: " << issuerName << ", subject: " << subjectName
                                    << ", serial: " << serialNumber);

        Poco::Net::X509Certificate cert(x509);
        if (cert.verify(hostname()))
        {
            LOG_TRC("SSL cert verified for host [" << hostname() << ']');
            return true;
        }
        else
        {
            LOG_INF("SSL cert failed verification for host [" << hostname() << ']');
            return false;
        }
    }

    // No certificate; acceptable only if verification is not strictly required.
    return (_verification == ssl::CertificateVerification::IfProvided);
}
#endif //ENABLE_SSL

// help with initialization order
namespace {
    std::vector<int> &getWakeupsArray()
    {
        static std::vector<int> pollWakeups;
        return pollWakeups;
    }
    std::mutex &getPollWakeupsMutex()
    {
        static std::mutex pollWakeupsMutex;
        return pollWakeupsMutex;
    }
}

SocketPoll::SocketPoll(std::string threadName)
    : _name(std::move(threadName)),
      _pollStartIndex(0),
      _stop(false),
      _threadStarted(0),
      _threadFinished(false),
      _runOnClientThread(false),
      _owner(std::this_thread::get_id())
{
    ProfileZone profileZone("SocketPoll::SocketPoll");

    // Create the wakeup fd.
    if (
#if !MOBILEAPP
        ::pipe2(_wakeup, O_CLOEXEC | O_NONBLOCK) == -1
#else
        fakeSocketPipe2(_wakeup) == -1
#endif
        )
    {
        throw std::runtime_error("Failed to allocate pipe for SocketPoll [" + threadName + "] waking.");
    }

    LOG_DBG("New SocketPoll [" << _name << "] owned by " << Log::to_string(_owner));

    std::lock_guard<std::mutex> lock(getPollWakeupsMutex());
    getWakeupsArray().push_back(_wakeup[1]);
}

SocketPoll::~SocketPoll()
{
    LOG_TRC("~SocketPoll [" << _name << "] destroying. Joining thread now.");

    joinThread();

    {
        std::lock_guard<std::mutex> lock(getPollWakeupsMutex());
        auto it = std::find(getWakeupsArray().begin(),
                            getWakeupsArray().end(),
                            _wakeup[1]);

        if (it != getWakeupsArray().end())
            getWakeupsArray().erase(it);
    }

#if !MOBILEAPP
    ::close(_wakeup[0]);
    ::close(_wakeup[1]);
#else
    fakeSocketClose(_wakeup[0]);
    fakeSocketClose(_wakeup[1]);
#endif
    _wakeup[0] = -1;
    _wakeup[1] = -1;
}

bool SocketPoll::startThread()
{
    assert(!_runOnClientThread);

    // In a race, only the first gets in.
    if (_threadStarted++ == 0)
    {
        _threadFinished = false;
        _stop = false;
        try
        {
            LOG_TRC("Creating thread for SocketPoll " << _name);
            _thread = std::thread(&SocketPoll::pollingThreadEntry, this);
            return true;
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Failed to start SocketPoll thread [" << _name << "]: " << exc.what());
            _threadStarted = 0;
        }
    }
    else if (isAlive())
    {
        // Most likely a programming error--use isAlive().
        LOG_DBG("SocketPoll [" << _name << "] thread is already running.");
    }
    else
    {
        // This is most likely a programming error.
        // There is no point in starting a new thread either,
        // because the owner is unlikely to recover.
        // If there is a valid use-case for restarting
        // an expired thread, we should add a way to reset it.
        LOG_ASSERT_MSG(!"Expired thread",
                       "SocketPoll [" << _name
                                      << "] thread has ran and finished. Will not start it again");
    }

    return false;
}

void SocketPoll::joinThread()
{
    if (isAlive())
    {
        addCallback([this]()
                    {
                        removeSockets();
                    });
        stop();
    }

    if (_threadStarted && _thread.joinable())
    {
        if (_thread.get_id() == std::this_thread::get_id())
            LOG_ERR("DEADLOCK PREVENTED: joining own thread!");
        else
        {
            _thread.join();
            _threadStarted = 0;
        }
    }
}

void SocketPoll::pollingThreadEntry()
{
    try
    {
        Util::setThreadName(_name);
        _owner = std::this_thread::get_id();
        LOG_INF("Starting polling thread [" << _name << "] with thread affinity set to "
                                            << Log::to_string(_owner) << '.');

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
    LOG_INF("Finished polling thread [" << _name << "].");
}

int SocketPoll::poll(int64_t timeoutMaxMicroS)
{
    if (_runOnClientThread)
        checkAndReThread();
    else
        assertCorrectThread();

#if ENABLE_DEBUG
    // perturb - to rotate errors among several busy sockets.
    socketErrorCount++;
#endif

    std::chrono::steady_clock::time_point now =
        std::chrono::steady_clock::now();

    // The events to poll on change each spin of the loop.
    setupPollFds(now, timeoutMaxMicroS);
    const size_t size = _pollSockets.size();

    int rc;
    do
    {
#if !MOBILEAPP
#  if HAVE_PPOLL
        LOG_TRC("ppoll start, timeoutMicroS: " << timeoutMaxMicroS << " size " << size);
        timeoutMaxMicroS = std::max(timeoutMaxMicroS, (int64_t)0);
        struct timespec timeout;
        timeout.tv_sec = timeoutMaxMicroS / (1000 * 1000);
        timeout.tv_nsec = (timeoutMaxMicroS % (1000 * 1000)) * 1000;
        rc = ::ppoll(&_pollFds[0], size + 1, &timeout, nullptr);
#  else
        int timeoutMaxMs = (timeoutMaxMicroS + 999) / 1000;
        LOG_TRC("Legacy Poll start, timeoutMs: " << timeoutMaxMs);
        rc = ::poll(&_pollFds[0], size + 1, std::max(timeoutMaxMs,0));
#  endif
#else
        LOG_TRC("SocketPoll Poll");
        int timeoutMaxMs = (timeoutMaxMicroS + 999) / 1000;
        rc = fakeSocketPoll(&_pollFds[0], size + 1, std::max(timeoutMaxMs,0));
#endif
    }
    while (rc < 0 && errno == EINTR);
    LOG_TRC("Poll completed with " << rc << " live polls max (" <<
            timeoutMaxMicroS << "us)" << ((rc==0) ? "(timedout)" : ""));

    // First process the wakeup pipe (always the last entry).
    if (_pollFds[size].revents)
    {
        std::vector<CallbackFn> invoke;
        {
            std::lock_guard<std::mutex> lock(_mutex);

            // Clear the data.
#if !MOBILEAPP
            int dump = ::read(_wakeup[0], &dump, sizeof(dump));
#else
            LOG_TRC("Wakeup pipe read");
            int dump = fakeSocketRead(_wakeup[0], &dump, sizeof(dump));
#endif
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

    // FIXME: A few dozen lines above we have potentially inserted new elements in _pollSockets, so
    // clearly its size can now be larger than what it was when we came to this function, which got
    // saved in the size variable.

    if (_pollSockets.size() != size)
        return rc;

    // Fire the poll callbacks and remove dead fds.
    std::chrono::steady_clock::time_point newNow =
        std::chrono::steady_clock::now();

    if (size > 0)
    {
        // We use the _pollStartIndex to start the polling at a different index each time. Do some
        // sanity check first to handle the case where we removed one or several sockets last time.
        if (_pollStartIndex > size - 1)
            _pollStartIndex = size - 1;

        std::vector<int> toErase;

        size_t i = _pollStartIndex;
        LOG_TRC('#' << _pollFds[i].fd << ": Starting handling poll events of " << _name
                    << " at index " << i << " (of " << size << "): 0x" << std::hex
                    << _pollFds[i].revents << std::dec);

        for (std::size_t j = 0; j < size; ++j)
        {
            SocketDisposition disposition(_pollSockets[i]);
            try
            {
                _pollSockets[i]->handlePoll(disposition, newNow,
                                            _pollFds[i].revents);
            }
            catch (const std::exception& exc)
            {
                LOG_ERR('#' << _pollFds[i].fd << ": Error while handling poll at " << i << " in "
                            << _name << ": " << exc.what());
                disposition.setClosed();
                rc = -1;
            }

            if (!disposition.isContinue())
                toErase.push_back(i);

            disposition.execute();

            if (i == 0)
                i = size - 1;
            else
                i--;
        }
        if (!toErase.empty())
        {
            std::sort(toErase.begin(), toErase.end(), [](int a, int b) { return a > b; });
            for (const int eraseIndex : toErase)
            {
                LOG_TRC('#' << _pollFds[eraseIndex].fd << ": Removing socket (at " << eraseIndex
                            << " of " << _pollSockets.size() << ") from " << _name);
                _pollSockets.erase(_pollSockets.begin() + eraseIndex);
            }
        }

        // In case we removed sockets the new _pollStartIndex might be out of bounds, but we check it
        // before using it above anyway.
        _pollStartIndex = (_pollStartIndex + 1) % size;
    }

    return rc;
}

void SocketPoll::wakeupWorld()
{
    for (const auto& fd : getWakeupsArray())
        wakeup(fd);
}

#if !MOBILEAPP

void SocketPoll::insertNewWebSocketSync(const Poco::URI& uri,
                                        const std::shared_ptr<WebSocketHandler>& websocketHandler)
{
    LOG_TRC("Connecting WS to " << uri.getHost());

    const bool isSSL = uri.getScheme() != "ws";
#if !ENABLE_SSL
    if (isSSL)
    {
        LOG_ERR("Error: wss for client websocket requested but SSL not compiled in.");
        return;
    }
#endif

    http::Request req(uri.getPathAndQuery());
    req.set("User-Foo", "Adminbits");
    //FIXME: Why do we need the following here?
    req.set("Accept-Language", "en");
    req.set("Cache-Control", "no-cache");
    req.set("Pragma", "no-cache");

    const std::string port = std::to_string(uri.getPort());
    if (websocketHandler->wsRequest(req, uri.getHost(), port, isSSL, *this))
    {
        LOG_DBG("Connected WS to " << uri.getHost());
    }
    else
    {
        LOG_ERR("Failed to connected WS to " << uri.getHost());
    }
}

bool SocketPoll::insertNewUnixSocket(
    const std::string &location,
    const std::string &pathAndQuery,
    const std::shared_ptr<WebSocketHandler>& websocketHandler,
    const int shareFD)
{
    LOG_DBG("Connecting to local UDS " << location);
    const int fd = socket(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK, 0);

    struct sockaddr_un addrunix;
    std::memset(&addrunix, 0, sizeof(addrunix));
    addrunix.sun_family = AF_UNIX;
#ifdef HAVE_ABSTRACT_UNIX_SOCKETS
    addrunix.sun_path[0] = '\0'; // abstract name
#else
    addrunix.sun_path[0] = '0';
#endif
    memcpy(&addrunix.sun_path[1], location.c_str(), location.length());

    const int res = connect(fd, (const struct sockaddr*)&addrunix, sizeof(addrunix));
    if (fd < 0 || (res < 0 && errno != EINPROGRESS))
    {
        LOG_SYS("Failed to connect to unix socket at " << location);
        ::close(fd);
        return false;
    }

    std::shared_ptr<StreamSocket> socket
        = StreamSocket::create<StreamSocket>(std::string(), fd, true, websocketHandler);
    if (!socket)
    {
        LOG_ERR("Failed to create socket unix socket at " << location);
        return false;
    }

    LOG_DBG("Connected to local UDS " << location << " #" << socket->getFD());

    http::Request req(pathAndQuery);
    req.set("User-Foo", "Adminbits");
    req.set("Sec-WebSocket-Key", websocketHandler->getWebSocketKey());
    req.set("Sec-WebSocket-Version", "13");
    //FIXME: Why do we need the following here?
    req.set("Accept-Language", "en");
    req.set("Cache-Control", "no-cache");
    req.set("Pragma", "no-cache");

    LOG_TRC("Requesting upgrade of websocket at path " << pathAndQuery << " #" << socket->getFD());
    if (shareFD == -1)
    {
        socket->send(req);
    }
    else
    {
        Buffer buf;
        req.writeData(buf, INT_MAX); // Write the whole request.
        socket->sendFD(buf.getBlock(), buf.getBlockSize(), shareFD);
    }

    std::static_pointer_cast<ProtocolHandlerInterface>(websocketHandler)->onConnect(socket);
    insertNewSocket(socket);

    // We send lots of data back via this local UDS'
    socket->setSocketBufferSize(Socket::MaximumSendBufferSize);

    return true;
}

#else

void SocketPoll::insertNewFakeSocket(
    int peerSocket,
    const std::shared_ptr<ProtocolHandlerInterface>& websocketHandler)
{
    LOG_INF("Connecting to " << peerSocket);
    int fd = fakeSocketSocket();
    int res = fakeSocketConnect(fd, peerSocket);
    if (fd < 0 || (res < 0 && errno != EINPROGRESS))
    {
        LOG_ERR("Failed to connect to the 'wsd' socket");
        fakeSocketClose(fd);
    }
    else
    {
        std::shared_ptr<StreamSocket> socket;
        socket = StreamSocket::create<StreamSocket>(std::string(), fd, true, websocketHandler);
        if (socket)
        {
            LOG_TRC("Sending 'hello' instead of HTTP GET for now");
            socket->send("hello");
            insertNewSocket(socket);
        }
        else
        {
            LOG_ERR("Failed to allocate socket for client websocket");
            fakeSocketClose(fd);
        }
    }
}
#endif

void ServerSocket::dumpState(std::ostream& os)
{
    os << '\t' << getFD() << "\t<accept>\n";
}

void SocketDisposition::execute()
{
    // We should have hard ownership of this socket.
    assert(_socket->getThreadOwner() == std::this_thread::get_id());
    if (_socketMove)
    {
        // Drop pretentions of ownership before _socketMove.
        _socket->resetThreadOwner();

        if (!_toPoll) {
            assert (isMove());
            _socketMove(_socket);
        } else {
            assert (isTransfer());
            // Ensure the thread is running before adding callback.
            _toPoll->startThread();
            auto pollCopy = _toPoll;
            auto socket = _socket;
            auto socketMoveFn = std::move(_socketMove);
            _toPoll->addCallback([pollCopy, socket, socketMoveFn]()
                {
                    pollCopy->insertNewSocket(socket);
                    socketMoveFn(socket);
                });
        }
        _socketMove = nullptr;
        _toPoll = nullptr;
    }
}

void WebSocketHandler::dumpState(std::ostream& os)
{
    os << (_shuttingDown ? "shutd " : "alive ");
#if !MOBILEAPP
    os << std::setw(5) << _pingTimeUs/1000. << "ms ";
#endif
    if (_wsPayload.size() > 0)
        Util::dumpHex(os, _wsPayload, "\t\tws queued payload:\n", "\t\t");
    os << '\n';
    if (_msgHandler)
        _msgHandler->dumpState(os);
}

void StreamSocket::dumpState(std::ostream& os)
{
    int64_t timeoutMaxMicroS = SocketPoll::DefaultPollTimeoutMicroS.count();
    const int events = getPollEvents(std::chrono::steady_clock::now(), timeoutMaxMicroS);
    os << '\t' << getFD() << '\t' << events << '\t'
       << (ignoringInput() ? "ignore\t" : "process\t")
       << _inBuffer.size() << '\t' << _outBuffer.size() << '\t'
       << " r: " << _bytesRecvd << "\t w: " << _bytesSent << '\t'
       << clientAddress() << '\t';
    _socketHandler->dumpState(os);
    if (_inBuffer.size() > 0)
        Util::dumpHex(os, _inBuffer, "\t\tinBuffer:\n", "\t\t");
    _outBuffer.dumpHex(os, "\t\toutBuffer:\n", "\t\t");
}

void StreamSocket::send(Poco::Net::HTTPResponse& response)
{
    response.set("Server", HTTP_SERVER_STRING);
    response.set("Date", Util::getHttpTimeNow());

    std::ostringstream oss;
    response.write(oss);

    send(oss.str());
}

bool StreamSocket::send(const http::Response& response)
{
    if (response.writeData(_outBuffer))
    {
        flush();
        return true;
    }
    else
    {
        shutdown();
        return false;
    }
}

bool StreamSocket::send(http::Request& request)
{
    if (request.writeData(_outBuffer, getSendBufferCapacity()))
    {
        flush();
        return true;
    }
    else
    {
        shutdown();
        return false;
    }
}

bool StreamSocket::sendAndShutdown(http::Response& response)
{
    response.set("Connection", "close");
    if (send(response))
    {
        shutdown();
        return true;
    }

    return false;
}

void SocketPoll::dumpState(std::ostream& os)
{
    // FIXME: NOT thread-safe! _pollSockets is modified from the polling thread!
    os << "\n  SocketPoll:";
    os << "\n    Poll [" << _pollSockets.size() << "] - wakeup r: "
       << _wakeup[0] << " w: " << _wakeup[1] << '\n';
    if (_newCallbacks.size() > 0)
        os << "\tcallbacks: " << _newCallbacks.size() << '\n';
    os << "\tfd\tevents\trsize\twsize\n";
    for (const auto &i : _pollSockets)
        i->dumpState(os);
}

/// Returns true on success only.
bool ServerSocket::bind(Type type, int port)
{
#if !MOBILEAPP
    // Enable address reuse to avoid stalling after
    // recycling, when previous socket is TIME_WAIT.
    //TODO: Might be worth refactoring out.
    const int reuseAddress = 1;
    constexpr unsigned int len = sizeof(reuseAddress);
    ::setsockopt(getFD(), SOL_SOCKET, SO_REUSEADDR, &reuseAddress, len);

    int rc;

    assert (_type != Socket::Type::Unix);
    if (_type == Socket::Type::IPv4)
    {
        struct sockaddr_in addrv4;
        std::memset(&addrv4, 0, sizeof(addrv4));
        addrv4.sin_family = AF_INET;
        addrv4.sin_port = htons(port);
        if (type == Type::Public)
            addrv4.sin_addr.s_addr = htonl(INADDR_ANY);
        else
            addrv4.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

        rc = ::bind(getFD(), (const sockaddr *)&addrv4, sizeof(addrv4));
    }
    else
    {
        struct sockaddr_in6 addrv6;
        std::memset(&addrv6, 0, sizeof(addrv6));
        addrv6.sin6_family = AF_INET6;
        addrv6.sin6_port = htons(port);
        if (type == Type::Public)
            addrv6.sin6_addr = in6addr_any;
        else
            addrv6.sin6_addr = in6addr_loopback;

        const int ipv6only = (_type == Socket::Type::All ? 0 : 1);
        if (::setsockopt(getFD(), IPPROTO_IPV6, IPV6_V6ONLY, (char*)&ipv6only, sizeof(ipv6only)) == -1)
            LOG_SYS("Failed set ipv6 socket to " << ipv6only);

        rc = ::bind(getFD(), (const sockaddr *)&addrv6, sizeof(addrv6));
    }

    if (rc)
        LOG_SYS("Failed to bind to: " << (_type == Socket::Type::IPv4 ? "IPv4" : "IPv6")
                                      << " port: " << port);
    else
        LOG_TRC("Bind to: " << (_type == Socket::Type::IPv4 ? "IPv4" : "IPv6")
                            << " port: " << port);

    return rc == 0;
#else
    (void) type;
    (void) port;

    return true;
#endif
}

std::shared_ptr<Socket> ServerSocket::accept()
{
    // Accept a connection (if any) and set it to non-blocking.
    // There still need the client's address to filter request from POST(call from REST) here.
#if !MOBILEAPP
    assert(_type != Socket::Type::Unix);

    struct sockaddr_in6 clientInfo;
    socklen_t addrlen = sizeof(clientInfo);
    const int rc = ::accept4(getFD(), (struct sockaddr *)&clientInfo, &addrlen, SOCK_NONBLOCK);
#else
    const int rc = fakeSocketAccept4(getFD());
#endif
    LOG_TRC("Accepted socket #" << rc << ", creating socket object.");
    try
    {
        // Create a socket object using the factory.
        if (rc != -1)
        {
            std::shared_ptr<Socket> _socket = createSocketFromAccept(rc);

#if !MOBILEAPP
            char addrstr[INET6_ADDRSTRLEN];

            const void *inAddr;
            if (clientInfo.sin6_family == AF_INET)
            {
                auto ipv4 = (struct sockaddr_in *)&clientInfo;
                inAddr = &(ipv4->sin_addr);
            }
            else
            {
                auto ipv6 = (struct sockaddr_in6 *)&clientInfo;
                inAddr = &(ipv6->sin6_addr);
            }

            inet_ntop(clientInfo.sin6_family, inAddr, addrstr, sizeof(addrstr));
            _socket->setClientAddress(addrstr);

            LOG_TRC("Accepted socket #" << _socket->getFD() << " has family "
                                        << clientInfo.sin6_family << " address "
                                        << _socket->clientAddress());
#endif
            return _socket;
        }
        return std::shared_ptr<Socket>(nullptr);
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Failed to create client socket #" << rc << ". Error: " << ex.what());
    }

    return nullptr;
}

#if !MOBILEAPP

int Socket::getPid() const
{
#ifdef __linux__
    struct ucred creds;
    socklen_t credSize = sizeof(struct ucred);
    if (getsockopt(_fd, SOL_SOCKET, SO_PEERCRED, &creds, &credSize) < 0)
    {
        LOG_SYS("Failed to get pid via peer creds on " << _fd);
        return -1;
    }
    return creds.pid;
#elif defined(__FreeBSD__)
    struct xucred creds;
    socklen_t credSize = sizeof(struct xucred);
    if (getsockopt(_fd, SOL_LOCAL, LOCAL_PEERCRED, &creds, &credSize) < 0)
    {
        LOG_SYS("Failed to get pid via peer creds on " << _fd);
        return -1;
    }
    return creds.cr_pid;
#else
#error Implement for your platform
#endif
}

// Does this socket come from the localhost ?
bool Socket::isLocal() const
{
    if (_clientAddress.size() < 1)
        return false;
    if (_clientAddress[0] == '/') // Unix socket
        return true;
    if (_clientAddress == "::1")
        return true;
    return  _clientAddress.rfind("127.0.0.", 0);
}

std::shared_ptr<Socket> LocalServerSocket::accept()
{
    const int rc = ::accept4(getFD(), nullptr, nullptr, SOCK_NONBLOCK);
    try
    {
        LOG_DBG("Accepted prisoner socket #" << rc << ", creating socket object.");
        if (rc < 0)
            return std::shared_ptr<Socket>(nullptr);

        std::shared_ptr<Socket> _socket = createSocketFromAccept(rc);
        // Sanity check this incoming socket
#ifndef __FreeBSD__
#define CREDS_UID(c) c.uid
#define CREDS_GID(c) c.gid
#define CREDS_PID(c) c.pid
        struct ucred creds;
        socklen_t credSize = sizeof(struct ucred);
        if (getsockopt(rc, SOL_SOCKET, SO_PEERCRED, &creds, &credSize) < 0)
        {
            LOG_SYS("Failed to get peer creds on " << rc);
            ::close(rc);
            return std::shared_ptr<Socket>(nullptr);
        }
#else
#define CREDS_UID(c) c.cr_uid
#define CREDS_GID(c) c.cr_groups[0]
#define CREDS_PID(c) c.cr_pid
        struct xucred creds;
        socklen_t credSize = sizeof(struct xucred);
        if (getsockopt(rc, SOL_LOCAL, LOCAL_PEERCRED, &creds, &credSize) < 0)
        {
            LOG_SYS("Failed to get peer creds on " << rc);
            ::close(rc);
            return std::shared_ptr<Socket>(nullptr);
        }
#endif

        uid_t uid = getuid();
        uid_t gid = getgid();
        if (CREDS_UID(creds) != uid || CREDS_GID(creds) != gid)
        {
            LOG_ERR("Peercred mis-match on domain socket - closing connection. uid: " <<
                    CREDS_UID(creds) << "vs." << uid << " gid: " << CREDS_GID(creds) << "vs." << gid);
            ::close(rc);
            return std::shared_ptr<Socket>(nullptr);
        }
        std::string addr("uds-to-pid-");
        addr.append(std::to_string(CREDS_PID(creds)));
        _socket->setClientAddress(addr);

        LOG_DBG("Accepted socket #" << rc << " is UDS - address " << addr << " and uid/gid "
                                    << CREDS_UID(creds) << '/' << CREDS_GID(creds));
        return _socket;
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Failed to create client socket #" << rc << ". Error: " << ex.what());
        return std::shared_ptr<Socket>(nullptr);
    }
}

/// Returns true on success only.
std::string LocalServerSocket::bind()
{
    int rc;
    struct sockaddr_un addrunix;

    // snap needs a specific socket name
    std::string socketAbstractUnixName(SOCKET_ABSTRACT_UNIX_NAME);
    const char* snapInstanceName = std::getenv("SNAP_INSTANCE_NAME");
    if (snapInstanceName && snapInstanceName[0])
        socketAbstractUnixName = std::string("0snap.") + snapInstanceName + ".coolwsd-";

    LOG_INF("Binding to Unix socket for local server with base name: " << socketAbstractUnixName);

    constexpr auto RandomSuffixLength = 8;
    constexpr auto MaxSocketAbstractUnixNameLength =
        sizeof(addrunix.sun_path) - RandomSuffixLength - 1; // 1 byte for null termination.
    LOG_ASSERT_MSG(socketAbstractUnixName.size() < MaxSocketAbstractUnixNameLength,
                   "SocketAbstractUnixName is too long. Max: " << MaxSocketAbstractUnixNameLength
                                                               << ", actual: "
                                                               << socketAbstractUnixName.size());

    int last_errno = 0;
    do
    {
        std::memset(&addrunix, 0, sizeof(addrunix));
        addrunix.sun_family = AF_UNIX;
        std::memcpy(addrunix.sun_path, socketAbstractUnixName.c_str(), socketAbstractUnixName.length());
#ifdef HAVE_ABSTRACT_UNIX_SOCKETS
        addrunix.sun_path[0] = '\0'; // abstract name
#endif

        const std::string rand = Util::rng::getFilename(RandomSuffixLength);
        memcpy(addrunix.sun_path + socketAbstractUnixName.size(), rand.c_str(), RandomSuffixLength);
        LOG_ASSERT_MSG(addrunix.sun_path[sizeof(addrunix.sun_path) - 1] == '\0',
                       "addrunix.sun_path is not null terminated");

        rc = ::bind(getFD(), (const sockaddr *)&addrunix, sizeof(struct sockaddr_un));
        last_errno = errno;
        LOG_TRC("Binding to Unix socket location ["
                << &addrunix.sun_path[1] << "], result: " << rc
                << ((rc >= 0) ? std::string()
                              : '\t' + Util::symbolicErrno(last_errno) + ": " +
                                    std::strerror(last_errno)));
    } while (rc < 0 && errno == EADDRINUSE);

    if (rc >= 0)
    {
        _name = std::string(&addrunix.sun_path[0]);
        return std::string(&addrunix.sun_path[1]);
    }

    LOG_SYS_ERRNO(last_errno, "Failed to bind to Unix socket at [" << &addrunix.sun_path[1] << ']');
    return std::string();
}

#ifndef HAVE_ABSTRACT_UNIX_SOCKETS
bool LocalServerSocket::link(std::string to)
{
    _linkName = to;
    return 0 == ::link(_name.c_str(), to.c_str());
}
#endif

LocalServerSocket::~LocalServerSocket()
{
#ifndef HAVE_ABSTRACT_UNIX_SOCKETS
    ::unlink(_name.c_str());
    if (!_linkName.empty())
        ::unlink(_linkName.c_str());
#endif
}

// For a verbose life, tweak here:
#if 0
#  define LOG_CHUNK(X) LOG_TRC(X)
#else
#  define LOG_CHUNK(X)
#endif

bool StreamSocket::parseHeader(const char *clientName,
                               Poco::MemoryInputStream &message,
                               Poco::Net::HTTPRequest &request,
                               MessageMap *map)
{
    assert(!map || (map->_headerSize == 0 && map->_messageSize == 0));

    // Find the end of the header, if any.
    static const std::string marker("\r\n\r\n");
    auto itBody = std::search(_inBuffer.begin(), _inBuffer.end(),
                              marker.begin(), marker.end());
    if (itBody == _inBuffer.end())
    {
        LOG_TRC(clientName << " doesn't have enough data for the header yet.");
        return false;
    }

    // Skip the marker.
    itBody += marker.size();
    if (map) // a reasonable guess so far
    {
        map->_headerSize = static_cast<size_t>(itBody - _inBuffer.begin());
        map->_messageSize = map->_headerSize;
    }

    try
    {
        request.read(message);

        Log::StreamLogger logger = Log::info();
        if (logger.enabled())
        {
            logger << '#' << getFD() << ": " << clientName << " HTTP Request: "
                   << request.getMethod() << ' '
                   << request.getURI() << ' '
                   << request.getVersion();

            for (const auto& it : request)
            {
                logger << " / " << it.first << ": " << it.second;
            }

            LOG_END_FLUSH(logger);
        }

        const std::streamsize contentLength = request.getContentLength();
        const auto offset = itBody - _inBuffer.begin();
        const std::streamsize available = _inBuffer.size() - offset;

        if (contentLength != Poco::Net::HTTPMessage::UNKNOWN_CONTENT_LENGTH && available < contentLength)
        {
            LOG_DBG("Not enough content yet: ContentLength: " << contentLength
                                                              << ", available: " << available);
            return false;
        }
        if (map)
            map->_messageSize += contentLength;

        const std::string expect = request.get("Expect", "");
        const bool getExpectContinue = Util::iequal(expect, "100-continue");
        if (getExpectContinue && !_sentHTTPContinue)
        {
            LOG_TRC("Got Expect: 100-continue, sending Continue");
            // FIXME: should validate authentication headers early too.
            send("HTTP/1.1 100 Continue\r\n\r\n",
                 sizeof("HTTP/1.1 100 Continue\r\n\r\n") - 1);
            _sentHTTPContinue = true;
        }

        if (request.getChunkedTransferEncoding())
        {
            // keep the header
            if (map)
                map->_spans.push_back(std::pair<size_t, size_t>(0, itBody - _inBuffer.begin()));

            int chunk = 0;
            while (itBody != _inBuffer.end())
            {
                auto chunkStart = itBody;

                // skip whitespace
                for (; itBody != _inBuffer.end() && isascii(*itBody) && isspace(*itBody); ++itBody)
                    ; // skip.

                // each chunk is preceeded by its length in hex.
                size_t chunkLen = 0;
                for (; itBody != _inBuffer.end(); ++itBody)
                {
                    int digit = Util::hexDigitFromChar(*itBody);
                    if (digit >= 0)
                        chunkLen = chunkLen * 16 + digit;
                    else
                        break;
                }

                LOG_CHUNK("Chunk of length " << chunkLen);

                for (; itBody != _inBuffer.end() && *itBody != '\n'; ++itBody)
                    ; // skip to end of line

                if (itBody != _inBuffer.end())
                    itBody++; /* \n */;

                // skip the chunk.
                auto chunkOffset = itBody - _inBuffer.begin();
                auto chunkAvailable = _inBuffer.size() - chunkOffset;

                if (chunkLen == 0) // we're complete.
                {
                    map->_messageSize = chunkOffset;
                    return true;
                }

                if (chunkLen > chunkAvailable + 2)
                {
                    LOG_DBG("Not enough content yet in chunk " << chunk <<
                            " starting at offset " << (chunkStart - _inBuffer.begin()) <<
                            " chunk len: " << chunkLen << ", available: " << chunkAvailable);
                    return false;
                }
                itBody += chunkLen;

                map->_spans.push_back(std::pair<size_t,size_t>(chunkOffset, chunkLen));

                if (*itBody != '\r' || *(itBody + 1) != '\n')
                {
                    LOG_ERR("Missing \\r\\n at end of chunk " << chunk << " of length " << chunkLen);
                    LOG_CHUNK("Chunk " << chunk << " is: \n" << Util::dumpHex("", "", chunkStart, itBody + 1, false));
                    return false; // TODO: throw something sensible in this case
                }
                else
                {
                    LOG_CHUNK("Chunk " << chunk << " is: \n" << Util::dumpHex("", "", chunkStart, itBody + 1, false));
                }

                itBody+=2;
                chunk++;
            }
            LOG_TRC("Not enough chunks yet, so far " << chunk << " chunks of total length " << (itBody - _inBuffer.begin()));
            return false;
        }
    }
    catch (const Poco::Exception& exc)
    {
        LOG_DBG("parseHeader exception caught with " << _inBuffer.size()
                                                     << " bytes: " << exc.displayText());
        // Probably don't have enough data just yet.
        // TODO: timeout if we never get enough.
        return false;
    }
    catch (const std::exception& exc)
    {
        LOG_DBG("parseHeader std::exception caught with " << _inBuffer.size()
                                                          << " bytes: " << exc.what());
        // Probably don't have enough data just yet.
        // TODO: timeout if we never get enough.
        return false;
    }

    return true;
}

bool StreamSocket::compactChunks(MessageMap *map)
{
    assert (map);
    if (!map->_spans.size())
        return false; // single message.

    LOG_CHUNK("Pre-compact " << map->_spans.size() << " chunks: \n" <<
              Util::dumpHex("", "", _inBuffer.begin(), _inBuffer.end(), false));

    char *first = &_inBuffer[0];
    char *dest = first;
    for (auto &span : map->_spans)
    {
        std::memmove(dest, &_inBuffer[span.first], span.second);
        dest += span.second;
    }

    // Erase the duplicate bits.
    size_t newEnd = dest - first;
    size_t gap = map->_messageSize - newEnd;
    _inBuffer.erase(_inBuffer.begin() + newEnd, _inBuffer.begin() + map->_messageSize);

    LOG_CHUNK("Post-compact with erase of " << newEnd << " to " << map->_messageSize << " giving: \n" <<
              Util::dumpHex("", "", _inBuffer.begin(), _inBuffer.end(), false));

    // shrink our size to fit
    map->_messageSize -= gap;

#if ENABLE_DEBUG
    std::ostringstream oss;
    dumpState(oss);
    LOG_TRC("Socket state: " << oss.str());
#endif

    return true;
}

bool StreamSocket::sniffSSL() const
{
    // Only sniffing the first bytes of a socket.
    if (_bytesSent > 0 || _bytesRecvd != _inBuffer.size() || _bytesRecvd < 6)
        return false;

    // 0x0000  16 03 01 02 00 01 00 01
    return (_inBuffer[0] == 0x16 && // HANDSHAKE
            _inBuffer[1] == 0x03 && // SSL 3.0 / TLS 1.x
            _inBuffer[5] == 0x01);  // Handshake: CLIENT_HELLO
}

#endif // !MOBILEAPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
