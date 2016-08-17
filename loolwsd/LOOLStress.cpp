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
#include <chrono>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <random>
#include <thread>

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

    static bool NoDelay;
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

/// Connection class with WSD.
class Connection
{
public:
    static
    std::unique_ptr<Connection> create(const std::string& serverURI, const std::string& documentURL, const std::string& sessionId)
    {
        Poco::URI uri(serverURI);

        // Load a document and get its status.
        std::cerr << "NewSession [" << sessionId << "]: " << uri.toString() << "... ";
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, "/lool/ws/" + documentURL);
        Poco::Net::HTTPResponse response;
        auto ws = helpers::connectLOKit(uri, request, response, "loolStress ");
        std::cerr << "Connected.\n";
        return std::unique_ptr<Connection>(new Connection(documentURL, sessionId, ws));
    }

    void send(const std::string& data) const
    {
        helpers::sendTextFrame(_ws, data, "loolstress ");
    }

private:
    Connection(const std::string& documentURL, const std::string& sessionId, std::shared_ptr<Poco::Net::WebSocket>& ws) :
        _documentURL(documentURL),
        _sessionId(sessionId),
        _ws(ws)
    {
    }

private:
    const std::string _documentURL;
    const std::string _sessionId;
    std::shared_ptr<Poco::Net::WebSocket> _ws;
};

/// Main thread class to replay a trace file.
class Worker: public Runnable
{
public:

    Worker(Stress& app, const std::string& traceFilePath) :
        _app(app),
        _traceFile(traceFilePath)
    {
    }

    void run() override
    {
        try
        {
            doRun();
        }
        catch (const Poco::Exception &e)
        {
            std::cerr << "Error: " << e.name() << ' '
                      << e.message() << std::endl;
        }
    }

private:

    void doRun()
    {
        auto epochFile(_traceFile.getEpoch());
        auto epochCurrent(std::chrono::steady_clock::now());
        for (;;)
        {
            const auto rec = _traceFile.getNextRecord();
            if (rec.Dir == TraceFileRecord::Direction::Invalid)
            {
                // End of trace file.
                break;
            }

            const auto deltaCurrent = std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - epochCurrent).count();
            const auto deltaFile = rec.TimestampNs - epochFile;
            const auto delay = (Stress::NoDelay ? 0 : deltaFile - deltaCurrent);
            if (delay > 0)
            {
                if (delay > 1e6)
                {
                    std::cerr << "Sleeping for " << delay / 1000 << " ms.\n";
                }

                std::this_thread::sleep_for(std::chrono::microseconds(delay));
            }

            if (rec.Dir == TraceFileRecord::Direction::Event)
            {
                // Meta info about about an event.
                static const std::string NewSession("NewSession: ");
                static const std::string EndSession("EndSession: ");

                if (rec.Payload.find(NewSession) == 0)
                {
                    const auto& uri = rec.Payload.substr(NewSession.size());
                    auto it = Sessions.find(uri);
                    if (it != Sessions.end())
                    {
                        // Add a new session.
                        if (it->second.find(rec.SessionId) != it->second.end())
                        {
                            std::cerr << "ERROR: session [" << rec.SessionId << "] already exists on doc [" << uri << "]\n";
                        }
                        else
                        {
                            it->second.emplace(rec.SessionId, Connection::create(_app._serverURI, uri, rec.SessionId));
                        }
                    }
                    else
                    {
                        std::cerr << "New Document: " << uri << "\n";
                        ChildToDoc.emplace(rec.Pid, uri);
                        Sessions[uri].emplace(rec.SessionId, Connection::create(_app._serverURI, uri, rec.SessionId));
                    }
                }
                else if (rec.Payload.find(EndSession) == 0)
                {
                    const auto& uri = rec.Payload.substr(EndSession.size());
                    auto it = Sessions.find(uri);
                    if (it != Sessions.end())
                    {
                        std::cerr << "EndSession [" << rec.SessionId << "]: " << uri << "\n";

                        it->second.erase(rec.SessionId);
                        if (it->second.empty())
                        {
                            std::cerr << "End Doc [" << uri << "].\n";
                            Sessions.erase(it);
                            ChildToDoc.erase(rec.Pid);
                        }
                    }
                    else
                    {
                        std::cerr << "ERROR: Doc [" << uri << "] does not exist.\n";
                    }
                }
            }
            else if (rec.Dir == TraceFileRecord::Direction::Incoming)
            {
                auto docIt = ChildToDoc.find(rec.Pid);
                if (docIt != ChildToDoc.end())
                {
                    const auto& uri = docIt->second;
                    auto it = Sessions.find(uri);
                    if (it != Sessions.end())
                    {
                        const auto sessionIt = it->second.find(rec.SessionId);
                        if (sessionIt != it->second.end())
                        {
                            sessionIt->second->send(rec.Payload);
                        }
                    }
                    else
                    {
                        std::cerr << "ERROR: Doc [" << uri << "] does not exist.\n";
                    }
                }
                else
                {
                    std::cerr << "ERROR: Unknown PID [" << rec.Pid << "] maps to no active document.\n";
                }
            }

            epochCurrent = std::chrono::steady_clock::now();
            epochFile = rec.TimestampNs;
        }
    }

private:
    Stress& _app;
    TraceFileReader _traceFile;

    /// LOK child process PID to Doc URI map.
    std::map<unsigned, std::string> ChildToDoc;

    /// Doc URI to Sessions map. Sessions are maps of SessionID to Connection.
    std::map<std::string, std::map<std::string, std::unique_ptr<Connection>>> Sessions;
};

bool Stress::NoDelay = false;

Stress::Stress() :
    _numClients(1),
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
    optionSet.addOption(Option("nodelay", "", "Replay at full speed disregarding original timing.")
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
    else if (optionName == "nodelay")
        Stress::NoDelay = true;
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

    if (args.size() == 0)
    {
        std::cerr << "Usage: loolstress <tracefile> " << std::endl;
        std::cerr << "       Trace files may be plain text or gzipped (with .gz extension)." << std::endl;
        std::cerr << "       --help for full arguments list." << std::endl;
        return Application::EXIT_NOINPUT;
    }

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
