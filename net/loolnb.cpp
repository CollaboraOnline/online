/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <atomic>
#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <mutex>
#include <thread>
#include <assert.h>

#include <Poco/MemoryStream.h>
#include <Poco/Net/SocketAddress.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Util/ServerApplication.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Runnable.h>
#include <Poco/Thread.h>

#include "Socket.hpp"
#include "ServerSocket.hpp"
#include "SslSocket.hpp"
#include "WebSocketHandler.hpp"

using Poco::MemoryInputStream;
using Poco::StringTokenizer;

constexpr int HttpPortNumber = 9191;
constexpr int SslPortNumber = 9193;

class SimpleResponseClient : public WebSocketHandler
{
public:
    SimpleResponseClient() : WebSocketHandler()
    {
    }

    virtual void handleMessage(bool fin, WSOpCode code, std::vector<char> &data) override
    {
        std::cerr << "Message: fin? " << fin << " code " << code << " data size " << data.size();
        if (code == WSOpCode::Text)
        {
            std::string text(data.begin(), data.end());
            std::cerr << " text is '" << text << "'\n";

            return;
        }
        else
            std::cerr << " binary\n";

        std::vector<char> reply;
        if (data.size() == sizeof(size_t))
        {
            // ping pong test
            assert (data.size() >= sizeof(size_t));
            size_t *countPtr = reinterpret_cast<size_t *>(&data[0]);
            size_t count = *countPtr;
            count++;
            std::cerr << "count is " << count << "\n";
            reply.insert(reply.end(), reinterpret_cast<char *>(&count),
                        reinterpret_cast<char *>(&count) + sizeof(count));
        }
        else
        {
            // echo tests
            reply.insert(reply.end(), data.begin(), data.end());
        }

        sendMessage(reply);
    }
};

// FIXME: use Poco Thread instead (?)

/// Generic thread class.
class Thread
{
public:
    Thread(const std::function<void(std::atomic<bool>&)>& cb) :
        _cb(cb),
        _stop(false)
    {
        _thread = std::thread([this]() { _cb(_stop); });
    }

    Thread(Thread&& other) = delete;
    const Thread& operator=(Thread&& other) = delete;

    ~Thread()
    {
        stop();
        if (_thread.joinable())
        {
            _thread.join();
        }
    }

    void stop()
    {
        _stop = true;
    }

private:
    const std::function<void(std::atomic<bool>&)> _cb;
    std::atomic<bool> _stop;
    std::thread _thread;
};

Poco::Net::SocketAddress addrHttp("127.0.0.1", HttpPortNumber);
Poco::Net::SocketAddress addrSsl("127.0.0.1", SslPortNumber);

void server(const Poco::Net::SocketAddress& addr, SocketPoll& clientPoller,
            std::unique_ptr<SocketFactory> sockFactory)
{
    // Start server.
    auto server = std::make_shared<ServerSocket>(clientPoller, std::move(sockFactory));
    if (!server->bind(addr))
    {
        const std::string msg = "Failed to bind. (errno: ";
        throw std::runtime_error(msg + std::strerror(errno) + ")");
    }

    if (!server->listen())
    {
        const std::string msg = "Failed to listen. (errno: ";
        throw std::runtime_error(msg + std::strerror(errno) + ")");
    }

    SocketPoll serverPoll;

    serverPoll.insertNewSocket(server);

    std::cout << "Listening." << std::endl;
    for (;;)
    {
        serverPoll.poll(30000);
    }
}

class LOOLNB : public Poco::Util::ServerApplication
{
public:
    int main(const std::vector<std::string>& args) override
    {
        const char* logLevel = std::getenv("LOOL_LOGLEVEL");
        std::map<std::string, std::string> props;
        if (logLevel)
            Log::initialize("loolnb", logLevel ? logLevel : "",
                            false, false, props);

        // TODO: These would normally come from config.
        SslContext::initialize("/etc/loolwsd/cert.pem",
                               "/etc/loolwsd/key.pem",
                               "/etc/loolwsd/ca-chain.cert.pem");

        // Used to poll client sockets.
        SocketPoll poller;

        // Start the client polling thread.
        Thread threadPoll([&poller](std::atomic<bool>& stop)
                          {
                              while (!stop)
                              {
                                  poller.poll(5000);
                              }
                          });

        class PlainSocketFactory : public SocketFactory
        {
            std::shared_ptr<Socket> create(const int fd) override
            {
                return std::make_shared<StreamSocket>(fd, std::unique_ptr<SocketHandlerInterface>{ new SimpleResponseClient });
            }
        };

        class SslSocketFactory : public SocketFactory
        {
            std::shared_ptr<Socket> create(const int fd) override
            {
                return std::make_shared<SslStreamSocket>(fd, std::unique_ptr<SocketHandlerInterface>{ new SimpleResponseClient });
            }
        };


        // Start the server.
        if (args.back() == "ssl")
            server(addrSsl, poller, std::unique_ptr<SocketFactory>{new SslSocketFactory});
        else
            server(addrHttp, poller, std::unique_ptr<SocketFactory>{new PlainSocketFactory});

        std::cout << "Shutting down server." << std::endl;

        threadPoll.stop();

        SslContext::uninitialize();
        return 0;
    }
};

POCO_SERVER_MAIN(LOOLNB)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
