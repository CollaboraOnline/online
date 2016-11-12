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

#include "TraceFile.hpp"
#include "test/helpers.hpp"

/// Stress testing and performance/scalability benchmarking tool.
class Stress: public Poco::Util::Application
{
public:
    Stress();
    ~Stress() {}

    static bool Benchmark;
    static size_t Iterations;
    static bool NoDelay;
    unsigned _numClients;
    std::string _serverURI;

protected:
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
    int  main(const std::vector<std::string>& args) override;
};

using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Runnable;
using Poco::Thread;
using Poco::URI;
using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::Option;
using Poco::Util::OptionSet;

long percentile(std::vector<long>& v, const double percentile)
{
    std::sort(v.begin(), v.end());

    const auto N = v.size();
    const double n = (N - 1) * percentile / 100.0 + 1;
    if (n <= 1)
    {
        return v[0];
    }
    else if (n >= N)
    {
        return v[N - 1];
    }

    const auto k = static_cast<int>(n);
    const double d = n - k;
    return v[k - 1] + d * (v[k] - v[k - 1]);
}

/// Connection class with WSD.
class Connection
{
public:
    static
    std::shared_ptr<Connection> create(const std::string& serverURI, const std::string& documentURL, const std::string& sessionId)
    {
        Poco::URI uri(serverURI);

        std::unique_lock<std::mutex> lock(Mutex);

        // Load a document and get its status.
        std::cout << "NewSession [" << sessionId << "]: " << uri.toString() << "... ";

        std::string encodedUri;
        Poco::URI::encode(documentURL, ":/?", encodedUri);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, "/lool/" + encodedUri + "/ws");
        Poco::Net::HTTPResponse response;
        auto ws = helpers::connectLOKit(uri, request, response, sessionId + ' ');
        std::cout << "Connected.\n";
        return std::shared_ptr<Connection>(new Connection(documentURL, sessionId, ws));
    }

    const std::string& getName() const { return _name; }
    std::shared_ptr<LOOLWebSocket> getWS() const { return _ws; };

    /// Send a command to the server.
    void send(const std::string& data) const
    {
        helpers::sendTextFrame(_ws, data, _name);
    }

    /// Poll socket until expected prefix is fetched, or timeout.
    std::vector<char> recv(const std::string& prefix)
    {
        return helpers::getResponseMessage(_ws, prefix, _name);
    }

    /// Request loading the document and wait for completion.
    bool load()
    {
        send("load url=" + _documentURL);
        return helpers::isDocumentLoaded(_ws, _name);
    }

private:
    Connection(const std::string& documentURL, const std::string& sessionId, std::shared_ptr<LOOLWebSocket>& ws) :
        _documentURL(documentURL),
        _sessionId(sessionId),
        _name(sessionId + ' '),
        _ws(ws)
    {
    }

private:
    const std::string _documentURL;
    const std::string _sessionId;
    const std::string _name;
    std::shared_ptr<LOOLWebSocket> _ws;
    static std::mutex Mutex;
};

std::mutex Connection::Mutex;

//static constexpr auto FIRST_ROW_TILES = "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840";
static constexpr auto FIRST_PAGE_TILES = "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520,0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840,7680,7680,7680,7680,11520,11520,11520,11520 tilewidth=3840 tileheight=3840";
static constexpr auto FIRST_PAGE_TILE_COUNT = 16;

/// Main thread class to replay a trace file.
class Worker: public Runnable
{
public:

    Worker(Stress& app, const std::string& uri) :
        _app(app),
        _uri(uri)
    {
    }

    std::vector<long> getLatencyStats() const { return _latencyStats; }
    std::vector<long> getRenderingStats() const { return _renderingStats; }
    std::vector<long> getCacheStats() const { return _cacheStats; }

    void run() override
    {
        try
        {
            if (Stress::Benchmark)
            {
                benchmark();
            }
            else
            {
                replay();
            }
        }
        catch (const Poco::Exception &e)
        {
            std::cout << "Error: " << e.name() << ' '
                      << e.message() << std::endl;
        }
        catch (const std::exception &e)
        {
            std::cout << "Error: " << e.what() << std::endl;
        }
    }

private:

    bool modifyDoc(const std::shared_ptr<Connection>& con)
    {
        const auto startModify = std::chrono::steady_clock::now();

        con->send("key type=input char=97 key=0");   // a
        //con->send("key type=input char=0 key=1283"); // backspace
        const bool success = !con->recv("invalidatetiles:").empty();

        const auto now = std::chrono::steady_clock::now();
        const auto deltaModify = std::chrono::duration_cast<std::chrono::microseconds>(now - startModify).count();
        _latencyStats.push_back(deltaModify);

        return success;
    }

    bool renderTile(const std::shared_ptr<Connection>& con)
    {
        modifyDoc(con);

        const auto start = std::chrono::steady_clock::now();

        const auto expectedTilesCount = FIRST_PAGE_TILE_COUNT;
        con->send(FIRST_PAGE_TILES);
        for (int i = 0; i < expectedTilesCount; ++i)
        {
            if (helpers::getTileMessage(*con->getWS(), con->getName()).empty())
            {
                return false;
            }
        }

        const auto now = std::chrono::steady_clock::now();
        const auto delta = std::chrono::duration_cast<std::chrono::microseconds>(now - start).count();
        _renderingStats.push_back(delta / expectedTilesCount);

        return true;
    }

    bool fetchCachedTile(const std::shared_ptr<Connection>& con)
    {
        const auto start = std::chrono::steady_clock::now();

        const auto expectedTilesCount = FIRST_PAGE_TILE_COUNT;
        con->send(FIRST_PAGE_TILES);
        for (int i = 0; i < expectedTilesCount; ++i)
        {
            if (helpers::getTileMessage(*con->getWS(), con->getName()).empty())
            {
                return false;
            }
        }

        const auto now = std::chrono::steady_clock::now();
        const auto delta = std::chrono::duration_cast<std::chrono::microseconds>(now - start).count();
        _cacheStats.push_back(delta / expectedTilesCount);

        return true;
    }

    void benchmark()
    {
        std::cout << "Running " << Stress::Iterations << " iterations of Benchmark." << std::endl;

        _cacheStats.reserve(Stress::Iterations * 4);
        _latencyStats.reserve(Stress::Iterations * 4);
        _renderingStats.reserve(Stress::Iterations * 4);

        static std::atomic<unsigned> SessionId;
        const auto sessionId = ++SessionId;
        auto connection = Connection::create(_app._serverURI, _uri, std::to_string(sessionId));

        connection->load();

        for (size_t i = 0; i < Stress::Iterations; ++i)
        {
            renderTile(connection);

            fetchCachedTile(connection);
        }
    }

    void replay()
    {
        TraceFileReader traceFile(_uri);

        auto epochFile(traceFile.getEpoch());
        auto epochCurrent(std::chrono::steady_clock::now());

        for (;;)
        {
            const auto rec = traceFile.getNextRecord();
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
                    std::cout << "Sleeping for " << delay / 1000 << " ms.\n";
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
                    auto it = _sessions.find(uri);
                    if (it != _sessions.end())
                    {
                        // Add a new session.
                        if (it->second.find(rec.SessionId) != it->second.end())
                        {
                            std::cout << "ERROR: session [" << rec.SessionId << "] already exists on doc [" << uri << "]\n";
                        }
                        else
                        {
                            it->second.emplace(rec.SessionId, Connection::create(_app._serverURI, uri, rec.SessionId));
                        }
                    }
                    else
                    {
                        std::cout << "New Document: " << uri << "\n";
                        _childToDoc.emplace(rec.Pid, uri);
                        _sessions[uri].emplace(rec.SessionId, Connection::create(_app._serverURI, uri, rec.SessionId));
                    }
                }
                else if (rec.Payload.find(EndSession) == 0)
                {
                    const auto& uri = rec.Payload.substr(EndSession.size());
                    auto it = _sessions.find(uri);
                    if (it != _sessions.end())
                    {
                        std::cout << "EndSession [" << rec.SessionId << "]: " << uri << "\n";

                        it->second.erase(rec.SessionId);
                        if (it->second.empty())
                        {
                            std::cout << "End Doc [" << uri << "].\n";
                            _sessions.erase(it);
                            _childToDoc.erase(rec.Pid);
                        }
                    }
                    else
                    {
                        std::cout << "ERROR: Doc [" << uri << "] does not exist.\n";
                    }
                }
            }
            else if (rec.Dir == TraceFileRecord::Direction::Incoming)
            {
                auto docIt = _childToDoc.find(rec.Pid);
                if (docIt != _childToDoc.end())
                {
                    const auto& uri = docIt->second;
                    auto it = _sessions.find(uri);
                    if (it != _sessions.end())
                    {
                        const auto sessionIt = it->second.find(rec.SessionId);
                        if (sessionIt != it->second.end())
                        {
                            // Send the command.
                            sessionIt->second->send(rec.Payload);
                        }
                    }
                    else
                    {
                        std::cout << "ERROR: Doc [" << uri << "] does not exist.\n";
                    }
                }
                else
                {
                    std::cout << "ERROR: Unknown PID [" << rec.Pid << "] maps to no active document.\n";
                }
            }

            epochCurrent = std::chrono::steady_clock::now();
            epochFile = rec.TimestampNs;
        }
    }

private:
    Stress& _app;
    const std::string _uri;

    /// LOK child process PID to Doc URI map.
    std::map<unsigned, std::string> _childToDoc;

    /// Doc URI to _sessions map. _sessions are maps of SessionID to Connection.
    std::map<std::string, std::map<std::string, std::shared_ptr<Connection>>> _sessions;

    std::vector<long> _latencyStats;
    std::vector<long> _renderingStats;
    std::vector<long> _cacheStats;
};

bool Stress::NoDelay = false;
bool Stress::Benchmark = false;
size_t Stress::Iterations = 100;

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
    optionSet.addOption(Option("bench", "", "Performance benchmark. The argument is a document URL to load.")
                        .required(false).repeatable(false));
    optionSet.addOption(Option("iter", "", "Number of iterations to use for Benchmarking.")
                        .required(false).repeatable(false)
                        .argument("iter"));
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
        helpFormatter.format(std::cerr);
        std::exit(Application::EXIT_OK);
    }
    else if (optionName == "bench")
        Stress::Benchmark = true;
    else if (optionName == "iter")
        Stress::Iterations = std::max(std::stoi(value), 1);
    else if (optionName == "nodelay")
        Stress::NoDelay = true;
    else if (optionName == "clientsperdoc")
        _numClients = std::max(std::stoi(value), 1);
    else if (optionName == "server")
        _serverURI = value;
    else
    {
        std::cout << "Unknown option: " << optionName << std::endl;
        exit(1);
    }
}

int Stress::main(const std::vector<std::string>& args)
{
    std::vector<std::unique_ptr<Thread>> clients(_numClients * args.size());

    if (args.size() == 0)
    {
        std::cerr << "Usage: loolstress [--bench] <tracefile | url> " << std::endl;
        std::cerr << "       Trace files may be plain text or gzipped (with .gz extension)." << std::endl;
        std::cerr << "       --help for full arguments list." << std::endl;
        return Application::EXIT_NOINPUT;
    }

    std::vector<std::shared_ptr<Worker>> workers;

    unsigned index = 0;
    for (unsigned i = 0; i < args.size(); ++i)
    {
        std::cout << "Arg: " << args[i] << std::endl;
        for (unsigned j = 0; j < _numClients; ++j, ++index)
        {
            workers.emplace_back(new Worker(*this, args[i]));
            clients[index].reset(new Thread());
            clients[index]->start(*workers[workers.size() - 1]);
        }
    }

    for (const auto& client : clients)
    {
        client->join();
    }

    if (Stress::Benchmark)
    {
        std::vector<long> latencyStats;
        std::vector<long> renderingStats;
        std::vector<long> cachedStats;

        for (const auto& worker : workers)
        {
            const auto latencyStat = worker->getLatencyStats();
            latencyStats.insert(latencyStats.end(), latencyStat.begin(), latencyStat.end());

            const auto renderingStat = worker->getRenderingStats();
            renderingStats.insert(renderingStats.end(), renderingStat.begin(), renderingStat.end());

            const auto cachedStat = worker->getCacheStats();
            cachedStats.insert(cachedStats.end(), cachedStat.begin(), cachedStat.end());
        }

        if (!latencyStats.empty() && !renderingStats.empty() && !cachedStats.empty())
        {
            std::cerr << "\nResults:\n";
            std::cerr << "Iterations: " << Stress::Iterations << "\n";

            std::cerr << "Latency best: " << latencyStats[0] << " microsecs, 95th percentile: " << percentile(latencyStats, 95) << " microsecs." << std::endl;
            std::cerr << "Tile best: " << renderingStats[0] << " microsecs, rendering 95th percentile: " << percentile(renderingStats, 95) << " microsecs." << std::endl;
            std::cerr << "Cached best: " << cachedStats[0] << " microsecs, tile 95th percentile: " << percentile(cachedStats, 95) << " microsecs." << std::endl;

            const auto renderingTime = std::accumulate(renderingStats.begin(), renderingStats.end(), 0L);
            const double renderedPixels = 256 * 256 * renderingStats.size();
            const auto pixelsPerSecRendered = renderedPixels / renderingTime;
            std::cerr << "Rendering power: " << pixelsPerSecRendered << " MPixels/sec." << std::endl;

            const auto cacheTime = std::accumulate(cachedStats.begin(), cachedStats.end(), 0L);
            const double cachePixels = 256 * 256 * cachedStats.size();
            const auto pixelsPerSecCached = cachePixels / cacheTime;
            std::cerr << "Cache power: " << pixelsPerSecCached << " MPixels/sec." << std::endl;
        }
    }

    return Application::EXIT_OK;
}

POCO_APP_MAIN(Stress)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
