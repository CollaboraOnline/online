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

#include <config.h>

#include <atomic>
#include <chrono>

#include <perftest/PerfTestSocketHandler.hpp>

#define PERFTEST_DEFAULT_TIMEOUT 10000

class PerfTest
{
protected:
    std::string _name;
    std::string _fileName;
    std::shared_ptr<PerfTestSocketHandler> _handler;
private:
    std::chrono::steady_clock::time_point _startTime;
    std::chrono::steady_clock::time_point _stopTime;
    bool _measurementStarted = false;
    bool _measurementFinished = false;
    std::map<std::string, std::string> _results;

public:
    PerfTest(const std::string &name, const std::string &server);
protected:
    PerfTest(const std::string &name, std::shared_ptr<PerfTestSocketHandler> handler);

public:
    bool isStarted();
    bool isFinished();
    void abort(const std::string &message);
    // Output results as json
    void printResults();
    virtual void runTest() = 0;
protected:
    // Result is type string because it will be printed
    void addResult(const std::string &name, const std::string &result);

// Commands to use from tests
protected:
    virtual void startMeasurement();
    virtual void stopMeasurement();
    void connect(const std::string &filePath);
    void loadDocument(const std::string &filePath);
    void connectAndLoad(const std::string &filePath);
    void waitForMessage(const std::string &substring, unsigned int timeout = PERFTEST_DEFAULT_TIMEOUT);
    void waitForIdle(size_t timeout = PERFTEST_DEFAULT_TIMEOUT);
    void sendMessage(const std::string &message);
    void sleep(unsigned int millis);
    void disconnect();
};

class CyclePerfTest : public PerfTest
{
private:
    pid_t child_pid = -1;

public:
    CyclePerfTest(const std::string &name, const std::string &server);
    void startMeasurement() override;
    void stopMeasurement() override;
private:
    pid_t getCoolwsdPid();
    std::string getStringPopen(const std::string &command);
};

class MessagePerfTest : public PerfTest
{
private:
    // Shared with MessagePerfTestSocketHandler
    std::atomic<bool> _measuring = false;
    std::atomic<unsigned int> _messageCount = 0;
    std::atomic<unsigned int> _messageBytes = 0;

public:
    MessagePerfTest(const std::string &name, const std::string &server);

public:
    void startMeasurement() override;
    void stopMeasurement() override;
};

extern "C"
{
    std::shared_ptr<PerfTest> create_perftest(std::string &server);
}

