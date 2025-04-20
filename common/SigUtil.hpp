/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <cstdint>
#include <string>

namespace SigUtil
{
#ifndef IOS
    /// Get the flag used to commence clean shutdown.
    /// requestShutdown() is used to set the flag.
    bool getShutdownRequestFlag();

    /// Get the flag to stop pump loops forcefully.
    /// If this returns true, getShutdownRequestFlag() must also return true.
    bool getTerminationFlag();
    /// Set the flag to stop pump loops forcefully and request shutting down.
    void setTerminationFlag();
#if MOBILEAPP
    /// Reset the flags to stop pump loops forcefully.
    /// Only necessary in Mobile.
    void resetTerminationFlags();
#endif
#else
    // In the mobile apps we have no need to shut down the app.
    inline constexpr bool getShutdownRequestFlag()
    {
        return false;
    }

    inline constexpr bool getTerminationFlag()
    {
        return false;
    }

    inline void setTerminationFlag()
    {
    }
#endif

    extern "C" { typedef void (*GlobalDumpStateFn)(void); }

    void checkDumpGlobalState(GlobalDumpStateFn dumpState);

    extern "C" { typedef void (*ForwardSigUsr2Fn)(void); }

    void checkForwardSigUsr2(ForwardSigUsr2Fn forwardSigUsr2);

    /// Add a pre-amble message to be dumped on fatal signal
    void setActivityHeader(const std::string &message);

    /// Add a message to a round-robin buffer to be dumped on fatal signal
    void addActivity(const std::string &message);

    /// Add a message on a view to a round-robin buffer to be dumped on fatal signal
    void addActivity(const std::string &id, const std::string &message);

    /// Called to flag that we are running in unattended mode, not interactive.
    /// In unattended mode we know there is no one to attach a debugger on
    /// faulting, so we do not wait unnecessarily. Otherwise, we wait for 60s.
    void setUnattended();

    /// Reap one or more children.
    /// Returns a pair of the return value of waitpid(2)
    /// and WTERMSIG(stat_loc), if it were SEGV, ABRT, or BUS.
    /// @sighandler is true if we are invoked from a signal handler.
    /// This is needed to comply with signal handler requirements.
    std::pair<int, int> reapZombieChild(int pid, bool sighandler);

    /// Uninitialize and free memory.
    void uninitialize();

#if !MOBILEAPP

    /// Open the signalLog file.
    void signalLogOpen();
    /// Close the signalLog file.
    void signalLogClose();

    /// Signal safe prefix logging
    void signalLogPrefix();
    /// Signal safe logging
    void signalLog(const char* message);
    /// Signal log number
    void signalLogNumber(std::size_t num, int base = 10);

#else // MOBILEAPP

    /// Open the signalLog file.
    inline void signalLogOpen() {}
    /// Close the signalLog file.
    inline void signalLogClose() {}

    /// Signal safe prefix logging
    inline void signalLogPrefix() {}
    /// Signal safe logging
    inline void signalLog(const char*) {}
    /// Signal log number
    inline void signalLogNumber(std::size_t, int = 10) {}

#endif // MOBILEAPP

    /// Returns the name of the signal.
    const char* signalName(int signo);

    extern "C"
    {
        typedef void (*SigChildHandler)(int);
    }

#if !MOBILEAPP

    /// Register a wakeup function when changing

    /// Trap all fatal signals to assist debugging.
    void setFatalSignals(const std::string &versionInfo);

    /// Update version info
    void setVersionInfo(const std::string &versionInfo);

    /// Trap generally useful signals
    void setUserSignals();

    /// Trap to unpause the process
    void setDebuggerSignal();

    /// Requests the server to initiate graceful shutdown.
    /// Shutting down is a multi-stage process, because
    /// it can be requested via signals.
    /// Since we need to notify clients, we can't
    /// invoke the sockets while in a signal handler.
    /// This flags the server to notify clients first
    /// then flags for shutdown.
    void requestShutdown();

    /// Kills a child process and returns true when
    /// child pid is removed from the process table
    /// after a certain (short) timeout.
    bool killChild(const int pid, const int signal);

    /// Sets a child death signal handler
    void setSigChildHandler(SigChildHandler fn);

    /// Ensure that if a parent process is killed we go down too
    void dieOnParentDeath();

    /// Dump a signal-safe back-trace
    void dumpBacktrace();

#else // MOBILEAPP

    /// Trap all fatal signals to assist debugging.
    inline void setFatalSignals(const std::string&) {}

    /// Update version info
    inline void setVersionInfo(const std::string&) {}

    /// Trap generally useful signals
    inline void setUserSignals() {}

    /// Trap to unpause the process
    inline void setDebuggerSignal() {}

    /// Sets a child death signal handler
    inline void setSigChildHandler(SigChildHandler) {}

    /// Ensure that if a parent process is killed we go down too
    inline void dieOnParentDeath() {}

    /// Dump a signal-safe back-trace
    inline void dumpBacktrace() {}

#endif // MOBILEAPP

} // end namespace SigUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
