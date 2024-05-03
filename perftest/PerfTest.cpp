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
#include <sys/wait.h>
#include <sysexits.h>

#include <PerfTest.hpp>

//const std::chrono::steady_clock::time_point PerfTest::TEST_START_TIME = std::chrono::steady_clock::now();

PerfTest::PerfTest(const std::string &name, const std::string &server) :
    _name(name),
    _handler(std::make_shared<PerfTestSocketHandler>(name, server))
{
    addResult("name",_name);
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
    _handler->shutdown();
    Util::forcedExit(EX_SOFTWARE);
}

void PerfTest::printResults()
{
    std::cout << "{\n";
    for (auto const& [key, value] : _results) {
        std::cout << "    " << key << ": " << value << "\n";
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
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
    } while (!found && !timedout);

    double seconds = std::chrono::duration_cast<std::chrono::milliseconds>(now - _waitingStart).count()/1000.0;
    if (found) {
        LOG_DBG("Found message: " + substring + " after " + std::to_string(seconds) + "s");
    } else {
        abort("Timed out waiting for message \"" + substring + "\" after " + std::to_string(seconds) + "s");
    }
}

void PerfTest::waitForIdle(size_t timeout)
{
    LOG_DBG("PerfTest waitForIdle");
    sendMessage("uno .uno:WaitForIdle");
    waitForMessage("WaitForIdle",timeout);
}

void PerfTest::sendMessage(const std::string &message)
{
    LOG_DBG("PerfTest sendMessage: " + message);
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
    LOG_DBG("PerfTest Disconnected");
}

/*
void PerfTest::log(const std::string &message)
{
    std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now();
    unsigned int elapsedTime = std::chrono::duration_cast<std::chrono::milliseconds>(now - TEST_START_TIME).count();
    std::cerr << elapsedTime << "ms " <<  message << std::endl;
}
*/

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
        std::cerr<<"**** CHILD PROCESS FOR PERF****"<<std::endl;
        std::string pid_str = "--pid="+std::to_string(getCoolwsdPid());
        execlp("perf","perf","record","-s","-e","cycles","--freq=1000","--call-graph","dwarf",pid_str.c_str(),"--output=perf-output-coolwsd.data",(char *)NULL);
    } else {
        child_pid = pid;
    }
}

void CyclePerfTest::stopMeasurement()
{
    LOG_DBG("CyclePerfTest stopMeasurement");
    PerfTest::stopMeasurement();
    kill(child_pid,SIGINT);
    waitpid(child_pid, nullptr, 0);
    addResult("cycles","0");
    LOG_DBG("CyclePerfTest stopped");
}

pid_t CyclePerfTest::getCoolwsdPid()
{
    std::ifstream file;
    file.open("coolwsd.pid");
    pid_t pid;
    file >> pid;
    return pid;
}

MessagePerfTest::MessagePerfTest(const std::string &name, const std::string &server) :
    PerfTest(name, std::make_shared<MessagePerfTestSocketHandler>(name, server, _measuring, _messageCount, _messageBytes))
{
}

void MessagePerfTest::startMeasurement()
{
    PerfTest::startMeasurement();
    *_measuring = true;
}

void MessagePerfTest::stopMeasurement()
{
    PerfTest::stopMeasurement();
    *_measuring = false;
    addResult("messageCount",std::to_string(*_messageCount));
    addResult("messageBytes",std::to_string(*_messageBytes));
}
