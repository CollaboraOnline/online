/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <atomic>
#include <mutex>

#if MOBILEAPP
static constexpr bool ShutdownRequestFlag(false);
extern std::atomic<bool> MobileTerminationFlag;
#endif

namespace SigUtil
{
    /// Get the flag used to commence clean shutdown.
    /// requestShutdown() is used to set the flag.
    bool getShutdownRequestFlag();

    /// Get the flag to stop pump loops forcefully.
    bool getTerminationFlag();
    /// Set the flag to stop pump loops forcefully.
    void setTerminationFlag();
#if MOBILEAPP
    /// Reset the flag to stop pump loops forcefully.
    /// Only necessary in Mobile.
    void resetTerminationFlag();
#endif

    /// Get the flag to dump internal state.
    bool getDumpGlobalState();
    /// Reset the flag to dump internal state.
    void resetDumpGlobalState();

#if !MOBILEAPP

    /// Wait for the signal handler, if any,
    /// and prevent _Exit while collecting backtrace.
    void waitSigHandlerTrap();

    /// Returns the name of the signal.
    const char* signalName(int signo);

    /// Register a wakeup function when changing

    /// Trap signals to cleanup and exit the process gracefully.
    void setTerminationSignals();

    /// Trap all fatal signals to assist debugging.
    void setFatalSignals();

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
    bool killChild(const int pid);

    /// Dump a signal-safe back-trace
    void dumpBacktrace();

#endif // !MOBILEAPP

} // end namespace SigUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
