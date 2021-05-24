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
    static std::atomic<bool> s_bRecording; // true during recording
    thread_local static int s_nNesting;
    const char* m_sProfileId;
    std::chrono::time_point<std::chrono::system_clock> m_nCreateTime;
    int m_nPid;
    int m_nNesting;
    std::string m_sArgs;

    void addRecording();

    static std::string createArgsString(const std::map<std::string, std::string>& args)
    {
        if (args.size() == 0)
            return "";

        std::string sResult = ",\"args\":{";
        bool first = true;
        for (auto i : args)
        {
            if (!first)
                sResult += ',';
            sResult += '"';
            sResult += i.first;
            sResult += "\":\"";
            sResult += i.second;
            sResult += '"';
            first = false;
        }
        sResult += '}';

        return sResult;
    }

    ProfileZone(const char* sProfileId, const std::string sArgs)
        : m_sProfileId(sProfileId ? sProfileId : "(null)")
        , m_nPid(-1)
        , m_nNesting(-1)
        , m_sArgs(sArgs)
    {
        if (s_bRecording)
        {
            // Use system_clock as that matches the clock_gettime(CLOCK_REALTIME) that core uses.
            m_nCreateTime = std::chrono::system_clock::now();

            m_nPid = getpid();

            m_nNesting = s_nNesting++;
        }
    }

public:
    // Note that the char pointer is stored as such in the ProfileZone object and used in the
    // destructor, so be sure to pass a pointer that stays valid for the duration of the object's
    // lifetime.
    ProfileZone(const char* sProfileId, const std::map<std::string, std::string> &args)
        : ProfileZone(sProfileId, createArgsString(args))
    {
    }

    ProfileZone(const char* sProfileId)
        : ProfileZone(sProfileId, "")
    {
    }

    ~ProfileZone()
    {
        if (m_nCreateTime.time_since_epoch() > std::chrono::time_point<std::chrono::system_clock>().time_since_epoch())
        {
            s_nNesting--;

            if (m_nNesting != s_nNesting)
            {
#ifdef TEST_PROFILEZONE_EXE
                std::cerr << "Incorrect ProfileZone nesting for " << m_sProfileId << "\n";
#else
                LOG_WRN("Incorrect ProfileZone nesting for " << m_sProfileId);
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
