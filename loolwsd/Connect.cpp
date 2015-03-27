/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <iostream>

#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/SocketStream.h>
#include <Poco/Net/StreamSocket.h>
#include <Poco/Net/TCPServer.h>
#include <Poco/Net/TCPServerConnection.h>
#include <Poco/Net/TCPServerConnectionFactory.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Process.h>
#include <Poco/String.h>
#include <Poco/Thread.h>
#include <Poco/URI.h>
#include <Poco/Util/Application.h>
#include <Poco/Util/HelpFormatter.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionSet.h>

#include "LOOLProtocol.hpp"
#include "LOOLWSD.hpp"
#include "Util.hpp"

using namespace LOOLProtocol;

using Poco::Net::HTTPClientSession;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Net::Socket;
using Poco::Net::SocketOutputStream;
using Poco::Net::StreamSocket;
using Poco::Net::TCPServer;
using Poco::Net::TCPServerConnection;
using Poco::Net::WebSocket;
using Poco::Net::WebSocketException;
using Poco::Runnable;
using Poco::Thread;
using Poco::URI;
using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::Option;
using Poco::Util::OptionSet;

class Output: public Runnable
{
public:
    Output(WebSocket& ws) :
        _ws(ws)
    {
    }

    void run() override
    {
        int flags;
        int n;
        try
        {
            do
            {
                char buffer[100000];
                n = _ws.receiveFrame(buffer, sizeof(buffer), flags);

                if (n > 0 && (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE)
                {
                    char *endl = (char *) memchr(buffer, '\n', n);
                    std::string response;
                    if (endl == nullptr)
                        response = std::string(buffer, n);
                    else
                        response = std::string(buffer, endl-buffer);
                    std::cout <<
                        "Got " << n << " bytes: '" << response << "'" <<
                        (endl == nullptr ? "" : " ...") <<
                        std::endl;
                }
            }
            while (n > 0 && (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE);
        }
        catch (WebSocketException& exc)
        {
            _ws.close();
        }
    }

    WebSocket& _ws;

};

class Connect: public Poco::Util::Application
{
public:
    Connect() :
        _uri("http://localhost:" + std::to_string(LOOLWSD::DEFAULT_PORT_NUMBER) + "/ws")
    {
    }

    ~Connect()
    {
    }

protected:
    int main(const std::vector<std::string>& args) override
    {
        HTTPClientSession cs(_uri.getHost(), _uri.getPort());
        HTTPRequest request(HTTPRequest::HTTP_GET, "/ws");
        HTTPResponse response;
        WebSocket ws(cs, request, response);

        ws.setReceiveTimeout(0);

        Thread thread;
        Output output(ws);
        thread.start(output);

        while (!std::cin.eof())
        {
            std::string line;
            std::getline(std::cin, line);
            ws.sendFrame(line.c_str(), line.size());
        }

        thread.join();

        return Application::EXIT_OK;
    }

private:
    URI _uri;
};

POCO_APP_MAIN(Connect)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
