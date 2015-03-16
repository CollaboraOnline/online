/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <unistd.h>

#include <iostream>

#include <Poco/Net/ServerSocket.h>
#include <Poco/Net/SocketAddress.h>
#include <Poco/Net/SocketStream.h>
#include <Poco/Net/StreamSocket.h>
#include <Poco/Net/TCPServer.h>
#include <Poco/Net/TCPServerConnection.h>
#include <Poco/Net/TCPServerConnectionFactory.h>
#include <Poco/Process.h>
#include <Poco/Timespan.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>

#include "MigratorySocket.hpp"
#include "MigratorySocketTransport.hpp"

using Poco::Net::ServerSocket;
using Poco::Net::Socket;
using Poco::Net::SocketAddress;
using Poco::Net::SocketOutputStream;
using Poco::Net::StreamSocket;
using Poco::Net::TCPServer;
using Poco::Net::TCPServerConnection;
using Poco::Process;
using Poco::ProcessHandle;
using Poco::Runnable;
using Poco::Thread;
using Poco::Timespan;
using Poco::Util::Application;
using Poco::Util::Option;
using Poco::Util::OptionSet;
using Poco::Util::ServerApplication;

class EchoConnection : public TCPServerConnection
{
public:
    EchoConnection(const StreamSocket& socket, MigratorySocketTransport& transport) :
        TCPServerConnection(socket),
        _transport(transport)
    {
    }

    void run() override
    {
        StreamSocket& ss = socket();
        SocketOutputStream(ss) << "Connected to thread " << Thread::current()->id() << ". Enter lines to be echoed. End with an empty line." << std::endl;

        _transport.send(MigratorySocket(ss));
        Thread::sleep(10000);
    }

private:
    MigratorySocketTransport _transport;
};

class ServerConnectionFactory : public Poco::Net::TCPServerConnectionFactory
{
public:
    ServerConnectionFactory(MigratorySocketTransport& transport) :
        _transport(transport)
    {
    };

	virtual TCPServerConnection* createConnection(const StreamSocket& socket) override
    {
        return new EchoConnection(socket, _transport);
    }

private:
    MigratorySocketTransport _transport;
};

namespace
{
#if 0
    while (true)
        {
			try
			{
				char buffer[256];
				int n = ss.receiveBytes(buffer, sizeof(buffer));
                std::cout << "Got " << n << " bytes" << std::endl;
                if (n == 2 && buffer[0] == '\r' && buffer[1] == '\n')
                    break;
                ss.sendBytes(buffer, n);
			}
			catch (Poco::Exception& exc)
			{
				std::cerr << "ServerConnection: " << exc.displayText() << std::endl;
			}
        }
#endif

    void ChildProcess(MigratorySocketTransport transport)
    {
        while (true)
        {
            if (transport.poll(Timespan::DAYS, Socket::SELECT_READ))
            {
                std::cout << "New socket incoming" << std::endl;
                MigratorySocket socket(transport.receive());
            }
        }
    }
}

class SocketTransportTest: public Poco::Util::ServerApplication
{
    void defineOptions(OptionSet& options) override
    {
        ServerApplication::defineOptions(options);

        options.addOption(
            Option("child", "", "when invoking the child from the parent")
                .required(false)
                .repeatable(false));
    }

    int main(const std::vector<std::string>& args) override
    {
        MigratorySocketTransport transport(MigratorySocketTransport::create());
    
#if 0
        // Let' leave testing this until we need that functionality
        Process::Args kidArgs;
        kidArgs.push_back("--child");
        kidArgs.push_back(transport.string());
    
        ProcessHandle kid = Process::launch("./sockettransporttest", kidArgs);
#endif

        pid_t pid = fork();
        if (pid == 0)
        {
            MigratorySocketTransport kidEndOfTransport(transport.string());
            transport.close(); // Closes the parent end

            ChildProcess(kidEndOfTransport);
            exit(0);
        }

        TCPServer srv(new ServerConnectionFactory(transport));

        std::cout <<
            "Server listening on port " << srv.socket().address().port() << "." << std::endl <<
            "Please connect to it with one or more telnet sessions." << std::endl;

        srv.start();

        waitForTerminationRequest();

        srv.stop();

        return Application::EXIT_OK;
    }
};

POCO_SERVER_MAIN(SocketTransportTest)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
