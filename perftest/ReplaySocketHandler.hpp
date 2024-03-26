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
#include <time.h>
#include <cstring>
#include <unordered_map>
#include <sysexits.h>

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

        std::cerr << "Attempt connect to " << uri << " for trace " << _trace << "\n";
        getNextRecord();
        _start = std::chrono::steady_clock::now();
    }

    int getPollEvents(std::chrono::steady_clock::time_point now, int64_t &timeoutMaxMicroS) override
    {
        if (_connecting) {
            std::cerr << "getPollEvents (Waiting for outbound connection to " << _uri <<
                " to complete for trace " << _trace << ")" << std::endl;
            return POLLOUT;
        }

        int events = WebSocketHandler::getPollEvents(now, timeoutMaxMicroS);

        int64_t nextMessageTime = (_next.getTimestampUs() - _reader.getEpochStart()) * TRACE_MULTIPLIER;
        int64_t currentTime = std::chrono::duration_cast<std::chrono::microseconds>(now - _start).count();
        int64_t timeToNextMessage = nextMessageTime - currentTime;

        std::cerr << "getPollEvents nextMessageTime: " << nextMessageTime <<
                                  " currentTime: " << currentTime <<
                                  " timeToNextMessage: " << timeToNextMessage << std::endl;

        if (timeToNextMessage < 0) {
            processTraceMessage();
            getNextRecord();
            timeoutMaxMicroS = 0;
        } else {
            timeoutMaxMicroS = timeToNextMessage;
        }

        return events;
    }

    void getNextRecord()
    {
        _next = _reader.getNextRecord();
        std::cerr << "Got next record: " << _next.toString() << std::endl;
        if (_next.getDir() == TraceFileRecord::Direction::Invalid){
            std::cerr << "Shutdown\n";
            shutdown();
        }
    }

    void performWrites(std::size_t capacity) override
    {
        if (_connecting) {
            std::cerr << "Outbound websocket - connected" << std::endl;
            _connecting = false;
        }
        return WebSocketHandler::performWrites(capacity);
    }

    void onDisconnect() override
    {
        std::cerr << "Websocket " << _uri << " dis-connected" << std::endl;
        WebSocketHandler::onDisconnect();
    }

    void processTraceMessage()
    {
        std::cerr << "processTraceMessage: " << _next.toString() << std::endl;
        switch(_next.getDir()) {
            case TraceFileRecord::Direction::Invalid:
                std::cerr << "Shutdown" << std::endl;
                shutdown();
                break;
            case TraceFileRecord::Direction::Incoming:
                // Incoming from server's perspective, outgoing for us
                sendTraceMessage();
                break;
            case TraceFileRecord::Direction::Outgoing:
                // Do nothing
                break;
            case TraceFileRecord::Direction::Event:
                // Do nothing
                break;
        }
    }

    // send outgoing messages
    void sendTraceMessage()
    {
        std::cerr << "sendTraceMessage: " << _next.toString() << std::endl;
        std::string msg = rewriteMessage(_next.getPayload());
        if (!msg.empty()) {
            sendMessage(msg);
        }
    }

    std::string rewriteMessage(const std::string &msg)
    {
        const std::string firstLine = COOLProtocol::getFirstLine(msg);
        StringVector tokens = StringVector::tokenize(firstLine);

        std::string out = msg;

        if (tokens.equals(0, "load")) {
            std::string url = tokens[1];
            assert(!strncmp(url.c_str(), "url=", 4));

            // load url=file%3A%2F%2F%2Ftmp%2Fhello-world.odt deviceFormFactor=desktop
            out = "load url=" + _uri; // already encoded
            for (size_t i = 2; i < tokens.size(); ++i)
                out += " " + tokens[i];
            std::cerr << "rewriteMessage: " << out << std::endl;
        }

        // FIXME: translate mouse events relative to view-port etc.
        return out;
    }

    // handle incoming messages
    void handleMessage(const std::vector<char> &data) override
    {
        const std::string firstLine = COOLProtocol::getFirstLine(data.data(), data.size());
        std::cerr << "handleMessage: " << firstLine << std::endl;

        StringVector tokens = StringVector::tokenize(firstLine);
        if (tokens.equals(0, "tile:")) {
            // eg. tileprocessed tile=0:9216:0:3072:3072:0
            TileDesc desc = TileDesc::parse(tokens);
            std::string msg = "tileprocessed tile=" + desc.generateID();
            std::cerr << "Send: '" << msg << "'\n";
            sendMessage(msg);
        } if (tokens.equals(0, "error:")) {
            std::cerr << "Error while processing " << _uri << " and trace " << _trace << ":\n"
                << "'" << firstLine << "'\n";
            Util::forcedExit(EX_SOFTWARE);
        }
    }

    static std::string getFileUri(const std::string &filePath)
    {
        std::string fileUri;
        std::string fileabs = Poco::Path(filePath).makeAbsolute().toString();
        Poco::URI::encode("file://" + fileabs, ":/?", fileUri);
        return fileUri;
    }

    static std::string getServerUri(const std::string &server, const std::string &fileUri)
    {
        std::string wrap;
        Poco::URI::encode(fileUri, ":/?", wrap); // double encode.
        std::string serverUri = server + "/cool/" + wrap + "/ws";
        return serverUri;
    }

    static void start(const std::shared_ptr<ReplaySocketHandler> &handler,
            SocketPoll &poll,
            std::string &serverUri)
    {
        std::cerr << "Connecting to " << serverUri << std::endl;
        poll.insertNewWebSocketSync(Poco::URI(serverUri), handler);
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
