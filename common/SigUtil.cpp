/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "SigUtil.hpp"

#if !defined(__ANDROID__)
#  include <execinfo.h>
#endif
#include <csignal>
#include <sys/poll.h>
#include <sys/uio.h>
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
#include <sstream>
#include <string>
#include <thread>
#include <array>

#include <Socket.hpp>
#include "Common.hpp"
#include "Log.hpp"

#ifndef IOS
static std::atomic<bool> TerminationFlag(false);
static std::atomic<bool> DumpGlobalState(false);
static std::atomic<bool> ShutdownRequestFlag(false);
#endif

static size_t ActivityStringIndex = 0;
static std::array<std::string,8> ActivityStrings;

namespace SigUtil
{
#ifndef IOS
    bool getShutdownRequestFlag()
    {
        // ShutdownRequestFlag must be set if TerminationFlag is set.
        assert(!TerminationFlag || ShutdownRequestFlag);
        return ShutdownRequestFlag;
    }

    bool getTerminationFlag()
    {
        // ShutdownRequestFlag must be set if TerminationFlag is set.
        assert(!TerminationFlag || ShutdownRequestFlag);
        return TerminationFlag;
    }

    void setTerminationFlag()
    {
        // Set the forced-termination flag.
        TerminationFlag = true;
#if !MOBILEAPP
        // And request shutting down and wake-up the thread.
        requestShutdown();
#endif
    }

#if MOBILEAPP
    void resetTerminationFlags()
    {
        TerminationFlag = false;
        ShutdownRequestFlag = false;
    }
#endif
#endif // !IOS

    void checkDumpGlobalState(GlobalDumpStateFn dumpState)
    {
#if !MOBILEAPP
        if (DumpGlobalState)
        {
            dumpState();
            DumpGlobalState = false;
        }
#endif
    }

    void addActivity(const std::string &message)
    {
        ActivityStrings[ActivityStringIndex++ % ActivityStrings.size()] = message;
    }

#if !MOBILEAPP
    /// This traps the signal-handler so we don't _Exit
    /// while dumping stack trace. It's re-entrant.
    /// Used to safely increment and decrement the signal-handler trap.
    class SigHandlerTrap
    {
        static std::atomic<int> SigHandling;
    public:
        SigHandlerTrap() { ++SigHandlerTrap::SigHandling; }
        ~SigHandlerTrap() { --SigHandlerTrap::SigHandling; }

        /// Check that we have exclusive access to the trap.
        /// Otherwise, there is another signal in progress.
        bool isExclusive() const
        {
            // Return true if we are alone.
            return SigHandlerTrap::SigHandling == 1;
        }

        /// Wait for the trap to clear.
        static void wait()
        {
            while (SigHandlerTrap::SigHandling)
                sleep(1);
        }
    };
    std::atomic<int> SigHandlerTrap::SigHandling;

    void waitSigHandlerTrap()
    {
        SigHandlerTrap::wait();
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
        bool hardExit = false;
        const char *domain;
        if (!ShutdownRequestFlag && (signal == SIGINT || signal == SIGTERM))
        {
            domain = " Shutdown signal received: ";
            ShutdownRequestFlag = true;
        }
        else if (!TerminationFlag)
        {
            domain = " Forced-Termination signal received: ";
            TerminationFlag = true;
        }
        else
        {
            domain = " ok, ok - hard-termination signal received: ";
            hardExit = true;
        }
        Log::signalLogPrefix();
        Log::signalLog(domain);
        Log::signalLog(signalName(signal));
        Log::signalLog("\n");

        if (!hardExit)
            SocketPoll::wakeupWorld();
        else
        {
            ::signal (signal, SIG_DFL);
            ::raise (signal);
        }
    }

    void requestShutdown()
    {
        ShutdownRequestFlag = true;
        SocketPoll::wakeupWorld();
    }

    void setTerminationSignals()
    {
        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleTerminationSignal;

        sigaction(SIGINT, &action, nullptr);
        sigaction(SIGTERM, &action, nullptr);
        sigaction(SIGQUIT, &action, nullptr);
        sigaction(SIGHUP, &action, nullptr);
    }

    static char *VersionInfo = nullptr;
    static char FatalGdbString[256] = { '\0' };

    static
    void handleFatalSignal(const int signal)
    {
        SigHandlerTrap guard;
        bool bReEntered = !guard.isExclusive();

        Log::signalLogPrefix();

        // Heap corruption can re-enter through backtrace.
        if (bReEntered)
            Log::signalLog(" Fatal double signal received: ");
        else
            Log::signalLog(" Fatal signal received: ");
        Log::signalLog(signalName(signal));
        Log::signalLog("\n");

        Log::signalLog("Recent activity:\n");
        for (size_t i = 0; i < ActivityStrings.size(); ++i)
        {
            size_t idx = (ActivityStringIndex + i) % ActivityStrings.size();
            if (!ActivityStrings[idx].empty())
            {
                // no plausible impl. will heap allocate in c_str.
                Log::signalLog("\t");
                Log::signalLog(ActivityStrings[idx].c_str());
                Log::signalLog("\n");
            }
        }

        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = SIG_DFL;

        sigaction(signal, &action, nullptr);

        if (!bReEntered)
            dumpBacktrace();

        // let default handler process the signal
        ::raise(signal);
    }

    void dumpBacktrace()
    {
#if !defined(__ANDROID__)
        Log::signalLog("\nBacktrace ");
        Log::signalLogNumber(getpid());
        if (VersionInfo)
        {
            Log::signalLog(" - ");
            Log::signalLog(VersionInfo);
        }
        Log::signalLog(":\n");

        const int maxSlots = 50;
        void *backtraceBuffer[maxSlots];
        const int numSlots = backtrace(backtraceBuffer, maxSlots);
        if (numSlots > 0)
        {
            backtrace_symbols_fd(backtraceBuffer, numSlots, STDERR_FILENO);
        }
#else
        LOG_INF("Backtrace not available on Android.");
#endif

#if !ENABLE_DEBUG
        if (std::getenv("COOL_DEBUG"))
#endif
        {
            Log::signalLog(FatalGdbString);
            LOG_ERR("Sleeping 60s to allow debugging: attach " << getpid());
            std::cerr << "Sleeping 60s to allow debugging: attach " << getpid() << "\n";
            sleep(60);
            LOG_ERR("Finished sleeping to allow debugging of: " << getpid());
            std::cerr << "Finished sleeping to allow debugging of: " << getpid() << "\n";
        }
    }

    void setVersionInfo(const std::string &versionInfo)
    {
        if (VersionInfo)
            free (VersionInfo);
        VersionInfo = strdup(versionInfo.c_str());
    }

    void setFatalSignals(const std::string &versionInfo)
    {
        struct sigaction action;

        setVersionInfo(versionInfo);

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleFatalSignal;

        sigaction(SIGSEGV, &action, nullptr);
        sigaction(SIGBUS, &action, nullptr);
        sigaction(SIGABRT, &action, nullptr);
        sigaction(SIGILL, &action, nullptr);
        sigaction(SIGFPE, &action, nullptr);

        // Prepare this in advance just in case.
        std::ostringstream stream;
        stream << "\nERROR: Fatal signal! Attach debugger with:\n"
               << "sudo gdb --pid=" << getpid() << "\n or \n"
               << "sudo gdb --q --n --ex 'thread apply all backtrace full' --batch --pid="
               << getpid() << '\n';
        std::string streamStr = stream.str();
        assert (sizeof (FatalGdbString) > strlen(streamStr.c_str()) + 1);
        strncpy(FatalGdbString, streamStr.c_str(), sizeof(FatalGdbString)-1);
        FatalGdbString[sizeof(FatalGdbString)-1] = '\0';
    }

    static
    void handleUserSignal(const int signal)
    {
        Log::signalLogPrefix();
        Log::signalLog(" User signal received: ");
        Log::signalLog(signalName(signal));
        Log::signalLog("\n");
        if (signal == SIGUSR1)
        {
            DumpGlobalState = true;
            SocketPoll::wakeupWorld();
        }
    }

    static
    void handleDebuggerSignal(const int /*signal*/)
    {}

    void setUserSignals()
    {
        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleUserSignal;

        sigaction(SIGUSR1, &action, nullptr);
    }

    void setDebuggerSignal()
    {
        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleDebuggerSignal;

        sigaction(SIGUSR1, &action, nullptr);
    }

    /// Kill the given pid with SIGKILL as default.  Returns true when the pid does not exist any more.
    bool killChild(const int pid, const int signal)
    {
        LOG_DBG("Killing PID: " << pid);
        // Don't kill anything in the fuzzer case: pid == 0 would kill the fuzzer itself, and
        // killing random other processes is not a great idea, either.
        if (Util::isFuzzing() || kill(pid, signal) == 0 || errno == ESRCH)
        {
            // Killed or doesn't exist.
            return true;
        }

        LOG_SYS("Error when trying to kill PID: " << pid << ". Will wait for termination.");

        const int sleepMs = 50;
        const int count = std::max(CHILD_REBALANCE_INTERVAL_MS / sleepMs, 2);
        for (int i = 0; i < count; ++i)
        {
            if (kill(pid, 0) == 0 || errno == ESRCH)
            {
                // Doesn't exist.
                return true;
            }

            std::this_thread::sleep_for(std::chrono::milliseconds(sleepMs));
        }

        return false;
    }
#endif // !MOBILEAPP
}


/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
