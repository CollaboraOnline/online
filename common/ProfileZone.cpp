/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// To build a freestanding test executable for just ProfileZone:
// clang++ -DTEST_PROFILEZONE_EXE ProfileZone.cpp -o ProfileZone -pthread

#include <cassert>
#include <mutex>
#include <sstream>

#include "ProfileZone.hpp"

std::atomic<bool> ProfileZone::s_bRecording(false);

thread_local int ProfileZone::s_nNesting = 0; // level of overlapped zones

namespace
{
std::mutex g_aMutex;
}

void ProfileZone::startRecording()
{
    std::lock_guard<std::mutex> aGuard(g_aMutex);
    s_nNesting = 0;
    s_bRecording = true;
}

void ProfileZone::stopRecording() { s_bRecording = false; }

void ProfileZone::addRecording()
{
    assert(s_bRecording);

    std::stringstream threadIdStr;
#ifdef TEST_PROFILEZONE_EXE
    static thread_local int threadId = 0;
    static int threadCounter = 1;

    if (!threadId)
        threadId = threadCounter++;

    std::stringstream thredIdStr;
    threadIdStr << threadId;
#else
    threadIdStr << Util::getThreadId();
#endif
    auto nNow = std::chrono::system_clock::now();

    // Generate a single "Complete Event" (type X)
    auto nDuration = nNow - m_nCreateTime;
    std::string sRecordingData(
        "{"
        "\"name\":\""
        + std::string(m_sProfileId)
        + "\","
          "\"ph\":\"X\","
          "\"ts\":"
        + std::to_string(std::chrono::duration_cast<std::chrono::microseconds>(
                             m_nCreateTime.time_since_epoch())
                             .count())
        + ","
          "\"dur\":"
        + std::to_string(std::chrono::duration_cast<std::chrono::microseconds>(nDuration).count())
        + ","
          "\"pid\":"
        + std::to_string(m_nPid)
        + ","
          "\"tid\":"
        + threadIdStr.str()
        + m_sArgs
        + "}"
        // We add a trailing comma and newline, it is up to the code that handles these "recordings"
        // (outputs them into a JSON array) to remove the final comma before adding the terminating
        // ']'.
        + ",\n");
    std::lock_guard<std::mutex> aGuard(g_aMutex);
    addOneRecording(sRecordingData);
}

#ifdef BUILDING_TESTS

void ProfileZone::addOneRecording(const std::string &sRecording)
{
    // Dummy.
    (void) sRecording;
}

#endif // BUILDING_TESTS

#ifdef TEST_PROFILEZONE_EXE

#include <iostream>
#include <thread>

static std::vector<std::string> g_aRecording;

void ProfileZone::addOneRecording(const std::string &sRecording)
{
    g_aRecording.emplace_back(sRecording);
}

int main(int argc, char** argv)
{
    ProfileZone::startRecording();

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
            volatile auto x = n * 42;
            (void)x;
        }
    });

    std::thread t3([]() {
        ProfileZone b("thread t3", { { "foo", "bar"} } );

        for (auto n = 0; n < 400000000; n++)
        {
            volatile auto x = n * 42;
            (void)x;
        }
    });

    {
        ProfileZone b("second block");

        for (auto n = 0; n < 300000000; n++)
        {
            volatile auto x = n * 42;
            (void)x;
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

    std::cout << "[\n";
    for (auto e : g_aRecording)
        std::cout << "  " << e << "\n";
    std::cout << "]\n";

    return 0;
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
