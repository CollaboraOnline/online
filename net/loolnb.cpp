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
    Socket()
    {
        // For now ipv4 only.
        _fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0);

        //FIXME: process must ignore or handle SIGPIPE.
    }

    ~Socket()
    {
        //TODO: Should we shutdown here or up to the client?

        // Doesn't block on sockets; no error handling needed.
        close(_fd);
    }

    int fd() const { return _fd; }

    void setSendBufferSize(const int size)
    {
        constexpr unsigned int len = sizeof(size);
        const int rc = ::setsockopt(_fd, SOL_SOCKET, SO_SNDBUF, &size, len);
        if (rc == -1)
        {
            const std::string msg = "Failed to get socket send buffer size. (errno: ";
            throw std::runtime_error(msg + std::strerror(errno) + ")");
        }
    }

    int getSendBufferSize() const
    {
        int size;
        unsigned int len = sizeof(size);
        const int rc = ::getsockopt(_fd, SOL_SOCKET, SO_SNDBUF, &size, &len);
        if (rc == -1)
        {
            const std::string msg = "Failed to get socket send buffer size. (errno: ";
            throw std::runtime_error(msg + std::strerror(errno) + ")");
        }

        return size;
    }

    void setReceiveBufferSize(const int size)
    {
        constexpr unsigned int len = sizeof(size);
        const int rc = ::setsockopt(_fd, SOL_SOCKET, SO_RCVBUF, &size, len);
        if (rc == -1)
        {
            const std::string msg = "Failed to get socket receive buffer size. (errno: ";
            throw std::runtime_error(msg + std::strerror(errno) + ")");
        }
    }

    int getReceiveBufferSize() const
    {
        int size;
        unsigned int len = sizeof(size);
        const int rc = ::getsockopt(_fd, SOL_SOCKET, SO_RCVBUF, &size, &len);
        if (rc == -1)
        {
            const std::string msg = "Failed to get socket receive buffer size. (errno: ";
            throw std::runtime_error(msg + std::strerror(errno) + ")");
        }

        return size;
    }

    /// Connect to a server address.
    /// Does not retry on error.
    /// Returns true on success only.
    bool connect(const SocketAddress& address)
    {
        const int rc = ::connect(_fd, address.addr(), address.length());
        return rc != -1;
    }

    /// Binds to a local address (Servers only).
    /// Does not retry on error.
    /// Returns true on success only.
    bool bind(const SocketAddress& address)
    {
        const int rc = ::bind(_fd, address.addr(), address.length());
        return rc != -1;
    }

private:
    int _fd;
};

int main()
{
    SocketAddress addr("127.0.0.1", PortNumber);

    // Start server.
    Socket server;
    if (!server.bind(addr))
    {
        const std::string msg = "Failed to bind. (errno: ";
        throw std::runtime_error(msg + std::strerror(errno) + ")");
    }

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
