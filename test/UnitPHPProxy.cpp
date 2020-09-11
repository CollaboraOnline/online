/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
    road path:
        * cypress test => php server => loolwsd
        * loolwsd => php server => cypress test
*/

#include <memory>
#include <ostream>
#include <set>
#include <string>

#include <Poco/Exception.h>
#include <Poco/RegularExpression.h>
#include <Poco/URI.h>
#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <helpers.hpp>
#include "net/ServerSocket.hpp"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <poll.h>
#include <LOOLWSD.hpp>

#define _PORT_ 9979

const int bufferSize = 16 * 1024;
std::atomic<int64_t> lastRequestMS;

class SocketThread
{
public:
    const std::string _proxyPrefix = "ProxyPrefix: http://localhost:" + std::to_string(_PORT_) + "/proxytest.php?req=\n";

    void replaceRequest(std::vector<char>& message)
    {
        // First line includes the request. We will remove proxy prefix && get real request.
        std::vector<char>::iterator firstLineEnd = std::find(message.begin(), message.end(), '\n');
        std::string firstLine(message.begin(), firstLineEnd);
        std::vector<char>::iterator firstSpace = std::find(message.begin(), firstLineEnd, ' '); // Position of first space char.
        std::string request = Util::splitStringToVector(firstLine, ' ')[1]; // First line's format is: METHOD (space) REQUEST (space) HTPP_VERSION

        if (request.find("proxytest.php?req=") != std::string::npos)
        {
            // We have a proper proxy request.
            std::vector<char>::iterator equalSign = std::find(firstSpace + 1, firstLineEnd, '='); // Position of first '=' sign.
            if (equalSign != firstLineEnd)
            {
                // Remove chars from first space until '=' sign (including '=' sign).
                // So we remove "http://localhost:_PORT_/proxytest.php?req=" and get the real request.
                for (std::vector<char>::iterator it = equalSign; it > firstSpace; it--)
                {
                    message.erase(it);
                }
            }
        }
        else
        {
            // We don't have a proper request. Since we are testing, we will accept this one.
            // We will remove only "http://localhost:_PORT_"
            std::vector<char>::iterator portNumberLastChar = std::find(firstSpace + 1, firstLineEnd, '9'); // Position of first char of the port number.
            if (portNumberLastChar != firstLineEnd)
            {
                portNumberLastChar = std::next(portNumberLastChar, 3); // We move it position to the last char of the port number.

                for (std::vector<char>::iterator it = portNumberLastChar; it > firstSpace; it--) // Erase including the last char.
                {
                    message.erase(it);
                }
            }
            else
            {
                LOG_ERR("We could not find the port number's char.");
            }
        }
    }
    void addProxyHeader(std::vector<char>& message)
    {
        std::vector<char>::iterator it = std::find(message.begin(), message.end(), '\n');

        // Found the first line break. We will paste the prefix on the second line.
        if (it == message.end())
        {
            message.insert(it, _proxyPrefix.data(), &_proxyPrefix.data()[_proxyPrefix.size()]);
        }
        else
        {
            message.insert(it + 1, _proxyPrefix.data(), &_proxyPrefix.data()[_proxyPrefix.size()]);
        }
    }
    bool sendMessage(int socketFD, std::vector<char>& message)
    {
        int res;
        std::size_t wroteLen = 0;
        do
        {
            res = send(socketFD, &message[wroteLen], (wroteLen + bufferSize < message.size() ? bufferSize: message.size() - wroteLen), MSG_NOSIGNAL);
            wroteLen += bufferSize;
        }
        while (wroteLen < message.size() && res > 0);
        return res > 0;
    }
    bool readMessage(int socketFD, std::vector<char>& inBuffer)
    {
        char buf[16 * 1024];
        ssize_t len;
        do
        {
            do
            {
                len = recv(socketFD, buf, sizeof(buf), 0);
            }
            while (len < 0 && errno == EINTR);

            if (len > 0)
            {
                inBuffer.insert(inBuffer.end(), &buf[0], &buf[len]);
            }
        }
        while (len == (sizeof(buf)));
        return len > 0;
    }
    void handleRegularSocket(std::shared_ptr<StreamSocket> socket)
    {
        socket->setThreadOwner(std::this_thread::get_id());

        replaceRequest(socket->getInBuffer());
        addProxyHeader(socket->getInBuffer());

        int loolSocket = helpers::connectToLocalServer(LOOLWSD::getClientPortNumber(), 1000, true); // Create a socket for loolwsd.
        if (loolSocket > 0)
        {
            sendMessage(loolSocket, socket->getInBuffer());
            std::vector<char> buffer;
            while(readMessage(loolSocket, buffer)){};
            socket->send(buffer.data(), buffer.size()); // Send the response to client.
            close(loolSocket);
        }
        socket->closeConnection(); // Close client socket.
    }
    static void startThread(std::shared_ptr<StreamSocket> socket)
    {
        SocketThread worker;
        // Set socket's option to blocking mode.
        helpers::setSocketBlockingMode(socket->getFD(), true);

        std::thread regularSocketThread(&SocketThread::handleRegularSocket, worker, socket);
        regularSocketThread.detach();
    }
};

class PHPClientRequestHandler: public SimpleSocketHandler
{
private:
    std::weak_ptr<StreamSocket> _socket;

public:
    PHPClientRequestHandler()
    {
    }

private:
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _socket = socket;
    }
    int getPollEvents(std::chrono::steady_clock::time_point /* now */, int64_t & /* timeoutMaxMs */) override
    {
        return POLLIN;
    }
    void performWrites() override
    {
    }

    void handleIncomingMessage(SocketDisposition& disposition) override
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        disposition.setMove([=] (const std::shared_ptr<Socket> &moveSocket)
        {
            moveSocket->setThreadOwner(std::thread::id(0));
            SocketThread::startThread(socket);
        });
    }
};

class PHPServerSocketFactory final : public SocketFactory
{
public:
    PHPServerSocketFactory()
    {
    }

    std::shared_ptr<Socket> create(const int physicalFd) override
    {
        // This socket is test's client.
        std::shared_ptr<Socket> socket = StreamSocket::create<StreamSocket>(physicalFd, false, std::make_shared<PHPClientRequestHandler>());
        lastRequestMS = Util::getNowInMS();
        return socket;
    }
};

class UnitPHPProxy : public UnitWSD
{
private:
    std::shared_ptr<SocketPoll> _poll;

public:
    UnitPHPProxy()
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);
        config.setBool("ssl.enable", false);
        config.setBool("net.proxy_prefix", true);
    }

    void invokeTest() override
    {
        try
        {
            _poll = std::make_shared<SocketPoll>("php client poll");
            _poll->startThread();
            ServerSocket::Type clientPortProto = ServerSocket::Type::Public;
            Socket::Type sType = Socket::Type::IPv4;
            std::shared_ptr<SocketFactory> factory = std::make_shared<PHPServerSocketFactory>();
            std::shared_ptr<ServerSocket> _serverSocket = std::make_shared<ServerSocket>(sType, *_poll, factory);
            _serverSocket->bind(clientPortProto, _PORT_);
            _serverSocket->listen(10);
            _poll->insertNewSocket(_serverSocket);

            lastRequestMS = Util::getNowInMS();
            int64_t diff = 0;
            while (diff < 600000)
            {
                auto nowMS = Util::getNowInMS();
                diff = nowMS - lastRequestMS;
            }

            _poll->joinThread();

            exitTest(UnitBase::TestResult::Ok);
        }
        catch(const std::exception& e)
        {
            std::cerr << e.what() << '\n';
            exitTest(UnitBase::TestResult::Failed);
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitPHPProxy(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
