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
#include <Poco/Util/ServerApplication.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Runnable.h>
#include <Poco/Thread.h>

#include "Socket.hpp"
#include "ServerSocket.hpp"
#if ENABLE_SSL
#include "SslSocket.hpp"
#endif
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

    virtual void handleIncomingMessage(SocketDisposition &disposition) override
    {
        LOG_TRC("incoming WebSocket message");
        if (_wsState == WSState::HTTP)
        {
            auto socket = _socket.lock();

            int number = 0;
            Poco::MemoryInputStream message(&socket->_inBuffer[0], socket->_inBuffer.size());
            Poco::Net::HTTPRequest req;
            req.read(message);

            // if we succeeded - remove that from our input buffer
            // FIXME: We should check if this is GET or POST. For GET, we only
            // can have a single request (headers only). For POST, we can/should
            // use Poco HTMLForm to parse the post message properly.
            // Otherwise, we should catch exceptions from the previous read/parse
            // and assume we don't have sufficient data, so we wait some more.
            socket->_inBuffer.clear();

            LOG_DBG("URI: " << req.getURI());

            Poco::StringTokenizer tokens(req.getURI(), "/?");
            if (tokens.count() == 4)
            {
                std::string subpool = tokens[2];
                number = std::stoi(tokens[3]);

                // complex algorithmic core:
                number = number + 1;

                std::string numberString = std::to_string(number);
                std::ostringstream oss;
                oss << "HTTP/1.1 200 OK\r\n"
                    << "Date: Once, Upon a time GMT\r\n" // Mon, 27 Jul 2009 12:28:53 GMT
                    << "Server: madeup string (Linux)\r\n"
                    << "Content-Length: " << numberString.size() << "\r\n"
                    << "Content-Type: text/plain\r\n"
                    << "Connection: Closed\r\n"
                    << "\r\n"
                    << numberString;

                std::string str = oss.str();
                socket->_outBuffer.insert(socket->_outBuffer.end(), str.begin(), str.end());
                return;
            }
            else if (tokens.count() == 2 && tokens[1] == "ws")
            {
                upgradeToWebSocket(req);
                return;
            }
        }

        WebSocketHandler::handleIncomingMessage(disposition);
    }

    virtual void handleMessage(const bool fin, const WSOpCode code, std::vector<char> &data) override
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

        sendMessage(reply.data(), reply.size(), code);
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

    SocketPoll serverPoll("srv_poll");

    serverPoll.insertNewSocket(server);

    std::cout << "Listening." << std::endl;
    while (true)
        sleep(1);
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

#if ENABLE_SSL
        // TODO: These would normally come from config.
        SslContext::initialize("/etc/loolwsd/cert.pem",
                               "/etc/loolwsd/key.pem",
                               "/etc/loolwsd/ca-chain.cert.pem");
#endif

        // Used to poll client sockets.
        SocketPoll poller("client_poll");

        class PlainSocketFactory : public SocketFactory
        {
            std::shared_ptr<Socket> create(const int fd) override
            {
                return StreamSocket::create<StreamSocket>(fd, std::unique_ptr<SocketHandlerInterface>{ new SimpleResponseClient });
            }
        };

#if ENABLE_SSL
        class SslSocketFactory : public SocketFactory
        {
            std::shared_ptr<Socket> create(const int fd) override
            {
                return StreamSocket::create<SslStreamSocket>(fd, std::unique_ptr<SocketHandlerInterface>{ new SimpleResponseClient });
            }
        };

        // Start the server.
        if (!args.empty() && args.back() == "ssl")
            server(addrSsl, poller, std::unique_ptr<SocketFactory>{new SslSocketFactory});
        else
#endif
            server(addrHttp, poller, std::unique_ptr<SocketFactory>{new PlainSocketFactory});

        std::cout << "Shutting down server." << std::endl;

        poller.stop();

#if ENABLE_SSL
        SslContext::uninitialize();
#endif

        (void)args;
        return 0;
    }
};

POCO_SERVER_MAIN(LOOLNB)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
