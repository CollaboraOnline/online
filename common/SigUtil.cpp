/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "SigUtil.hpp"

#if !defined(__ANDROID__) && !defined(__EMSCRIPTEN__)
#  include <execinfo.h>
#endif
#include <csignal>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <poll.h>
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
#include <sstream>
#include <string>
#include <thread>
#include <array>

#include <Socket.hpp>
#include "Common.hpp"
#include "Log.hpp"

#ifndef IOS
static std::atomic<bool> TerminationFlag(false);
static std::atomic<bool> ShutdownRequestFlag(false);
#if !MOBILEAPP
static std::atomic<bool> DumpGlobalState(false);
static std::atomic<bool> ForwardSigUsr2Flag(false); //< Flags to forward SIG_USR2 to children.
#endif
#endif

static size_t ActivityStringIndex = 0;
static std::array<std::string,8> ActivityStrings;
static bool UnattendedRun = false;

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
#if !MOBILEAPP
        // Request shutting down first. Otherwise, we can race with
        // getTerminationFlag, which asserts ShutdownRequestFlag.
        ShutdownRequestFlag = true;
#endif
        // Set the forced-termination flag.
        TerminationFlag = true;
#if !MOBILEAPP
        // And wake-up the thread.
        SocketPoll::wakeupWorld();
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
        assert(dumpState && "Invalid callback for checkDumpGlobalState");
        if (DumpGlobalState)
        {
            DumpGlobalState = false;
            dumpState();
        }
#else
        (void) dumpState;
#endif
    }

    void checkForwardSigUsr2(ForwardSigUsr2Fn forwardSigUsr2)
    {
#if !MOBILEAPP
        assert(forwardSigUsr2 && "Invalid callback for checkForwardSigUsr2");
        if (ForwardSigUsr2Flag)
        {
            ForwardSigUsr2Flag = false;
            forwardSigUsr2();
        }
#else
        (void) forwardSigUsr2;
#endif
    }

    void addActivity(const std::string &message)
    {
        ActivityStrings[ActivityStringIndex++ % ActivityStrings.size()] = message;
    }

    void setUnattended()
    {
        UnattendedRun = true;
    }

#if !MOBILEAPP

    static int SignalLogFD(STDERR_FILENO); //< The FD where signalLogs are dumped.

    /// Open the signalLog file.
    void signalLogOpen()
    {
        // Always default to stderr.
        SignalLogFD = STDERR_FILENO;
    }

    /// Close the signalLog file.
    void signalLogClose()
    {
        fsync(SignalLogFD);
    }

    void signalLogPrefix()
    {
        char buffer[1024];
        Log::prefix<sizeof(buffer) - 1>(buffer, "SIG");
        signalLog(buffer);
    }

    // We need a signal safe means of writing messages
    //   $ man 7 signal
    void signalLog(const char *message)
    {
        while (true)
        {
            const int length = std::strlen(message);
            const int written = write(SignalLogFD, message, length);
            if (written < 0)
            {
                if (errno == EINTR)
                    continue; // ignore.
                else
                    break;
            }

            message += written;
            if (message[0] == '\0')
                break;
        }
    }

    // We need a signal safe means of writing messages
    //   $ man 7 signal
    void signalLogNumber(std::size_t num, int base)
    {
        int i;
        char buf[22];
        if (num == 0)
        {
            signalLog("0");
            return;
        }
        buf[21] = '\0';
        assert (base == 10 || base == 16);
        for (i = 20; i > 0 && num > 0; --i)
        {
            int d = num % base;
            buf[i] = (d < 10) ? ('0' + d) : ('a' + d - 10);
            num /= base;
        }
        signalLog(buf + i + 1);
    }

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
        // LCOV_EXCL_START Coverage for these is not very useful.
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
#if defined(SIGIO) && defined(SIGPOLL) && SIGIO != SIGPOLL
            CASE(IO);
#endif
#ifdef SIGPWR
            CASE(PWR);
#endif
#ifdef SIGLOST
            CASE(LOST);
#endif
            CASE(WINCH);
#if defined(SIGINFO) && defined(SIGPWR) && SIGINFO != SIGPWR
            CASE(INFO);
#endif
#undef CASE
        default:
            return "unknown";
        }
        // LCOV_EXCL_STOP Coverage for these is not very useful.
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

        signalLogOpen();
        signalLogPrefix();
        signalLog(domain);
        signalLog(signalName(signal));
        signalLog("\n");
        signalLogClose();

        if (!hardExit)
            SocketPoll::wakeupWorld();
        else
        {
#if CODE_COVERAGE
            __gcov_dump();
#endif

            ::signal (signal, SIG_DFL);
            ::raise (signal);
        }
    }

    void requestShutdown()
    {
        ShutdownRequestFlag = true;
        SocketPoll::wakeupWorld();
    }

    static char *VersionInfo = nullptr;
    static char FatalGdbString[256] = { '\0' };

    static
    void handleFatalSignal(const int signal, siginfo_t *info, void * /* uctxt */)
    {
        SigHandlerTrap guard;
        const bool bReEntered = !guard.isExclusive();

        if (!bReEntered)
            signalLogOpen();

        signalLogPrefix();

        // Heap corruption can re-enter through backtrace.
        if (bReEntered)
            signalLog(" Fatal double signal received: ");
        else
            signalLog(" Fatal signal received: ");
        signalLog(signalName(signal));
        if (info)
        {
            signalLog(" code: ");
            signalLogNumber(info->si_code);
            signalLog(" for address: 0x");
            signalLogNumber((size_t)info->si_addr, 16);
        }
        signalLog("\n");

        signalLog("Recent activity:\n");
        for (size_t i = 0; i < ActivityStrings.size(); ++i)
        {
            size_t idx = (ActivityStringIndex + i) % ActivityStrings.size();
            if (!ActivityStrings[idx].empty())
            {
                // no plausible impl. will heap allocate in c_str.
                signalLog("\t");
                signalLog(ActivityStrings[idx].c_str());
                signalLog("\n");
            }
        }

        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = SIG_DFL;

        sigaction(signal, &action, nullptr);

        if (!bReEntered)
        {
            dumpBacktrace();
            signalLogClose();
        }

        // let default handler process the signal
        ::raise(signal);
    }

    void dumpBacktrace()
    {
#if !defined(__ANDROID__)
        signalLog("\nBacktrace ");
        signalLogNumber(getpid());
        if (VersionInfo)
        {
            signalLog(" - ");
            signalLog(VersionInfo);
        }
        signalLog(":\n");

        const int maxSlots = 50;
        void *backtraceBuffer[maxSlots];
        const int numSlots = backtrace(backtraceBuffer, maxSlots);
        if (numSlots > 0)
        {
            backtrace_symbols_fd(backtraceBuffer, numSlots, SignalLogFD);
        }
#else
        LOG_INF("Backtrace not available on Android.");
#endif

#if !ENABLE_DEBUG
        if (std::getenv("COOL_DEBUG"))
#endif
        {
            if (UnattendedRun)
            {
                static constexpr auto msg =
                    "Crashed in unattended run and won't wait for debugger. Re-run without "
                    "--unattended to attach a debugger.";
                LOG_ERR(msg);
                std::cerr << msg << '\n';
            }
            else
            {
                signalLog(FatalGdbString);
                LOG_ERR("Sleeping 60s to allow debugging: attach " << getpid());
                std::cerr << "Sleeping 60s to allow debugging: attach " << getpid() << '\n';
                sleep(60);
                LOG_ERR("Finished sleeping to allow debugging of: " << getpid());
                std::cerr << "Finished sleeping to allow debugging of: " << getpid() << '\n';
            }
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

        // Set up the fatal-signal handler. (N.B. three-argument handler)
        sigemptyset(&action.sa_mask);
        action.sa_flags = SA_SIGINFO;
        action.sa_sigaction = handleFatalSignal;

        sigaction(SIGSEGV, &action, nullptr);
        sigaction(SIGBUS, &action, nullptr);
        sigaction(SIGABRT, &action, nullptr);
        sigaction(SIGILL, &action, nullptr);
        sigaction(SIGFPE, &action, nullptr);

        // Set up the terminatio-signal handler. (N.B. single-argument handler)
        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleTerminationSignal;

        sigaction(SIGINT, &action, nullptr);
        sigaction(SIGTERM, &action, nullptr);
        sigaction(SIGQUIT, &action, nullptr);
        sigaction(SIGHUP, &action, nullptr);

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
        signalLogOpen();
        signalLogPrefix();
        signalLog(" User signal received: ");
        signalLog(signalName(signal));
        signalLog("\n");
        if (signal == SIGUSR1)
        {
            DumpGlobalState = true;
        }
        else if (signal == SIGUSR2)
        {
            constexpr int maxSlots = 250;
            void* backtraceBuffer[maxSlots];
            const int numSlots = backtrace(backtraceBuffer, maxSlots);
            if (numSlots > 0)
                backtrace_symbols_fd(backtraceBuffer, numSlots, SignalLogFD);

            ForwardSigUsr2Flag = true;
        }

        signalLogClose();
        SocketPoll::wakeupWorld();
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
        sigaction(SIGUSR2, &action, nullptr);

#if !defined(__ANDROID__)
        // Prime backtrace to make sure libgcc is loaded.
        constexpr int maxSlots = 1;
        void* backtraceBuffer[maxSlots + 1];
        backtrace(backtraceBuffer, maxSlots);
#endif
    }

    void setDebuggerSignal()
    {
        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleDebuggerSignal;

        sigaction(SIGUSR1, &action, nullptr);
    }

    /// Kill the given pid with SIGKILL as default. Returns true when the pid does not exist any more.
    bool killChild(const int pid, const int signal)
    {
        LOG_DBG("Killing PID: " << pid << " with " << signalName(signal));

        // Don't kill anything in the fuzzer case: pid == 0 would kill the fuzzer itself, and
        // killing random other processes is not a great idea, either.
        if (Util::isFuzzing() || kill(pid, signal) == 0 || errno == ESRCH)
        {
            // Killed or doesn't exist.
            return true;
        }

        LOG_SYS("Error when trying to kill PID: " << pid << ". Will wait for termination.");

        constexpr int sleepMs = 50;
        constexpr int count = std::max(CHILD_REBALANCE_INTERVAL_MS / sleepMs, 2);
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
