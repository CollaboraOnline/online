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

std::atomic<bool> TerminationFlag(false);
std::mutex SigHandlerTrap;

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

    /// Generates a random string suitable for
    /// file/directory names.
    std::string getFilename(const size_t length)
    {
        std::string s = getB64String(length);
        std::replace(s.begin(), s.end(), '/', '_');
        return s.substr(0, length);
    }
}
}

namespace
{
    void alertAllUsersAndLog(const std::string& message, const std::string& cmd, const std::string& kind)
    {
        Log::error(message);
        Util::alertAllUsers(cmd, kind);
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

    /// Create a secure, random directory path.
    std::string createRandomDir(const std::string& path)
    {
        const auto name = rng::getFilename(64);
        Poco::File(Poco::Path(path, name)).createDirectories();
        return name;
    }

    std::string getTempFilePath(const std::string& srcDir, const std::string& srcFilename)
    {
        const std::string srcPath = srcDir + '/' + srcFilename;
        const std::string dstPath = Poco::Path::temp() + encodeId(rng::getNext()) + '_' + srcFilename;
        Poco::File(srcPath).copyTo(dstPath);
        Poco::TemporaryFile::registerForDeletion(dstPath);
        return dstPath;
    }

    bool windowingAvailable()
    {
        return std::getenv("DISPLAY") != nullptr;
    }

    bool saveDataToFileSafely(const std::string& fileName, const char *data, size_t size)
    {
        const auto tempFileName = fileName + ".temp";
        std::fstream outStream(tempFileName, std::ios::out);

        // If we can't create the file properly, just remove it
        if (!outStream.good())
        {
            alertAllUsersAndLog("Creating " + tempFileName + " failed, disk full?", "internal", "diskfull");
            // Try removing both just in case
            std::remove(tempFileName.c_str());
            std::remove(fileName.c_str());
            return false;
        }
        else
        {
            outStream.write(data, size);
            if (!outStream.good())
            {
                alertAllUsersAndLog("Writing to " + tempFileName + " failed, disk full?", "internal", "diskfull");
                outStream.close();
                std::remove(tempFileName.c_str());
                std::remove(fileName.c_str());
                return false;
            }
            else
            {
                outStream.close();
                if (!outStream.good())
                {
                    alertAllUsersAndLog("Closing " + tempFileName + " failed, disk full?", "internal", "diskfull");
                    std::remove(tempFileName.c_str());
                    std::remove(fileName.c_str());
                    return false;
                }
                else
                {
                    // Everything OK, rename the file to its proper name
                    if (std::rename(tempFileName.c_str(), fileName.c_str()) == 0)
                    {
                        Log::debug() << "Renaming " << tempFileName << " to " << fileName << " OK." << Log::end;
                        return true;
                    }
                    else
                    {
                        alertAllUsersAndLog("Renaming " + tempFileName + " to " + fileName + " failed, disk full?", "internal", "diskfull");
                        std::remove(tempFileName.c_str());
                        std::remove(fileName.c_str());
                        return false;
                    }
                }
            }
        }
    }

} // namespace Util

namespace
{

    struct fs
    {
        fs(const std::string& p, dev_t d)
            : path(p), dev(d)
        {
        }

        fs(dev_t d)
            : fs("", d)
        {
        }

        std::string path;
        dev_t dev;
    };

    struct fsComparator
    {
        bool operator() (const fs& lhs, const fs& rhs) const
        {
            return (lhs.dev < rhs.dev);
        }
    };

    static std::mutex fsmutex;
    static std::set<fs, fsComparator> filesystems;
} // unnamed namespace

namespace Util
{
    void registerFileSystemForDiskSpaceChecks(const std::string& path)
    {
        std::lock_guard<std::mutex> lock(fsmutex);

        if (path != "")
        {
            std::string dirPath = path;
            std::string::size_type lastSlash = dirPath.rfind('/');
            assert(lastSlash != std::string::npos);
            dirPath = dirPath.substr(0, lastSlash + 1) + ".";

            struct stat s;
            if (stat(dirPath.c_str(), &s) == -1)
                return;
            filesystems.insert(fs(dirPath, s.st_dev));
        }
    }

    void checkDiskSpaceOnRegisteredFileSystems()
    {
        std::lock_guard<std::mutex> lock(fsmutex);

        static std::chrono::steady_clock::time_point lastCheck;
        std::chrono::steady_clock::time_point now(std::chrono::steady_clock::now());

        // Don't check more often that once a minute
        if (std::chrono::duration_cast<std::chrono::seconds>(now - lastCheck).count() < 60)
            return;

        lastCheck = now;

        for (auto& i: filesystems)
        {
            if (!checkDiskSpace(i.path))
            {
                alertAllUsersAndLog("File system of " + i.path + " dangerously low on disk space", "internal", "diskfull");
                break;
            }
        }
    }

    bool checkDiskSpace(const std::string& path)
    {
        assert(path != "");
        struct statfs sfs;
        if (statfs(path.c_str(), &sfs) == -1)
            return true;

        if (static_cast<double>(sfs.f_bavail) / sfs.f_blocks <= 0.05)
            return false;
        return true;
    }

    const char *signalName(const int signo)
    {
        switch (signo)
        {
#define CASE(x) case SIG##x: return "SIG" #x
            CASE(HUP);
            CASE(INT);
            CASE(QUIT);
            CASE(ILL);
            CASE(ABRT);
            CASE(FPE);
            CASE(KILL);
            CASE(SEGV);
            CASE(PIPE);
            CASE(ALRM);
            CASE(TERM);
            CASE(USR1);
            CASE(USR2);
            CASE(CHLD);
            CASE(CONT);
            CASE(STOP);
            CASE(TSTP);
            CASE(TTIN);
            CASE(TTOU);
            CASE(BUS);
#ifdef SIGPOLL
            CASE(POLL);
#endif
            CASE(PROF);
            CASE(SYS);
            CASE(TRAP);
            CASE(URG);
            CASE(VTALRM);
            CASE(XCPU);
            CASE(XFSZ);
#ifdef SIGEMT
            CASE(EMT);
#endif
#ifdef SIGSTKFLT
            CASE(STKFLT);
#endif
#if defined(SIGIO) && SIGIO != SIGPOLL
            CASE(IO);
#endif
#ifdef SIGPWR
            CASE(PWR);
#endif
#ifdef SIGLOST
            CASE(LOST);
#endif
            CASE(WINCH);
#if defined(SIGINFO) && SIGINFO != SIGPWR
            CASE(INFO);
#endif
#undef CASE
        default:
            return "unknown";
        }
    }

    static
    void handleTerminationSignal(const int signal)
    {
        if (!TerminationFlag)
        {
            TerminationFlag = true;

            Log::signalLogPrefix();
            Log::signalLog(" Termination signal received: ");
            Log::signalLog(signalName(signal));
            Log::signalLog("\n");
        }
    }

    void setTerminationSignals()
    {
        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleTerminationSignal;

        sigaction(SIGTERM, &action, nullptr);
        sigaction(SIGINT, &action, nullptr);
        sigaction(SIGQUIT, &action, nullptr);
        sigaction(SIGHUP, &action, nullptr);
    }

    static char FatalGdbString[256] = { '\0' };

    static
    void handleFatalSignal(const int signal)
    {
        std::unique_lock<std::mutex> lock(SigHandlerTrap);

        Log::signalLogPrefix();
        Log::signalLog(" Fatal signal received: ");
        Log::signalLog(signalName(signal));
        Log::signalLog("\n");

        if (std::getenv("LOOL_DEBUG"))
        {
            Log::signalLog(FatalGdbString);
            LOG_ERR("Sleeping 30s to allow debugging.");
            sleep(30);
        }

        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = SIG_DFL;

        sigaction(signal, &action, NULL);

        char header[32];
        sprintf(header, "Backtrace %d:\n", getpid());

        const int maxSlots = 50;
        void *backtraceBuffer[maxSlots];
        int numSlots = backtrace(backtraceBuffer, maxSlots);
        if (numSlots > 0)
        {
            char **symbols = backtrace_symbols(backtraceBuffer, numSlots);
            if (symbols != NULL)
            {
                struct iovec ioVector[maxSlots*2+1];
                ioVector[0].iov_base = (void*)header;
                ioVector[0].iov_len = std::strlen((const char*)ioVector[0].iov_base);
                for (int i = 0; i < numSlots; i++)
                {
                    ioVector[1+i*2+0].iov_base = symbols[i];
                    ioVector[1+i*2+0].iov_len = std::strlen((const char *)ioVector[1+i*2+0].iov_base);
                    ioVector[1+i*2+1].iov_base = (void*)"\n";
                    ioVector[1+i*2+1].iov_len = 1;
                }

                if (writev(STDERR_FILENO, ioVector, numSlots*2+1) == -1)
                {
                    Log::syserror("Failed to dump backtrace to stderr.");
                }
            }
        }

        if (std::getenv("LOOL_DEBUG"))
        {
            LOG_ERR("Sleeping 30s to allow debugging.");
            sleep(30);
        }

        // let default handler process the signal
        kill(Poco::Process::id(), signal);
    }

    void setFatalSignals()
    {
        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleFatalSignal;

        sigaction(SIGSEGV, &action, NULL);
        sigaction(SIGBUS, &action, NULL);
        sigaction(SIGABRT, &action, NULL);
        sigaction(SIGILL, &action, NULL);
        sigaction(SIGFPE, &action, NULL);

        // prepare this in advance just in case.
        std::ostringstream stream;
        stream << "\nFatal signal! Attach debugger with:\n"
               << "sudo gdb --pid=" << Poco::Process::id() << "\n or \n"
               << "sudo gdb --q --n --ex 'thread apply all backtrace full' --batch --pid="
               << Poco::Process::id() << "\n";
        std::string streamStr = stream.str();
        assert (sizeof (FatalGdbString) > strlen(streamStr.c_str()) + 1);
        strncpy(FatalGdbString, streamStr.c_str(), sizeof(FatalGdbString));
    }

    void requestTermination(const Poco::Process::PID& pid)
    {
        try
        {
            Poco::Process::requestTermination(pid);
        }
        catch(const Poco::Exception& exc)
        {
            Log::warn("Util::requestTermination: Exception: " + exc.message());
        }
    }

    int getMemoryUsage(const Poco::Process::PID nPid)
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

        int nMem = -1;
        try
        {
            nMem = std::stoi(sResponse);
        }
        catch(const std::exception&)
        {
            Log::warn() << "Trying to find memory of invalid/dead PID " << nPid << Log::end;
        }

        return nMem;
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
            Log::syserror("Cannot set thread name to " + s + ".");
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
