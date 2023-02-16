/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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

#include <Common.hpp>
#include "Kit.hpp"
#include "SetupKitEnvironment.hpp"
#include <Log.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <WebSocketHandler.hpp>
#if !MOBILEAPP
#include <Admin.hpp>
#endif

#include <common/FileUtil.hpp>
#include <common/JailUtil.hpp>
#include <common/Seccomp.hpp>
#include <common/SigUtil.hpp>
#include <common/security.h>
#include <common/ConfigUtil.hpp>

#ifndef KIT_IN_PROCESS
static bool NoCapsForKit = false;
static bool NoSeccomp = false;
#if ENABLE_DEBUG
static bool SingleKit = false;
#endif
#else
static const bool NoCapsForKit = true; // NoCaps for in-process kit.
static const bool NoSeccomp = true; // NoSeccomp for in-process kit.
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

#ifndef KIT_IN_PROCESS
int ClientPortNumber = DEFAULT_CLIENT_PORT_NUMBER;
std::string MasterLocation;
#endif

extern "C" { void dump_forkit_state(void); /* easy for gdb */ }

void dump_forkit_state()
{
    std::ostringstream oss;

    oss << "Forkit: " << ForkCounter << " forks\n"
        << "  LogLevel: " << LogLevel << "\n"
        << "  LogLevelStartup: " << LogLevelStartup << "\n"
        << "  unit test: " << UnitTestLibrary << "\n"
#ifndef KIT_IN_PROCESS
        << "  NoCapsForKit: " << NoCapsForKit << "\n"
        << "  NoSeccomp: " << NoSeccomp << "\n"
#  if ENABLE_DEBUG
        << "  SingleKit: " << SingleKit << "\n"
#  endif
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

#if !MOBILEAPP
        if (UnitKit::get().filterKitMessage(this, message))
            return;
#endif
        StringVector tokens = StringVector::tokenize(message);
        Log::StreamLogger logger = Log::debug();
        if (logger.enabled())
        {
            logger << _socketName << ": recv [";
            for (const auto& token : tokens)
            {
                logger << tokens.getParam(token) << ' ';
            }

            LOG_END_FLUSH(logger);
        }

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
#if !MOBILEAPP
        LOG_ERR("ForKit connection lost without exit arriving from wsd. Setting TerminationFlag");
        SigUtil::setTerminationFlag();
#endif
    }
};

#ifndef KIT_IN_PROCESS
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
#endif

/// Check if some previously forked kids have died.
static void cleanupChildren()
{
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
            LOG_INF("Child " << exitedChildPid << " has exited, will remove its jail [" << it->second << "].");
            cleanupJailPaths.emplace_back(it->second);
            childJails.erase(it);
            if (childJails.empty() && !SigUtil::getTerminationFlag())
            {
                // We ran out of kits and we aren't terminating.
                LOG_WRN("No live Kits exist, and we are not terminating yet.");
            }

            if (WIFSIGNALED(status) && (WTERMSIG(status) == SIGSEGV || WTERMSIG(status) == SIGBUS))
            {
                ++segFaultCount;
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
#ifdef KIT_IN_PROCESS
#if !MOBILEAPP
        Admin::instance().addSegFaultCount(segFaultCount);
#endif
#else
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
#endif
    }

    // Now delete the jails.
    auto i = cleanupJailPaths.size();
    while (i-- > 0)
    {
        const std::string path = cleanupJailPaths[i];
        JailUtil::removeJail(path);
        const FileUtil::Stat st(path);
        if (st.good() && st.isDirectory())
            LOG_DBG("Could not remove jail path [" << path << "]. Will retry later.");
        else
            cleanupJailPaths.erase(cleanupJailPaths.begin() + i);
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

    const pid_t pid = fork();
    if (!pid)
    {
        // Child

        // Close the pipe from coolwsd
        close(0);

#ifndef KIT_IN_PROCESS
        UnitKit::get().postFork();
#endif

        if (std::getenv("SLEEPKITFORDEBUGGER"))
        {
            const size_t delaySecs = std::stoul(std::getenv("SLEEPKITFORDEBUGGER"));
            if (delaySecs > 0)
            {
                std::cerr << "Kit: Sleeping " << delaySecs
                          << " seconds to give you time to attach debugger to process "
                          << getpid() << std::endl;
                std::this_thread::sleep_for(std::chrono::seconds(delaySecs));
            }
        }

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

#ifndef KIT_IN_PROCESS
        UnitKit::get().launchedKit(pid);
#endif
    }

    const auto duration = (std::chrono::steady_clock::now() - startForkingTime);
    const auto durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
    LOG_TRC("Forking child took " << durationMs);

    return pid;
}

void forkLibreOfficeKit(const std::string& childRoot,
                        const std::string& sysTemplate,
                        const std::string& loTemplate,
                        int limit)
{
    LOG_TRC("forkLibreOfficeKit limit: " << limit);

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
            if (ForkCounter-- <= 0 || createLibreOfficeKit(childRoot, sysTemplate, loTemplate) < 0)
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
    std::cout << "Usage: coolforkit [OPTION]..." << std::endl;
    std::cout << "  Single-threaded process that spawns lok instances" << std::endl;
    std::cout << "  Note: Running this standalone is not possible. It is spawned by coolwsd" << std::endl;
    std::cout << "        and is controlled via a pipe." << std::endl;
    std::cout << "" << std::endl;
}

int main(int argc, char** argv)
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

    SigUtil::setFatalSignals("forkit startup of " COOLWSD_VERSION " " COOLWSD_VERSION_HASH);

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

    if (!UnitBase::init(UnitBase::UnitType::Kit,
                        UnitTestLibrary))
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

    if (Util::getProcessThreadCount() != 1)
        LOG_ERR("forkit has more than a single thread after pre-init");

    // Link the network and system files in sysTemplate, if possible.
    JailUtil::SysTemplate::setupDynamicFiles(sysTemplate);

    // Make dev/[u]random point to the writable devices in tmp/dev/.
    JailUtil::SysTemplate::setupRandomDeviceLinks(sysTemplate);

#if !MOBILEAPP
    // Parse the configuration.
    const auto conf = std::getenv("COOL_CONFIG");
    config::initialize(std::string(conf ? conf : std::string()));
    EnableExperimental = config::getBool("experimental_features", false);
#endif

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

    SocketPoll mainPoll(Util::getThreadName());
    mainPoll.runOnClientThread(); // We will do the polling on this thread.

    WSHandler = std::make_shared<ServerWSHandler>("forkit_ws");

#if !MOBILEAPP
    if (!mainPoll.insertNewUnixSocket(MasterLocation, FORKIT_URI, WSHandler))
    {
        LOG_SFL("Failed to connect to WSD. Will exit.");
        Util::forcedExit(EX_SOFTWARE);
    }
#endif

    SigUtil::setUserSignals();

    const int parentPid = getppid();
    LOG_INF("ForKit process is ready. Parent: " << parentPid);

    while (!SigUtil::getShutdownRequestFlag() && !SigUtil::getTerminationFlag())
    {
        UnitKit::get().invokeForKitTest();

        mainPoll.poll(std::chrono::microseconds(POLL_TIMEOUT_MICRO_S));

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
            forkLibreOfficeKit(childRoot, sysTemplate, loTemplate);
    }

    const int returnValue = UnitBase::uninit();

    LOG_INF("ForKit process finished.");
    Util::forcedExit(returnValue);
}
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
