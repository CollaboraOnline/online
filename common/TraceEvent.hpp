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

#ifdef TEST_TRACEEVENT_EXE
#include <iostream>
#else
#include <Log.hpp>
#endif

// The base class for objects generating Trace Events when enabled.
//
// It depends on the embedding process what is done to the Trace Events generated. In the WSD
// process they are written to the Trace Event log file as generated (as buffered by the C++
// library). In the Kit process they are buffered and then sent to the WSD process for writing to
// the same log file. In the TraceEvent test program they are written out to stdout.

class TraceEvent
{
private:
    static void emitInstantEvent(const std::string& name, const std::string& args);

protected:
    static std::atomic<bool> recordingOn; // True during recoding/emission
    int _pid;
    std::string _args;
    thread_local static int threadLocalNesting; // For use only by the ProfileZone derived class

    static long getThreadId()
    {
#ifdef TEST_TRACEEVENT_EXE
        static thread_local int threadId = 0;
        static std::atomic<int> threadCounter(1);

        if (!threadId)
            threadId = threadCounter++;
        return threadId;
#else
    return Util::getThreadId();
#endif
    }

    static std::string createArgsString(const std::map<std::string, std::string>& args)
    {
        if (!recordingOn)
            return "0";

        std::string result = "{";
        bool first = true;
        for (const auto& i : args)
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

    TraceEvent(const std::string &args)
        : _pid(-1)
        , _args(args)
    {
        if (recordingOn)
        {
            _pid = getpid();
        }
    }

public:
    static void startRecording();
    static void stopRecording();
    static bool isRecordingOn()
    {
        return recordingOn;
    }

    static void emitInstantEvent(const std::string& name)
    {
        emitInstantEvent(name, "");
    }

    static void emitInstantEvent(const std::string& name, const std::map<std::string, std::string>& args)
    {
        emitInstantEvent(name, createArgsString(args));
    }

    // These methods need to be implemented separately in the WSD and Kit processes. (WSD writes the
    // actual Trace Event log file, Kit just forwards the Trace Events to WSD for output.)

    // This should do its thing if Trace Event generation is enabled, even if not turned on. Used
    // for metadata that will be needed by a Trace Event viewer if Trace Event generation is turned
    // on later during the process life-time.
    static void emitOneRecordingIfEnabled(const std::string &recording);

    // Unless Trace Event generation is enabled and turned on, this should do nothing.
    static void emitOneRecording(const std::string &recording);

    TraceEvent(const TraceEvent&) = delete;
    void operator=(const TraceEvent&) = delete;
};

class NamedEvent : public TraceEvent
{
protected:
    const std::string _name;

    NamedEvent(const std::string& name)
        : TraceEvent("")
        , _name(name)
    {
    }

    NamedEvent(const std::string& name, const std::string& args)
        : TraceEvent(args)
        , _name(name)
    {
    }

    NamedEvent(const std::string& name, const std::map<std::string, std::string>& args)
        : TraceEvent(createArgsString(args))
        , _name(name)
    {
    }
};

class ProfileZone : public NamedEvent
{
private:
    std::chrono::time_point<std::chrono::system_clock> _createTime;
    int _nesting;

    void emitRecording();

    ProfileZone(const std::string& name, const std::string &args)
        : NamedEvent(name, args)
        , _nesting(-1)
    {
        if (recordingOn)
        {
            // Use system_clock as that matches the clock_gettime(CLOCK_REALTIME) that core uses.
            _createTime = std::chrono::system_clock::now();

            _nesting = threadLocalNesting++;
        }
    }

public:
    ProfileZone(const std::string& name, const std::map<std::string, std::string> &arguments)
        : ProfileZone(name, createArgsString(arguments))
    {
    }

    ProfileZone(const char* id)
        : ProfileZone(id, "")
    {
    }

    ~ProfileZone()
    {
        if (_pid > 0)
        {
            threadLocalNesting--;

            if (_nesting != threadLocalNesting)
            {
#ifdef TEST_TRACEEVENT_EXE
                std::cerr << "Incorrect ProfileZone nesting for " << _name << "\n";
#else
                LOG_WRN("Incorrect ProfileZone nesting for " << _name);
#endif
            }
            else
            {
                emitRecording();
            }
        }
    }

    ProfileZone(const ProfileZone&) = delete;
    void operator=(const ProfileZone&) = delete;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
