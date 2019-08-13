/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_SIGNALUTIL_HPP
#define INCLUDED_SIGNALUTIL_HPP

#include <atomic>
#include <mutex>

#if !MOBILEAPP
namespace SigUtil
{
    /// Flag to commence clean shutdown
    std::atomic<bool>& getShutdownRequestFlag();
}
#else
static constexpr bool ShutdownRequestFlag(false);
namespace SigUtil
{
    /// Flag to commence clean shutdown
    bool getShutdownRequestFlag();
}
#endif

namespace SigUtil
{
    /// Flag to stop pump loops.
    std::atomic<bool>& getTerminationFlag();

    /// Flag to dump internal state
    std::atomic<bool>& getDumpGlobalState();
}

#if MOBILEAPP
extern std::atomic<bool> MobileTerminationFlag;
#endif

#if !MOBILEAPP

namespace SigUtil
{
    /// Mutex to trap signal handler, if any,
    /// and prevent _Exit while collecting backtrace.
    std::mutex& getSigHandlerTrap();

    /// Returns the name of the signal.
    const char* signalName(int signo);

    /// Register a wakeup function when changing

    /// Trap signals to cleanup and exit the process gracefully.
    void setTerminationSignals();

    /// Trap all fatal signals to assist debugging.
    void setFatalSignals();

    /// Trap generally useful signals
    void setUserSignals();

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

} // end namespace SigUtil

#endif // !MOBILEAPP

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
