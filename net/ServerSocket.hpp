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

#pragma once

#include "NetUtil.hpp"
#include "memory"

#include "Socket.hpp"
#include "Log.hpp"

class SocketFactory
{
public:
    virtual std::shared_ptr<Socket> create(const int fd, Socket::Type type) = 0;
};

/// A non-blocking, streaming socket.
class ServerSocket : public Socket
{
public:
    ServerSocket(Socket::Type type,
                 std::chrono::steady_clock::time_point creationTime,
                 SocketPoll& clientPoller, std::shared_ptr<SocketFactory> sockFactory)
        : Socket(type, creationTime)
        , _sockFactory(std::move(sockFactory))
        , _clientPoller(clientPoller)
#if !MOBILEAPP
        , _type(type)
#endif
    {
    }

    /// Control access to a bound TCP socket
    STATE_ENUM(Type, Local, Public);

    /// Create a new server socket - accepted sockets will be added
    /// to the @clientSockets' poll when created with @factory.
    static std::shared_ptr<ServerSocket> create(ServerSocket::Type type,
                                                int port,
                                                Socket::Type socketType,
                                                std::chrono::steady_clock::time_point creationTime,
                                                SocketPoll& clientSocket,
                                                std::shared_ptr<SocketFactory> factory)
    {
        auto serverSocket = std::make_shared<ServerSocket>(socketType, creationTime, clientSocket, std::move(factory));

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
        (void) backlog;
        const int rc = fakeSocketListen(getFD());
#endif
        if (rc)
            LOG_SYS("Failed to listen");
        else
            LOG_TRC("Listening");
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
            if (clientSocket)
            {
                LOGA_TRC(Socket, "Accepted client #" << clientSocket->getFD() << ", " << *clientSocket);
                _clientPoller.insertNewSocket(std::move(clientSocket));
            }
        }
    }

protected:
    bool isUnrecoverableAcceptError(const int cause);
    /// Create a Socket instance from the accepted socket FD.
    std::shared_ptr<Socket> createSocketFromAccept(int fd, Socket::Type type) const
    {
        return _sockFactory->create(fd, type);
    }

private:
    std::shared_ptr<SocketFactory> _sockFactory;
    SocketPoll& _clientPoller;
#if !MOBILEAPP
    Socket::Type _type;
#endif
};

#if !MOBILEAPP

/// A non-blocking, streaming Unix Domain Socket for local use
class LocalServerSocket : public ServerSocket
{
public:
    LocalServerSocket(std::chrono::steady_clock::time_point creationTime,
                      SocketPoll& clientPoller, std::shared_ptr<SocketFactory> sockFactory) :
        ServerSocket(Socket::Type::Unix, creationTime, clientPoller, std::move(sockFactory))
    {
    }
    ~LocalServerSocket() override;

    bool bind(Type, int) override { assert(false); return false; }
    std::shared_ptr<Socket> accept() override;
    std::string bind();
#ifndef HAVE_ABSTRACT_UNIX_SOCKETS
    bool link(std::string to);
#endif

private:
    std::string _name;
#ifndef HAVE_ABSTRACT_UNIX_SOCKETS
    std::string _linkName;
#endif
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
