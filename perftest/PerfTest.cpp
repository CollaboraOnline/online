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

#include <stdio.h>
#include <iostream>
#include <sys/wait.h>
#include <sysexits.h>

#include <perftest/PerfTest.hpp>

PerfTest::PerfTest(const std::string &name, const std::string &server) :
    _name(name),
    _handler(std::make_shared<PerfTestSocketHandler>(name, server))
{
    addResult("name",_name);
    _fileName = _name;
}

PerfTest::PerfTest(const std::string &name, std::shared_ptr<PerfTestSocketHandler> handler) :
    _name(name),
    _handler(handler)
{
    addResult("name",_name);
}

bool PerfTest::isStarted()
{
    return _measurementStarted;
}

bool PerfTest::isFinished()
{
    return _measurementFinished;
}

void PerfTest::abort(const std::string &message)
{
    LOG_ERR("PerfTest abort: " << message);
    disconnect();
    Util::forcedExit(EX_SOFTWARE);
}

void PerfTest::printResults()
{
    std::cout << "{\n";
    for (auto const& [key, value] : _results) {
        std::cout << "    " << key << ": " << value << ",\n";
    }
    std::cout << "}" << std::endl;
}

void PerfTest::addResult(const std::string &name, const std::string &result) {
    LOG_DBG("PerfTest addResult " << name << ": " << result);
    _results.emplace(name, result);
}

void PerfTest::startMeasurement()
{
    if (!isStarted()) {
        LOG_DBG("PerfTest Start measurement");
        std::cerr << "Starting measurement" << std::endl;
        _measurementStarted = true;
        _startTime = std::chrono::steady_clock::now();
    } else {
        abort("Cannot start. Already started.");
    }
}

void PerfTest::stopMeasurement()
{
    if (!isFinished()) {
        LOG_DBG("PerfTest Stop measurement");
        std::cerr << "Stopping measurement" << std::endl;
        _measurementFinished = true;
        _stopTime = std::chrono::steady_clock::now();
        std::chrono::duration elapsedTime = _stopTime - _startTime;
        double seconds = std::chrono::duration_cast<std::chrono::milliseconds>(elapsedTime).count() / 1000.0;
        addResult("time", std::to_string(seconds));
    } else {
        abort("Cannot stop. Already finished.");
    }
}

void PerfTest::connect(const std::string &filePath)
{
    LOG_DBG("PerfTest connect " << filePath);
    _handler->connect(filePath);
}

void PerfTest::loadDocument(const std::string &filePath)
{
    LOG_DBG("PerfTest loadDocument " << filePath);
    _handler->loadDocument(filePath);
}

void PerfTest::connectAndLoad(const std::string &filePath)
{
    _handler->connect(filePath);
    _handler->loadDocument(filePath);
}

void PerfTest::waitForMessage(const std::string &substring, unsigned int timeout)
{
    LOG_DBG("PerfTest waitForMessage: " + substring);

    std::chrono::steady_clock::time_point _waitingStart = std::chrono::steady_clock::now();
    std::chrono::steady_clock::time_point _waitingEnd = _waitingStart + std::chrono::milliseconds(timeout * TRACE_MULTIPLIER);

    bool found;
    bool timedout;
    std::chrono::steady_clock::time_point now;
    do {
        now = std::chrono::steady_clock::now();
        found = _handler->hasIncomingMessage(substring);
        timedout = now > _waitingEnd;
        if (!found && !timedout) {
            LOG_TRC("Waiting for message " + substring);
            // Wait at least 1ms, no longer than 1s
            // Result: Finds items after 1ms, 2ms, 4ms, 8ms, and so on.
            // Good balance between fast polling for fast operations (waitForIdle can take <1ms)
            // and slow polling for slow operations (load document can take >1s)
            // and everything in between
            int elapsedms = std::chrono::duration_cast<std::chrono::milliseconds>(now - _waitingStart).count();
            int sleepms = std::min(std::max(1,elapsedms), 1000);
            std::this_thread::sleep_for(std::chrono::milliseconds(sleepms));
        }
    } while (!found && !timedout);

    double seconds = std::chrono::duration_cast<std::chrono::milliseconds>(now - _waitingStart).count()/1000.0;
    if (found) {
        LOG_DBG("PerfTest waitForMessage Found message: " + substring + " after " + std::to_string(seconds) + "s");
    } else {
        abort("Timed out waiting for message \"" + substring + "\" after " + std::to_string(seconds) + "s");
    }
}

void PerfTest::waitForIdle(size_t timeout)
{
    LOG_TRC("PerfTest waitForIdle");
    sendMessage("uno .uno:WaitForIdle");
    waitForMessage("WaitForIdle",timeout);
}

void PerfTest::sendMessage(const std::string &message)
{
    LOG_TRC("PerfTest sendMessage: " + message);
    _handler->sendMessage(message);
}

void PerfTest::sleep(unsigned int millis)
{
    LOG_DBG("PerfTest sleep: " + std::to_string(millis) + "ms");
    std::this_thread::sleep_for(std::chrono::milliseconds(millis));
}

void PerfTest::disconnect()
{
    LOG_DBG("PerfTest disconnect");
    _handler->shutdown();
}

CyclePerfTest::CyclePerfTest(const std::string &name, const std::string &server) :
    PerfTest(name, server)
{
}

void CyclePerfTest::startMeasurement()
{
    LOG_DBG("CyclePerfTest startMeasurement");
    PerfTest::startMeasurement();
    pid_t pid;
    pid = vfork();
    if (pid < 0) {
        perror("fork");
        Util::forcedExit(EX_SOFTWARE);
    } else if (pid == 0) {
        LOG_DBG("Starting perf");
        std::string pid_str = "--pid="+std::to_string(getCoolwsdPid());
        std::string output_str = "--output="+_fileName+".data";
        LOG_DBG("Starting perf"<<"perf"<<"record"<<"-s"<<"-e"<<"cycles"<<"--freq=1000"<<"--call-graph"<<"dwarf"<<pid_str.c_str()<<output_str.c_str());
        // If perf does not work because "perf_event_paranoid setting is 3"
        // Run this command (on Debian or Ubuntu):
        // sudo sysctl kernel.perf_event_paranoid=2
        execlp("perf","perf","record","-s","-e","cycles","--freq=1000","--call-graph","dwarf",pid_str.c_str(),output_str.c_str(),(char *)NULL);
    } else {
        child_pid = pid;
    }
}

void CyclePerfTest::stopMeasurement()
{
    LOG_DBG("CyclePerfTest stopMeasurement");

    // Stop measurement
    PerfTest::stopMeasurement();
    kill(child_pid,SIGINT);
    waitpid(child_pid, nullptr, 0);
    addResult("dataFile",_fileName+".data");

    // Get result
    // Use perf report to get summary statistics from the data file
    // Use grep and awk to get the cpu cycle counts from the report output
    // Use paste to format list of numbers for bc
    // Use bc to sum numbers. bc, as an arbitrary precision calculator, is
    // necessary because cycle counts can be >2^31 (too big for awk's sum)
    std::string command = "perf report -i "+_fileName+".data --no-inline | grep \"# Event count (approx.): \" | awk '{print $5}' | paste -s -d+ | bc";
    std::string cycles = getStringPopen(command);
    addResult("cycles",cycles);

    // Create flamegraph
    std::string flamegraphCommand = "perf script -i "+_fileName+".data --no-inline | stackcollapse-perf.pl | flamegraph.pl > "+_fileName+".svg";
    int systemResult = system(flamegraphCommand.c_str());
    if (systemResult != 0) {
        abort("Flamegraph failed");
    }
    addResult("flamegraph",_fileName+".svg");

    LOG_DBG("CyclePerfTest stopped");
}

pid_t CyclePerfTest::getCoolwsdPid()
{
    std::ifstream file;
    file.open("perftest/workdir/coolwsd.pid");
    pid_t pid;
    file >> pid;
    return pid;
}

std::string CyclePerfTest::getStringPopen(const std::string &command)
{
    std::array<char, 128> buffer;
    FILE *f = popen(command.c_str(),"r");
    if (!f) {
        abort("popen failed");
    }

    // We expect exactly one number
    char *c = fgets(buffer.data(), 32, f);
    pclose(f);
    if (c == NULL || strlen(c) == 0) {
        abort("command returned no output: " + command);
    }

    std::string result = buffer.data();
    // Trim newline
    result.erase(std::remove(result.begin(), result.end(), '\n'), result.end());
    // Make sure the result is a number
    if (!std::all_of(result.begin(), result.end(), ::isdigit)) {
        abort("result is not a number: " + result);
    }
    return result;
}

MessagePerfTest::MessagePerfTest(const std::string &name, const std::string &server) :
    PerfTest(name, std::make_shared<MessagePerfTestSocketHandler>(name, server, &_measuring, &_messageCount, &_messageBytes))
{
}

void MessagePerfTest::startMeasurement()
{
    PerfTest::startMeasurement();
    _measuring = true;
}

void MessagePerfTest::stopMeasurement()
{
    PerfTest::stopMeasurement();
    _measuring = false;
    addResult("messageCount",std::to_string(_messageCount));
    addResult("messageBytes",std::to_string(_messageBytes));
}
