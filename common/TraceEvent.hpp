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
// It depends on the embedding processs what is done to the Trace Events generated. In the WSD
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

    // Returns a string that can be inserted into the string representation of a JSON object between
    // two other properties. The string is either completely empty, or starts with a comma and
    // contains the property name "args" and as its value an object.

    static std::string createArgsString(const std::map<std::string, std::string>& args)
    {
        if (!recordingOn)
            return "";

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

    TraceEvent(const std::string &args)
        : _pid(-1)
        , _args(args)
    {
        if (recordingOn)
        {
            _pid = getpid();
        }
    }

    // This method needs to be implemented separately in the WSD and Kit processes. (WSD writes the
    // actual Trace Event log file, Kit just forwards the Trace Events to WSD for output.)
    static void emitOneRecording(const std::string &recording);

public:
    static void startRecording();
    static void stopRecording();

    static void emitInstantEvent(const std::string& name)
    {
        emitInstantEvent(name, "");
    }

    static void emitInstantEvent(const std::string& name, const std::map<std::string, std::string>& args)
    {
        emitInstantEvent(name, createArgsString(args));
    }

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
