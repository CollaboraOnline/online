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

class SocketFactory
{
public:
    virtual std::shared_ptr<Socket> create(const int fd) = 0;
};

/// A non-blocking, streaming socket.
class ServerSocket : public Socket
{
public:
    ServerSocket(SocketPoll& clientPoller, std::shared_ptr<SocketFactory> sockFactory) :
        _clientPoller(clientPoller),
        _sockFactory(std::move(sockFactory))
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
    std::shared_ptr<Socket> accept()
    {
        // Accept a connection (if any) and set it to non-blocking.
        // We don't care about the client's address, so ignored.
        const int rc = ::accept4(getFD(), nullptr, nullptr, SOCK_NONBLOCK);
        LOG_DBG("Accepted socket #" << rc << ", creating socket object.");
        try
        {
            // Create a socket object using the factory.
            return (rc != -1 ? _sockFactory->create(rc) : std::shared_ptr<Socket>(nullptr));
        }
        catch (const std::exception& ex)
        {
            LOG_SYS("Failed to create client socket #" << rc << ". Error: " << ex.what());
        }

        return nullptr;
    }

    int getPollEvents() override
    {
        return POLLIN;
    }

    void dumpState(std::ostream& os) override;

    HandleResult handlePoll(const Poco::Timestamp &/* now */, int events) override
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

        return Socket::HandleResult::CONTINUE;
    }

private:
    SocketPoll& _clientPoller;
    std::shared_ptr<SocketFactory> _sockFactory;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
