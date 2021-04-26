/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <atomic>
#include <chrono>
#include <string>
#include <vector>

#include <sys/types.h>
#include <unistd.h>

class ProfileZone
{
private:
    static std::atomic<bool> s_bRecording; // true during recording
    static int s_nNesting;
    const char* m_sProfileId;
    std::chrono::time_point<std::chrono::system_clock> m_nCreateTime;
    int m_nPid;

    void addRecording();

public:
    // Note that the char pointer is stored as such in the ProfileZone object and used in the
    // destructor, so be sure to pass a pointer that stays valid for the duration of the object's
    // lifetime.
    ProfileZone(const char* sProfileId)
        : m_sProfileId(sProfileId ? sProfileId : "(null)")
    {
        if (s_bRecording)
        {
            // Use system_clock as that matches the clock_gettime(CLOCK_REALTIME) that core uses.
            m_nCreateTime = std::chrono::system_clock::now();

            m_nPid = getpid();

            s_nNesting++;
        }
    }
    ~ProfileZone()
    {
        if (s_bRecording)
        {
            s_nNesting--;
            addRecording();
        }
    }

    static void startRecording();
    static void stopRecording();

    static std::vector<std::string> getRecordingAndClear();
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
