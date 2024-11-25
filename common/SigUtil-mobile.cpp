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

#include "SigUtil.hpp"

#include <string>

#include "Log.hpp"

namespace SigUtil
{
    void triggerDumpState([[maybe_unused]] const std::string &testname)
    {
    }

    bool getShutdownRequestFlag()
    {
        return false;
    }

    bool getTerminationFlag()
    {
        return false;
    }

    void setTerminationFlag()
    {
    }

    void requestShutdown()
    {
    }

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
