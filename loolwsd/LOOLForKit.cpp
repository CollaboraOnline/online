/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * A very simple, single threaded helper to efficiently pre-init and
 * spawn lots of kits as children.
 */

#include "config.h"

#include <sys/capability.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <sys/stat.h>

#include <cstdlib>
#include <cstring>
#include <atomic>
#include <iostream>

#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Thread.h>
#include <Poco/Util/Application.h>

#include "Common.hpp"
#include "IoUtil.hpp"
#include "LOOLKit.hpp"
#include "Util.hpp"
#include "Unit.hpp"

#include "security.h"

using Poco::Path;
using Poco::Process;
using Poco::StringTokenizer;
using Poco::Thread;
using Poco::Timestamp;
using Poco::Util::Application;

static std::string UnitTestLibrary;
static std::atomic<unsigned> ForkCounter( 0 );

int ClientPortNumber = DEFAULT_CLIENT_PORT_NUMBER;

static int pipeFd = -1;

class ChildDispatcher
{
public:
    ChildDispatcher() :
        _wsdPipeReader("wsd_pipe_rd", pipeFd)
    {
    }

    /// Polls WSD commands and dispatches them to the appropriate child.
    bool pollAndDispatch()
    {
        return _wsdPipeReader.processOnce([this](std::string& message) { handleInput(message); return true; },
                                          []() { return TerminationFlag; });
    }

private:
    void handleInput(const std::string& message)
    {
        Log::info("ForKit command: [" + message + "].");

        StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

        if (tokens[0] == "spawn" && tokens.count() == 2)
        {
            const auto count = std::stoi(tokens[1]);
            if (count > 0)
            {
                Log::info("Spawning " + tokens[1] + " " + (count == 1 ? "child" : "children") + " per request.");
                ForkCounter = count;
            }
            else
            {
                Log::warn("Cannot spawn " + tokens[1] + " children as requested.");
            }
        }
    }

private:
    IoUtil::PipeReader _wsdPipeReader;
};

static int createLibreOfficeKit(const std::string& childRoot,
                                const std::string& sysTemplate,
                                const std::string& loTemplate,
                                const std::string& loSubPath)
{
    Log::debug("Forking a loolkit process.");

    Process::PID pid;
    if (!(pid = fork()))
    {
        // quicker than a generic socket closing approach.
        // (but pipeFd is a pipe, not a socket...?)
        close(pipeFd);

        UnitKit::get().postFork();

        // child
        if (std::getenv("SLEEPKITFORDEBUGGER"))
        {
            std::cerr << "Sleeping " << std::getenv("SLEEPKITFORDEBUGGER")
                      << " seconds to give you time to attach debugger to process "
                      << Process::id() << std::endl;
            Thread::sleep(std::stoul(std::getenv("SLEEPKITFORDEBUGGER")) * 1000);
        }

        lokit_main(childRoot, sysTemplate, loTemplate, loSubPath);
    }
    else
    {
        // parent
        if (pid < 0)
            Log::syserror("Fork failed.");
        else
            Log::info("Forked kit [" + std::to_string(pid) + "].");

        UnitKit::get().launchedKit(pid);
    }

    return pid;
}

static void printArgumentHelp()
{
    std::cout << "Usage: loolforkit [OPTION]..." << std::endl;
    std::cout << "  Single-threaded process that spawns lok instances" << std::endl;
    std::cout << "  Note: Running this standalone is not possible. It is spawned by loolwsd" << std::endl;
    std::cout << "        and is controlled via a pipe." << std::endl;
    std::cout << "" << std::endl;
}

int main(int argc, char** argv)
{
    if (!hasCorrectUID("loolforkit"))
        return 1;

    if (std::getenv("SLEEPFORDEBUGGER"))
    {
        std::cerr << "Sleeping " << std::getenv("SLEEPFORDEBUGGER")
                  << " seconds to give you time to attach debugger to process "
                  << Process::id() << std::endl;
        Thread::sleep(std::stoul(std::getenv("SLEEPFORDEBUGGER")) * 1000);
    }

    // Initialization
    Log::initialize("frk");

    Util::setTerminationSignals();
    Util::setFatalSignals();

    // Auto-reap zombies.
    if (signal(SIGCHLD, SIG_IGN) == SIG_ERR)
    {
        Log::syserror("Failed to set SIGCHLD to SIG_IGN.");
        return 1;
    }

    std::string childRoot;
    std::string loSubPath;
    std::string sysTemplate;
    std::string loTemplate;

    for (int i = 0; i < argc; ++i)
    {
        char *cmd = argv[i];
        char *eq;
        if (std::strstr(cmd, "--losubpath=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            loSubPath = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--systemplate=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            sysTemplate = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--lotemplate=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            loTemplate = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--childroot=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            childRoot = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--clientport=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            ClientPortNumber = std::stoll(std::string(eq+1));
        }
#if ENABLE_DEBUG
        // this process has various privileges - don't run arbitrary code.
        else if (std::strstr(cmd, "--unitlib=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            UnitTestLibrary = std::string(eq+1);
        }
#endif
    }

    if (loSubPath.empty() || sysTemplate.empty() ||
        loTemplate.empty() || childRoot.empty())
    {
        printArgumentHelp();
        return 1;
    }

    if (!UnitBase::init(UnitBase::UnitType::TYPE_KIT,
                        UnitTestLibrary))
    {
        Log::error("Failed to load kit unit test library");
        return Application::EXIT_USAGE;
    }

    if (!std::getenv("LD_BIND_NOW"))
        Log::info("Note: LD_BIND_NOW is not set.");

    if (!std::getenv("LOK_VIEW_CALLBACK"))
        Log::info("Note: LOK_VIEW_CALLBACK is not set.");

    const Path pipePath = Path::forDirectory(childRoot + Path::separator() + FIFO_PATH);
    const std::string pipeLoolwsd = Path(pipePath, FIFO_LOOLWSD).toString();
    if ( (pipeFd = open(pipeLoolwsd.c_str(), O_RDONLY) ) < 0 )
    {
        Log::syserror("Failed to open pipe [" + pipeLoolwsd + "] for reading. Exiting.");
        std::exit(Application::EXIT_SOFTWARE);
    }
    Log::debug("open(" + pipeLoolwsd + ", RDONLY) = " + std::to_string(pipeFd));

    // Initialize LoKit
    if (!globalPreinit(loTemplate))
        std::exit(Application::EXIT_SOFTWARE);

    Log::info("Preinit stage OK.");

    // We must have at least one child, more are created dynamically.
    if (createLibreOfficeKit(childRoot, sysTemplate, loTemplate, loSubPath) < 0)
    {
        Log::error("Failed to create a kit process.");
        std::exit(Application::EXIT_SOFTWARE);
    }

    ChildDispatcher childDispatcher;
    Log::info("ForKit process is ready.");

    while (!TerminationFlag)
    {
        UnitKit::get().invokeForKitTest();

        if (!childDispatcher.pollAndDispatch())
        {
            Log::info("Child dispatcher flagged for termination.");
            break;
        }

        if (ForkCounter > 0)
        {
            // Create as many as requested.
            int spawn = ForkCounter;
            Log::info() << "Creating " << spawn << " new child." << Log::end;
            size_t newInstances = 0;
            do
            {
                if (createLibreOfficeKit(childRoot, sysTemplate, loTemplate, loSubPath) < 0)
                {
                    Log::error("Failed to create a kit process.");
                }
                else
                {
                    ++newInstances;
                }
            }
            while (--spawn > 0);

            // If we need to spawn more, retry later.
            ForkCounter = (newInstances >= ForkCounter ? 0 : ForkCounter - newInstances);
        }
    }

    close(pipeFd);

    int returnValue = Application::EXIT_OK;
    UnitKit::get().returnValue(returnValue);

    Log::info("ForKit process finished.");
    return returnValue;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
