/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <math.h>
#include <chrono>
#include <cstring>

#include "Socket.hpp"
#include "WebSocketHandler.hpp"
#include <net/Ssl.hpp>
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif

#include <TraceFile.hpp>
#include <wsd/TileDesc.hpp>

// store buckets of latency
struct Histogram {
    const size_t incLowMs = 10;
    const size_t maxLowMs = incLowMs * 10;
    const size_t incHighMs = 100;
    const size_t maxHighMs = incHighMs * 10;
    size_t _items;
    size_t _tooLong;
    std::vector<size_t> _buckets;

    Histogram() : _items(0), _tooLong(0), _buckets(20)
    {
    }

    void addTime(size_t ms)
    {
        if (ms < maxLowMs)
            _buckets[ms/incLowMs]++;
        else if (ms < maxHighMs)
            _buckets[(ms - maxLowMs) / maxHighMs]++;
        else
            _tooLong++;
        _items++;
    }

    void dump(const char *legend)
    {
        size_t max = 0;
        ssize_t firstBucket = -1;
        for (size_t i = 0; i < _buckets.size(); ++i)
        {
            size_t n = _buckets[i];
            if (n > 0 && firstBucket < 0)
                firstBucket = i;
            max = std::max(max, n);
        }
        if (firstBucket < 0 || max == 0)
            return;

        size_t last; // ignore
        for (last = _buckets.size()-1; last > 0; --last)
            if (_buckets[last] > 0)
                break;

        std::cout << legend << " " << _items << " items, max #: " << max << " too long: " << _tooLong << "\n";

        const double chrsPerFreq = 60.0 / max;
        for (size_t i = firstBucket; i <= last; ++i)
        {
            int chrs = ::ceil(chrsPerFreq * _buckets[i]);
            int ms = i < 10 ? (incLowMs * (i+1)) : (maxLowMs + (i+1-10) * incHighMs);
            std::cout << "< " << std::setw(4) << ms << " ms |" << std::string(chrs, '-') << "| " << _buckets[i] << "\n";
        }
    }
};

struct Stats {
    Stats() :
        _start(std::chrono::steady_clock::now()),
        _tileCount(0)
    {
    }
    std::chrono::steady_clock::time_point _start;
    size_t _tileCount;
    Histogram _pingLatency;
    Histogram _tileLatency;
    void dump()
    {
        const auto now = std::chrono::steady_clock::now();
        const size_t runMs = std::chrono::duration_cast<std::chrono::milliseconds>(now - _start).count();
        std::cout << "Stress run took " << runMs << " ms\n";
        std::cout << "  tiles: " << _tileCount << " => TPS: " << ((_tileCount * 1000.0)/runMs) << "\n";
        _pingLatency.dump("ping latency:");
        _tileLatency.dump("tile latency:");
    }
};

// Avoid a MessageHandler for now.
class StressSocketHandler : public WebSocketHandler
{
    TraceFileReader _reader;
    TraceFileRecord _next;
    std::chrono::steady_clock::time_point _start;
    std::chrono::steady_clock::time_point _nextPing;
    bool _connecting;
    std::string _uri;
    std::string _trace;

    std::shared_ptr<Stats> _stats;
    std::chrono::steady_clock::time_point _lastTile;

public:

    StressSocketHandler(const std::shared_ptr<Stats> stats,
                        const std::string &uri, const std::string &trace) :
        WebSocketHandler(true, true),
        _reader(trace),
        _connecting(true),
        _uri(uri),
        _trace(trace),
        _stats(stats)
    {
        std::cerr << "Attempt connect to " << uri << " for trace " << _trace << "\n";
        getNextRecord();
        _start = std::chrono::steady_clock::now();
        _nextPing = _start + std::chrono::milliseconds((long)(std::rand() * 1000.0) / RAND_MAX);
        _lastTile = _start;
        sendMessage("load url=" + uri);
    }

    void gotPing(WSOpCode /* code */, int pingTimeUs) override
    {
        if (_stats)
            _stats->_pingLatency.addTime(pingTimeUs/1000);
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

        if (now >= _nextPing)
        {
            // ping more frequently
            sendPing(now, getSocket().lock());
            _nextPing += std::chrono::seconds(1);
        }

        int64_t nextTime = -1;
        while (nextTime <= 0) {
            nextTime = std::chrono::duration_cast<std::chrono::microseconds>(
                std::chrono::microseconds((_next.getTimestampUs() - _reader.getEpochStart()) * TRACE_MULTIPLIER)
                + _start - now).count();
            if (nextTime <= 0)
            {
                sendTraceMessage();
                events = WebSocketHandler::getPollEvents(now, timeoutMaxMicroS);
                break;
            }
        }

//        std::cerr << "next event in " << nextTime << " us\n";
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

    void performWrites(std::size_t capacity) override
    {
        if (_connecting)
            std::cerr << "Outbound websocket - connected\n";
        _connecting = false;
        return WebSocketHandler::performWrites(capacity);
    }

    void onDisconnect() override
    {
        std::cerr << "Websocket " << _uri << " dis-connected, re-trying in 20 seconds\n";
        WebSocketHandler::onDisconnect();
    }

    // send outgoing messages
    void sendTraceMessage()
    {
        if (_next.getDir() == TraceFileRecord::Direction::Invalid)
            return; // shutting down

        std::string msg = rewriteMessage(_next.getPayload());
        if (!msg.empty())
        {
            std::cerr << "Send: '" << msg << "'\n";
            sendMessage(msg);
        }

        if (!getNextRecord())
        {
            std::cerr << "Shutdown\n";
            shutdown();
        }
    }

    std::string rewriteMessage(const std::string &msg)
    {
        const std::string firstLine = COOLProtocol::getFirstLine(msg);
        StringVector tokens = Util::tokenize(firstLine);

        std::string out = msg;

        if (tokens.equals(0, "tileprocessed"))
            out = ""; // we do this accurately below

        else if (tokens.equals(0, "load")) {
            std::string url = tokens[1];
            assert(!strncmp(url.c_str(), "url=", 4));

            // load url=file%3A%2F%2F%2Ftmp%2Fhello-world.odt deviceFormFactor=desktop
            out = "load url=" + _uri; // already encoded
            for (size_t i = 2; i < tokens.size(); ++i)
                out += " " + tokens[i];
            std::cerr << "msg " << out << "\n";
        }

        // FIXME: translate mouse events relative to view-port etc.
        return out;
    }

    // handle incoming messages
    void handleMessage(const std::vector<char> &data) override
    {
        const auto now = std::chrono::steady_clock::now();

        const std::string firstLine = COOLProtocol::getFirstLine(data.data(), data.size());
        StringVector tokens = Util::tokenize(firstLine);
        std::cerr << "Got a message ! " << firstLine << "\n";

        if (tokens.equals(0, "tile:")) {
            // accumulate latencies
            if (_stats) {
                _stats->_tileLatency.addTime(std::chrono::duration_cast<std::chrono::milliseconds>(now - _lastTile).count());
                _stats->_tileCount++;
            }
            _lastTile = now;

            // eg. tileprocessed tile=0:9216:0:3072:3072:0
            TileDesc desc = TileDesc::parse(tokens);
            sendMessage("tileprocessed tile=" + desc.generateID());
        }

        // FIXME: implement code to send new view-ports based
        // on cursor position etc.
    }

    static void addPollFor(SocketPoll &poll, const std::string &server,
                           const std::string &filePath, const std::string &tracePath,
                           const std::shared_ptr<Stats> &optStats = nullptr)
    {
        std::string file, wrap;
        std::string fileabs = Poco::Path(filePath).makeAbsolute().toString();
        Poco::URI::encode("file://" + fileabs, ":/?", file);
        Poco::URI::encode(file, ":/?", wrap); // double encode.
        std::string uri = server + "/cool/" + wrap + "/ws";

        auto handler = std::make_shared<StressSocketHandler>(optStats, file, tracePath);
        poll.insertNewWebSocketSync(Poco::URI(uri), handler);
    }

    /// Attach to @server, load @filePath and replace @tracePath
    static void replaySync(const std::string &server,
                           const std::string &filePath,
                           const std::string &tracePath)
    {
        TerminatingPoll poll("replay");

        addPollFor(poll, server, filePath, tracePath);
        do {
            poll.poll(TerminatingPoll::DefaultPollTimeoutMicroS);
        } while (poll.continuePolling() && poll.getSocketCount() > 0);
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
