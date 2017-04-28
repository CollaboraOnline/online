/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include "SigUtil.hpp"

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
#include <sstream>
#include <string>
#include <thread>

#include "Socket.hpp"
#include "Common.hpp"
#include "Log.hpp"

/// Flag to request hard termination.
std::atomic<bool> TerminationFlag(false);
/// Flag to request dumping of all internal state
std::atomic<bool> DumpGlobalState(false);
/// Flag to request WSD to notify clients and shutdown.
std::atomic<bool> ShutdownRequestFlag(false);

std::mutex SigHandlerTrap;

namespace SigUtil
{
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
        if (!ShutdownRequestFlag && signal == SIGINT)
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

        sigaction(signal, &action, nullptr);

        dumpBacktrace();

        // let default handler process the signal
        kill(Poco::Process::id(), signal);
    }

    void dumpBacktrace()
    {
        char header[32];
        sprintf(header, "Backtrace %d:\n", getpid());

        const int maxSlots = 50;
        void *backtraceBuffer[maxSlots];
        int numSlots = backtrace(backtraceBuffer, maxSlots);
        if (numSlots > 0)
        {
            char **symbols = backtrace_symbols(backtraceBuffer, numSlots);
            if (symbols != nullptr)
            {
                struct iovec ioVector[maxSlots*2+1];
                ioVector[0].iov_base = static_cast<void*>(header);
                ioVector[0].iov_len = std::strlen(static_cast<const char*>(ioVector[0].iov_base));
                for (int i = 0; i < numSlots; i++)
                {
                    ioVector[1+i*2+0].iov_base = symbols[i];
                    ioVector[1+i*2+0].iov_len = std::strlen(static_cast<const char *>(ioVector[1+i*2+0].iov_base));
                    ioVector[1+i*2+1].iov_base = const_cast<void*>(static_cast<const void*>("\n"));
                    ioVector[1+i*2+1].iov_len = 1;
                }

                if (writev(STDERR_FILENO, ioVector, numSlots*2+1) == -1)
                {
                    LOG_SYS("Failed to dump backtrace to stderr.");
                }
            }
        }

        if (std::getenv("LOOL_DEBUG"))
        {
            LOG_ERR("Sleeping 30s to allow debugging.");
            sleep(30);
        }
    }

    void setFatalSignals()
    {
        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleFatalSignal;

        sigaction(SIGSEGV, &action, nullptr);
        sigaction(SIGBUS, &action, nullptr);
        sigaction(SIGABRT, &action, nullptr);
        sigaction(SIGILL, &action, nullptr);
        sigaction(SIGFPE, &action, nullptr);

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

    void setUserSignals()
    {
        struct sigaction action;

        sigemptyset(&action.sa_mask);
        action.sa_flags = 0;
        action.sa_handler = handleUserSignal;

        sigaction(SIGUSR1, &action, nullptr);
    }

    bool killChild(const int pid)
    {
        LOG_DBG("Killing PID: " << pid);
        if (kill(pid, SIGTERM) == 0 || errno == ESRCH)
        {
            // Killed or doesn't exist.
            return true;
        }

        LOG_SYS("Error when trying to kill PID: " << pid << ". Will wait for termination.");

        const auto sleepMs = 50;
        const auto count = std::max(CHILD_REBALANCE_INTERVAL_MS / sleepMs, 2);
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
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
