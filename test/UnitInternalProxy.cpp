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
        setTimeout(15s);
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

UnitBase* unit_create_wsd(void) { return new UnitInternalProxy(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
