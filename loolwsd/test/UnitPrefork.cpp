/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <dirent.h>
#include <dlfcn.h>
#include <ftw.h>
#include <sys/types.h>

#include <cassert>
#include <iostream>

#include <mutex>
#include <condition_variable>

#include <Poco/Timestamp.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Net/WebSocket.h>

#include "Common.hpp"
#include "IoUtil.hpp"
#include "LOOLProtocol.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "Util.hpp"

const int NumToPrefork = 20;

// Inside the WSD process
class UnitPrefork : public UnitWSD
{
    std::string _failure;
    Poco::Timestamp _startTime;
    size_t _totalPSS;
    size_t _totalDirty;
    std::mutex _mutex;
    std::condition_variable _cv;
    std::vector< std::shared_ptr<Poco::Net::WebSocket> > _childSockets;

public:
    UnitPrefork()
        : _totalPSS(0),
          _totalDirty(0)
    {
        setHasKitHooks();
    }

    virtual void returnValue(int &retValue) override
    {
        // 0 when empty (success), otherwise failure.
        if (!_failure.empty())
        {
            Log::error("UnitPrefork failed due to: " + _failure);
        }

        retValue = !_failure.empty();
    }

    virtual void preSpawnCount(int &numPrefork) override
    {
        numPrefork = NumToPrefork;
    }

    virtual bool filterChildMessage(const std::vector<char>& payload) override
    {
        const std::string memory = LOOLProtocol::getFirstLine(payload);
        if (!memory.compare(0,6,"Error:"))
        {
            _failure = memory;
        }
        else
        {
            Log::info("Got memory stats [" + memory + "].");
            Poco::StringTokenizer tokens(memory, " ");
            assert(tokens.count() == 2);
            _totalPSS += atoi(tokens[0].c_str());
            _totalDirty += atoi(tokens[1].c_str());
        }

        // Don't signal before wait.
        std::unique_lock<std::mutex> lock(_mutex);
        _cv.notify_one();
        return true;
    }

    bool getMemory(const std::shared_ptr<Poco::Net::WebSocket> &socket,
                   size_t &totalPSS, size_t &totalDirty)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        /// Fetch memory usage data from the last process ...
        socket->sendFrame("unit-memdump: \n", sizeof("unit-memdump: \n"));

        if (_cv.wait_for(lock, std::chrono::milliseconds(5 * 1000)) == std::cv_status::timeout)
        {
            _failure = "Timed out waiting for child to respond to unit-memdump.";
            Log::error(_failure);
            return false;
        }

        totalPSS = _totalPSS;
        totalDirty = _totalDirty;
        return true;
    }

    virtual void newChild(const std::shared_ptr<Poco::Net::WebSocket> &socket) override
    {
        _childSockets.push_back(socket);
        if (_childSockets.size() > NumToPrefork)
        {
            Poco::Timestamp::TimeDiff elapsed = _startTime.elapsed();

            auto totalTime = (1000. * elapsed)/Poco::Timestamp::resolution();
            Log::info() << "Launched " << _childSockets.size() << " in "
                        << totalTime << Log::end;
            size_t totalPSSKb = 0;
            size_t totalDirtyKb = 0;
            // Skip the last one as it's not completely initialized yet.
            for (size_t i = 0; i < _childSockets.size() - 1; ++i)
            {
                Log::info() << "Getting memory of child #" << i + 1 << " of " << _childSockets.size() << Log::end;
                if (!getMemory(_childSockets[i], totalPSSKb, totalDirtyKb))
                {
                    exitTest(TestResult::TEST_FAILED);
                    return;
                }
            }

            Log::info() << "Memory use total   " << totalPSSKb << "k shared "
                        << totalDirtyKb << "k dirty" << Log::end;

            totalPSSKb /= _childSockets.size();
            totalDirtyKb /= _childSockets.size();
            Log::info() << "Memory use average " << totalPSSKb << "k shared "
                        << totalDirtyKb << "k dirty" << Log::end;

            Log::info() << "Launch time total   " << totalTime << " ms" << Log::end;
            totalTime /= _childSockets.size();
            Log::info() << "Launch time average " << totalTime << " ms" << Log::end;

            if (!_failure.empty())
            {
                Log::error("UnitPrefork failed due to: " + _failure);
                exitTest(TestResult::TEST_FAILED);
            }
            else
            {
                Log::error("UnitPrefork success.");
                exitTest(TestResult::TEST_OK);
            }
        }
    }
};

namespace {
    std::vector<int> pids;

    const char *startsWith(const char *line, const char *tag)
    {
        int len = strlen(tag);
        if (!strncmp(line, tag, len))
        {
            while (!isdigit(line[len]) && line[len] != '\0')
                ++len;

            const auto str = std::string(line + len, strlen(line + len) - 1);
            return line + len;
        }

        return nullptr;
    }

    std::string readMemorySizes(FILE *inStream)
    {
        size_t numPSSKb = 0;
        size_t numDirtyKb = 0;

        char line[4096] = { 0 };
        while (fgets(line, sizeof (line), inStream))
        {
            const char *value;
            if ((value = startsWith(line, "Private_Dirty:")) ||
                (value = startsWith(line, "Shared_Dirty:")))
                numDirtyKb += atoi(value);
            else if ((value = startsWith(line, "Pss:")))
                numPSSKb += atoi(value);
        }

        std::ostringstream oss;
        oss << numPSSKb << " " << numDirtyKb;
        const auto res = oss.str();
        Log::info("readMemorySize: [" + res + "].");
        if (res.empty())
        {
            Log::error("Failed to read memory stats.");
            throw std::runtime_error("Failed to read memory stats.");
        }

        return res;
    }
}

// Inside the forkit & kit processes
class UnitKitPrefork : public UnitKit
{
    FILE *_procSMaps;
    std::string _failure;

public:
    UnitKitPrefork()
        : _procSMaps(NULL)
    {
        std::cerr << "UnitKit Prefork init !\n";
    }
    ~UnitKitPrefork()
    {
        if (_procSMaps)
            fclose(_procSMaps);
    }

    virtual void launchedKit(int pid) override
    {
        // by the magic of forking - this should appear
        // in the last kit child nearly fully formed.
        pids.push_back(pid);
    }

    // Check that we have no unexpected open sockets.
    void checkSockets()
    {
        DIR *fds = opendir ("/proc/self/fd");
        struct dirent *ent;
        int deviceCount = 0, rdbCount = 0, resCount = 0,
            numSockets = 0, numUnexpected = 0, pipeCount = 0;
        while ((ent = readdir(fds)))
        {
            if (ent->d_name[0] == '.')
                continue;
            char name[1024 + 32];
            char buffer[4096];
            strcpy (name, "/proc/self/fd/");
            strncat(name, ent->d_name, 1024);
            size_t len;
            memset(buffer, 0, sizeof(buffer));
            if ((len = readlink(name, buffer, sizeof(buffer)-1) > 0))
            {
                assert(len<sizeof(buffer));
                numSockets++;
                char *extDot = strrchr(buffer, '.');
                Log::info() << "fd:" << ent->d_name << " -> " << buffer << Log::end;
                if (!strncmp(buffer, "/dev/", sizeof ("/dev/") -1))
                    deviceCount++;
                else if (extDot && !strcmp(extDot, ".res"))
                    resCount++;
                else if (extDot && !strcmp(extDot, ".rdb"))
                    rdbCount++;
                else if (strstr(buffer, "unit-prefork.log") || // our log
                         (strstr(buffer, "/proc/") && // our readdir
                          strstr(buffer, "/fd")))
                    ; // ignore
                else if (!strncmp(buffer, "pipe:[", 6))
                    pipeCount++;
                else
                {
                    fprintf(stderr, "Unexpected descriptor: %s -> %s\n", ent->d_name, buffer);
                    numUnexpected++;
                }
            }
        }
        fprintf(stderr, "%d devices, %d rdb %d resources, %d pipes, %d descriptors total: %d unexpected\n",
                deviceCount, rdbCount, resCount, pipeCount, numSockets, numUnexpected);
        // 3 Pipes at most: 1 input, 1 output, file redirection (or so I imagine them).
        if (pipeCount > 3 || numUnexpected > 0)
            _failure = std::string("Error: unexpected inherited sockets ") +
                std::to_string(numUnexpected) + " and pipes " +
                std::to_string(pipeCount);
    }

    virtual void postFork() override
    {
        checkSockets();

        // before we drop the caps we can even open our /proc files !
        const std::string procName = std::string("/proc/") +
                                     std::to_string(getpid()) +
                                     std::string("/smaps");
        _procSMaps = fopen(procName.c_str(), "r");
        if (_procSMaps == NULL)
        {
            _failure = "Failed to open process: " + procName;
            throw std::runtime_error(_failure);
        }
    }

    virtual bool filterKitMessage(const std::shared_ptr<Poco::Net::WebSocket> &ws,
                                  std::string &message) override
    {
        const auto token = LOOLProtocol::getFirstToken(message);
        if (token == "unit-memdump:")
        {
            std::string memory;
            if (!_failure.empty())
                memory = _failure;
            else
                memory = readMemorySizes(_procSMaps);
            Log::info("filterKitMessage sending back: [" + memory + "].");
            ws->sendFrame(memory.c_str(), memory.length());
            return true;
        }

        return false;
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitPrefork();
}

UnitBase *unit_create_kit(void)
{
    return new UnitKitPrefork();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
