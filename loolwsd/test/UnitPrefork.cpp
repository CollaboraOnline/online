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

#include "Util.hpp"
#include "Unit.hpp"
#include "LOOLProtocol.hpp"

#include <Poco/Timestamp.h>
#include <Poco/StringTokenizer.h>

const int NumToPrefork = 20;

// Inside the WSD process
class UnitPrefork : public UnitWSD
{
    int _numStarted;
    Poco::Timestamp _startTime;
    std::vector< std::shared_ptr<Poco::Net::WebSocket> > _childSockets;

public:
    UnitPrefork()
        : _numStarted(0)
    {
        setHasKitHooks();
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
        int flags;
        char buffer[4096];

        int length = socket->receiveFrame(buffer, sizeof (buffer), flags);
        std::string memory = LOOLProtocol::getFirstLine(buffer, length);

//        std::cout << "Got memory stats '" << memory << "'" << std::endl;
        Poco::StringTokenizer tokens(memory, " ");
        assert (tokens.count() == 2);
        totalPSS += atoi(tokens[0].c_str());
        totalDirty += atoi(tokens[1].c_str());
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
        return oss.str();
    }
}

// Inside the forkit & kit processes
class UnitKitPrefork : public UnitKit
{
    FILE *_procSMaps;

public:
    UnitKitPrefork()
        : _procSMaps(NULL)
    {
        std::cerr << "UnitKit Prefork init !\n";
    }
    ~UnitKitPrefork()
    {
        fclose(_procSMaps);
    }

    virtual void launchedKit(int pid) override
    {
        // by the magic of forking - this should appear
        // in the last kit child nearly fully formed.
        pids.push_back(pid);
    }

    virtual void postFork() override
    {
        // before we drop the caps we can even open our /proc files !
        std::string procName = std::string("/proc/") +
                               std::to_string(getpid()) +
                               std::string("/smaps");
        _procSMaps = fopen(procName.c_str(), "r");
    }

    virtual bool filterKitMessage(const std::shared_ptr<Poco::Net::WebSocket> &ws,
                                  std::string &message) override
    {
        std::string token = LOOLProtocol::getFirstToken(message.c_str(), message.length());
        if (token == "unit-memdump:")
        {
            std::string memory = readMemorySizes(_procSMaps) + "\n";
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
