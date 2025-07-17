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

#include <config.h>
#include <Socket.hpp>
#include "SigUtil.hpp"

#include <string>

#include "Log.hpp"

namespace
{
/// The valid states of the process.
enum class RunState : char
{
    Run = 0, ///< Normal up-and-running state.
    ShutDown, ///< Request to shut down gracefully.
    Terminate ///< Immediate termination.
};

/// Single flag to control the current run state.
static std::atomic<RunState> RunStateFlag(RunState::Run);
} // namespace

namespace SigUtil
{
    void triggerDumpState([[maybe_unused]] const std::string &testname)
    {
    }

    bool getShutdownRequestFlag()
    {
        return RunStateFlag >= RunState::ShutDown;
    }

    bool getTerminationFlag()
    {
        return RunStateFlag >= RunState::Terminate;
    }

    void setTerminationFlag()
    {
        // While fuzzing, we never want to terminate.
        if constexpr (!Util::isFuzzing())
        {
            // Set the forced-termination flag.
            RunStateFlag = RunState::Terminate;
        }

        SocketPoll::wakeupWorld();
    }

    void requestShutdown()
    {
        RunState oldState = RunState::Run;
        if (RunStateFlag.compare_exchange_strong(oldState, RunState::ShutDown)) {
            SocketPoll::wakeupWorld();
        }
    }

    void resetTerminationFlags() { RunStateFlag = RunState::Run; }

    void checkDumpGlobalState([[maybe_unused]] GlobalDumpStateFn dumpState)
    {
    }

    void checkForwardSigUsr2([[maybe_unused]] ForwardSigUsr2Fn forwardSigUsr2)
    {
    }

    void setActivityHeader(const std::string &message)
    {
    }

    void addActivity(const std::string &message)
    {
    }

    void addActivity(const std::string &viewId, const std::string &message)
    {
    }

    void setUnattended()
    {
    }

    void signalLogOpen()
    {
    }

    void signalLogClose()
    {
    }

    void signalLogPrefix()
    {
    }

    void signalLog(const char *message)
    {
    }

    void signalLogNumber(std::size_t num, int base)
    {
    }

    const char *signalName(const int signo)
    {
        return "SIGWTF";
    }

    void dumpBacktrace()
    {
    }

    void setVersionInfo(const std::string &versionInfo)
    {
    }

    void setFatalSignals(const std::string &versionInfo)
    {
    }

    void setSigChildHandler(SigChildHandler fn)
    {
    }

    void dieOnParentDeath()
    {
    }

    void setUserSignals()
    {
    }

    void setDebuggerSignal()
    {
    }

    bool killChild(const int pid, const int signal)
    {
        return true;
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
