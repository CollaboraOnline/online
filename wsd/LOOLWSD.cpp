/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>
#include "LOOLWSD.hpp"
#include "ProofKey.hpp"

/* Default host used in the start test URI */
#define LOOLWSD_TEST_HOST "localhost"

/* Default loleaflet UI used in the admin console URI */
#define LOOLWSD_TEST_ADMIN_CONSOLE "/loleaflet/dist/admin/admin.html"

/* Default loleaflet UI used in for monitoring URI */
#define LOOLWSD_TEST_METRICS "/lool/getMetrics"

/* Default loleaflet UI used in the start test URI */
#define LOOLWSD_TEST_LOLEAFLET_UI "/loleaflet/" LOOLWSD_VERSION_HASH "/loleaflet.html"

/* Default document used in the start test URI */
#define LOOLWSD_TEST_DOCUMENT_RELATIVE_PATH_WRITER  "test/data/hello-world.odt"
#define LOOLWSD_TEST_DOCUMENT_RELATIVE_PATH_CALC    "test/data/hello-world.ods"
#define LOOLWSD_TEST_DOCUMENT_RELATIVE_PATH_IMPRESS "test/data/hello-world.odp"

/* Default ciphers used, when not specified otherwise */
#define DEFAULT_CIPHER_SET "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH"

// This is the main source for the loolwsd program. LOOL uses several loolwsd processes: one main
// parent process that listens on the TCP port and accepts connections from LOOL clients, and a
// number of child processes, each which handles a viewing (editing) session for one document.

#include <unistd.h>
#include <stdlib.h>
#include <sysexits.h>

#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>

#include <cassert>
#include <cerrno>
#include <clocale>
#include <condition_variable>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <chrono>
#include <fstream>
#include <iostream>
#include <map>
#include <mutex>
#include <sstream>
#include <thread>

#if !MOBILEAPP

#include <Poco/Net/Context.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/IPAddress.h>
#include <Poco/Net/MessageHeader.h>
#include <Poco/Net/NameValueCollection.h>
#include <Poco/Net/Net.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/PartHandler.h>
#include <Poco/Net/SocketAddress.h>

using Poco::Net::HTMLForm;
using Poco::Net::PartHandler;

#endif

#include <Poco/DOM/AutoPtr.h>
#include <Poco/DOM/DOMParser.h>
#include <Poco/DOM/DOMWriter.h>
#include <Poco/DOM/Document.h>
#include <Poco/DOM/Element.h>
#include <Poco/DOM/NodeList.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/DirectoryIterator.h>
#include <Poco/Exception.h>
#include <Poco/File.h>
#include <Poco/FileStream.h>
#include <Poco/MemoryStream.h>
#include <Poco/Net/DNS.h>
#include <Poco/Net/HostEntry.h>
#include <Poco/Path.h>
#include <Poco/Process.h>
#include <Poco/SAX/InputSource.h>
#include <Poco/StreamCopier.h>
#include <Poco/StringTokenizer.h>
#include <Poco/TemporaryFile.h>
#include <Poco/URI.h>
#include <Poco/Util/AbstractConfiguration.h>
#include <Poco/Util/HelpFormatter.h>
#include <Poco/Util/MapConfiguration.h>
#include <Poco/Util/Option.h>
#include <Poco/Util/OptionException.h>
#include <Poco/Util/OptionSet.h>
#include <Poco/Util/ServerApplication.h>
#include <Poco/Util/XMLConfiguration.h>

#include "Admin.hpp"
#include "Auth.hpp"
#include "ClientSession.hpp"
#include <Common.hpp>
#include <Clipboard.hpp>
#include <Crypto.hpp>
#include <DelaySocket.hpp>
#include "DocumentBroker.hpp"
#include "Exceptions.hpp"
#include "FileServer.hpp"
#include <FileUtil.hpp>
#if defined KIT_IN_PROCESS || MOBILEAPP
#  include <Kit.hpp>
#endif
#include <Log.hpp>
#include <Protocol.hpp>
#include <Session.hpp>
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif
#include "Storage.hpp"
#include "TraceFile.hpp"
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include "UserMessages.hpp"
#include <Util.hpp>

#ifdef FUZZER
#  include <tools/Replay.hpp>
#endif

#include <common/SigUtil.hpp>

#include <ServerSocket.hpp>

#if MOBILEAPP
#ifdef IOS
#include "ios.h"
#elif GTKAPP
#include "gtk.hpp"
#elif defined(__ANDROID__)
#include "androidapp.hpp"
#endif
#endif

using namespace LOOLProtocol;

using Poco::DirectoryIterator;
using Poco::Exception;
using Poco::File;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Net::MessageHeader;
using Poco::Net::NameValueCollection;
using Poco::Path;
using Poco::StreamCopier;
using Poco::StringTokenizer;
using Poco::TemporaryFile;
using Poco::URI;
using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::MissingOptionException;
using Poco::Util::Option;
using Poco::Util::OptionSet;
using Poco::Util::ServerApplication;
using Poco::Util::XMLConfiguration;
using Poco::XML::AutoPtr;
using Poco::XML::DOMParser;
using Poco::XML::DOMWriter;
using Poco::XML::Element;
using Poco::XML::InputSource;
using Poco::XML::Node;
using Poco::XML::NodeList;

/// Port for external clients to connect to
int ClientPortNumber = DEFAULT_CLIENT_PORT_NUMBER;
/// Protocols to listen on
Socket::Type ClientPortProto = Socket::Type::All;

/// INET address to listen on
ServerSocket::Type ClientListenAddr = ServerSocket::Type::Public;

#if !MOBILEAPP
/// UDS address for kits to connect to.
std::string MasterLocation;
#endif

// Tracks the set of prisoners / children waiting to be used.
static std::mutex NewChildrenMutex;
static std::condition_variable NewChildrenCV;
static std::vector<std::shared_ptr<ChildProcess> > NewChildren;

static std::chrono::steady_clock::time_point LastForkRequestTime = std::chrono::steady_clock::now();
static std::atomic<int> OutstandingForks(0);
static std::map<std::string, std::shared_ptr<DocumentBroker> > DocBrokers;
static std::mutex DocBrokersMutex;

extern "C" { void dump_state(void); /* easy for gdb */ }

#if ENABLE_DEBUG
static int careerSpanMs = 0;
#endif

/// The timeout for a child to spawn, initially high, then reset to the default.
int ChildSpawnTimeoutMs = CHILD_TIMEOUT_MS * 4;
std::atomic<unsigned> LOOLWSD::NumConnections;
std::set<std::string> LOOLWSD::EditFileExtensions;

#if MOBILEAPP

// Or can this be retrieved in some other way?
int LOOLWSD::prisonerServerSocketFD;

#else

/// New LOK child processes ready to host documents.
//TODO: Move to a more sensible namespace.
static bool DisplayVersion = false;

/// Funky latency simulation basic delay (ms)
static int SimulatedLatencyMs = 0;

#endif

namespace
{

#if ENABLE_SUPPORT_KEY
inline void shutdownLimitReached(const std::shared_ptr<ProtocolHandlerInterface>& proto)
{
    const std::string error = Poco::format(PAYLOAD_UNAVAILABLE_LIMIT_REACHED, LOOLWSD::MaxDocuments, LOOLWSD::MaxConnections);
    LOG_INF("Sending client 'hardlimitreached' message: " << error);

    try
    {
        // Let the client know we are shutting down.
        proto->sendTextMessage(error.data(), error.size());

        // Shutdown.
        proto->shutdown(true, error);
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Error while shutting down socket on reaching limit: " << ex.what());
    }
}
#endif

#if !MOBILEAPP
/// Internal implementation to alert all clients
/// connected to any document.
void alertAllUsersInternal(const std::string& msg)
{
    std::lock_guard<std::mutex> docBrokersLock(DocBrokersMutex);

    LOG_INF("Alerting all users: [" << msg << "]");

    if (UnitWSD::get().filterAlertAllusers(msg))
        return;

    for (auto& brokerIt : DocBrokers)
    {
        std::shared_ptr<DocumentBroker> docBroker = brokerIt.second;
        docBroker->addCallback([msg, docBroker](){ docBroker->alertAllUsers(msg); });
    }
}
#endif

} // end anonymous namespace

void LOOLWSD::checkSessionLimitsAndWarnClients()
{
#if !ENABLE_SUPPORT_KEY
#if !MOBILEAPP
    ssize_t docBrokerCount = DocBrokers.size() - ConvertToBroker::getInstanceCount();
    if (LOOLWSD::MaxDocuments < 10000 &&
        (docBrokerCount > static_cast<ssize_t>(LOOLWSD::MaxDocuments) || LOOLWSD::NumConnections >= LOOLWSD::MaxConnections))
    {
        const std::string info = Poco::format(PAYLOAD_INFO_LIMIT_REACHED, LOOLWSD::MaxDocuments, LOOLWSD::MaxConnections);
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
#endif
}

void LOOLWSD::checkDiskSpaceAndWarnClients(const bool cacheLastCheck)
{
#if !MOBILEAPP
    try
    {
        const std::string fs = FileUtil::checkDiskSpaceOnRegisteredFileSystems(cacheLastCheck);
        if (!fs.empty())
        {
            LOG_WRN("File system of [" << fs << "] is dangerously low on disk space.");
            alertAllUsersInternal("error: cmd=internal kind=diskfull");
        }
    }
    catch (const std::exception& exc)
    {
        LOG_WRN("Exception while checking disk-space and warning clients: " << exc.what());
    }
#endif
}

/// Remove dead and idle DocBrokers.
/// The client of idle document should've greyed-out long ago.
/// Returns true if at least one is removed.
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
        Log::StreamLogger logger = Log::trace();
        if (logger.enabled())
        {
            logger << "Have " << DocBrokers.size() << " DocBrokers after cleanup.\n";
            for (auto& pair : DocBrokers)
            {
                logger << "DocumentBroker [" << pair.first << "].\n";
            }

            LOG_END(logger, true);
        }

#if !MOBILEAPP && ENABLE_DEBUG
        if (LOOLWSD::SingleKit && DocBrokers.size() == 0)
        {
            SigUtil::requestShutdown();
        }
#endif
    }
}

#if !MOBILEAPP

/// Forks as many children as requested.
/// Returns the number of children requested to spawn,
/// -1 for error.
static int forkChildren(const int number)
{
    LOG_TRC("Request forkit to spawn " << number << " new child(ren)");
    Util::assertIsLocked(NewChildrenMutex);

    if (number > 0)
    {
        LOOLWSD::checkDiskSpaceAndWarnClients(false);

#ifdef KIT_IN_PROCESS
        forkLibreOfficeKit(LOOLWSD::ChildRoot, LOOLWSD::SysTemplate, LOOLWSD::LoTemplate, LO_JAIL_SUBPATH, number);
#else
        const std::string aMessage = "spawn " + std::to_string(number) + "\n";
        LOG_DBG("MasterToForKit: " << aMessage.substr(0, aMessage.length() - 1));
        LOOLWSD::sendMessageToForKit(aMessage);
#endif
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

    return static_cast<int>(NewChildren.size()) != count;
}

/// Decides how many children need spawning and spawns.
/// Returns the number of children requested to spawn,
/// -1 for error.
static int rebalanceChildren(int balance)
{
    Util::assertIsLocked(NewChildrenMutex);

    LOG_TRC("rebalance children to " << balance);

    // Do the cleanup first.
    const bool rebalance = cleanupChildren();

    const auto duration = (std::chrono::steady_clock::now() - LastForkRequestTime);
    const std::chrono::milliseconds::rep durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
    if (OutstandingForks != 0 && durationMs >= ChildSpawnTimeoutMs)
    {
        // Children taking too long to spawn.
        // Forget we had requested any, and request anew.
        LOG_WRN("ForKit not responsive for " << durationMs << " ms forking " <<
                OutstandingForks << " children. Resetting.");
        OutstandingForks = 0;
    }

    const size_t available = NewChildren.size();
    balance -= available;
    balance -= OutstandingForks;

    if (balance > 0 && (rebalance || OutstandingForks == 0))
    {
        LOG_DBG("prespawnChildren: Have " << available << " spare " <<
                (available == 1 ? "child" : "children") << ", and " <<
                OutstandingForks << " outstanding, forking " << balance << " more.");
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
    return lock.try_lock() && (rebalanceChildren(LOOLWSD::NumPreSpawnedChildren) > 0);
}

#endif

static size_t addNewChild(const std::shared_ptr<ChildProcess>& child)
{
    std::unique_lock<std::mutex> lock(NewChildrenMutex);

    --OutstandingForks;
    // Prevent from going -ve if we have unexpected children.
    if (OutstandingForks < 0)
        ++OutstandingForks;

    LOG_TRC("Adding one child to NewChildren");
    NewChildren.emplace_back(child);
    const size_t count = NewChildren.size();
    LOG_INF("Have " << count << " spare " <<
            (count == 1 ? "child" : "children") << " after adding [" << child->getPid() << "].");
    lock.unlock();

    LOG_TRC("Notifying NewChildrenCV");
    NewChildrenCV.notify_one();
    return count;
}

#if MOBILEAPP
std::mutex LOOLWSD::lokit_main_mutex;
#endif

std::shared_ptr<ChildProcess> getNewChild_Blocks(
#if MOBILEAPP
                                                 const std::string& uri
#endif
                                                 )
{
    std::unique_lock<std::mutex> lock(NewChildrenMutex);

    const auto startTime = std::chrono::steady_clock::now();

#if !MOBILEAPP
    LOG_DBG("getNewChild: Rebalancing children.");
    int numPreSpawn = LOOLWSD::NumPreSpawnedChildren;
    ++numPreSpawn; // Replace the one we'll dispatch just now.
    if (rebalanceChildren(numPreSpawn) < 0)
    {
        LOG_DBG("getNewChild: rebalancing of children failed. Scheduling housekeeping to recover.");

        LOOLWSD::doHousekeeping();

        // Let the caller retry after a while.
        return nullptr;
    }

    // With valgrind we need extended time to spawn kits.
    const size_t timeoutMs = ChildSpawnTimeoutMs / 2;
    LOG_TRC("Waiting for a new child for a max of " << timeoutMs << " ms.");
    const auto timeout = std::chrono::milliseconds(timeoutMs);
#else
    const auto timeout = std::chrono::hours(100);

    std::thread([&]
                {
                    std::lock_guard<std::mutex> lokit_main_lock(LOOLWSD::lokit_main_mutex);
                    Util::setThreadName("lokit_main");

                    // Ugly to have that static global, otoh we know there is just one LOOLWSD
                    // object. (Even in real Online.)
                    lokit_main(uri, LOOLWSD::prisonerServerSocketFD, 1);
                }).detach();
#endif

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

        // Validate before returning.
        if (child && child->isAlive())
        {
            LOG_DBG("getNewChild: Have " << available << " spare " <<
                    (available == 1 ? "child" : "children") <<
                    " after poping [" << child->getPid() << "] to return in " <<
                    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() -
                                                                          startTime).count() << "ms.");
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

#if !MOBILEAPP

/// Handles the filename part of the convert-to POST request payload,
/// Also owns the file - cleaning it up when destroyed.
class ConvertToPartHandler : public PartHandler
{
    std::string _filename;

    /// Is it really a convert-to, ie. use an especially formed path?
    bool _convertTo;

public:
    std::string getFilename() const { return _filename; }

    /// Afterwards someone else is responsible for cleaning that up.
    void takeFile() { _filename.clear(); }

    ConvertToPartHandler(bool convertTo = false)
        : _convertTo(convertTo)
    {
    }

    virtual ~ConvertToPartHandler()
    {
        if (!_filename.empty())
        {
            LOG_TRC("Remove un-handled temporary file '" << _filename << "'");
            ConvertToBroker::removeFile(_filename);
        }
    }

    virtual void handlePart(const MessageHeader& header, std::istream& stream) override
    {
        // Extract filename and put it to a temporary directory.
        std::string disp;
        NameValueCollection params;
        if (header.has("Content-Disposition"))
        {
            std::string cd = header.get("Content-Disposition");
            MessageHeader::splitParameters(cd, disp, params);
        }

        if (!params.has("filename"))
            return;

        // FIXME: needs wrapping - until then - keep in sync with ~ConvertToBroker
        Path tempPath = Path::forDirectory(
            Poco::TemporaryFile::tempName(_convertTo ? "/tmp/convert-to" : "") + '/');
        LOG_TRC("Creating temporary convert-to path: " << tempPath.toString());
        File(tempPath).createDirectories();
        chmod(tempPath.toString().c_str(), S_IXUSR | S_IWUSR | S_IRUSR);

        // Prevent user inputting anything funny here.
        // A "filename" should always be a filename, not a path
        const Path filenameParam(params.get("filename"));
        tempPath.setFileName(filenameParam.getFileName());
        _filename = tempPath.toString();

        // Copy the stream to _filename.
        std::ofstream fileStream;
        fileStream.open(_filename);
        StreamCopier::copyStream(stream, fileStream);
        fileStream.close();
    }
};

namespace
{

#if ENABLE_DEBUG
inline std::string getLaunchBase(bool asAdmin = false)
{
    std::ostringstream oss;
    oss << "    ";
    oss << ((LOOLWSD::isSSLEnabled() || LOOLWSD::isSSLTermination()) ? "https://" : "http://");

    if (asAdmin)
    {
        auto user = LOOLWSD::getConfigValue<std::string>("admin_console.username", "");
        auto passwd = LOOLWSD::getConfigValue<std::string>("admin_console.password", "");

        if (user.empty() || passwd.empty())
            return "";

        oss << user << ":" << passwd << "@";
    }

    oss << LOOLWSD_TEST_HOST ":";
    oss << ClientPortNumber;

    return oss.str();
}

inline std::string getLaunchURI(const std::string &document)
{
    std::ostringstream oss;

    oss << getLaunchBase();
    oss << LOOLWSD::ServiceRoot;
    oss << LOOLWSD_TEST_LOLEAFLET_UI;
    oss << "?file_path=file://";
    oss << DEBUG_ABSSRCDIR "/";
    oss << document;

    return oss.str();
}

inline std::string getServiceURI(const std::string &sub, bool asAdmin = false)
{
    std::ostringstream oss;

    oss << getLaunchBase(asAdmin);
    oss << LOOLWSD::ServiceRoot;
    oss << sub;

    return oss.str();
}

#endif

} // anonymous namespace

#endif // MOBILEAPP

std::atomic<uint64_t> LOOLWSD::NextConnectionId(1);

#ifndef KIT_IN_PROCESS
std::atomic<int> LOOLWSD::ForKitProcId(-1);
std::shared_ptr<ForKitProcess> LOOLWSD::ForKitProc;
#endif
#if !MOBILEAPP
bool LOOLWSD::NoCapsForKit = false;
bool LOOLWSD::NoSeccomp = false;
bool LOOLWSD::AdminEnabled = true;
#if ENABLE_DEBUG
bool LOOLWSD::SingleKit = false;
#endif
#endif
#ifdef FUZZER
bool LOOLWSD::DummyLOK = false;
std::string LOOLWSD::FuzzFileName;
#endif
std::string LOOLWSD::SysTemplate;
std::string LOOLWSD::LoTemplate;
std::string LOOLWSD::ChildRoot;
std::string LOOLWSD::ServerName;
std::string LOOLWSD::FileServerRoot;
std::string LOOLWSD::WelcomeFilesRoot;
std::string LOOLWSD::ServiceRoot;
std::string LOOLWSD::LOKitVersion;
std::string LOOLWSD::HostIdentifier;
std::string LOOLWSD::ConfigFile = LOOLWSD_CONFIGDIR "/loolwsd.xml";
std::string LOOLWSD::ConfigDir = LOOLWSD_CONFIGDIR "/conf.d";
std::string LOOLWSD::LogLevel = "trace";
bool LOOLWSD::AnonymizeUserData = false;
#if ENABLE_SSL
Util::RuntimeConstant<bool> LOOLWSD::SSLEnabled;
Util::RuntimeConstant<bool> LOOLWSD::SSLTermination;
#endif
unsigned LOOLWSD::MaxConnections;
unsigned LOOLWSD::MaxDocuments;
std::string LOOLWSD::OverrideWatermark;
std::set<const Poco::Util::AbstractConfiguration*> LOOLWSD::PluginConfigurations;
std::chrono::time_point<std::chrono::system_clock> LOOLWSD::StartTime;

static std::string UnitTestLibrary;

unsigned int LOOLWSD::NumPreSpawnedChildren = 0;
std::unique_ptr<TraceFileWriter> LOOLWSD::TraceDumper;
#if !MOBILEAPP
std::unique_ptr<ClipboardCache> LOOLWSD::SavedClipboards;
#endif

/// This thread polls basic web serving, and handling of
/// websockets before upgrade: when upgraded they go to the
/// relevant DocumentBroker poll instead.
TerminatingPoll WebServerPoll("websrv_poll");

class PrisonerPoll : public TerminatingPoll {
public:
    PrisonerPoll() : TerminatingPoll("prisoner_poll") {}

    /// Check prisoners are still alive and balanced.
    void wakeupHook() override;

    // Resets the forkit porcess object
    void setForKitProcess(const std::weak_ptr<ForKitProcess>& forKitProc)
    {
        assertCorrectThread();
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
            addCallback([=]{
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
};

/// This thread listens for and accepts prisoner kit processes.
/// And also cleans up and balances the correct number of children.
PrisonerPoll PrisonerPoll;

/// Helper class to hold default configuration entries.
class AppConfigMap final : public Poco::Util::MapConfiguration
{
public:
    AppConfigMap(const std::map<std::string, std::string>& map)
    {
        for (const auto& pair : map)
        {
            setRaw(pair.first, pair.second);
        }
    }
};

void ForKitProcWSHandler::handleMessage(const std::vector<char> &data)
{
    LOG_TRC("ForKitProcWSHandler: handling incoming [" << LOOLProtocol::getAbbreviatedMessage(&data[0], data.size()) << "].");
    const std::string firstLine = LOOLProtocol::getFirstLine(&data[0], data.size());
    const StringVector tokens = LOOLProtocol::tokenize(firstLine.data(), firstLine.size());

    if (tokens.equals(0, "segfaultcount"))
    {
        int count = std::stoi(tokens[1]);
        if (count >= 0)
        {
#if !MOBILEAPP
            Admin::instance().addSegFaultCount(count);
#endif
            LOG_INF(count << " loolkit processes crashed with segmentation fault.");
        }
        else
        {
            LOG_WRN("Invalid 'segfaultcount' message received.");
        }
    }
    else
    {
        LOG_ERR("ForKitProcWSHandler: unknown command: " << tokens[0]);
    }
}

LOOLWSD::LOOLWSD()
{
}

LOOLWSD::~LOOLWSD()
{
}

void LOOLWSD::initialize(Application& self)
{
#if !MOBILEAPP
    if (geteuid() == 0)
    {
        throw std::runtime_error("Do not run as root. Please run as lool user.");
    }
#endif

    if (!UnitWSD::init(UnitWSD::UnitType::Wsd, UnitTestLibrary))
    {
        throw std::runtime_error("Failed to load wsd unit test library.");
    }

    StartTime = std::chrono::system_clock::now();

    auto& conf = config();

    // Add default values of new entries here.
    static const std::map<std::string, std::string> DefAppConfig
        = { { "allowed_languages", "de_DE en_GB en_US es_ES fr_FR it nl pt_BR pt_PT ru" },
            { "admin_console.enable_pam", "false" },
            { "child_root_path", "jails" },
            { "file_server_root_path", "loleaflet/.." },
            { "lo_jail_subpath", "lo" },
            { "logging.protocol", "false" },
            { "logging.anonymize.filenames", "false" }, // Deprecated.
            { "logging.anonymize.usernames", "false" }, // Deprecated.
            // { "logging.anonymize.anonymize_user_data", "false" }, // Do not set to fallback on filename/username.
            { "logging.color", "true" },
            { "logging.file.property[0]", "loolwsd.log" },
            { "logging.file.property[0][@name]", "path" },
            { "logging.file.property[1]", "never" },
            { "logging.file.property[1][@name]", "rotation" },
            { "logging.file.property[2]", "true" },
            { "logging.file.property[2][@name]", "compress" },
            { "logging.file.property[3]", "false" },
            { "logging.file.property[3][@name]", "flush" },
            { "logging.file.property[4]", "10 days" },
            { "logging.file.property[4][@name]", "purgeAge" },
            { "logging.file.property[5]", "10" },
            { "logging.file.property[5][@name]", "purgeCount" },
            { "logging.file.property[6]", "true" },
            { "logging.file.property[6][@name]", "rotationOnOpen" },
            { "logging.file.property[7]", "false" },
            { "logging.file.property[7][@name]", "archive" },
            { "logging.file[@enable]", "false" },
            { "logging.level", "trace" },
            { "loleaflet_html", "loleaflet.html" },
            { "loleaflet_logging", "false" },
            { "net.listen", "any" },
            { "net.proto", "all" },
            { "net.service_root", "" },
            { "num_prespawn_children", "1" },
            { "per_document.always_save_on_exit", "false" },
            { "per_document.autosave_duration_secs", "300" },
            { "per_document.document_signing_url", VEREIGN_URL },
            { "per_document.idle_timeout_secs", "3600" },
            { "per_document.idlesave_duration_secs", "30" },
            { "per_document.limit_file_size_mb", "0" },
            { "per_document.limit_num_open_files", "0" },
            { "per_document.limit_load_secs", "100" },
            { "per_document.limit_convert_secs", "100" },
            { "per_document.limit_stack_mem_kb", "8000" },
            { "per_document.limit_virt_mem_mb", "0" },
            { "per_document.max_concurrency", "4" },
            { "per_document.redlining_as_comments", "false" },
            { "per_view.idle_timeout_secs", "900" },
            { "per_view.out_of_focus_timeout_secs", "120" },
            { "security.capabilities", "true" },
            { "security.seccomp", "true" },
            { "server_name", "" },
            { "ssl.ca_file_path", LOOLWSD_CONFIGDIR "/ca-chain.cert.pem" },
            { "ssl.cert_file_path", LOOLWSD_CONFIGDIR "/cert.pem" },
            { "ssl.enable", "true" },
            { "ssl.hpkp.max_age[@enable]", "true" },
            { "ssl.hpkp.report_uri[@enable]", "false" },
            { "ssl.hpkp[@enable]", "false" },
            { "ssl.hpkp[@report_only]", "false" },
            { "ssl.key_file_path", LOOLWSD_CONFIGDIR "/key.pem" },
            { "ssl.termination", "true" },
            { "storage.filesystem[@allow]", "false" },
//            "storage.ssl.enable" - deliberately not set; for back-compat
            { "storage.webdav[@allow]", "false" },
            { "storage.wopi.host[0]", "localhost" },
            { "storage.wopi.host[0][@allow]", "true" },
            { "storage.wopi.max_file_size", "0" },
            { "storage.wopi[@allow]", "true" },
            { "storage.wopi.locking.refresh", "900" },
            { "sys_template_path", "systemplate" },
            { "trace.path[@compress]", "true" },
            { "trace.path[@snapshot]", "false" },
            { "trace[@enable]", "false" },
            { "welcome.enable", "true" },
            { "welcome.path", "loleaflet/welcome" }
          };

    // Set default values, in case they are missing from the config file.
    AutoPtr<AppConfigMap> defConfig(new AppConfigMap(DefAppConfig));
    conf.addWriteable(defConfig, PRIO_SYSTEM); // Lowest priority

#if !MOBILEAPP

    // Load default configuration files, if present.
    if (loadConfiguration(PRIO_DEFAULT) == 0)
    {
        // Fallback to the LOOLWSD_CONFIGDIR or --config-file path.
        loadConfiguration(ConfigFile, PRIO_DEFAULT);
    }

    // Load extra ("plug-in") configuration files, if present
    File dir(ConfigDir);
    if (dir.exists() && dir.isDirectory())
    {
        for (auto configFileIterator = DirectoryIterator(dir); configFileIterator != DirectoryIterator(); ++configFileIterator)
        {
            // Only accept configuration files ending in .xml
            const std::string configFile = configFileIterator.path().getFileName();
            if (configFile.length() > 4 && strcasecmp(configFile.substr(configFile.length() - 4).data(), ".xml") == 0)
            {
                const std::string fullFileName = dir.path() + "/" + configFile;
                PluginConfigurations.insert(new XMLConfiguration(fullFileName));
            }
        }
    }

    // Override any settings passed on the command-line.
    AutoPtr<AppConfigMap> overrideConfig(new AppConfigMap(_overrideSettings));
    conf.addWriteable(overrideConfig, PRIO_APPLICATION); // Highest priority

    // Allow UT to manipulate before using configuration values.
    UnitWSD::get().configure(config());

    // Set the log-level after complete initialization to force maximum details at startup.
    LogLevel = getConfigValue<std::string>(conf, "logging.level", "trace");
    setenv("LOOL_LOGLEVEL", LogLevel.c_str(), true);
    const bool withColor = getConfigValue<bool>(conf, "logging.color", true) && isatty(fileno(stderr));
    if (withColor)
    {
        setenv("LOOL_LOGCOLOR", "1", true);
    }

    const auto logToFile = getConfigValue<bool>(conf, "logging.file[@enable]", false);
    std::map<std::string, std::string> logProperties;
    for (std::size_t i = 0; ; ++i)
    {
        const std::string confPath = "logging.file.property[" + std::to_string(i) + "]";
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
        setenv("LOOL_LOGFILE", "1", true);
        const auto it = logProperties.find("path");
        if (it != logProperties.end())
        {
            setenv("LOOL_LOGFILENAME", it->second.c_str(), true);
#if ENABLE_DEBUG
            std::cerr << "\nFull log is available in: " << it->second.c_str() << std::endl;
#endif
        }
    }

    // Log at trace level until we complete the initialization.
    Log::initialize("wsd", "trace", withColor, logToFile, logProperties);
    if (LogLevel != "trace")
    {
        LOG_INF("Setting log-level to [trace] and delaying setting to configured [" << LogLevel << "] until after WSD initialization.");
    }

    // Get anonymization settings.
#if LOOLWSD_ANONYMIZE_USER_DATA
    AnonymizeUserData = true;
    LOG_INF("Anonymization of user-data is permanently enabled.");
#else
    LOG_INF("Anonymization of user-data is configurable.");
    bool haveAnonymizeUserDataConfig = false;
    if (getSafeConfig(conf, "logging.anonymize.anonymize_user_data", AnonymizeUserData))
        haveAnonymizeUserDataConfig = true;

    bool anonymizeFilenames = false;
    bool anonymizeUsernames = false;
    if (getSafeConfig(conf, "logging.anonymize.usernames", anonymizeFilenames) ||
        getSafeConfig(conf, "logging.anonymize.filenames", anonymizeUsernames))
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

    if (AnonymizeUserData && LogLevel == "trace")
    {
        if (getConfigValue<bool>(conf, "logging.anonymize.allow_logging_user_data", false))
        {
            LOG_WRN("Enabling trace logging while anonymization is enabled due to logging.anonymize.allow_logging_user_data setting. "
                    "This will leak user-data!");

            // Disable anonymization as it's useless now.
            AnonymizeUserData = false;
        }
        else
        {
            static const char failure[] = "Anonymization and trace-level logging are incompatible. "
                "Please reduce logging level to debug or lower in loolwsd.xml to prevent leaking sensitive user data.";
            LOG_FTL(failure);
            std::cerr << '\n' << failure << std::endl;
#if ENABLE_DEBUG
            std::cerr << "\nIf you have used 'make run', edit loolwsd.xml and make sure you have removed "
                         "'--o:logging.level=trace' from the command line in Makefile.am.\n" << std::endl;
#endif
            Log::shutdown();
            _exit(EX_SOFTWARE);
        }
    }

    std::uint64_t anonymizationSalt = 82589933;
    LOG_INF("Anonymization of user-data is " << (AnonymizeUserData ? "enabled." : "disabled."));
    if (AnonymizeUserData)
    {
        // Get the salt, if set, otherwise default, and set as envar, so the kits inherit it.
        anonymizationSalt = getConfigValue<std::uint64_t>(conf, "logging.anonymize.anonymization_salt", 82589933);
        const std::string anonymizationSaltStr = std::to_string(anonymizationSalt);
        setenv("LOOL_ANONYMIZATION_SALT", anonymizationSaltStr.c_str(), true);
    }
    FileUtil::setUrlAnonymization(AnonymizeUserData, anonymizationSalt);

    {
        std::string proto = getConfigValue<std::string>(conf, "net.proto", "");
        if (!Poco::icompare(proto, "ipv4"))
            ClientPortProto = Socket::Type::IPv4;
        else if (!Poco::icompare(proto, "ipv6"))
            ClientPortProto = Socket::Type::IPv6;
        else if (!Poco::icompare(proto, "all"))
            ClientPortProto = Socket::Type::All;
        else
            LOG_WRN("Invalid protocol: " << proto);
    }

    {
        std::string listen = getConfigValue<std::string>(conf, "net.listen", "");
        if (!Poco::icompare(listen, "any"))
            ClientListenAddr = ServerSocket::Type::Public;
        else if (!Poco::icompare(listen, "loopback"))
            ClientListenAddr = ServerSocket::Type::Local;
        else
            LOG_WRN("Invalid listen address: " << listen << ". Falling back to default: 'any'" );
    }

    // Prefix for the loolwsd pages; should not end with a '/'
    ServiceRoot = getPathFromConfig("net.service_root");
    while (ServiceRoot.length() > 0 && ServiceRoot[ServiceRoot.length() - 1] == '/')
        ServiceRoot.pop_back();

#if ENABLE_SSL
    LOOLWSD::SSLEnabled.set(getConfigValue<bool>(conf, "ssl.enable", true));
#endif

    if (LOOLWSD::isSSLEnabled())
    {
        LOG_INF("SSL support: SSL is enabled.");
    }
    else
    {
        LOG_WRN("SSL support: SSL is disabled.");
    }

#if ENABLE_SSL
    LOOLWSD::SSLTermination.set(getConfigValue<bool>(conf, "ssl.termination", true));
#endif

    std::string allowedLanguages(config().getString("allowed_languages"));
    setenv("LOK_WHITELIST_LANGUAGES", allowedLanguages.c_str(), 1);

#endif

    SysTemplate = getPathFromConfig("sys_template_path");
    LoTemplate = LO_PATH;
    ChildRoot = getPathFromConfig("child_root_path");
    ServerName = config().getString("server_name");

    LOG_DBG("FileServerRoot before config: " << FileServerRoot);
    FileServerRoot = getPathFromConfig("file_server_root_path");
    LOG_DBG("FileServerRoot after config: " << FileServerRoot);

    WelcomeFilesRoot = getPathFromConfig("welcome.path");
    if (!getConfigValue<bool>(conf, "welcome.enable", true))
        WelcomeFilesRoot = "";

    NumPreSpawnedChildren = getConfigValue<int>(conf, "num_prespawn_children", 1);
    if (NumPreSpawnedChildren < 1)
    {
        LOG_WRN("Invalid num_prespawn_children in config (" << NumPreSpawnedChildren << "). Resetting to 1.");
        NumPreSpawnedChildren = 1;
    }
    LOG_INF("NumPreSpawnedChildren set to " << NumPreSpawnedChildren << ".");

#if !MOBILEAPP
    const auto maxConcurrency = getConfigValue<int>(conf, "per_document.max_concurrency", 4);
    if (maxConcurrency > 0)
    {
        setenv("MAX_CONCURRENCY", std::to_string(maxConcurrency).c_str(), 1);
    }
    LOG_INF("MAX_CONCURRENCY set to " << maxConcurrency << ".");
#endif

    const auto redlining = getConfigValue<bool>(conf, "per_document.redlining_as_comments", false);
    if (!redlining)
    {
        setenv("DISABLE_REDLINE", "1", 1);
        LOG_INF("DISABLE_REDLINE set");
    }

    // Otherwise we profile the soft-device at jail creation time.
    setenv("SAL_DISABLE_OPENCL", "true", 1);

    // Log the connection and document limits.
    LOOLWSD::MaxConnections = MAX_CONNECTIONS;
    LOOLWSD::MaxDocuments = MAX_DOCUMENTS;

#if !MOBILEAPP
    NoSeccomp = !getConfigValue<bool>(conf, "security.seccomp", true);
    NoCapsForKit = !getConfigValue<bool>(conf, "security.capabilities", true);
    AdminEnabled = getConfigValue<bool>(conf, "admin_console.enable", true);
#endif

#if ENABLE_SUPPORT_KEY
    const std::string supportKeyString = getConfigValue<std::string>(conf, "support_key", "");

    if (supportKeyString.empty())
    {
        LOG_WRN("Support key not set, please use 'loolconfig set-support-key'.");
        std::cerr << "Support key not set, please use 'loolconfig set-support-key'." << std::endl;
        LOOLWSD::OverrideWatermark = "Unsupported, the support key is missing.";
    }
    else
    {
        SupportKey key(supportKeyString);

        if (!key.verify())
        {
            LOG_WRN("Invalid support key, please use 'loolconfig set-support-key'.");
            std::cerr << "Invalid support key, please use 'loolconfig set-support-key'." << std::endl;
            LOOLWSD::OverrideWatermark = "Unsupported, the support key is invalid.";
        }
        else
        {
            int validDays =  key.validDaysRemaining();
            if (validDays <= 0)
            {
                LOG_WRN("Your support key has expired, please ask for a new one, and use 'loolconfig set-support-key'.");
                std::cerr << "Your support key has expired, please ask for a new one, and use 'loolconfig set-support-key'." << std::endl;
                LOOLWSD::OverrideWatermark = "Unsupported, the support key has expired.";
            }
            else
            {
                LOG_INF("Your support key is valid for " << validDays << " days");
                LOOLWSD::MaxConnections = 1000;
                LOOLWSD::MaxDocuments = 200;
                LOOLWSD::OverrideWatermark = "";
            }
        }
    }
#endif

    if (LOOLWSD::MaxConnections < 3)
    {
        LOG_ERR("MAX_CONNECTIONS must be at least 3");
        LOOLWSD::MaxConnections = 3;
    }

    if (LOOLWSD::MaxDocuments > LOOLWSD::MaxConnections)
    {
        LOG_ERR("MAX_DOCUMENTS cannot be bigger than MAX_CONNECTIONS");
        LOOLWSD::MaxDocuments = LOOLWSD::MaxConnections;
    }

    LOG_INF("Maximum concurrent open Documents limit: " << LOOLWSD::MaxDocuments);
    LOG_INF("Maximum concurrent client Connections limit: " << LOOLWSD::MaxConnections);

    LOOLWSD::NumConnections = 0;

    // Command Tracing.
    if (getConfigValue<bool>(conf, "trace[@enable]", false))
    {
        const auto& path = getConfigValue<std::string>(conf, "trace.path", "");
        const auto recordOutgoing = getConfigValue<bool>(conf, "trace.outgoing.record", false);
        std::vector<std::string> filters;
        for (size_t i = 0; ; ++i)
        {
            const std::string confPath = "trace.filter.message[" + std::to_string(i) + "]";
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

        const auto compress = getConfigValue<bool>(conf, "trace.path[@compress]", false);
        const auto takeSnapshot = getConfigValue<bool>(conf, "trace.path[@snapshot]", false);
        TraceDumper.reset(new TraceFileWriter(path, recordOutgoing, compress, takeSnapshot, filters));
    }

#if !MOBILEAPP
    SavedClipboards.reset(new ClipboardCache());

    FileServerRequestHandler::initialize();
#endif

    StorageBase::initialize();

#if !MOBILEAPP
    ServerApplication::initialize(self);

    DocProcSettings docProcSettings;
    docProcSettings.setLimitVirtMemMb(getConfigValue<int>("per_document.limit_virt_mem_mb", 0));
    docProcSettings.setLimitStackMemKb(getConfigValue<int>("per_document.limit_stack_mem_kb", 0));
    docProcSettings.setLimitFileSizeMb(getConfigValue<int>("per_document.limit_file_size_mb", 0));
    docProcSettings.setLimitNumberOpenFiles(getConfigValue<int>("per_document.limit_num_open_files", 0));
    Admin::instance().setDefDocProcSettings(docProcSettings, false);

#if ENABLE_DEBUG
    std::string postMessageURI =
        getServiceURI("/loleaflet/dist/framed.doc.html?file_path="
                      DEBUG_ABSSRCDIR "/" LOOLWSD_TEST_DOCUMENT_RELATIVE_PATH_CALC);
    std::cerr << "\nLaunch one of these in your browser:\n\n"
              << "    Writer:      " << getLaunchURI(LOOLWSD_TEST_DOCUMENT_RELATIVE_PATH_WRITER) << '\n'
              << "    Calc:        " << getLaunchURI(LOOLWSD_TEST_DOCUMENT_RELATIVE_PATH_CALC) << '\n'
              << "    Impress:     " << getLaunchURI(LOOLWSD_TEST_DOCUMENT_RELATIVE_PATH_IMPRESS) << '\n'
              << "    postMessage: " << postMessageURI << std::endl;

    const std::string adminURI = getServiceURI(LOOLWSD_TEST_ADMIN_CONSOLE, true);
    if (!adminURI.empty())
        std::cerr << "\nOr for the admin, monitoring, capabilities & discovery:\n\n"
                  << adminURI << "\n"
                  << getServiceURI(LOOLWSD_TEST_METRICS, true) << "\n"
                  << getServiceURI("/hosting/capabilities") << "\n"
                  << getServiceURI("/hosting/discovery") << "\n";

    std::cerr << std::endl;
#endif

#endif
}

void LOOLWSD::initializeSSL()
{
#if ENABLE_SSL
    if (!LOOLWSD::isSSLEnabled())
        return;

    const std::string ssl_cert_file_path = getPathFromConfig("ssl.cert_file_path");
    LOG_INF("SSL Cert file: " << ssl_cert_file_path);

    const std::string ssl_key_file_path = getPathFromConfig("ssl.key_file_path");
    LOG_INF("SSL Key file: " << ssl_key_file_path);

    const std::string ssl_ca_file_path = getPathFromConfig("ssl.ca_file_path");
    LOG_INF("SSL CA file: " << ssl_ca_file_path);

    std::string ssl_cipher_list = config().getString("ssl.cipher_list", "");
    if (ssl_cipher_list.empty())
            ssl_cipher_list = DEFAULT_CIPHER_SET;
    LOG_INF("SSL Cipher list: " << ssl_cipher_list);

    // Initialize the non-blocking socket SSL.
    SslContext::initialize(ssl_cert_file_path,
                           ssl_key_file_path,
                           ssl_ca_file_path,
                           ssl_cipher_list);
#endif
}

void LOOLWSD::dumpNewSessionTrace(const std::string& id, const std::string& sessionId, const std::string& uri, const std::string& path)
{
    if (TraceDumper)
    {
        try
        {
            TraceDumper->newSession(id, sessionId, uri, path);
        }
        catch (const std::exception& exc)
        {
            LOG_WRN("Exception in tracer newSession: " << exc.what());
        }
    }
}

void LOOLWSD::dumpEndSessionTrace(const std::string& id, const std::string& sessionId, const std::string& uri)
{
    if (TraceDumper)
    {
        try
        {
            TraceDumper->endSession(id, sessionId, uri);
        }
        catch (const std::exception& exc)
        {
            LOG_WRN("Exception in tracer newSession: " << exc.what());
        }
    }
}

void LOOLWSD::dumpEventTrace(const std::string& id, const std::string& sessionId, const std::string& data)
{
    if (TraceDumper)
    {
        TraceDumper->writeEvent(id, sessionId, data);
    }
}

void LOOLWSD::dumpIncomingTrace(const std::string& id, const std::string& sessionId, const std::string& data)
{
    if (TraceDumper)
    {
        TraceDumper->writeIncoming(id, sessionId, data);
    }
}

void LOOLWSD::dumpOutgoingTrace(const std::string& id, const std::string& sessionId, const std::string& data)
{
    if (TraceDumper)
    {
        TraceDumper->writeOutgoing(id, sessionId, data);
    }
}

void LOOLWSD::defineOptions(OptionSet& optionSet)
{
#if !MOBILEAPP
    ServerApplication::defineOptions(optionSet);

    optionSet.addOption(Option("help", "", "Display help information on command line arguments.")
                        .required(false)
                        .repeatable(false));

    optionSet.addOption(Option("version", "", "Display version information.")
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
#endif

#ifdef FUZZER
    optionSet.addOption(Option("dummy-lok", "", "Use empty (dummy) LibreOfficeKit implementation instead a real LibreOffice.")
                        .required(false)
                        .repeatable(false));
    optionSet.addOption(Option("fuzz", "", "Read input from the specified file for fuzzing.")
                        .required(false)
                        .repeatable(false)
                        .argument("trace_file_name"));
#endif
#endif
}

void LOOLWSD::handleOption(const std::string& optionName,
                           const std::string& value)
{
#if !MOBILEAPP
    ServerApplication::handleOption(optionName, value);

    if (optionName == "help")
    {
        displayHelp();
        std::exit(EX_OK);
    }
    else if (optionName == "version")
        DisplayVersion = true;
    else if (optionName == "port")
        ClientPortNumber = std::stoi(value);
    else if (optionName == "disable-ssl")
        _overrideSettings["ssl.enable"] = "false";
    else if (optionName == "override")
    {
        std::string optName;
        std::string optValue;
        LOOLProtocol::parseNameValuePair(value, optName, optValue);
        _overrideSettings[optName] = optValue;
    }
    else if (optionName == "config-file")
        ConfigFile = value;
    else if (optionName == "config-dir")
        ConfigDir = value;
#if ENABLE_DEBUG
    else if (optionName == "unitlib")
        UnitTestLibrary = value;
    else if (optionName == "careerspan")
        careerSpanMs = std::stoi(value) * 1000; // Convert second to ms
    else if (optionName == "singlekit")
    {
        SingleKit = true;
        NumPreSpawnedChildren = 1;
    }

    static const char* latencyMs = std::getenv("LOOL_DELAY_SOCKET_MS");
    if (latencyMs)
        SimulatedLatencyMs = std::stoi(latencyMs);
#endif

#ifdef FUZZER
    if (optionName == "dummy-lok")
        DummyLOK = true;
    else if (optionName == "fuzz")
        FuzzFileName = value;
#endif
#endif
}

#if !MOBILEAPP

void LOOLWSD::displayHelp()
{
    HelpFormatter helpFormatter(options());
    helpFormatter.setCommand(commandName());
    helpFormatter.setUsage("OPTIONS");
    helpFormatter.setHeader("LibreOffice Online WebSocket server.");
    helpFormatter.format(std::cout);
}

bool LOOLWSD::checkAndRestoreForKit()
{
#ifdef KIT_IN_PROCESS
    return false;
#else

    if (ForKitProcId == -1)
    {
        // Fire the ForKit process for the first time.
        if (!SigUtil::getShutdownRequestFlag() && !SigUtil::getTerminationFlag() && !createForKit())
        {
            // Should never fail.
            LOG_FTL("Failed to spawn loolforkit.");
            SigUtil::requestShutdown();
        }
    }

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
                            WEXITSTATUS(status) << ".");
                }
                else
                {
                    LOG_ERR("Forkit process [" << pid << "] " <<
                            (WCOREDUMP(status) ? "core-dumped" : "died") <<
                            " with " << SigUtil::signalName(WTERMSIG(status)));
                }

                // Spawn a new forkit and try to dust it off and resume.
                if (!SigUtil::getShutdownRequestFlag() && !SigUtil::getTerminationFlag() && !createForKit())
                {
                    LOG_FTL("Failed to spawn forkit instance. Shutting down.");
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
                LOG_WRN("Unknown status returned by waitpid: " << std::hex << status << ".");
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
        LOG_SYS("Forkit waitpid failed.");
        if (errno == ECHILD)
        {
            // No child processes.
            // Spawn a new forkit and try to dust it off and resume.
            if (!SigUtil::getShutdownRequestFlag() && !SigUtil::getTerminationFlag() && !createForKit())
            {
                LOG_FTL("Failed to spawn forkit instance. Shutting down.");
                SigUtil::requestShutdown();
            }
        }

        return true;
    }

    return false;
#endif
}

#endif

void LOOLWSD::doHousekeeping()
{
    PrisonerPoll.wakeup();
}

void LOOLWSD::closeDocument(const std::string& docKey, const std::string& message)
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

void LOOLWSD::autoSave(const std::string& docKey)
{
    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
    auto docBrokerIt = DocBrokers.find(docKey);
    if (docBrokerIt != DocBrokers.end())
    {
        std::shared_ptr<DocumentBroker> docBroker = docBrokerIt->second;
        docBroker->addCallback([docBroker]() {
                docBroker->autoSave(true);
            });
    }
}

/// Really do the house-keeping
void PrisonerPoll::wakeupHook()
{
#if !MOBILEAPP
    LOG_TRC("PrisonerPoll - wakes up with " << NewChildren.size() <<
            " new children and " << DocBrokers.size() << " brokers and " <<
            OutstandingForks << " kits forking");

    if (!LOOLWSD::checkAndRestoreForKit())
    {
        // No children have died.
        // Make sure we have sufficient reserves.
        if (prespawnChildren())
        {
            // Nothing more to do this round, unless we are fuzzing
#if FUZZER
            if (!LOOLWSD::FuzzFileName.empty())
            {
                std::unique_ptr<Replay> replay(new Replay(
#if ENABLE_SSL
                        "https://127.0.0.1:" + std::to_string(ClientPortNumber),
#else
                        "http://127.0.0.1:" + std::to_string(ClientPortNumber),
#endif
                        LOOLWSD::FuzzFileName));

                std::thread replayThread([&replay]{ replay->run(); });

                // block until the replay finishes
                replayThread.join();

                LOG_INF("Setting TerminationFlag");
                SigUtil::setTerminationFlag();
            }
#endif
        }
    }
#endif
    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex, std::defer_lock);
    if (docBrokersLock.try_lock())
        cleanupDocBrokers();
}

#if !MOBILEAPP

bool LOOLWSD::createForKit()
{
#if defined KIT_IN_PROCESS
    return true;
#else
    LOG_INF("Creating new forkit process.");

    std::unique_lock<std::mutex> newChildrenLock(NewChildrenMutex);

    StringVector args;
#ifdef STRACE_LOOLFORKIT
    // if you want to use this, you need to setcap cap_fowner,cap_mknod,cap_sys_chroot=ep /usr/bin/strace
    args.push_back("-o");
    args.push_back("strace.log");
    args.push_back("-f");
    args.push_back("-tt");
    args.push_back("-s");
    args.push_back("256");
    args.push_back(Path(Application::instance().commandPath()).parent().toString() + "loolforkit");
#endif
    args.push_back("--losubpath=" + std::string(LO_JAIL_SUBPATH));
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

    if (DisplayVersion)
        args.push_back("--version");

    if (NoCapsForKit)
        args.push_back("--nocaps");

    if (NoSeccomp)
        args.push_back("--noseccomp");

#if ENABLE_DEBUG
    if (SingleKit)
        args.push_back("--singlekit");
#endif

#ifdef STRACE_LOOLFORKIT
    std::string forKitPath = "strace";
#else
    std::string forKitPath = Path(Application::instance().commandPath()).parent().toString() + "loolforkit";
#endif

    // Always reap first, in case we haven't done so yet.
    if (ForKitProcId != -1)
    {
        int status;
        waitpid(ForKitProcId, &status, WUNTRACED | WNOHANG);
        ForKitProcId = -1;
        Admin::instance().setForKitPid(ForKitProcId);
    }

    // Below line will be executed by PrisonerPoll thread.
    ForKitProc = nullptr;
    PrisonerPoll.setForKitProcess(ForKitProc);
    
    // ForKit always spawns one.
    ++OutstandingForks;

    LOG_INF("Launching forkit process: " << forKitPath << ' ' <<
            args.cat(std::string(" "), 0));

    LastForkRequestTime = std::chrono::steady_clock::now();
    int child = Util::spawnProcess(forKitPath, args);
    ForKitProcId = child;

    LOG_INF("Forkit process launched: " << ForKitProcId);

    // Init the Admin manager
    Admin::instance().setForKitPid(ForKitProcId);

    const int balance = LOOLWSD::NumPreSpawnedChildren - OutstandingForks;
    if (balance > 0)
        rebalanceChildren(balance);

    return ForKitProcId != -1;
#endif
}

void LOOLWSD::sendMessageToForKit(const std::string& message)
{
    PrisonerPoll.sendMessageToForKit(message);
}

#endif // !MOBILEAPP

#ifdef FUZZER
std::mutex Connection::Mutex;
#endif

/// Find the DocumentBroker for the given docKey, if one exists.
/// Otherwise, creates and adds a new one to DocBrokers.
/// May return null if terminating or MaxDocuments limit is reached.
/// After returning a valid instance DocBrokers must be cleaned up after exceptions.
static std::shared_ptr<DocumentBroker>
    findOrCreateDocBroker(const std::shared_ptr<ProtocolHandlerInterface>& proto,
                          const std::string& uri,
                          const std::string& docKey,
                          const std::string& id,
                          const Poco::URI& uriPublic)
{
    LOG_INF("Find or create DocBroker for docKey [" << docKey <<
            "] for session [" << id << "] on url [" << LOOLWSD::anonymizeUrl(uriPublic.toString()) << "].");

    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);

    cleanupDocBrokers();

    if (SigUtil::getTerminationFlag())
    {
        LOG_ERR("TerminationFlag set. Not loading new session [" << id << "]");
        return nullptr;
    }

    std::shared_ptr<DocumentBroker> docBroker;

    // Lookup this document.
    const auto it = DocBrokers.find(docKey);
    if (it != DocBrokers.end() && it->second)
    {
        // Get the DocumentBroker from the Cache.
        LOG_DBG("Found DocumentBroker with docKey [" << docKey << "].");
        docBroker = it->second;

        // Destroying the document? Let the client reconnect.
        if (docBroker->isMarkedToDestroy())
        {
            LOG_WRN("DocBroker with docKey [" << docKey << "] that is marked to be destroyed. Rejecting client request.");
            std::string msg("error: cmd=load kind=docunloading");
            proto->sendTextMessage(msg.data(), msg.size());
            proto->shutdown(true, "error: cmd=load kind=docunloading");
            return nullptr;
        }
    }
    else
    {
        LOG_DBG("No DocumentBroker with docKey [" << docKey << "] found. New Child and Document.");
    }

    if (SigUtil::getTerminationFlag())
    {
        LOG_ERR("TerminationFlag is set. Not loading new session [" << id << "]");
        return nullptr;
    }

    // Indicate to the client that we're connecting to the docbroker.
    const std::string statusConnect = "statusindicator: connect";
    LOG_TRC("Sending to Client [" << statusConnect << "].");
    proto->sendTextMessage(statusConnect.data(), statusConnect.size());

    if (!docBroker)
    {
        Util::assertIsLocked(DocBrokersMutex);

        if (DocBrokers.size() + 1 > LOOLWSD::MaxDocuments)
        {
            LOG_INF("Maximum number of open documents of " << LOOLWSD::MaxDocuments << " reached.");
#if ENABLE_SUPPORT_KEY
            shutdownLimitReached(proto);
            return nullptr;
#endif
        }

        // Set the one we just created.
        LOG_DBG("New DocumentBroker for docKey [" << docKey << "].");
        docBroker = std::make_shared<DocumentBroker>(uri, uriPublic, docKey);
        DocBrokers.emplace(docKey, docBroker);
        LOG_TRC("Have " << DocBrokers.size() << " DocBrokers after inserting [" << docKey << "].");
    }

    return docBroker;
}

/// Handles the socket that the prisoner kit connected to WSD on.
class PrisonerRequestDispatcher : public WebSocketHandler
{
    std::weak_ptr<ChildProcess> _childProcess;
public:
    PrisonerRequestDispatcher()
    {
    }
    ~PrisonerRequestDispatcher()
    {
        // Notify the broker that we're done.
        std::shared_ptr<ChildProcess> child = _childProcess.lock();
        std::shared_ptr<DocumentBroker> docBroker = child ? child->getDocumentBroker() : nullptr;
        if (docBroker)
        {
            // FIXME: No need to notify if asked to stop.
            docBroker->stop("Request dispatcher destroyed.");
        }
    }

private:
    /// Keep our socket around ...
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        setSocket(socket);
        LOG_TRC("#" << socket->getFD() << " Prisoner connected.");
    }

    void onDisconnect() override
    {
        std::shared_ptr<StreamSocket> socket = getSocket().lock();
        if (socket)
            LOG_TRC("#" << socket->getFD() << " Prisoner connection disconnected.");
        else
            LOG_WRN("Prisoner connection disconnected but without valid socket.");

        // Notify the broker that we're done.
        std::shared_ptr<ChildProcess> child = _childProcess.lock();
        std::shared_ptr<DocumentBroker> docBroker = child ? child->getDocumentBroker() : nullptr;
        if (docBroker)
        {
            std::unique_lock<std::mutex> lock = docBroker->getLock();
            docBroker->assertCorrectThread();
            docBroker->stop("docisdisconnected");
        }
    }

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition &disposition) override
    {
        // LOG_TRC("***** PrisonerRequestDispatcher::handleIncomingMessage()");
        if (_childProcess.lock())
        {
            // FIXME: inelegant etc. - derogate to websocket code
            WebSocketHandler::handleIncomingMessage(disposition);
            return;
        }

        std::shared_ptr<StreamSocket> socket = getSocket().lock();

        Poco::MemoryInputStream message(&socket->getInBuffer()[0],
                                        socket->getInBuffer().size());;
        Poco::Net::HTTPRequest request;

        try
        {
#if !MOBILEAPP
            if (!socket->parseHeader("Prisoner", message, request))
                return;

            LOG_TRC("Child connection with URI [" << LOOLWSD::anonymizeUrl(request.getURI()) << "].");
            Poco::URI requestURI(request.getURI());
#ifndef KIT_IN_PROCESS
            if (requestURI.getPath() == FORKIT_URI)
            {
                if (socket->getPid() != LOOLWSD::ForKitProcId)
                {
                    LOG_WRN("Connection request received on " << FORKIT_URI << " endpoint from unexpected ForKit process. Skipped.");
                    return;
                }
                LOOLWSD::ForKitProc = std::make_shared<ForKitProcess>(LOOLWSD::ForKitProcId, socket, request);
                socket->getInBuffer().clear();
                PrisonerPoll.setForKitProcess(LOOLWSD::ForKitProc);
                return;
            }
#endif
            if (requestURI.getPath() != NEW_CHILD_URI)
            {
                LOG_ERR("Invalid incoming URI.");
                return;
            }

            // New Child is spawned.
            const Poco::URI::QueryParameters params = requestURI.getQueryParameters();
            int pid = socket->getPid();
            std::string jailId;
            for (const auto& param : params)
            {
                if (param.first == "jailid")
                    jailId = param.second;

                else if (param.first == "version")
                    LOOLWSD::LOKitVersion = param.second;
            }

            if (pid <= 0)
            {
                LOG_ERR("Invalid PID in child URI [" << LOOLWSD::anonymizeUrl(request.getURI()) << "].");
                return;
            }

            if (jailId.empty())
            {
                LOG_ERR("Invalid JailId in child URI [" << LOOLWSD::anonymizeUrl(request.getURI()) << "].");
                return;
            }

            socket->getInBuffer().clear();

            LOG_INF("New child [" << pid << "], jailId: " << jailId << ".");

            UnitWSD::get().newChild(*this);
#else
            Poco::Process::PID pid = 100;
            std::string jailId = "jail";
            socket->getInBuffer().clear();
#endif
            LOG_TRC("Calling make_shared<ChildProcess>, for NewChildren?");

            auto child = std::make_shared<ChildProcess>(pid, jailId, socket, request);

            _childProcess = child; // weak

            // Remove from prisoner poll since there is no activity
            // until we attach the childProcess (with this socket)
            // to a docBroker, which will do the polling.
            disposition.setMove([child](const std::shared_ptr<Socket> &){
                    LOG_TRC("Calling addNewChild in disposition's move thing to add to NewChildren");
                    addNewChild(child);
                });
        }
        catch (const std::bad_weak_ptr&)
        {
            // Using shared_from_this() from a constructor is not good.
            assert(false);
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
        if (UnitWSD::get().filterChildMessage(data))
            return;

        const std::string abbr = getAbbreviatedMessage(data);
        std::shared_ptr<StreamSocket> socket = getSocket().lock();
        if (socket)
            LOG_TRC("#" << socket->getFD() << " Prisoner message [" << abbr << "].");
        else
            LOG_WRN("Message handler called but without valid socket.");

        std::shared_ptr<ChildProcess> child = _childProcess.lock();
        std::shared_ptr<DocumentBroker> docBroker = child ? child->getDocumentBroker() : nullptr;
        if (docBroker)
            docBroker->handleInput(data);
        else
            LOG_WRN("Child " << child->getPid() <<
                    " has no DocumentBroker to handle message: [" << abbr << "].");
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t & /* timeoutMaxMs */) override
    {
        return POLLIN;
    }

    void performWrites() override
    {
    }
};

#if !MOBILEAPP

/// For clipboard setting
class ClipboardPartHandler : public PartHandler
{
    std::shared_ptr<std::string> _data; // large.

public:
    std::shared_ptr<std::string> getData() const { return _data; }

    ClipboardPartHandler() { }

    virtual void handlePart(const MessageHeader& /* header */, std::istream& stream) override
    {
        std::istreambuf_iterator<char> eos;
        _data = std::make_shared<std::string>(std::istreambuf_iterator<char>(stream), eos);
        LOG_TRC("Clipboard stream from part header stored of size " << _data->length());
    }
};

#endif

/// Handles incoming connections and dispatches to the appropriate handler.
class ClientRequestDispatcher : public SimpleSocketHandler
{
public:
    ClientRequestDispatcher()
    {
    }

    static void InitStaticFileContentCache()
    {
        StaticFileContentCache["discovery.xml"] = getDiscoveryXML();
    }

    /// Does this address feature in the allowed hosts list.
    bool allowPostFrom(const std::string &address)
    {
        static bool init = false;
        static Util::RegexListMatcher hosts;
        if (!init)
        {
            const auto& app = Poco::Util::Application::instance();
            // Parse the host allow settings.
            for (size_t i = 0; ; ++i)
            {
                const std::string path = "net.post_allow.host[" + std::to_string(i) + "]";
                const auto host = app.config().getString(path, "");
                if (!host.empty())
                {
                    LOG_INF("Adding trusted POST_ALLOW host: [" << host << "].");
                    hosts.allow(host);
                }
                else if (!app.config().has(path))
                {
                    break;
                }
            }

            init = true;
        }
        return hosts.match(address);
    }
    bool allowConvertTo(const std::string &address, const Poco::Net::HTTPRequest& request, bool report = false)
    {
        std::string addressToCheck = address;
        std::string hostToCheck = request.getHost();
        bool allow = allowPostFrom(addressToCheck) || StorageBase::allowedWopiHost(hostToCheck);

        if(!allow)
        {
            if(report)
                LOG_ERR("Requesting address is denied: " << addressToCheck);
            return false;
        }

        // Handle forwarded header and make sure all participating IPs are allowed
        if(request.has("X-Forwarded-For"))
        {
            const std::string fowardedData = request.get("X-Forwarded-For");
            StringVector tokens = LOOLProtocol::tokenize(fowardedData, ',');
            for (const auto& token : tokens)
            {
                std::string param = tokens.getParam(token);
                addressToCheck = Util::trim(param);
                try
                {
                    hostToCheck = Poco::Net::DNS::resolve(addressToCheck).name();
                    allow &= allowPostFrom(addressToCheck) || StorageBase::allowedWopiHost(hostToCheck);
                }
                catch (const Poco::Exception& exc)
                {
                    LOG_WRN("Poco::Net::DNS::resolve(\"" << addressToCheck << "\") failed: " << exc.displayText());
                    // We can't find out the hostname, check the IP only
                    allow &= allowPostFrom(addressToCheck);
                }
                if(!allow)
                {
                    if(report)
                        LOG_ERR("Requesting address is denied: " << addressToCheck);
                    return false;
                }
            }
        }
        return allow;
    }

private:

    /// Set the socket associated with this ResponseClient.
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _id = LOOLWSD::GetConnectionId();
        _socket = socket;
        LOG_TRC("#" << socket->getFD() << " Connected to ClientRequestDispatcher.");
    }

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition &disposition) override
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();

#if !MOBILEAPP
        if (!LOOLWSD::isSSLEnabled() && socket->sniffSSL())
        {
            LOG_ERR("Looks like SSL/TLS traffic on plain http port");
            std::ostringstream oss;
            oss << "HTTP/1.1 400\r\n"
                "Date: " << Util::getHttpTimeNow() << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: 0\r\n"
                "\r\n";
            socket->send(oss.str());
            socket->shutdown();
            return;
        }

        Poco::MemoryInputStream startmessage(&socket->getInBuffer()[0],
                                             socket->getInBuffer().size());;
        Poco::Net::HTTPRequest request;

        StreamSocket::MessageMap map;
        if (!socket->parseHeader("Client", startmessage, request, &map))
            return;

        LOG_INF("Handling request: " << request.getURI());
        try
        {
            // We may need to re-write the chunks moving the inBuffer.
            socket->compactChunks(&map);
            Poco::MemoryInputStream message(&socket->getInBuffer()[0],
                                            socket->getInBuffer().size());
            // update the read cursor - headers are not altered by chunks.
            message.seekg(startmessage.tellg(), std::ios::beg);

            // Check and remove the ServiceRoot from the request.getURI()
            if (!Util::startsWith(request.getURI(), LOOLWSD::ServiceRoot))
                throw BadRequestException("The request does not start with prefix: " + LOOLWSD::ServiceRoot);

            std::string requestURIString(request.getURI().substr(LOOLWSD::ServiceRoot.length()));
            request.setURI(requestURIString);

            // Routing
            Poco::URI requestUri(request.getURI());
            std::vector<std::string> reqPathSegs;
            requestUri.getPathSegments(reqPathSegs);

            if (UnitWSD::get().handleHttpRequest(request, message, socket))
            {
                // Unit testing, nothing to do here
            }
            else if (reqPathSegs.size() >= 1 && reqPathSegs[0] == "loleaflet")
            {
                // File server
                handleFileServerRequest(request, message);
            }
            else if (reqPathSegs.size() >= 2 && reqPathSegs[0] == "lool" && reqPathSegs[1] == "adminws")
            {
                // Admin connections
                LOG_INF("Admin request: " << request.getURI());
                if (AdminSocketHandler::handleInitialRequest(_socket, request))
                {
                    disposition.setMove([](const std::shared_ptr<Socket> &moveSocket){
                            // Hand the socket over to the Admin poll.
                            Admin::instance().insertNewSocket(moveSocket);
                        });
                }

            }
            else if (reqPathSegs.size() >= 2 && reqPathSegs[0] == "lool" && reqPathSegs[1] == "getMetrics")
            {
                //See metrics.txt
                std::shared_ptr<Poco::Net::HTTPResponse> response(new Poco::Net::HTTPResponse());

                if (!LOOLWSD::AdminEnabled)
                    throw Poco::FileAccessDeniedException("Admin console disabled");

                try{
                    if (!FileServerRequestHandler::isAdminLoggedIn(request, *response.get()))
                        throw Poco::Net::NotAuthenticatedException("Invalid admin login");
                }
                catch (const Poco::Net::NotAuthenticatedException& exc)
                {
                    //LOG_ERR("FileServerRequestHandler::NotAuthenticated: " << exc.displayText());
                    std::ostringstream oss;
                    oss << "HTTP/1.1 401 \r\n"
                        << "Content-Type: text/html charset=UTF-8\r\n"
                        << "Date: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
                        << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                        << "WWW-authenticate: Basic realm=\"online\"\r\n"
                        << "\r\n";
                    socket->send(oss.str());
                    socket->shutdown();
                    return;
                }

                response->add("Last-Modified", Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT));
                // Ask UAs to block if they detect any XSS attempt
                response->add("X-XSS-Protection", "1; mode=block");
                // No referrer-policy
                response->add("Referrer-Policy", "no-referrer");
                response->add("User-Agent", HTTP_AGENT_STRING);
                response->add("Content-Type", "text/plain");
                response->add("X-Content-Type-Options", "nosniff");

                disposition.setMove([response](const std::shared_ptr<Socket> &moveSocket){
                            const std::shared_ptr<StreamSocket> streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);
                            Admin::instance().sendMetricsAsync(streamSocket, response);
                        });
            }
            // Client post and websocket connections
            else if ((request.getMethod() == HTTPRequest::HTTP_GET ||
                      request.getMethod() == HTTPRequest::HTTP_HEAD) &&
                     request.getURI() == "/")
            {
                handleRootRequest(request);
            }
            else if (request.getMethod() == HTTPRequest::HTTP_GET && request.getURI() == "/favicon.ico")
            {
                handleFaviconRequest(request);
            }
            else if (request.getMethod() == HTTPRequest::HTTP_GET && (request.getURI() == "/hosting/discovery" || request.getURI() == "/hosting/discovery/"))
            {
                handleWopiDiscoveryRequest(request);
            }
            else if (request.getMethod() == HTTPRequest::HTTP_GET && request.getURI() == CAPABILITIES_END_POINT)
            {
                handleCapabilitiesRequest(request);
            }
            else if (request.getMethod() == HTTPRequest::HTTP_GET && request.getURI() == "/robots.txt")
            {
                handleRobotsTxtRequest(request);
            }
            else
            {
                StringTokenizer reqPathTokens(request.getURI(), "/?", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
                if (reqPathTokens.count() > 1 && reqPathTokens[0] == "lool" && reqPathTokens[1] == "clipboard")
                {
//                    Util::dumpHex(std::cerr, "clipboard:\n", "", socket->getInBuffer()); // lots of data ...
                    handleClipboardRequest(request, message, disposition);
                }
                else if (!(request.find("Upgrade") != request.end() && Poco::icompare(request["Upgrade"], "websocket") == 0) &&
                    reqPathTokens.count() > 0 && reqPathTokens[0] == "lool")
                {
                    // All post requests have url prefix 'lool'.
                    handlePostRequest(request, message, disposition);
                }
                else if (reqPathTokens.count() > 2 && reqPathTokens[0] == "lool" && reqPathTokens[2] == "ws" &&
                         request.find("Upgrade") != request.end() && Poco::icompare(request["Upgrade"], "websocket") == 0)
                {
                    std::string decodedUri; // WOPISrc
                    Poco::URI::decode(reqPathTokens[1], decodedUri);
                    handleClientWsUpgrade(request, decodedUri, disposition);
                }
                else
                {
                    LOG_ERR("Unknown resource: " << request.getURI());

                    // Bad request.
                    std::ostringstream oss;
                    oss << "HTTP/1.1 400\r\n"
                        "Date: " << Util::getHttpTimeNow() << "\r\n"
                        "User-Agent: " WOPI_AGENT_STRING "\r\n"
                        "Content-Length: 0\r\n"
                        "\r\n";
                    socket->send(oss.str());
                    socket->shutdown();
                    return;
                }
            }
        }
        catch (const std::exception& exc)
        {
            LOG_INF("#" << socket->getFD() << " Exception while processing incoming request: [" <<
                    LOOLProtocol::getAbbreviatedMessage(socket->getInBuffer()) << "]: " << exc.what());

            // Bad request.
            // NOTE: Check _wsState to choose between HTTP response or WebSocket (app-level) error.
            std::ostringstream oss;
            oss << "HTTP/1.1 400\r\n"
                << "Date: " << Util::getHttpTimeNow() << "\r\n"
                << "User-Agent: LOOLWSD WOPI Agent\r\n"
                << "Content-Length: 0\r\n"
                << "\r\n";
            socket->send(oss.str());
            socket->shutdown();
            return;
        }

        // if we succeeded - remove the request from our input buffer
        // we expect one request per socket
        socket->eraseFirstInputBytes(map);
#else
        Poco::Net::HTTPRequest request;
        // The 2nd parameter is the response to the HULLO message (which we
        // respond with the path of the document)
        handleClientWsUpgrade(request, std::string(socket->getInBuffer().data(), socket->getInBuffer().size()), disposition);
        socket->getInBuffer().clear();
#endif
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t & /* timeoutMaxMs */) override
    {
        return POLLIN;
    }

    void performWrites() override
    {
    }

#if !MOBILEAPP
    void handleFileServerRequest(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& message)
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        FileServerRequestHandler::handleRequest(request, message, socket);
        socket->shutdown();
    }

    void handleRootRequest(const Poco::Net::HTTPRequest& request)
    {
        LOG_DBG("HTTP request: " << request.getURI());
        const std::string mimeType = "text/plain";
        const std::string responseString = "OK";

        std::ostringstream oss;
        oss << "HTTP/1.1 200 OK\r\n"
            "Last-Modified: " << Util::getHttpTimeNow() << "\r\n"
            "User-Agent: " WOPI_AGENT_STRING "\r\n"
            "Content-Length: " << responseString.size() << "\r\n"
            "Content-Type: " << mimeType << "\r\n"
            "\r\n";

        if (request.getMethod() == Poco::Net::HTTPRequest::HTTP_GET)
        {
            oss << responseString;
        }

        std::shared_ptr<StreamSocket> socket = _socket.lock();
        socket->send(oss.str());
        socket->shutdown();
        LOG_INF("Sent / response successfully.");
    }

    void handleFaviconRequest(const Poco::Net::HTTPRequest& request)
    {
        LOG_DBG("Favicon request: " << request.getURI());
        std::string mimeType = "image/vnd.microsoft.icon";
        std::string faviconPath = Path(Application::instance().commandPath()).parent().toString() + "favicon.ico";
        if (!File(faviconPath).exists())
        {
            faviconPath = LOOLWSD::FileServerRoot + "/favicon.ico";
        }

        std::shared_ptr<StreamSocket> socket = _socket.lock();
        Poco::Net::HTTPResponse response;
        HttpHelper::sendFile(socket, faviconPath, mimeType, response);
        socket->shutdown();
    }

    void handleWopiDiscoveryRequest(const Poco::Net::HTTPRequest& request)
    {
        LOG_DBG("Wopi discovery request: " << request.getURI());

        std::string xml = getFileContent("discovery.xml");
        const std::string hostname = (LOOLWSD::ServerName.empty() ? request.getHost() : LOOLWSD::ServerName);
        Poco::replaceInPlace(xml, std::string("%SERVER_HOST%"), hostname);

        // TODO: Refactor this to some common handler.
        std::ostringstream oss;
        oss << "HTTP/1.1 200 OK\r\n"
            "Last-Modified: " << Util::getHttpTimeNow() << "\r\n"
            "User-Agent: " WOPI_AGENT_STRING "\r\n"
            "Content-Length: " << xml.size() << "\r\n"
            "Content-Type: text/xml\r\n"
            "X-Content-Type-Options: nosniff\r\n"
            "\r\n"
            << xml;

        std::shared_ptr<StreamSocket> socket = _socket.lock();
        socket->send(oss.str());
        socket->shutdown();
        LOG_INF("Sent discovery.xml successfully.");
    }

    void handleCapabilitiesRequest(const Poco::Net::HTTPRequest& request)
    {
        LOG_DBG("Wopi capabilities request: " << request.getURI());

        std::string capabilities = getCapabilitiesJson(request);

        std::ostringstream oss;
        oss << "HTTP/1.1 200 OK\r\n"
            "Last-Modified: " << Util::getHttpTimeNow() << "\r\n"
            "User-Agent: " WOPI_AGENT_STRING "\r\n"
            "Content-Length: " << capabilities.size() << "\r\n"
            "Content-Type: application/json\r\n"
            "X-Content-Type-Options: nosniff\r\n"
            "\r\n"
            << capabilities;

        auto socket = _socket.lock();
        socket->send(oss.str());
        socket->shutdown();
        LOG_INF("Sent capabilities.json successfully.");
    }

    void handleClipboardRequest(const Poco::Net::HTTPRequest& request,
                                Poco::MemoryInputStream& message,
                                SocketDisposition &disposition)
    {
        LOG_DBG("Clipboard " << ((request.getMethod() == HTTPRequest::HTTP_GET) ? "GET" : "POST") <<
                " request: " << request.getURI());

        Poco::URI requestUri(request.getURI());
        Poco::URI::QueryParameters params = requestUri.getQueryParameters();
        std::string WOPISrc, serverId, viewId, tag, mime;
        for (auto it : params)
        {
            if (it.first == "WOPISrc")
                WOPISrc = it.second;
            else if (it.first == "ServerId")
                serverId = it.second;
            else if (it.first == "ViewId")
                viewId = it.second;
            else if (it.first == "Tag")
                tag = it.second;
            else if (it.first == "MimeType")
                mime = it.second;
        }
        LOG_TRC("Clipboard request for us: " << serverId << " with tag " << tag);

        const auto docKey = DocumentBroker::getDocKey(DocumentBroker::sanitizeURI(WOPISrc));

        std::shared_ptr<DocumentBroker> docBroker;
        {
            std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
            auto it = DocBrokers.find(docKey);
            if (it != DocBrokers.end())
                docBroker = it->second;
        }
        if (docBroker && serverId == LOOLWSD::HostIdentifier)
        {
            std::shared_ptr<std::string> data;
            DocumentBroker::ClipboardRequest type;
            if (request.getMethod() == HTTPRequest::HTTP_GET)
            {
                if (mime == "text/html")
                    type = DocumentBroker::CLIP_REQUEST_GET_RICH_HTML_ONLY;
                else
                    type = DocumentBroker::CLIP_REQUEST_GET;
            }
            else
            {
                type = DocumentBroker::CLIP_REQUEST_SET;
                ClipboardPartHandler handler;
                HTMLForm form(request, message, handler);
                data = handler.getData();
                if (!data || data->length() == 0)
                    LOG_ERR("Invalid zero size set clipboard content");
            }
            // Do things in the right thread.
            disposition.setMove([=] (const std::shared_ptr<Socket> &moveSocket)
                {
                    LOG_TRC("Move clipboard request " << tag << " to docbroker thread with data: " <<
                            (data ? data->length() : 0) << " bytes");
                    // We no longer own this socket.
                    moveSocket->setThreadOwner(std::thread::id(0));

                    // Perform all of this after removing the socket
                    docBroker->addCallback([=]()
                        {
                            auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);
                            docBroker->handleClipboardRequest(type, streamSocket, viewId, tag, data);
                        });
                });
            LOG_TRC("queued clipboard command " << type << " on docBroker fetch");
        }
        // fallback to persistent clipboards if we can
        else if (!DocumentBroker::lookupSendClipboardTag(_socket.lock(), tag, false))
        {
            LOG_ERR("Invalid clipboard request: " << serverId << " with tag " << tag <<
                    " and broker: " << (docBroker ? "" : "not ") << "found");

            std::string errMsg;
            if (serverId != LOOLWSD::HostIdentifier)
                errMsg = "Cluster configuration error: mis-matching serverid " + serverId + " vs. " + LOOLWSD::HostIdentifier;
            else
                errMsg = "Empty clipboard item / session tag " + tag;

            // Bad request.
            std::ostringstream oss;
            oss << "HTTP/1.1 400\r\n"
                << "Date: " << Util::getHttpTimeNow() << "\r\n"
                << "User-Agent: LOOLWSD WOPI Agent\r\n"
                << "Content-Length: 0\r\n"
                << "\r\n"
                << errMsg;
            auto socket = _socket.lock();
            socket->send(oss.str());
            socket->shutdown();
        }
    }

    void handleRobotsTxtRequest(const Poco::Net::HTTPRequest& request)
    {
        LOG_DBG("HTTP request: " << request.getURI());
        const std::string mimeType = "text/plain";
        const std::string responseString = "User-agent: *\nDisallow: /\n";

        std::ostringstream oss;
        oss << "HTTP/1.1 200 OK\r\n"
            "Last-Modified: " << Util::getHttpTimeNow() << "\r\n"
            "User-Agent: " WOPI_AGENT_STRING "\r\n"
            "Content-Length: " << responseString.size() << "\r\n"
            "Content-Type: " << mimeType << "\r\n"
            "\r\n";

        if (request.getMethod() == Poco::Net::HTTPRequest::HTTP_GET)
        {
            oss << responseString;
        }

        std::shared_ptr<StreamSocket> socket = _socket.lock();
        socket->send(oss.str());
        socket->shutdown();
        LOG_INF("Sent robots.txt response successfully.");
    }

    static std::string getContentType(const std::string& fileName)
    {
        const std::string nodePath = Poco::format("//[@ext='%s']", Poco::Path(fileName).getExtension());
        std::string discPath = Path(Application::instance().commandPath()).parent().toString() + "discovery.xml";
        if (!File(discPath).exists())
        {
            discPath = LOOLWSD::FileServerRoot + "/discovery.xml";
        }

        InputSource input(discPath);
        DOMParser domParser;
        AutoPtr<Poco::XML::Document> doc = domParser.parse(&input);
        if (doc)
        {
            Node* node = doc->getNodeByPath(nodePath);
            if (node && node->parentNode())
            {
                Element* elem = dynamic_cast<Element*>(node->parentNode());
                if (elem && elem->hasAttributes())
                    return elem->getAttribute("name");
            }
        }

        return "application/octet-stream";
    }

    static bool isSpreadsheet(const std::string& fileName)
    {
        std::string sContentType = getContentType(fileName);

        if (sContentType == "application/vnd.oasis.opendocument.spreadsheet"
            || sContentType == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            || sContentType == "application/vnd.ms-excel")
            return true;
        else
            return false;
    }

    void handlePostRequest(const Poco::Net::HTTPRequest& request,
                           Poco::MemoryInputStream& message,
                           SocketDisposition &disposition)
    {
        LOG_INF("Post request: [" << LOOLWSD::anonymizeUrl(request.getURI()) << "]");

        Poco::Net::HTTPResponse response;
        std::shared_ptr<StreamSocket> socket = _socket.lock();

        StringTokenizer tokens(request.getURI(), "/?");
        if (tokens.count() > 2 && tokens[2] == "convert-to")
        {
            // Validate sender - FIXME: should do this even earlier.
            if (!allowConvertTo(socket->clientAddress(), request, true))
            {
                LOG_WRN("Conversion requests not allowed from this address: " << socket->clientAddress());
                std::ostringstream oss;
                oss << "HTTP/1.1 403\r\n"
                    "Date: " << Util::getHttpTimeNow() << "\r\n"
                    "User-Agent: " HTTP_AGENT_STRING "\r\n"
                    "Content-Length: 0\r\n"
                    "\r\n";
                socket->send(oss.str());
                socket->shutdown();
                return;
            }

            ConvertToPartHandler handler(/*convertTo =*/ true);
            HTMLForm form(request, message, handler);

            std::string sOptions("");
            std::string format = (form.has("format") ? form.get("format") : "");
            std::string sFullSheetPreview = (form.has("FullSheetPreview") ? form.get("FullSheetPreview") : "");
            bool bFullSheetPreview = sFullSheetPreview == "true" ? true : false;

            // prefer what is in the URI
            if (tokens.count() > 3)
                format = tokens[3];

            std::string fromPath = handler.getFilename();
            LOG_INF("Conversion request for URI [" << fromPath << "] format [" << format << "].");
            if (!fromPath.empty() && !format.empty())
            {
                Poco::URI uriPublic = DocumentBroker::sanitizeURI(fromPath);
                const std::string docKey = DocumentBroker::getDocKey(uriPublic);

                if (bFullSheetPreview && format == "pdf" && isSpreadsheet(fromPath))
                {
                    sOptions += std::string(",FullSheetPreview=") + sFullSheetPreview + std::string("FULLSHEETPREVEND");
                }
                else
                {
                    bFullSheetPreview = false;
                }

                // This lock could become a bottleneck.
                // In that case, we can use a pool and index by publicPath.
                std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);

                LOG_DBG("New DocumentBroker for docKey [" << docKey << "].");
                auto docBroker = std::make_shared<ConvertToBroker>(fromPath, uriPublic, docKey, format, sOptions);
                handler.takeFile();

                cleanupDocBrokers();

                LOG_DBG("New DocumentBroker for docKey [" << docKey << "].");
                DocBrokers.emplace(docKey, docBroker);
                LOG_TRC("Have " << DocBrokers.size() << " DocBrokers after inserting [" << docKey << "].");

                if (!docBroker->startConversion(disposition, _id))
                {
                    LOG_WRN("Failed to create Client Session with id [" << _id << "] on docKey [" << docKey << "].");
                    cleanupDocBrokers();
                }
            }
            return;
        }
        else if (tokens.count() >= 4 && tokens[3] == "insertfile")
        {
            LOG_INF("Insert file request.");

            ConvertToPartHandler handler;
            HTMLForm form(request, message, handler);

            if (form.has("childid") && form.has("name"))
            {
                const std::string formChildid(form.get("childid"));
                const std::string formName(form.get("name"));

                // Validate the docKey
                std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
                std::string decodedUri;
                URI::decode(tokens[2], decodedUri);
                const std::string docKey = DocumentBroker::getDocKey(DocumentBroker::sanitizeURI(decodedUri));
                auto docBrokerIt = DocBrokers.find(docKey);

                // Maybe just free the client from sending childid in form ?
                if (docBrokerIt == DocBrokers.end() || docBrokerIt->second->getJailId() != formChildid)
                {
                    throw BadRequestException("DocKey [" + docKey + "] or childid [" + formChildid + "] is invalid.");
                }
                docBrokersLock.unlock();

                // protect against attempts to inject something funny here
                if (formChildid.find('/') == std::string::npos && formName.find('/') == std::string::npos)
                {
                    const std::string dirPath = LOOLWSD::ChildRoot + formChildid
                                              + JAILED_DOCUMENT_ROOT + "insertfile";
                    const std::string fileName = dirPath + '/' + form.get("name");
                    LOG_INF("Perform insertfile: " << formChildid << ", " << formName << ", filename: " << fileName);
                    File(dirPath).createDirectories();
                    File(handler.getFilename()).moveTo(fileName);
                    response.setContentLength(0);
                    socket->send(response);
                    return;
                }
            }
        }
        else if (tokens.count() >= 6)
        {
            LOG_INF("File download request.");
            // TODO: Check that the user in question has access to this file!

            // 1. Validate the dockey
            std::string decodedUri;
            URI::decode(tokens[2], decodedUri);
            const std::string docKey = DocumentBroker::getDocKey(DocumentBroker::sanitizeURI(decodedUri));
            std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
            auto docBrokerIt = DocBrokers.find(docKey);
            if (docBrokerIt == DocBrokers.end())
            {
                throw BadRequestException("DocKey [" + docKey + "] is invalid.");
            }

            // 2. Cross-check if received child id is correct
            if (docBrokerIt->second->getJailId() != tokens[3])
            {
                throw BadRequestException("ChildId does not correspond to docKey");
            }

            // 3. Don't let user download the file in main doc directory containing
            // the document being edited otherwise we will end up deleting main directory
            // after download finishes
            if (docBrokerIt->second->getJailId() == tokens[4])
            {
                throw BadRequestException("RandomDir cannot be equal to ChildId");
            }
            docBrokersLock.unlock();

            std::string fileName;
            URI::decode(tokens[5], fileName);
            const Path filePath(LOOLWSD::ChildRoot + tokens[3]
                                + JAILED_DOCUMENT_ROOT + tokens[4] + "/" + fileName);
            const std::string filePathAnonym = LOOLWSD::anonymizeUrl(filePath.toString());
            LOG_INF("HTTP request for: " << filePathAnonym);
            if (filePath.isAbsolute() && File(filePath).exists())
            {
                const Poco::URI postRequestUri(request.getURI());
                const Poco::URI::QueryParameters postRequestQueryParams = postRequestUri.getQueryParameters();

                bool serveAsAttachment = true;
                const auto attachmentIt = std::find_if(postRequestQueryParams.begin(),
                                                       postRequestQueryParams.end(),
                                                       [](const std::pair<std::string, std::string>& element) {
                                                           return element.first == "attachment";
                                                       });
                if (attachmentIt != postRequestQueryParams.end())
                    serveAsAttachment = attachmentIt->second != "0";

                // Instruct browsers to download the file, not display it
                // with the exception of SVG where we need the browser to
                // actually show it.
                std::string contentType = getContentType(fileName);
                if (serveAsAttachment && contentType != "image/svg+xml")
                    response.set("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

                try
                {
                    HttpHelper::sendFile(socket, filePath.toString(), contentType, response);
                }
                catch (const Exception& exc)
                {
                    LOG_ERR("Error sending file to client: " << exc.displayText() <<
                            (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
                }

                FileUtil::removeFile(File(filePath.parent()).path(), true);
            }
            else
            {
                LOG_ERR("Download file [" << filePathAnonym << "] not found.");
                std::ostringstream oss;
                oss << "HTTP/1.1 404 Not Found\r\n"
                    << "Date: " << Util::getHttpTimeNow() << "\r\n"
                    << "User-Agent: " << HTTP_AGENT_STRING << "\r\n"
                    << "Content-Length: 0\r\n"
                    << "\r\n";
                socket->send(oss.str());
                socket->shutdown();
            }
            return;
        }

        throw BadRequestException("Invalid or unknown request.");
    }
#endif

    void handleClientWsUpgrade(const Poco::Net::HTTPRequest& request, const std::string& url,
                               SocketDisposition &disposition)
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (!socket)
        {
            LOG_WRN("No socket to handle client WS upgrade for request: " << LOOLWSD::anonymizeUrl(request.getURI()) << ", url: " << url);
            return;
        }

        // must be trace for anonymization
        LOG_TRC("Client WS request: " << request.getURI() << ", url: " << url << ", socket #" << socket->getFD());

        // First Upgrade.
        auto ws = std::make_shared<WebSocketHandler>(_socket, request);

        // Response to clients beyond this point is done via WebSocket.
        try
        {
            if (LOOLWSD::NumConnections >= LOOLWSD::MaxConnections)
            {
                LOG_INF("Limit on maximum number of connections of " << LOOLWSD::MaxConnections << " reached.");
#if ENABLE_SUPPORT_KEY
                shutdownLimitReached(ws);
                return;
#endif
            }

            LOG_INF("URL [" << url << "].");
            const auto uriPublic = DocumentBroker::sanitizeURI(url);
            LOG_INF("URI [" << uriPublic.getPath() << "].");
            const auto docKey = DocumentBroker::getDocKey(uriPublic);
            LOG_INF("DocKey [" << docKey << "].");
            const std::string fileId = Util::getFilenameFromURL(docKey);
            Util::mapAnonymized(fileId, fileId); // Identity mapping, since fileId is already obfuscated

            LOG_INF("Starting GET request handler for session [" << _id << "] on url [" << LOOLWSD::anonymizeUrl(url) << "].");

            // Indicate to the client that document broker is searching.
            const std::string status("statusindicator: find");
            LOG_TRC("Sending to Client [" << status << "].");
            ws->sendMessage(status);

            LOG_INF("Sanitized URI [" << LOOLWSD::anonymizeUrl(url) << "] to [" << LOOLWSD::anonymizeUrl(uriPublic.toString()) <<
                    "] and mapped to docKey [" << docKey << "] for session [" << _id << "].");

            // Check if readonly session is required
            bool isReadOnly = false;
            for (const auto& param : uriPublic.getQueryParameters())
            {
                LOG_DBG("Query param: " << param.first << ", value: " << param.second);
                if (param.first == "permission" && param.second == "readonly")
                {
                    isReadOnly = true;
                }
            }

            LOG_INF("URL [" << LOOLWSD::anonymizeUrl(url) << "] is " << (isReadOnly ? "readonly" : "writable") << ".");

            // Request a kit process for this doc.
            std::shared_ptr<DocumentBroker> docBroker = findOrCreateDocBroker(
                std::static_pointer_cast<ProtocolHandlerInterface>(ws), url, docKey, _id, uriPublic);
             if (docBroker)
            {
#if MOBILEAPP
                const std::string hostNoTrust;
#else
                // We can send this back to whomever sent it to us though.
                const std::string hostNoTrust = (LOOLWSD::ServerName.empty() ? request.getHost() : LOOLWSD::ServerName);
#endif

                std::shared_ptr<ClientSession> clientSession =
                    docBroker->createNewClientSession(ws, _id, uriPublic, isReadOnly, hostNoTrust);
                if (clientSession)
                {
                    // Transfer the client socket to the DocumentBroker when we get back to the poll:
                    disposition.setMove([docBroker, clientSession, ws]
                                        (const std::shared_ptr<Socket> &moveSocket)
                    {
                        // Make sure the thread is running before adding callback.
                        docBroker->startThread();

                        // We no longer own this socket.
                        moveSocket->setThreadOwner(std::thread::id());

                        docBroker->addCallback([docBroker, moveSocket, clientSession, ws]()
                        {
                            try
                            {
                                auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);

                                // Set WebSocketHandler's socket after its construction for shared_ptr goodness.
                                streamSocket->setHandler(ws);

                                LOG_DBG("Socket #" << moveSocket->getFD() << " handler is " << clientSession->getName());
                                // Move the socket into DocBroker.
                                docBroker->addSocketToPoll(moveSocket);

                                // Add and load the session.
                                docBroker->addSession(clientSession);

                                LOOLWSD::checkDiskSpaceAndWarnClients(true);
                                // Users of development versions get just an info
                                // when reaching max documents or connections
                                LOOLWSD::checkSessionLimitsAndWarnClients();
                            }
                            catch (const UnauthorizedRequestException& exc)
                            {
                                LOG_ERR("Unauthorized Request while loading session for " << docBroker->getDocKey() << ": " << exc.what());
                                const std::string msg = "error: cmd=internal kind=unauthorized";
                                clientSession->sendMessage(msg);
                            }
                            catch (const StorageConnectionException& exc)
                            {
                                // Alert user about failed load
                                const std::string msg = "error: cmd=storage kind=loadfailed";
                                clientSession->sendMessage(msg);
                            }
                            catch (const std::exception& exc)
                            {
                                LOG_ERR("Error while loading : " << exc.what());

                                // Alert user about failed load
                                const std::string msg = "error: cmd=storage kind=loadfailed";
                                clientSession->sendMessage(msg);
                            }
                        });
                    });
                }
                else
                {
                    LOG_WRN("Failed to create Client Session with id [" << _id << "] on docKey [" << docKey << "].");
                }
            }
            else
            {
                throw ServiceUnavailableException("Failed to create DocBroker with docKey [" + docKey + "].");
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Error while handling Client WS Request: " << exc.what());
            const std::string msg = "error: cmd=internal kind=load";
            ws->sendMessage(msg);
            ws->shutdown(WebSocketHandler::StatusCodes::ENDPOINT_GOING_AWAY, msg);
        }
    }

    /// Lookup cached file content.
    const std::string& getFileContent(const std::string& filename)
    {
        const auto it = StaticFileContentCache.find(filename);
        if (it == StaticFileContentCache.end())
        {
            throw Poco::FileAccessDeniedException("Invalid or forbidden file path: [" + filename + "].");
        }

        return it->second;
    }

    /// Process the discovery.xml file and return as string.
    static std::string getDiscoveryXML()
    {
#if MOBILEAPP
        // not needed for mobile
        return std::string();
#else
        std::string discoveryPath = Path(Application::instance().commandPath()).parent().toString() + "discovery.xml";
        if (!File(discoveryPath).exists())
        {
            // http://server/hosting/discovery.xml
            discoveryPath = LOOLWSD::FileServerRoot + "/discovery.xml";
        }

        const std::string action = "action";
        const std::string urlsrc = "urlsrc";
        const auto& config = Application::instance().config();
        const std::string loleafletHtml = config.getString("loleaflet_html", "loleaflet.html");
        const std::string rootUriValue =
#if ENABLE_SSL
            ((LOOLWSD::isSSLEnabled() || LOOLWSD::isSSLTermination()) ? "https://" : "http://")
#else
            "http://"
#endif
            + std::string("%SERVER_HOST%")
            + LOOLWSD::ServiceRoot;
        const std::string uriValue = rootUriValue
                                   + "/loleaflet/" LOOLWSD_VERSION_HASH "/" + loleafletHtml + '?';

        InputSource inputSrc(discoveryPath);
        DOMParser parser;
        AutoPtr<Poco::XML::Document> docXML = parser.parse(&inputSrc);
        AutoPtr<NodeList> listNodes = docXML->getElementsByTagName(action);

        for (unsigned long it = 0; it < listNodes->length(); ++it)
        {
            Element* elem = static_cast<Element*>(listNodes->item(it));
            Element* parent = elem->parentNode() ? static_cast<Element*>(elem->parentNode()) : nullptr;
            if(parent && parent->getAttribute("name") == "Capabilities")
            {
                elem->setAttribute(urlsrc, rootUriValue + CAPABILITIES_END_POINT);
            }
            else
            {
                elem->setAttribute(urlsrc, uriValue);
            }

            // Set the View extensions cache as well.
            if (elem->getAttribute("name") == "edit")
                LOOLWSD::EditFileExtensions.insert(elem->getAttribute("ext"));
        }

        const auto& proofAttribs = GetProofKeyAttributes();
        if (!proofAttribs.empty())
        {
            // Add proof-key element to wopi-discovery root
            AutoPtr<Element> keyElem = docXML->createElement("proof-key");
            for (const auto& attrib : proofAttribs)
                keyElem->setAttribute(attrib.first, attrib.second);
            docXML->documentElement()->appendChild(keyElem);
        }

        std::ostringstream ostrXML;
        DOMWriter writer;
        writer.writeNode(ostrXML, docXML);
        return ostrXML.str();
#endif
    }

    /// Create the /hosting/capabilities JSON and return as string.
    std::string getCapabilitiesJson(const Poco::Net::HTTPRequest& request)
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();

        // Can the convert-to be used?
        Poco::JSON::Object::Ptr convert_to = new Poco::JSON::Object;
        Poco::Dynamic::Var available = allowConvertTo(socket->clientAddress(), request);
        convert_to->set("available", available);

        Poco::JSON::Object::Ptr capabilities = new Poco::JSON::Object;
        capabilities->set("convert-to", convert_to);

        // Supports the TemplateSaveAs in CheckFileInfo?
        // TemplateSaveAs is broken by design, disable it everywhere (and
        // remove at some stage too)
        capabilities->set("hasTemplateSaveAs", false);

        // Supports the TemplateSource in CheckFileInfo?
        capabilities->set("hasTemplateSource", true);

        // Hint to encourage use on mobile devices
        capabilities->set("hasMobileSupport", true);

        // Set the product name
        capabilities->set("productName", APP_NAME);

        std::ostringstream ostrJSON;
        capabilities->stringify(ostrJSON);
        return ostrJSON.str();
    }

private:
    // The socket that owns us (we can't own it).
    std::weak_ptr<StreamSocket> _socket;
    std::string _id;

    /// Cache for static files, to avoid reading and processing from disk.
    static std::map<std::string, std::string> StaticFileContentCache;
};

std::map<std::string, std::string> ClientRequestDispatcher::StaticFileContentCache;

class PlainSocketFactory final : public SocketFactory
{
    std::shared_ptr<Socket> create(const int physicalFd) override
    {
        int fd = physicalFd;
#if !MOBILEAPP
        if (SimulatedLatencyMs > 0)
            fd = Delay::create(SimulatedLatencyMs, physicalFd);
#endif
        std::shared_ptr<Socket> socket =
            StreamSocket::create<StreamSocket>(
                fd, false, std::make_shared<ClientRequestDispatcher>());

        return socket;
    }
};

#if ENABLE_SSL
class SslSocketFactory final : public SocketFactory
{
    std::shared_ptr<Socket> create(const int physicalFd) override
    {
        int fd = physicalFd;

#if !MOBILEAPP
        if (SimulatedLatencyMs > 0)
            fd = Delay::create(SimulatedLatencyMs, physicalFd);
#endif

        return StreamSocket::create<SslStreamSocket>(
            fd, false, std::make_shared<ClientRequestDispatcher>());
    }
};
#endif

class PrisonerSocketFactory final : public SocketFactory
{
    std::shared_ptr<Socket> create(const int fd) override
    {
        // No local delay.
        return StreamSocket::create<StreamSocket>(fd, false, std::make_shared<PrisonerRequestDispatcher>());
    }
};

/// The main server thread.
///
/// Waits for the connections from the loleaflets, and creates the
/// websockethandlers accordingly.
class LOOLWSDServer
{
    LOOLWSDServer(LOOLWSDServer&& other) = delete;
    const LOOLWSDServer& operator=(LOOLWSDServer&& other) = delete;
public:
    LOOLWSDServer() :
        _acceptPoll("accept_poll")
    {
    }

    ~LOOLWSDServer()
    {
        stop();
    }

    // allocate port & hold temporarily.
    std::shared_ptr<ServerSocket> _serverSocket;
    void findClientPort()
    {
        _serverSocket = findServerPort(ClientPortNumber);
    }

    void startPrisoners()
    {
        PrisonerPoll.startThread();
        PrisonerPoll.insertNewSocket(findPrisonerServerPort());
    }

    void stopPrisoners()
    {
        PrisonerPoll.joinThread();
    }

    void start()
    {
        _acceptPoll.startThread();
        _acceptPoll.insertNewSocket(_serverSocket);

#if MOBILEAPP
        loolwsd_server_socket_fd = _serverSocket->getFD();
#endif

        _serverSocket.reset();
        WebServerPoll.startThread();

#if !MOBILEAPP
        Admin::instance().start();
#endif
    }

    void stop()
    {
        _acceptPoll.joinThread();
        WebServerPoll.joinThread();
    }

    void dumpState(std::ostream& os)
    {
        // FIXME: add some stop-world magic before doing the dump(?)
        Socket::InhibitThreadChecks = true;
        SocketPoll::InhibitThreadChecks = true;

        os << "LOOLWSDServer:\n"
#if !MOBILEAPP
           << "  Ports: server " << ClientPortNumber
           <<          " prisoner " << MasterLocation << "\n"
           << "  SSL: " << (LOOLWSD::isSSLEnabled() ? "https" : "http") << "\n"
           << "  SSL-Termination: " << (LOOLWSD::isSSLTermination() ? "yes" : "no") << "\n"
           << "  Security " << (LOOLWSD::NoCapsForKit ? "no" : "") << " chroot, "
                            << (LOOLWSD::NoSeccomp ? "no" : "") << " api lockdown\n"
#endif
           << "  TerminationFlag: " << SigUtil::getTerminationFlag() << "\n"
           << "  isShuttingDown: " << SigUtil::getShutdownRequestFlag() << "\n"
           << "  NewChildren: " << NewChildren.size() << "\n"
           << "  OutstandingForks: " << OutstandingForks << "\n"
           << "  NumPreSpawnedChildren: " << LOOLWSD::NumPreSpawnedChildren << "\n";

        os << "Server poll:\n";
        _acceptPoll.dumpState(os);

        os << "Web Server poll:\n";
        WebServerPoll.dumpState(os);

        os << "Prisoner poll:\n";
        PrisonerPoll.dumpState(os);

#if !MOBILEAPP
        os << "Admin poll:\n";
        Admin::instance().dumpState(os);

        // If we have any delaying work going on.
        Delay::dumpState(os);
#endif

        os << "Document Broker polls "
                  << "[ " << DocBrokers.size() << " ]:\n";
        for (auto &i : DocBrokers)
            i.second->dumpState(os);
        os << "Converter count: " << ConvertToBroker::getInstanceCount() << "\n";

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
            if (SigUtil::getDumpGlobalState())
            {
                dump_state();
                SigUtil::resetDumpGlobalState();
            }
        }
    };
    /// This thread & poll accepts incoming connections.
    AcceptPoll _acceptPoll;

    /// Create a new server socket - accepted sockets will be added
    /// to the @clientSockets' poll when created with @factory.
    std::shared_ptr<ServerSocket> getServerSocket(ServerSocket::Type type, int port,
                                                  SocketPoll &clientSocket,
                                                  const std::shared_ptr<SocketFactory>& factory)
    {
        auto serverSocket = std::make_shared<ServerSocket>(
            ClientPortProto, clientSocket, factory);

        if (!serverSocket->bind(type, port))
            return nullptr;

        if (serverSocket->listen())
            return serverSocket;

        return nullptr;
    }

    /// Create the internal only, local socket for forkit / kits prisoners to talk to.
    std::shared_ptr<ServerSocket> findPrisonerServerPort()
    {
        std::shared_ptr<SocketFactory> factory = std::make_shared<PrisonerSocketFactory>();
#if !MOBILEAPP
        std::string location;
        auto socket = std::make_shared<LocalServerSocket>(PrisonerPoll, factory);;

        location = socket->bind();
        if (!location.length())
        {
            LOG_FTL("Failed to create local unix domain socket. Exiting.");
            Log::shutdown();
            _exit(EX_SOFTWARE);
            return nullptr;
        }

        if (!socket->listen())
        {
            LOG_FTL("Failed to listen on local unix domain socket at " << location << ". Exiting.");
            Log::shutdown();
            _exit(EX_SOFTWARE);
        }

        LOG_INF("Listening to prisoner connections on " << location);
        MasterLocation = location;
#else
        constexpr int DEFAULT_MASTER_PORT_NUMBER = 9981;
        std::shared_ptr<ServerSocket> socket = getServerSocket(
            ServerSocket::Type::Public, DEFAULT_MASTER_PORT_NUMBER, PrisonerPoll, factory);

        LOOLWSD::prisonerServerSocketFD = socket->getFD();
        LOG_INF("Listening to prisoner connections on #" << LOOLWSD::prisonerServerSocketFD);
#endif
        return socket;
    }

    /// Create the externally listening public socket
    std::shared_ptr<ServerSocket> findServerPort(int port)
    {
        std::shared_ptr<SocketFactory> factory;

#if ENABLE_SSL
        if (LOOLWSD::isSSLEnabled())
            factory = std::make_shared<SslSocketFactory>();
        else
#endif
            factory = std::make_shared<PlainSocketFactory>();

        std::shared_ptr<ServerSocket> socket = getServerSocket(
            ClientListenAddr, port, WebServerPoll, factory);

        while (!socket &&
#ifdef BUILDING_TESTS
               true
#else
               UnitWSD::isUnitTesting()
#endif
            )
        {
            ++port;
            LOG_INF("Client port " << (port - 1) << " is busy, trying " << port << ".");
            socket = getServerSocket(ClientListenAddr, port, WebServerPoll, factory);
        }

        if (!socket)
        {
            LOG_FTL("Failed to listen on Server port(s) (" <<
                    ClientPortNumber << '-' << port << "). Exiting.");
            _exit(EX_SOFTWARE);
        }

        ClientPortNumber = port;

#if !MOBILEAPP
        LOG_INF("Listening to client connections on port " << port);
#else
        LOG_INF("Listening to client connections on #" << socket->getFD());
#endif
        return socket;
    }
};

std::string LOOLWSD::getVersionJSON()
{
    std::string version, hash;
    Util::getVersionInfo(version, hash);
    return
        "{ \"Version\":  \"" + version + "\", "
        "\"Hash\":     \"" + hash + "\", "
        "\"Protocol\": \"" + GetProtocolVersion() + "\", "
        "\"Id\":  \"" + HostIdentifier + "\" }";
}

static LOOLWSDServer srv;

#if !MOBILEAPP
#if ENABLE_DEBUG
std::string LOOLWSD::getServerURL()
{
    return getServiceURI(LOOLWSD_TEST_LOLEAFLET_UI);
}
#endif
#endif

int LOOLWSD::innerMain()
{
#if !defined FUZZER && !MOBILEAPP
    SigUtil::setUserSignals();
    SigUtil::setFatalSignals();
    SigUtil::setTerminationSignals();
#endif

#ifdef __linux
    // down-pay all the forkit linking cost once & early.
    setenv("LD_BIND_NOW", "1", 1);

#if !MOBILEAPP
    HostIdentifier = Util::rng::getHexString(8);
    if (DisplayVersion)
    {
        std::string version, hash;
        Util::getVersionInfo(version, hash);
        LOG_INF("Loolwsd version details: " << version << " - " << hash << " - id " << HostIdentifier << " - on " << Util::getLinuxVersion());
    }
#endif
#endif

    initializeSSL();

    // Force a uniform UTF-8 locale for ourselves & our children.
    ::setenv("LC_ALL", "en_US.UTF-8", 1);
    setlocale(LC_ALL, "en_US.UTF-8");

#if !MOBILEAPP
    // We use the same option set for both parent and child loolwsd,
    // so must check options required in the parent (but not in the
    // child) separately now. Also check for options that are
    // meaningless for the parent.
    if (SysTemplate.empty())
    {
        LOG_FTL("Missing --systemplate option");
        throw MissingOptionException("systemplate");
    }

    if (LoTemplate.empty())
    {
        LOG_FTL("Missing --lotemplate option");
        throw MissingOptionException("lotemplate");
    }

    if (ChildRoot.empty())
    {
        LOG_FTL("Missing --childroot option");
        throw MissingOptionException("childroot");
    }
    else
    {
        if (ChildRoot[ChildRoot.size() - 1] != '/')
            ChildRoot += '/';

        // create a custom sub-path for parallelized unit tests.
        if (UnitBase::isUnitTesting())
        {
            ChildRoot += Util::rng::getHardRandomHexString(8) + "/";
            LOG_TRC("Creating sub-childroot: of " + ChildRoot);
        }
    }

    FileUtil::registerFileSystemForDiskSpaceChecks(ChildRoot);

    if (FileServerRoot.empty())
        FileServerRoot = Poco::Path(Application::instance().commandPath()).parent().toString();
    FileServerRoot = Poco::Path(FileServerRoot).absolute().toString();
    LOG_DBG("FileServerRoot: " << FileServerRoot);
#endif

    ClientRequestDispatcher::InitStaticFileContentCache();

    // Allocate our port - passed to prisoners.
    srv.findClientPort();

    // Start the internal prisoner server and spawn forkit,
    // which in turn forks first child.
    srv.startPrisoners();

// No need to "have at least one child" beforehand on mobile
#if !MOBILEAPP

#ifndef KIT_IN_PROCESS
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
            const int timeoutMs = ChildSpawnTimeoutMs * (LOOLWSD::NoCapsForKit ? 150 : 50);
            const auto timeout = std::chrono::milliseconds(timeoutMs);
            LOG_TRC("Waiting for a new child for a max of " << timeoutMs << " ms.");
            if (!NewChildrenCV.wait_for(lock, timeout, []() { return !NewChildren.empty(); }))
            {
                const char* msg = "Failed to fork child processes.";
                LOG_FTL(msg);
                std::cerr << "FATAL: " << msg << std::endl;
                throw std::runtime_error(msg);
            }
        }

        // Check we have at least one.
        LOG_TRC("Have " << NewChildren.size() << " new children.");
        assert(NewChildren.size() > 0);
    }
#endif

    if (LogLevel != "trace")
    {
        LOG_INF("WSD initialization complete: setting log-level to [" << LogLevel << "] as configured.");
        Log::logger().setLevel(LogLevel);
    }

#endif

    // URI with /contents are public and we don't need to anonymize them.
    Util::mapAnonymized("contents", "contents");

    // Start the server.
    srv.start();

    /// The main-poll does next to nothing:
    SocketPoll mainWait("main");
#if ENABLE_DEBUG
    std::cerr << "Ready to accept connections on port " << ClientPortNumber <<  ".\n" << std::endl;
#endif

    // Reset the child-spawn timeout to the default, now that we're set.
    ChildSpawnTimeoutMs = CHILD_TIMEOUT_MS;

    const auto startStamp = std::chrono::steady_clock::now();

    while (!SigUtil::getTerminationFlag() && !SigUtil::getShutdownRequestFlag())
    {
        UnitWSD::get().invokeTest();

        // This timeout affects the recovery time of prespawned children.
        const int waitMicroS = UnitWSD::isUnitTesting() ?
            UnitWSD::get().getTimeoutMilliSeconds() * 1000 / 4 :
            SocketPoll::DefaultPollTimeoutMicroS * 4;
        mainWait.poll(waitMicroS);

        // Wake the prisoner poll to spawn some children, if necessary.
        PrisonerPoll.wakeup();

        const std::chrono::milliseconds::rep timeSinceStartMs = std::chrono::duration_cast<std::chrono::milliseconds>(
                                            std::chrono::steady_clock::now() - startStamp).count();

        // Unit test timeout
        if (timeSinceStartMs > UnitWSD::get().getTimeoutMilliSeconds())
            UnitWSD::get().timeout();

#if ENABLE_DEBUG && !MOBILEAPP
        if (careerSpanMs > 0 && timeSinceStartMs > careerSpanMs)
        {
            LOG_INF(timeSinceStartMs << " milliseconds gone, finishing as requested. Setting ShutdownRequestFlag.");
            SigUtil::requestShutdown();
        }
#endif
    }

    // Stop the listening to new connections
    // and wait until sockets close.
    LOG_INF("Stopping server socket listening. ShutdownRequestFlag: " <<
            SigUtil::getShutdownRequestFlag() << ", TerminationFlag: " << SigUtil::getTerminationFlag());

    // Wait until documents are saved and sessions closed.
    srv.stop();

    // atexit handlers tend to free Admin before Documents
    LOG_INF("Exiting. Cleaning up lingering documents.");
#if !MOBILEAPP
    if (!SigUtil::getShutdownRequestFlag())
    {
        // This shouldn't happen, but it's fail safe to always cleanup properly.
        LOG_WRN("Exiting WSD without ShutdownRequestFlag. Setting it now.");
        SigUtil::requestShutdown();
    }
#endif

    // Don't stop the DocBroker, they will exit.
    constexpr size_t sleepMs = 500;
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

#if !defined(KIT_IN_PROCESS) && !MOBILEAPP
    // Terminate child processes
    LOG_INF("Requesting forkit process " << ForKitProcId << " to terminate.");
    SigUtil::killChild(ForKitProcId);
#endif

    srv.stopPrisoners();

    // Terminate child processes
    LOG_INF("Requesting child processes to terminate.");
    for (auto& child : NewChildren)
    {
        child->terminate();
    }

    NewChildren.clear();

#if !MOBILEAPP
#ifndef KIT_IN_PROCESS
    // Wait for forkit process finish.
    LOG_INF("Waiting for forkit process to exit");
    int status = 0;
    waitpid(ForKitProcId, &status, WUNTRACED);
    ForKitProcId = -1;
    ForKitProc.reset();
#endif

    // In case forkit didn't cleanup properly, don't leave jails behind.
    LOG_INF("Cleaning up childroot directory [" << ChildRoot << "].");
    std::vector<std::string> jails;
    File(ChildRoot).list(jails);
    for (auto& jail : jails)
    {
        const auto path = ChildRoot + jail;
        LOG_INF("Removing jail [" << path << "].");
        FileUtil::removeFile(path, true);
    }
    if (UnitBase::isUnitTesting())
    {
        LOG_TRC("Removing sub-childroot: of " + ChildRoot);
        FileUtil::removeFile(ChildRoot, true);
    }
#endif // !MOBILEAPP

    return EX_OK;
}

void LOOLWSD::cleanup()
{
#if !MOBILEAPP
    FileServerRequestHandler::uninitialize();
    JWTAuth::cleanup();

#if ENABLE_SSL
    // Finally, we no longer need SSL.
    if (LOOLWSD::isSSLEnabled())
    {
        Poco::Net::uninitializeSSL();
        Poco::Crypto::uninitializeCrypto();
        SslContext::uninitialize();
    }
#endif
#endif
    Socket::InhibitThreadChecks = true;
    SocketPoll::InhibitThreadChecks = true;

    // Delete these while the static Admin instance is still alive.
    std::lock_guard<std::mutex> docBrokersLock(DocBrokersMutex);
    DocBrokers.clear();
}

int LOOLWSD::main(const std::vector<std::string>& /*args*/)
{
#if MOBILEAPP
    SigUtil::resetTerminationFlag();
#endif

    int returnValue;

    try {
        returnValue = innerMain();
    } catch (const std::runtime_error& e) {
        LOG_FTL(e.what());
        cleanup();
        throw;
    } catch (...) {
        cleanup();
        throw;
    }

    cleanup();

    UnitWSD::get().returnValue(returnValue);

#if MOBILEAPP
    fakeSocketDumpState();
#endif

    LOG_INF("Process [loolwsd] finished.");
    return returnValue;
}

#if !MOBILEAPP

void UnitWSD::testHandleRequest(TestRequest type, UnitHTTPServerRequest& /* request */, UnitHTTPServerResponse& /* response */)
{
    switch (type)
    {
    case TestRequest::Client:
        break;
    default:
        assert(false);
        break;
    }
}

std::vector<std::shared_ptr<DocumentBroker>> LOOLWSD::getBrokersTestOnly()
{
    std::lock_guard<std::mutex> docBrokersLock(DocBrokersMutex);
    std::vector<std::shared_ptr<DocumentBroker>> result;

    for (auto& brokerIt : DocBrokers)
        result.push_back(brokerIt.second);
    return result;
}

int LOOLWSD::getClientPortNumber()
{
    return ClientPortNumber;
}

std::vector<int> LOOLWSD::getKitPids()
{
    std::vector<int> pids;
    {
        std::unique_lock<std::mutex> lock(NewChildrenMutex);
        for (const auto &child : NewChildren)
            pids.push_back(child->getPid());
    }
    {
        std::unique_lock<std::mutex> lock(DocBrokersMutex);
        for (const auto &it : DocBrokers)
        {
            int pid = it.second->getPid();
            if (pid > 0)
                pids.push_back(pid);
        }
    }
    return pids;
}

#if !defined(BUILDING_TESTS) && !defined(KIT_IN_PROCESS)
namespace Util
{

void alertAllUsers(const std::string& cmd, const std::string& kind)
{
    alertAllUsers("error: cmd=" + cmd + " kind=" + kind);
}

void alertAllUsers(const std::string& msg)
{
    alertAllUsersInternal(msg);
}

}
#endif

#endif

void dump_state()
{
    std::ostringstream oss;
    srv.dumpState(oss);

    const std::string msg = oss.str();
    fprintf(stderr, "%s\n", msg.c_str());
    LOG_TRC(msg);
}

// Avoid this in the Util::isFuzzing() case because libfuzzer defines its own main().
#if !MOBILEAPP && !LIBFUZZER

POCO_SERVER_MAIN(LOOLWSD)

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
