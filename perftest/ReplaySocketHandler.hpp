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
#include <string>

#include <net/Socket.hpp>
#include <WebSocketHandler.hpp>
#include <common/StringVector.hpp>

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
    bool _waiting;
    std::chrono::steady_clock::time_point _waitingStart;
    int64_t _waitingTimeout;
    std::string _waitingMessage;
    int64_t _lastMessageTime;
    bool _measurementStarted;
    bool _measurementFinished;
protected:
    std::string _trace;
public:
    ReplaySocketHandler(SocketPoll &poll, /* bad style */
                        const std::string &uri, const std::string &trace) :
        WebSocketHandler(true, true),
        _poll(poll),
        _reader(trace),
        _connecting(true),
        _uri(uri),
        _waiting(false),
        _lastMessageTime(0),
        _measurementStarted(false),
        _measurementFinished(false),
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

        int64_t currentTime = getCurrentTime();
        int64_t nextMessageTime = _lastMessageTime + (_next.getRelativeTimestampUs() * TRACE_MULTIPLIER);
        int64_t timeToNextMessage = nextMessageTime - currentTime;

        //std::cerr << getCurrentTime() << " getPollEvents"
            //<< " (nextMessageTime: " << nextMessageTime << "(" << timeToNextMessage << "))"
            //<< (_waiting ? " (waiting for: " + _waitingMessage + ")" : "") << std::endl;

        if (timeToNextMessage < 0) {
            if (_waiting) {
                int64_t currentWaitTime = std::chrono::duration_cast<std::chrono::microseconds>(now - _waitingStart).count();
                if (currentWaitTime > _waitingTimeout) {
                    std::cerr << "Timed out waiting for message " << _waitingMessage << " after " << _waitingTimeout << "us" << std::endl;
                    shutdown();
                } else {
                    timeoutMaxMicroS = 100000;
                }
            } else {
                processTraceMessage();
                getNextRecord();
                timeoutMaxMicroS = 0;
            }
        } else {
            timeoutMaxMicroS = timeToNextMessage;
        }

        return events;
    }

    void getNextRecord()
    {
        _next = _reader.getNextRecord();
        // std::cerr << "Got next record: " << _next.toString() << std::endl; // Confusing to have next record show in logs well before it is actually used
        if (_next.getDir() == TraceFileRecord::Direction::Invalid){
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
        _lastMessageTime = getCurrentTime();
        switch(_next.getDir()) {
            case TraceFileRecord::Direction::Invalid:
                std::cerr << getCurrentTime() << " processTraceMessage: " << _next.toString() << std::endl;
                shutdown();
                break;
            case TraceFileRecord::Direction::Incoming:
                // Logged in sendTraceMessage
                // Incoming from server's perspective, outgoing for us
                sendTraceMessage();
                break;
            case TraceFileRecord::Direction::Outgoing:
                // These don't appear in our trace files
                break;
            case TraceFileRecord::Direction::Event:
                std::cerr << getCurrentTime() << " processTraceMessage: " << _next.toString() << std::endl;
                std::string payload = _next.getPayload();
                StringVector tokens = StringVector::tokenize(payload);
                if (tokens.equals(0, "wait")) {
                    _waitingStart = std::chrono::steady_clock::now();
                    _waitingTimeout = std::stoi(tokens[1]) * TRACE_MULTIPLIER;
                    _waitingMessage = tokens.cat(" ",2);
                    _waiting = true;
                    std::cerr << getCurrentTime() << " waiting for message: " << _waitingMessage << " (Timeout " << _waitingTimeout << "us)" << std::endl;
                } else if (tokens.equals(0, "start")) {
                    if (!_measurementStarted) {
                        std::cerr << getCurrentTime() << " start measurement" << std::endl;
                        _measurementStarted = true;
                        startMeasurement();
                    } else {
                        std::cerr << "Cannot start. Already started." << std::endl;
                        shutdown();
                    }
                } else if (tokens.equals(0, "stop")) {
                    if (_measurementStarted) {
                        if (!_measurementFinished) {
                            std::cerr << getCurrentTime() << " stop measurement" << std::endl;
                            _measurementFinished = true;
                            stopMeasurement();
                        } else {
                            std::cerr << "Cannot stop. Already finished." << std::endl;
                            shutdown();
                        }
                    } else {
                        std::cerr << "Cannot stop. Not started yet." << std::endl;
                        shutdown();
                    }
                }
                break;
        }
    }

    // send outgoing messages
    void sendTraceMessage()
    {
        std::cerr << getCurrentTime() << " sendTraceMessage: " << _next.toString() << std::endl;
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

        return out;
    }

    // handle incoming messages
    void handleMessage(const std::vector<char> &data) override
    {
        const std::string firstLine = COOLProtocol::getFirstLine(data.data(), data.size());
        std::cerr << getCurrentTime() << " handleMessage: " << firstLine << std::endl;
        //std::cerr << getCurrentTime() << " handleMessage: " << std::string(data.begin(),data.end()) << std::endl;

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

        if (_waiting) {
            std::string message = tokens.cat(" ",0);
            if (message.find(_waitingMessage) != std::string::npos) {
                int64_t elapsedTime = std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - _waitingStart).count();
                std::cerr << getCurrentTime() << " Done waiting for message " << _waitingMessage << " after " << elapsedTime << "us" << std::endl;
                _waiting = false;
            }
        }

    }

    virtual void startMeasurement()
    {
    }

    virtual void stopMeasurement()
    {
    }

    void shutdown()
    {
        std::cerr << "Shutdown" << std::endl;
        WebSocketHandler::shutdown();
    }

    bool isFinished()
    {
        return _measurementFinished;
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

private:
    int64_t getCurrentTime()
    {
        return std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - _start).count();
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
