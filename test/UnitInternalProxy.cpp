/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <Common.hpp>
#include <Unit.hpp>
#include <helpers.hpp>
#include <net/HttpRequest.hpp>
#include <net/ServerSocket.hpp>
#include <net/Socket.hpp>
#include <wsd/ProxyPoll.hpp>
#include <HttpTestServer.hpp>

#include <Poco/Net/HTTPRequest.h>

#include <sys/socket.h>

using namespace std::literals;

/// Factory for creating echo server sockets
class EchoServerFactory final : public SocketFactory
{
    std::shared_ptr<Socket> create(const int fd, Socket::Type type) override
    {
        return StreamSocket::create<StreamSocket>(std::string(), fd, type, false, HostType::Other,
                                                  std::make_shared<ServerRequestHandler>());
    }
};

/// Simple handler that captures incoming data for verification
class CaptureHandler : public SimpleSocketHandler
{
    std::weak_ptr<StreamSocket> _socket;
    std::string _received;

public:
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _socket = socket;
        setLogContext(socket->getFD());
    }

    void handleIncomingMessage(SocketDisposition&) override
    {
        auto socket = _socket.lock();
        if (socket)
        {
            auto& buf = socket->getInBuffer();
            _received.append(buf.data(), buf.size());
            buf.clear();
        }
    }

    int getPollEvents(std::chrono::steady_clock::time_point, int64_t&) override { return POLLIN; }

    void performWrites(std::size_t) override {}
    void onDisconnect() override {}

    const std::string& getReceived() const { return _received; }
};

/// Handler that pauses reading initially to trigger backpressure in the proxy,
/// then resumes reading to drain all data
class BackpressureTestHandler : public SimpleSocketHandler
{
    std::weak_ptr<StreamSocket> _socket;
    std::string _received;
    std::chrono::steady_clock::time_point _resumeTime;
    bool _paused;
    static constexpr int PAUSE_MS = 300; // Pause reading for 300ms

public:
    BackpressureTestHandler()
        : _paused(true)
    {
    }

    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _socket = socket;
        setLogContext(socket->getFD());
        _resumeTime = std::chrono::steady_clock::now() + std::chrono::milliseconds(PAUSE_MS);
        LOG_TRC("BackpressureTestHandler: pausing reads for " << PAUSE_MS << "ms");
    }

    void handleIncomingMessage(SocketDisposition&) override
    {
        auto socket = _socket.lock();
        if (!socket)
            return;

        if (_paused)
        {
            auto now = std::chrono::steady_clock::now();
            if (now >= _resumeTime)
            {
                _paused = false;
                LOG_TRC("BackpressureTestHandler: resuming reads");
            }
            else
            {
                return;
            }
        }

        auto& buf = socket->getInBuffer();
        if (!buf.empty())
        {
            LOG_TRC("BackpressureTestHandler: reading "
                    << buf.size() << " bytes, total: " << (_received.size() + buf.size()));
            _received.append(buf.data(), buf.size());
            buf.clear();
        }
    }

    int getPollEvents(std::chrono::steady_clock::time_point now, int64_t& timeoutMaxMicroS) override
    {
        if (_paused)
        {
            if (now >= _resumeTime)
            {
                _paused = false;
                LOG_TRC("BackpressureTestHandler: resuming reads (from getPollEvents)");
                return POLLIN;
            }

            // Request wakeup when pause ends
            auto remaining =
                std::chrono::duration_cast<std::chrono::microseconds>(_resumeTime - now).count();
            if (remaining > 0)
                timeoutMaxMicroS = std::min(timeoutMaxMicroS, remaining);
            return 0;
        }
        return POLLIN;
    }

    void performWrites(std::size_t) override {}
    void onDisconnect() override { LOG_TRC("BackpressureTestHandler::onDisconnect"); }

    const std::string& getReceived() const { return _received; }
};

/// Test the internal ProxyPoll functionality.
class UnitInternalProxy : public UnitWSD
{
    STATE_ENUM(Phase,
               Init, // Start echo server
               ServerStarted, // Server ready, call startPump
               WaitProxyData, // Wait for data via onProxyData callback
               VerifyData, // Verify proxied data
               Done)
    _phase;

    std::shared_ptr<SocketPoll> _serverPoll;
    std::shared_ptr<ServerSocket> _serverSocket;
    std::shared_ptr<SocketPoll> _clientPoll;
    int _echoPort;

    // Track proxy data for assertions
    std::string _clientToTargetData;
    std::string _targetToClientData;

public:
    UnitInternalProxy()
        : UnitWSD("UnitInternalProxy")
        , _phase(Phase::Init)
        , _serverPoll(std::make_shared<SocketPoll>("echoserver_poll"))
        , _clientPoll(std::make_shared<SocketPoll>("client_poll"))
        , _echoPort(0)
    {
        setTimeout(10s);
    }

    /// direction: true = client->target, false = target->client
    void onProxyData(const char* data, std::size_t len, bool direction) override
    {
        if (direction)
        {
            _clientToTargetData.append(data, len);
            TST_LOG("onProxyData: client->target " << len << " bytes");
        }
        else
        {
            _targetToClientData.append(data, len);
            TST_LOG("onProxyData: target->client " << len << " bytes");
        }

        if (_phase == Phase::WaitProxyData && !_targetToClientData.empty())
            TRANSITION_STATE(_phase, Phase::VerifyData);
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Init:
                TRANSITION_STATE(_phase, Phase::ServerStarted);
                _clientPoll->startThread();
                if (!startEchoServer())
                {
                    LOK_ASSERT_FAIL("Failed to start echo server");
                    return;
                }
                break;
            case Phase::ServerStarted:
                TRANSITION_STATE(_phase, Phase::WaitProxyData);
                _clientToTargetData.clear();
                _targetToClientData.clear();
                testStartPump();
                break;
            case Phase::WaitProxyData:
                // Wait - onProxyData callback will transition
                break;
            case Phase::VerifyData:
                TRANSITION_STATE(_phase, Phase::Done);
                TST_LOG("Proxy data received via hooks:");
                TST_LOG("client->target: " << _clientToTargetData.size() << " bytes");
                TST_LOG("target->client: " << _targetToClientData.size() << " bytes");

                LOK_ASSERT_MESSAGE("Response should contain HTTP 200",
                                   _targetToClientData.find("HTTP/1.1 200") != std::string::npos);
                LOK_ASSERT_MESSAGE("Response should echo our test data",
                                   _targetToClientData.find("hello-from-ProxyHandler-test") !=
                                       std::string::npos);
                if (_clientPoll)
                    _clientPoll->stop();
                if (_serverPoll)
                    _serverPoll->stop();
                exitTest(TestResult::Ok);
                // Trigger next test since we have no DocBroker
                UnitWSD::get().DocBrokerDestroy("");
                break;
            case Phase::Done:
                break;
        }
    }

private:
    bool startEchoServer()
    {
        auto factory = std::make_shared<EchoServerFactory>();
        auto now = std::chrono::steady_clock::now();

        for (_echoPort = 19980; _echoPort < 20020; ++_echoPort)
        {
            _serverSocket = ServerSocket::create(ServerSocket::Type::Local, _echoPort,
                                                 Socket::Type::IPv4, now, *_serverPoll, factory);
            if (_serverSocket)
                break;
        }

        if (!_serverSocket)
        {
            TST_LOG("Failed to create server socket on any port");
            return false;
        }

        _serverPoll->startThread();
        _serverPoll->insertNewSocket(_serverSocket);

        TST_LOG("Echo server listening on port " << _echoPort);
        return true;
    }

    void testStartPump()
    {
        // Create a socket pair for testing (client <-> proxy)
        int fds[2];
        if (socketpair(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK, 0, fds) < 0)
        {
            LOK_ASSERT_FAIL("Failed to create socket pair: " << strerror(errno));
            return;
        }

        // Create handler for client end (we read proxied response here)
        auto clientHandler = std::make_shared<ServerRequestHandler>();
        auto clientSocket = StreamSocket::create<StreamSocket>(
            std::string(), fds[0], Socket::Type::Unix, false, HostType::Other, clientHandler);

        // The "proxy side" socket - this is what we give to startPump
        auto proxyHandler = std::make_shared<ServerRequestHandler>();
        auto proxySocket = StreamSocket::create<StreamSocket>(
            std::string(), fds[1], Socket::Type::Unix, false, HostType::Other, proxyHandler);

        _clientPoll->insertNewSocket(clientSocket);

        Poco::Net::HTTPRequest request("GET", "/echo/hello-from-ProxyHandler-test", "HTTP/1.1");
        request.setHost("127.0.0.1:" + std::to_string(_echoPort));

        TST_LOG("Calling ProxyPoll::startPump to 127.0.0.1:" << _echoPort);

        ProxyPoll::startPump(proxySocket, "127.0.0.1", _echoPort, request);
        TST_LOG("startPump called successfully");
    }
};

/// Test that async connect failure returns 502 Bad Gateway to client
class UnitInternalProxyConnectError : public UnitWSD
{
    STATE_ENUM(Phase, Init, WaitResponse, Done) _phase;

    std::shared_ptr<SocketPoll> _clientPoll;
    std::shared_ptr<CaptureHandler> _captureHandler;

public:
    UnitInternalProxyConnectError()
        : UnitWSD("UnitInternalProxyConnectError")
        , _phase(Phase::Init)
        , _clientPoll(std::make_shared<SocketPoll>("error_client_poll"))
    {
        setTimeout(10s);
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Init:
            {
                TRANSITION_STATE(_phase, Phase::WaitResponse);

                _clientPoll->startThread();

                // Create socket pair for testing (client <-> proxy)
                int fds[2];
                if (socketpair(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK, 0, fds) < 0)
                {
                    LOK_ASSERT_FAIL("Failed to create socket pair: " << strerror(errno));
                    return;
                }

                // Client end - captures the 502 response
                _captureHandler = std::make_shared<CaptureHandler>();
                auto clientSocket =
                    StreamSocket::create<StreamSocket>(std::string(), fds[0], Socket::Type::Unix,
                                                       false, HostType::Other, _captureHandler);

                // Proxy end - this is what we give to startPump
                auto proxyHandler = std::make_shared<ServerRequestHandler>();
                auto proxySocket =
                    StreamSocket::create<StreamSocket>(std::string(), fds[1], Socket::Type::Unix,
                                                       false, HostType::Other, proxyHandler);

                _clientPoll->insertNewSocket(clientSocket);

                Poco::Net::HTTPRequest request("GET", "/test", "HTTP/1.1");
                request.setHost("127.0.0.1:59999");

                TST_LOG("Calling ProxyPoll::startPump with invalid target port 59999");
                ProxyPoll::startPump(proxySocket, "127.0.0.1", 59999, request);
                break;
            }
            case Phase::WaitResponse:
            {
                const std::string& received = _captureHandler->getReceived();
                if (!received.empty())
                {
                    TST_LOG("Received response: "
                            << received.substr(0, std::min(received.size(), size_t(100))));

                    LOK_ASSERT_MESSAGE("Expected 502 Bad Gateway response",
                                       received.find("502") != std::string::npos);

                    TRANSITION_STATE(_phase, Phase::Done);

                    _clientPoll->stop();

                    exitTest(TestResult::Ok);
                    UnitWSD::get().DocBrokerDestroy("");
                }
                break;
            }
            case Phase::Done:
                break;
        }
    }
};

/// Test flow control with large data transfer (2MB)
/// Verifies that backpressure is triggered and data is not lost
class UnitInternalProxyFlowControl : public UnitWSD
{
    STATE_ENUM(Phase, Init, ServerStarted, WaitData, Verify, Done) _phase;

    // 2MB - large enough to fill kernel buffers and trigger backpressure
    static constexpr size_t DATA_SIZE = 2 * 1024 * 1024;

    std::shared_ptr<SocketPoll> _serverPoll;
    std::shared_ptr<ServerSocket> _serverSocket;
    std::shared_ptr<SocketPoll> _clientPoll;
    std::shared_ptr<BackpressureTestHandler> _captureHandler;
    int _serverPort;

public:
    UnitInternalProxyFlowControl()
        : UnitWSD("UnitInternalProxyFlowControl")
        , _phase(Phase::Init)
        , _serverPoll(std::make_shared<SocketPoll>("flowcontrol_server_poll"))
        , _clientPoll(std::make_shared<SocketPoll>("flowcontrol_client_poll"))
        , _serverPort(0)
    {
        setTimeout(10s);
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Init:
            {
                TRANSITION_STATE(_phase, Phase::ServerStarted);
                _clientPoll->startThread();
                if (!startServer())
                {
                    LOK_ASSERT_FAIL("Failed to start server");
                    return;
                }
                break;
            }
            case Phase::ServerStarted:
            {
                TRANSITION_STATE(_phase, Phase::WaitData);
                startProxyRequest();
                break;
            }
            case Phase::WaitData:
            {
                const std::string& received = _captureHandler->getReceived();
                size_t bodyStart = received.find("\r\n\r\n");
                if (bodyStart != std::string::npos)
                {
                    bodyStart += 4;
                    size_t bodySize = received.size() - bodyStart;
                    if (bodySize >= DATA_SIZE)
                    {
                        TST_LOG("Received " << received.size() << " bytes (body: " << bodySize
                                            << "), proceeding to verify");
                        TRANSITION_STATE(_phase, Phase::Verify);
                    }
                }
                break;
            }
            case Phase::Verify:
            {
                TRANSITION_STATE(_phase, Phase::Done);

                const std::string& received = _captureHandler->getReceived();
                TST_LOG("Total received: " << received.size() << " bytes");

                LOK_ASSERT_MESSAGE("Expected HTTP 200",
                                   received.find("HTTP/1.1 200") != std::string::npos);

                size_t bodyStart = received.find("\r\n\r\n");
                LOK_ASSERT_MESSAGE("Expected HTTP headers", bodyStart != std::string::npos);
                bodyStart += 4;

                std::string body = received.substr(bodyStart);
                TST_LOG("Body size: " << body.size() << " bytes, expected: " << DATA_SIZE);
                LOK_ASSERT_MESSAGE("Body size mismatch", body.size() == DATA_SIZE);

                LOK_ASSERT_MESSAGE("Body content mismatch", body == std::string(DATA_SIZE, 'X'));

                TST_LOG("Flow control test passed - all " << DATA_SIZE << " bytes received intact");

                _clientPoll->stop();
                _serverPoll->stop();
                exitTest(TestResult::Ok);
                UnitWSD::get().DocBrokerDestroy("");
                break;
            }
            case Phase::Done:
                break;
        }
    }

private:
    bool startServer()
    {
        auto factory = std::make_shared<EchoServerFactory>();
        auto now = std::chrono::steady_clock::now();

        for (_serverPort = 19990; _serverPort < 20030; ++_serverPort)
        {
            _serverSocket = ServerSocket::create(ServerSocket::Type::Local, _serverPort,
                                                 Socket::Type::IPv4, now, *_serverPoll, factory);
            if (_serverSocket)
                break;
        }

        if (!_serverSocket)
        {
            TST_LOG("Failed to create server socket on any port");
            return false;
        }

        _serverPoll->startThread();
        _serverPoll->insertNewSocket(_serverSocket);

        TST_LOG("Large data server listening on port " << _serverPort);
        return true;
    }

    void startProxyRequest()
    {
        // Create socket pair for testing (client <-> proxy)
        int fds[2];
        if (socketpair(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK, 0, fds) < 0)
        {
            LOK_ASSERT_FAIL("Failed to create socket pair: " << strerror(errno));
            return;
        }

        _captureHandler = std::make_shared<BackpressureTestHandler>();
        auto clientSocket = StreamSocket::create<StreamSocket>(
            std::string(), fds[0], Socket::Type::Unix, false, HostType::Other, _captureHandler);

        auto proxyHandler = std::make_shared<ServerRequestHandler>();
        auto proxySocket = StreamSocket::create<StreamSocket>(
            std::string(), fds[1], Socket::Type::Unix, false, HostType::Other, proxyHandler);

        _clientPoll->insertNewSocket(clientSocket);

        // Request 2MB of data via /large/<size> endpoint
        Poco::Net::HTTPRequest request("GET", "/large/" + std::to_string(DATA_SIZE), "HTTP/1.1");
        request.setHost("127.0.0.1:" + std::to_string(_serverPort));

        TST_LOG("Calling ProxyPoll::startPump for " << DATA_SIZE
                                                    << " bytes to 127.0.0.1:" << _serverPort);
        ProxyPoll::startPump(proxySocket, "127.0.0.1", _serverPort, request);
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase*[4]{ new UnitInternalProxy(), new UnitInternalProxyConnectError(),
                             new UnitInternalProxyFlowControl(), nullptr };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
