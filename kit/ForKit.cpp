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
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>

#include <atomic>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <map>

#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/Thread.h>
#include <Poco/Util/Application.h>

#include "Common.hpp"
#include "IoUtil.hpp"
#include "Kit.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "Util.hpp"

#include "common/FileUtil.hpp"
#include "common/SigUtil.hpp"
#include "security.h"

using Poco::Process;
using Poco::Thread;
#ifndef KIT_IN_PROCESS
using Poco::Util::Application;
#endif

#ifndef KIT_IN_PROCESS
static bool NoCapsForKit = false;
#endif
static bool DisplayVersion = false;
static std::string UnitTestLibrary;
static std::atomic<unsigned> ForkCounter(0);

static std::map<Process::PID, std::string> childJails;

#ifndef KIT_IN_PROCESS
int ClientPortNumber = DEFAULT_CLIENT_PORT_NUMBER;
int MasterPortNumber = DEFAULT_MASTER_PORT_NUMBER;
#endif

/// Dispatcher class to demultiplex requests from
/// WSD and handles them.
class CommandDispatcher : public IoUtil::PipeReader
{
public:
    CommandDispatcher(const int pipe) :
        PipeReader("wsd_pipe_rd", pipe)
    {
    }

    /// Polls WSD commands and handles them.
    bool pollAndDispatch()
    {
        std::string message;
        const auto ready = readLine(message, [](){ return TerminationFlag.load(); });
        if (ready <= 0)
        {
            // Termination is done via SIGTERM, which breaks the wait.
            if (ready < 0)
            {
                if (TerminationFlag)
                {
                    LOG_INF("Poll interrupted in " << getName() << " and Termination flag set.");
                }

                // Break.
                return false;
            }

            // Timeout.
            return true;
        }

        LOG_INF("ForKit command: [" << message << "].");
        try
        {
            std::vector<std::string> tokens = LOOLProtocol::tokenize(message);
            if (tokens.size() == 2 && tokens[0] == "spawn")
            {
                const auto count = std::stoi(tokens[1]);
                if (count > 0)
                {
                    LOG_INF("Setting to spawn " << tokens[1] << " child" << (count == 1 ? "" : "ren") << " per request.");
                    ForkCounter = count;
                }
                else
                {
                    LOG_WRN("Cannot spawn " << tokens[1] << " children as requested.");
                }
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Error while processing forkit request [" << message << "]: " << exc.what());
        }

        return true;
    }
};

#ifndef KIT_IN_PROCESS
static bool haveCapability(cap_value_t capability)
{
    cap_t caps = cap_get_proc();

    if (caps == nullptr)
    {
        LOG_SFL("cap_get_proc() failed.");
        return false;
    }

    char *cap_name = cap_to_name(capability);
    cap_flag_value_t value;

    if (cap_get_flag(caps, capability, CAP_EFFECTIVE, &value) == -1)
    {
        if (cap_name)
        {
            LOG_SFL("cap_get_flag failed for " << cap_name << ".");
            cap_free(cap_name);
        }
        else
        {
            LOG_SFL("cap_get_flag failed for capability " << capability << ".");
        }
        return false;
    }

    if (value != CAP_SET)
    {
        if (cap_name)
        {
            LOG_FTL("Capability " << cap_name << " is not set for the loolforkit program.");
            cap_free(cap_name);
        }
        else
        {
            LOG_ERR("Capability " << capability << " is not set for the loolforkit program.");
        }
        return false;
    }

    if (cap_name)
    {
        LOG_INF("Have capability " << cap_name);
        cap_free(cap_name);
    }
    else
    {
        LOG_INF("Have capability " << capability);
    }

    return true;
}

static bool haveCorrectCapabilities()
{
    bool result = true;

    // Do check them all, don't shortcut with &&
    if (!haveCapability(CAP_SYS_CHROOT))
        result = false;
    if (!haveCapability(CAP_MKNOD))
        result = false;
    if (!haveCapability(CAP_FOWNER))
        result = false;

    return result;
}
#endif

/// Check if some previously forked kids have died.
static void cleanupChildren()
{
    std::vector<std::string> jails;
    Process::PID exitedChildPid;
    int status;
    while ((exitedChildPid = waitpid(-1, &status, WUNTRACED | WNOHANG)) > 0)
    {
        const auto it = childJails.find(exitedChildPid);
        if (it != childJails.end())
        {
            LOG_INF("Child " << exitedChildPid << " has exited, removing its jail '" << it->second << "'.");
            jails.emplace_back(it->second);
            childJails.erase(it);
        }
        else
        {
            LOG_ERR("Unknown child " << exitedChildPid << " has exited");
        }
    }

    // Now delete the jails.
    for (const auto& path : jails)
    {
        FileUtil::removeFile(path, true);
    }
}

static int createLibreOfficeKit(const std::string& childRoot,
                                const std::string& sysTemplate,
                                const std::string& loTemplate,
                                const std::string& loSubPath,
                                bool queryVersion = false)
{
    LOG_DBG("Forking a loolkit process.");

    const Process::PID pid = fork();
    if (!pid)
    {
        // Child

        // Close the pipe from loolwsd
        close(0);

#ifndef KIT_IN_PROCESS
        UnitKit::get().postFork();
#endif

        if (std::getenv("SLEEPKITFORDEBUGGER"))
        {
            const auto delaySecs = std::stoul(std::getenv("SLEEPKITFORDEBUGGER"));
            if (delaySecs > 0)
            {
                std::cerr << "Sleeping " << delaySecs
                          << " seconds to give you time to attach debugger to process "
                          << Process::id() << std::endl;
                Thread::sleep(delaySecs * 1000);
            }
        }

#ifndef KIT_IN_PROCESS
        lokit_main(childRoot, sysTemplate, loTemplate, loSubPath, NoCapsForKit, queryVersion, DisplayVersion);
#else
        lokit_main(childRoot, sysTemplate, loTemplate, loSubPath, true, queryVersion, DisplayVersion);
#endif
    }
    else
    {
        // Parent
        if (pid < 0)
        {
            LOG_SYS("Fork failed.");
        }
        else
        {
            LOG_INF("Forked kit [" << pid << "].");
            childJails[pid] = childRoot + std::to_string(pid);
        }

#ifndef KIT_IN_PROCESS
        UnitKit::get().launchedKit(pid);
#endif
    }

    return pid;
}

void forkLibreOfficeKit(const std::string& childRoot,
                        const std::string& sysTemplate,
                        const std::string& loTemplate,
                        const std::string& loSubPath,
                        int limit)
{
    // Cleanup first, to reduce disk load.
    cleanupChildren();

#ifndef KIT_IN_PROCESS
    (void) limit;
#else
    if (limit > 0)
        ForkCounter = limit;
#endif

    if (ForkCounter > 0)
    {
        // Create as many as requested.
        const size_t count = ForkCounter;
        LOG_INF("Spawning " << count << " new child" << (count == 1 ? "." : "ren."));
        const size_t retry = count * 2;
        for (size_t i = 0; ForkCounter > 0 && i < retry; ++i)
        {
            if (ForkCounter-- <= 0 || createLibreOfficeKit(childRoot, sysTemplate, loTemplate, loSubPath) < 0)
            {
                LOG_ERR("Failed to create a kit process.");
                ++ForkCounter;
            }
        }
    }
}

#ifndef KIT_IN_PROCESS
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
    {
        return Application::EXIT_SOFTWARE;
    }

    if (std::getenv("SLEEPFORDEBUGGER"))
    {
        const auto delaySecs = std::stoul(std::getenv("SLEEPFORDEBUGGER"));
        if (delaySecs > 0)
        {
            std::cerr << "Sleeping " << delaySecs
                      << " seconds to give you time to attach debugger to process "
                      << Process::id() << std::endl;
            Thread::sleep(delaySecs * 1000);
        }
    }

#ifndef FUZZER
    SigUtil::setFatalSignals();
    SigUtil::setTerminationSignals();
#endif

    Util::setThreadName("forkit");

    // Initialization
    const bool logToFile = std::getenv("LOOL_LOGFILE");
    const char* logFilename = std::getenv("LOOL_LOGFILENAME");
    const char* logLevel = std::getenv("LOOL_LOGLEVEL");
    const char* logColor = std::getenv("LOOL_LOGCOLOR");
    std::map<std::string, std::string> logProperties;
    if (logToFile && logFilename)
    {
        logProperties["path"] = std::string(logFilename);
    }

    Log::initialize("frk", logLevel ? logLevel : "", logColor != nullptr, logToFile, logProperties);

    std::string childRoot;
    std::string loSubPath;
    std::string sysTemplate;
    std::string loTemplate;

#if ENABLE_DEBUG
    static const char* clientPort = std::getenv("LOOL_TEST_CLIENT_PORT");
    if (clientPort)
        ClientPortNumber = std::stoi(clientPort);
    static const char* masterPort = std::getenv("LOOL_TEST_MASTER_PORT");
    if (masterPort)
        MasterPortNumber = std::stoi(masterPort);
#endif

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
        else if (std::strstr(cmd, "--masterport=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            MasterPortNumber = std::stoll(std::string(eq+1));
        }
        else if (std::strstr(cmd, "--version") == cmd)
        {
            std::string version, hash;
            Util::getVersionInfo(version, hash);
            std::cout << "loolforkit version details: " << version << " - " << hash << std::endl;
            DisplayVersion = true;
        }
#if ENABLE_DEBUG
        // this process has various privileges - don't run arbitrary code.
        else if (std::strstr(cmd, "--unitlib=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            UnitTestLibrary = std::string(eq+1);
        }
        // we are running in no-privilege mode - with no chroot etc.
        else if (std::strstr(cmd, "--nocaps") == cmd)
        {
            NoCapsForKit = true;
        }
#endif
    }

    if (loSubPath.empty() || sysTemplate.empty() ||
        loTemplate.empty() || childRoot.empty())
    {
        printArgumentHelp();
        return Application::EXIT_USAGE;
    }

    if (!UnitBase::init(UnitBase::UnitType::Kit,
                        UnitTestLibrary))
    {
        LOG_ERR("Failed to load kit unit test library");
        return Application::EXIT_USAGE;
    }

    // Setup & check environment
    std::string layers(
        "xcsxcu:${BRAND_BASE_DIR}/share/registry "
        "res:${BRAND_BASE_DIR}/share/registry "
        "bundledext:${${BRAND_BASE_DIR}/program/lounorc:BUNDLED_EXTENSIONS_USER}/registry/com.sun.star.comp.deployment.configuration.PackageRegistryBackend/configmgr.ini "
        "sharedext:${${BRAND_BASE_DIR}/program/lounorc:SHARED_EXTENSIONS_USER}/registry/com.sun.star.comp.deployment.configuration.PackageRegistryBackend/configmgr.ini "
        "userext:${${BRAND_BASE_DIR}/program/lounorc:UNO_USER_PACKAGES_CACHE}/registry/com.sun.star.comp.deployment.configuration.PackageRegistryBackend/configmgr.ini "
#if ENABLE_DEBUG // '*' denotes non-writable.
        "user:*file://" DEBUG_ABSSRCDIR "/loolkitconfig.xcu "
#else
        "user:*file://" LOOLWSD_CONFIGDIR "/loolkitconfig.xcu "
#endif
        );

    // No-caps tracing can spawn eg. glxinfo & other oddness.
    unsetenv("DISPLAY");

    ::setenv("CONFIGURATION_LAYERS", layers.c_str(),
             1 /* override */);

    if (!std::getenv("LD_BIND_NOW")) // must be set by parent.
        LOG_INF("Note: LD_BIND_NOW is not set.");

    if (!NoCapsForKit && !haveCorrectCapabilities())
        return Application::EXIT_SOFTWARE;

    // Initialize LoKit
    if (!globalPreinit(loTemplate))
        std::_Exit(Application::EXIT_SOFTWARE);

    LOG_INF("Preinit stage OK.");

    // We must have at least one child, more are created dynamically.
    // Ask this first child to send version information to master process
    Process::PID forKitPid = createLibreOfficeKit(childRoot, sysTemplate, loTemplate, loSubPath, true);
    if (forKitPid < 0)
    {
        LOG_FTL("Failed to create a kit process.");
        std::_Exit(Application::EXIT_SOFTWARE);
    }

    CommandDispatcher commandDispatcher(0);
    LOG_INF("ForKit process is ready.");

    while (!TerminationFlag)
    {
        UnitKit::get().invokeForKitTest();

        if (!commandDispatcher.pollAndDispatch())
        {
            LOG_INF("Child dispatcher flagged for termination.");
            break;
        }

        forkLibreOfficeKit(childRoot, sysTemplate, loTemplate, loSubPath);
    }

    int returnValue = Application::EXIT_OK;
    UnitKit::get().returnValue(returnValue);

#if 0
    int status = 0;
    waitpid(forKitPid, &status, WUNTRACED);
#endif

    LOG_INF("ForKit process finished.");
    std::_Exit(returnValue);
}
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
