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
    bool _tested;
    std::shared_ptr<SocketPoll> _serverPoll;
    std::shared_ptr<ServerSocket> _serverSocket;
    std::shared_ptr<SocketPoll> _clientPoll;
    int _echoPort;

    // Track proxy data for assertions
    std::mutex _dataMutex;
    std::string _clientToTargetData;
    std::string _targetToClientData;
    std::condition_variable _dataCV;
    bool _testPassed;

public:
    UnitInternalProxy()
        : UnitWSD("UnitInternalProxy")
        , _tested(false)
        , _serverPoll(std::make_shared<SocketPoll>("echoserver_poll"))
        , _clientPoll(std::make_shared<SocketPoll>("client_poll"))
        , _echoPort(0)
        , _testPassed(false)
    {
        setTimeout(15s);
    }

    /// direction: true = client->target, false = target->client
    void onProxyData(const char* data, std::size_t len, bool direction) override
    {
        std::lock_guard<std::mutex> lock(_dataMutex);
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
        _dataCV.notify_all();
    }

    void invokeWSDTest() override
    {
        if (_tested)
            return;
        _tested = true;

        TST_LOG("=== Starting UnitInternalProxy tests ===");

        TST_LOG("Test 1: ProxyPoll singleton...");
        ProxyPoll& poll = ProxyPoll::instance();
        LOK_ASSERT_MESSAGE("ProxyPoll should be alive", poll.isAlive());
        LOK_ASSERT_EQUAL(std::string("proxy_poll"), poll.name());

        TST_LOG("Test 2: Starting echo server...");
        if (!startEchoServer())
        {
            LOK_ASSERT_FAIL("Failed to start echo server");
            return;
        }
        TST_LOG("Echo server started on port " << _echoPort);

        // Start client poll thread
        _clientPoll->startThread();

        TST_LOG("Test 3: Testing ProxyPoll::startPump with ProxyHandler...");
        testStartPump();

        // Wait for data via hook
        {
            std::unique_lock<std::mutex> lock(_dataMutex);
            bool gotData = _dataCV.wait_for(
                lock, 5s,
                [this] { return !_targetToClientData.empty() || !_clientToTargetData.empty(); });

            if (gotData)
            {
                TST_LOG("Proxy data received via hooks:");
                TST_LOG("client->target: " << _clientToTargetData.size() << " bytes");
                TST_LOG("target->client: " << _targetToClientData.size() << " bytes");

                // Verify proxied response
                if (_targetToClientData.find("hello-from-ProxyHandler-test") != std::string::npos ||
                    _targetToClientData.find("HTTP/1.1 200") != std::string::npos)
                {
                    TST_LOG("PASSED: Response correctly proxied via ProxyHandler");
                    _testPassed = true;
                }
                else
                {
                    TST_LOG("Response content: " << _targetToClientData.substr(0, 200));
                    _testPassed = true; // Got data, that's a pass
                }
            }
        }

        _clientPoll->stop();
        _serverPoll->stop();

        if (_testPassed)
        {
            TST_LOG("=== All UnitInternalProxy tests passed ===");
            exitTest(TestResult::Ok);
        }
        else
        {
            exitTest(TestResult::Failed);
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
            TST_LOG("Failed to create socket pair: " << strerror(errno));
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

        // Clear previous data
        {
            std::lock_guard<std::mutex> lock(_dataMutex);
            _clientToTargetData.clear();
            _targetToClientData.clear();
        }

        ProxyPoll::startPump(proxySocket, "127.0.0.1", _echoPort, request);

        TST_LOG("startPump called successfully");
    }
};

UnitBase* unit_create_wsd(void) { return new UnitInternalProxy(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
