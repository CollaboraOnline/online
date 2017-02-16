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
#include <Poco/StringTokenizer.h>
#include <Poco/Runnable.h>
#include <Poco/Thread.h>

using Poco::MemoryInputStream;
using Poco::StringTokenizer;

#include "socket.hpp"

constexpr int PortNumber = 9191;

class SimpleResponseClient : public ClientSocket
{
public:
    SimpleResponseClient(const int fd) :
        ClientSocket(fd)
    {
    }
    virtual void handleIncomingMessage() override
    {
        std::cerr << "message had size " << _inBuffer.size() << "\n";

        int number = 0;
        MemoryInputStream message(&_inBuffer[0], _inBuffer.size());
        Poco::Net::HTTPRequest req;
        req.read(message);

        StringTokenizer tokens(req.getURI(), "/?");
        if (tokens.count() == 4)
        {
            std::string subpool = tokens[2];
            number = std::stoi(tokens[3]);
        }
        else
            std::cerr << " unknown tokens " << tokens.count() << std::endl;

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
            ;
        std::string str = oss.str();
        _outBuffer.insert(_outBuffer.end(), str.begin(), str.end());
        _inBuffer.clear();
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

Poco::Net::SocketAddress addr("127.0.0.1", PortNumber);

/// A non-blocking, streaming socket.
class ServerSocket : public Socket
{
    SocketPoll& _clientPoller;
public:
    ServerSocket(SocketPoll& clientPoller)
        : _clientPoller(clientPoller)
    {
    }

    /// Binds to a local address (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool bind(const Poco::Net::SocketAddress& address)
    {
        // Enable address reuse to avoid stalling after
        // recycling, when previous socket is TIME_WAIT.
        //TODO: Might be worth refactoring out.
        const int reuseAddress = 1;
        constexpr unsigned int len = sizeof(reuseAddress);
        ::setsockopt(getFD(), SOL_SOCKET, SO_REUSEADDR, &reuseAddress, len);

        const int rc = ::bind(getFD(), address.addr(), address.length());
        return (rc == 0);
    }

    /// Listen to incoming connections (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool listen(const int backlog = 64)
    {
        const int rc = ::listen(getFD(), backlog);
        return (rc == 0);
    }

    /// Accepts an incoming connection (Servers only).
    /// Does not retry on error.
    /// Returns a valid Socket shared_ptr on success only.
    template <typename T>
       std::shared_ptr<T> accept()
    {
        // Accept a connection (if any) and set it to non-blocking.
        // We don't care about the client's address, so ignored.
        const int rc = ::accept4(getFD(), nullptr, nullptr, SOCK_NONBLOCK);
        return std::shared_ptr<T>(rc != -1 ? new T(rc) : nullptr);
    }

    int getPollEvents() override
    {
        return POLLIN;
    }

    HandleResult handlePoll( int /* events */ ) override
    {
        std::shared_ptr<SimpleResponseClient> clientSocket = accept<SimpleResponseClient>();
        if (!clientSocket)
        {
            const std::string msg = "Failed to accept. (errno: ";
            throw std::runtime_error(msg + std::strerror(errno) + ")");
        }

        std::cout << "Accepted client #" << clientSocket->getFD() << std::endl;
        _clientPoller.insertNewSocket(clientSocket);

        return Socket::HandleResult::CONTINUE;
    }
};

void server(SocketPoll& clientPoller)
{
    // Start server.
    auto server = std::make_shared<ServerSocket>(clientPoller);
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

/// Poll client sockets and do IO.
void pollAndComm(SocketPoll& poller, std::atomic<bool>& stop)
{
    while (!stop)
    {
        poller.poll(5000);
    }
}

int main(int, const char**)
{
    // Used to poll client sockets.
    SocketPoll poller;

    // Start the client polling thread.
    Thread threadPoll([&poller](std::atomic<bool>& stop)
    {
        pollAndComm(poller, stop);
    });

    // Start the server.
    server(poller);

    std::cout << "Shutting down server." << std::endl;

    threadPoll.stop();

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
