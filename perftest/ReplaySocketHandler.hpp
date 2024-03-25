/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <iomanip>
#include <chrono>
#include <cstring>
#include <unordered_map>

#include <net/Socket.hpp>
#include <WebSocketHandler.hpp>

#include <TraceFile.hpp>
#include <wsd/TileDesc.hpp>

class ReplaySocketHandler : public WebSocketHandler
{
    SocketPoll &_poll;
    TraceFileReader _reader;
    TraceFileRecord _next;
    std::chrono::steady_clock::time_point _start;
    bool _connecting;
    std::string _logPre;
    std::string _uri;
    std::string _trace;
public:
    ReplaySocketHandler(SocketPoll &poll, /* bad style */
                        const std::string &uri, const std::string &trace) :
        WebSocketHandler(true, true),
        _poll(poll),
        _reader(trace),
        _connecting(true),
        _uri(uri),
        _trace(trace)
    {

        static std::atomic<int> number;
        _logPre = "[" + std::to_string(++number) + "] ";
        std::cerr << "Attempt connect to " << uri << " for trace " << _trace << "\n";
        getNextRecord();
        _start = std::chrono::steady_clock::now();
    }

    int getPollEvents(std::chrono::steady_clock::time_point now,
                      int64_t &timeoutMaxMicroS) override
    {
        if (_connecting)
        {
            std::cerr << _logPre << "Waiting for outbound connection to " << _uri <<
                " to complete for trace " << _trace << "\n";
            return POLLOUT;
        }

        int events = WebSocketHandler::getPollEvents(now, timeoutMaxMicroS);

        int64_t nextTime = -1;
        while (nextTime <= 0) {
            nextTime = std::chrono::microseconds((_next.getTimestampUs() - _reader.getEpochStart()) * TRACE_MULTIPLIER).count();
            if ((now - _start).count() > nextTime)
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
            std::cerr << _logPre << "Outbound websocket - connected\n";
        _connecting = false;
        return WebSocketHandler::performWrites(capacity);
    }

    void onDisconnect() override
    {
        std::cerr << _logPre << "Websocket " << _uri <<
            " dis-connected, re-trying in 20 seconds\n";
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
            std::cerr << _logPre << "Send: '" << msg << "'\n";
            sendMessage(msg);
        }

        if (!getNextRecord())
        {
            std::cerr << _logPre << "Shutdown\n";
            shutdown();
        }
    }

    std::string rewriteMessage(const std::string &msg)
    {
        const std::string firstLine = COOLProtocol::getFirstLine(msg);
        StringVector tokens = StringVector::tokenize(firstLine);

        std::string out = msg;

        if (tokens.equals(0, "tileprocessed"))
            out.clear(); // we do this accurately below

        else if (tokens.equals(0, "load")) {
            std::string url = tokens[1];
            assert(!strncmp(url.c_str(), "url=", 4));

            // load url=file%3A%2F%2F%2Ftmp%2Fhello-world.odt deviceFormFactor=desktop
            out = "load url=" + _uri; // already encoded
            for (size_t i = 2; i < tokens.size(); ++i)
                out += " " + tokens[i];
            std::cerr << _logPre << "msg " << out << "\n";
        }

        // FIXME: translate mouse events relative to view-port etc.
        return out;
    }

    // handle incoming messages
    void handleMessage(const std::vector<char> &data) override
    {
        //const auto now = std::chrono::steady_clock::now();

        const std::string firstLine = COOLProtocol::getFirstLine(data.data(), data.size());
        StringVector tokens = StringVector::tokenize(firstLine);
        std::cerr << _logPre << "Got msg: " << firstLine << "\n";


        if (tokens.equals(0, "tile:")) {
            // accumulate latencies

            // eg. tileprocessed tile=0:9216:0:3072:3072:0
            TileDesc desc = TileDesc::parse(tokens);

            sendMessage("tileprocessed tile=" + desc.generateID());
            std::cerr << _logPre << "Sent tileprocessed tile= " + desc.generateID() << "\n";
        } if (tokens.equals(0, "error:")) {

            bool reconnect = false;
            if (firstLine == "error: cmd=load kind=docunloading")
            {
                std::cerr << ": wait and try again later ...!\n";
                reconnect = true;
            }
            else if (firstLine == "error: cmd=storage kind=documentconflict")
            {
                std::cerr << "Document conflict - need to resolve it first ...\n";
                sendMessage("closedocument");
                reconnect = true;
            }
            else
            {
                std::cerr << _logPre << "Error while processing " << _uri
                          << " and trace " << _trace << ":\n"
                          << "'" << firstLine << "'\n";
            }

            if (reconnect)
            {
                shutdown(true, "bye");
                auto handler = std::make_shared<ReplaySocketHandler>(
                    _poll, _uri, _trace);
                _poll.insertNewWebSocketSync(Poco::URI(_uri), handler);
                return;
            }
            else
                Util::forcedExit(EX_SOFTWARE);
        }

        // FIXME: implement code to send new view-ports based
        // on cursor position etc.
    }

    /// override ProtocolHandlerInterface piece
    int sendTextMessage(const char* msg, const size_t len, bool flush = false) const override
    {
        return WebSocketHandler::sendTextMessage(msg, len, flush);
    }

    static void addPollFor(SocketPoll &poll,
            const std::string &server,
            const std::string &tracePath)
    {
        std::string filePath = "test/data/hello.odt";
        std::cerr << "Connect to " << server << "\n";

        std::string file, wrap;
        std::string fileabs = Poco::Path(filePath).makeAbsolute().toString();
        Poco::URI::encode("file://" + fileabs, ":/?", file);
        Poco::URI::encode(file, ":/?", wrap); // double encode.
        std::string uri = server + "/cool/" + wrap + "/ws";

        auto handler = std::make_shared<ReplaySocketHandler>(poll, file, tracePath);
        poll.insertNewWebSocketSync(Poco::URI(uri), handler);

    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
