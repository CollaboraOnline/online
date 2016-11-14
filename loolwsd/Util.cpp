/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "Util.hpp"
#include "config.h"

#include <execinfo.h>
#include <csignal>
#include <sys/poll.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/uio.h>
#include <sys/vfs.h>
#include <unistd.h>

#include <atomic>
#include <cassert>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <random>
#include <sstream>
#include <string>
#include <thread>

#include <Poco/Base64Encoder.h>
#include <Poco/ConsoleChannel.h>
#include <Poco/Exception.h>
#include <Poco/Format.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Process.h>
#include <Poco/RandomStream.h>
#include <Poco/TemporaryFile.h>
#include <Poco/Thread.h>
#include <Poco/Timestamp.h>
#include <Poco/Util/Application.h>

#include "Common.hpp"
#include "Log.hpp"
#include "Util.hpp"

namespace Util
{
namespace rng
{
    static std::random_device _rd;
    static std::mutex _rngMutex;
    static Poco::RandomBuf _randBuf;

    // Create the prng with a random-device for seed.
    // If we don't have a hardware random-device, we will get the same seed.
    // In that case we are better off with an arbitrary, but changing, seed.
    static std::mt19937_64 _rng = std::mt19937_64(_rd.entropy()
                                                ? _rd()
                                                : (clock() + getpid()));

    // A new seed is used to shuffle the sequence.
    // N.B. Always reseed after getting forked!
    void reseed()
    {
        _rng.seed(_rd.entropy() ? _rd() : (clock() + getpid()));
    }

    // Returns a new random number.
    unsigned getNext()
    {
        std::unique_lock<std::mutex> lock(_rngMutex);
        return _rng();
    }

    std::vector<char> getBytes(const size_t length)
    {
        std::vector<char> v(length);
        _randBuf.readFromDevice(v.data(), v.size());
        return v;
    }

    /// Generates a random string in Base64.
    /// Note: May contain '/' characters.
    std::string getB64String(const size_t length)
    {
        std::stringstream ss;
        Poco::Base64Encoder b64(ss);
        b64.write(getBytes(length).data(), length);
        return ss.str().substr(0, length);
    }

    std::string getFilename(const size_t length)
    {
        std::string s = getB64String(length);
        std::replace(s.begin(), s.end(), '/', '_');
        return s.substr(0, length);
    }
}
}

namespace Util
{
    std::string encodeId(const unsigned number, const int padding)
    {
        std::ostringstream oss;
        oss << std::hex << std::setw(padding) << std::setfill('0') << number;
        return oss.str();
    }

    unsigned decodeId(const std::string& str)
    {
        unsigned id = 0;
        std::stringstream ss;
        ss << std::hex << str;
        ss >> id;
        return id;
    }

    bool windowingAvailable()
    {
        return std::getenv("DISPLAY") != nullptr;
    }

} // namespace Util

namespace Util
{
    int getMemoryUsage(const Poco::Process::PID nPid)
    {
        try
        {
            //TODO: Instead of RSS, return PSS
            const auto cmd = "ps o rss= -p " + std::to_string(nPid);
            FILE* fp = popen(cmd.c_str(), "r");
            if (fp == nullptr)
            {
                return 0;
            }

            std::string sResponse;
            char cmdBuffer[1024];
            while (fgets(cmdBuffer, sizeof(cmdBuffer) - 1, fp) != nullptr)
            {
                sResponse += cmdBuffer;
            }
            pclose(fp);

            return std::stoi(sResponse);
        }
        catch(const std::exception&)
        {
            Log::warn() << "Trying to find memory of invalid/dead PID " << nPid << Log::end;
        }

        return -1;
    }

    std::string replace(const std::string& s, const std::string& a, const std::string& b)
    {
        std::string result = s;
        std::string::size_type pos;
        while ((pos = result.find(a)) != std::string::npos)
        {
            result = result.replace(pos, a.size(), b);
        }
        return result;
    }

    std::string formatLinesForLog(const std::string& s)
    {
        std::string r;
        std::string::size_type n = s.size();
        if (n > 0 && s.back() == '\n')
            r = s.substr(0, n-1);
        else
            r = s;
        return replace(r, "\n", " / ");
    }

    void setThreadName(const std::string& s)
    {
        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(s.c_str()), 0, 0, 0) != 0)
        {
            LOG_SYS("Cannot set thread name to " << s << ".");
        }
    }

    void getVersionInfo(std::string& version, std::string& hash)
    {
        version = std::string(LOOLWSD_VERSION);
        hash = std::string(LOOLWSD_VERSION_HASH);
        hash.resize(std::min(8, (int)hash.length()));
    }

    std::string UniqueId()
    {
        static std::atomic_int counter(0);
        return std::to_string(Poco::Process::id()) + "/" + std::to_string(counter++);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
