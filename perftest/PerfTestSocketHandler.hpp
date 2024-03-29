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

#include <iostream>

#include <TraceFile.hpp>
#include <ReplaySocketHandler.hpp>

class PerfTestSocketHandler : public ReplaySocketHandler
{
    bool _measurementStarted;
    bool _measurementFinished;
public:
    PerfTestSocketHandler(SocketPoll &poll,
                        const std::string &uri,
                        const std::string &trace) :
        ReplaySocketHandler(poll, uri, trace),
        _measurementStarted(false),
        _measurementFinished(false)
    {
    }

    void processTraceMessage() override
    {
        if (_next.getDir() == TraceFileRecord::Direction::Event && _next.getPayload().starts_with("start")) {
            std::cerr << getCurrentTime() << " processTraceMessage: " << _next.toString() << std::endl;
            if (!_measurementStarted) {
                std::cerr << getCurrentTime() << " start measurement" << std::endl;
                _measurementStarted = true;
                startMeasurement();
            } else {
                std::cerr << "Cannot start. Already started." << std::endl;
                shutdown();
            }
        } else if (_next.getDir() == TraceFileRecord::Direction::Event && _next.getPayload().starts_with("stop")) {
            std::cerr << getCurrentTime() << " processTraceMessage: " << _next.toString() << std::endl;
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
        } else {
            ReplaySocketHandler::processTraceMessage();
        }
    }

    bool isFinished()
    {
        return _measurementFinished;
    }

    virtual void startMeasurement() = 0;

    virtual void stopMeasurement() = 0;

    // Output results as json
    virtual void printResults() = 0;
};

class CyclePerfTestSocketHandler : public PerfTestSocketHandler
{
public:
    CyclePerfTestSocketHandler(SocketPoll &poll,
                        const std::string &uri,
                        const std::string &trace) :
        PerfTestSocketHandler(poll, uri, trace)
    {
    }

    void startMeasurement() override
    {
        sendMessage("PERFTEST start");
    }

    void stopMeasurement() override
    {
        sendMessage("PERFTEST stop " + _trace);
    }

    void printResults()
    {
        std::cout << "{\n"
                  << "    name: " << _trace << "\n"
                  << "}" << std::endl;
    }
};

class MessagePerfTestSocketHandler : public PerfTestSocketHandler
{
    bool _measuring;
    unsigned int _messageCount;
    unsigned int _messageBytes;
public:
    MessagePerfTestSocketHandler(SocketPoll &poll,
                        const std::string &uri,
                        const std::string &trace) :
        PerfTestSocketHandler(poll, uri, trace),
        _measuring(false),
        _messageCount(0),
        _messageBytes(0)
    {
    }

    void handleMessage(const std::vector<char> &data) override
    {
        if (_measuring) {
            _messageCount++;
            _messageBytes += data.size();
        }
        ReplaySocketHandler::handleMessage(data);
    }

    void startMeasurement() override
    {
        _measuring = true;
    }

    void stopMeasurement() override
    {
        _measuring = false;
    }

    void printResults()
    {
        std::cout << "{\n"
                  << "    name: " << _trace << ",\n"
                  << "    messageCount: " << _messageCount << ",\n"
                  << "    messageBytes: " << _messageBytes << "\n"
                  << "}" << std::endl;
    }
};

class TimePerfTestSocketHandler : public PerfTestSocketHandler
{
    std::chrono::steady_clock::time_point _startTime = std::chrono::steady_clock::now();
    std::chrono::steady_clock::time_point _stopTime = std::chrono::steady_clock::now();

public:
    TimePerfTestSocketHandler(SocketPoll &poll,
                        const std::string &uri,
                        const std::string &trace) :
        PerfTestSocketHandler(poll, uri, trace)
    {
    }

    void startMeasurement() override
    {
        _startTime = std::chrono::steady_clock::now();
    }

    void stopMeasurement() override
    {
        _stopTime = std::chrono::steady_clock::now();
    }

    void printResults()
    {
        std::cout << "{\n"
                  << "    name: " << _trace << ",\n"
                  << "    time: " << getTime() << "\n"
                  << "}" << std::endl;
    }

private:
    // get time in seconds
    double getTime()
    {
        return std::chrono::duration_cast<std::chrono::microseconds>(_stopTime - _startTime).count()/1000000.0;
    }

};

