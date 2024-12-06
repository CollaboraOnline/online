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
#include <config_version.h>

#include "COOLWSD.hpp"

/* Default host used in the start test URI */
#define COOLWSD_TEST_HOST "localhost"

/* Default cool UI used in the admin console URI */
#define COOLWSD_TEST_ADMIN_CONSOLE "/browser/dist/admin/admin.html"

/* Default cool UI used in for monitoring URI */
#define COOLWSD_TEST_METRICS "/cool/getMetrics"

/* Default cool UI used in the start test URI */
#define COOLWSD_TEST_COOL_UI "/browser/" COOLWSD_VERSION_HASH "/debug.html"

/* Default ciphers used, when not specified otherwise */
#define DEFAULT_CIPHER_SET "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH"

// This is the main source for the coolwsd program. COOL uses several coolwsd processes: one main
// parent process that listens on the TCP port and accepts connections from COOL clients, and a
// number of child processes, each which handles a viewing (editing) session for one document.

#include <unistd.h>
#include <sysexits.h>

#include <sys/types.h>
#include <sys/wait.h>
#include <sys/resource.h>

#include <cassert>
#include <clocale>
#include <condition_variable>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <chrono>
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <regex>
#include <sstream>
#include <string>
#include <thread>

#if ENABLE_FEATURE_LOCK
#include "CommandControl.hpp"
#endif

#if !MOBILEAPP

#if ENABLE_SSL
#include <Poco/Net/SSLManager.h>
#endif

#include <cerrno>
#include <stdexcept>
#include <unordered_map>

#include "Admin.hpp"
#include "Auth.hpp"
#include "FileServer.hpp"
#include "UserMessages.hpp"
#include <wsd/RemoteConfig.hpp>
#include <wsd/SpecialBrokers.hpp>

#endif // !MOBILEAPP

#include <Poco/DirectoryIterator.h>
#include <Poco/Exception.h>
#include <Poco/File.h>
#include <Poco/Path.h>
#include <Poco/URI.h>
#include <Poco/Util/AbstractConfiguration.h>
#include <Poco/Util/HelpFormatter.h>
#include <Poco/Util/MapConfiguration.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionException.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>
#include <Poco/Util/XMLConfiguration.h>

#include <common/Anonymizer.hpp>
#include <ClientRequestDispatcher.hpp>
#include <Common.hpp>
#include <Clipboard.hpp>
#include <Crypto.hpp>
#include <DelaySocket.hpp>
#include <wsd/DocumentBroker.hpp>
#include <wsd/Process.hpp>
#include <common/JsonUtil.hpp>
#include <common/FileUtil.hpp>
#include <common/JailUtil.hpp>
#include <common/Watchdog.hpp>
#include <Log.hpp>
#include <MobileApp.hpp>
#include <Protocol.hpp>
#include <Session.hpp>
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif
#include <wsd/wopi/StorageConnectionManager.hpp>
#include <wsd/TraceFile.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <common/ConfigUtil.hpp>

#include <common/SigUtil.hpp>
#include <net/AsyncDNS.hpp>

#include <ServerSocket.hpp>

#if MOBILEAPP
#include <Kit.hpp>
#ifdef IOS
#include "ios.h"
#elif defined(GTKAPP)
#include "gtk.hpp"
#elif defined(__ANDROID__)
#include "androidapp.hpp"
#elif WASMAPP
#include "wasmapp.hpp"
#endif
#endif // MOBILEAPP

#ifdef __linux__
#if !MOBILEAPP
#include <common/security.h>
#include <sys/inotify.h>
#endif
#endif

using Poco::Util::LayeredConfiguration;
using Poco::Util::Option;

/// Port for external clients to connect to
int ClientPortNumber = 0;
/// Protocols to listen on
Socket::Type ClientPortProto = Socket::Type::All;

/// INET address to listen on
ServerSocket::Type ClientListenAddr = ServerSocket::Type::Public;

#if !MOBILEAPP
/// UDS address for kits to connect to.
std::string MasterLocation;

std::string COOLWSD::BuyProductUrl;
std::string COOLWSD::LatestVersion;
std::mutex COOLWSD::FetchUpdateMutex;
std::mutex COOLWSD::RemoteConfigMutex;
std::shared_ptr<http::Session> FetchHttpSession;
#endif

// Tracks the set of prisoners / children waiting to be used.
static std::mutex NewChildrenMutex;
static std::condition_variable NewChildrenCV;
static std::vector<std::shared_ptr<ChildProcess> > NewChildren;

static std::chrono::steady_clock::time_point LastForkRequestTime = std::chrono::steady_clock::now();
static std::atomic<int> OutstandingForks(0);
std::map<std::string, std::shared_ptr<DocumentBroker>> DocBrokers;
std::mutex DocBrokersMutex;
static Poco::AutoPtr<Poco::Util::XMLConfiguration> KitXmlConfig;
static std::string LoggableConfigEntries;

extern "C"
{
    void dump_state(void); /* easy for gdb */
    void forwardSigUsr2();
}

#if ENABLE_DEBUG && !MOBILEAPP
static std::chrono::milliseconds careerSpanMs(std::chrono::milliseconds::zero());
#endif

/// The timeout for a child to spawn, initially high, then reset to the default.
int ChildSpawnTimeoutMs = CHILD_SPAWN_TIMEOUT_MS;
std::atomic<unsigned> COOLWSD::NumConnections;
std::unordered_set<std::string> COOLWSD::EditFileExtensions;

#if MOBILEAPP

// Or can this be retrieved in some other way?
int COOLWSD::prisonerServerSocketFD;

#else

/// Funky latency simulation basic delay (ms)
static std::size_t SimulatedLatencyMs = 0;

#endif

void COOLWSD::appendAllowedHostsFrom(LayeredConfiguration& conf, const std::string& root, std::vector<std::string>& allowed)
{
    for (size_t i = 0; ; ++i)
    {
        const std::string path = root + ".host[" + std::to_string(i) + ']';
        if (!conf.has(path))
        {
            break;
        }
        const std::string host = ConfigUtil::getConfigValue<std::string>(conf, path, "");
        if (!host.empty())
        {
            LOG_INF_S("Adding trusted LOK_ALLOW host: [" << host << ']');
            allowed.push_back(host);
        }
    }
}

namespace {
std::string removeProtocolAndPort(const std::string& host)
{
    std::string result;

    // protocol
    size_t pos = host.find("//");
    if (pos != std::string::npos)
        result = host.substr(pos + 2);
    else
        result = host;

    // port
    pos = result.find(":");
    if (pos != std::string::npos)
    {
        if (pos == 0)
            return "";

        result = result.substr(0, pos);
    }

    return result;
}

bool isValidRegex(const std::string& expression)
{
    try
    {
        std::regex regex(expression);
        return true;
    }
    catch (const std::regex_error& e) {}

    return false;
}
}

void COOLWSD::appendAllowedAliasGroups(LayeredConfiguration& conf, std::vector<std::string>& allowed)
{
    for (size_t i = 0;; i++)
    {
        const std::string path = "storage.wopi.alias_groups.group[" + std::to_string(i) + ']';
        if (!conf.has(path + ".host"))
        {
            break;
        }

        std::string host = conf.getString(path + ".host", "");
        bool allow = conf.getBool(path + ".host[@allow]", false);
        if (!allow)
        {
            break;
        }

        host = removeProtocolAndPort(host);

        if (!host.empty())
        {
            LOG_INF_S("Adding trusted LOK_ALLOW host: [" << host << ']');
            allowed.push_back(host);
        }

        for (size_t j = 0;; j++)
        {
            const std::string aliasPath = path + ".alias[" + std::to_string(j) + ']';
            if (!conf.has(aliasPath))
            {
                break;
            }

            std::string alias = ConfigUtil::getConfigValue<std::string>(conf, aliasPath, "");

            alias = removeProtocolAndPort(alias);
            if (!alias.empty())
            {
                LOG_INF_S("Adding trusted LOK_ALLOW alias: [" << alias << ']');
                allowed.push_back(alias);
            }
        }
    }
}

/// Internal implementation to alert all clients
/// connected to any document.
void COOLWSD::alertAllUsersInternal(const std::string& msg)
{
    if constexpr (Util::isMobileApp())
        return;
    std::lock_guard<std::mutex> docBrokersLock(DocBrokersMutex);

    LOG_INF("Alerting all users: [" << msg << ']');
    SigUtil::addActivity("alert all users: " + msg);

    if (UnitWSD::get().filterAlertAllusers(msg))
        return;

    for (auto& brokerIt : DocBrokers)
    {
        std::shared_ptr<DocumentBroker> docBroker = brokerIt.second;
        docBroker->addCallback([msg, docBroker](){ docBroker->alertAllUsers(msg); });
    }
}

void COOLWSD::alertUserInternal(const std::string& dockey, const std::string& msg)
{
    if constexpr (Util::isMobileApp())
        return;
    std::lock_guard<std::mutex> docBrokersLock(DocBrokersMutex);

    LOG_INF("Alerting document users with dockey: [" << dockey << ']' << " msg: [" << msg << ']');

    for (auto& brokerIt : DocBrokers)
    {
        std::shared_ptr<DocumentBroker> docBroker = brokerIt.second;
        if (docBroker->getDocKey() == dockey)
            docBroker->addCallback([msg, docBroker](){ docBroker->alertAllUsers(msg); });
    }
}

void COOLWSD::writeTraceEventRecording(const char *data, std::size_t nbytes)
{
    static std::mutex traceEventFileMutex;

    std::unique_lock<std::mutex> lock(traceEventFileMutex);

    fwrite(data, nbytes, 1, COOLWSD::TraceEventFile);
}

void COOLWSD::writeTraceEventRecording(const std::string &recording)
{
    writeTraceEventRecording(recording.data(), recording.length());
}

void COOLWSD::checkSessionLimitsAndWarnClients()
{
#if !MOBILEAPP
    if constexpr (ConfigUtil::isSupportKeyEnabled())
        return;

    ssize_t docBrokerCount = DocBrokers.size() - ConvertToBroker::getInstanceCount();
    if (COOLWSD::MaxDocuments < 10000 &&
        (docBrokerCount > static_cast<ssize_t>(COOLWSD::MaxDocuments) || COOLWSD::NumConnections >= COOLWSD::MaxConnections))
    {
        const std::string info = Poco::format(PAYLOAD_INFO_LIMIT_REACHED, COOLWSD::MaxDocuments, COOLWSD::MaxConnections);
        LOG_INF("Sending client 'limitreached' message: " << info);

        try
        {
            Util::alertAllUsers(info);
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Error while shutting down socket on reaching limit: " << ex.what());
        }
    }
#endif
}

void COOLWSD::checkDiskSpaceAndWarnClients(const bool cacheLastCheck)
{
#if !MOBILEAPP
    try
    {
        const std::string fs = FileUtil::checkDiskSpaceOnRegisteredFileSystems(cacheLastCheck);
        if (!fs.empty())
        {
            LOG_WRN("Filesystem [" << fs << "] is dangerously low on disk space");
            COOLWSD::alertAllUsersInternal("error: cmd=internal kind=diskfull");
        }
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Exception while checking disk-space and warning clients: " << exc.what());
    }
#else
    (void) cacheLastCheck;
#endif
}

/// Remove dead and idle DocBrokers.
/// The client of idle document should've greyed-out long ago.
void cleanupDocBrokers()
{
    Util::assertIsLocked(DocBrokersMutex);

    const size_t count = DocBrokers.size();
    for (auto it = DocBrokers.begin(); it != DocBrokers.end(); )
    {
        std::shared_ptr<DocumentBroker> docBroker = it->second;

        // Remove only when not alive.
        if (!docBroker->isAlive())
        {
            LOG_INF("Removing DocumentBroker for docKey [" << it->first << "].");
            docBroker->dispose();
            it = DocBrokers.erase(it);
            continue;
        } else {
            ++it;
        }
    }

    if (count != DocBrokers.size())
    {
        LOG_TRC("Have " << DocBrokers.size() << " DocBrokers after cleanup.\n"
                        <<
                [&](auto& log)
                {
                    for (auto& pair : DocBrokers)
                    {
                        log << "DocumentBroker [" << pair.first << "].\n";
                    }
                });

#if !MOBILEAPP && ENABLE_DEBUG
        if (COOLWSD::SingleKit && DocBrokers.empty())
        {
            LOG_DBG("Setting ShutdownRequestFlag: No more docs left in single-kit mode.");
            SigUtil::requestShutdown();
        }
#endif
    }
}

#if !MOBILEAPP

/// Forks as many children as requested.
/// Returns the number of children requested to spawn,
static int forkChildren(const int number)
{
    if (Util::isKitInProcess())
        return 0;

    LOG_TRC("Request forkit to spawn " << number << " new child(ren)");
    Util::assertIsLocked(NewChildrenMutex);

    if (number > 0)
    {
        COOLWSD::checkDiskSpaceAndWarnClients(false);

        const std::string message = "spawn " + std::to_string(number) + '\n';
        LOG_DBG("MasterToForKit: " << message.substr(0, message.length() - 1));
        COOLWSD::sendMessageToForKit(message);
        OutstandingForks += number;
        LastForkRequestTime = std::chrono::steady_clock::now();
        return number;
    }

    return 0;
}

/// Cleans up dead children.
/// Returns true if removed at least one.
static bool cleanupChildren()
{
    if (Util::isKitInProcess())
        return 0;

    Util::assertIsLocked(NewChildrenMutex);

    const int count = NewChildren.size();
    for (int i = count - 1; i >= 0; --i)
    {
        if (!NewChildren[i]->isAlive())
        {
            LOG_WRN("Removing dead spare child [" << NewChildren[i]->getPid() << "].");
            NewChildren.erase(NewChildren.begin() + i);
        }
    }

    if (static_cast<int>(NewChildren.size()) != count)
        SigUtil::addActivity("removed " + std::to_string(count - NewChildren.size()) +
                             " children");

    return static_cast<int>(NewChildren.size()) != count;
}

/// Decides how many children need spawning and spawns.
/// Returns the number of children requested to spawn,
/// -1 for error.
static int rebalanceChildren(int balance)
{
    Util::assertIsLocked(NewChildrenMutex);

    const size_t available = NewChildren.size();
    LOG_TRC("Rebalance children to " << balance << ", have " << available << " and "
                                     << OutstandingForks << " outstanding requests");

    // Do the cleanup first.
    const bool rebalance = cleanupChildren();

    const auto duration = (std::chrono::steady_clock::now() - LastForkRequestTime);
    const auto durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
    if (OutstandingForks != 0 && durationMs >= std::chrono::milliseconds(ChildSpawnTimeoutMs))
    {
        // Children taking too long to spawn.
        // Forget we had requested any, and request anew.
        LOG_WRN("ForKit not responsive for " << durationMs << " forking " << OutstandingForks
                                             << " children. Resetting.");
        OutstandingForks = 0;
    }

    balance -= available;
    balance -= OutstandingForks;

    if (balance > 0 && (rebalance || OutstandingForks == 0))
    {
        LOG_DBG("prespawnChildren: Have " << available << " spare "
                                          << (available == 1 ? "child" : "children") << ", and "
                                          << OutstandingForks << " outstanding, forking " << balance
                                          << " more. Time since last request: " << durationMs);
        return forkChildren(balance);
    }

    return 0;
}

/// Proactively spawn children processes
/// to load documents with alacrity.
/// Returns true only if at least one child was requested to spawn.
static bool prespawnChildren()
{
    // Rebalance if not forking already.
    std::unique_lock<std::mutex> lock(NewChildrenMutex, std::defer_lock);
    return lock.try_lock() && (rebalanceChildren(COOLWSD::NumPreSpawnedChildren) > 0);
}

#endif

static size_t addNewChild(std::shared_ptr<ChildProcess> child)
{
    assert(child && "Adding null child");
    const auto pid = child->getPid();

    std::unique_lock<std::mutex> lock(NewChildrenMutex);

    --OutstandingForks;
    // Prevent from going -ve if we have unexpected children.
    if (OutstandingForks < 0)
        ++OutstandingForks;

    if (COOLWSD::IsBindMountingEnabled)
    {
        // Reset the child-spawn timeout to the default, now that we're set.
        // But only when mounting is enabled. Otherwise, copying is always slow.
        ChildSpawnTimeoutMs = CHILD_TIMEOUT_MS;
    }

    LOG_TRC("Adding a new child " << pid << " to NewChildren, have " << OutstandingForks
                                  << " outstanding requests");
    SigUtil::addActivity("added child " + std::to_string(pid));
    NewChildren.emplace_back(std::move(child));
    const size_t count = NewChildren.size();
    lock.unlock();

    LOG_INF("Have " << count << " spare " << (count == 1 ? "child" : "children")
                    << " after adding [" << pid << "]. Notifying.");

    NewChildrenCV.notify_one();
    return count;
}

#if !MOBILEAPP

namespace
{

#if ENABLE_DEBUG
inline std::string getLaunchBase(bool asAdmin = false)
{
    std::ostringstream oss;
    oss << "    ";
    oss << ((ConfigUtil::isSslEnabled() || ConfigUtil::isSSLTermination()) ? "https://"
                                                                           : "http://");

    if (asAdmin)
    {
        auto user = ConfigUtil::getConfigValue<std::string>("admin_console.username", "");
        auto passwd = ConfigUtil::getConfigValue<std::string>("admin_console.password", "");

        if (user.empty() || passwd.empty())
            return "";

        oss << user << ':' << passwd << '@';
    }

    oss << COOLWSD_TEST_HOST ":";
    oss << ClientPortNumber;

    return oss.str();
}

inline std::string getLaunchURI(const std::string &document, bool readonly = false)
{
    std::ostringstream oss;

    oss << getLaunchBase();
    oss << COOLWSD::ServiceRoot;
    oss << COOLWSD_TEST_COOL_UI;
    oss << "?file_path=";
    oss << DEBUG_ABSSRCDIR "/";
    oss << document;
    if (readonly)
        oss << "&permission=readonly";

    return oss.str();
}

inline std::string getServiceURI(const std::string &sub, bool asAdmin = false)
{
    std::ostringstream oss;

    oss << getLaunchBase(asAdmin);
    oss << COOLWSD::ServiceRoot;
    oss << sub;

    return oss.str();
}

#endif

} // anonymous namespace

#endif // MOBILEAPP

std::atomic<uint64_t> COOLWSD::NextConnectionId(1);

#if !MOBILEAPP
std::atomic<int> COOLWSD::ForKitProcId(-1);
std::shared_ptr<ForKitProcess> COOLWSD::ForKitProc;
bool COOLWSD::NoCapsForKit = false;
bool COOLWSD::NoSeccomp = false;
bool COOLWSD::AdminEnabled = true;
bool COOLWSD::UnattendedRun = false;
bool COOLWSD::SignalParent = false;
bool COOLWSD::UseEnvVarOptions = false;
std::string COOLWSD::RouteToken;
#if ENABLE_DEBUG
bool COOLWSD::SingleKit = false;
bool COOLWSD::ForceCaching = false;
#endif
COOLWSD::WASMActivationState COOLWSD::WASMState = COOLWSD::WASMActivationState::Disabled;
std::unordered_map<std::string, std::chrono::steady_clock::time_point> COOLWSD::Uri2WasmModeMap;
#endif
std::string COOLWSD::SysTemplate;
std::string COOLWSD::LoTemplate = LO_PATH;
std::string COOLWSD::CleanupChildRoot;
std::string COOLWSD::ChildRoot;
std::string COOLWSD::ServerName;
std::string COOLWSD::FileServerRoot;
std::string COOLWSD::ServiceRoot;
std::string COOLWSD::TmpFontDir;
std::string COOLWSD::TmpPresntTemplateDir;
std::string COOLWSD::LOKitVersion;
std::string COOLWSD::ConfigFile = COOLWSD_CONFIGDIR "/coolwsd.xml";
std::string COOLWSD::ConfigDir = COOLWSD_CONFIGDIR "/conf.d";
bool COOLWSD::EnableTraceEventLogging = false;
bool COOLWSD::EnableAccessibility = false;
bool COOLWSD::EnableMountNamespaces= false;
FILE *COOLWSD::TraceEventFile = NULL;
std::string COOLWSD::LogLevel = "trace";
std::string COOLWSD::LogLevelStartup = "trace";
std::string COOLWSD::LogDisabledAreas = "Socket,WebSocket,Admin,Pixel";
std::string COOLWSD::LogToken;
std::string COOLWSD::MostVerboseLogLevelSettableFromClient = "notice";
std::string COOLWSD::LeastVerboseLogLevelSettableFromClient = "fatal";
std::string COOLWSD::UserInterface = "default";
bool COOLWSD::AnonymizeUserData = false;
bool COOLWSD::CheckCoolUser = true;
bool COOLWSD::CleanupOnly = false; ///< If we should cleanup and exit.
bool COOLWSD::IsProxyPrefixEnabled = false;
unsigned COOLWSD::MaxConnections;
unsigned COOLWSD::MaxDocuments;
std::string COOLWSD::HardwareResourceWarning = "ok";
std::string COOLWSD::OverrideWatermark;
std::set<const Poco::Util::AbstractConfiguration*> COOLWSD::PluginConfigurations;
std::chrono::steady_clock::time_point COOLWSD::StartTime;
bool COOLWSD::IsBindMountingEnabled = true;
bool COOLWSD::IndirectionServerEnabled = false;
bool COOLWSD::GeolocationSetup = false;

// If you add global state please update dumpState below too

static std::string UnitTestLibrary;

unsigned int COOLWSD::NumPreSpawnedChildren = 0;
std::unique_ptr<TraceFileWriter> COOLWSD::TraceDumper;
#if !MOBILEAPP
std::unique_ptr<ClipboardCache> COOLWSD::SavedClipboards;

/// The file request handler used for file-serving.
std::unique_ptr<FileServerRequestHandler> COOLWSD::FileRequestHandler;
#endif

/// This thread polls basic web serving, and handling of
/// websockets before upgrade: when upgraded they go to the
/// relevant DocumentBroker poll instead.
static std::shared_ptr<TerminatingPoll> WebServerPoll;

class PrisonPoll : public TerminatingPoll
{
public:
    PrisonPoll() : TerminatingPoll("prisoner_poll") {}

    /// Check prisoners are still alive and balanced.
    void wakeupHook() override;

#if !MOBILEAPP
    // Resets the forkit process object
    void setForKitProcess(const std::weak_ptr<ForKitProcess>& forKitProc)
    {
        assertCorrectThread(__FILE__, __LINE__);
        _forKitProc = forKitProc;
    }

    void sendMessageToForKit(const std::string& msg)
    {
        if (std::this_thread::get_id() == getThreadOwner())
        {
            // Speed up sending the message if the request comes from owner thread
            std::shared_ptr<ForKitProcess> forKitProc = _forKitProc.lock();
            if (forKitProc)
            {
                forKitProc->sendTextFrame(msg);
            }
        }
        else
        {
            // Put the message in the owner's thread queue to be send later
            // because WebSocketHandler is not thread safe and otherwise we
            // should synchronize inside WebSocketHandler.
            addCallback([this, msg]{
                std::shared_ptr<ForKitProcess> forKitProc = _forKitProc.lock();
                if (forKitProc)
                {
                    forKitProc->sendTextFrame(msg);
                }
            });
        }
    }

private:
    std::weak_ptr<ForKitProcess> _forKitProc;
#endif
};

/// This thread listens for and accepts prisoner kit processes.
/// And also cleans up and balances the correct number of children.
static std::shared_ptr<PrisonPoll> PrisonerPoll;

#if MOBILEAPP
#ifndef IOS
std::mutex COOLWSD::lokit_main_mutex;
#endif
#endif

std::shared_ptr<ChildProcess> getNewChild_Blocks(SocketPoll &destPoll, unsigned mobileAppDocId)
{
    (void)mobileAppDocId;
    const auto startTime = std::chrono::steady_clock::now();

    std::unique_lock<std::mutex> lock(NewChildrenMutex);

#if !MOBILEAPP
    assert(mobileAppDocId == 0 && "Unexpected to have mobileAppDocId in the non-mobile build");

    int numPreSpawn = COOLWSD::NumPreSpawnedChildren;
    ++numPreSpawn; // Replace the one we'll dispatch just now.
    LOG_DBG("getNewChild: Rebalancing children to " << numPreSpawn);
    rebalanceChildren(numPreSpawn);

    const auto timeout = std::chrono::milliseconds(ChildSpawnTimeoutMs / 2);
    LOG_TRC("Waiting for a new child for a max of " << timeout);
#else // MOBILEAPP
    const auto timeout = std::chrono::hours(100);

#ifdef IOS
    assert(mobileAppDocId > 0 && "Unexpected to have no mobileAppDocId in the iOS build");
#endif

    std::thread([&]
                {
#ifndef IOS
                    std::lock_guard<std::mutex> lock(COOLWSD::lokit_main_mutex);
                    Util::setThreadName("lokit_main");
#else
                    Util::setThreadName("lokit_main_" + Util::encodeId(mobileAppDocId, 3));
#endif
                    // Ugly to have that static global COOLWSD::prisonerServerSocketFD, Otoh we know
                    // there is just one COOLWSD object. (Even in real Online.)
                    lokit_main(COOLWSD::prisonerServerSocketFD, COOLWSD::UserInterface, mobileAppDocId);
                }).detach();
#endif // MOBILEAPP

    // FIXME: blocks ...
    // Unfortunately we need to wait after spawning children to avoid bombing the system.
    // If we fail fast and return, the next document will spawn more children without knowing
    // there are some on the way already. And if the system is slow already, that wouldn't help.
    LOG_TRC("Waiting for NewChildrenCV");
    if (NewChildrenCV.wait_for(lock, timeout, []()
                               {
                                   LOG_TRC("Predicate for NewChildrenCV wait: NewChildren.size()=" << NewChildren.size());
                                   return !NewChildren.empty();
                               }))
    {
        LOG_TRC("NewChildrenCV wait successful");
        std::shared_ptr<ChildProcess> child = NewChildren.back();
        NewChildren.pop_back();
        const size_t available = NewChildren.size();

        // Release early before moving sockets.
        lock.unlock();

        // Validate before returning.
        if (child && child->isAlive())
        {
            LOG_DBG("getNewChild: Have "
                    << available << " spare " << (available == 1 ? "child" : "children")
                    << " after popping [" << child->getPid() << "] to return in "
                    << std::chrono::duration_cast<std::chrono::milliseconds>(
                           std::chrono::steady_clock::now() - startTime));

            // Change ownership now.
            child->moveSocketFromTo(PrisonerPoll, destPoll);

            return child;
        }

        LOG_WRN("getNewChild: popped dead child, need to find another.");
    }
    else
    {
        LOG_TRC("NewChildrenCV wait failed");
        LOG_WRN("getNewChild: No child available. Sending spawn request to forkit and failing.");
    }

    LOG_DBG("getNewChild: Timed out while waiting for new child.");
    return nullptr;
}

#ifdef __linux__
#if !MOBILEAPP
class InotifySocket : public Socket
{
public:
    InotifySocket(std::chrono::steady_clock::time_point creationTime):
        Socket(inotify_init1(IN_NONBLOCK), Socket::Type::Unix, creationTime)
        , m_stopOnConfigChange(true)
    {
        if (getFD() == -1)
        {
            LOG_WRN("Inotify - Failed to start a watcher for the configuration, disabling "
                    "stop_on_config_change");
            m_stopOnConfigChange = false;
            return;
        }

        watch(COOLWSD_CONFIGDIR);
    }

    /// Check for file changes, stop the server if we find any
    void handlePoll(SocketDisposition &disposition, std::chrono::steady_clock::time_point now, int events) override;

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t & /* timeoutMaxMicroS */) override
    {
        return POLLIN;
    }

    bool watch(std::string configFile);

private:
    bool m_stopOnConfigChange;
    int m_watchedCount = 0;
};

bool InotifySocket::watch(const std::string configFile)
{
    LOG_TRC("Inotify - Attempting to watch " << configFile << ", in addition to current "
                                             << m_watchedCount << " watched files");

    if (getFD() == -1)
    {
        LOG_WRN("Inotify - Trying to watch config file " << configFile
                                                         << " without an inotify file descriptor");
        return false;
    }

    int watchedStatus;
    watchedStatus = inotify_add_watch(getFD(), configFile.c_str(), IN_MODIFY);

    if (watchedStatus == -1)
        LOG_WRN("Inotify - Failed to watch config file " << configFile);
    else
        m_watchedCount++;

    return watchedStatus != -1;
}

void InotifySocket::handlePoll(SocketDisposition & /* disposition */, std::chrono::steady_clock::time_point /* now */, int /* events */)
{
    LOG_TRC("InotifyPoll - woken up. Reload on config change: "
            << m_stopOnConfigChange << ", Watching " << m_watchedCount << " files");
    if (!m_stopOnConfigChange)
        return;

    char buf[4096];

    static_assert(sizeof(buf) >= sizeof(struct inotify_event) + NAME_MAX + 1, "see man 7 inotify");

    const struct inotify_event* event;

    LOG_TRC("InotifyPoll - Checking for config changes...");

    while (true)
    {
        ssize_t len = read(getFD(), buf, sizeof(buf));

        if (len == -1 && errno != EAGAIN)
        {
            // Some read error, EAGAIN is when there is no data so let's not warn for it
            LOG_WRN("InotifyPoll - Read error " << std::strerror(errno)
                                                << " when trying to get events");
        }
        else if (len == -1)
        {
            LOG_TRC("InotifyPoll - Got to end of data when reading inotify");
        }

        if (len <= 0)
            break;

        assert(buf[len - 1] == 0 && "see man 7 inotify");

        for (char* ptr = buf; ptr < buf + len; ptr += sizeof(struct inotify_event) + event->len)
        {
            event = (const struct inotify_event*)ptr;

            LOG_WRN("InotifyPoll - Config file " << event->name << " was modified, stopping COOLWSD");
            SigUtil::requestShutdown();
        }
    }
}

#endif // if !MOBILEAPP
#endif // #ifdef __linux__

/// The Web Server instance with the accept socket poll thread.
class COOLWSDServer;
static std::unique_ptr<COOLWSDServer> Server;

#if !MOBILEAPP

void ForKitProcWSHandler::handleMessage(const std::vector<char> &data)
{
    LOG_TRC("ForKitProcWSHandler: handling incoming [" << COOLProtocol::getAbbreviatedMessage(&data[0], data.size()) << "].");
    const std::string firstLine = COOLProtocol::getFirstLine(&data[0], data.size());
    const StringVector tokens = StringVector::tokenize(firstLine.data(), firstLine.size());

    if (tokens.startsWith(0, "segfaultcount"))
    {
        int segFaultcount = 0;
        int killedCount = 0;
        int oomKilledCount = 0;
        if (COOLProtocol::getNonNegTokenInteger(tokens[0], "segfaultcount", segFaultcount)
            && COOLProtocol::getNonNegTokenInteger(tokens[1], "killedcount", killedCount)
            && COOLProtocol::getNonNegTokenInteger(tokens[2], "oomkilledcount", oomKilledCount))
        {
            Admin::instance().addErrorExitCounters(segFaultcount, killedCount, oomKilledCount);

            if (segFaultcount)
            {
                LOG_INF(segFaultcount << " coolkit processes crashed with segmentation fault.");
                SigUtil::addActivity("coolkit(s) crashed");
                UnitWSD::get().kitSegfault(segFaultcount);
            }

            if (killedCount)
            {
                LOG_INF(killedCount << " coolkit processes killed.");
                SigUtil::addActivity("coolkit(s) killed");
                UnitWSD::get().kitKilled(killedCount);
            }

            if (oomKilledCount)
            {
                LOG_INF(oomKilledCount << " coolkit processes killed by oom.");
                SigUtil::addActivity("coolkit(s) killed by oom");
                UnitWSD::get().kitOomKilled(oomKilledCount);
            }
        }
        else
        {
            LOG_WRN(
                "ForKitProcWSHandler: Invalid 'segfaultcount' message received. Got:" << firstLine);
        }
    }
    else
    {
        LOG_ERR("ForKitProcWSHandler: unknown command: " << tokens[0]);
    }
}

#endif

COOLWSD::COOLWSD()
{
}

COOLWSD::~COOLWSD()
{
    if (UnitBase::isUnitTesting())
    {
        // We won't have a valid UnitWSD::get() when not testing.
        UnitWSD::get().setWSD(nullptr);
    }
}

#if !MOBILEAPP

void COOLWSD::requestTerminateSpareKits()
{
    // Request existing spare kits to quit, to get replaced with ones that
    // include the new fonts.
    if (PrisonerPoll)
    {
        PrisonerPoll->addCallback(
            []
            {
                std::unique_lock<std::mutex> lock(NewChildrenMutex);
                const int count = NewChildren.size();
                for (int i = count - 1; i >= 0; --i)
                    NewChildren[i]->requestTermination();
            });
    }
}

void COOLWSD::setupChildRoot(const bool UseMountNamespaces)
{
    JailUtil::disableBindMounting(); // Default to assume failure
    JailUtil::disableMountNamespaces();

    pid_t pid = fork();
    if (!pid)
    {
        // Child
        Log::postFork();

        int ret = 0;

        // Do the setup in a fork so we have no other threads running which
        // disrupt creation of linux namespaces

        if (UseMountNamespaces)
        {
            // setupChildRoot does a test bind mount + umount to see if that fully works
            // so we have a mount namespace here just for the purposes of that test
            LOG_DBG("Move into user namespace as uid 0");
            if (JailUtil::enterMountingNS(geteuid(), getegid()))
                JailUtil::enableMountNamespaces();
            else
                LOG_ERR("creating usernamespace for mount user failed.");
        }

        // Setup the jails.
        JailUtil::cleanupJails(CleanupChildRoot);
        JailUtil::setupChildRoot(IsBindMountingEnabled, ChildRoot, SysTemplate);

        if (JailUtil::isMountNamespacesEnabled())
            ret |= (1 << 0);
        if (JailUtil::isBindMountingEnabled())
            ret |= (1 << 1);

        _exit(ret);
    }

    // Parent

    if (pid == -1)
    {
        LOG_ERR("setupChildRoot fork failed: " << strerror(errno));
        return;
    }

    int wstatus;
    const int rc = waitpid(pid, &wstatus, 0);
    if (rc == -1)
    {
        LOG_ERR("setupChildRoot waitpid failed: " << strerror(errno));
        return;
    }

    if (!WIFEXITED(wstatus))
    {
        LOG_ERR("setupChildRoot abnormal termination");
        return;
    }

    int status = WEXITSTATUS(wstatus);
    LOG_DBG("setupChildRoot status: " << std::hex << status << std::dec);
    IsBindMountingEnabled = (status & (1 << 1));
    LOG_INF("Using Bind Mounting: " << IsBindMountingEnabled);
    EnableMountNamespaces = (status & (1 << 0));
    LOG_INF("Using Mount Namespaces: " << EnableMountNamespaces);
    if (IsBindMountingEnabled)
        JailUtil::enableBindMounting();
    if (EnableMountNamespaces)
        JailUtil::enableMountNamespaces();
}

#endif

void COOLWSD::innerInitialize(Poco::Util::Application& self)
{
    if (!Util::isMobileApp() && geteuid() == 0 && CheckCoolUser)
    {
        throw std::runtime_error("Do not run as root. Please run as cool user.");
    }

    Util::setApplicationPath(
        Poco::Path(Poco::Util::Application::instance().commandPath()).parent().toString());

    StartTime = std::chrono::steady_clock::now();

    // Initialize the config subsystem.
    LayeredConfiguration& conf = config();

    // Add default values of new entries here, so there is a sensible default in case
    // the setting is missing from the config file. It is possible that users do not
    // update their config files, and we are backward compatible.
    // These defaults should be the same
    // 1) here
    // 2) in the 'default' attribute in coolwsd.xml, which is for documentation
    // 3) the default parameter of getConfigValue() call. That is used when the
    //    setting is present in coolwsd.xml, but empty (i.e. use the default).
    static const std::map<std::string, std::string> DefAppConfig = {
        { "accessibility.enable", "false" },
        { "allowed_languages", "de_DE en_GB en_US es_ES fr_FR it nl pt_BR pt_PT ru" },
        { "admin_console.enable_pam", "false" },
        { "child_root_path", "jails" },
        { "file_server_root_path", "browser/.." },
        { "enable_websocket_urp", "false" },
        { "hexify_embedded_urls", "false" },
        { "experimental_features", "false" },
        { "logging.protocol", "false" },
        // { "logging.anonymize.anonymize_user_data", "false" }, // Do not set to fallback on filename/username.
        { "logging.color", "true" },
        { "logging.file.property[0]", "coolwsd.log" },
        { "logging.file.property[0][@name]", "path" },
        { "logging.file.property[1]", "never" },
        { "logging.file.property[1][@name]", "rotation" },
        { "logging.file.property[2]", "false" },
        { "logging.file.property[2][@name]", "archive" },
        { "logging.file.property[3]", "true" },
        { "logging.file.property[3][@name]", "compress" },
        { "logging.file.property[4]", "10 days" },
        { "logging.file.property[4][@name]", "purgeAge" },
        { "logging.file.property[5]", "10" },
        { "logging.file.property[5][@name]", "purgeCount" },
        { "logging.file.property[6]", "true" },
        { "logging.file.property[6][@name]", "rotateOnOpen" },
        { "logging.file.property[7]", "false" },
        { "logging.file.property[7][@name]", "flush" },
        { "logging.file[@enable]", "false" },
        { "logging.level", COOLWSD_LOGLEVEL },
        { "logging.level_startup", "trace" },
        { "logging.lokit_sal_log", "-INFO-WARN" },
        { "logging.docstats", "false" },
        { "logging.userstats", "false" },
        { "logging.disable_server_audit", "false" },
        { "logging_ui_cmd.file.property[0]", "coolwsd-ui-cmd.log" },
        { "logging_ui_cmd.file.property[0][@name]", "path" },
        { "logging_ui_cmd.file.property[1]", "never" },
        { "logging_ui_cmd.file.property[1][@name]", "rotation" },
        { "logging_ui_cmd.file.property[2]", "false" },
        { "logging_ui_cmd.file.property[2][@name]", "archive" },
        { "logging_ui_cmd.file.property[3]", "false" },
        { "logging_ui_cmd.file.property[3][@name]", "compress" },
        { "logging_ui_cmd.file.property[4]", "60 days" },
        { "logging_ui_cmd.file.property[4][@name]", "purgeAge" },
        { "logging_ui_cmd.file.property[5]", "10" },
        { "logging_ui_cmd.file.property[5][@name]", "purgeCount" },
        { "logging_ui_cmd.file.property[6]", "true" },
        { "logging_ui_cmd.file.property[6][@name]", "rotateOnOpen" },
        { "logging_ui_cmd.file.property[7]", "false" },
        { "logging_ui_cmd.file.property[7][@name]", "flush" },
        { "logging_ui_cmd.file[@enable]", "false" },
        { "logging_ui_cmd.merge", "true" },
        { "logging_ui_cmd.merge_display_end_time", "false" },
        { "browser_logging", "false" },
        { "mount_jail_tree", "true" },
        { "net.connection_timeout_secs", "30" },
        { "net.listen", "any" },
        { "net.proto", "all" },
        { "net.service_root", "" },
        { "net.proxy_prefix", "false" },
        { "net.content_security_policy", "" },
        { "net.frame_ancestors", "" },
        { "num_prespawn_children", NUM_PRESPAWN_CHILDREN },
        { "per_document.always_save_on_exit", "false" },
        { "per_document.autosave_duration_secs", "300" },
        { "per_document.bgsave_priority", "5" },
        { "per_document.bgsave_timeout_secs", "60" },
        { "per_document.background_autosave", "true" },
        { "per_document.background_manualsave", "true" },
        { "per_document.cleanup.cleanup_interval_ms", "10000" },
        { "per_document.cleanup.bad_behavior_period_secs", "60" },
        { "per_document.cleanup.idle_time_secs", "300" },
        { "per_document.cleanup.limit_dirty_mem_mb", "3072" },
        { "per_document.cleanup.limit_cpu_per", "85" },
        { "per_document.cleanup.lost_kit_grace_period_secs", "120" },
        { "per_document.cleanup[@enable]", "true" },
        { "per_document.idle_timeout_secs", "3600" },
        { "per_document.idlesave_duration_secs", "30" },
        { "per_document.limit_file_size_mb", "0" },
        { "per_document.limit_num_open_files", "0" },
        { "per_document.limit_load_secs", "100" },
        { "per_document.limit_store_failures", "5" },
        { "per_document.limit_convert_secs", "100" },
        { "per_document.limit_stack_mem_kb", "8000" },
        { "per_document.limit_virt_mem_mb", "0" },
        { "per_document.max_concurrency", "4" },
        { "per_document.min_time_between_saves_ms", "500" },
        { "per_document.min_time_between_uploads_ms", "5000" },
        { "per_document.batch_priority", "5" },
        { "per_document.pdf_resolution_dpi", "96" },
        { "per_document.redlining_as_comments", "false" },
        { "per_view.idle_timeout_secs", "900" },
        { "per_view.out_of_focus_timeout_secs", "300" },
        { "per_view.custom_os_info", "" },
        { "per_view.min_saved_message_timeout_secs", "0" },
        { "security.capabilities", "true" },
        { "security.seccomp", "true" },
        { "security.jwt_expiry_secs", "1800" },
        { "security.enable_metrics_unauthenticated", "false" },
        { "security.server_signature", "false" },
        { "certificates.database_path", "" },
        { "server_name", "" },
        { "ssl.ca_file_path", COOLWSD_CONFIGDIR "/ca-chain.cert.pem" },
        { "ssl.cert_file_path", COOLWSD_CONFIGDIR "/cert.pem" },
        { "ssl.cipher_list", "" },
        { "ssl.enable", "true" },
        { "ssl.hpkp.max_age[@enable]", "true" },
        { "ssl.hpkp.report_uri[@enable]", "false" },
        { "ssl.hpkp[@enable]", "false" },
        { "ssl.hpkp[@report_only]", "false" },
        { "ssl.sts.enabled", "false" },
        { "ssl.sts.max_age", "31536000" },
        { "ssl.key_file_path", COOLWSD_CONFIGDIR "/key.pem" },
        { "ssl.termination", "false" },
#if !MOBILEAPP
        { "ssl.ssl_verification", SSL_VERIFY },
#endif
        { "stop_on_config_change", "false" },
        { "storage.filesystem[@allow]", "false" },
        // "storage.ssl.enable" - deliberately not set; for back-compat
        { "storage.ssl.ca_file_path", "" },
        { "storage.ssl.cert_file_path", "" },
        { "storage.ssl.cipher_list", "" },
        { "storage.ssl.key_file_path", "" },
        { "storage.wopi.max_file_size", "0" },
        { "storage.wopi[@allow]", "true" },
        { "storage.wopi.locking.refresh", "900" },
        { "storage.wopi.is_legacy_server", "false" },
        { "sys_template_path", "systemplate" },
        { "trace_event[@enable]", "false" },
        { "trace.path[@compress]", "true" },
        { "trace.path[@snapshot]", "false" },
        { "trace[@enable]", "false" },
        { "welcome.enable", "false" },
        { "home_mode.enable", "false" },
        { "overwrite_mode.enable", "false" },
#if ENABLE_FEATURE_LOCK
        { "feature_lock.locked_hosts[@allow]", "false" },
        { "feature_lock.locked_hosts.fallback[@read_only]", "false" },
        { "feature_lock.locked_hosts.fallback[@disabled_commands]", "false" },
        { "feature_lock.locked_hosts.host[0]", "localhost" },
        { "feature_lock.locked_hosts.host[0][@read_only]", "false" },
        { "feature_lock.locked_hosts.host[0][@disabled_commands]", "false" },
        { "feature_lock.is_lock_readonly", "false" },
        { "feature_lock.locked_commands", LOCKED_COMMANDS },
        { "feature_lock.unlock_title", UNLOCK_TITLE },
        { "feature_lock.unlock_link", UNLOCK_LINK },
        { "feature_lock.unlock_description", UNLOCK_DESCRIPTION },
        { "feature_lock.writer_unlock_highlights", WRITER_UNLOCK_HIGHLIGHTS },
        { "feature_lock.calc_unlock_highlights", CALC_UNLOCK_HIGHLIGHTS },
        { "feature_lock.impress_unlock_highlights", IMPRESS_UNLOCK_HIGHLIGHTS },
        { "feature_lock.draw_unlock_highlights", DRAW_UNLOCK_HIGHLIGHTS },
#endif
#if ENABLE_FEATURE_RESTRICTION
        { "restricted_commands", "" },
#endif
        { "user_interface.mode", "default" },
        { "user_interface.use_integration_theme", "true" },
        { "user_interface.statusbar_save_indicator", "true" },
        { "quarantine_files[@enable]", "false" },
        { "quarantine_files.limit_dir_size_mb", "250" },
        { "quarantine_files.max_versions_to_maintain", "5" },
        { "quarantine_files.path", "quarantine" },
        { "quarantine_files.expiry_min", "3000" },
        { "remote_config.remote_url", "" },
        { "storage.wopi.alias_groups[@mode]", "first" },
        { "languagetool.base_url", "" },
        { "languagetool.api_key", "" },
        { "languagetool.user_name", "" },
        { "languagetool.enabled", "false" },
        { "languagetool.ssl_verification", "true" },
        { "languagetool.rest_protocol", "" },
        { "deepl.api_url", "" },
        { "deepl.auth_key", "" },
        { "deepl.enabled", "false" },
        { "zotero.enable", "true" },
        { "indirection_endpoint.geolocation_setup.enable", "false" },
        { "indirection_endpoint.geolocation_setup.timezone", "" },
        { "indirection_endpoint.server_name", "" },
        { "indirection_endpoint.url", "" },
#if !MOBILEAPP
        { "help_url", HELP_URL },
#endif
        { "product_name", APP_NAME },
        { "admin_console.logging.admin_login", "true" },
        { "admin_console.logging.metrics_fetch", "true" },
        { "admin_console.logging.monitor_connect", "true" },
        { "admin_console.logging.admin_action", "true" },
        { "wasm.enable", "false" },
        { "wasm.force", "false" },
        { "document_signing.enable", "true" },
        { "extra_export_formats.impress_swf", "false" },
        { "extra_export_formats.impress_bmp", "false" },
        { "extra_export_formats.impress_gif", "false" },
        { "extra_export_formats.impress_png", "false" },
        { "extra_export_formats.impress_svg", "false" },
        { "extra_export_formats.impress_tiff", "false" },
        { "remote_asset_config.url", ""},
        { "remote_font_config.url", ""},
    };

    // Set default values, in case they are missing from the config file.
    Poco::AutoPtr<AppConfigMap> defConfig(new AppConfigMap(DefAppConfig));
    conf.addWriteable(defConfig, PRIO_SYSTEM); // Lowest priority

#if !MOBILEAPP

    // Load default configuration files, with name independent
    // of Poco's view of app-name, from local file if present.
    // Fallback to the COOLWSD_CONFIGDIR or --config-file path.
    Poco::Path configPath("coolwsd.xml");
    const std::string configFilePath =
        Poco::Util::Application::findFile(configPath) ? configPath.toString() : ConfigFile;
    loadConfiguration(configFilePath, PRIO_DEFAULT);

    // Override any settings passed on the command-line or via environment variables
    if (UseEnvVarOptions)
        initializeEnvOptions();
    Poco::AutoPtr<AppConfigMap> overrideConfig(new AppConfigMap(_overrideSettings));
    conf.addWriteable(overrideConfig, PRIO_APPLICATION); // Highest priority

    // This caches some oft-used settings and must come after overriding.
    ConfigUtil::initialize(&config());

    // Load extra ("plug-in") configuration files, if present
    Poco::File dir(ConfigDir);
    if (dir.exists() && dir.isDirectory())
    {
        const Poco::DirectoryIterator end;
        for (Poco::DirectoryIterator configFileIterator(dir); configFileIterator != end;
             ++configFileIterator)
        {
            // Only accept configuration files ending in .xml
            const std::string configFile = configFileIterator.path().getFileName();
            if (configFile.length() > 4 && strcasecmp(configFile.substr(configFile.length() - 4).data(), ".xml") == 0)
            {
                const std::string fullFileName = dir.path() + "/" + configFile;
                PluginConfigurations.insert(new Poco::Util::XMLConfiguration(fullFileName));
            }
        }
    }

    if (!UnitTestLibrary.empty())
    {
        UnitWSD::defaultConfigure(conf);
    }

    // Experimental features.
    EnableExperimental = ConfigUtil::getConfigValue<bool>(conf, "experimental_features", false);

    EnableAccessibility = ConfigUtil::getConfigValue<bool>(conf, "accessibility.enable", false);

    // Setup user interface mode
    UserInterface = ConfigUtil::getConfigValue<std::string>(conf, "user_interface.mode", "default");

    if (UserInterface == "compact")
        UserInterface = "classic";

    if (UserInterface == "tabbed")
        UserInterface = "notebookbar";

    if (EnableAccessibility)
        UserInterface = "notebookbar";

    // Set the log-level after complete initialization to force maximum details at startup.
    LogLevel = ConfigUtil::getConfigValue<std::string>(conf, "logging.level", "trace");
    LogDisabledAreas = ConfigUtil::getConfigValue<std::string>(conf, "logging.disabled_areas",
                                                               "Socket,WebSocket,Admin");
    MostVerboseLogLevelSettableFromClient = ConfigUtil::getConfigValue<std::string>(
        conf, "logging.most_verbose_level_settable_from_client", "notice");
    LeastVerboseLogLevelSettableFromClient = ConfigUtil::getConfigValue<std::string>(
        conf, "logging.least_verbose_level_settable_from_client", "fatal");

    setenv("COOL_LOGLEVEL", LogLevel.c_str(), true);
    setenv("COOL_LOGDISABLED_AREAS", LogDisabledAreas.c_str(), true);

#if !ENABLE_DEBUG
    const std::string salLog =
        ConfigUtil::getConfigValue<std::string>(conf, "logging.lokit_sal_log", "-INFO-WARN");
    setenv("SAL_LOG", salLog.c_str(), 0);
#endif

#if WASMAPP
    // In WASM, we want to log to the Log Console.
    // Disable logging to file to log to stdout and
    // disable color since this isn't going to the terminal.
    constexpr bool withColor = false;
    constexpr bool logToFile = false;
    constexpr bool logToFileUICmd = false;
#else
    const bool withColor =
        ConfigUtil::getConfigValue<bool>(conf, "logging.color", true) && isatty(fileno(stderr));
    if (withColor)
    {
        setenv("COOL_LOGCOLOR", "1", true);
    }

    const auto logToFile = ConfigUtil::getConfigValue<bool>(conf, "logging.file[@enable]", false);
    std::map<std::string, std::string> logProperties;
    for (std::size_t i = 0; ; ++i)
    {
        const std::string confPath = "logging.file.property[" + std::to_string(i) + ']';
        const std::string confName = config().getString(confPath + "[@name]", "");
        if (!confName.empty())
        {
            const std::string value = config().getString(confPath, "");
            logProperties.emplace(confName, value);
        }
        else if (!config().has(confPath))
        {
            break;
        }
    }

    // Setup the logfile envar for the kit processes.
    if (logToFile)
    {
        const auto it = logProperties.find("path");
        if (it != logProperties.end())
        {
            setenv("COOL_LOGFILE", "1", true);
            setenv("COOL_LOGFILENAME", it->second.c_str(), true);
            std::cerr << "\nLogging at " << LogLevel << " level to file: " << it->second.c_str()
                      << std::endl;
        }
    }

    // Do the same for ui command logging
    const auto logToFileUICmd = ConfigUtil::getConfigValue<bool>(conf, "logging_ui_cmd.file[@enable]", false);
    std::map<std::string, std::string> logPropertiesUICmd;
    for (std::size_t i = 0; ; ++i)
    {
        const std::string confPath = "logging_ui_cmd.file.property[" + std::to_string(i) + ']';
        const std::string confName = config().getString(confPath + "[@name]", "");
        if (!confName.empty())
        {
            const std::string value = config().getString(confPath, "");
            logPropertiesUICmd.emplace(confName, value);
        }
        else if (!config().has(confPath))
        {
            break;
        }
    }

    // Setup the logfile envar for the kit processes.
    if (logToFileUICmd)
    {
        const auto it = logPropertiesUICmd.find("path");
        if (it != logPropertiesUICmd.end())
        {
            setenv("COOL_LOGFILE_UICMD", "1", true);
            setenv("COOL_LOGFILENAME_UICMD", it->second.c_str(), true);
            std::cerr << "\nLogging UI Commands to file: " << it->second.c_str() << std::endl;
        }
        const bool merge = ConfigUtil::getConfigValue<bool>(conf, "logging_ui_cmd.merge", true);
        const bool logEndtime = ConfigUtil::getConfigValue<bool>(conf, "logging_ui_cmd.merge_display_end_time", true);
        if (merge)
        {
            setenv("COOL_LOG_UICMD_MERGE", "1", true);
        }
        if (logEndtime)
        {
            setenv("COOL_LOG_UICMD_END_TIME", "1", true);
        }
    }
#endif

    // Log at trace level until we complete the initialization.
    LogLevelStartup =
        ConfigUtil::getConfigValue<std::string>(conf, "logging.level_startup", "trace");
    setenv("COOL_LOGLEVEL_STARTUP", LogLevelStartup.c_str(), true);

    Log::initialize("wsd", LogLevelStartup, withColor, logToFile, logProperties, logToFileUICmd, logPropertiesUICmd);
    if (LogLevel != LogLevelStartup)
    {
        LOG_INF("Setting log-level to [" << LogLevelStartup << "] and delaying setting to ["
                << LogLevel << "] until after WSD initialization.");
    }

    if (ConfigUtil::getConfigValue<bool>(conf, "browser_logging", false))
    {
        LogToken = Util::rng::getHexString(16);
    }

    // First log entry.
    ServerName = config().getString("server_name");
    LOG_INF("Initializing coolwsd " << Util::getCoolVersion() << " server [" << ServerName
                                    << "]. Experimental features are "
                                    << (EnableExperimental ? "enabled." : "disabled."));

    const std::map<std::string, std::string> allConfigs = ConfigUtil::extractAll(&conf);
    std::ostringstream ossConfig;
    ossConfig << "Loaded config file [" << configFilePath << "] (non-default values):\n";
    for (const auto& pair : allConfigs)
    {
        const auto it = DefAppConfig.find(pair.first);
        if (it == DefAppConfig.end() || it->second != pair.second)
        {
            if (pair.first == "admin_console.username" ||
                pair.first == "admin_console.password" ||
                pair.first == "admin_console.secure_password" ||
                pair.first == "languagetool.api_key" ||
                pair.first == "deepl.auth_key" ||
                pair.first == "logging.anonymize.anonymization_salt" ||
                pair.first == "support_key")
            {
                ossConfig << '\t' << pair.first << ": <redacted>" << '\n';
            }
            else
            {
                ossConfig << '\t' << pair.first << ": " << pair.second << '\n';
            }
        }
    }

    LoggableConfigEntries = ossConfig.str();
    LOG_INF(LoggableConfigEntries);

    // Initialize the UnitTest subsystem.
    if (!UnitWSD::init(UnitWSD::UnitType::Wsd, UnitTestLibrary))
    {
        throw std::runtime_error("Failed to load wsd unit test library.");
    }
    UnitWSD::get().setWSD(this);

    // Allow UT to manipulate before using configuration values.
    UnitWSD::get().configure(conf);

    // Trace Event Logging.
    EnableTraceEventLogging = ConfigUtil::getConfigValue<bool>(conf, "trace_event[@enable]", false);

    if (EnableTraceEventLogging)
    {
        const auto traceEventFile = ConfigUtil::getConfigValue<std::string>(
            conf, "trace_event.path", COOLWSD_TRACEEVENTFILE);
        LOG_INF("Trace Event file is " << traceEventFile << ".");
        TraceEventFile = fopen(traceEventFile.c_str(), "w");
        if (TraceEventFile != NULL)
        {
            if (fcntl(fileno(TraceEventFile), F_SETFD, FD_CLOEXEC) == -1)
            {
                fclose(TraceEventFile);
                TraceEventFile = NULL;
            }
            else
            {
                fprintf(TraceEventFile, "[\n");
                // Output a metadata event that tells that this is the WSD process
                fprintf(TraceEventFile, "{\"name\":\"process_name\",\"ph\":\"M\",\"args\":{\"name\":\"WSD\"},\"pid\":%d,\"tid\":%ld},\n",
                        getpid(), (long) Util::getThreadId());
                fprintf(TraceEventFile, "{\"name\":\"thread_name\",\"ph\":\"M\",\"args\":{\"name\":\"Main\"},\"pid\":%d,\"tid\":%ld},\n",
                        getpid(), (long) Util::getThreadId());
            }
        }
    }

    // Check deprecated settings.
    bool reuseCookies = false;
    if (ConfigUtil::getSafeConfig(conf, "storage.wopi.reuse_cookies", reuseCookies))
        LOG_WRN("NOTE: Deprecated config option storage.wopi.reuse_cookies - no longer supported.");

#if !MOBILEAPP
    COOLWSD::WASMState = ConfigUtil::getConfigValue<bool>(conf, "wasm.enable", false)
                             ? COOLWSD::WASMActivationState::Enabled
                             : COOLWSD::WASMActivationState::Disabled;

#if ENABLE_DEBUG
    if (ConfigUtil::getConfigValue<bool>(conf, "wasm.force", false))
    {
        if (COOLWSD::WASMState != COOLWSD::WASMActivationState::Enabled)
        {
            LOG_FTL(
                "WASM is not enabled; cannot force serving WASM. Please set wasm.enabled to true "
                "in coolwsd.xml first");
            Util::forcedExit(EX_SOFTWARE);
        }

        LOG_INF("WASM is force-enabled. All documents will be loaded through WASM");
        COOLWSD::WASMState = COOLWSD::WASMActivationState::Forced;
    }
#endif
#endif // !MOBILEAPP

    // Get anonymization settings.
#if COOLWSD_ANONYMIZE_USER_DATA
    AnonymizeUserData = true;
    LOG_INF("Anonymization of user-data is permanently enabled.");
#else
    LOG_INF("Anonymization of user-data is configurable.");
    bool haveAnonymizeUserDataConfig = false;
    if (ConfigUtil::getSafeConfig(conf, "logging.anonymize.anonymize_user_data", AnonymizeUserData))
        haveAnonymizeUserDataConfig = true;

    bool anonymizeFilenames = false;
    bool anonymizeUsernames = false;
    if (ConfigUtil::getSafeConfig(conf, "logging.anonymize.usernames", anonymizeFilenames) ||
        ConfigUtil::getSafeConfig(conf, "logging.anonymize.filenames", anonymizeUsernames))
    {
        LOG_WRN("NOTE: both logging.anonymize.usernames and logging.anonymize.filenames are deprecated and superseded by "
                "logging.anonymize.anonymize_user_data. Please remove username and filename entries from the config and use only anonymize_user_data.");

        if (haveAnonymizeUserDataConfig)
            LOG_WRN("Since logging.anonymize.anonymize_user_data is provided (" << AnonymizeUserData << ") in the config, it will be used.");
        else
        {
            AnonymizeUserData = (anonymizeFilenames || anonymizeUsernames);
        }
    }
#endif

    if (AnonymizeUserData && LogLevel == "trace" && !CleanupOnly)
    {
        if (ConfigUtil::getConfigValue<bool>(conf, "logging.anonymize.allow_logging_user_data",
                                             false))
        {
            LOG_WRN("Enabling trace logging while anonymization is enabled due to logging.anonymize.allow_logging_user_data setting. "
                    "This will leak user-data!");

            // Disable anonymization as it's useless now.
            AnonymizeUserData = false;
        }
        else
        {
            static const char failure[] = "Anonymization and trace-level logging are incompatible. "
                "Please reduce logging level to debug or lower in coolwsd.xml to prevent leaking sensitive user data.";
            LOG_FTL(failure);
            std::cerr << '\n' << failure << std::endl;
#if ENABLE_DEBUG
            std::cerr << "\nIf you have used 'make run', edit coolwsd.xml and make sure you have removed "
                         "'--o:logging.level=trace' from the command line in Makefile.am.\n" << std::endl;
#endif
            Util::forcedExit(EX_SOFTWARE);
        }
    }

    std::uint64_t anonymizationSalt = 82589933;
    LOG_INF("Anonymization of user-data is " << (AnonymizeUserData ? "enabled." : "disabled."));
    if (AnonymizeUserData)
    {
        // Get the salt, if set, otherwise default, and set as envar, so the kits inherit it.
        anonymizationSalt = ConfigUtil::getConfigValue<std::uint64_t>(
            conf, "logging.anonymize.anonymization_salt", 82589933);
        const std::string anonymizationSaltStr = std::to_string(anonymizationSalt);
        setenv("COOL_ANONYMIZATION_SALT", anonymizationSaltStr.c_str(), true);
    }
    FileUtil::setUrlAnonymization(AnonymizeUserData, anonymizationSalt);

    {
        bool enableWebsocketURP =
            ConfigUtil::getConfigValue<bool>("security.enable_websocket_urp", false);
        setenv("ENABLE_WEBSOCKET_URP", enableWebsocketURP ? "true" : "false", 1);
    }

    {
        std::string proto = ConfigUtil::getConfigValue<std::string>(conf, "net.proto", "");
        if (Util::iequal(proto, "ipv4"))
            ClientPortProto = Socket::Type::IPv4;
        else if (Util::iequal(proto, "ipv6"))
            ClientPortProto = Socket::Type::IPv6;
        else if (Util::iequal(proto, "all"))
            ClientPortProto = Socket::Type::All;
        else
            LOG_WRN("Invalid protocol: " << proto);
    }

    {
        std::string listen = ConfigUtil::getConfigValue<std::string>(conf, "net.listen", "");
        if (Util::iequal(listen, "any"))
            ClientListenAddr = ServerSocket::Type::Public;
        else if (Util::iequal(listen, "loopback"))
            ClientListenAddr = ServerSocket::Type::Local;
        else
            LOG_WRN("Invalid listen address: " << listen << ". Falling back to default: 'any'" );
    }

    // Prefix for the coolwsd pages; should not end with a '/'
    ServiceRoot = ConfigUtil::getPathFromConfig("net.service_root");
    while (ServiceRoot.length() > 0 && ServiceRoot[ServiceRoot.length() - 1] == '/')
        ServiceRoot.pop_back();

    IsProxyPrefixEnabled = ConfigUtil::getConfigValue<bool>(conf, "net.proxy_prefix", false);

    LOG_INF("SSL support: SSL is " << (ConfigUtil::isSslEnabled() ? "enabled." : "disabled."));
    LOG_INF("SSL support: termination is "
            << (ConfigUtil::isSSLTermination() ? "enabled." : "disabled."));

    std::string allowedLanguages(config().getString("allowed_languages"));
    // Core <= 7.0.
    setenv("LOK_WHITELIST_LANGUAGES", allowedLanguages.c_str(), 1);
    // Core >= 7.1.
    setenv("LOK_ALLOWLIST_LANGUAGES", allowedLanguages.c_str(), 1);

#endif

    int pdfResolution =
        ConfigUtil::getConfigValue<int>(conf, "per_document.pdf_resolution_dpi", 96);
    if (pdfResolution > 0)
    {
        constexpr int MaxPdfResolutionDpi = 384;
        if (pdfResolution > MaxPdfResolutionDpi)
        {
            // Avoid excessive memory consumption.
            LOG_WRN("The PDF resolution specified in per_document.pdf_resolution_dpi ("
                    << pdfResolution << ") is larger than the maximum (" << MaxPdfResolutionDpi
                    << "). Using " << MaxPdfResolutionDpi << " instead.");

            pdfResolution = MaxPdfResolutionDpi;
        }

        const std::string pdfResolutionStr = std::to_string(pdfResolution);
        LOG_DBG("Setting envar PDFIMPORT_RESOLUTION_DPI="
                << pdfResolutionStr << " per config per_document.pdf_resolution_dpi");
        ::setenv("PDFIMPORT_RESOLUTION_DPI", pdfResolutionStr.c_str(), 1);
    }

    SysTemplate = ConfigUtil::getPathFromConfig("sys_template_path");
    if (SysTemplate.empty())
    {
        LOG_FTL("Missing sys_template_path config entry.");
        throw Poco::Util::MissingOptionException("systemplate");
    }

    ChildRoot = ConfigUtil::getPathFromConfig("child_root_path");
    if (ChildRoot.empty())
    {
        LOG_FTL("Missing child_root_path config entry.");
        throw Poco::Util::MissingOptionException("childroot");
    }
    else
    {
#if !MOBILEAPP
        if (CleanupOnly)
        {
            // Cleanup and exit.
            JailUtil::cleanupJails(ChildRoot);
            Util::forcedExit(EX_OK);
        }
#endif
        if (ChildRoot[ChildRoot.size() - 1] != '/')
            ChildRoot += '/';

#if CODE_COVERAGE
        ::setenv("BASE_CHILD_ROOT", Poco::Path(ChildRoot).absolute().toString().c_str(), 1);
#endif

        // We need to cleanup other people's expired jails
        CleanupChildRoot = ChildRoot;

        // Encode the process id into the path for parallel re-use of jails/
        ChildRoot += std::to_string(getpid()) + '-' + Util::rng::getHexString(8) + '/';

        LOG_INF("Creating childroot: " + ChildRoot);
    }

#if !MOBILEAPP

    // Copy and serialize the config into XML to pass to forkit.
    KitXmlConfig.reset(new Poco::Util::XMLConfiguration);
    for (const auto& pair : DefAppConfig)
    {
        try
        {
            KitXmlConfig->setString(pair.first, config().getRawString(pair.first));
        }
        catch (const std::exception&)
        {
            // Nothing to do.
        }
    }

    // Fixup some config entries to match out decisions/overrides.
    KitXmlConfig->setBool("ssl.enable", ConfigUtil::isSslEnabled());
    KitXmlConfig->setBool("ssl.termination", ConfigUtil::isSSLTermination());

    // We don't pass the config via command-line
    // to avoid dealing with escaping and other traps.
    std::ostringstream oss;
    KitXmlConfig->save(oss);
    setenv("COOL_CONFIG", oss.str().c_str(), true);

    Util::sleepFromEnvIfSet("Coolwsd", "SLEEPFORDEBUGGER");

    // For some reason I can't get at this setting in ChildSession::loKitCallback().
    std::string fontsMissingHandling = ConfigUtil::getString("fonts_missing.handling", "log");
    setenv("FONTS_MISSING_HANDLING", fontsMissingHandling.c_str(), 1);

    IsBindMountingEnabled = ConfigUtil::getConfigValue<bool>(conf, "mount_jail_tree", true);
#if CODE_COVERAGE
    // Code coverage is not supported with bind-mounting.
    if (IsBindMountingEnabled)
    {
        LOG_WRN("Mounting is not compatible with code-coverage. Disabling.");
        IsBindMountingEnabled = false;
    }
#endif // CODE_COVERAGE

    // Setup the jails.
    bool UseMountNamespaces = true;

    NoCapsForKit = Util::isKitInProcess() ||
                   !ConfigUtil::getConfigValue<bool>(conf, "security.capabilities", true);
    if (NoCapsForKit && UseMountNamespaces)
    {
        // With NoCapsForKit we don't chroot. If Linux namespaces are available, we could
        // chroot without capabilities, but the richdocumentscode AppImage layout isn't
        // compatible with the systemplate expectations for setting up the chroot so
        // disable MountNamespaces in NoCapsForKit mode for now.
        LOG_WRN("MountNamespaces is not compatible with NoCapsForKit. Disabling.");
        UseMountNamespaces = false;
    }

    setupChildRoot(UseMountNamespaces);

    LOG_DBG("FileServerRoot before config: " << FileServerRoot);
    FileServerRoot = ConfigUtil::getPathFromConfig("file_server_root_path");
    LOG_DBG("FileServerRoot after config: " << FileServerRoot);

    //creating quarantine directory
    if (ConfigUtil::getConfigValue<bool>(conf, "quarantine_files[@enable]", false))
    {
        std::string path = Util::trimmed(ConfigUtil::getPathFromConfig("quarantine_files.path"));
        LOG_INF("Quarantine path is set to [" << path << "] in config");
        if (path.empty())
        {
            LOG_WRN("Quarantining is enabled via quarantine_files config, but no path is set in "
                    "quarantine_files.path. Disabling quarantine");
        }
        else
        {
            if (path[path.size() - 1] != '/')
                path += '/';

            if (path[0] != '/')
                LOG_WRN("Quarantine path is relative. Please use an absolute path for better "
                        "reliability");

            Poco::File p(path);
            try
            {
                LOG_TRC("Creating quarantine directory [" + path << ']');
                p.createDirectories();

                LOG_DBG("Created quarantine directory [" + path << ']');
            }
            catch (const std::exception& ex)
            {
                LOG_WRN("Failed to create quarantine directory [" << path
                                                                  << "]. Disabling quaratine");
            }

            if (FileUtil::Stat(path).exists())
            {
                LOG_INF("Initializing quarantine at [" + path << ']');
                Quarantine::initialize(path);
            }
        }
    }
    else
    {
        LOG_INF("Quarantine is disabled in config");
    }

    NumPreSpawnedChildren = ConfigUtil::getConfigValue<int>(conf, "num_prespawn_children", 1);
    if (NumPreSpawnedChildren < 1)
    {
        LOG_WRN("Invalid num_prespawn_children in config (" << NumPreSpawnedChildren << "). Resetting to 1.");
        NumPreSpawnedChildren = 1;
    }
    LOG_INF("NumPreSpawnedChildren set to " << NumPreSpawnedChildren << '.');

    FileUtil::registerFileSystemForDiskSpaceChecks(ChildRoot);

    int threads = std::max<int>(std::thread::hardware_concurrency(), 1);
    int maxConcurrency = ConfigUtil::getConfigValue<int>(conf, "per_document.max_concurrency", 4);

    if (maxConcurrency > 16)
    {
        LOG_WRN("Using a large number of threads for every document puts pressure on "
                "the scheduler, and consumes memory, while providing marginal gains "
                "consider lowering max_concurrency from " << maxConcurrency);
    }
    if (maxConcurrency > threads)
    {
        LOG_ERR("Setting concurrency above the number of physical "
                "threads yields extra latency and memory usage for no benefit. "
                "Clamping " << maxConcurrency << " to " << threads << " threads.");
        maxConcurrency = threads;
    }
    if (maxConcurrency > 0)
    {
        setenv("MAX_CONCURRENCY", std::to_string(maxConcurrency).c_str(), 1);
    }
    LOG_INF("MAX_CONCURRENCY set to " << maxConcurrency << '.');

    // It is worth avoiding configuring with a large number of under-weight
    // containers / VMs - better to have fewer, stronger ones.
    if (threads < 4)
    {
        LOG_WRN("Fewer threads than recommended. Having at least four threads for "
                "provides significant parallelism that can be used for burst "
                "compression of newly visible document pages, giving lower latency.");
        HardwareResourceWarning = "lowresources";
    }

#elif defined(__EMSCRIPTEN__)
    // disable threaded image scaling for wasm for now
    setenv("VCL_NO_THREAD_SCALE", "1", 1);
#endif

    const auto redlining =
        ConfigUtil::getConfigValue<bool>(conf, "per_document.redlining_as_comments", false);
    if (!redlining)
    {
        setenv("DISABLE_REDLINE", "1", 1);
        LOG_INF("DISABLE_REDLINE set");
    }

    // Otherwise we profile the soft-device at jail creation time.
    setenv("SAL_DISABLE_OPENCL", "true", 1);
    // Disable getting the OS print queue and default printer
    setenv("SAL_DISABLE_PRINTERLIST", "true", 1);
    setenv("SAL_DISABLE_DEFAULTPRINTER", "true", 1);
    // Disable fsync - we're a state-less container
    setenv("SAL_DISABLE_FSYNC", "true", 1);
    // Staticize our configuration to increase sharing
    setenv("SAL_CONFIG_STATICIZE", "true", 1);

    // Log the connection and document limits.
#if ENABLE_WELCOME_MESSAGE
    if (ConfigUtil::getConfigValue<bool>(conf, "home_mode.enable", false))
    {
        COOLWSD::MaxConnections = 20;
        COOLWSD::MaxDocuments = 10;
    }
    else
    {
        conf.setString("welcome.enable", "true");
        COOLWSD::MaxConnections = MAX_CONNECTIONS;
        COOLWSD::MaxDocuments = MAX_DOCUMENTS;
    }
#else
    {
        COOLWSD::MaxConnections = MAX_CONNECTIONS;
        COOLWSD::MaxDocuments = MAX_DOCUMENTS;
    }
#endif
    {
        LOG_DBG("net::Defaults: Socket[inactivityTimeout " << net::Defaults.inactivityTimeout
                << ", maxExtConnections " << net::Defaults.maxExtConnections << "]");
    }

#if !MOBILEAPP
    NoSeccomp =
        Util::isKitInProcess() || !ConfigUtil::getConfigValue<bool>(conf, "security.seccomp", true);
    NoCapsForKit = Util::isKitInProcess() ||
                   !ConfigUtil::getConfigValue<bool>(conf, "security.capabilities", true);
    AdminEnabled = ConfigUtil::getConfigValue<bool>(conf, "admin_console.enable", true);
    IndirectionServerEnabled =
        !ConfigUtil::getConfigValue<std::string>(conf, "indirection_endpoint.url", "").empty();
    GeolocationSetup =
        ConfigUtil::getConfigValue("indirection_endpoint.geolocation_setup.enable", false);

#if ENABLE_DEBUG
    if (Util::isKitInProcess())
        SingleKit = true;
#endif
#endif

    // LanguageTool configuration
    bool enableLanguageTool = ConfigUtil::getConfigValue<bool>(conf, "languagetool.enabled", false);
    setenv("LANGUAGETOOL_ENABLED", enableLanguageTool ? "true" : "false", 1);
    const std::string baseAPIUrl =
        ConfigUtil::getConfigValue<std::string>(conf, "languagetool.base_url", "");
    setenv("LANGUAGETOOL_BASEURL", baseAPIUrl.c_str(), 1);
    const std::string userName =
        ConfigUtil::getConfigValue<std::string>(conf, "languagetool.user_name", "");
    setenv("LANGUAGETOOL_USERNAME", userName.c_str(), 1);
    const std::string apiKey =
        ConfigUtil::getConfigValue<std::string>(conf, "languagetool.api_key", "");
    setenv("LANGUAGETOOL_APIKEY", apiKey.c_str(), 1);
    bool sslVerification =
        ConfigUtil::getConfigValue<bool>(conf, "languagetool.ssl_verification", true);
    setenv("LANGUAGETOOL_SSL_VERIFICATION", sslVerification ? "true" : "false", 1);
    const std::string restProtocol =
        ConfigUtil::getConfigValue<std::string>(conf, "languagetool.rest_protocol", "");
    setenv("LANGUAGETOOL_RESTPROTOCOL", restProtocol.c_str(), 1);

    // DeepL configuration
    const std::string apiURL = ConfigUtil::getConfigValue<std::string>(conf, "deepl.api_url", "");
    const std::string authKey = ConfigUtil::getConfigValue<std::string>(conf, "deepl.auth_key", "");
    setenv("DEEPL_API_URL", apiURL.c_str(), 1);
    setenv("DEEPL_AUTH_KEY", authKey.c_str(), 1);

#if !MOBILEAPP
    const std::string helpUrl = ConfigUtil::getConfigValue<std::string>(conf, "help_url", HELP_URL);
    setenv("LOK_HELP_URL", helpUrl.c_str(), 1);
#else
    // On mobile UI there should be no tunnelled dialogs. But if there are some, by mistake,
    // at least they should not have a non-working Help button.
    setenv("LOK_HELP_URL", "", 1);
#endif

    if constexpr (ConfigUtil::isSupportKeyEnabled())
    {
        const std::string supportKeyString =
            ConfigUtil::getConfigValue<std::string>(conf, "support_key", "");

        if (supportKeyString.empty())
        {
            LOG_WRN("Support key not set, please use 'coolconfig set-support-key'.");
            std::cerr << "Support key not set, please use 'coolconfig set-support-key'." << std::endl;
            COOLWSD::OverrideWatermark = "Unsupported, the support key is missing.";
        }
        else
        {
            SupportKey key(supportKeyString);

            if (!key.verify())
            {
                LOG_WRN("Invalid support key, please use 'coolconfig set-support-key'.");
                std::cerr << "Invalid support key, please use 'coolconfig set-support-key'." << std::endl;
                COOLWSD::OverrideWatermark = "Unsupported, the support key is invalid.";
            }
            else
            {
                int validDays =  key.validDaysRemaining();
                if (validDays <= 0)
                {
                    LOG_WRN("Your support key has expired, please ask for a new one, and use 'coolconfig set-support-key'.");
                    std::cerr << "Your support key has expired, please ask for a new one, and use 'coolconfig set-support-key'." << std::endl;
                    COOLWSD::OverrideWatermark = "Unsupported, the support key has expired.";
                }
                else
                {
                    LOG_INF("Your support key is valid for " << validDays << " days");
                    COOLWSD::MaxConnections = 1000;
                    COOLWSD::MaxDocuments = 200;
                    COOLWSD::OverrideWatermark.clear();
                }
            }
        }
    }

    if (COOLWSD::MaxConnections < 3)
    {
        LOG_ERR("MAX_CONNECTIONS must be at least 3");
        COOLWSD::MaxConnections = 3;
    }

    if (COOLWSD::MaxDocuments > COOLWSD::MaxConnections)
    {
        LOG_ERR("MAX_DOCUMENTS cannot be bigger than MAX_CONNECTIONS");
        COOLWSD::MaxDocuments = COOLWSD::MaxConnections;
    }

#if !WASMAPP
    struct rlimit rlim;
    ::getrlimit(RLIMIT_NOFILE, &rlim);
    LOG_INF("Maximum file descriptor supported by the system: " << rlim.rlim_cur - 1);
    // 4 fds per document are used for client connection, Kit process communication, and
    // a wakeup pipe with 2 fds. 32 fds (i.e. 8 documents) are reserved.
    LOG_INF("Maximum number of open documents supported by the system: " << rlim.rlim_cur / 4 - 8);
#endif

    LOG_INF("Maximum concurrent open Documents limit: " << COOLWSD::MaxDocuments);
    LOG_INF("Maximum concurrent client Connections limit: " << COOLWSD::MaxConnections);

    COOLWSD::NumConnections = 0;

    // Command Tracing.
    if (ConfigUtil::getConfigValue<bool>(conf, "trace[@enable]", false))
    {
        const auto& path = ConfigUtil::getConfigValue<std::string>(conf, "trace.path", "");
        const auto recordOutgoing =
            ConfigUtil::getConfigValue<bool>(conf, "trace.outgoing.record", false);
        std::vector<std::string> filters;
        for (size_t i = 0; ; ++i)
        {
            const std::string confPath = "trace.filter.message[" + std::to_string(i) + ']';
            const std::string regex = config().getString(confPath, "");
            if (!regex.empty())
            {
                filters.push_back(regex);
            }
            else if (!config().has(confPath))
            {
                break;
            }
        }

        const auto compress =
            ConfigUtil::getConfigValue<bool>(conf, "trace.path[@compress]", false);
        const auto takeSnapshot =
            ConfigUtil::getConfigValue<bool>(conf, "trace.path[@snapshot]", false);
        TraceDumper = std::make_unique<TraceFileWriter>(path, recordOutgoing, compress,
                                                        takeSnapshot, filters);
    }

    // Allowed hosts for being external data source in the documents
    std::vector<std::string> lokAllowedHosts;
    appendAllowedHostsFrom(conf, "net.lok_allow", lokAllowedHosts);
    // For backward compatibility post_allow hosts are also allowed
    bool postAllowed = conf.getBool("net.post_allow[@allow]", false);
    if (postAllowed)
        appendAllowedHostsFrom(conf, "net.post_allow", lokAllowedHosts);
    // For backward compatibility wopi hosts are also allowed
    bool wopiAllowed = conf.getBool("storage.wopi[@allow]", false);
    if (wopiAllowed)
    {
        appendAllowedHostsFrom(conf, "storage.wopi", lokAllowedHosts);
        appendAllowedAliasGroups(conf, lokAllowedHosts);
    }

    if (lokAllowedHosts.size())
    {
        std::string allowedRegex;
        for (size_t i = 0; i < lokAllowedHosts.size(); i++)
        {
            if (isValidRegex(lokAllowedHosts[i]))
                allowedRegex += (i != 0 ? "|" : "") + lokAllowedHosts[i];
            else
                LOG_ERR("Invalid regular expression for allowed host: \"" << lokAllowedHosts[i] << "\"");
        }

        setenv("LOK_HOST_ALLOWLIST", allowedRegex.c_str(), true);
    }

#if !MOBILEAPP
    SavedClipboards = std::make_unique<ClipboardCache>();

    LOG_TRC("Initialize FileServerRequestHandler");
    COOLWSD::FileRequestHandler =
        std::make_unique<FileServerRequestHandler>(COOLWSD::FileServerRoot);
#endif

    WebServerPoll = std::make_unique<TerminatingPoll>("websrv_poll");

#if !MOBILEAPP
    net::AsyncDNS::startAsyncDNS();

    LOG_TRC("Initialize StorageConnectionManager");
    StorageConnectionManager::initialize();
#endif

    PrisonerPoll = std::make_unique<PrisonPoll>();

    Server = std::make_unique<COOLWSDServer>();

    LOG_TRC("Initialize StorageBase");
    StorageBase::initialize();

#if !MOBILEAPP
    // Check for smaps_rollup bug where rewinding and rereading gives
    // bogus doubled results
    if (FILE* fp = fopen("/proc/self/smaps_rollup", "r"))
    {
        std::size_t memoryDirty1 = Util::getPssAndDirtyFromSMaps(fp).second;
        (void)Util::getPssAndDirtyFromSMaps(fp); // interleave another rewind+read to margin
        std::size_t memoryDirty2 = Util::getPssAndDirtyFromSMaps(fp).second;
        LOG_TRC("Comparing smaps_rollup read and rewind+read: " << memoryDirty1 << " vs " << memoryDirty2);
        if (memoryDirty2 >= memoryDirty1 * 2)
        {
            // Believed to be fixed in >= v4.19, bug seen in 4.15.0 and not in 6.5.10
            // https://github.com/torvalds/linux/commit/258f669e7e88c18edbc23fe5ce00a476b924551f
            LOG_WRN("Reading smaps_rollup twice reports Private_Dirty doubled, smaps_rollup is unreliable on this kernel");
            setenv("COOL_DISABLE_SMAPS_ROLLUP", "1", true);
        }
        fclose(fp);
    }

    ServerApplication::initialize(self);

    DocProcSettings docProcSettings;
    docProcSettings.setLimitVirtMemMb(
        ConfigUtil::getConfigValue<int>("per_document.limit_virt_mem_mb", 0));
    docProcSettings.setLimitStackMemKb(
        ConfigUtil::getConfigValue<int>("per_document.limit_stack_mem_kb", 0));
    docProcSettings.setLimitFileSizeMb(
        ConfigUtil::getConfigValue<int>("per_document.limit_file_size_mb", 0));
    docProcSettings.setLimitNumberOpenFiles(
        ConfigUtil::getConfigValue<int>("per_document.limit_num_open_files", 0));

    DocCleanupSettings &docCleanupSettings = docProcSettings.getCleanupSettings();
    docCleanupSettings.setEnable(
        ConfigUtil::getConfigValue<bool>("per_document.cleanup[@enable]", true));
    docCleanupSettings.setCleanupInterval(
        ConfigUtil::getConfigValue<int>("per_document.cleanup.cleanup_interval_ms", 10000));
    docCleanupSettings.setBadBehaviorPeriod(
        ConfigUtil::getConfigValue<int>("per_document.cleanup.bad_behavior_period_secs", 60));
    docCleanupSettings.setIdleTime(
        ConfigUtil::getConfigValue<int>("per_document.cleanup.idle_time_secs", 300));
    docCleanupSettings.setLimitDirtyMem(
        ConfigUtil::getConfigValue<int>("per_document.cleanup.limit_dirty_mem_mb", 3072));
    docCleanupSettings.setLimitCpu(
        ConfigUtil::getConfigValue<int>("per_document.cleanup.limit_cpu_per", 85));
    docCleanupSettings.setLostKitGracePeriod(
        ConfigUtil::getConfigValue<int>("per_document.cleanup.lost_kit_grace_period_secs", 120));

    Admin::instance().setDefDocProcSettings(docProcSettings, false);

#else
    (void) self;
#endif
}

void COOLWSD::initializeSSL()
{
#if ENABLE_SSL
    if (!ConfigUtil::isSslEnabled())
        return;

    const std::string ssl_cert_file_path = ConfigUtil::getPathFromConfig("ssl.cert_file_path");
    LOG_INF("SSL Cert file: " << ssl_cert_file_path);

    const std::string ssl_key_file_path = ConfigUtil::getPathFromConfig("ssl.key_file_path");
    LOG_INF("SSL Key file: " << ssl_key_file_path);

    const std::string ssl_ca_file_path = ConfigUtil::getPathFromConfig("ssl.ca_file_path");
    LOG_INF("SSL CA file: " << ssl_ca_file_path);

    std::string ssl_cipher_list = config().getString("ssl.cipher_list", "");
    if (ssl_cipher_list.empty())
            ssl_cipher_list = DEFAULT_CIPHER_SET;
    LOG_INF("SSL Cipher list: " << ssl_cipher_list);

    // Initialize the non-blocking server socket SSL context.
    ssl::Manager::initializeServerContext(ssl_cert_file_path, ssl_key_file_path, ssl_ca_file_path,
                                          ssl_cipher_list, ssl::CertificateVerification::Disabled);

    if (!ssl::Manager::isServerContextInitialized())
        LOG_ERR("Failed to initialize Server SSL.");
    else
    {
        LOG_INF("Initialized Server SSL.");
        SigUtil::addActivity("initialized SSL");
    }
#else
    LOG_INF("SSL is unavailable in this build.");
#endif
}

void COOLWSD::dumpNewSessionTrace(const std::string& id, const std::string& sessionId, const std::string& uri, const std::string& path)
{
    if (TraceDumper)
    {
        try
        {
            TraceDumper->newSession(id, sessionId, uri, path);
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Exception in tracer newSession: " << exc.what());
        }
    }
}

void COOLWSD::dumpEndSessionTrace(const std::string& id, const std::string& sessionId, const std::string& uri)
{
    if (TraceDumper)
    {
        try
        {
            TraceDumper->endSession(id, sessionId, uri);
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Exception in tracer newSession: " << exc.what());
        }
    }
}

void COOLWSD::dumpEventTrace(const std::string& id, const std::string& sessionId, const std::string& data)
{
    if (TraceDumper)
    {
        TraceDumper->writeEvent(id, sessionId, data);
    }
}

void COOLWSD::dumpIncomingTrace(const std::string& id, const std::string& sessionId, const std::string& data)
{
    if (TraceDumper)
    {
        TraceDumper->writeIncoming(id, sessionId, data);
    }
}

void COOLWSD::dumpOutgoingTrace(const std::string& id, const std::string& sessionId, const std::string& data)
{
    if (TraceDumper)
    {
        TraceDumper->writeOutgoing(id, sessionId, data);
    }
}

void COOLWSD::defineOptions(Poco::Util::OptionSet& optionSet)
{
    if constexpr (Util::isMobileApp())
        return;
    ServerApplication::defineOptions(optionSet);

    optionSet.addOption(Option("help", "", "Display help information on command line arguments.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("version-hash", "", "Display product version-hash information and exit.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("version", "", "Display version and hash information.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("cleanup", "", "Cleanup jails and other temporary data and exit.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("port", "", "Port number to listen to (default: " +
                               std::to_string(DEFAULT_CLIENT_PORT_NUMBER) + "),")
                        .required(false)
                        .repeatable(false)
                        .argument("port_number"));

    optionSet.addOption(Option("disable-ssl", "", "Disable SSL security layer.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("disable-cool-user-checking", "", "Don't check whether coolwsd is running under the user 'cool'.  NOTE: This is insecure, use only when you know what you are doing!")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("override", "o", "Override any setting by providing full xmlpath=value.")
                        .required(false)
                        .repeatable(true)
                        .argument("xmlpath"));

    optionSet.addOption(Option("config-file", "", "Override configuration file path.")
                        .required(false)
                        .repeatable(false)
                        .argument("path"));

    optionSet.addOption(Option("config-dir", "", "Override extra configuration directory path.")
                        .required(false)
                        .repeatable(false)
                        .argument("path"));

    optionSet.addOption(Option("lo-template-path", "", "Override the LOK core installation directory path.")
                        .required(false)
                        .repeatable(false)
                        .argument("path"));

    optionSet.addOption(Option("unattended", "", "Unattended run, won't wait for a debugger on faulting.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("signal", "", "Send signal SIGUSR2 to parent process when server is ready to accept connections")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("use-env-vars", "",
                               "Use the environment variables defined on "
                               "https://sdk.collaboraonline.com/docs/installation/"
                               "CODE_Docker_image.html#setting-the-application-configuration-"
                               "dynamically-via-environment-variables to set options. "
                               "'DONT_GEN_SSL_CERT' is forcibly enabled and 'extra_params' is "
                               "ignored even when using this option.")
                            .required(false)
                            .repeatable(false));

#if ENABLE_DEBUG
    optionSet.addOption(Option("unitlib", "", "Unit testing library path.")
                        .required(false)
                        .repeatable(false)
                        .argument("unitlib"));

    optionSet.addOption(Option("careerspan", "", "How many seconds to run.")
                        .required(false)
                        .repeatable(false)
                        .argument("seconds"));

    optionSet.addOption(Option("singlekit", "", "Spawn one libreoffice kit.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("forcecaching", "", "Force HTML & asset caching even in debug mode: accelerates cypress.")
                        .required(false)
                        .repeatable(false));
#endif
}

void COOLWSD::handleOption(const std::string& optionName,
                           const std::string& value)
{
#if !MOBILEAPP
    ServerApplication::handleOption(optionName, value);

    if (optionName == "help")
    {
        displayHelp();
        Util::forcedExit(EX_OK);
    }
    else if (optionName == "version-hash")
    {
        std::cout << Util::getCoolVersionHash() << std::endl;
        Util::forcedExit(EX_OK);
    }
    else if (optionName == "version")
        ; // ignore for compatibility
    else if (optionName == "cleanup")
        CleanupOnly = true; // Flag for later as we need the config.
    else if (optionName == "port")
        ClientPortNumber = std::stoi(value);
    else if (optionName == "disable-ssl")
        _overrideSettings["ssl.enable"] = "false";
    else if (optionName == "disable-cool-user-checking")
        CheckCoolUser = false;
    else if (optionName == "override")
    {
        std::string optName;
        std::string optValue;
        COOLProtocol::parseNameValuePair(value, optName, optValue);
        _overrideSettings[optName] = std::move(optValue);
    }
    else if (optionName == "config-file")
        ConfigFile = value;
    else if (optionName == "config-dir")
        ConfigDir = value;
    else if (optionName == "lo-template-path")
        LoTemplate = value;
    else if (optionName == "signal")
        SignalParent = true;
    else if (optionName == "use-env-vars")
        UseEnvVarOptions = true;

#if ENABLE_DEBUG
    else if (optionName == "unitlib")
        UnitTestLibrary = value;
    else if (optionName == "unattended")
    {
        UnattendedRun = true;
        SigUtil::setUnattended();
    }
    else if (optionName == "careerspan")
        careerSpanMs = std::chrono::seconds(std::stoi(value)); // Convert second to ms
    else if (optionName == "singlekit")
    {
        SingleKit = true;
        NumPreSpawnedChildren = 1;
    }
    else if (optionName == "forcecaching")
        ForceCaching = true;

    static const char* latencyMs = std::getenv("COOL_DELAY_SOCKET_MS");
    if (latencyMs)
        SimulatedLatencyMs = std::stoi(latencyMs);
#endif

#else
    (void) optionName;
    (void) value;
#endif
}

#if !MOBILEAPP

void COOLWSD::initializeEnvOptions()
{
    int n = 0;
    char* aliasGroup;
    while ((aliasGroup = std::getenv(("aliasgroup" + std::to_string(n + 1)).c_str())) != nullptr)
    {
        bool first = true;
        std::istringstream aliasGroupStream;
        aliasGroupStream.str(aliasGroup);
        int j = 0;
        for (std::string alias; std::getline(aliasGroupStream, alias, ',');)
        {
            if (first)
            {
                const std::string path = "storage.wopi.alias_groups.group[" + std::to_string(n) + "].host";
                _overrideSettings[path] = alias;
                _overrideSettings[path + "[@allow]"] = "true";
                first = false;
            }
            else
            {
                _overrideSettings["storage.wopi.alias_groups.group[" + std::to_string(n) +
                                  "].alias[" + std::to_string(j) + ']'] = alias;
                j++;
            }
        }

        n++;
    }
    if (n >= 1)
    {
        _overrideSettings["alias_groups[@mode]"] = "groups";
    }

    char* optionValue;
    if ((optionValue = std::getenv("username")) != nullptr) _overrideSettings["admin_console.username"] = optionValue;
    if ((optionValue = std::getenv("password")) != nullptr) _overrideSettings["admin_console.password"] = optionValue;
    if ((optionValue = std::getenv("server_name")) != nullptr) _overrideSettings["server_name"] = optionValue;
    if ((optionValue = std::getenv("dictionaries")) != nullptr) _overrideSettings["allowed_languages"] = optionValue;
    if ((optionValue = std::getenv("remoteconfigurl")) != nullptr) _overrideSettings["remote_config.remote_url"] = optionValue;
}

void COOLWSD::displayHelp()
{
    Poco::Util::HelpFormatter helpFormatter(options());
    helpFormatter.setCommand(commandName());
    helpFormatter.setUsage("OPTIONS");
    helpFormatter.setHeader("Collabora Online WebSocket server.");
    helpFormatter.format(std::cout);
}

bool COOLWSD::checkAndRestoreForKit()
{
// clang issues warning for WIF*() macro usages below:
// "equality comparison with extraneous parentheses [-Werror,-Wparentheses-equality]"
// https://bugs.llvm.org/show_bug.cgi?id=22949

#if defined __clang__
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wparentheses-equality"
#endif

    if (ForKitProcId == -1)
    {
        // Fire the ForKit process for the first time.
        if (!SigUtil::getShutdownRequestFlag() && !createForKit())
        {
            // Should never fail.
            LOG_FTL("Setting ShutdownRequestFlag: Failed to spawn coolforkit.");
            SigUtil::requestShutdown();
        }
    }

    if (Util::isKitInProcess())
        return true;

    int status;
    const pid_t pid = waitpid(ForKitProcId, &status, WUNTRACED | WNOHANG);
    if (pid > 0)
    {
        if (pid == ForKitProcId)
        {
            if (WIFEXITED(status) || WIFSIGNALED(status))
            {
                if (WIFEXITED(status))
                {
                    LOG_INF("Forkit process [" << pid << "] exited with code: " <<
                            WEXITSTATUS(status) << '.');
                }
                else
                {
                    LOG_ERR("Forkit process [" << pid << "] " <<
                            (WCOREDUMP(status) ? "core-dumped" : "died") <<
                            " with " << SigUtil::signalName(WTERMSIG(status)));
                }

                // Spawn a new forkit and try to dust it off and resume.
                if (!SigUtil::getShutdownRequestFlag() && !createForKit())
                {
                    LOG_FTL("Setting ShutdownRequestFlag: Failed to spawn forkit instance.");
                    SigUtil::requestShutdown();
                }
            }
            else if (WIFSTOPPED(status))
            {
                LOG_INF("Forkit process [" << pid << "] stopped with " <<
                        SigUtil::signalName(WSTOPSIG(status)));
            }
            else if (WIFCONTINUED(status))
            {
                LOG_INF("Forkit process [" << pid << "] resumed with SIGCONT.");
            }
            else
            {
                LOG_WRN("Unknown status returned by waitpid: " << std::hex << status << std::dec);
            }

            return true;
        }
        else
        {
            LOG_ERR("An unknown child process [" << pid << "] died.");
        }
    }
    else if (pid < 0)
    {
        LOG_SYS("Forkit waitpid failed");
        if (errno == ECHILD)
        {
            // No child processes.
            // Spawn a new forkit and try to dust it off and resume.
            if (!SigUtil::getShutdownRequestFlag()  && !createForKit())
            {
                LOG_FTL("Setting ShutdownRequestFlag: Failed to spawn forkit instance.");
                SigUtil::requestShutdown();
            }
        }

        return true;
    }

    return false;

#if defined __clang__
#pragma clang diagnostic pop
#endif
}

#endif

void COOLWSD::doHousekeeping()
{
    if (PrisonerPoll)
    {
        PrisonerPoll->wakeup();
    }
}

void COOLWSD::closeDocument(const std::string& docKey, const std::string& message)
{
    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
    auto docBrokerIt = DocBrokers.find(docKey);
    if (docBrokerIt != DocBrokers.end())
    {
        std::shared_ptr<DocumentBroker> docBroker = docBrokerIt->second;
        docBroker->addCallback([docBroker, message]() {
                docBroker->closeDocument(message);
            });
    }
}

void COOLWSD::autoSave(const std::string& docKey)
{
    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
    auto docBrokerIt = DocBrokers.find(docKey);
    if (docBrokerIt != DocBrokers.end())
    {
        std::shared_ptr<DocumentBroker> docBroker = docBrokerIt->second;
        docBroker->addCallback(
            [docBroker]() { docBroker->autoSave(/*force=*/true, /*dontSaveIfUnmodified=*/true); });
    }
}

void COOLWSD::setMigrationMsgReceived(const std::string& docKey)
{
    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
    auto docBrokerIt = DocBrokers.find(docKey);
    if (docBrokerIt != DocBrokers.end())
    {
        std::shared_ptr<DocumentBroker> docBroker = docBrokerIt->second;
        docBroker->addCallback([docBroker]() { docBroker->setMigrationMsgReceived(); });
    }
}

void COOLWSD::setAllMigrationMsgReceived()
{
    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
    for (auto& brokerIt : DocBrokers)
    {
        std::shared_ptr<DocumentBroker> docBroker = brokerIt.second;
        docBroker->addCallback([docBroker]() { docBroker->setMigrationMsgReceived(); });
    }
}

void COOLWSD::setLogLevelsOfKits(const std::string& level)
{
    std::lock_guard<std::mutex> docBrokersLock(DocBrokersMutex);

    LOG_INF("Changing kits' log levels: [" << level << ']');

    for (const auto& brokerIt : DocBrokers)
    {
        std::shared_ptr<DocumentBroker> docBroker = brokerIt.second;
        docBroker->addCallback([docBroker, level]() {
            docBroker->setKitLogLevel(level);
        });
    }
}

/// Really do the house-keeping
void PrisonPoll::wakeupHook()
{
#if !MOBILEAPP
    LOG_TRC("PrisonerPoll - wakes up with " << NewChildren.size() <<
            " new children and " << DocBrokers.size() << " brokers and " <<
            OutstandingForks << " kits forking");

    if (!COOLWSD::checkAndRestoreForKit())
    {
        // No children have died.
        // Make sure we have sufficient reserves.
        prespawnChildren();
    }
#endif
    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex, std::defer_lock);
    if (docBrokersLock.try_lock())
    {
        cleanupDocBrokers();
        SigUtil::checkForwardSigUsr2(forwardSigUsr2);
    }
}

#if !MOBILEAPP

bool COOLWSD::createForKit()
{
    LOG_INF("Creating new forkit process.");

    SigUtil::addActivity("spawning new forkit");

    // Creating a new forkit is always a slow process.
    ChildSpawnTimeoutMs = CHILD_SPAWN_TIMEOUT_MS;

    std::unique_lock<std::mutex> newChildrenLock(NewChildrenMutex);

    StringVector args;
    std::string parentPath =
        Poco::Path(Poco::Util::Application::instance().commandPath()).parent().toString();

#if STRACE_COOLFORKIT
    // if you want to use this, you need to sudo setcap cap_fowner,cap_chown,cap_sys_chroot=ep /usr/bin/strace
    args.push_back("-o");
    args.push_back("strace.log");
    args.push_back("-f");
    args.push_back("-tt");
    args.push_back("-s");
    args.push_back("256");
    args.push_back(parentPath + "coolforkit-caps");
#elif VALGRIND_COOLFORKIT
    NoCapsForKit = true;
    NoSeccomp = true;
//    args.push_back("--log-file=valgrind.log");
//    args.push_back("--track-fds=all");

//  for massif: can connect with (gdb) target remote | vgdb
//  and then monitor snapshot <filename> before kit exit
//    args.push_back("--tool=massif");
//    args.push_back("--vgdb=yes");
//    args.push_back("--vgdb-error=0");

    args.push_back("--trace-children=yes");
    args.push_back("--error-limit=no");
    args.push_back("--num-callers=128");
    std::string nocapsCopy = parentPath + "coolforkit-nocaps";
    FileUtil::copy(parentPath + "coolforkit-caps", nocapsCopy, true, true);
    args.push_back(nocapsCopy);
#endif
    args.push_back("--systemplate=" + SysTemplate);
    args.push_back("--lotemplate=" + LoTemplate);
    args.push_back("--childroot=" + ChildRoot);
    args.push_back("--clientport=" + std::to_string(ClientPortNumber));
    args.push_back("--masterport=" + MasterLocation);

    const DocProcSettings& docProcSettings = Admin::instance().getDefDocProcSettings();
    std::ostringstream ossRLimits;
    ossRLimits << "limit_virt_mem_mb:" << docProcSettings.getLimitVirtMemMb();
    ossRLimits << ";limit_stack_mem_kb:" << docProcSettings.getLimitStackMemKb();
    ossRLimits << ";limit_file_size_mb:" << docProcSettings.getLimitFileSizeMb();
    ossRLimits << ";limit_num_open_files:" << docProcSettings.getLimitNumberOpenFiles();
    args.push_back("--rlimits=" + ossRLimits.str());

    if (UnitWSD::get().hasKitHooks())
        args.push_back("--unitlib=" + UnitTestLibrary);

    args.push_back("--version");

    if (NoCapsForKit)
        args.push_back("--nocaps");

    if (NoSeccomp)
        args.push_back("--noseccomp");

    args.push_back("--ui=" + UserInterface);

    if (!CheckCoolUser)
        args.push_back("--disable-cool-user-checking");

    if (UnattendedRun)
        args.push_back("--unattended");

#if ENABLE_DEBUG
    if (SingleKit)
        args.push_back("--singlekit");
#endif

#if STRACE_COOLFORKIT
    std::string forKitPath = "/usr/bin/strace";
#elif VALGRIND_COOLFORKIT
    std::string forKitPath = "/usr/bin/valgrind";
#else
    std::string forKitPath = std::move(parentPath);
    if (EnableMountNamespaces || NoCapsForKit)
    {
        forKitPath += "coolforkit-ns";
        if (EnableMountNamespaces)
            args.push_back("--namespace");
    }
    else
    {
        forKitPath += "coolforkit-caps";
        if (!FileUtil::Stat(forKitPath).exists())
            LOG_FTL("coolforkit-caps does not exist, install coolwsd-deprecated package");
    }
#endif

    // Always reap first, in case we haven't done so yet.
    if (ForKitProcId != -1)
    {
        if (Util::isKitInProcess())
            return true;
        int status;
        waitpid(ForKitProcId, &status, WUNTRACED | WNOHANG);
        ForKitProcId = -1;
        Admin::instance().setForKitPid(ForKitProcId);
    }

    // Below line will be executed by PrisonerPoll thread.
    ForKitProc = nullptr;
    PrisonerPoll->setForKitProcess(ForKitProc);

    // ForKit always spawns one.
    ++OutstandingForks;

    LOG_INF("Launching forkit process: " << forKitPath << ' ' << args.cat(' ', 0));

    LastForkRequestTime = std::chrono::steady_clock::now();
    int child = createForkit(forKitPath, args);
    ForKitProcId = child;

    LOG_INF("Forkit process launched: " << ForKitProcId);

    // Init the Admin manager
    Admin::instance().setForKitPid(ForKitProcId);

    const int balance = COOLWSD::NumPreSpawnedChildren - OutstandingForks;
    if (balance > 0)
        rebalanceChildren(balance);

    return ForKitProcId != -1;
}

void COOLWSD::sendMessageToForKit(const std::string& message)
{
    if (PrisonerPoll)
    {
        PrisonerPoll->sendMessageToForKit(message);
    }
}

#endif // !MOBILEAPP

/// Handles the socket that the prisoner kit connected to WSD on.
class PrisonerRequestDispatcher final : public WebSocketHandler
{
    std::weak_ptr<ChildProcess> _childProcess;
    int _pid; ///< The Kit's PID (for logging).
    int _socketFD; ///< The socket FD to the Kit (for logging).
    bool _associatedWithDoc; ///< True when/if we get a DocBroker.

public:
    PrisonerRequestDispatcher()
        : WebSocketHandler(/* isClient = */ false, /* isMasking = */ true)
        , _pid(0)
        , _socketFD(0)
        , _associatedWithDoc(false)
    {
        LOG_TRC_S("PrisonerRequestDispatcher");
    }
    ~PrisonerRequestDispatcher()
    {
        LOG_TRC("~PrisonerRequestDispatcher");

        // Notify the broker that we're done.
        // Note: since this class is the default WebScoketHandler
        // for all incoming connections, for ForKit we have to
        // replace it (once we receive 'GET /coolws/forkit') with
        // ForKitProcWSHandler (see ForKitProcess) and nothing to disconnect.
        std::shared_ptr<ChildProcess> child = _childProcess.lock();
        if (child && child->getPid() > 0)
            onDisconnect();
    }

private:
    /// Keep our socket around ...
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        WebSocketHandler::onConnect(socket);
        LOG_TRC("Prisoner connected");
    }

    void onDisconnect() override
    {
        LOG_DBG("Prisoner connection disconnected");

        // Notify the broker that we're done.
        std::shared_ptr<ChildProcess> child = _childProcess.lock();
        std::shared_ptr<DocumentBroker> docBroker =
            child && child->getPid() > 0 ? child->getDocumentBroker() : nullptr;
        if (docBroker)
        {
            assert(child->getPid() == _pid && "Child PID changed unexpectedly");
            const bool unexpected = !docBroker->isUnloading() && !SigUtil::getShutdownRequestFlag();
            if (unexpected)
            {
                LOG_WRN("DocBroker [" << docBroker->getDocKey()
                                      << "] got disconnected from its Kit (" << child->getPid()
                                      << ") unexpectedly. Closing");
            }
            else
            {
                LOG_DBG("DocBroker [" << docBroker->getDocKey() << "] disconnected from its Kit ("
                                      << child->getPid() << ") as expected");
            }

            docBroker->disconnectedFromKit(unexpected);
        }
        else if (!_associatedWithDoc && !SigUtil::getShutdownRequestFlag())
        {
            LOG_WRN("Unassociated Kit (" << _pid << ") disconnected unexpectedly");

            std::unique_lock<std::mutex> lock(NewChildrenMutex);
            auto it = std::find(NewChildren.begin(), NewChildren.end(), child);
            if (it != NewChildren.end())
                NewChildren.erase(it);
            else
                LOG_WRN("Unknown Kit process closed with pid " << (child ? child->getPid() : -1));
#if !MOBILEAPP
            rebalanceChildren(COOLWSD::NumPreSpawnedChildren);
#endif
        }
    }

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition &disposition) override
    {
        if (_childProcess.lock())
        {
            // FIXME: inelegant etc. - derogate to websocket code
            WebSocketHandler::handleIncomingMessage(disposition);
            return;
        }

        std::shared_ptr<StreamSocket> socket = getSocket().lock();
        if (!socket)
        {
            LOG_ERR("Invalid socket while reading incoming message");
            return;
        }

        Buffer& data = socket->getInBuffer();
        if (data.empty())
        {
            LOG_DBG("No data to process from the socket");
            return;
        }

#ifdef LOG_SOCKET_DATA
        LOG_TRC("HandleIncomingMessage: buffer has:\n"
                << Util::dumpHex(std::string(data.data(), std::min(data.size(), 256UL))));
#endif

        // Consume the incoming data by parsing and processing the body.
        http::Request request;
#if !MOBILEAPP
        const int64_t read = request.readData(data.data(), data.size());
        if (read < 0)
        {
            LOG_ERR("Error parsing prisoner socket data");
            return;
        }

        if (read == 0)
        {
            // Not enough data.
            return;
        }

        assert(read > 0 && "Must have read some data!");

        // Remove consumed data.
        data.eraseFirst(read);
#endif

        try
        {
#if !MOBILEAPP
            LOG_TRC("Child connection with URI [" << COOLWSD::anonymizeUrl(request.getUrl())
                                                  << ']');
            Poco::URI requestURI(request.getUrl());
            if (requestURI.getPath() == FORKIT_URI)
            {
                if (socket->getPid() != COOLWSD::ForKitProcId)
                {
                    LOG_WRN("Connection request received on "
                            << FORKIT_URI << " endpoint from unexpected ForKit process. Skipped");
                    return;
                }
                COOLWSD::ForKitProc = std::make_shared<ForKitProcess>(COOLWSD::ForKitProcId, socket, request);
                LOG_ASSERT_MSG(socket->getInBuffer().empty(), "Unexpected data in prisoner socket");
                socket->getInBuffer().clear();
                PrisonerPoll->setForKitProcess(COOLWSD::ForKitProc);
                return;
            }
            if (requestURI.getPath() != NEW_CHILD_URI)
            {
                LOG_ERR("Invalid incoming child URI [" << requestURI.getPath() << ']');
                return;
            }

            const auto duration = (std::chrono::steady_clock::now() - LastForkRequestTime);
            const auto durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
            LOG_TRC("New child spawned after " << durationMs << " of requesting");

            // New Child is spawned.
            const Poco::URI::QueryParameters params = requestURI.getQueryParameters();
            const int pid = socket->getPid();
            std::string jailId;
            for (const auto& param : params)
            {
                if (param.first == "jailid")
                    jailId = param.second;

                else if (param.first == "version")
                    COOLWSD::LOKitVersion = param.second;
            }

            if (pid <= 0)
            {
                LOG_ERR("Invalid PID in child URI [" << COOLWSD::anonymizeUrl(request.getUrl())
                                                     << ']');
                return;
            }

            if (jailId.empty())
            {
                LOG_ERR("Invalid JailId in child URI [" << COOLWSD::anonymizeUrl(request.getUrl())
                                                        << ']');
                return;
            }

            LOG_ASSERT_MSG(socket->getInBuffer().empty(), "Unexpected data in prisoner socket");
            socket->getInBuffer().clear();

            LOG_INF("New child [" << pid << "], jailId: " << jailId);
#else
            pid_t pid = 100;
            std::string jailId = "jail";
            socket->getInBuffer().clear();
#endif
            LOG_TRC("Calling make_shared<ChildProcess>, for NewChildren?");

            auto child = std::make_shared<ChildProcess>(pid, jailId, socket, request);

            if constexpr (!Util::isMobileApp())
                UnitWSD::get().newChild(child);

            _pid = pid;
            _socketFD = socket->getFD();
            child->setSMapsFD(socket->getIncomingFD(SharedFDType::SMAPS));
            _childProcess = child; // weak

            addNewChild(std::move(child));
        }
        catch (const std::bad_weak_ptr&)
        {
            // Using shared_from_this() from a constructor is not good.
            assert(!"Got std::bad_weak_ptr. Are we using shared_from_this() from a constructor?");
        }
        catch (const std::exception& exc)
        {
            // Probably don't have enough data just yet.
            // TODO: timeout if we never get enough.
        }
    }

    /// Prisoner websocket fun ... (for now)
    virtual void handleMessage(const std::vector<char> &data) override
    {
        if (UnitWSD::isUnitTesting() && UnitWSD::get().filterChildMessage(data))
            return;

        auto message = std::make_shared<Message>(data.data(), data.size(), Message::Dir::Out);
        std::shared_ptr<StreamSocket> socket = getSocket().lock();
        if (socket)
        {
            assert(socket->getFD() == _socketFD && "Socket FD changed unexpectedly");
            LOG_TRC("Prisoner message [" << message->abbr() << ']');
        }
        else
            LOG_WRN("Message handler called but without valid socket. Expected #" << _socketFD);

        std::shared_ptr<ChildProcess> child = _childProcess.lock();
        std::shared_ptr<DocumentBroker> docBroker =
            child && child->getPid() > 0 ? child->getDocumentBroker() : nullptr;
        if (docBroker)
        {
            assert(child->getPid() == _pid && "Child PID changed unexpectedly");
            _associatedWithDoc = true;
            docBroker->handleInput(message);
        }
        else if (child && child->getPid() > 0)
        {
            const std::string abbreviatedMessage = COOLWSD::AnonymizeUserData ? "..." : message->abbr();
            LOG_WRN("Child " << child->getPid() << " has no DocBroker to handle message: ["
                             << abbreviatedMessage << ']');
        }
        else
        {
            const std::string abbreviatedMessage = COOLWSD::AnonymizeUserData ? "..." : message->abbr();
            LOG_ERR("Cannot handle message with unassociated Kit (PID " << _pid << "): ["
                                                                        << abbreviatedMessage);
        }
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t & /* timeoutMaxMs */) override
    {
        return POLLIN;
    }

    void performWrites(std::size_t /*capacity*/) override {}
};

class PlainSocketFactory final : public SocketFactory
{
    std::shared_ptr<Socket> create(const int physicalFd, Socket::Type type) override
    {
        int fd = physicalFd;
#if !MOBILEAPP
        if (SimulatedLatencyMs > 0)
        {
            int delayfd = Delay::create(SimulatedLatencyMs, physicalFd);
            if (delayfd == -1)
                LOG_ERR("DelaySocket creation failed, using physicalFd " << physicalFd << " instead.");
            else
                fd = delayfd;
        }
#endif
        return StreamSocket::create<StreamSocket>(
            std::string(), fd, type, false, HostType::Other,
            std::make_shared<ClientRequestDispatcher>());
    }
};

#if ENABLE_SSL
class SslSocketFactory final : public SocketFactory
{
    std::shared_ptr<Socket> create(const int physicalFd, Socket::Type type) override
    {
        int fd = physicalFd;

#if !MOBILEAPP
        if (SimulatedLatencyMs > 0)
        {
            int delayFd = Delay::create(SimulatedLatencyMs, physicalFd);
            if (delayFd == -1)
                LOG_ERR("Delay creation failed, fallback to original fd");
            else
                fd = delayFd;
        }
#endif

        return StreamSocket::create<SslStreamSocket>(std::string(), fd, type, false, HostType::Other,
                                                     std::make_shared<ClientRequestDispatcher>());
    }
};
#endif

class PrisonerSocketFactory final : public SocketFactory
{
    std::shared_ptr<Socket> create(const int fd, Socket::Type type) override
    {
        // No local delay.
        return StreamSocket::create<StreamSocket>(std::string(), fd, type, false, HostType::Other,
                                                  std::make_shared<PrisonerRequestDispatcher>(),
                                                  StreamSocket::ReadType::UseRecvmsgExpectFD);
    }
};

/// The main server thread.
///
/// Waits for the connections from the cools, and creates the
/// websockethandlers accordingly.
class COOLWSDServer
{
    COOLWSDServer(COOLWSDServer&& other) = delete;
    const COOLWSDServer& operator=(COOLWSDServer&& other) = delete;
    // allocate port & hold temporarily.
    std::shared_ptr<ServerSocket> _serverSocket;
public:
    COOLWSDServer()
        : _acceptPoll("accept_poll")
#if !MOBILEAPP
        , _admin(Admin::instance())
#endif
    {
    }

    ~COOLWSDServer()
    {
        stop();
    }

    void findClientPort()
    {
        _serverSocket = findServerPort();
    }

    void startPrisoners()
    {
        PrisonerPoll->startThread();
        PrisonerPoll->insertNewSocket(findPrisonerServerPort());
    }

    static void stopPrisoners()
    {
        PrisonerPoll->joinThread();
    }

    void start()
    {
        _acceptPoll.startThread();
        _acceptPoll.insertNewSocket(_serverSocket);

#if MOBILEAPP
        coolwsd_server_socket_fd = _serverSocket->getFD();
#endif

        _serverSocket.reset();
        WebServerPoll->startThread();

#if !MOBILEAPP
        _admin.start();
#endif
    }

    void stop()
    {
        _acceptPoll.joinThread();
        if (WebServerPoll)
            WebServerPoll->joinThread();
#if !MOBILEAPP
        _admin.stop();
#endif
    }

    void dumpState(std::ostream& os) const
    {
        // FIXME: add some stop-world magic before doing the dump(?)
        Socket::InhibitThreadChecks = true;
        SocketPoll::InhibitThreadChecks = true;

        std::string version, hash;
        Util::getVersionInfo(version, hash);

        os << "COOLWSDServer: " << version << " - " << hash << " state dumping"
#if !MOBILEAPP
           << "\n  Kit version: " << COOLWSD::LOKitVersion << "\n  Ports: server "
           << ClientPortNumber << " prisoner " << MasterLocation
           << "\n  SSL: " << (ConfigUtil::isSslEnabled() ? "https" : "http")
           << "\n  SSL-Termination: " << (ConfigUtil::isSSLTermination() ? "yes" : "no")
           << "\n  Security " << (COOLWSD::NoCapsForKit ? "no" : "") << " chroot, "
           << (COOLWSD::NoSeccomp ? "no" : "") << " api lockdown"
           << "\n  Admin: " << (COOLWSD::AdminEnabled ? "enabled" : "disabled")
           << "\n  RouteToken: " << COOLWSD::RouteToken
#endif
           << "\n  TerminationFlag: " << SigUtil::getTerminationFlag()
           << "\n  isShuttingDown: " << SigUtil::getShutdownRequestFlag()
           << "\n  NewChildren: " << NewChildren.size() << " (" << NewChildren.capacity() << ')'
           << "\n  OutstandingForks: " << OutstandingForks
           << "\n  NumPreSpawnedChildren: " << COOLWSD::NumPreSpawnedChildren
           << "\n  ChildSpawnTimeoutMs: " << ChildSpawnTimeoutMs
           << "\n  Document Brokers: " << DocBrokers.size()
#if !MOBILEAPP
           << "\n  of which ConvertTo: " << ConvertToBroker::getInstanceCount()
#endif
           << "\n  vs. MaxDocuments: " << COOLWSD::MaxDocuments
           << "\n  NumConnections: " << COOLWSD::NumConnections
           << "\n  vs. MaxConnections: " << COOLWSD::MaxConnections
           << "\n  SysTemplate: " << COOLWSD::SysTemplate
           << "\n  LoTemplate: " << COOLWSD::LoTemplate
           << "\n  ChildRoot: " << COOLWSD::ChildRoot
           << "\n  FileServerRoot: " << COOLWSD::FileServerRoot
           << "\n  ServiceRoot: " << COOLWSD::ServiceRoot
           << "\n  LOKitVersion: " << COOLWSD::LOKitVersion
           << "\n  HostIdentifier: " << Util::getProcessIdentifier()
           << "\n  ConfigFile: " << COOLWSD::ConfigFile
           << "\n  ConfigDir: " << COOLWSD::ConfigDir
           << "\n  LogLevel: " << COOLWSD::LogLevel
           << "\n  LogDisabledAreas: " << COOLWSD::LogDisabledAreas
           << "\n  AnonymizeUserData: " << (COOLWSD::AnonymizeUserData ? "yes" : "no")
           << "\n  CheckCoolUser: " << (COOLWSD::CheckCoolUser ? "yes" : "no")
           << "\n  IsProxyPrefixEnabled: " << (COOLWSD::IsProxyPrefixEnabled ? "yes" : "no")
           << "\n  OverrideWatermark: " << COOLWSD::OverrideWatermark
           << "\n  UserInterface: " << COOLWSD::UserInterface
           << "\n  Config: " << LoggableConfigEntries
            ;

        std::string smap;
        if (const ssize_t size = FileUtil::readFile("/proc/self/smaps_rollup", smap); size <= 0)
            os << "\n  smaps_rollup: <unavailable>";
        else
            os << "\n  smaps_rollup: " << smap;

#if !MOBILEAPP
        if (FetchHttpSession)
        {
            os << "\nFetchHttpSession:\n";
            FetchHttpSession->dumpState(os, "\n  ");
        }
        else
#endif // !MOBILEAPP
            os << "\nFetchHttpSession: null\n";

        os << "\nServer poll:\n";
        _acceptPoll.dumpState(os);

        os << "\nWeb Server poll:\n";
        WebServerPoll->dumpState(os);

        os << "\nPrisoner poll:\n";
        PrisonerPoll->dumpState(os);

#if !MOBILEAPP
        os << "\nAdmin poll:\n";
        _admin.dumpState(os);

        // If we have any delaying work going on.
        os << '\n';
        Delay::dumpState(os);

        // If we have any DNS work going on.
        os << '\n';
        net::AsyncDNS::dumpState(os);

        os << '\n';
        COOLWSD::SavedClipboards->dumpState(os);
#endif

        os << "\nDocument Broker polls " << "[ " << DocBrokers.size() << " ]:\n";
        for (auto &i : DocBrokers)
            i.second->dumpState(os);

#if !MOBILEAPP
        os << "\nConverter count: " << ConvertToBroker::getInstanceCount() << '\n';
#endif

        os << "\nDone COOLWSDServer state dumping.\n";

        Socket::InhibitThreadChecks = false;
        SocketPoll::InhibitThreadChecks = false;
    }

private:
    class AcceptPoll : public TerminatingPoll {
    public:
        AcceptPoll(const std::string &threadName) :
            TerminatingPoll(threadName) {}

        void wakeupHook() override
        {
            SigUtil::checkDumpGlobalState(dump_state);
        }
    };
    /// This thread & poll accepts incoming connections.
    AcceptPoll _acceptPoll;

#if !MOBILEAPP
    Admin& _admin;
#endif

    /// Create the internal only, local socket for forkit / kits prisoners to talk to.
    std::shared_ptr<ServerSocket> findPrisonerServerPort()
    {
        std::shared_ptr<SocketFactory> factory = std::make_shared<PrisonerSocketFactory>();
#if !MOBILEAPP
        auto socket = std::make_shared<LocalServerSocket>(
                        std::chrono::steady_clock::now(), *PrisonerPoll, factory);

        const std::string location = socket->bind();
        if (!location.length())
        {
            LOG_FTL("Failed to create local unix domain socket. Exiting.");
            Util::forcedExit(EX_SOFTWARE);
            return nullptr;
        }

        if (!socket->listen())
        {
            LOG_FTL("Failed to listen on local unix domain socket at " << location << ". Exiting.");
            Util::forcedExit(EX_SOFTWARE);
        }

        LOG_INF("Listening to prisoner connections on " << location);
        MasterLocation = location;
#ifndef HAVE_ABSTRACT_UNIX_SOCKETS
        if(!socket->link(COOLWSD::SysTemplate + "/0" + MasterLocation))
        {
            LOG_FTL("Failed to hardlink local unix domain socket into a jail. Exiting.");
            Util::forcedExit(EX_SOFTWARE);
        }
#endif
#else
        constexpr int DEFAULT_MASTER_PORT_NUMBER = 9981;
        std::shared_ptr<ServerSocket> socket
            = ServerSocket::create(ServerSocket::Type::Public, DEFAULT_MASTER_PORT_NUMBER,
                                   ClientPortProto, std::chrono::steady_clock::now(), *PrisonerPoll, factory);

        COOLWSD::prisonerServerSocketFD = socket->getFD();
        LOG_INF("Listening to prisoner connections on #" << COOLWSD::prisonerServerSocketFD);
#endif
        return socket;
    }

    /// Create the externally listening public socket
    std::shared_ptr<ServerSocket> findServerPort()
    {
        std::shared_ptr<SocketFactory> factory;
        std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now();

        if (ClientPortNumber <= 0)
        {
            // Avoid using the default port for unit-tests altogether.
            // This avoids interfering with a running test instance.
            ClientPortNumber = DEFAULT_CLIENT_PORT_NUMBER + (UnitWSD::isUnitTesting() ? 1 : 0);
        }

#if ENABLE_SSL
        if (ConfigUtil::isSslEnabled())
            factory = std::make_shared<SslSocketFactory>();
        else
#endif
            factory = std::make_shared<PlainSocketFactory>();

        std::shared_ptr<ServerSocket> socket = ServerSocket::create(
            ClientListenAddr, ClientPortNumber, ClientPortProto, now, *WebServerPoll, factory);

        const int firstPortNumber = ClientPortNumber;
        while (!socket &&
#ifdef BUILDING_TESTS
               true
#else
               UnitWSD::isUnitTesting()
#endif
            )
        {
            ++ClientPortNumber;
            LOG_INF("Client port " << (ClientPortNumber - 1) << " is busy, trying "
                                   << ClientPortNumber);
            socket = ServerSocket::create(ClientListenAddr, ClientPortNumber, ClientPortProto,
                                          now, *WebServerPoll, factory);
        }

        if (!socket)
        {
            LOG_FTL("Failed to listen on Server port(s) (" << firstPortNumber << '-'
                                                           << ClientPortNumber << "). Exiting");
            Util::forcedExit(EX_SOFTWARE);
        }

#if !MOBILEAPP
        LOG_INF('#' << socket->getFD() << " Listening to client connections on port "
                    << ClientPortNumber);
#else
        LOG_INF("Listening to client connections on #" << socket->getFD());
#endif
        return socket;
    }
};

#if !MOBILEAPP
void COOLWSD::processFetchUpdate(SocketPoll& poll)
{
    try
    {
        const std::string url(INFOBAR_URL);
        if (url.empty())
            return; // No url, nothing to do.

        if (FetchHttpSession)
            return;

        Poco::URI uriFetch(url);
        uriFetch.addQueryParameter("product", ConfigUtil::getString("product_name", APP_NAME));
        uriFetch.addQueryParameter("version", Util::getCoolVersion());
        LOG_TRC("Infobar update request from " << uriFetch.toString());
        FetchHttpSession = StorageConnectionManager::getHttpSession(uriFetch);
        if (!FetchHttpSession)
            return;

        http::Request request(uriFetch.getPathAndQuery());
        request.add("Accept", "application/json");

        FetchHttpSession->setFinishedHandler([](const std::shared_ptr<http::Session>& httpSession) {
            std::shared_ptr<http::Response> httpResponse = httpSession->response();

            FetchHttpSession.reset();
            if (httpResponse->statusLine().statusCode() == http::StatusCode::OK)
            {
                LOG_DBG("Infobar update returned: " << httpResponse->getBody());

                std::lock_guard<std::mutex> lock(COOLWSD::FetchUpdateMutex);
                COOLWSD::LatestVersion = httpResponse->getBody();
            }
            else
                LOG_WRN("Failed to update the infobar. Got: "
                        << httpResponse->statusLine().statusCode() << ' '
                        << httpResponse->statusLine().reasonPhrase());
        });

        FetchHttpSession->asyncRequest(request, poll);
    }
    catch(const Poco::Exception& exc)
    {
        LOG_DBG("FetchUpdate: " << exc.displayText());
    }
    catch(std::exception& exc)
    {
        LOG_DBG("FetchUpdate: " << exc.what());
    }
    catch(...)
    {
        LOG_DBG("FetchUpdate: Unknown exception");
    }
}

#if ENABLE_DEBUG
std::string COOLWSD::getServerURL()
{
    return getServiceURI(COOLWSD_TEST_COOL_UI);
}
#endif
#endif

int COOLWSD::innerMain()
{
#if !MOBILEAPP
#  ifdef __linux__
    // down-pay all the forkit linking cost once & early.
    setenv("LD_BIND_NOW", "1", 1);
#  endif

    std::string version, hash;
    Util::getVersionInfo(version, hash);
    LOG_INF("Coolwsd version details: " << version << " - " << hash << " - id " << Util::getProcessIdentifier() << " - on " << Util::getLinuxVersion());
#endif
    SigUtil::addActivity("coolwsd init");

    initializeSSL();

#if !MOBILEAPP
    // Fetch remote settings from server if configured
    RemoteConfigPoll remoteConfigThread(config());
    remoteConfigThread.start();
#endif

#ifndef IOS
    // We can open files with non-ASCII names just fine on iOS without this, and this code is
    // heavily Linux-specific anyway.

    // Force a uniform UTF-8 locale for ourselves & our children.
    char* locale = std::setlocale(LC_ALL, "C.UTF-8");
    if (!locale)
    {
        // rhbz#1590680 - C.UTF-8 is unsupported on RH7
        LOG_WRN("Could not set locale to C.UTF-8, will try en_US.UTF-8");
        locale = std::setlocale(LC_ALL, "en_US.UTF-8");
        if (!locale)
            LOG_WRN("Could not set locale to en_US.UTF-8. Without UTF-8 support documents with non-ASCII file names cannot be opened.");
    }
    if (locale)
    {
        LOG_INF("Locale is set to " + std::string(locale));
        ::setenv("LC_ALL", locale, 1);
    }
#endif

#if !MOBILEAPP
    // We use the same option set for both parent and child coolwsd,
    // so must check options required in the parent (but not in the
    // child) separately now. Also check for options that are
    // meaningless for the parent.
    if (LoTemplate.empty())
    {
        LOG_FTL("Missing --lo-template-path option");
        throw Poco::Util::MissingOptionException("lotemplate");
    }

    if (FileServerRoot.empty())
        FileServerRoot = Util::getApplicationPath();
    FileServerRoot = Poco::Path(FileServerRoot).absolute().toString();
    LOG_DBG("FileServerRoot: " << FileServerRoot);

    LOG_DBG("Initializing DelaySocket with " << SimulatedLatencyMs << "ms.");
    Delay delay(SimulatedLatencyMs);

    const auto fetchUpdateCheck = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::hours(std::max(ConfigUtil::getConfigValue<int>("fetch_update_check", 10), 0)));
#endif

    ClientRequestDispatcher::InitStaticFileContentCache();

    // Allocate our port - passed to prisoners.
    assert(Server && "The COOLWSDServer instance does not exist.");
    Server->findClientPort();

    TmpFontDir = ChildRoot + JailUtil::CHILDROOT_TMP_INCOMING_PATH + "/fonts";
    TmpPresntTemplateDir = ChildRoot + JailUtil::CHILDROOT_TMP_INCOMING_PATH + "/templates/presnt";

    // Start the internal prisoner server and spawn forkit,
    // which in turn forks first child.
    Server->startPrisoners();

// No need to "have at least one child" beforehand on mobile
#if !MOBILEAPP

    if (!Util::isKitInProcess())
    {
        // Make sure we have at least one child before moving forward.
        std::unique_lock<std::mutex> lock(NewChildrenMutex);
        // If we are debugging, it's not uncommon to wait for several minutes before first
        // child is born. Don't use an expiry timeout in that case.
        const bool debugging = std::getenv("SLEEPFORDEBUGGER") || std::getenv("SLEEPKITFORDEBUGGER");
        if (debugging)
        {
            LOG_DBG("Waiting for new child without timeout.");
            NewChildrenCV.wait(lock, []() { return !NewChildren.empty(); });
        }
        else
        {
            int retry = (COOLWSD::NoCapsForKit ? 150 : 50);
            const auto timeout = std::chrono::milliseconds(ChildSpawnTimeoutMs);
            while (retry-- > 0 && !SigUtil::getShutdownRequestFlag())
            {
                LOG_INF("Waiting for a new child for a max of " << timeout);
                if (NewChildrenCV.wait_for(lock, timeout, []() { return !NewChildren.empty(); }))
                {
                    break;
                }
            }
        }

        // Check we have at least one.
        LOG_TRC("Have " << NewChildren.size() << " new children.");
        if (NewChildren.empty())
        {
            if (SigUtil::getShutdownRequestFlag())
                LOG_FTL("Shutdown requested while starting up. Exiting.");
            else
                LOG_FTL("No child process could be created. Exiting.");
            Util::forcedExit(EX_SOFTWARE);
        }

        assert(NewChildren.size() > 0);
    }

    if (LogLevel != "trace")
    {
        LOG_INF("WSD initialization complete: setting log-level to [" << LogLevel << "] as configured.");
        Log::setLevel(LogLevel);
    }
    Log::setDisabledAreas(LogDisabledAreas);

    if (Log::getLevel() >= Log::Level::INF)
        LOG_ERR("Log level is set very high to '" << LogLevel << "' this will have a "
                "significant performance impact. Do not use this in production.");

    std::string uriConfigKey;
    const std::string& fontConfigKey = "remote_font_config.url";
    const std::string& assetConfigKey = "remote_asset_config.url";
    bool remoteFontDefined = !ConfigUtil::getConfigValue<std::string>(fontConfigKey, "").empty();
    bool remoteAssetDefined = !ConfigUtil::getConfigValue<std::string>(assetConfigKey, "").empty();
    // Both defined: warn and use assetConfigKey
    if (remoteFontDefined && remoteAssetDefined)
    {
        LOG_WRN("Both remote_font_config.url and remote_asset_config.url are defined, "
                "remote_asset_config.url is overriden on remote_font_config.url");
        uriConfigKey = assetConfigKey;
    }
    // only font defined: use fontConfigKey
    else if (remoteFontDefined && !remoteAssetDefined)
    {
        uriConfigKey = fontConfigKey;
    }
    // only asset defined: use assetConfigKey
    else if (!remoteFontDefined && remoteAssetDefined)
    {
        uriConfigKey = assetConfigKey;
    }

    // Start the remote asset downloading polling thread.
    std::unique_ptr<RemoteAssetConfigPoll> remoteAssetConfigThread;
    if (!uriConfigKey.empty())
    {
        try
        {
            // Fetch font and/or templates settings from server if configured
            remoteAssetConfigThread = std::make_unique<RemoteAssetConfigPoll>(config(), uriConfigKey);
            remoteAssetConfigThread->start();
        }
        catch (const Poco::Exception&)
        {
            LOG_DBG("No remote_asset_config");
        }
    }

#endif

    // URI with /contents are public and we don't need to anonymize them.
    Anonymizer::mapAnonymized("contents", "contents");

    // Start the server.
    Server->start();

#if WASMAPP
    // It is not at all obvious that this is the ideal place to do the HULLO thing and call onopen
    // on TheFakeWebSocket. But it seems to work.
    handle_cool_message("HULLO");
    MAIN_THREAD_EM_ASM(window.TheFakeWebSocket.onopen());
#endif

    /// The main-poll does next to nothing:
    SocketPoll mainWait("main");

    SigUtil::addActivity("coolwsd accepting connections");

#if !MOBILEAPP
    std::cerr << "Ready to accept connections on port " << ClientPortNumber <<  ".\n" << std::endl;
    if (SignalParent)
    {
        kill(getppid(), SIGUSR2);
    }
#endif

#if !MOBILEAPP && ENABLE_DEBUG
    const std::string postMessageURI =
        getServiceURI("/browser/dist/framed.doc.html?file_path=" DEBUG_ABSSRCDIR
                      "/test/samples/writer-edit.fodt");
    std::ostringstream oss;
    std::ostringstream ossRO;
    oss << "\nLaunch one of these in your browser:\n\n"
        << "Edit mode:" << '\n';

    auto names = FileUtil::getDirEntries(DEBUG_ABSSRCDIR "/test/samples");
    for (auto &i : names)
    {
        if (i.find("-edit") != std::string::npos)
        {
            oss   << "    " << i << "\t" << getLaunchURI(std::string("test/samples/") + i) << "\n";
            ossRO << "    " << i << "\t" << getLaunchURI(std::string("test/samples/") + i, true) << "\n";
        }
    }

    oss << "\nReadonly mode:" << '\n'
        << ossRO.str()
        << "\npostMessage: " << postMessageURI << std::endl;

    const std::string adminURI = getServiceURI(COOLWSD_TEST_ADMIN_CONSOLE, true);
    if (!adminURI.empty())
        oss << "\nOr for the admin, monitoring, capabilities & discovery:\n\n"
            << adminURI << '\n'
            << getServiceURI(COOLWSD_TEST_METRICS, true) << '\n'
            << getServiceURI("/hosting/capabilities") << '\n'
            << getServiceURI("/hosting/discovery") << '\n';

    oss << std::endl;
    std::cerr << oss.str();
#endif

    const auto startStamp = std::chrono::steady_clock::now();
#if !MOBILEAPP
    auto stampFetch = startStamp - (fetchUpdateCheck - std::chrono::milliseconds(60000));

#ifdef __linux__
    if (ConfigUtil::getConfigValue<bool>("stop_on_config_change", false))
    {
        std::shared_ptr<InotifySocket> inotifySocket = std::make_shared<InotifySocket>(startStamp);
        mainWait.insertNewSocket(inotifySocket);
    }
#endif
#endif

    SigUtil::addActivity("coolwsd running");

    while (!SigUtil::getShutdownRequestFlag())
    {
        // This timeout affects the recovery time of prespawned children.
        std::chrono::microseconds waitMicroS = SocketPoll::DefaultPollTimeoutMicroS * 4;

        if (UnitWSD::isUnitTesting() && !SigUtil::getShutdownRequestFlag())
        {
            UnitWSD::get().invokeTest();

            // More frequent polling while testing, to reduce total test time.
            waitMicroS =
                std::min(UnitWSD::get().getTimeoutMilliSeconds(), std::chrono::milliseconds(1000));
            waitMicroS /= 4;
        }

        mainWait.poll(waitMicroS);

        // Wake the prisoner poll to spawn some children, if necessary.
        PrisonerPoll->wakeup();

        const auto timeNow = std::chrono::steady_clock::now();
        const std::chrono::milliseconds timeSinceStartMs
            = std::chrono::duration_cast<std::chrono::milliseconds>(timeNow - startStamp);
        // Unit test timeout
        if (UnitWSD::isUnitTesting() && !SigUtil::getShutdownRequestFlag())
        {
            UnitWSD::get().checkTimeout(timeSinceStartMs);
        }

#if !MOBILEAPP
        SavedClipboards->checkexpiry();

        const std::chrono::milliseconds durationFetch
            = std::chrono::duration_cast<std::chrono::milliseconds>(timeNow - stampFetch);
        if (fetchUpdateCheck > std::chrono::milliseconds::zero() && durationFetch > fetchUpdateCheck)
        {
            processFetchUpdate(mainWait);
            stampFetch = timeNow;
        }
#endif

#if ENABLE_DEBUG && !MOBILEAPP
        if (careerSpanMs > std::chrono::milliseconds::zero() && timeSinceStartMs > careerSpanMs)
        {
            LOG_INF("Setting ShutdownRequestFlag: " << timeSinceStartMs << " gone, career of "
                                                    << careerSpanMs << " expired.");
            SigUtil::requestShutdown();
        }
#endif
    }

#ifndef IOS // SigUtil::getShutdownRequestFlag() always returns false on iOS, thus the above while
            // loop never exits.

    COOLWSD::alertAllUsersInternal("close: shuttingdown");

    SigUtil::addActivity("shutting down");

    // Lots of polls will stop; stop watching them first.
    SocketPoll::PollWatchdog.reset();

    // Stop the listening to new connections
    // and wait until sockets close.
    LOG_INF("Stopping server socket listening. ShutdownRequestFlag: " <<
            SigUtil::getShutdownRequestFlag() << ", TerminationFlag: " << SigUtil::getTerminationFlag());

    if (!UnitWSD::isUnitTesting())
    {
        // When running unit-tests the listening port will
        // get recycled and another test will be listening.
        // This is very problematic if a DocBroker here is
        // saving and uploading before shutting down, because
        // the test that gets the same port will receive this
        // unexpected upload and fail.

        // Otherwise, in production, we should probably respond
        // with some error that we are recycling. But for now,
        // don't change the behavior and stop listening.
        Server->stop();
    }

    // atexit handlers tend to free Admin before Documents
    LOG_INF("Exiting. Cleaning up lingering documents.");
#if !MOBILEAPP
    if (!SigUtil::getShutdownRequestFlag())
    {
        // This shouldn't happen, but it's fail safe to always cleanup properly.
        LOG_WRN("Setting ShutdownRequestFlag: Exiting WSD without ShutdownRequestFlag. Setting it "
                "now.");
        SigUtil::requestShutdown();
    }
#endif

    SigUtil::addActivity("wait save & close");

    // Wait until documents are saved and sessions closed.
    // Don't stop the DocBroker, they will exit.
    constexpr size_t sleepMs = 200;
    constexpr size_t count = (COMMAND_TIMEOUT_MS * 6) / sleepMs;
    for (size_t i = 0; i < count; ++i)
    {
        std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
        if (DocBrokers.empty())
            break;

        LOG_DBG("Waiting for " << DocBrokers.size() << " documents to stop.");
        cleanupDocBrokers();
        docBrokersLock.unlock();

        // Give them time to save and cleanup.
        std::this_thread::sleep_for(std::chrono::milliseconds(sleepMs));
    }

    if (UnitWSD::isUnitTesting() && !SigUtil::getTerminationFlag())
    {
        LOG_INF("Setting TerminationFlag to avoid deadlocking unittest.");
        SigUtil::setTerminationFlag();
    }

    // Disable thread checking - we'll now cleanup lots of things if we can
    Socket::InhibitThreadChecks = true;
    SocketPoll::InhibitThreadChecks = true;

    // Wait for the DocumentBrokers. They must be saving/uploading now.
    // Do not stop them! Otherwise they might not save/upload the document.
    // We block until they finish, or the service stopping times out.
    {
        std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
        for (auto& docBrokerIt : DocBrokers)
        {
            std::shared_ptr<DocumentBroker> docBroker = docBrokerIt.second;
            if (docBroker && docBroker->isAlive())
            {
                LOG_DBG("Joining docBroker [" << docBrokerIt.first << "].");
                docBroker->joinThread();
            }
        }

        // Now should be safe to destroy what's left.
        cleanupDocBrokers();
        DocBrokers.clear();
    }

    SigUtil::addActivity("save traces");

    if (TraceEventFile != NULL)
    {
        // If we have written any objects to it, it ends with a comma and newline. Back over those.
        if (ftell(TraceEventFile) > 2)
            (void)fseek(TraceEventFile, -2, SEEK_CUR);
        // Close the JSON array.
        fprintf(TraceEventFile, "\n]\n");
        fclose(TraceEventFile);
        TraceEventFile = NULL;
    }

#if !MOBILEAPP
    if (!Util::isKitInProcess())
    {
        // Terminate child processes
        LOG_INF("Requesting forkit process " << ForKitProcId << " to terminate.");
#if CODE_COVERAGE || VALGRIND_COOLFORKIT
        constexpr auto signal = SIGTERM;
#else
        constexpr auto signal = SIGKILL;
#endif
        SigUtil::killChild(ForKitProcId, signal);
    }
#endif

    Server->stopPrisoners();

    SigUtil::addActivity("prisoners stopped");

    if (UnitWSD::isUnitTesting())
    {
        Server->stop();
        Server.reset();
    }

    PrisonerPoll.reset();

#if !MOBILEAPP
    net::AsyncDNS::stopAsyncDNS();
#endif

    SigUtil::addActivity("async DNS stopped");

    WebServerPoll.reset();

    // Terminate child processes
    LOG_INF("Requesting child processes to terminate.");
    for (auto& child : NewChildren)
    {
        child->terminate();
    }

    NewChildren.clear();

    SigUtil::addActivity("terminated unused children");

#if !MOBILEAPP
    if (!Util::isKitInProcess())
    {
        // Wait for forkit process finish.
        LOG_INF("Waiting for forkit process to exit");
        int status = 0;
        waitpid(ForKitProcId, &status, WUNTRACED);
        ForKitProcId = -1;
        ForKitProc.reset();
    }

    JailUtil::cleanupJails(CleanupChildRoot);
#endif // !MOBILEAPP

    const int returnValue = UnitBase::uninit();

    LOG_INF("Process [coolwsd] finished with exit status: " << returnValue);

    SigUtil::addActivity("finished with status " + std::to_string(returnValue));

    // At least on centos7, Poco deadlocks while
    // cleaning up its SSL context singleton.
    Util::forcedExit(returnValue);

    return returnValue;
#endif
}

std::shared_ptr<TerminatingPoll> COOLWSD:: getWebServerPoll ()
{
    return WebServerPoll;
}

void COOLWSD::cleanup()
{
    try
    {
        Server.reset();

        PrisonerPoll.reset();

        WebServerPoll.reset();

#if !MOBILEAPP
        SavedClipboards.reset();

        FileRequestHandler.reset();
        JWTAuth::cleanup();

#if ENABLE_SSL
        // Finally, we no longer need SSL.
        if (ConfigUtil::isSslEnabled())
        {
            Poco::Net::uninitializeSSL();
            Poco::Crypto::uninitializeCrypto();
            ssl::Manager::uninitializeClientContext();
            ssl::Manager::uninitializeServerContext();
        }
#endif
#endif

        TraceDumper.reset();

        Socket::InhibitThreadChecks = true;
        SocketPoll::InhibitThreadChecks = true;

        // Delete these while the static Admin instance is still alive.
        std::lock_guard<std::mutex> docBrokersLock(DocBrokersMutex);
        DocBrokers.clear();
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Failed to uninitialize: " << ex.what());
    }
}

int COOLWSD::main(const std::vector<std::string>& /*args*/)
{
#if MOBILEAPP && !defined IOS
    SigUtil::resetTerminationFlags();
#endif

    int returnValue;

    try {
        returnValue = innerMain();
    }
    catch (const std::exception& e)
    {
        LOG_FTL("Exception: " << e.what());
        cleanup();
        throw;
    } catch (...) {
        cleanup();
        throw;
    }

    cleanup();

    returnValue = UnitBase::uninit();

    LOG_INF("Process [coolwsd] finished with exit status: " << returnValue);

#if CODE_COVERAGE
    __gcov_dump();
#endif

    return returnValue;
}

int COOLWSD::getClientPortNumber()
{
    return ClientPortNumber;
}

/// Only for unit testing ...
std::string COOLWSD::getJailRoot(int pid)
{
    std::lock_guard<std::mutex> docBrokersLock(DocBrokersMutex);
    for (auto &it : DocBrokers)
    {
        if (pid < 0 || it.second->getPid() == pid)
            return it.second->getJailRoot();
    }
    return std::string();
}

#if !MOBILEAPP

std::vector<std::shared_ptr<DocumentBroker>> COOLWSD::getBrokersTestOnly()
{
    std::lock_guard<std::mutex> docBrokersLock(DocBrokersMutex);
    std::vector<std::shared_ptr<DocumentBroker>> result;

    result.reserve(DocBrokers.size());
    for (auto& brokerIt : DocBrokers)
        result.push_back(brokerIt.second);
    return result;
}

std::set<pid_t> COOLWSD::getKitPids()
{
    std::set<pid_t> pids = getSpareKitPids();
    pids.merge(getDocKitPids());
    return pids;
}

std::set<pid_t> COOLWSD::getSpareKitPids()
{
    std::set<pid_t> pids;
    pid_t pid;
    {
        std::unique_lock<std::mutex> lock(NewChildrenMutex);
        for (const auto &child : NewChildren)
        {
            pid = child->getPid();
            if (pid > 0)
                pids.emplace(pid);
        }
    }
    return pids;
}

std::set<pid_t> COOLWSD::getDocKitPids()
{
    std::set<pid_t> pids;
    pid_t pid;
    {
        std::unique_lock<std::mutex> lock(DocBrokersMutex);
        for (const auto &it : DocBrokers)
        {
            pid = it.second->getPid();
            if (pid > 0)
                pids.emplace(pid);
        }
    }
    return pids;
}

#if !defined(BUILDING_TESTS)
namespace Util
{

void alertAllUsers(const std::string& cmd, const std::string& kind)
{
    alertAllUsers("error: cmd=" + cmd + " kind=" + kind);
}

void alertAllUsers(const std::string& msg)
{
    COOLWSD::alertAllUsersInternal(msg);
}

}
#endif

#endif

void forwardSignal(const int signum);

void dump_state()
{
    std::ostringstream oss;

    if (Server)
        Server->dumpState(oss);

    oss << "\nMalloc info: \n" << Util::getMallocInfo() << '\n';

    const std::string msg = oss.str();
    fprintf(stderr, "%s\n", msg.c_str());

    LOG_TRC(msg);

#if !MOBILEAPP
    Admin::dumpMetrics();
#endif

    std::lock_guard<std::mutex> docBrokerLock(DocBrokersMutex);
    std::lock_guard<std::mutex> newChildLock(NewChildrenMutex);
    forwardSignal(SIGUSR1);
}

void lslr_childroot()
{
    std::cout << "lslr: " << COOLWSD::ChildRoot << "\n";
    FileUtil::lslr(COOLWSD::ChildRoot.c_str());
    std::cout << std::flush;
}

void forwardSigUsr2()
{
    LOG_TRC("forwardSigUsr2");

    if (Util::isKitInProcess())
        return;

    Util::assertIsLocked(DocBrokersMutex);
    std::lock_guard<std::mutex> newChildLock(NewChildrenMutex);

    forwardSignal(SIGUSR2);
}

void forwardSignal(const int signum)
{
    const char* name = SigUtil::signalName(signum);

    Util::assertIsLocked(DocBrokersMutex);
    Util::assertIsLocked(NewChildrenMutex);

#if !MOBILEAPP
    if (COOLWSD::ForKitProcId > 0)
    {
        LOG_INF("Sending " << name << " to forkit " << COOLWSD::ForKitProcId);
        ::kill(COOLWSD::ForKitProcId, signum);
    }
#endif

    for (const auto& child : NewChildren)
    {
        if (child && child->getPid() > 0)
        {
            LOG_INF("Sending " << name << " to child " << child->getPid());
            ::kill(child->getPid(), signum);
        }
    }

    for (const auto& pair : DocBrokers)
    {
        std::shared_ptr<DocumentBroker> docBroker = pair.second;
        if (docBroker)
        {
            LOG_INF("Sending " << name << " to docBroker " << docBroker->getPid());
            ::kill(docBroker->getPid(), signum);
        }
    }
}

// Avoid this in the Util::isFuzzing() case because libfuzzer defines its own main().
#if !MOBILEAPP && !LIBFUZZER

int main(int argc, char** argv)
{
    SigUtil::setUserSignals();
    SigUtil::setFatalSignals("wsd " + Util::getCoolVersion() + ' ' + Util::getCoolVersionHash());
    setKitInProcess();

    try
    {
        COOLWSD app;
        return app.run(argc, argv);
    }
    catch (Poco::Exception& exc)
    {
        std::cerr << exc.displayText() << std::endl;
        return EX_SOFTWARE;
    }
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
