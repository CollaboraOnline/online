/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Turn this on to compile a test executable for just ProfileZone

// #define TEST_PROFILEZONE_EXE

#include <cassert>
#include <mutex>

#include <sys/syscall.h>

#include "ProfileZone.hpp"

std::atomic<bool> ProfileZone::s_bRecording(false);

thread_local int ProfileZone::s_nNesting = 0; // level of overlapped zones

namespace
{
std::vector<std::string> g_aRecording; // recorded data
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
    threadIdStr << Util::getThreadId();

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
        + threadIdStr.str() + "},");
    std::lock_guard<std::mutex> aGuard(g_aMutex);

    g_aRecording.emplace_back(sRecordingData);
}

std::vector<std::string> ProfileZone::getRecordingAndClear()
{
    bool bRecording;
    std::vector<std::string> aRecording;
    {
        std::lock_guard<std::mutex> aGuard(g_aMutex);
        bRecording = s_bRecording;
        stopRecording();
        aRecording.swap(g_aRecording);
    }
    // reset start time and nesting level
    if (bRecording)
        startRecording();
    return aRecording;
}

#ifdef TEST_PROFILEZONE_EXE

#include <iostream>
#include <thread>

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
        ProfileZone b("thread t3");

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

    auto v = ProfileZone::getRecordingAndClear();

    std::cout << "[\n";
    for (auto e : v)
        std::cout << "  " << e << "\n";
    std::cout << "]\n";

    // Intentional misuse: overlapping ProfileZones
    auto p1 = new ProfileZone("p1");
    auto p2 = new ProfileZone("p2");
    delete p1;
    delete p2;

    return 0;
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
