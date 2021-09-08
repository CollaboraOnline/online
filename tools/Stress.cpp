/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <unistd.h>

#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <numeric>
#include <sysexits.h>
#include <thread>

#include <Poco/Util/Application.h>
#include <Poco/Util/HelpFormatter.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionSet.h>

#include "Replay.hpp"
#include <TraceFile.hpp>
#include <test/helpers.hpp>

int ClientPortNumber = DEFAULT_CLIENT_PORT_NUMBER;

/// Stress testing and performance/scalability benchmarking tool.
class Stress: public Poco::Util::Application
{
public:
    Stress();

    static bool Benchmark;
    static size_t Iterations;
    static bool NoDelay;
private:
    unsigned _numClients;
    std::string _serverURI;

protected:
    void defineOptions(Poco::Util::OptionSet& options) override;
    void handleOption(const std::string& name, const std::string& value) override;
    int processArgs(const std::vector<std::string>& args);
    int  main(const std::vector<std::string>& args) override;
};

using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::Option;
using Poco::Util::OptionSet;

long percentile(std::vector<long>& v, const double percentile)
{
    std::sort(v.begin(), v.end());

    const size_t N = v.size();
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

std::mutex Connection::Mutex;

//static constexpr auto FIRST_ROW_TILES = "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840";
static constexpr const char* FIRST_PAGE_TILES = "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520,0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840,7680,7680,7680,7680,11520,11520,11520,11520 tilewidth=3840 tileheight=3840";
static constexpr int FIRST_PAGE_TILE_COUNT = 16;

/// Main thread class to replay a trace file.
class Worker: public Replay
{
public:

    Worker(const std::string& serverUri, const std::string& uri) : Replay(serverUri, uri, Stress::NoDelay)
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
        const std::chrono::microseconds::rep deltaModify = std::chrono::duration_cast<std::chrono::microseconds>(now - startModify).count();
        _latencyStats.push_back(deltaModify);

        return success;
    }

    bool renderTile(const std::shared_ptr<Connection>& con)
    {
        modifyDoc(con);

        const auto start = std::chrono::steady_clock::now();

        const int expectedTilesCount = FIRST_PAGE_TILE_COUNT;
        con->send(FIRST_PAGE_TILES);
        for (int i = 0; i < expectedTilesCount; ++i)
        {
            if (helpers::getTileMessage(*con->getWS(), con->getName()).empty())
            {
                return false;
            }
        }

        const auto now = std::chrono::steady_clock::now();
        const std::chrono::microseconds::rep delta = std::chrono::duration_cast<std::chrono::microseconds>(now - start).count();
        _renderingStats.push_back(delta / expectedTilesCount);

        return true;
    }

    bool fetchCachedTile(const std::shared_ptr<Connection>& con)
    {
        const auto start = std::chrono::steady_clock::now();

        const int expectedTilesCount = FIRST_PAGE_TILE_COUNT;
        con->send(FIRST_PAGE_TILES);
        for (int i = 0; i < expectedTilesCount; ++i)
        {
            if (helpers::getTileMessage(*con->getWS(), con->getName()).empty())
            {
                return false;
            }
        }

        const auto now = std::chrono::steady_clock::now();
        const std::chrono::microseconds::rep delta = std::chrono::duration_cast<std::chrono::microseconds>(now - start).count();
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
        const size_t sessionId = ++SessionId;
        std::shared_ptr<Connection> connection = Connection::create(getServerUri(), getUri(), std::to_string(sessionId));

        connection->load();

        for (size_t i = 0; i < Stress::Iterations; ++i)
        {
            renderTile(connection);

            fetchCachedTile(connection);
        }
    }

private:
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
        helpFormatter.setHeader("Collabora Online tool.");
        helpFormatter.format(std::cerr);
        std::exit(EX_OK);
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
    std::vector<std::thread> clients;
    clients.reserve(_numClients * args.size());

    if (args.size() == 0)
    {
        std::cerr << "Usage: loolstress [--bench] <tracefile | url> " << std::endl;
        std::cerr << "       Trace files may be plain text or gzipped (with .gz extension)." << std::endl;
        std::cerr << "       --help for full arguments list." << std::endl;
        return EX_NOINPUT;
    }

#if 0
    // temporary socketpoll hook
    return Stress::processArgs(args);
#endif

    std::vector<std::shared_ptr<Worker>> workers;

    for (size_t i = 0; i < args.size(); ++i)
    {
        std::cout << "Arg: " << args[i] << std::endl;
        for (unsigned j = 0; j < _numClients; ++j)
        {
            workers.emplace_back(new Worker(_serverURI, args[i]));
            clients.emplace_back([&workers]{workers.back()->run();});
        }
    }

    for (auto& client : clients)
    {
        client.join();
    }

    if (Stress::Benchmark)
    {
        std::vector<long> latencyStats;
        std::vector<long> renderingStats;
        std::vector<long> cachedStats;

        for (const auto& worker : workers)
        {
            const std::vector<long> latencyStat = worker->getLatencyStats();
            latencyStats.insert(latencyStats.end(), latencyStat.begin(), latencyStat.end());

            const std::vector<long> renderingStat = worker->getRenderingStats();
            renderingStats.insert(renderingStats.end(), renderingStat.begin(), renderingStat.end());

            const std::vector<long> cachedStat = worker->getCacheStats();
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
            const double pixelsPerSecRendered = renderedPixels / renderingTime;
            std::cerr << "Rendering power: " << pixelsPerSecRendered << " MPixels/sec." << std::endl;

            const auto cacheTime = std::accumulate(cachedStats.begin(), cachedStats.end(), 0L);
            const double cachePixels = 256 * 256 * cachedStats.size();
            const double pixelsPerSecCached = cachePixels / cacheTime;
            std::cerr << "Cache power: " << pixelsPerSecCached << " MPixels/sec." << std::endl;
        }
    }

    return EX_OK;
}

POCO_APP_MAIN(Stress)


#include "Socket.hpp"
#include "WebSocketHandler.hpp"
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif

// Avoid a MessageHandler for now.
class StressSocketHandler : public WebSocketHandler
{
    TraceFileReader _reader;
    TraceFileRecord _next;
    std::chrono::steady_clock::time_point _start;
    bool _connecting;
    std::string _uri;
    std::string _trace;
public:

    StressSocketHandler(const std::string &uri, const std::string &trace) :
        WebSocketHandler(true, true),
        _reader(trace),
        _connecting(true),
        _uri(uri),
        _trace(trace)
    {
        std::cerr << "Attempt connect to " << uri << " for trace " << _trace << "\n";
        getNextRecord();
        _start = std::chrono::steady_clock::now();
        sendMessage("load url=" + uri);
    }

    int getPollEvents(std::chrono::steady_clock::time_point now,
                      int64_t &timeoutMaxMicroS) override
    {
        if (_connecting)
        {
            std::cerr << "Waiting for outbound connection to " << _uri <<
                " to complete for trace " << _trace << "\n";
            return POLLOUT;
        }

        int events = WebSocketHandler::getPollEvents(now, timeoutMaxMicroS);

        int64_t nextTime = -1;
        while (nextTime <= 0) {
            nextTime = std::chrono::duration_cast<std::chrono::microseconds>(
                std::chrono::nanoseconds(_next.getTimestampNs() - _reader.getEpochStart())
                + now - _start).count();
            if (nextTime <= 0)
            {
                sendTraceMessage();
                events = WebSocketHandler::getPollEvents(now, timeoutMaxMicroS);
            }
        }

        std::cerr << "next event in " << nextTime << " us\n";
        if (nextTime < timeoutMaxMicroS)
            timeoutMaxMicroS = nextTime;

        return events;
    }

    bool getNextRecord()
    {
        bool found = false;
        while (!found) {
            _next = _reader.getNextRecord();
            switch (_next.getDir()) {
            case TraceFileRecord::Direction::Invalid:
            case TraceFileRecord::Direction::Incoming:
                // FIXME: need to subset output quite a bit.
                found = true;
                break;
            default:
                found = false;
                break;
            }
        }
        return _next.getDir () != TraceFileRecord::Direction::Invalid;
    }

    void sendTraceMessage()
    {
        std::cerr << "Send: " << _next.getPayload() << "\n";

        // FIXME: viewport translation of events etc. ?
        sendMessage(_next.getPayload());

        if (!getNextRecord())
            shutdown();
    }

    void performWrites(std::size_t capacity) override
    {
        std::cerr << "Outbound websocket - connected\n";
        _connecting = false;
        return WebSocketHandler::performWrites(capacity);
    }

    void onDisconnect() override
    {
        std::cerr << "Websocket " << _uri << " dis-connected, re-trying in 20 seconds\n";
        WebSocketHandler::onDisconnect();
    }

    void handleMessage(const std::vector<char> &data) override
    {
        const std::string firstLine = LOOLProtocol::getFirstLine(data.data(), data.size());
        StringVector tokens = Util::tokenize(firstLine);
        std::cerr << "Got a message ! " << firstLine << "\n";
        // FIXME: implement code to respond to tile rendered events with tileprocessed etc.
    }
};

// Run me something like:
// touch /tmp/test.txt /tmp/trace.txt
// ./loolstress ws://localhost:9980 /tmp/test.txt /tmp/trace.txt
int Stress::processArgs(const std::vector<std::string>& args)
{
    TerminatingPoll poll("stress replay");

    if (!UnitWSD::init(UnitWSD::UnitType::Tool, ""))
        throw std::runtime_error("Failed to init unit test pieces.");

    std::string server = args[0];

    if (!strncmp(server.c_str(), "http", 4))
    {
        std::cerr << "Server should be wss:// or ws:// URL not " << server << "\n";
        return -1;
    }

    for (size_t i = 1; i < args.size() - 1; i += 2)
    {
        std::cerr << "Connect to " << server << "\n";
        std::string file, wrap;
        std::string fileabs = Poco::Path(args[i]).makeAbsolute().toString();
        Poco::URI::encode("file://" + fileabs, ":/?", file);
        Poco::URI::encode(file, ":/?", wrap); // double encode.
        std::string uri = server + "/lool/" + wrap + "/ws";

        auto handler = std::make_shared<StressSocketHandler>(fileabs, args[i+1]);
        poll.insertNewWebSocketSync(Poco::URI(uri), handler);
        // FIXME: we need a sensible protocol handler to drive the actual trace replay ...
    }

    while (poll.continuePolling())
    {
        poll.poll(TerminatingPoll::DefaultPollTimeoutMicroS);
    }

    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
