/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include "memory"

#include "Socket.hpp"
#include "Log.hpp"

#include <Poco/Net/SocketAddress.h>

class SocketFactory
{
public:
    virtual std::shared_ptr<Socket> create(const int fd) = 0;
};

/// A non-blocking, streaming socket.
class ServerSocket : public Socket
{
public:
    ServerSocket(Socket::Type type, SocketPoll& clientPoller, std::shared_ptr<SocketFactory> sockFactory) :
        Socket(type),
#if !MOBILEAPP
        _type(type),
#endif
        _clientPoller(clientPoller),
        _sockFactory(std::move(sockFactory))
    {
    }

    /// Control access to a bound TCP socket
    enum Type { Local, Public };

    /// Create a new server socket - accepted sockets will be added
    /// to the @clientSockets' poll when created with @factory.
    static std::shared_ptr<ServerSocket> create(ServerSocket::Type type, int port,
                                                Socket::Type socketType, SocketPoll& clientSocket,
                                                std::shared_ptr<SocketFactory> factory)
    {
        auto serverSocket = std::make_shared<ServerSocket>(socketType, clientSocket, std::move(factory));

        if (serverSocket && serverSocket->bind(type, port) && serverSocket->listen())
            return serverSocket;

        return nullptr;
    }

    /// Binds to a local address (Servers only).
    /// Does not retry on error.
    /// Returns true only on success.
    virtual bool bind(Type type, int port);

    /// Listen to incoming connections (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool listen(const int backlog = 64)
    {
#if !MOBILEAPP
        const int rc = ::listen(getFD(), backlog);
#else
        const int rc = fakeSocketListen(getFD());
#endif
        if (rc)
            LOG_SYS('#' << getFD() << " Failed to listen");
        else
            LOG_TRC('#' << getFD() << " Listening");
        return rc == 0;
    }

    /// Accepts an incoming connection (Servers only).
    /// Does not retry on error.
    /// Returns a valid Socket shared_ptr on success only.
    virtual std::shared_ptr<Socket> accept();

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t & /* timeoutMaxMicroS */) override
    {
        return POLLIN;
    }

    void dumpState(std::ostream& os) override;

    void handlePoll(SocketDisposition &,
                    std::chrono::steady_clock::time_point /* now */,
                    int events) override
    {
        if (events & POLLIN)
        {
            std::shared_ptr<Socket> clientSocket = accept();
            if (!clientSocket)
            {
                const std::string msg = "Failed to accept. (errno: ";
                throw std::runtime_error(msg + std::strerror(errno) + ')');
            }

            LOG_DBG("Accepted client #" << clientSocket->getFD());
            _clientPoller.insertNewSocket(clientSocket);
        }
    }

private:
#if !MOBILEAPP
    Socket::Type _type;
#endif
    SocketPoll& _clientPoller;
protected:
    std::shared_ptr<SocketFactory> _sockFactory;
};

#if !MOBILEAPP

/// A non-blocking, streaming Unix Domain Socket for local use
class LocalServerSocket : public ServerSocket
{
public:
    LocalServerSocket(SocketPoll& clientPoller, std::shared_ptr<SocketFactory> sockFactory) :
        ServerSocket(Socket::Type::Unix, clientPoller, std::move(sockFactory))
    {
    }
    virtual bool bind(Type, int) override { assert(false); return false; }
    virtual std::shared_ptr<Socket> accept() override;
    std::string bind();

private:
    std::string _name;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
