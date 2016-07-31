/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <unistd.h>

#include <algorithm>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <random>

#include <Poco/Net/NetException.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>
#include <Poco/Process.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Thread.h>
#include <Poco/Timespan.h>
#include <Poco/Timestamp.h>
#include <Poco/URI.h>
#include <Poco/Util/Application.h>
#include <Poco/Util/HelpFormatter.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionSet.h>

#include <Poco/Util/Application.h>
#include <Poco/Util/OptionSet.h>

#include "Common.hpp"
#include "LOOLProtocol.hpp"
#include "TraceFile.hpp"
#include "Util.hpp"
#include "test/helpers.hpp"

/// Stress testing and performance/scalability benchmarking tool.

class Stress: public Poco::Util::Application
{
public:
    Stress();
    ~Stress() {}

    unsigned    _numClients;
    std::string _serverURI;

protected:
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
    int  main(const std::vector<std::string>& args) override;
};


using namespace LOOLProtocol;

using Poco::Net::HTTPClientSession;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Runnable;
using Poco::Thread;
using Poco::URI;
using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::Option;
using Poco::Util::OptionSet;

class Worker: public Runnable
{
public:

    Worker(Stress& app, const std::string& traceFilePath) :
        _app(app), _traceFile(traceFilePath)
    {
    }

    void run() override
    {
        _traceFile.readFile();

        std::cerr << "Connecting to server: " << _app._serverURI << "\n";

        Poco::URI uri(_app._serverURI);

        const auto documentURL = "lool/ws/file://" + Poco::Path(_traceFilePath).makeAbsolute().toString();

        std::unique_ptr<Poco::Net::HTTPClientSession> session;
        if (_app._serverURI.compare(0, 5, "https"))
            session.reset(new Poco::Net::HTTPSClientSession(uri.getHost(), uri.getPort()));
        else
            session.reset(new Poco::Net::HTTPClientSession(uri.getHost(), uri.getPort()));

        try
        {

        }
        catch (const Poco::Exception &e)
        {
            std::cerr << "Failed to write data: " << e.name() <<
                  " " << e.message() << "\n";
            return;
        }
    }

private:
    Stress& _app;
    TraceFileReader _traceFile;
};

Stress::Stress() :
    _numClients(4),
#if ENABLE_SSL
    _serverURI("https://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER))
#else
    _serverURI("http://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER))
#endif
{
}

void Stress::defineOptions(OptionSet& optionSet)
{
    Application::defineOptions(optionSet);

    optionSet.addOption(Option("help", "", "Display help information on command line arguments.")
                        .required(false).repeatable(false));
    optionSet.addOption(Option("clientsperdoc", "", "Number of simultaneous clients on each doc.")
                        .required(false).repeatable(false)
                        .argument("concurrency"));
    optionSet.addOption(Option("server", "", "URI of LOOL server")
                        .required(false).repeatable(false)
                        .argument("uri"));
}

void Stress::handleOption(const std::string& optionName,
                        const std::string& value)
{
    Application::handleOption(optionName, value);

    if (optionName == "help")
    {
        HelpFormatter helpFormatter(options());

        helpFormatter.setCommand(commandName());
        helpFormatter.setUsage("OPTIONS");
        helpFormatter.setHeader("LibreOffice On-Line tool.");
        helpFormatter.format(std::cout);
        std::exit(Application::EXIT_OK);
    }
    else if (optionName == "clientsperdoc")
        _numClients = std::max(std::stoi(value), 1);
    else if (optionName == "server")
        _serverURI = value;
    else
    {
        std::cerr << "Unknown option: " << optionName << std::endl;
        exit(1);
    }
}

int Stress::main(const std::vector<std::string>& args)
{
    std::vector<std::unique_ptr<Thread>> clients(_numClients * args.size());

    std::cout << "Args: " << args.size() << std::endl;

    unsigned index = 0;
    for (unsigned i = 0; i < args.size(); ++i)
    {
        std::cout << "Arg: " << args[i] << std::endl;
        for (unsigned j = 0; j < _numClients; ++j, ++index)
        {
            clients[index].reset(new Thread());
            clients[index]->start(*(new Worker(*this, args[i])));
        }
    }

    for (const auto& client : clients)
    {
        client->join();
    }

    return Application::EXIT_OK;
}

POCO_APP_MAIN(Stress)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
