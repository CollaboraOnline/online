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
/*
 * A very simple, single threaded helper to efficiently pre-init and
 * spawn lots of kits as children.
 */

#include <config.h>
#include <config_version.h>

#ifndef __FreeBSD__
#include <sys/capability.h>
#endif
#include <sys/types.h>
#include <sys/wait.h>
#include <sysexits.h>

#include <atomic>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <map>
#include <thread>
#include <chrono>

#include <Poco/Path.h>
#include <Poco/URI.h>

#include <Common.hpp>
#include "Kit.hpp"
#include "SetupKitEnvironment.hpp"
#include <Log.hpp>
#include <Simd.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <WebSocketHandler.hpp>

#include <common/FileUtil.hpp>
#include <common/JailUtil.hpp>
#include <common/Seccomp.hpp>
#include <common/SigUtil.hpp>
#include <common/security.h>
#include <common/ConfigUtil.hpp>
#include <kit/DeltaSimd.h>

static bool NoCapsForKit = false;
static bool NoSeccomp = false;
#if ENABLE_DEBUG
static bool SingleKit = false;
#endif

static std::string UserInterface;

static bool DisplayVersion = false;
static std::string UnitTestLibrary;
static std::string LogLevel;
static std::string LogLevelStartup;
static std::atomic<unsigned> ForkCounter(0);

/// The [child pid -> jail path] map.
static std::map<pid_t, std::string> childJails;
/// The jails that need cleaning up. This should be small.
static std::vector<std::string> cleanupJailPaths;

/// The Main polling main-loop of this (single threaded) process
static std::unique_ptr<SocketPoll> ForKitPoll;

extern "C" { void dump_forkit_state(void); /* easy for gdb */ }

void dump_forkit_state()
{
    std::ostringstream oss;

    oss << "Forkit: " << ForkCounter << " forks\n"
        << "  LogLevel: " << LogLevel << "\n"
        << "  LogLevelStartup: " << LogLevelStartup << "\n"
        << "  unit test: " << UnitTestLibrary << "\n"
        << "  NoCapsForKit: " << NoCapsForKit << "\n"
        << "  NoSeccomp: " << NoSeccomp << "\n"
#if ENABLE_DEBUG
        << "  SingleKit: " << SingleKit << "\n"
#endif
        << "  ClientPortNumber: " << ClientPortNumber << "\n"
        << "  MasterLocation: " << MasterLocation
        << "\n";

    const std::string msg = oss.str();
    fprintf(stderr, "%s", msg.c_str());
    LOG_TRC(msg);
}

class ServerWSHandler;

// We have a single thread and a single connection so we won't bother with
// access synchronization
std::shared_ptr<ServerWSHandler> WSHandler;

class ServerWSHandler final : public WebSocketHandler
{
    std::string _socketName;

public:
    ServerWSHandler(const std::string& socketName) :
        WebSocketHandler(/* isClient = */ true, /* isMasking */ false),
        _socketName(socketName)
    {
    }

protected:
    void handleMessage(const std::vector<char>& data) override
    {
        std::string message(data.data(), data.size());

        if (!Util::isMobileApp() && UnitKit::get().filterKitMessage(this, message))
            return;

        StringVector tokens = StringVector::tokenize(message);

        LOG_DBG(_socketName << ": recv [" <<
                [&](auto& log)
                {
                    for (const auto& token : tokens)
                    {
                        log << tokens.getParam(token) << ' ';
                    }
                });

        // Note: Syntax or parsing errors here are unexpected and fatal.
        if (SigUtil::getTerminationFlag())
        {
            LOG_DBG("Termination flag set: skip message processing");
        }
        else if (tokens.size() == 2 && tokens.equals(0, "spawn"))
        {
            const int count = std::stoi(tokens[1]);
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
        else if (tokens.size() == 2 && tokens.equals(0, "setloglevel"))
        {
            // Set environment variable so that new children will also set their log levels accordingly.
            setenv("COOL_LOGLEVEL", tokens[1].c_str(), 1);
            Log::logger().setLevel(tokens[1]);
        }
        else if (tokens.size() == 3 && tokens.equals(0, "setconfig"))
        {
            // Currently only rlimit entries are supported.
            if (!Rlimit::handleSetrlimitCommand(tokens))
            {
                LOG_ERR("Unknown setconfig command: " << message);
            }
        }
        else if (tokens.size() == 2 && tokens.equals(0, "addfont"))
        {
            // Tell core to use that font file
            std::string fontFile = tokens[1];

            assert(loKitPtr);
            loKitPtr->pClass->setOption(loKitPtr, "addfont", Poco::URI(Poco::Path(fontFile)).toString().c_str());
        }
        else if (tokens.equals(0, "exit"))
        {
            LOG_INF("Setting TerminationFlag due to 'exit' command from parent.");
            SigUtil::setTerminationFlag();
        }
        else
        {
            LOG_ERR("Bad or unknown token [" << tokens[0] << ']');
        }
    }

    void onDisconnect() override
    {
        if (Util::isMobileApp())
            return;
        LOG_ERR("ForKit connection lost without exit arriving from wsd. Setting TerminationFlag");
        SigUtil::setTerminationFlag();
    }
};

#ifndef __FreeBSD__
static bool haveCapability(cap_value_t capability)
{
    cap_t caps = cap_get_proc();

    if (caps == nullptr)
    {
        LOG_SFL("cap_get_proc() failed");
        return false;
    }

    char *cap_name = cap_to_name(capability);
    cap_flag_value_t value;

    if (cap_get_flag(caps, capability, CAP_EFFECTIVE, &value) == -1)
    {
        if (cap_name)
        {
            LOG_SFL("cap_get_flag failed for " << cap_name);
            cap_free(cap_name);
        }
        else
        {
            LOG_SFL("cap_get_flag failed for capability " << capability);
        }
        return false;
    }

    if (value != CAP_SET)
    {
        if (cap_name)
        {
            LOG_ERR("Capability " << cap_name << " is not set for the coolforkit program.");
            cap_free(cap_name);
        }
        else
        {
            LOG_ERR("Capability " << capability << " is not set for the coolforkit program.");
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
    if (!haveCapability(CAP_CHOWN))
        result = false;

    return result;
}
#else
static bool haveCorrectCapabilities()
{
    // chroot() can only be called by root
    return getuid() == 0;
}
#endif // __FreeBSD__

/// Check if some previously forked kids have died.
static void cleanupChildren()
{
    if (Util::isKitInProcess())
        return;

    pid_t exitedChildPid;
    int status = 0;
    int segFaultCount = 0;

    LOG_TRC("cleanupChildren with " << childJails.size()
                                    << (childJails.size() == 1 ? " child" : " children"));

    // Reap quickly without doing slow cleanup so WSD can spawn more rapidly.
    while ((exitedChildPid = waitpid(-1, &status, WUNTRACED | WNOHANG)) > 0)
    {
        const auto it = childJails.find(exitedChildPid);
        if (it != childJails.end())
        {
            if (WIFSIGNALED(status) && (WTERMSIG(status) == SIGSEGV ||
                                        WTERMSIG(status) == SIGBUS ||
                                        WTERMSIG(status) == SIGABRT))
            {
                ++segFaultCount;

                std::string noteCrashFile(it->second + "/tmp/kit-crashed");
                int noteCrashFD = open(noteCrashFile.c_str(), O_CREAT | O_TRUNC | O_WRONLY, S_IRUSR | S_IWUSR);
                if (noteCrashFD < 0)
                    LOG_ERR("Couldn't create file: " << noteCrashFile << " due to error: " << strerror(errno));
                else
                    close(noteCrashFD);
            }

            LOG_INF("Child " << exitedChildPid << " has exited, will remove its jail [" << it->second << "].");
            cleanupJailPaths.emplace_back(it->second);
            childJails.erase(it);
            if (childJails.empty() && !SigUtil::getTerminationFlag())
            {
                // We ran out of kits and we aren't terminating.
                LOG_WRN("No live Kits exist, and we are not terminating yet.");
            }
        }
        else
        {
            LOG_ERR("Unknown child " << exitedChildPid << " has exited");
        }
    }

    if (Log::traceEnabled())
    {
        std::ostringstream oss;
        for (const auto& pair : childJails)
            oss << pair.first << ' ';

        LOG_TRC("cleanupChildren reaped " << cleanupJailPaths.size() << " children to have "
                                          << childJails.size() << " left: " << oss.str());
    }

    if (segFaultCount)
    {
        if (WSHandler)
        {
            std::stringstream stream;
            stream << "segfaultcount " << segFaultCount << '\n';
            int ret = WSHandler->sendMessage(stream.str());
            if (ret == -1)
            {
                LOG_WRN("Could not send 'segfaultcount' message through websocket");
            }
            else
            {
                LOG_WRN("Successfully sent 'segfaultcount' message " << stream.str());
            }
        }
    }

    // Now delete the jails.
    auto i = cleanupJailPaths.size();
    while (i-- > 0)
    {
        const std::string path = cleanupJailPaths[i];

        // don't delete jails where there was a crash until it ~3 minutes old
        std::string noteCrashFile(path + "/tmp/kit-crashed");
        auto noteStat = FileUtil::Stat(noteCrashFile);
        if (noteStat.good())
        {
            time_t modifiedTimeSec = noteStat.modifiedTimeMs() / 1000;
            if (time(nullptr) < modifiedTimeSec + 180)
                continue;
        }

        JailUtil::tryRemoveJail(path);
        const FileUtil::Stat st(path);
        if (st.good() && st.isDirectory())
            LOG_DBG("Could not remove jail path [" << path << "]. Will retry later.");
        else
            cleanupJailPaths.erase(cleanupJailPaths.begin() + i);
    }
}

void sleepForDebugger()
{
    if (std::getenv("SLEEPKITFORDEBUGGER"))
    {
        const size_t delaySecs = std::stoul(std::getenv("SLEEPKITFORDEBUGGER"));
        if (delaySecs > 0)
        {
            std::cerr << "Kit: Sleeping " << delaySecs
                      << " seconds to give you time to attach debugger to process " << getpid()
                      << std::endl;
            std::this_thread::sleep_for(std::chrono::seconds(delaySecs));
        }
    }
}

static int createLibreOfficeKit(const std::string& childRoot,
                                const std::string& sysTemplate,
                                const std::string& loTemplate,
                                bool queryVersion = false)
{
    // Generate a jail ID to be used for in the jail path.
    const std::string jailId = Util::rng::getFilename(16);

    // Update the dynamic files as necessary.
    JailUtil::SysTemplate::updateDynamicFiles(sysTemplate);

    // Used to label the spare kit instances
    static size_t spareKitId = 0;
    ++spareKitId;
    LOG_DBG("Forking a coolkit process with jailId: " << jailId << " as spare coolkit #"
                                                      << spareKitId << '.');
    const auto startForkingTime = std::chrono::steady_clock::now();

    pid_t pid = 0;
    if (Util::isKitInProcess())
    {
        std::thread([childRoot, jailId, sysTemplate, loTemplate, queryVersion] {
            sleepForDebugger();
            lokit_main(childRoot, jailId, sysTemplate, loTemplate, true, true, queryVersion,
                       DisplayVersion, spareKitId);
        })
            .detach();
    }
    else
    {
        pid = fork();
        if (!pid)
        {
            // Child

            // sort out thread local variables to get logging right from
            // as early as possible.
            Util::setThreadName("kit_spare_" + Util::encodeId(spareKitId, 3));

            // Close the pipe from coolwsd
            close(0);

            // Close the ForKit main-loop's sockets
            if (ForKitPoll)
                ForKitPoll->closeAllSockets();
            // else very first kit process spawned

            SigUtil::setSigChildHandler(nullptr);

            UnitKit::get().postFork();

            sleepForDebugger();

            lokit_main(childRoot, jailId, sysTemplate, loTemplate, NoCapsForKit, NoSeccomp,
                       queryVersion, DisplayVersion, spareKitId);
        }
        else
        {
            // Parent
            if (pid < 0)
            {
                LOG_SYS("Fork failed");
            }
            else
            {
                LOG_INF("Forked kit [" << pid << ']');
                childJails[pid] = childRoot + jailId;
            }

            UnitKit::get().launchedKit(pid);
        }
    }

    const auto duration = (std::chrono::steady_clock::now() - startForkingTime);
    const auto durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
    LOG_TRC("Forking child took " << durationMs);

    return pid;
}

void forkLibreOfficeKit(const std::string& childRoot,
                        const std::string& sysTemplate,
                        const std::string& loTemplate)
{
    // Cleanup first, to reduce disk load.
    cleanupChildren();

    if (ForkCounter > 0)
    {
        // Create as many as requested.
        const size_t count = ForkCounter;
        LOG_INF("Spawning " << count << " new child" << (count == 1 ? "." : "ren."));
        const size_t retry = count * 2;
        for (size_t i = 0; ForkCounter > 0 && i < retry; ++i)
        {
            if (ForkCounter-- <= 0 || createLibreOfficeKit(childRoot, sysTemplate, loTemplate) < 0)
            {
                LOG_ERR("Failed to create a kit process.");
                ++ForkCounter;
            }
        }
    }
}

static void printArgumentHelp()
{
    std::cout << "Usage: coolforkit [OPTION]..." << std::endl;
    std::cout << "  Single-threaded process that spawns lok instances" << std::endl;
    std::cout << "  Note: Running this standalone is not possible. It is spawned by coolwsd" << std::endl;
    std::cout << "        and is controlled via a pipe." << std::endl;
    std::cout << "" << std::endl;
}

extern "C" {
    static void wakeupPoll(uint32_t /*pid*/)
    {
        if (ForKitPoll)
            ForKitPoll->wakeup();
    }
}

int forkit_main(int argc, char** argv)
{
    /*WARNING: PRIVILEGED CODE CHECKING START */

    /*WARNING*/ // early check for avoiding the security check for username 'cool'
    /*WARNING*/ // (deliberately only this, not moving the entire parameter parsing here)
    /*WARNING*/ bool checkCoolUser = true;
    /*WARNING*/ std::string disableCoolUserChecking("--disable-cool-user-checking");
    /*WARNING*/ for (int i = 1; checkCoolUser && (i < argc); ++i)
    /*WARNING*/ {
    /*WARNING*/     if (disableCoolUserChecking == argv[i])
    /*WARNING*/         checkCoolUser = false;
    /*WARNING*/ }

    /*WARNING*/ if (!hasCorrectUID("coolforkit"))
    /*WARNING*/ {
    /*WARNING*/     // don't allow if any capability is set (unless root; who runs this
    /*WARNING*/     // as root or runs this in a container and provides --disable-cool-user-checking knows what they
    /*WARNING*/     // are doing)
    /*WARNING*/     if (hasUID("root"))
    /*WARNING*/     {
    /*WARNING*/        // This is fine, the 'root' can do anything anyway
    /*WARNING*/     }
    /*WARNING*/     else if (isInContainer())
    /*WARNING*/     {
    /*WARNING*/         // This is fine, we are confined in the container anyway
    /*WARNING*/     }
    /*WARNING*/     else if (hasAnyCapability())
    /*WARNING*/     {
    /*WARNING*/         if (!checkCoolUser)
    /*WARNING*/             LOG_FTL("Security: --disable-cool-user-checking failed, coolforkit has some capabilities set.");

    /*WARNING*/         LOG_FTL("Aborting.");
    /*WARNING*/         return EX_SOFTWARE;
    /*WARNING*/     }

    /*WARNING*/     // even without the capabilities, don't run unless the user really knows
    /*WARNING*/     // what they are doing, and provided a --disable-cool-user-checking
    /*WARNING*/     if (checkCoolUser)
    /*WARNING*/     {
    /*WARNING*/         LOG_FTL("Aborting.");
    /*WARNING*/         return EX_SOFTWARE;
    /*WARNING*/     }

    /*WARNING*/     LOG_ERR("Security: Check for the 'cool' username overridden on the command line.");
    /*WARNING*/ }

    /*WARNING: PRIVILEGED CODE CHECKING END */

    // Continue in privileged mode, but only if:
    // * the user is 'cool' (privileged user)
    // * the user is 'root', and --disable-cool-user-checking was provided
    // Alternatively allow running in non-privileged mode (with --nocaps), if:
    // * the user is a non-priviled user, the binary is not privileged
    //   either (no caps set), and --disable-cool-user-checking was provided

    if (std::getenv("SLEEPFORDEBUGGER"))
    {
        const size_t delaySecs = std::stoul(std::getenv("SLEEPFORDEBUGGER"));
        if (delaySecs > 0)
        {
            std::cerr << "Forkit: Sleeping " << delaySecs
                      << " seconds to give you time to attach debugger to process "
                      << getpid() << std::endl;
            std::this_thread::sleep_for(std::chrono::seconds(delaySecs));
        }
    }

    if (!Util::isKitInProcess())
    {
        // Already set by COOLWSD.cpp in kit in process
        SigUtil::setFatalSignals("forkit startup of " COOLWSD_VERSION " " COOLWSD_VERSION_HASH);
    }
    else
    {
        // No capabilities by default for kit in process
        NoCapsForKit = true;
        NoSeccomp = true;
#if ENABLE_DEBUG
        SingleKit = true;
#endif
    }

    if (simd::init())
        simd_deltaInit();

    if (!Util::isKitInProcess())
        Util::setApplicationPath(Poco::Path(argv[0]).parent().toString());

    // Initialization
    const bool logToFile = std::getenv("COOL_LOGFILE");
    const char* logFilename = std::getenv("COOL_LOGFILENAME");
    const char* logLevel = std::getenv("COOL_LOGLEVEL");
    const char* logLevelStartup = std::getenv("COOL_LOGLEVEL_STARTUP");
    const char* logColor = std::getenv("COOL_LOGCOLOR");
    std::map<std::string, std::string> logProperties;
    if (logToFile && logFilename)
    {
        logProperties["path"] = std::string(logFilename);
    }

    LogLevelStartup = logLevelStartup ? logLevelStartup : "trace";
    Log::initialize("frk", LogLevelStartup, logColor != nullptr, logToFile, logProperties);

    LogLevel = logLevel ? logLevel : "trace";
    if (LogLevel != LogLevelStartup)
    {
        LOG_INF("Setting log-level to [" << LogLevelStartup << " and delaying "
                "setting to configured [" << LogLevel << "] until after Forkit initialization.");
    }

    std::string childRoot;
    std::string sysTemplate;
    std::string loTemplate;

    for (int i = 0; i < argc; ++i)
    {
        char *cmd = argv[i];
        char *eq;
        if (std::strstr(cmd, "--systemplate=") == cmd)
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
            MasterLocation = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--version") == cmd)
        {
            std::string version, hash;
            Util::getVersionInfo(version, hash);
            std::cout << "coolforkit version details: " << version << " - " << hash << std::endl;
            DisplayVersion = true;
        }
        else if (std::strstr(cmd, "--rlimits") == cmd)
        {
            eq = std::strchr(cmd, '=');
            const std::string rlimits = std::string(eq+1);
            StringVector tokens = StringVector::tokenize(rlimits, ';');
            for (const auto& cmdLimit : tokens)
            {
                const std::pair<std::string, std::string> pair = Util::split(tokens.getParam(cmdLimit), ':');
                StringVector tokensLimit;
                tokensLimit.push_back("setconfig");
                tokensLimit.push_back(pair.first);
                tokensLimit.push_back(pair.second);
                if (!Rlimit::handleSetrlimitCommand(tokensLimit))
                {
                    LOG_ERR("Unknown rlimits command: " << tokens.getParam(cmdLimit));
                }
            }
        }
        else if (std::strstr(cmd, "--unattended") == cmd)
        {
            SigUtil::setUnattended();
        }
#if ENABLE_DEBUG
        // this process has various privileges - don't run arbitrary code.
        else if (std::strstr(cmd, "--unitlib=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            UnitTestLibrary = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--singlekit") == cmd)
        {
            SingleKit = true;
        }
#endif
        // we are running in a lower-privilege mode - with no chroot
        else if (std::strstr(cmd, "--nocaps") == cmd)
        {
            LOG_ERR("Security: Running without the capability to enter a chroot jail is ill advised.");
            NoCapsForKit = true;
        }

        // we are running without seccomp protection
        else if (std::strstr(cmd, "--noseccomp") == cmd)
        {
            LOG_ERR("Security: Running without the ability to filter system calls is ill advised.");
            NoSeccomp = true;
        }

        else if (std::strstr(cmd, "--ui") == cmd)
        {
            eq = std::strchr(cmd, '=');
            UserInterface = std::string(eq+1);
            if (UserInterface != "classic" && UserInterface != "notebookbar")
                UserInterface = "notebookbar";
        }
    }

    if (sysTemplate.empty() || loTemplate.empty() || childRoot.empty())
    {
        printArgumentHelp();
        return EX_USAGE;
    }

    if (!Util::isKitInProcess() && !UnitBase::init(UnitBase::UnitType::Kit, UnitTestLibrary))
    {
        LOG_FTL("Failed to load kit unit test library");
        return EX_USAGE;
    }

    setupKitEnvironment(UserInterface);

    if (!std::getenv("LD_BIND_NOW")) // must be set by parent.
        LOG_INF("Note: LD_BIND_NOW is not set.");

    if (!NoCapsForKit && !haveCorrectCapabilities())
    {
        LOG_FTL("Capabilities are not set for the coolforkit program.");
        LOG_FTL("Please make sure that the current partition was *not* mounted with the 'nosuid' option.");
        LOG_FTL("If you are on SLES11, please set 'file_caps=1' as kernel boot option.");
        return EX_SOFTWARE;
    }

    // Initialize LoKit
    if (!globalPreinit(loTemplate))
    {
        LOG_FTL("Failed to preinit lokit.");
        Util::forcedExit(EX_SOFTWARE);
    }

    if (Util::ThreadCounter().count() != 1)
        LOG_ERR("forkit has more than a single thread after pre-init");

    // Link the network and system files in sysTemplate, if possible.
    JailUtil::SysTemplate::setupDynamicFiles(sysTemplate);

    // Make dev/[u]random point to the writable devices in tmp/dev/.
    JailUtil::SysTemplate::setupRandomDeviceLinks(sysTemplate);

    if (!Util::isKitInProcess())
    {
        // Parse the configuration.
        const auto conf = std::getenv("COOL_CONFIG");
        config::initialize(std::string(conf ? conf : std::string()));
        EnableExperimental = config::getBool("experimental_features", false);
    }

    Util::setThreadName("forkit");

    LOG_INF("Preinit stage OK.");

    // We must have at least one child, more are created dynamically.
    // Ask this first child to send version information to master process and trace startup.
    ::setenv("COOL_TRACE_STARTUP", "1", 1);
    const pid_t forKitPid = createLibreOfficeKit(childRoot, sysTemplate, loTemplate, true);
    if (forKitPid < 0)
    {
        LOG_FTL("Failed to create a kit process.");
        Util::forcedExit(EX_SOFTWARE);
    }

    // No need to trace subsequent children.
    ::unsetenv("COOL_TRACE_STARTUP");
    if (LogLevel != LogLevelStartup)
    {
        LOG_INF("Forkit initialization complete: setting log-level to [" << LogLevel << "] as configured.");
        Log::logger().setLevel(LogLevel);
    }

    ForKitPoll.reset(new SocketPoll (Util::getThreadName()));
    ForKitPoll->runOnClientThread(); // We will do the polling on this thread.

    // Reap zombies when we get the signal
    SigUtil::setSigChildHandler(wakeupPoll);

    WSHandler = std::make_shared<ServerWSHandler>("forkit_ws");

    if (!Util::isMobileApp() &&
        !ForKitPoll->insertNewUnixSocket(MasterLocation, FORKIT_URI, WSHandler))
    {
        LOG_SFL("Failed to connect to WSD. Will exit.");
        Util::forcedExit(EX_SOFTWARE);
    }

    SigUtil::setUserSignals();

    const int parentPid = getppid();
    LOG_INF("ForKit process is ready. Parent: " << parentPid);

    while (!SigUtil::getShutdownRequestFlag())
    {
        UnitKit::get().invokeForKitTest();

        ForKitPoll->poll(std::chrono::seconds(POLL_FORKIT_TIMEOUT_SECS));

        SigUtil::checkDumpGlobalState(dump_forkit_state);

        // When our parent exits, we are assigned a new parent (typically init).
        if (getppid() != parentPid)
        {
            LOG_SFL("Parent process has died. Will exit now.");
            break;
        }

#if ENABLE_DEBUG
        if (!SingleKit)
#endif
            // new kits are launched primarily after a 'spawn' message
            if (!Util::isKitInProcess() && !SigUtil::getTerminationFlag())
                forkLibreOfficeKit(childRoot, sysTemplate, loTemplate);
    }

    const int returnValue = UnitBase::uninit();

    LOG_INF("ForKit process finished.");
    Util::forcedExit(returnValue);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
