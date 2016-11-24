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
#include <sys/time.h>
#include <sys/types.h>

#include <cassert>
#include <iostream>

#include <mutex>
#include <condition_variable>

#include <Poco/Timestamp.h>
#include <Poco/StringTokenizer.h>

#include "Common.hpp"
#include "IoUtil.hpp"
#include "LOOLProtocol.hpp"
#include <LOOLWebSocket.hpp>
#include "Log.hpp"
#include "Unit.hpp"
#include "Util.hpp"

const int NumToPrefork = 20;

// Inside the WSD process
class UnitPrefork : public UnitWSD
{
    std::string _failure;
    Poco::Timestamp _startTime;
    size_t _childPSS;
    size_t _childDirty;
    std::mutex _mutex;
    std::condition_variable _cv;
    std::vector< std::shared_ptr<LOOLWebSocket> > _childSockets;

public:
    UnitPrefork()
        : _childPSS(0),
          _childDirty(0)
    {
        setHasKitHooks();
#ifdef TEST_DIRTY_NUMBERS
        setTimeout(100 * 1000);
#endif
    }

    virtual void preSpawnCount(int &numPrefork) override
    {
        numPrefork = NumToPrefork;
    }

    virtual bool filterChildMessage(const std::vector<char>& payload) override
    {
        const std::string memory = LOOLProtocol::getFirstLine(payload);
        Poco::StringTokenizer tokens(memory, " ");
        if (tokens[0] == "error:")
        {
            _failure = memory;
        }
        else
        {
            LOG_INF("Got memory stats [" << memory << "].");
            assert(tokens.count() == 2);
            _childPSS = atoi(tokens[0].c_str());
            _childDirty = atoi(tokens[1].c_str());
        }

        // Don't signal before wait.
        std::unique_lock<std::mutex> lock(_mutex);
        _cv.notify_one();
        return true;
    }

    virtual void newChild(const std::shared_ptr<LOOLWebSocket> &socket) override
    {
        std::unique_lock<std::mutex> lock(_mutex);

        _childSockets.push_back(socket);
        LOG_INF("Unit-prefork: got new child, have " << _childSockets.size() << " of " << NumToPrefork);

        if (_childSockets.size() >= NumToPrefork)
        {
            Poco::Timestamp::TimeDiff elapsed = _startTime.elapsed();

            const auto totalTime = (1000. * elapsed)/Poco::Timestamp::resolution();
            LOG_INF("Launched " << _childSockets.size() << " in " << totalTime);
            size_t totalPSSKb = 0;
            size_t totalDirtyKb = 0;

            // Skip the last one as it's not completely initialized yet.
            for (size_t i = 0; i < _childSockets.size() - 1; ++i)
            {
                LOG_INF("Getting memory of child #" << i + 1 << " of " << _childSockets.size());

                _childSockets[i]->sendFrame("unit-memdump: \n", sizeof("unit-memdump: \n"));
                if (_cv.wait_for(lock, std::chrono::milliseconds(5 * 1000)) == std::cv_status::timeout)
                {
                    _failure = "Timed out waiting for child to respond to unit-memdump.";
                    std::cerr << _failure << std::endl;
                    exitTest(TestResult::TEST_FAILED);
                    return;
                }

                std::cerr << "child # " << i + 1 << " pss: " << _childPSS << " (totalPSS: " << (totalPSSKb + _childPSS)
                          << "), dirty: " << _childDirty << " (totalDirty: " << (totalDirtyKb + _childDirty) << std::endl;
                totalPSSKb += _childPSS;
                _childPSS = 0;
                totalDirtyKb += _childDirty;
                _childDirty = 0;
            }

            std::cerr << "Memory use total   " << totalPSSKb << "k shared "
                        << totalDirtyKb << "k dirty" << std::endl;

            totalPSSKb /= _childSockets.size();
            totalDirtyKb /= _childSockets.size();
            std::cerr << "Memory use average " << totalPSSKb << "k shared "
                        << totalDirtyKb << "k dirty" << std::endl;

            std::cerr << "Launch time total   " << totalTime << " ms" << std::endl;
            std::cerr << "Launch time average " << (totalTime / _childSockets.size()) << " ms" << std::endl;

            if (!_failure.empty())
            {
                std::cerr << "UnitPrefork failed due to: " << _failure << std::endl;
                exitTest(TestResult::TEST_FAILED);
            }
            else
            {
                std::cerr << "UnitPrefork success." << std::endl;
                exitTest(TestResult::TEST_OK);
            }
        }
    }
};

namespace
{
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
        LOG_INF("readMemorySize: [" << res << "].");
        if (res.empty())
        {
            LOG_ERR("Failed to read memory stats.");
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
                LOG_INF("fd:" << ent->d_name << " -> " << buffer);
                if (!strncmp(buffer, "/dev/", sizeof ("/dev/") -1))
                    deviceCount++;
                else if (extDot && !strcmp(extDot, ".res"))
                    resCount++;
                else if (extDot && !strcmp(extDot, ".rdb"))
                    rdbCount++;
                else if (strstr(buffer, "unit-prefork.log") || // our log
                         strstr(buffer, "loolwsd.log") || // debug log
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

    virtual bool filterKitMessage(const std::shared_ptr<LOOLWebSocket> &ws,
                                  std::string &message) override
    {
        const auto token = LOOLProtocol::getFirstToken(message);
        if (token == "unit-memdump:")
        {
#ifdef TEST_DIRTY_NUMBERS
            // Jitter the numbers so they're not all the same.
            struct timeval t;
            gettimeofday(&t, NULL);
            srand(t.tv_usec);
            size_t size = ((size_t)rand() * 4096 * 1024) / RAND_MAX;
            std::cerr << "allocate " << size << std::endl;
            memset (malloc (size), 0, size);
#endif
            std::string memory;
            if (!_failure.empty())
                memory = _failure;
            else
                memory = readMemorySizes(_procSMaps);
            LOG_INF("filterKitMessage sending back: [" << memory << "].");
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
