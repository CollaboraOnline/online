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
#include <string>

#include <Poco/Process.h>

/// Flag to stop pump loops.
extern std::atomic<bool> TerminationFlag;

/// Flag to shutdown the server.
extern std::atomic<bool> ShutdownFlag;

/// Mutex to trap signal handler, if any,
/// and prevent _Exit while collecting backtrace.
extern std::mutex SigHandlerTrap;

namespace SigUtil
{
    /// Returns the name of the signal.
    const char* signalName(int signo);

    /// Trap signals to cleanup and exit the process gracefully.
    void setTerminationSignals();

    /// Trap all fatal signals to assist debugging.
    void setFatalSignals();

    void requestTermination(const Poco::Process::PID& pid);

    /// Kills a child process and returns true when
    /// child pid is removed from the process table
    /// after a certain (short) timeout.
    bool killChild(const int pid);

} // end namespace SigUtil

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
