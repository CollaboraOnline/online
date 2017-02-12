/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <unistd.h>

#include <poll.h>

#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>

#include <cassert>
#include <cerrno>
#include <clocale>
#include <condition_variable>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <fstream>
#include <iostream>
#include <map>
#include <mutex>
#include <sstream>
#include <thread>

#include <Poco/DOM/AutoPtr.h>
#include <Poco/DOM/DOMParser.h>
#include <Poco/DOM/DOMWriter.h>
#include <Poco/DOM/Document.h>
#include <Poco/DOM/Element.h>
#include <Poco/DOM/NodeList.h>
#include <Poco/Environment.h>
#include <Poco/Exception.h>
#include <Poco/File.h>
#include <Poco/FileStream.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/ConsoleCertificateHandler.h>
#include <Poco/Net/Context.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPRequestHandler.h>
#include <Poco/Net/HTTPRequestHandlerFactory.h>
#include <Poco/Net/HTTPServer.h>
#include <Poco/Net/HTTPServerParams.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTTPServerResponse.h>
#include <Poco/Net/IPAddress.h>
#include <Poco/Net/InvalidCertificateHandler.h>
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/MessageHeader.h>
#include <Poco/Net/NameValueCollection.h>
#include <Poco/Net/Net.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/PartHandler.h>
#include <Poco/Net/PrivateKeyPassphraseHandler.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/Net/SecureServerSocket.h>
#include <Poco/Net/ServerSocket.h>
#include <Poco/Net/SocketAddress.h>
#include <Poco/Path.h>
#include <Poco/Pipe.h>
#include <Poco/Process.h>
#include <Poco/SAX/InputSource.h>
#include <Poco/StreamCopier.h>
#include <Poco/StringTokenizer.h>
#include <Poco/TemporaryFile.h>
#include <Poco/ThreadPool.h>
#include <Poco/URI.h>
#include <Poco/Util/HelpFormatter.h>
#include <Poco/Util/MapConfiguration.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionException.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>

#include "Common.hpp"

using Poco::Environment;
using Poco::Exception;
using Poco::File;
using Poco::Net::HTMLForm;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPRequestHandler;
using Poco::Net::HTTPRequestHandlerFactory;
using Poco::Net::HTTPResponse;
using Poco::Net::HTTPServer;
using Poco::Net::HTTPServerParams;
using Poco::Net::HTTPServerRequest;
using Poco::Net::HTTPServerResponse;
using Poco::Net::MessageHeader;
using Poco::Net::NameValueCollection;
using Poco::Net::PartHandler;
using Poco::Net::SecureServerSocket;
using Poco::Net::ServerSocket;
using Poco::Net::SocketAddress;
using Poco::Net::StreamSocket;
using Poco::Path;
using Poco::Pipe;
using Poco::Process;
using Poco::ProcessHandle;
using Poco::StreamCopier;
using Poco::StringTokenizer;
using Poco::TemporaryFile;
using Poco::Thread;
using Poco::ThreadPool;
using Poco::URI;
using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::IncompatibleOptionsException;
using Poco::Util::MissingOptionException;
using Poco::Util::Option;
using Poco::Util::OptionSet;
using Poco::Util::ServerApplication;
using Poco::XML::AutoPtr;
using Poco::XML::DOMParser;
using Poco::XML::DOMWriter;
using Poco::XML::Element;
using Poco::XML::InputSource;
using Poco::XML::NodeList;
using Poco::XML::Node;

constexpr int PortNumber = 9191;

/// A non-blocking, streaming socket.
class Socket
{
public:
    Socket() :
        _fd(socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0))
    {
    }

    ~Socket()
    {
        //TODO: Should we shutdown here or up to the client?

        // Doesn't block on sockets; no error handling needed.
        close(_fd);
    }

    // Returns the OS native socket fd.
    int fd() const { return _fd; }

    /// Sets the send buffer in size bytes.
    /// Must be called before accept or connect.
    /// Note: TCP will allocate twice this size for admin purposes,
    /// so a subsequent call to getSendBufferSize will return
    /// the larger (actual) buffer size, if this succeeds.
    /// Note: the upper limit is set via /proc/sys/net/core/wmem_max,
    /// and there is an unconfigurable lower limit as well.
    /// Returns true on success only.
    bool setSendBufferSize(const int size)
    {
        constexpr unsigned int len = sizeof(size);
        const int rc = ::setsockopt(_fd, SOL_SOCKET, SO_SNDBUF, &size, len);
        return (rc == 0);
    }

    /// Gets the actual send buffer size in bytes, -1 for failure.
    int getSendBufferSize() const
    {
        int size;
        unsigned int len = sizeof(size);
        const int rc = ::getsockopt(_fd, SOL_SOCKET, SO_SNDBUF, &size, &len);
        return (rc == 0 ? size : -1);
    }

    /// Sets the receive buffer size in bytes.
    /// Must be called before accept or connect.
    /// Note: TCP will allocate twice this size for admin purposes,
    /// so a subsequent call to getSendBufferSize will return
    /// the larger (actual) buffer size, if this succeeds.
    /// Note: the upper limit is set via /proc/sys/net/core/rmem_max,
    /// and there is an unconfigurable lower limit as well.
    /// Returns true on success only.
    bool setReceiveBufferSize(const int size)
    {
        constexpr unsigned int len = sizeof(size);
        const int rc = ::setsockopt(_fd, SOL_SOCKET, SO_RCVBUF, &size, len);
        return (rc == 0);
    }

    /// Gets the actual receive buffer size in bytes, -1 on error.
    int getReceiveBufferSize() const
    {
        int size;
        unsigned int len = sizeof(size);
        const int rc = ::getsockopt(_fd, SOL_SOCKET, SO_RCVBUF, &size, &len);
        return (rc == 0 ? size : -1);
    }

    /// Gets the error code.
    /// Sets errno on success and returns it.
    /// Returns -1 on failure to get the error code.
    int getError() const
    {
        int error;
        unsigned int len = sizeof(error);
        const int rc = ::getsockopt(_fd, SOL_SOCKET, SO_ERROR, &error, &len);
        if (rc == 0)
        {
            // Set errno so client can use strerror etc.
            errno = error;
            return error;
        }

        return rc;
    }

    /// Connect to a server address.
    /// Does not retry on error.
    /// Returns true on success only.
    bool connect(const SocketAddress& address)
    {
        const int rc = ::connect(_fd, address.addr(), address.length());
        return (rc == 0);
    }

    /// Binds to a local address (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool bind(const SocketAddress& address)
    {
        // Enable address reuse to avoid stalling after
        // recycling, when previous socket is TIME_WAIT.
        //TODO: Might be worth refactoring out.
        const int reuseAddress = 1;
        constexpr unsigned int len = sizeof(reuseAddress);
        ::setsockopt(_fd, SOL_SOCKET, SO_REUSEADDR, &reuseAddress, len);

        const int rc = ::bind(_fd, address.addr(), address.length());
        return (rc == 0);
    }

    /// Listen to incoming connections (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool listen(const int backlog = 64)
    {
        const int rc = ::listen(_fd, backlog);
        return (rc == 0);
    }

    /// Accepts an incoming connection (Servers only).
    /// Does not retry on error.
    /// Returns a valid Socket shared_ptr on success only.
    std::shared_ptr<Socket> accept()
    {
        // Accept a connection (if any) and set it to non-blocking.
        // We don't care about the client's address, so ignored.
        const int rc = ::accept4(_fd, nullptr, nullptr, SOCK_NONBLOCK);
        return std::shared_ptr<Socket>(rc != -1 ? new Socket(rc) : nullptr);
    }

    /// Send data to our peer.
    /// Returns the number of bytes sent, -1 on error.
    int send(const void* buf, const size_t len)
    {
        // Don't SIGPIPE when the other end closes.
        const int rc = ::send(_fd, buf, len, MSG_NOSIGNAL);
        return rc;
    }

    /// Receive data from our peer.
    /// Returns the number of bytes received, -1 on error,
    /// and 0 when the peer has performed an orderly shutdown.
    int recv(void* buf, const size_t len)
    {
        const int rc = ::recv(_fd, buf, len, 0);
        return rc;
    }

    /// Poll the socket for either read, write, or both.
    /// Returns -1 on failure/error (query socket error), 0 for timeout,
    /// otherwise, depending on events, the respective bits set.
    int poll(const int timeoutMs, const int events = POLLIN | POLLOUT)
    {
        // Use poll(2) as it has lower overhead for up to
        // a few hundred sockets compared to epoll(2).
        // Also it has a more intuitive API and portable.
        pollfd poll;
        memset(&poll, 0, sizeof(poll));

        poll.fd = _fd;
        poll.events |= events;

        int rc;
        do
        {
            // Technically, on retrying we should wait
            // the _remaining_ time, alas simplicity wins.
            rc = ::poll(&poll, 1, timeoutMs);
        }
        while (rc < 0 && errno == EINTR);

        if (rc <= 0)
        {
            return rc;
        }

        int revents = 0;
        if (rc == 1)
        {
            if (poll.revents & (POLLERR|POLLHUP|POLLNVAL))
            {
                // Probe socket for error.
                return -1;
            }

            if (poll.revents & (POLLIN|POLLPRI))
            {
                // Data ready to read.
                revents |= POLLIN;
            }

            if (poll.revents & POLLOUT)
            {
                // Ready for write.
                revents |= POLLOUT;
            }
        }

        return revents;
    }

    /// Poll the socket for readability.
    /// Returns true when there is data to read, otherwise false.
    bool pollRead(const int timeoutMs)
    {
        const int rc = poll(timeoutMs, POLLIN);
        return (rc > 0 && (rc & POLLIN));
    }

    /// Poll the socket for writability.
    /// Returns true when socket is ready for writing, otherwise false.
    bool pollWrite(const int timeoutMs)
    {
        const int rc = poll(timeoutMs, POLLOUT);
        return (rc > 0 && (rc & POLLOUT));
    }

private:

    /// Construct based on an existing socket fd.
    /// Used by accept() only.
    Socket(const int fd) :
        _fd(fd)
    {
    }

private:
    const int _fd;
};

int main(int argc, const char**)
{
    SocketAddress addr("127.0.0.1", PortNumber);

    if (argc > 1)
    {
        // Client.
        Socket client;
        if (!client.connect(addr) && errno != EINPROGRESS)
        {
            const std::string msg = "Failed to call connect. (errno: ";
            throw std::runtime_error(msg + std::strerror(errno) + ")");
        }

        if (errno == EINPROGRESS && !client.pollWrite(5000))
        {
            client.getError();
            const std::string msg = "Failed to poll/connect. (errno: ";
            throw std::runtime_error(msg + std::strerror(errno) + ")");
        }

        // Now check if we connected or not.
        const int rc = client.getError();
        if (rc == -1)
        {
            const std::string msg = "Failed to get socket error. (errno: ";
            throw std::runtime_error(msg + std::strerror(errno) + ")");
        }

        if (rc != 0)
        {
            const std::string msg = "Failed to connect. (errno: ";
            throw std::runtime_error(msg + std::strerror(errno) + ")");
        }

        std::cout << "Connected" << std::endl;

        if (client.pollRead(5000))
        {
            char buf[1024];
            const int recv = client.recv(buf, sizeof(buf));

            std::cout << "Received " << recv << " bytes" << std::endl;
            if (recv <= 0)
            {
                perror("send");
            }
            else
            {
                std::cout << std::string(buf, recv);
            }
        }

        return 0;
    }

    // Start server.
    auto server = std::make_shared<Socket>();
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

    server->pollRead(15000);

    std::shared_ptr<Socket> clientSocket = server->accept();
    if (!clientSocket)
    {
        const std::string msg = "Failed to accept. (errno: ";
        throw std::runtime_error(msg + std::strerror(errno) + ")");
    }

    std::cout << "Accepted." << std::endl;

    const std::string msg = "Hello from non-blocking server!\nBye\n";
    const int sent = clientSocket->send(msg.data(), msg.size());

    std::cout << "Sent " << sent << " bytes of " << msg.size() << std::endl;
    if (sent != (int)msg.size())
    {
        perror("send");
    }

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
