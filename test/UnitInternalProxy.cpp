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
#include <net/ServerSocket.hpp>
#include <net/Socket.hpp>
#include <wsd/ProxyPoll.hpp>
#include <HttpTestServer.hpp>

#include <Poco/Net/HTTPRequest.h>

#include <sys/socket.h>

using namespace std::literals;

/// Captures incoming data on a socket for test verification.
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
        if (auto socket = _socket.lock())
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

/// Factory for creating test server sockets using ServerRequestHandler.
class EchoServerFactory final : public SocketFactory
{
    std::shared_ptr<Socket> create(const int fd, Socket::Type type) override
    {
        return StreamSocket::create<StreamSocket>(std::string(), fd, type, false, HostType::Other,
                                                  std::make_shared<ServerRequestHandler>());
    }
};

/// Test: async connect failure returns 502 Bad Gateway to client.
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

                int fds[2];
                if (socketpair(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK, 0, fds) < 0)
                {
                    LOK_ASSERT_FAIL("socketpair: " << strerror(errno));
                    return;
                }

                // Client end captures the 502 response.
                _captureHandler = std::make_shared<CaptureHandler>();
                auto clientSocket =
                    StreamSocket::create<StreamSocket>(std::string(), fds[0], Socket::Type::Unix,
                                                      false, HostType::Other, _captureHandler);

                // Proxy end is what we hand to startPump.
                auto proxySocket = StreamSocket::create<StreamSocket>(
                    std::string(), fds[1], Socket::Type::Unix, false, HostType::Other,
                    std::make_shared<ServerRequestHandler>());

                _clientPoll->insertNewSocket(clientSocket);

                Poco::Net::HTTPRequest request("GET", "/test", "HTTP/1.1");
                request.setHost("127.0.0.1:59999");

                TST_LOG("startPump to unreachable 127.0.0.1:59999");
                ProxyPoll::startPump(proxySocket, "127.0.0.1", 59999, request,
                                     ProxyPoll::instance());
                break;
            }
            case Phase::WaitResponse:
            {
                const std::string& received = _captureHandler->getReceived();
                if (!received.empty())
                {
                    TST_LOG("Got response: "
                            << received.substr(0, std::min(received.size(), size_t(100))));
                    LOK_ASSERT_MESSAGE("Expected 502 Bad Gateway",
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

/// Test: 2MB transfer through proxy with backpressure. Verifies flow
/// control works and no data is lost.
class UnitInternalProxyFlowControl : public UnitWSD
{
    STATE_ENUM(Phase, Init, ServerStarted, WaitData, Verify, Done) _phase;

    static constexpr size_t DATA_SIZE = 2 * 1024 * 1024;

    std::shared_ptr<SocketPoll> _serverPoll;
    std::shared_ptr<ServerSocket> _serverSocket;
    std::shared_ptr<SocketPoll> _clientPoll;
    std::shared_ptr<CaptureHandler> _captureHandler;
    int _serverPort;

public:
    UnitInternalProxyFlowControl()
        : UnitWSD("UnitInternalProxyFlowControl")
        , _phase(Phase::Init)
        , _serverPoll(std::make_shared<SocketPoll>("flowctrl_srv"))
        , _clientPoll(std::make_shared<SocketPoll>("flowctrl_cli"))
        , _serverPort(0)
    {
        setTimeout(30s);
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
                    LOK_ASSERT_FAIL("Failed to start test server");
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
                    size_t bodySize = received.size() - (bodyStart + 4);
                    if (bodySize >= DATA_SIZE)
                    {
                        TST_LOG("Received " << received.size() << " bytes total, body: "
                                            << bodySize);
                        TRANSITION_STATE(_phase, Phase::Verify);
                    }
                }
                break;
            }
            case Phase::Verify:
            {
                TRANSITION_STATE(_phase, Phase::Done);

                const std::string& received = _captureHandler->getReceived();
                LOK_ASSERT_MESSAGE("Expected HTTP 200",
                                   received.find("HTTP/1.1 200") != std::string::npos);

                size_t bodyStart = received.find("\r\n\r\n");
                LOK_ASSERT(bodyStart != std::string::npos);
                std::string body = received.substr(bodyStart + 4);
                LOK_ASSERT_EQUAL(DATA_SIZE, body.size());
                LOK_ASSERT_MESSAGE("Body content mismatch",
                                   body == std::string(DATA_SIZE, 'X'));

                TST_LOG("Flow control test passed - " << DATA_SIZE << " bytes intact");
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
            return false;

        _serverPoll->startThread();
        _serverPoll->insertNewSocket(_serverSocket);
        TST_LOG("Test server on port " << _serverPort);
        return true;
    }

    void startProxyRequest()
    {
        int fds[2];
        if (socketpair(AF_UNIX, SOCK_STREAM | SOCK_NONBLOCK, 0, fds) < 0)
        {
            LOK_ASSERT_FAIL("socketpair: " << strerror(errno));
            return;
        }

        _captureHandler = std::make_shared<CaptureHandler>();
        auto clientSocket = StreamSocket::create<StreamSocket>(
            std::string(), fds[0], Socket::Type::Unix, false, HostType::Other, _captureHandler);

        auto proxySocket = StreamSocket::create<StreamSocket>(
            std::string(), fds[1], Socket::Type::Unix, false, HostType::Other,
            std::make_shared<ServerRequestHandler>());

        _clientPoll->insertNewSocket(clientSocket);

        Poco::Net::HTTPRequest request("GET", "/large/" + std::to_string(DATA_SIZE), "HTTP/1.1");
        request.setHost("127.0.0.1:" + std::to_string(_serverPort));

        TST_LOG("startPump: " << DATA_SIZE << " bytes via 127.0.0.1:" << _serverPort);
        ProxyPoll::startPump(proxySocket, "127.0.0.1", _serverPort, request,
                             ProxyPoll::instance());
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase*[3]{ new UnitInternalProxyConnectError(),
                             new UnitInternalProxyFlowControl(), nullptr };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
