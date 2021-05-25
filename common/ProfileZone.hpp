/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <atomic>
#include <chrono>
#include <map>
#include <string>
#include <vector>

#include <sys/types.h>
#include <unistd.h>

#ifdef TEST_PROFILEZONE_EXE
#include <iostream>
#else
#include <Log.hpp>
#endif

class ProfileZone
{
private:
    static std::atomic<bool> recordingOn; // true during recording
    thread_local static int threadLocalNesting;
    const char* profileId;
    std::chrono::time_point<std::chrono::system_clock> createTime;
    int pid;
    int nesting;
    std::string args;

    void addRecording();

    static std::string createArgsString(const std::map<std::string, std::string>& args)
    {
        if (args.size() == 0)
            return "";

        std::string result = ",\"args\":{";
        bool first = true;
        for (auto i : args)
        {
            if (!first)
                result += ',';
            result += '"';
            result += i.first;
            result += "\":\"";
            result += i.second;
            result += '"';
            first = false;
        }
        result += '}';

        return result;
    }

    ProfileZone(const char* id, const std::string &argumentString)
        : profileId(id ? id : "(null)")
        , pid(-1)
        , nesting(-1)
        , args(argumentString)
    {
        if (recordingOn)
        {
            // Use system_clock as that matches the clock_gettime(CLOCK_REALTIME) that core uses.
            createTime = std::chrono::system_clock::now();

            pid = getpid();

            nesting = threadLocalNesting++;
        }
    }

    // This method needs to be implemented separately in the WSD and Kit processes. (WSD writes the
    // actual Trace Event log file, Kit just forwards the Trace Events to WSD for output.)
    static void addOneRecording(const std::string &recording);

public:
    // Note that the char pointer is stored as such in the ProfileZone object and used in the
    // destructor, so be sure to pass a pointer that stays valid for the duration of the object's
    // lifetime.
    ProfileZone(const char* id, const std::map<std::string, std::string> &arguments)
        : ProfileZone(id, createArgsString(arguments))
    {
    }

    ProfileZone(const char* id)
        : ProfileZone(id, "")
    {
    }

    ~ProfileZone()
    {
        if (pid > 0)
        {
            threadLocalNesting--;

            if (nesting != threadLocalNesting)
            {
#ifdef TEST_PROFILEZONE_EXE
                std::cerr << "Incorrect ProfileZone nesting for " << profileId << "\n";
#else
                LOG_WRN("Incorrect ProfileZone nesting for " << profileId);
#endif
            }
            else
            {
                addRecording();
            }
        }
    }

    ProfileZone(const ProfileZone&) = delete;
    void operator=(const ProfileZone&) = delete;

    static void startRecording();
    static void stopRecording();

    static std::vector<std::string> getRecordingAndClear();
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
