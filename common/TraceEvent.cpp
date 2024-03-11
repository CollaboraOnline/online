/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// To build a freestanding test executable for just Tracevent:
// clang++ -Wall -Wextra -DTEST_TRACEEVENT_EXE TraceEvent.cpp -o TraceEvent -pthread

#include "config.h"

#include <cassert>
#include <mutex>
#include <sstream>

#include "TraceEvent.hpp"

std::atomic<bool> TraceEvent::recordingOn(false);

thread_local int TraceEvent::threadLocalNesting = 0; // level of overlapped zones

static std::mutex mutex;

void TraceEvent::emitInstantEvent(const std::string& name, const std::string& argsOrEmpty)
{
    if (!recordingOn)
        return;

    emitOneRecording("{"
                     "\"name\":\""
                     + name
                     + "\","
                       "\"ph\":\"i\""
                     + ",\"ts\":"
                     + std::to_string(std::chrono::duration_cast<std::chrono::microseconds>(
                              std::chrono::system_clock::now().time_since_epoch())
                              .count())
                     + ","
                       "\"pid\":"
                     + std::to_string(getpid())
                     + ","
                       "\"tid\":"
                     + std::to_string(getThreadId())
                     + (argsOrEmpty.length() == 0 ? "" : ",\"args\":" + argsOrEmpty)
                     + "}"
                     // We add a trailing comma and newline, it is up to the code that handles these "recordings"
                     // (outputs them into a JSON array) to remove the final comma before adding the terminating
                     // ']'.
                       ",\n");
}

void TraceEvent::startRecording()
{
    recordingOn = true;
    threadLocalNesting = 0;
}

void TraceEvent::stopRecording() { recordingOn = false; }

void ProfileZone::emitRecording()
{
    if (!recordingOn)
        return;

    // Generate a single "Complete Event" (type X)
    const auto duration = std::chrono::system_clock::now() - _createTime;

    std::ostringstream oss;
    oss << "{"
           "\"name\":\""
        << name()
        << "\","
           "\"ph\":\"X\","
           "\"ts\":"
        << std::chrono::duration_cast<std::chrono::microseconds>(_createTime.time_since_epoch())
               .count()
        << ","
           "\"dur\":"
        << std::chrono::duration_cast<std::chrono::microseconds>(duration).count()
        << ","
           "\"pid\":"
        << pid()
        << ","
           "\"tid\":"
        << getThreadId();

    if (!args().empty())
    {
        oss << ",\"args\":" << args();
    }

    oss << "},";
    std::string recordingData = oss.str();

    std::lock_guard<std::mutex> guard(mutex);
    emitOneRecording(recordingData);
}

#ifdef TEST_TRACEEVENT_EXE

#include <iostream>
#include <thread>

void TraceEvent::emitOneRecording(const std::string &recording)
{
    std::cout << "  " << recording;
}

int main(int, char**)
{
    std::cout << "[\n";

    TraceEvent::startRecording();

    {
        ProfileZone b("first block");

        for (auto n = 0; n < 100000000; n++)
        {
            volatile auto x = n * 42;
            (void)x;
        }
    }

    std::thread t1([]() {
        ProfileZone b("thread t1");

        for (auto n = 0; n < 400000000; n++)
        {
            volatile auto x = n * 42;
            (void)x;
        }
    });

    std::thread t2([]() {
        ProfileZone b("thread t2");

        for (auto n = 0; n < 400000000; n++)
        {
            auto x = n * 42ll;
            if (n % 50000000 == 0)
                TraceEvent::emitInstantEvent("instant t2." + std::to_string(x));
        }
    });

    std::thread t3([]() {
        ProfileZone b("thread t3", { { "foo", "bar"} } );

        for (auto n = 0; n < 400000000; n++)
        {
            auto x = n * 42ll;
            if (n % 50000000 == 0)
                TraceEvent::emitInstantEvent("instant t3." + std::to_string(x));
        }
    });

    {
        ProfileZone b("second block");

        for (auto n = 0; n < 300000000; n++)
        {
            auto x = n * 42ll;
            if (n % 50000000 == 0)
                TraceEvent::emitInstantEvent("instant m." + std::to_string(x));
        }
    }

    t1.join();
    t2.join();
    t3.join();

    // Intentional misuse: overlapping ProfileZones. Will generate "Incorrect ProfileZone nesting" messages.
    auto p1 = new ProfileZone("p1");
    auto p2 = new ProfileZone("p2");
    delete p1;
    delete p2;

    // Add a dummy integer last in the array to avoid incorrect JSON syntax
    std::cout << "  0\n";
    std::cout << "]\n";

    return 0;
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
