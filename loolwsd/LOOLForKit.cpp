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
#include "ChildProcessSession.hpp"

using Poco::Path;
using Poco::Process;
using Poco::StringTokenizer;
using Poco::Thread;
using Poco::Timestamp;
using Poco::Util::Application;

static const std::string BROKER_SUFIX = ".fifo";
static const std::string BROKER_PREFIX = "lokit";

static std::atomic<unsigned> ForkCounter( 0 );
static unsigned int ChildCounter = 0;

static int ReaderBroker = -1;

class ChildDispatcher
{
public:
    ChildDispatcher() :
        _wsdPipeReader("wsd_pipe_rd", ReaderBroker)
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
        Log::info("Broker command: [" + message + "].");

        StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

        if (tokens[0] == "spawn" && tokens.count() == 2)
        {
            const auto count = std::stoi(tokens[1]);
            Log::info("Spawning " + tokens[1] + " children on request.");
            ForkCounter = count;
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
    Process::PID childPID = 0;

    Log::debug("Forking a loolkit process.");

    Process::PID pid;
    if (!(pid = fork()))
    {
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
        childPID = pid; // (somehow - switch the hash to use real pids or ?) ...
        Log::info("Forked kit [" + std::to_string(childPID) + "].");
    }

    Log::info() << "Created Kit #" << ChildCounter << ", PID: " << childPID << Log::end;
    return childPID;
}

static void printArgumentHelp()
{
    std::cout << "Usage: loolforkit [OPTION]..." << std::endl;
    std::cout << "  Single threaded process broker that spawns lok instances" << std::endl;
    std::cout << "  note: running this standalone is not possible, it is spawned by the loolwsd" << std::endl;
    std::cout << "        and is controlled via a pipe." << std::endl;
    std::cout << "" << std::endl;
    std::cout << "  Some parameters are required and passed on to the lok instance:" << std::endl;
    std::cout << "  --losubpath=<path>        path to chroot for child to live inside." << std::endl;
    std::cout << "  --childroot=<path>        path to chroot for child to live inside." << std::endl;
    std::cout << "  --systemplate=<path>      path of system template to pre-populate chroot with." << std::endl;
    std::cout << "  --lotemplate=<path>       path of libreoffice template to pre-populate chroot with." << std::endl;
    std::cout << "  --losubpath=<path>        path to libreoffice install" << std::endl;
}

// Broker process
int main(int argc, char** argv)
{
    if (std::getenv("SLEEPFORDEBUGGER"))
    {
        std::cerr << "Sleeping " << std::getenv("SLEEPFORDEBUGGER")
                  << " seconds to give you time to attach debugger to process "
                  << Process::id() << std::endl;
        Thread::sleep(std::stoul(std::getenv("SLEEPFORDEBUGGER")) * 1000);
    }

    // Initialization
    Log::initialize("brk");

    Util::setTerminationSignals();
    Util::setFatalSignals();

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
    }

    if (loSubPath.empty() || sysTemplate.empty() ||
        loTemplate.empty() || childRoot.empty())
    {
        printArgumentHelp();
        return 1;
    }

    if (!std::getenv("LD_BIND_NOW"))
        Log::info("Note: LD_BIND_NOW is not set.");

    if (!std::getenv("LOK_VIEW_CALLBACK"))
        Log::info("Note: LOK_VIEW_CALLBACK is not set.");

    const Path pipePath = Path::forDirectory(childRoot + Path::separator() + FIFO_PATH);
    const std::string pipeLoolwsd = Path(pipePath, FIFO_LOOLWSD).toString();
    if ( (ReaderBroker = open(pipeLoolwsd.c_str(), O_RDONLY) ) < 0 )
    {
        Log::error("Error: failed to open pipe [" + pipeLoolwsd + "] read only. Exiting.");
        std::exit(Application::EXIT_SOFTWARE);
    }

    // Initialize LoKit
    if (!globalPreinit(loTemplate))
        _exit(Application::EXIT_SOFTWARE);

    Log::info("Preinit stage OK.");

    // We must have at least one child, more are created dynamically.
    if (createLibreOfficeKit(childRoot, sysTemplate, loTemplate, loSubPath) < 0)
    {
        Log::error("Error: failed to create children.");
        std::exit(Application::EXIT_SOFTWARE);
    }

    ChildDispatcher childDispatcher;
    Log::info("loolbroker is ready.");

    Timestamp startTime;

    while (!TerminationFlag)
    {
        if (!childDispatcher.pollAndDispatch())
        {
            Log::info("Child dispatcher flagged for termination.");
            break;
        }

        if (ForkCounter > 0)
        {
            // Figure out how many children we need. Always create at least as many
            // as configured pre-spawn or one more than requested (whichever is larger).
            int spawn = ForkCounter;
            Log::info() << "Creating " << spawn << " new child." << Log::end;
            size_t newInstances = 0;
            do
            {
                if (createLibreOfficeKit(childRoot, sysTemplate, loTemplate, loSubPath) < 0)
                {
                    Log::error("Error: fork failed.");
                }
                else
                {
                    ++newInstances;
                }
            }
            while (--spawn > 0);

            // If we need to spawn more, retry later.
            ForkCounter = (newInstances > ForkCounter ? 0 : ForkCounter - newInstances);
        }
    }

    close(ReaderBroker);

    Log::info("Process [loolbroker] finished.");
    return Application::EXIT_OK;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
