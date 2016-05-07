/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <dlfcn.h>
#include <ftw.h>
#include <cassert>
#include <iostream>
#include <sys/types.h>
#include <dirent.h>

#include "Common.hpp"
#include "IoUtil.hpp"
#include "LOOLProtocol.hpp"
#include "Unit.hpp"
#include "Util.hpp"

#include <Poco/Timestamp.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Net/WebSocket.h>

const int NumToPrefork = 20;

// Inside the WSD process
class UnitPrefork : public UnitWSD
{
    int _numStarted;
    std::string _failure;
    Poco::Timestamp _startTime;
    std::vector< std::shared_ptr<Poco::Net::WebSocket> > _childSockets;

public:
    UnitPrefork()
        : _numStarted(0)
    {
        setHasKitHooks();
    }

    virtual void returnValue(int &retValue) override
    {
        // 0 when empty (success), otherwise failure.
        retValue = !_failure.empty();
    }

    virtual void preSpawnCount(int &numPrefork) override
    {
        numPrefork = NumToPrefork;
    }

    void getMemory(const std::shared_ptr<Poco::Net::WebSocket> &socket,
                   size_t &totalPSS, size_t &totalDirty)
    {
        /// Fetch memory usage data from the last process ...
        socket->sendFrame("unit-memdump: \n", sizeof("unit-memdump: \n")-1);

        static const Poco::Timespan waitTime(COMMAND_TIMEOUT_MS * 1000);
        if (!socket->poll(waitTime, Poco::Net::Socket::SELECT_READ))
        {
            _failure = "Timed out waiting for child to respond to unit-memdump command.";
            return;
        }

        int flags;
        char buffer[4096];
        const int length = IoUtil::receiveFrame(*socket, buffer, sizeof (buffer), flags);
        if (length <= 0 || ((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) == Poco::Net::WebSocket::FRAME_OP_CLOSE))
        {
            _failure = "Failed to read child response to unit-memdump command.";
            return;
        }

        const std::string memory = LOOLProtocol::getFirstLine(buffer, length);
        if (!memory.compare(0,6,"Error:"))
            _failure = memory;
        else
        {
//        std::cout << "Got memory stats '" << memory << "'" << std::endl;
            Poco::StringTokenizer tokens(memory, " ");
            assert (tokens.count() == 2);
            totalPSS += atoi(tokens[0].c_str());
            totalDirty += atoi(tokens[1].c_str());
        }
    }

    virtual void newChild(const std::shared_ptr<Poco::Net::WebSocket> &socket) override
    {
        ++_numStarted;
        _childSockets.push_back(socket);
        if (_numStarted >= NumToPrefork)
        {
            Poco::Timestamp::TimeDiff elapsed = _startTime.elapsed();

            std::cout << "Launched " << _numStarted << " in "
                      << (1.0 * elapsed)/Poco::Timestamp::resolution() << std::endl;
            size_t totalPSSKb = 0;
            size_t totalDirtyKb = 0;
            for (auto child : _childSockets)
                getMemory(child, totalPSSKb, totalDirtyKb);

            std::cout << "Memory use total   " << totalPSSKb << "k shared "
                      << totalDirtyKb << "k dirty" << std::endl;

            totalPSSKb /= _childSockets.size();
            totalDirtyKb /= _childSockets.size();
            std::cout << "Memory use average " << totalPSSKb << "k shared "
                      << totalDirtyKb << "k dirty" << std::endl;

            if (!_failure.empty())
                exitTest(TestResult::TEST_FAILED);
            else
                exitTest(TestResult::TEST_OK);
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
                len++;
//            fprintf(stdout, "does start with %s: '%s'\n", tag, line + len);
            return line + len;
        }
        else
            return 0;
    }

    std::string readMemorySizes(FILE *inStream)
    {
        size_t numPSSKb = 0;
        size_t numDirtyKb = 0;

        char line[4096];
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
//                fprintf(stdout, "fd: %s -> %s\n", ent->d_name, buffer);
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
        if (pipeCount > 2 || numUnexpected > 0)
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
        const auto token = LOOLProtocol::getFirstToken(message.c_str(), message.length());
        if (token == "unit-memdump:")
        {
            std::string memory;
            if (!_failure.empty())
                memory = _failure;
            else
                memory = readMemorySizes(_procSMaps) + "\n";
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
