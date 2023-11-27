/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <cstdlib>
#include <iostream>

#include "ConfigUtil.hpp"
#include "Socket.hpp"
#include <test/HttpTestServer.hpp>

#include <Poco/URI.h>

#include <chrono>
#include <condition_variable>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <test/lokassert.hpp>

#if ENABLE_SSL
#include "Ssl.hpp"
#include <net/SslSocket.hpp>
#endif
#include <net/ServerSocket.hpp>
#include <net/DelaySocket.hpp>
#include <net/HttpRequest.hpp>
#include <FileUtil.hpp>
#include <Util.hpp>

class HttpRequestTests final
{
    std::string _localUri;
    SocketPoll _pollServerThread;
    std::shared_ptr<ServerSocket> _socket;
    std::shared_ptr<http::Session> _httpSession;
    SocketPoll _poller;
    bool _completed;

    class ServerSocketFactory final : public SocketFactory
    {
        std::shared_ptr<Socket> create(const int physicalFd, Socket::Type type) override
        {
            return StreamSocket::create<StreamSocket>("localhost", physicalFd, type, false,
                                                      std::make_shared<ServerRequestHandler>());
        }
    };

public:
    HttpRequestTests()
        : _pollServerThread("HttpServerPoll")
        , _poller("HttpSynReqPoll")
    {
        _poller.runOnClientThread();

        std::map<std::string, std::string> logProperties;
        const auto log_level = std::getenv("LOG_LEVEL");
        if (log_level)
        {
            Log::initialize("fuz", log_level ? log_level : "error", isatty(fileno(stderr)), false,
                            logProperties);
        }

        std::shared_ptr<SocketFactory> factory = std::make_shared<ServerSocketFactory>();
        int port = 9990;
        for (int i = 0; i < 40; ++i, ++port)
        {
            // Try listening on this port.
            _socket = ServerSocket::create(ServerSocket::Type::Local, port, Socket::Type::IPv4,
                                           _pollServerThread, factory);
            if (_socket)
                break;
        }

        _localUri = "http://127.0.0.1:" + std::to_string(port);
        _pollServerThread.startThread();
        _pollServerThread.insertNewSocket(_socket);

        _httpSession = http::Session::create(localUri());
        if (!_httpSession)
            throw std::runtime_error("Failed to create http::Session to " + localUri());

        _httpSession->setTimeout(std::chrono::milliseconds(500));
        _httpSession->setFinishedHandler(
            [&](const std::shared_ptr<http::Session>&)
            {
                _completed = true;
                return true;
            });
    }

    ~HttpRequestTests()
    {
        _pollServerThread.stop();
        _socket.reset();
    }

    const std::string& localUri() const { return _localUri; }
    std::shared_ptr<http::Session> session() const { return _httpSession; }
    SocketPoll& poller() { return _poller; };
    bool isCompleted() const { return _completed; };
    void resetCompleted()
    {
        _completed = false;
        _poller.removeSockets(); // We don't need stale sockets from prevous tests.
    };
};

#define CHECK(X)                                                                                   \
    do                                                                                             \
    {                                                                                              \
        if (!(X))                                                                                  \
        {                                                                                          \
            fprintf(stderr, "Assertion: %s\n", #X);                                                \
            assert(!(X));                                                                          \
            __builtin_trap();                                                                      \
        }                                                                                          \
    } while (0)

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size)
{
    static HttpRequestTests test;

    http::Request httpRequest("/inject/" + Util::bytesToHexString(data, size));

    test.resetCompleted();

    const std::shared_ptr<const http::Response> httpResponse =
        test.session()->syncRequest(httpRequest, test.poller());

    CHECK(httpResponse->done());
    CHECK(test.isCompleted()); // The onFinished callback must always be called.

    if (httpResponse->state() == http::Response::State::Complete)
    {
        CHECK(!httpResponse->statusLine().httpVersion().empty());
        // CHECK(!httpResponse->statusLine().reasonPhrase().empty());

        // CHECK(httpResponse->statusLine().statusCode() >= 100);
        // CHECK(httpResponse->statusLine().statusCode() < 600);
    }

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
