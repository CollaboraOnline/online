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

#include <Poco/Net/SocketAddress.h>

#include "socket.hpp"

constexpr int PortNumber = 9191;

/// Handles non-blocking socket event polling.
/// Only polls on N-Sockets and invokes callback and
/// doesn't manage buffers or client data.
/// Note: uses poll(2) since it has very good performance
/// compared to epoll up to a few hundred sockets and
/// doesn't suffer select(2)'s poor API. Since this will
/// be used per-document we don't expect to have several
/// hundred users on same document to suffer poll(2)'s
/// scalability limit. Meanwhile, epoll(2)'s high
/// overhead to adding/removing sockets is not helpful.
template <typename T>
class SocketPoll
{
public:
    SocketPoll()
    {
        // Create the wakeup fd.
        if (::pipe2(_wakeup, O_CLOEXEC | O_NONBLOCK) == -1)
        {
            //FIXME: Can't have wakeup pipe, should we exit?
            _wakeup[0] = -1;
            _wakeup[1] = -1;
        }

        createPollFds();
    }

    ~SocketPoll()
    {
        ::close(_wakeup[0]);
        ::close(_wakeup[1]);
    }

    /// Poll the sockets for available data to read or buffer to write.
    void poll(const int timeoutMs, const std::function<bool(const std::shared_ptr<T>&, const int)>& handler)
    {
        const size_t size = _pollSockets.size();

        int rc;
        do
        {
            rc = ::poll(&_pollFds[0], size + 1, timeoutMs);
        }
        while (rc < 0 && errno == EINTR);

        // Fire the callback and remove dead fds.
        for (int i = static_cast<int>(size) - 1; i >= 0; --i)
        {
            if (_pollFds[i].revents)
            {
                if (!handler(_pollSockets[i], _pollFds[i].revents))
                {
                    std::cout << "Removing: " << _pollFds[i].fd << std::endl;
                    _pollSockets.erase(_pollSockets.begin() + i);
                    // Don't remove from pollFds; we'll recreate below.
                }
            }
        }

        // Process the wakeup pipe (always the last entry).
        if (_pollFds[size].revents)
        {
            // Add new sockets first.
            addNewSocketsToPoll();

            // Recreate the poll fds array.
            createPollFds();

            // Clear the data.
            int dump;
            if (::read(_wakeup[0], &dump, sizeof(4)) == -1)
            {
                // Nothing to do.
            }
        }
        else if (_pollFds.size() != (_pollSockets.size() + 1))
        {
            createPollFds();
        }
    }

    /// Insert a new socket to be polled.
    /// Sockets are removed only when the handler return false.
    void insertNewSocket(const std::shared_ptr<ClientSocket>& newSocket)
    {
        std::lock_guard<std::mutex> lock(_mutex);

        _newSockets.emplace_back(newSocket);

        // wakeup the main-loop.
        if (::write(_wakeup[1], "w", 1) == -1)
        {
            // No wake up then.
        }
    }

private:

    /// Add the new sockets to list of those to poll.
    void addNewSocketsToPoll()
    {
        std::lock_guard<std::mutex> lock(_mutex);

        // Copy the new sockets over and clear.
        _pollSockets.insert(_pollSockets.end(), _newSockets.begin(), _newSockets.end());
        _newSockets.clear();
    }

    /// Create the poll fds array.
    void createPollFds()
    {
        const size_t size = _pollSockets.size();

        _pollFds.resize(size + 1); // + wakeup pipe

        for (size_t i = 0; i < size; ++i)
        {
            _pollFds[i].fd = _pollSockets[i]->fd();
            _pollFds[i].events = POLLIN | POLLOUT; //TODO: Get from the socket.
            _pollFds[i].revents = 0;
        }

        // Add the read-end of the wake pipe.
        _pollFds[size].fd = _wakeup[0];
        _pollFds[size].events = POLLIN;
        _pollFds[size].revents = 0;
    }

private:
    /// main-loop wakeup pipe
    int _wakeup[2];
    /// The sockets we're controlling
    std::vector<std::shared_ptr<ClientSocket>> _pollSockets;
    /// Protects _newSockets
    std::mutex _mutex;
    std::vector<std::shared_ptr<ClientSocket>> _newSockets;
    /// The fds to poll.
    std::vector<pollfd> _pollFds;
};

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

void client(const int timeoutMs)
{
    const auto client = std::make_shared<ClientSocket>();
    if (!client->connect(addr, timeoutMs) && errno != EINPROGRESS)
    {
        const std::string msg = "Failed to call connect. (errno: ";
        throw std::runtime_error(msg + std::strerror(errno) + ")");
    }

    std::cout << "Connected " << client->fd() << std::endl;

    client->send("1", 1);
    int sent = 1;
    while (sent > 0 && client->pollRead(5000))
    {
        char buf[1024];
        const int recv = client->recv(buf, sizeof(buf));
        if (recv <= 0)
        {
            perror("recv");
            break;
        }
        else
        {
            const std::string msg = std::string(buf, recv);
            const int num = stoi(msg);
            const std::string new_msg = std::to_string(num + 1);
            sent = client->send(new_msg.data(), new_msg.size());
        }
    }
}

void server(SocketPoll<ClientSocket>& poller)
{
    // Start server.
    auto server = std::make_shared<ServerSocket>();
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

    std::cout << "Listening." << std::endl;
    for (;;)
    {
        if (server->pollRead(30000))
        {
            std::shared_ptr<ClientSocket> clientSocket = server->accept();
            if (!clientSocket)
            {
                const std::string msg = "Failed to accept. (errno: ";
                throw std::runtime_error(msg + std::strerror(errno) + ")");
            }

            std::cout << "Accepted client #" << clientSocket->fd() << std::endl;
            poller.insertNewSocket(clientSocket);
        }
    }
}

/// Poll client sockets and do IO.
void pollAndComm(SocketPoll<ClientSocket>& poller, std::atomic<bool>& stop)
{
    while (!stop)
    {
        poller.poll(5000, [](const std::shared_ptr<ClientSocket>& socket, const int events)
        {
            if (events & POLLIN)
            {
                char buf[1024];
                const int recv = socket->recv(buf, sizeof(buf));
                if (recv <= 0)
                {
                    perror("recv");
                    return false;
                }

                if (events & POLLOUT)
                {
                    const std::string msg = std::string(buf, recv);
                    const int num = stoi(msg);
                    if ((num % (1<<16)) == 1)
                    {
                        std::cout << "Client #" << socket->fd() << ": " << msg << std::endl;
                    }
                    const std::string new_msg = std::to_string(num + 1);
                    const int sent = socket->send(new_msg.data(), new_msg.size());
                    if (sent != static_cast<int>(new_msg.size()))
                    {
                        perror("send");
                        return false;
                    }
                }
                else
                {
                    // Normally we'd buffer the response, but for now...
                    std::cerr << "Client #" << socket->fd()
                            << ": ERROR - socket not ready for write." << std::endl;
                }
            }

            return true;
        });
    }
}

int main(int argc, const char**)
{
    if (argc > 1)
    {
        // We are now the client application.
        client(0);
        return 0;
    }

    // Used to poll client sockets.
    SocketPoll<ClientSocket> poller;

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
