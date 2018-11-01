/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_SERVERSOCKET_HPP
#define INCLUDED_SERVERSOCKET_HPP

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
        _type(type),
        _clientPoller(clientPoller),
        _sockFactory(std::move(sockFactory))
    {
    }

    enum Type { Local, Public };

    /// Binds to a local address (Servers only).
    /// Does not retry on error.
    /// Returns true only on success.
    bool bind(Type type, int port);

    /// Listen to incoming connections (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool listen(const int backlog = 64)
    {
#ifndef MOBILEAPP
        const int rc = ::listen(getFD(), backlog);
#else
        const int rc = fakeSocketListen(getFD());
#endif
        if (rc)
            LOG_SYS("Failed to listen");
        return rc == 0;
    }

    /// Accepts an incoming connection (Servers only).
    /// Does not retry on error.
    /// Returns a valid Socket shared_ptr on success only.
    std::shared_ptr<Socket> accept()
    {
        // Accept a connection (if any) and set it to non-blocking.
        // There still need the client's address to filter request from POST(call from REST) here.
#ifndef MOBILEAPP
        struct sockaddr_in6 clientInfo;
        socklen_t addrlen = sizeof(clientInfo);
        const int rc = ::accept4(getFD(), (struct sockaddr *)&clientInfo, &addrlen, SOCK_NONBLOCK);
#else
        const int rc = fakeSocketAccept4(getFD());
#endif
        LOG_DBG("Accepted socket #" << rc << ", creating socket object.");
        try
        {
            // Create a socket object using the factory.
            if (rc != -1)
            {
#ifndef MOBILEAPP
                char addrstr[INET6_ADDRSTRLEN];

                const void *inAddr;
                if (clientInfo.sin6_family == AF_INET)
                {
                    auto ipv4 = (struct sockaddr_in *)&clientInfo;
                    inAddr = &(ipv4->sin_addr);
                }
                else
                {
                    auto ipv6 = (struct sockaddr_in6 *)&clientInfo;
                    inAddr = &(ipv6->sin6_addr);
                }

                inet_ntop(clientInfo.sin6_family, inAddr, addrstr, sizeof(addrstr));
                std::shared_ptr<Socket> _socket = _sockFactory->create(rc);
                _socket->setClientAddress(addrstr);
                LOG_DBG("Accepted socket has family " << clientInfo.sin6_family <<
                        " address " << _socket->clientAddress());
#else
                std::shared_ptr<Socket> _socket = _sockFactory->create(rc);
                _socket->setClientAddress("dummy");
#endif
                return _socket;
            }
            return std::shared_ptr<Socket>(nullptr);
        }
        catch (const std::exception& ex)
        {
            LOG_SYS("Failed to create client socket #" << rc << ". Error: " << ex.what());
        }

        return nullptr;
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int & /* timeoutMaxMs */) override
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
                throw std::runtime_error(msg + std::strerror(errno) + ")");
            }

            LOG_DBG("Accepted client #" << clientSocket->getFD());
            _clientPoller.insertNewSocket(clientSocket);
        }
    }

private:
    Socket::Type _type;
    SocketPoll& _clientPoller;
    std::shared_ptr<SocketFactory> _sockFactory;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
