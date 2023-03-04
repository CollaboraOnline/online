/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>
#include <config_version.h>
#include <stdexcept>
#include "COOLWSD.hpp"
#include "ProofKey.hpp"
#include "CommandControl.hpp"
#include "HostUtil.hpp"

/* Default host used in the start test URI */
#define COOLWSD_TEST_HOST "localhost"

/* Default cool UI used in the admin console URI */
#define COOLWSD_TEST_ADMIN_CONSOLE "/browser/dist/admin/admin.html"

/* Default cool UI used in for monitoring URI */
#define COOLWSD_TEST_METRICS "/cool/getMetrics"

/* Default cool UI used in the start test URI */
#define COOLWSD_TEST_COOL_UI "/browser/" COOLWSD_VERSION_HASH "/debug.html"

/* Default document used in the start test URI */
#define COOLWSD_TEST_DOCUMENT_RELATIVE_PATH_WRITER  "test/data/hello-world.odt"
#define COOLWSD_TEST_DOCUMENT_RELATIVE_PATH_CALC    "test/data/hello-world.ods"
#define COOLWSD_TEST_DOCUMENT_RELATIVE_PATH_IMPRESS "test/data/hello-world.odp"
#define COOLWSD_TEST_DOCUMENT_RELATIVE_PATH_DRAW    "test/data/hello-world.odg"

/* Default ciphers used, when not specified otherwise */
#define DEFAULT_CIPHER_SET "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH"

// This is the main source for the coolwsd program. COOL uses several coolwsd processes: one main
// parent process that listens on the TCP port and accepts connections from COOL clients, and a
// number of child processes, each which handles a viewing (editing) session for one document.

#include <unistd.h>
#include <stdlib.h>
#include <sysexits.h>

#include <sys/types.h>
#include <sys/wait.h>
#include <sys/resource.h>

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
#include <string>
#include <thread>
#include <unordered_map>

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
#include <net/HttpHelper.hpp>
#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/Context.h>
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/SSLManager.h>

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
#include <Poco/SAX/InputSource.h>
#include <Poco/StreamCopier.h>
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
#include "ProxyRequestHandler.hpp"
#include <common/JsonUtil.hpp>
#include <common/FileUtil.hpp>
#include <common/JailUtil.hpp>
#if defined KIT_IN_PROCESS || MOBILEAPP
#  include <Kit.hpp>
#endif
#include <Log.hpp>
#include <MobileApp.hpp>
#include <Protocol.hpp>
#include <Session.hpp>
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif
#include "Storage.hpp"
#include "TraceFile.hpp"
#include <Unit.hpp>
#include "UserMessages.hpp"
#include <Util.hpp>
#include <common/ConfigUtil.hpp>
#include <common/TraceEvent.hpp>

#include <common/SigUtil.hpp>

#include <ServerSocket.hpp>

#if MOBILEAPP
#ifdef IOS
#include "ios.h"
#elif defined(GTKAPP)
#include "gtk.hpp"
#elif defined(__ANDROID__)
#include "androidapp.hpp"
#elif defined(__EMSCRIPTEN__)
#include "wasmapp.hpp"
#endif
#endif

using namespace COOLProtocol;

using Poco::DirectoryIterator;
using Poco::Exception;
using Poco::File;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Net::MessageHeader;
using Poco::Net::NameValueCollection;
using Poco::Path;
using Poco::StreamCopier;
using Poco::URI;
using Poco::Util::Application;
using Poco::Util::HelpFormatter;
using Poco::Util::LayeredConfiguration;
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

std::string COOLWSD::BuyProductUrl;
std::string COOLWSD::LatestVersion;
std::mutex COOLWSD::FetchUpdateMutex;
std::mutex COOLWSD::RemoteConfigMutex;
#endif

// Tracks the set of prisoners / children waiting to be used.
static std::mutex NewChildrenMutex;
static std::condition_variable NewChildrenCV;
static std::vector<std::shared_ptr<ChildProcess> > NewChildren;

static std::chrono::steady_clock::time_point LastForkRequestTime = std::chrono::steady_clock::now();
static std::atomic<int> OutstandingForks(0);
static std::map<std::string, std::shared_ptr<DocumentBroker> > DocBrokers;
static std::mutex DocBrokersMutex;
static Poco::AutoPtr<Poco::Util::XMLConfiguration> KitXmlConfig;

extern "C"
{
    void dump_state(void); /* easy for gdb */
    void forwardSigUsr2();
}

#if ENABLE_DEBUG && !MOBILEAPP
static std::chrono::milliseconds careerSpanMs(std::chrono::milliseconds::zero());
#endif

/// The timeout for a child to spawn, initially high, then reset to the default.
int ChildSpawnTimeoutMs = CHILD_TIMEOUT_MS * 4;
std::atomic<unsigned> COOLWSD::NumConnections;
std::unordered_set<std::string> COOLWSD::EditFileExtensions;
std::unordered_set<std::string> COOLWSD::ViewWithCommentsFileExtensions;

#if MOBILEAPP

// Or can this be retrieved in some other way?
int COOLWSD::prisonerServerSocketFD;

#else

/// Funky latency simulation basic delay (ms)
static std::size_t SimulatedLatencyMs = 0;

#endif

namespace
{

#if ENABLE_SUPPORT_KEY
inline void shutdownLimitReached(const std::shared_ptr<ProtocolHandlerInterface>& proto)
{
    if (!proto)
        return;

    const std::string error = Poco::format(PAYLOAD_UNAVAILABLE_LIMIT_REACHED, COOLWSD::MaxDocuments, COOLWSD::MaxConnections);
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

} // end anonymous namespace

#if !MOBILEAPP
/// Internal implementation to alert all clients
/// connected to any document.
void COOLWSD::alertAllUsersInternal(const std::string& msg)
{
    std::lock_guard<std::mutex> docBrokersLock(DocBrokersMutex);

    LOG_INF("Alerting all users: [" << msg << ']');

    if (UnitWSD::get().filterAlertAllusers(msg))
        return;

    for (auto& brokerIt : DocBrokers)
    {
        std::shared_ptr<DocumentBroker> docBroker = brokerIt.second;
        docBroker->addCallback([msg, docBroker](){ docBroker->alertAllUsers(msg); });
    }
}
#endif

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

#if !LIBFUZZER
// FIXME: Somewhat idiotically, the parameter to emitOneRecordingIfEnabled() should end with a
// newline, while the paramter to emitOneRecording() should not.

void TraceEvent::emitOneRecordingIfEnabled(const std::string &recording)
{
    if (COOLWSD::TraceEventFile == NULL)
        return;

    COOLWSD::writeTraceEventRecording(recording);
}

void TraceEvent::emitOneRecording(const std::string &recording)
{
    if (COOLWSD::TraceEventFile == NULL)
        return;

    if (!TraceEvent::isRecordingOn())
        return;

    COOLWSD::writeTraceEventRecording(recording + "\n");
}

#endif //!LIBFUZZER

void COOLWSD::checkSessionLimitsAndWarnClients()
{
#if !ENABLE_SUPPORT_KEY
#if !MOBILEAPP
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
            LOG_WRN("File system of [" << fs << "] is dangerously low on disk space.");
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
        Log::StreamLogger logger = Log::trace();
        if (logger.enabled())
        {
            logger << "Have " << DocBrokers.size() << " DocBrokers after cleanup.\n";
            for (auto& pair : DocBrokers)
            {
                logger << "DocumentBroker [" << pair.first << "].\n";
            }

            LOG_END_FLUSH(logger);
        }

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
/// -1 for error.
static int forkChildren(const int number)
{
    LOG_TRC("Request forkit to spawn " << number << " new child(ren)");
    Util::assertIsLocked(NewChildrenMutex);

    if (number > 0)
    {
        COOLWSD::checkDiskSpaceAndWarnClients(false);

#ifdef KIT_IN_PROCESS
        forkLibreOfficeKit(COOLWSD::ChildRoot, COOLWSD::SysTemplate, COOLWSD::LoTemplate, number);
#else
        const std::string aMessage = "spawn " + std::to_string(number) + '\n';
        LOG_DBG("MasterToForKit: " << aMessage.substr(0, aMessage.length() - 1));
        COOLWSD::sendMessageToForKit(aMessage);
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
    NewChildren.emplace_back(std::move(child));
    const size_t count = NewChildren.size();
    lock.unlock();

    LOG_INF("Have " << count << " spare " << (count == 1 ? "child" : "children")
                    << " after adding [" << pid << "]. Notifying.");

    NewChildrenCV.notify_one();
    return count;
}

#if MOBILEAPP
#ifndef IOS
std::mutex COOLWSD::lokit_main_mutex;
#endif
#endif

std::shared_ptr<ChildProcess> getNewChild_Blocks(unsigned mobileAppDocId)
{
    const auto startTime = std::chrono::steady_clock::now();

    std::unique_lock<std::mutex> lock(NewChildrenMutex);

#if !MOBILEAPP
    (void) mobileAppDocId;

    int numPreSpawn = COOLWSD::NumPreSpawnedChildren;
    ++numPreSpawn; // Replace the one we'll dispatch just now.
    LOG_DBG("getNewChild: Rebalancing children to " << numPreSpawn);
    if (rebalanceChildren(numPreSpawn) < 0)
    {
        LOG_DBG("getNewChild: rebalancing of children failed. Scheduling housekeeping to recover.");

        COOLWSD::doHousekeeping();

        // Let the caller retry after a while.
        return nullptr;
    }

    const auto timeout = std::chrono::milliseconds(ChildSpawnTimeoutMs / 2);
    LOG_TRC("Waiting for a new child for a max of " << timeout);
#else
    const auto timeout = std::chrono::hours(100);

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
            LOG_DBG("getNewChild: Have "
                    << available << " spare " << (available == 1 ? "child" : "children")
                    << " after popping [" << child->getPid() << "] to return in "
                    << std::chrono::duration_cast<std::chrono::milliseconds>(
                           std::chrono::steady_clock::now() - startTime));
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

public:
    std::string getFilename() const { return _filename; }

    /// Afterwards someone else is responsible for cleaning that up.
    void takeFile() { _filename.clear(); }

    ConvertToPartHandler()
    {
    }

    virtual ~ConvertToPartHandler()
    {
        if (!_filename.empty())
        {
            LOG_TRC("Remove un-handled temporary file '" << _filename << '\'');
            StatelessBatchBroker::removeFile(_filename);
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

        // The temporary directory is child-root/<CHILDROOT_TMP_INCOMING_PATH>.
        // Always create a random sub-directory to avoid file-name collision.
        Path tempPath = Path::forDirectory(
            FileUtil::createRandomTmpDir(COOLWSD::ChildRoot + JailUtil::CHILDROOT_TMP_INCOMING_PATH)
            + '/');
        LOG_TRC("Created temporary convert-to/insert path: " << tempPath.toString());

        // Prevent user inputting anything funny here.
        // A "filename" should always be a filename, not a path
        const Path filenameParam(params.get("filename"));
        if (filenameParam.getFileName() == "callback:")
            tempPath.setFileName("incoming_file"); // A sensible name.
        else
            tempPath.setFileName(filenameParam.getFileName()); //TODO: Sanitize.
        _filename = tempPath.toString();
        LOG_DBG("Storing incoming file to: " << _filename);

        // Copy the stream to _filename.
        std::ofstream fileStream;
        fileStream.open(_filename);
        StreamCopier::copyStream(stream, fileStream);
        fileStream.close();
    }
};

class RenderSearchResultPartHandler : public PartHandler
{
private:
    std::string _filename;
    std::shared_ptr<std::vector<char>> _pSearchResultContent;

public:
    std::string getFilename() const { return _filename; }

    /// Afterwards someone else is responsible for cleaning that up.
    void takeFile() { _filename.clear(); }

    const std::shared_ptr<std::vector<char>>& getSearchResultContent() const
    {
        return _pSearchResultContent;
    }

    RenderSearchResultPartHandler() = default;

    virtual ~RenderSearchResultPartHandler()
    {
        if (!_filename.empty())
        {
            LOG_TRC("Remove un-handled temporary file '" << _filename << '\'');
            StatelessBatchBroker::removeFile(_filename);
        }
    }

    virtual void handlePart(const MessageHeader& header, std::istream& stream) override
    {
        // Extract filename and put it to a temporary directory.
        std::string label;
        NameValueCollection content;
        if (header.has("Content-Disposition"))
        {
            MessageHeader::splitParameters(header.get("Content-Disposition"), label, content);
        }

        std::string name = content.get("name", "");
        if (name == "document")
        {
            std::string filename = content.get("filename", "");

            const Path filenameParam(filename);

            // The temporary directory is child-root/<JAIL_TMP_INCOMING_PATH>.
            // Always create a random sub-directory to avoid file-name collision.
            Path tempPath =
                Path::forDirectory(FileUtil::createRandomTmpDir(
                                       COOLWSD::ChildRoot + JailUtil::CHILDROOT_TMP_INCOMING_PATH) +
                                   '/');

            LOG_TRC("Created temporary render-search-result file path: " << tempPath.toString());

            // Prevent user inputting anything funny here.
            // A "filename" should always be a filename, not a path

            if (filenameParam.getFileName() == "callback:")
                tempPath.setFileName("incoming_file"); // A sensible name.
            else
                tempPath.setFileName(filenameParam.getFileName()); //TODO: Sanitize.
            _filename = tempPath.toString();

            // Copy the stream to _filename.
            std::ofstream fileStream;
            fileStream.open(_filename);
            StreamCopier::copyStream(stream, fileStream);
            fileStream.close();
        }
        else if (name == "result")
        {
            // Copy content from the stream into a std::vector<char>
            _pSearchResultContent = std::make_shared<std::vector<char>>(
                                       std::istreambuf_iterator<char>(stream),
                                       std::istreambuf_iterator<char>());
        }
    }
};

namespace
{

#if ENABLE_DEBUG
inline std::string getLaunchBase(bool asAdmin = false)
{
    std::ostringstream oss;
    oss << "    ";
    oss << ((COOLWSD::isSSLEnabled() || COOLWSD::isSSLTermination()) ? "https://" : "http://");

    if (asAdmin)
    {
        auto user = COOLWSD::getConfigValue<std::string>("admin_console.username", "");
        auto passwd = COOLWSD::getConfigValue<std::string>("admin_console.password", "");

        if (user.empty() || passwd.empty())
            return "";

        oss << user << ':' << passwd << '@';
    }

    oss << COOLWSD_TEST_HOST ":";
    oss << ClientPortNumber;

    return oss.str();
}

inline std::string getLaunchURI(const std::string &document)
{
    std::ostringstream oss;

    oss << getLaunchBase();
    oss << COOLWSD::ServiceRoot;
    oss << COOLWSD_TEST_COOL_UI;
    oss << "?file_path=";
    oss << DEBUG_ABSSRCDIR "/";
    oss << document;

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

namespace
{

void sendLoadResult(std::shared_ptr<ClientSession> clientSession, bool success,
                    const std::string &errorMsg)
{
    const std::string result = success ? "" : "Error while loading document";
    const std::string resultstr = success ? "true" : "false";
    // Some sane limit, otherwise we get problems transferring this
    // to the client with large strings (can be a whole webpage)
    // Replace reserved characters
    std::string errorMsgFormatted = COOLProtocol::getAbbreviatedMessage(errorMsg);
    errorMsgFormatted = Poco::translate(errorMsg, "\"", "'");
    clientSession->sendMessage("commandresult: { \"command\": \"load\", \"success\": " + resultstr +
                    ", \"result\": \"" + result + "\", \"errorMsg\": \"" + errorMsgFormatted  + "\"}");
}

} // anonymous namespace

std::atomic<uint64_t> COOLWSD::NextConnectionId(1);

#if !MOBILEAPP
#ifndef KIT_IN_PROCESS
std::atomic<int> COOLWSD::ForKitProcId(-1);
std::shared_ptr<ForKitProcess> COOLWSD::ForKitProc;
#endif
bool COOLWSD::NoCapsForKit = false;
bool COOLWSD::NoSeccomp = false;
bool COOLWSD::AdminEnabled = true;
bool COOLWSD::UnattendedRun = false;
bool COOLWSD::SignalParent = false;
std::string COOLWSD::RouteToken;
#if ENABLE_DEBUG
bool COOLWSD::SingleKit = false;
#endif
#endif
std::string COOLWSD::SysTemplate;
std::string COOLWSD::LoTemplate = LO_PATH;
std::string COOLWSD::ChildRoot;
std::string COOLWSD::ServerName;
std::string COOLWSD::FileServerRoot;
std::string COOLWSD::ServiceRoot;
std::string COOLWSD::TmpFontDir;
std::string COOLWSD::LOKitVersion;
std::string COOLWSD::ConfigFile = COOLWSD_CONFIGDIR "/coolwsd.xml";
std::string COOLWSD::ConfigDir = COOLWSD_CONFIGDIR "/conf.d";
bool COOLWSD::EnableTraceEventLogging = false;
FILE *COOLWSD::TraceEventFile = NULL;
std::string COOLWSD::LogLevel = "trace";
std::string COOLWSD::LogLevelStartup = "trace";
std::string COOLWSD::MostVerboseLogLevelSettableFromClient = "notice";
std::string COOLWSD::LeastVerboseLogLevelSettableFromClient = "fatal";
std::string COOLWSD::UserInterface = "default";
bool COOLWSD::AnonymizeUserData = false;
bool COOLWSD::CheckCoolUser = true;
bool COOLWSD::CleanupOnly = false; //< If we should cleanup and exit.
bool COOLWSD::IsProxyPrefixEnabled = false;
#if ENABLE_SSL
Util::RuntimeConstant<bool> COOLWSD::SSLEnabled;
Util::RuntimeConstant<bool> COOLWSD::SSLTermination;
#endif
unsigned COOLWSD::MaxConnections;
unsigned COOLWSD::MaxDocuments;
std::string COOLWSD::OverrideWatermark;
std::set<const Poco::Util::AbstractConfiguration*> COOLWSD::PluginConfigurations;
std::chrono::steady_clock::time_point COOLWSD::StartTime;
bool COOLWSD::IsBindMountingEnabled = true;

// If you add global state please update dumpState below too

static std::string UnitTestLibrary;

unsigned int COOLWSD::NumPreSpawnedChildren = 0;
std::unique_ptr<TraceFileWriter> COOLWSD::TraceDumper;
std::unordered_map<std::string, std::vector<std::string>> COOLWSD::QuarantineMap;
std::string COOLWSD::QuarantinePath;
#if !MOBILEAPP
std::unique_ptr<ClipboardCache> COOLWSD::SavedClipboards;
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
#endif
};

/// This thread listens for and accepts prisoner kit processes.
/// And also cleans up and balances the correct number of children.
static std::unique_ptr<PrisonPoll> PrisonerPoll;

/// The Web Server instance with the accept socket poll thread.
class COOLWSDServer;
static std::unique_ptr<COOLWSDServer> Server;

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

    void reset(const std::map<std::string, std::string>& map)
    {
        clear();
        for (const auto& pair : map)
        {
            setRaw(pair.first, pair.second);
        }
    }
};

#if !MOBILEAPP

void ForKitProcWSHandler::handleMessage(const std::vector<char> &data)
{
    LOG_TRC("ForKitProcWSHandler: handling incoming [" << COOLProtocol::getAbbreviatedMessage(&data[0], data.size()) << "].");
    const std::string firstLine = COOLProtocol::getFirstLine(&data[0], data.size());
    const StringVector tokens = StringVector::tokenize(firstLine.data(), firstLine.size());

    if (tokens.equals(0, "segfaultcount"))
    {
        int count = std::stoi(tokens[1]);
        if (count >= 0)
        {
            Admin::instance().addSegFaultCount(count);
            LOG_INF(count << " coolkit processes crashed with segmentation fault.");
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

#endif

COOLWSD::COOLWSD()
{
}

COOLWSD::~COOLWSD()
{
}

#if !MOBILEAPP

/**
  A custom socket poll to fetch remote config every 60 seconds.
  If config changes it applies the new config using LayeredConfiguration.

  The URI to fetch is read from the configuration too - it is either the
  remote config itself, or the font configuration.  It si passed via the
  uriConfigKey param.
*/
class RemoteJSONPoll : public SocketPoll
{
public:
    RemoteJSONPoll(LayeredConfiguration& config, const std::string& uriConfigKey, const std::string& name, const std::string& kind)
        : SocketPoll(name)
        , _conf(config)
        , _configKey(uriConfigKey)
        , _expectedKind(kind)
    { }

    virtual ~RemoteJSONPoll() { }

    virtual void handleJSON(Poco::JSON::Object::Ptr json) = 0;

    virtual void handleUnchangedJSON()
    { }

    void start()
    {
        Poco::URI remoteServerURI(_conf.getString(_configKey));

        if (_expectedKind == "configuration")
        {
            if (remoteServerURI.empty())
            {
                LOG_INF("Remote " << _expectedKind << " is not specified in coolwsd.xml");
                return; // no remote config server setup.
            }
#if !ENABLE_DEBUG
            if (Util::iequal(remoteServerURI.getScheme(), "http"))
            {
                LOG_ERR("Remote config url should only use HTTPS protocol: " << remoteServerURI.toString());
                return;
            }
#endif
        }

        startThread();
    }

    void pollingThread()
    {
        while (!isStop() && !SigUtil::getTerminationFlag() && !SigUtil::getShutdownRequestFlag())
        {
            Poco::URI remoteServerURI(_conf.getString(_configKey));

            // don't try to fetch from an empty URI
            bool valid = !remoteServerURI.empty();

#if !ENABLE_DEBUG
            if (Util::iequal(remoteServerURI.getScheme(), "http"))
            {
                LOG_ERR("Remote config url should only use HTTPS protocol: " << remoteServerURI.toString());
                valid = false;
            }
#endif

            if (valid)
            {
                try
                {
                    std::shared_ptr<http::Session> httpSession(
                            StorageBase::getHttpSession(remoteServerURI));
                    http::Request request(remoteServerURI.getPathAndQuery());

                    //we use ETag header to check whether JSON is modified or not
                    if (!_eTagValue.empty())
                    {
                        request.set("If-None-Match", _eTagValue);
                    }

                    const std::shared_ptr<const http::Response> httpResponse =
                        httpSession->syncRequest(request);

                    unsigned int statusCode = httpResponse->statusLine().statusCode();

                    if (statusCode == Poco::Net::HTTPResponse::HTTP_OK)
                    {
                        _eTagValue = httpResponse->get("ETag");

                        std::string body = httpResponse->getBody();

                        LOG_DBG("Got " << body.size() << " bytes for " << remoteServerURI.toString());

                        Poco::JSON::Object::Ptr remoteJson;
                        if (JsonUtil::parseJSON(body, remoteJson))
                        {
                            std::string kind;
                            JsonUtil::findJSONValue(remoteJson, "kind", kind);
                            if (kind == _expectedKind)
                            {
                                handleJSON(remoteJson);
                            }
                            else
                            {
                                LOG_ERR("Make sure that " << remoteServerURI.toString() << " contains a property 'kind' with "
                                        "value '" << _expectedKind << "'");
                            }
                        }
                        else
                        {
                            LOG_ERR("Could not parse the remote config JSON");
                        }
                    }
                    else if (statusCode == Poco::Net::HTTPResponse::HTTP_NOT_MODIFIED)
                    {
                        LOG_DBG("Not modified since last time: " << remoteServerURI.toString());
                        handleUnchangedJSON();
                    }
                    else
                    {
                        LOG_ERR("Remote config server has response status code: " +
                                std::to_string(statusCode));
                    }
                }
                catch (...)
                {
                    LOG_ERR("Failed to fetch remote config JSON, Please check JSON format");
                }
            }
            poll(std::chrono::seconds(60));
        }
    }

protected:
    LayeredConfiguration& _conf;
    std::string _eTagValue;

private:
    std::string _configKey;
    std::string _expectedKind;
};

class RemoteConfigPoll : public RemoteJSONPoll
{
public:
    RemoteConfigPoll(LayeredConfiguration& config) :
        RemoteJSONPoll(config, "remote_config.remote_url", "remoteconfig_poll", "configuration")
    {
        constexpr int PRIO_JSON = -200; // highest priority
        _persistConfig = new AppConfigMap(std::map<std::string, std::string>{});
        _conf.addWriteable(_persistConfig, PRIO_JSON);
    }

    virtual ~RemoteConfigPoll() { }

    void handleJSON(Poco::JSON::Object::Ptr remoteJson) override
    {
        std::map<std::string, std::string> newAppConfig;

        fetchAliasGroups(newAppConfig, remoteJson);

#if ENABLE_FEATURE_LOCK
        fetchLockedHostPatterns(newAppConfig, remoteJson);
        fetchLockedTranslations(newAppConfig, remoteJson);
        fetchUnlockImageUrl(newAppConfig, remoteJson);
#endif

        fetchIndirectionEndpoint(newAppConfig, remoteJson);

        fetchMonitors(newAppConfig, remoteJson);

        fetchRemoteFontConfig(newAppConfig, remoteJson);

        // before resetting get monitors list
        std::vector<std::string> oldMonitors = Admin::instance().getMonitorList();

        _persistConfig->reset(newAppConfig);

#if ENABLE_FEATURE_LOCK
        CommandControl::LockManager::parseLockedHost(_conf);
#endif
        Admin::instance().updateMonitors(oldMonitors);

        HostUtil::parseAliases(_conf);

        handleOptions(remoteJson);
    }

    void fetchLockedHostPatterns(std::map<std::string, std::string>& newAppConfig,
                                 Poco::JSON::Object::Ptr remoteJson)
    {
        try
        {
            Poco::JSON::Object::Ptr lockedHost;
            Poco::JSON::Array::Ptr lockedHostPatterns;
            try
            {
                lockedHost = remoteJson->getObject("feature_locking")->getObject("locked_hosts");
                lockedHostPatterns = lockedHost->getArray("hosts");
            }
            catch (const Poco::NullPointerException&)
            {
                LOG_INF("Overriding locked_hosts failed because feature_locking->locked_hosts->hosts array does not exist");
                return;
            }

            if (lockedHostPatterns.isNull() || lockedHostPatterns->size() == 0)
            {
                LOG_INF(
                    "Overriding locked_hosts failed because locked_hosts->hosts array is empty or null");
                return;
            }

            //use feature_lock.locked_hosts[@allow] entry from coolwsd.xml if feature_lock.locked_hosts.allow key doesnot exist in json
            Poco::Dynamic::Var allow = false;
            if (!lockedHost->has("allow"))
            {
                allow = _conf.getBool("feature_lock.locked_hosts[@allow]");
            }
            else
            {
                allow = lockedHost->get("allow");
            }
            newAppConfig.insert(std::make_pair("feature_lock.locked_hosts[@allow]", booleanToString(allow)));

            if (booleanToString(allow) == "false")
            {
                LOG_INF("locked_hosts feature is disabled, set feature_lock->locked_hosts->allow to true to enable");
                return;
            }

            std::size_t i;
            for (i = 0; i < lockedHostPatterns->size(); i++)
            {
                std::string host;
                Poco::JSON::Object::Ptr subObject = lockedHostPatterns->getObject(i);
                JsonUtil::findJSONValue(subObject, "host", host);
                Poco::Dynamic::Var readOnly = subObject->get("read_only");
                Poco::Dynamic::Var disabledCommands = subObject->get("disabled_commands");

                const std::string path =
                    "feature_lock.locked_hosts.host[" + std::to_string(i) + "]";
                newAppConfig.insert(std::make_pair(path, host));
                newAppConfig.insert(std::make_pair(path + "[@read_only]", booleanToString(readOnly)));
                newAppConfig.insert(std::make_pair(path + "[@disabled_commands]",
                                                   booleanToString(disabledCommands)));
            }

            //if number of locked wopi host patterns defined in coolwsd.xml are greater than number of host
            //fetched from json, overwrite the remaining host from config file to empty strings and
            //set read_only and disabled_commands to false
            for (;; ++i)
            {
                const std::string path =
                    "feature_lock.locked_hosts.host[" + std::to_string(i) + "]";
                if (!_conf.has(path))
                {
                    break;
                }
                newAppConfig.insert(std::make_pair(path, ""));
                newAppConfig.insert(std::make_pair(path + "[@read_only]", "false"));
                newAppConfig.insert(std::make_pair(path + "[@disabled_commands]", "false"));
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Failed to fetch locked_hosts, please check JSON format: " << exc.what());
        }
    }

    void fetchAliasGroups(std::map<std::string, std::string>& newAppConfig,
                          Poco::JSON::Object::Ptr remoteJson)
    {
        try
        {
            Poco::JSON::Object::Ptr aliasGroups;
            Poco::JSON::Array::Ptr groups;
            try
            {
                aliasGroups = remoteJson->getObject("storage")->getObject("wopi")->getObject("alias_groups");
                groups = aliasGroups->getArray("groups");
            }
            catch (const Poco::NullPointerException&)
            {
                LOG_INF("Overriding alias_groups failed because storage->wopi->alias_groups->groups array does not exist");
                return;
            }

            if (groups.isNull() || groups->size() == 0)
            {
                LOG_INF("Overriding alias_groups failed because alias_groups->groups array is empty or null");
                return;
            }

            std::string mode = "first";
            JsonUtil::findJSONValue(aliasGroups, "mode", mode);
            newAppConfig.insert(std::make_pair("storage.wopi.alias_groups[@mode]", mode));

            std::size_t i;
            for (i = 0; i < groups->size(); i++)
            {
                Poco::JSON::Object::Ptr group = groups->getObject(i);
                std::string host;
                JsonUtil::findJSONValue(group, "host", host);
                Poco::Dynamic::Var allow = group->get("allow");
                const std::string path =
                    "storage.wopi.alias_groups.group[" + std::to_string(i) + ']';

                newAppConfig.insert(std::make_pair(path + ".host", host));
                newAppConfig.insert(std::make_pair(path + ".host[@allow]", booleanToString(allow)));
#if ENABLE_FEATURE_LOCK
                std::string unlockLink;
                JsonUtil::findJSONValue(group, "unlock_link", unlockLink);
                newAppConfig.insert(std::make_pair(path + ".unlock_link", unlockLink));
#endif
                Poco::JSON::Array::Ptr aliases = group->getArray("aliases");

                size_t j = 0;
                if (aliases)
                {
                    auto it = aliases->begin();
                    for (; j < aliases->size(); j++)
                    {
                        const std::string aliasPath = path + ".alias[" + std::to_string(j) + ']';
                        newAppConfig.insert(std::make_pair(aliasPath, it->toString()));
                        it++;
                    }
                }
                for (;; j++)
                {
                    const std::string aliasPath = path + ".alias[" + std::to_string(j) + ']';
                    if (!_conf.has(aliasPath))
                    {
                        break;
                    }
                    newAppConfig.insert(std::make_pair(aliasPath, ""));
                }
            }

            //if number of alias_groups defined in configuration are greater than number of alias_group
            //fetched from json, overwrite the remaining alias_groups from config file to empty strings and
            for (;; i++)
            {
                const std::string path =
                    "storage.wopi.alias_groups.group[" + std::to_string(i) + "].host";
                if (!_conf.has(path))
                {
                    break;
                }
                newAppConfig.insert(std::make_pair(path, ""));
                newAppConfig.insert(std::make_pair(path + "[@allowed]", "false"));
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Fetching of alias groups failed with error: " << exc.what()
                                                                   << ", please check JSON format");
        }
    }

    void fetchRemoteFontConfig(std::map<std::string, std::string>& newAppConfig,
                               Poco::JSON::Object::Ptr remoteJson)
    {
        try
        {
            Poco::JSON::Object::Ptr remoteFontConfig = remoteJson->getObject("remote_font_config");

            std::string url;
            if (JsonUtil::findJSONValue(remoteFontConfig, "url", url))
                newAppConfig.insert(std::make_pair("remote_font_config.url", url));
        }
        catch (const Poco::NullPointerException&)
        {
            LOG_INF("Overriding the remote font config URL failed because the remove_font_config entry does not exist");
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Failed to fetch remote_font_config, please check JSON format: " << exc.what());
        }
    }

    void fetchLockedTranslations(std::map<std::string, std::string>& newAppConfig,
                                 Poco::JSON::Object::Ptr remoteJson)
    {
        try
        {
            Poco::JSON::Array::Ptr lockedTranslations;
            try
            {
                lockedTranslations =
                    remoteJson->getObject("feature_locking")->getArray("translations");
            }
            catch (const Poco::NullPointerException&)
            {
                LOG_INF(
                    "Overriding translations failed because feature_locking->translations array "
                    "does not exist");
                return;
            }

            if (lockedTranslations.isNull() || lockedTranslations->size() == 0)
            {
                LOG_INF("Overriding feature_locking->translations failed because array is empty or "
                        "null");
                return;
            }

            std::size_t i;
            for (i = 0; i < lockedTranslations->size(); i++)
            {
                Poco::JSON::Object::Ptr translation = lockedTranslations->getObject(i);
                std::string language;
                //default values if the one of the entry is missing in json
                std::string title = _conf.getString("feature_lock.unlock_title", "");
                std::string description = _conf.getString("feature_lock.unlock_description", "");
                std::string writerHighlights =
                    _conf.getString("feature_lock.writer_unlock_highlights", "");
                std::string impressHighlights =
                    _conf.getString("feature_lock.impress_unlock_highlights", "");
                std::string calcHighlights =
                    _conf.getString("feature_lock.calc_unlock_highlights", "");
                std::string drawHighlights =
                    _conf.getString("feature_lock.draw_unlock_highlights", "");

                JsonUtil::findJSONValue(translation, "language", language);
                JsonUtil::findJSONValue(translation, "unlock_title", title);
                JsonUtil::findJSONValue(translation, "unlock_description", description);
                JsonUtil::findJSONValue(translation, "writer_unlock_highlights", writerHighlights);
                JsonUtil::findJSONValue(translation, "calc_unlock_highlights", calcHighlights);
                JsonUtil::findJSONValue(translation, "impress_unlock_highlights",
                                        impressHighlights);
                JsonUtil::findJSONValue(translation, "draw_unlock_highlights", drawHighlights);

                const std::string path =
                    "feature_lock.translations.language[" + std::to_string(i) + ']';

                newAppConfig.insert(std::make_pair(path + "[@name]", language));
                newAppConfig.insert(std::make_pair(path + ".unlock_title", title));
                newAppConfig.insert(std::make_pair(path + ".unlock_description", description));
                newAppConfig.insert(
                    std::make_pair(path + ".writer_unlock_highlights", writerHighlights));
                newAppConfig.insert(
                    std::make_pair(path + ".calc_unlock_highlights", calcHighlights));
                newAppConfig.insert(
                    std::make_pair(path + ".impress_unlock_highlights", impressHighlights));
                newAppConfig.insert(
                    std::make_pair(path + ".draw_unlock_highlights", drawHighlights));
            }

            //if number of translations defined in configuration are greater than number of translation
            //fetched from json, overwrite the remaining translations from config file to empty strings
            for (;; i++)
            {
                const std::string path =
                    "feature_lock.translations.language[" + std::to_string(i) + "][@name]";
                if (!_conf.has(path))
                {
                    break;
                }
                newAppConfig.insert(std::make_pair(path, ""));
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Failed to fetch feature_locking->translations, please check JSON format: " << exc.what());
        }
    }

    void fetchUnlockImageUrl(std::map<std::string, std::string>& newAppConfig,
                             Poco::JSON::Object::Ptr remoteJson)
    {
        try
        {
            Poco::JSON::Object::Ptr featureLocking = remoteJson->getObject("feature_locking");

            std::string unlockImage;
            if (JsonUtil::findJSONValue(featureLocking, "unlock_image", unlockImage))
            {
                newAppConfig.insert(std::make_pair("feature_lock.unlock_image", unlockImage));
            }
        }
        catch (const Poco::NullPointerException&)
        {
            LOG_INF("Overriding unlock_image URL failed because the unlock_image entry does not "
                    "exist");
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Failed to fetch unlock_image, please check JSON format: " << exc.what());
        }
    }

    void fetchIndirectionEndpoint(std::map<std::string, std::string>& newAppConfig,
                                  Poco::JSON::Object::Ptr remoteJson)
    {
        try
        {
            Poco::JSON::Object::Ptr indirectionEndpoint =
                remoteJson->getObject("indirection_endpoint");

            std::string url;
            if (JsonUtil::findJSONValue(indirectionEndpoint, "url", url))
            {
                newAppConfig.insert(std::make_pair("indirection_endpoint.url", url));
            }
        }
        catch (const Poco::NullPointerException&)
        {
            LOG_INF("Overriding indirection_endpoint.url failed because the indirection_endpoint.url "
                    "entry does not "
                    "exist");
        }
        catch (const std::exception& exc)
        {
            LOG_ERR(
                "Failed to fetch indirection_endpoint, please check JSON format: " << exc.what());
        }
    }

    void fetchMonitors(std::map<std::string, std::string>& newAppConfig,
                       Poco::JSON::Object::Ptr remoteJson)
    {
        Poco::JSON::Array::Ptr monitors;
        try
        {
            monitors = remoteJson->getArray("monitors");
        }
        catch (const Poco::NullPointerException&)
        {
            LOG_INF("Overriding monitor failed because array "
                    "does not exist");
            return;
        }

        if (monitors.isNull() || monitors->size() == 0)
        {
            LOG_INF("Overriding monitors failed because array is empty or "
                    "null");
            return;
        }
        std::size_t i;
        for (i = 0; i < monitors->size(); i++)
            newAppConfig.insert(
                std::make_pair("monitors.monitor[" + std::to_string(i) + ']', monitors->get(i).toString()));

        //if number of monitors defined in configuration are greater than number of monitors
        //fetched from json or if the number of monitors shrinks with new json,
        //overwrite the remaining monitors from config file to empty strings
        for (;; i++)
        {
            const std::string path =
                "monitors.monitor[" + std::to_string(i) + ']';
            if (!_conf.has(path))
            {
                break;
            }
            newAppConfig.insert(std::make_pair(path, ""));
        }
    }

    void handleOptions(Poco::JSON::Object::Ptr remoteJson)
    {
        try
        {
            std::string buyProduct;
            JsonUtil::findJSONValue(remoteJson, "buy_product_url", buyProduct);
            Poco::URI buyProductUri(buyProduct);
            {
                std::lock_guard<std::mutex> lock(COOLWSD::RemoteConfigMutex);
                COOLWSD::BuyProductUrl = buyProductUri.toString();
            }
        }
        catch(const Poco::Exception& exc)
        {
            LOG_ERR("handleOptions: Exception " << exc.what());
        }
    }

    //sets property to false if it is missing from JSON
    //and returns std::string
    std::string booleanToString(Poco::Dynamic::Var& booleanFlag)
    {
        if (booleanFlag.isEmpty())
        {
            booleanFlag = "false";
        }
        return booleanFlag.toString();
    }

private:
    // keeps track of remote config layer
    Poco::AutoPtr<AppConfigMap> _persistConfig = nullptr;
};

class RemoteFontConfigPoll : public RemoteJSONPoll
{
public:
    RemoteFontConfigPoll(LayeredConfiguration& config)
        : RemoteJSONPoll(config, "remote_font_config.url", "remotefontconfig_poll", "fontconfiguration")
    {
    }

    virtual ~RemoteFontConfigPoll() { }

    void handleJSON(Poco::JSON::Object::Ptr remoteJson) override
    {
        // First mark all fonts we have downloaded previously as "inactive" to be able to check if
        // some font gets deleted from the list in the JSON file.
        for (auto& it : fonts)
            it.second.active = false;

        // Just pick up new fonts.
        auto fontsPtr = remoteJson->getArray("fonts");
        if (!fontsPtr)
        {
            LOG_WRN("The 'fonts' property does not exist or is not an array");
            return;
        }

        for (std::size_t i = 0; i < fontsPtr->size(); i++)
        {
            if (!fontsPtr->isObject(i))
                LOG_WRN("Element " << i << " in fonts array is not an object");
            else
            {
                const auto fontPtr = fontsPtr->getObject(i);
                const auto uriPtr = fontPtr->get("uri");
                if (uriPtr.isEmpty() || !uriPtr.isString())
                    LOG_WRN("Element in fonts array does not have an 'uri' property or it is not a string");
                else
                {
                    const std::string uri = uriPtr.toString();
                    const auto stampPtr = fontPtr->get("stamp");

                    if (!stampPtr.isEmpty() && !stampPtr.isString())
                        LOG_WRN("Element in fonts array with uri '" << uri << "' has a stamp property that is not a string, ignored");
                    else if (fonts.count(uri) == 0)
                    {
                        // First case: This font has not been downloaded.
                        if (!stampPtr.isEmpty())
                        {
                            if (downloadPlain(uri))
                            {
                                fonts[uri].stamp = stampPtr.toString();
                                fonts[uri].active = true;
                            }
                        }
                        else
                        {
                            if (downloadWithETag(uri, ""))
                            {
                                fonts[uri].active = true;
                            }
                        }
                    }
                    else if (!stampPtr.isEmpty() && stampPtr.toString() != fonts[uri].stamp)
                    {
                        // Second case: Font has been downloaded already, has a "stamp" property,
                        // and that has been changed in the JSON since it was downloaded.
                        restartForKitAndReDownloadConfigFile();
                        break;
                    }
                    else if (!stampPtr.isEmpty())
                    {
                        // Third case: Font has been downloaded already, has a "stamp" property, and
                        // that has *not* changed in the JSON since it was downloaded.
                        fonts[uri].active = true;
                    }
                    else
                    {
                        // Last case: Font has been downloaded but does not have a "stamp" property.
                        // Use ETag.
                        if (!eTagUnchanged(uri, fonts[uri].eTag))
                        {
                            restartForKitAndReDownloadConfigFile();
                            break;
                        }
                        fonts[uri].active = true;
                    }
                }
            }
        }

        // Any font that has been deleted from the JSON needs to be removed on this side, too.
        for (const auto &it : fonts)
        {
            if (!it.second.active)
            {
                LOG_DBG("Font no longer mentioned in the remote font config: " << it.first);
                restartForKitAndReDownloadConfigFile();
                break;
            }
        }
    }

    void handleUnchangedJSON() override
    {
        // Iterate over the fonts that were mentioned in the JSON file when it was last downloaded.
        for (auto& it : fonts)
        {
            // If the JSON has a "stamp" for the font, and we have already downloaded it, by
            // definition we don't need to do anything when the JSON file has not changed.
            if (it.second.stamp != "" && it.second.pathName != "")
                continue;

            // If the JSON has a "stamp" it must have been downloaded already. Should we even
            // assert() that?
            if (it.second.stamp != "" && it.second.pathName == "")
            {
                LOG_WRN("Font at " << it.first << " was not downloaded, should have been");
                continue;
            }

            // Otherwise use the ETag to check if the font file needs re-downloading.
            if (!eTagUnchanged(it.first, it.second.eTag))
            {
                restartForKitAndReDownloadConfigFile();
                break;
            }
        }
    }

private:
    bool downloadPlain(const std::string& uri)
    {
        const Poco::URI fontUri{uri};
        std::shared_ptr<http::Session> httpSession(StorageBase::getHttpSession(fontUri));
        http::Request request(fontUri.getPathAndQuery());

        request.set("User-Agent", WOPI_AGENT_STRING);

        const std::shared_ptr<const http::Response> httpResponse
            = httpSession->syncRequest(request);

        return finishDownload(uri, httpResponse);
    }

    bool eTagUnchanged(const std::string& uri, const std::string& oldETag)
    {
        const Poco::URI fontUri{uri};
        std::shared_ptr<http::Session> httpSession(StorageBase::getHttpSession(fontUri));
        http::Request request(fontUri.getPathAndQuery());

        if (!oldETag.empty())
        {
            request.set("If-None-Match", oldETag);
        }

        request.set("User-Agent", WOPI_AGENT_STRING);

        const std::shared_ptr<const http::Response> httpResponse
            = httpSession->syncRequest(request);

        const unsigned int statusCode = httpResponse->statusLine().statusCode();

        if (statusCode == Poco::Net::HTTPResponse::HTTP_NOT_MODIFIED)
        {
            LOG_DBG("Not modified since last time: " << uri);
            return true;
        }

        return false;
    }

    bool downloadWithETag(const std::string& uri, const std::string& oldETag)
    {
        const Poco::URI fontUri{uri};
        std::shared_ptr<http::Session> httpSession(StorageBase::getHttpSession(fontUri));
        http::Request request(fontUri.getPathAndQuery());

        if (!oldETag.empty())
        {
            request.set("If-None-Match", oldETag);
        }

        request.set("User-Agent", WOPI_AGENT_STRING);

        const std::shared_ptr<const http::Response> httpResponse
            = httpSession->syncRequest(request);

        const unsigned int statusCode = httpResponse->statusLine().statusCode();

        if (statusCode == Poco::Net::HTTPResponse::HTTP_NOT_MODIFIED)
        {
            LOG_DBG("Not modified since last time: " << uri);
            return true;
        }

        if (!finishDownload(uri, httpResponse))
            return false;

        fonts[uri].eTag = httpResponse->get("ETag");
        return true;
    }

    bool finishDownload(const std::string& uri, const std::shared_ptr<const http::Response> httpResponse)
    {
        const unsigned int statusCode = httpResponse->statusLine().statusCode();

        if (statusCode != Poco::Net::HTTPResponse::HTTP_OK)
        {
            LOG_WRN("Could not fetch " << uri);
            return false;
        }

        const std::string body = httpResponse->getBody();

        std::string fontFile;

        // We intentionally use a new file name also when an updated version of a font is
        // downloaded. It causes trouble to rewrite the same file, in case it is in use in some Kit
        // process at the moment.

        // We don't remove the old file either as that also causes problems.

        // And in reality, it is a bit unclear how likely it even is that fonts downloaded through
        // this mechanism even will be updated.
        fontFile = COOLWSD::TmpFontDir + "/" + Util::encodeId(Util::rng::getNext()) + ".ttf";

        std::ofstream fontStream(fontFile);
        fontStream.write(body.data(), body.size());
        if (!fontStream.good())
        {
                LOG_ERR("Could not write to " << fontFile);
                return false;
        }

        LOG_DBG("Got " << body.size() << " bytes for " << uri << " and wrote to " << fontFile);
        fonts[uri].pathName = fontFile;

        COOLWSD::sendMessageToForKit("addfont " + fontFile);

        return true;
    }

    void restartForKitAndReDownloadConfigFile()
    {
        LOG_DBG("Downloaded font has been updated or a font has been removed. ForKit must be restarted.");
        fonts.clear();
        // Clear the saved ETag of the remote font configuration file so that it will be
        // re-downloaded, and all fonts mentioned in it re-downloaded and fed to ForKit.
        _eTagValue = "";
        COOLWSD::sendMessageToForKit("exit");
    }

    struct FontData
    {
        // Each font can have a "stamp" in the JSON that we treat just as a string. In practice it
        // can be some timestamp, but we don't parse it. If the stamp is changed, we re-download the
        // font file.
        std::string stamp;

        // If the font has no "stamp" property, we use the ETag mechanism to see if the font file
        // needs to be re-downloaded.
        std::string eTag;

        // Where the font has been stored
        std::string pathName;

        // Flag that tells whether the font is mentioned in the JSON file that is being handled.
        // Used only in handleJSON() when the JSON has been (re-)downloaded, not when the JSON was
        // unchanged in handleUnchangedJSON().
        bool active;
    };

    // The key of this map is the download URI of the font.
    std::map<std::string, FontData> fonts;
};
#endif

void COOLWSD::innerInitialize(Application& self)
{
#if !MOBILEAPP
    if (geteuid() == 0 && CheckCoolUser)
    {
        throw std::runtime_error("Do not run as root. Please run as cool user.");
    }
#endif

    Util::setApplicationPath(Poco::Path(Application::instance().commandPath()).parent().toString());

    if (!UnitWSD::init(UnitWSD::UnitType::Wsd, UnitTestLibrary))
    {
        throw std::runtime_error("Failed to load wsd unit test library.");
    }

    StartTime = std::chrono::steady_clock::now();

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
        { "allowed_languages", "de_DE en_GB en_US es_ES fr_FR it nl pt_BR pt_PT ru" },
        { "admin_console.enable_pam", "false" },
        { "child_root_path", "jails" },
        { "file_server_root_path", "browser/.." },
        { "hexify_embedded_urls", "false" },
        { "experimental_features", "false" },
        { "lo_jail_subpath", "lo" },
        { "logging.protocol", "false" },
        { "logging.anonymize.filenames", "false" }, // Deprecated.
        { "logging.anonymize.usernames", "false" }, // Deprecated.
        // { "logging.anonymize.anonymize_user_data", "false" }, // Do not set to fallback on filename/username.
        { "logging.color", "true" },
        { "logging.file.property[0]", "coolwsd.log" },
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
        { "logging.level_startup", "trace" },
        { "logging.lokit_sal_log", "-INFO-WARN" },
        { "logging.docstats", "false" },
        { "logging.userstats", "false" },
        { "browser_logging", "false" },
        { "mount_jail_tree", "true" },
        { "net.connection_timeout_secs", "30" },
        { "net.listen", "any" },
        { "net.proto", "all" },
        { "net.service_root", "" },
        { "net.proxy_prefix", "false" },
        { "num_prespawn_children", "1" },
        { "per_document.always_save_on_exit", "false" },
        { "per_document.autosave_duration_secs", "300" },
        { "per_document.cleanup.cleanup_interval_ms", "10000" },
        { "per_document.cleanup.bad_behavior_period_secs", "60" },
        { "per_document.cleanup.idle_time_secs", "300" },
        { "per_document.cleanup.limit_dirty_mem_mb", "3072" },
        { "per_document.cleanup.limit_cpu_per", "85" },
        { "per_document.cleanup.lost_kit_grace_period_secs", "120" },
        { "per_document.cleanup[@enable]", "false" },
        { "per_document.document_signing_url", VEREIGN_URL },
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
        { "per_view.group_download_as", "true" },
        { "per_view.idle_timeout_secs", "900" },
        { "per_view.out_of_focus_timeout_secs", "120" },
        { "security.capabilities", "true" },
        { "security.seccomp", "true" },
        { "security.jwt_expiry_secs", "1800" },
        { "security.enable_metrics_unauthenticated", "false" },
        { "certificates.database_path", "" },
        { "server_name", "" },
        { "ssl.ca_file_path", COOLWSD_CONFIGDIR "/ca-chain.cert.pem" },
        { "ssl.cert_file_path", COOLWSD_CONFIGDIR "/cert.pem" },
        { "ssl.enable", "true" },
        { "ssl.hpkp.max_age[@enable]", "true" },
        { "ssl.hpkp.report_uri[@enable]", "false" },
        { "ssl.hpkp[@enable]", "false" },
        { "ssl.hpkp[@report_only]", "false" },
        { "ssl.sts.enabled", "false" },
        { "ssl.sts.max_age", "31536000" },
        { "ssl.key_file_path", COOLWSD_CONFIGDIR "/key.pem" },
        { "ssl.termination", "true" },
        { "storage.filesystem[@allow]", "false" },
        // "storage.ssl.enable" - deliberately not set; for back-compat
        { "storage.wopi.max_file_size", "0" },
        { "storage.wopi[@allow]", "true" },
        { "storage.wopi.locking.refresh", "900" },
        { "sys_template_path", "systemplate" },
        { "trace_event[@enable]", "false" },
        { "trace.path[@compress]", "true" },
        { "trace.path[@snapshot]", "false" },
        { "trace[@enable]", "false" },
        { "welcome.enable", "false" },
        { "home_mode.enable", "false" },
        { "feedback.show", "true" },
#if ENABLE_FEATURE_LOCK
        { "feature_lock.locked_hosts[@allow]", "false"},
        { "feature_lock.locked_hosts.fallback[@read_only]", "false"},
        { "feature_lock.locked_hosts.fallback[@disabled_commands]", "false"},
        { "feature_lock.locked_hosts.host[0]", "localhost"},
        { "feature_lock.locked_hosts.host[0][@read_only]", "false"},
        { "feature_lock.locked_hosts.host[0][@disabled_commands]", "false"},
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
        { "quarantine_files[@enable]", "false" },
        { "quarantine_files.limit_dir_size_mb", "250" },
        { "quarantine_files.max_versions_to_maintain", "2" },
        { "quarantine_files.path", "quarantine" },
        { "quarantine_files.expiry_min", "30" },
        { "remote_config.remote_url", ""},
        { "storage.wopi.alias_groups[@mode]" , "first"},
        { "languagetool.base_url", ""},
        { "languagetool.api_key", ""},
        { "languagetool.user_name", ""},
        { "languagetool.enabled", "false"},
        { "languagetool.ssl_verification", "true"},
        { "languagetool.rest_protocol", ""},
        { "deepl.api_url", ""},
        { "deepl.auth_key", ""},
        { "deepl.enabled", "false"},
        { "zotero.enable", "true"},
        { "indirection_endpoint.url", ""}
    };

    // Set default values, in case they are missing from the config file.
    AutoPtr<AppConfigMap> defConfig(new AppConfigMap(DefAppConfig));
    conf.addWriteable(defConfig, PRIO_SYSTEM); // Lowest priority

#if !MOBILEAPP

    // Load default configuration files, if present.
    if (loadConfiguration(PRIO_DEFAULT) == 0)
    {
        // Fallback to the COOLWSD_CONFIGDIR or --config-file path.
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

    // Experimental features.
    EnableExperimental = getConfigValue<bool>(conf, "experimental_features", false);

    // Setup user interface mode
    UserInterface = getConfigValue<std::string>(conf, "user_interface.mode", "default");

    if (UserInterface == "compact")
        UserInterface = "classic";

    if (UserInterface == "tabbed")
        UserInterface = "notebookbar";

    // Set the log-level after complete initialization to force maximum details at startup.
    LogLevel = getConfigValue<std::string>(conf, "logging.level", "trace");
    MostVerboseLogLevelSettableFromClient = getConfigValue<std::string>(conf, "logging.most_verbose_level_settable_from_client", "notice");
    LeastVerboseLogLevelSettableFromClient = getConfigValue<std::string>(conf, "logging.least_verbose_level_settable_from_client", "fatal");

    setenv("COOL_LOGLEVEL", LogLevel.c_str(), true);

#if !ENABLE_DEBUG
    const std::string salLog = getConfigValue<std::string>(conf, "logging.lokit_sal_log", "-INFO-WARN");
    setenv("SAL_LOG", salLog.c_str(), 0);
#endif

    const bool withColor = getConfigValue<bool>(conf, "logging.color", true) && isatty(fileno(stderr));
    if (withColor)
    {
        setenv("COOL_LOGCOLOR", "1", true);
    }

    const auto logToFile = getConfigValue<bool>(conf, "logging.file[@enable]", false);
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

    // Log at trace level until we complete the initialization.
    LogLevelStartup = getConfigValue<std::string>(conf, "logging.level_startup", "trace");
    setenv("COOL_LOGLEVEL_STARTUP", LogLevelStartup.c_str(), true);

    Log::initialize("wsd", LogLevelStartup, withColor, logToFile, logProperties);
    if (LogLevel != LogLevelStartup)
    {
        LOG_INF("Setting log-level to [" << LogLevelStartup << "] and delaying setting to ["
                << LogLevel << "] until after WSD initialization.");
    }

    EnableTraceEventLogging = getConfigValue<bool>(conf, "trace_event[@enable]", false);

    if (EnableTraceEventLogging)
    {
        const auto traceEventFile = getConfigValue<std::string>(conf, "trace_event.path", COOLWSD_TRACEEVENTFILE);
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

    ServerName = config().getString("server_name");
    LOG_INF("Initializing coolwsd server [" << ServerName << "]. Experimental features are "
                                            << (EnableExperimental ? "enabled." : "disabled."));

    // Check deprecated settings.
    bool reuseCookies = false;
    if (getSafeConfig(conf, "storage.wopi.reuse_cookies", reuseCookies))
        LOG_WRN("NOTE: Deprecated config option storage.wopi.reuse_cookies - no longer supported.");

    // Get anonymization settings.
#if COOLWSD_ANONYMIZE_USER_DATA
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

    if (AnonymizeUserData && LogLevel == "trace" && !CleanupOnly)
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
        anonymizationSalt = getConfigValue<std::uint64_t>(conf, "logging.anonymize.anonymization_salt", 82589933);
        const std::string anonymizationSaltStr = std::to_string(anonymizationSalt);
        setenv("COOL_ANONYMIZATION_SALT", anonymizationSaltStr.c_str(), true);
    }
    FileUtil::setUrlAnonymization(AnonymizeUserData, anonymizationSalt);

    {
        std::string proto = getConfigValue<std::string>(conf, "net.proto", "");
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
        std::string listen = getConfigValue<std::string>(conf, "net.listen", "");
        if (Util::iequal(listen, "any"))
            ClientListenAddr = ServerSocket::Type::Public;
        else if (Util::iequal(listen, "loopback"))
            ClientListenAddr = ServerSocket::Type::Local;
        else
            LOG_WRN("Invalid listen address: " << listen << ". Falling back to default: 'any'" );
    }

    // Prefix for the coolwsd pages; should not end with a '/'
    ServiceRoot = getPathFromConfig("net.service_root");
    while (ServiceRoot.length() > 0 && ServiceRoot[ServiceRoot.length() - 1] == '/')
        ServiceRoot.pop_back();

    IsProxyPrefixEnabled = getConfigValue<bool>(conf, "net.proxy_prefix", false);

#if ENABLE_SSL
    COOLWSD::SSLEnabled.set(getConfigValue<bool>(conf, "ssl.enable", true));
    COOLWSD::SSLTermination.set(getConfigValue<bool>(conf, "ssl.termination", true));
#endif

    LOG_INF("SSL support: SSL is " << (COOLWSD::isSSLEnabled() ? "enabled." : "disabled."));
    LOG_INF("SSL support: termination is " << (COOLWSD::isSSLTermination() ? "enabled." : "disabled."));

    std::string allowedLanguages(config().getString("allowed_languages"));
    // Core <= 7.0.
    setenv("LOK_WHITELIST_LANGUAGES", allowedLanguages.c_str(), 1);
    // Core >= 7.1.
    setenv("LOK_ALLOWLIST_LANGUAGES", allowedLanguages.c_str(), 1);

#endif

    int pdfResolution = getConfigValue<int>(conf, "per_document.pdf_resolution_dpi", 96);
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

    SysTemplate = getPathFromConfig("sys_template_path");
    if (SysTemplate.empty())
    {
        LOG_FTL("Missing sys_template_path config entry.");
        throw MissingOptionException("systemplate");
    }

    ChildRoot = getPathFromConfig("child_root_path");
    if (ChildRoot.empty())
    {
        LOG_FTL("Missing child_root_path config entry.");
        throw MissingOptionException("childroot");
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

        // Create a custom sub-path for parallelized unit tests.
        if (UnitBase::isUnitTesting())
        {
            ChildRoot += Util::rng::getHardRandomHexString(8) + '/';
            LOG_INF("Creating sub-childroot: " + ChildRoot);
        }
        else
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
    KitXmlConfig->setBool("ssl.enable", isSSLEnabled());
    KitXmlConfig->setBool("ssl.termination", isSSLTermination());

    // We don't pass the config via command-line
    // to avoid dealing with escaping and other traps.
    std::ostringstream oss;
    KitXmlConfig->save(oss);
    setenv("COOL_CONFIG", oss.str().c_str(), true);

    // Initialize the config subsystem too.
    config::initialize(&config());

    // For some reason I can't get at this setting in ChildSession::loKitCallback().
    std::string fontsMissingHandling = config::getString("fonts_missing.handling", "log");
    setenv("FONTS_MISSING_HANDLING", fontsMissingHandling.c_str(), 1);

    IsBindMountingEnabled = getConfigValue<bool>(conf, "mount_jail_tree", true);
#if CODE_COVERAGE
    // Code coverage is not supported with bind-mounting.
    if (IsBindMountingEnabled)
    {
        LOG_WRN("Mounting is not compatible with code-coverage. Disabling.");
        IsBindMountingEnabled = false;
    }
#endif // CODE_COVERAGE

    // Setup the jails.
    JailUtil::setupChildRoot(IsBindMountingEnabled, ChildRoot, SysTemplate);

    LOG_DBG("FileServerRoot before config: " << FileServerRoot);
    FileServerRoot = getPathFromConfig("file_server_root_path");
    LOG_DBG("FileServerRoot after config: " << FileServerRoot);

    //creating quarantine directory
    if(getConfigValue<bool>(conf, "quarantine_files[@enable]", false))
    {
        QuarantinePath = getPathFromConfig("quarantine_files.path");
        if (QuarantinePath[QuarantinePath.size() - 1] != '/')
            QuarantinePath += '/';

        Poco::File p(QuarantinePath);
        p.createDirectories();
        LOG_INF("Created quarantine directory " + p.path());

        Quarantine::createQuarantineMap();
    }

    NumPreSpawnedChildren = getConfigValue<int>(conf, "num_prespawn_children", 1);
    if (NumPreSpawnedChildren < 1)
    {
        LOG_WRN("Invalid num_prespawn_children in config (" << NumPreSpawnedChildren << "). Resetting to 1.");
        NumPreSpawnedChildren = 1;
    }
    LOG_INF("NumPreSpawnedChildren set to " << NumPreSpawnedChildren << '.');

    FileUtil::registerFileSystemForDiskSpaceChecks(ChildRoot);

    const auto maxConcurrency = getConfigValue<int>(conf, "per_document.max_concurrency", 4);
    if (maxConcurrency > 0)
    {
        setenv("MAX_CONCURRENCY", std::to_string(maxConcurrency).c_str(), 1);
    }
    LOG_INF("MAX_CONCURRENCY set to " << maxConcurrency << '.');
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
#if ENABLE_WELCOME_MESSAGE
    if (getConfigValue<bool>(conf, "home_mode.enable", false))
    {
        COOLWSD::MaxConnections = 20;
        COOLWSD::MaxDocuments = 10;
    }
    else
    {
        conf.setString("feedback.show", "true");
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

#if !MOBILEAPP
    NoSeccomp = !getConfigValue<bool>(conf, "security.seccomp", true);
    NoCapsForKit = !getConfigValue<bool>(conf, "security.capabilities", true);
    AdminEnabled = getConfigValue<bool>(conf, "admin_console.enable", true);
#endif

    // LanguageTool configuration
    bool enableLanguageTool = getConfigValue<bool>(conf, "languagetool.enabled", false);
    setenv("LANGUAGETOOL_ENABLED", enableLanguageTool ? "true" : "false", 1);
    const std::string baseAPIUrl = getConfigValue<std::string>(conf, "languagetool.base_url", "");
    setenv("LANGUAGETOOL_BASEURL", baseAPIUrl.c_str(), 1);
    const std::string userName = getConfigValue<std::string>(conf, "languagetool.user_name", "");
    setenv("LANGUAGETOOL_USERNAME", userName.c_str(), 1);
    const std::string apiKey = getConfigValue<std::string>(conf, "languagetool.api_key", "");
    setenv("LANGUAGETOOL_APIKEY", apiKey.c_str(), 1);
    bool sslVerification = getConfigValue<bool>(conf, "languagetool.ssl_verification", "");
    setenv("LANGUAGETOOL_SSL_VERIFICATION", sslVerification ? "true" : "false", 1);
    const std::string restProtocol = getConfigValue<std::string>(conf, "languagetool.rest_protocol", "");
    setenv("LANGUAGETOOL_RESTPROTOCOL", restProtocol.c_str(), 1);

    // DeepL configuration
    const std::string apiURL = getConfigValue<std::string>(conf, "deepl.api_url", "");
    const std::string authKey = getConfigValue<std::string>(conf, "deepl.auth_key", "");
    setenv("DEEPL_API_URL", apiURL.c_str(), 1);
    setenv("DEEPL_AUTH_KEY", authKey.c_str(), 1);

#if ENABLE_SUPPORT_KEY
    const std::string supportKeyString = getConfigValue<std::string>(conf, "support_key", "");

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
                COOLWSD::OverrideWatermark = "";
            }
        }
    }
#endif

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

#if !defined __EMSCRIPTEN__
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
    if (getConfigValue<bool>(conf, "trace[@enable]", false))
    {
        const auto& path = getConfigValue<std::string>(conf, "trace.path", "");
        const auto recordOutgoing = getConfigValue<bool>(conf, "trace.outgoing.record", false);
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

        const auto compress = getConfigValue<bool>(conf, "trace.path[@compress]", false);
        const auto takeSnapshot = getConfigValue<bool>(conf, "trace.path[@snapshot]", false);
        TraceDumper = Util::make_unique<TraceFileWriter>(path, recordOutgoing, compress, takeSnapshot, filters);
    }

#if !MOBILEAPP
    SavedClipboards = Util::make_unique<ClipboardCache>();

    LOG_TRC("Initialize FileServerRequestHandler");
    FileServerRequestHandler::initialize();
#endif

    WebServerPoll = Util::make_unique<TerminatingPoll>("websrv_poll");

    PrisonerPoll = Util::make_unique<PrisonPoll>();

    Server = Util::make_unique<COOLWSDServer>();

    LOG_TRC("Initialize StorageBase");
    StorageBase::initialize();

#if !MOBILEAPP
    ServerApplication::initialize(self);

    DocProcSettings docProcSettings;
    docProcSettings.setLimitVirtMemMb(getConfigValue<int>("per_document.limit_virt_mem_mb", 0));
    docProcSettings.setLimitStackMemKb(getConfigValue<int>("per_document.limit_stack_mem_kb", 0));
    docProcSettings.setLimitFileSizeMb(getConfigValue<int>("per_document.limit_file_size_mb", 0));
    docProcSettings.setLimitNumberOpenFiles(getConfigValue<int>("per_document.limit_num_open_files", 0));

    DocCleanupSettings &docCleanupSettings = docProcSettings.getCleanupSettings();
    docCleanupSettings.setEnable(getConfigValue<bool>("per_document.cleanup[@enable]", false));
    docCleanupSettings.setCleanupInterval(getConfigValue<int>("per_document.cleanup.cleanup_interval_ms", 10000));
    docCleanupSettings.setBadBehaviorPeriod(getConfigValue<int>("per_document.cleanup.bad_behavior_period_secs", 60));
    docCleanupSettings.setIdleTime(getConfigValue<int>("per_document.cleanup.idle_time_secs", 300));
    docCleanupSettings.setLimitDirtyMem(getConfigValue<int>("per_document.cleanup.limit_dirty_mem_mb", 3072));
    docCleanupSettings.setLimitCpu(getConfigValue<int>("per_document.cleanup.limit_cpu_per", 85));
    docCleanupSettings.setLostKitGracePeriod(getConfigValue<int>("per_document.cleanup.lost_kit_grace_period_secs", 120));

    Admin::instance().setDefDocProcSettings(docProcSettings, false);

#if ENABLE_DEBUG
    std::string postMessageURI =
        getServiceURI("/browser/dist/framed.doc.html?file_path="
                      DEBUG_ABSSRCDIR "/" COOLWSD_TEST_DOCUMENT_RELATIVE_PATH_WRITER);
    std::cerr << "\nLaunch one of these in your browser:\n\n"
              << "    Writer:      " << getLaunchURI(COOLWSD_TEST_DOCUMENT_RELATIVE_PATH_WRITER) << '\n'
              << "    Calc:        " << getLaunchURI(COOLWSD_TEST_DOCUMENT_RELATIVE_PATH_CALC) << '\n'
              << "    Impress:     " << getLaunchURI(COOLWSD_TEST_DOCUMENT_RELATIVE_PATH_IMPRESS) << '\n'
              << "    Draw:        " << getLaunchURI(COOLWSD_TEST_DOCUMENT_RELATIVE_PATH_DRAW) << '\n'
              << "    postMessage: " << postMessageURI << std::endl;

    const std::string adminURI = getServiceURI(COOLWSD_TEST_ADMIN_CONSOLE, true);
    if (!adminURI.empty())
        std::cerr << "\nOr for the admin, monitoring, capabilities & discovery:\n\n"
                  << adminURI << '\n'
                  << getServiceURI(COOLWSD_TEST_METRICS, true) << '\n'
                  << getServiceURI("/hosting/capabilities") << '\n'
                  << getServiceURI("/hosting/discovery") << '\n';

    std::cerr << std::endl;
#endif

#else
    (void) self;
#endif
}

void COOLWSD::initializeSSL()
{
#if ENABLE_SSL
    if (!COOLWSD::isSSLEnabled())
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

    // Initialize the non-blocking server socket SSL context.
    ssl::Manager::initializeServerContext(ssl_cert_file_path, ssl_key_file_path, ssl_ca_file_path,
                                          ssl_cipher_list, ssl::CertificateVerification::Disabled);

    if (!ssl::Manager::isServerContextInitialized())
        LOG_ERR("Failed to initialize Server SSL.");
    else
        LOG_INF("Initialized Server SSL.");
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

void COOLWSD::defineOptions(OptionSet& optionSet)
{
#if !MOBILEAPP
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

#else
    (void) optionSet;
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
        std::string version, hash;
        Util::getVersionInfo(version, hash);
        std::cout << hash << std::endl;
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
        _overrideSettings[optName] = optValue;
    }
    else if (optionName == "config-file")
        ConfigFile = value;
    else if (optionName == "config-dir")
        ConfigDir = value;
    else if (optionName == "lo-template-path")
        LoTemplate = value;
    else if (optionName == "signal")
        SignalParent = true;

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

void COOLWSD::displayHelp()
{
    HelpFormatter helpFormatter(options());
    helpFormatter.setCommand(commandName());
    helpFormatter.setUsage("OPTIONS");
    helpFormatter.setHeader("Collabora Online WebSocket server.");
    helpFormatter.format(std::cout);
}

bool COOLWSD::checkAndRestoreForKit()
{
#ifdef KIT_IN_PROCESS
    return false;
#else

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
        if (!SigUtil::getShutdownRequestFlag() && !SigUtil::getTerminationFlag() && !createForKit())
        {
            // Should never fail.
            LOG_FTL("Setting ShutdownRequestFlag: Failed to spawn coolforkit.");
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
                            WEXITSTATUS(status) << '.');
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
            if (!SigUtil::getShutdownRequestFlag() && !SigUtil::getTerminationFlag() && !createForKit())
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
        docBroker->addCallback([docBroker]() {
                docBroker->autoSave(true);
            });
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
#if defined KIT_IN_PROCESS
    return true;
#else
    LOG_INF("Creating new forkit process.");

    // Creating a new forkit is always a slow process.
    ChildSpawnTimeoutMs = CHILD_TIMEOUT_MS * 4;

    std::unique_lock<std::mutex> newChildrenLock(NewChildrenMutex);

    StringVector args;
    std::string parentPath = Path(Application::instance().commandPath()).parent().toString();

#if STRACE_COOLFORKIT
    // if you want to use this, you need to sudo setcap cap_fowner,cap_chown,cap_mknod,cap_sys_chroot=ep /usr/bin/strace
    args.push_back("-o");
    args.push_back("strace.log");
    args.push_back("-f");
    args.push_back("-tt");
    args.push_back("-s");
    args.push_back("256");
    args.push_back(parentPath + "coolforkit");
#elif VALGRIND_COOLFORKIT
    NoCapsForKit = true;
    NoSeccomp = true;
//    args.push_back("--log-file=valgrind.log");
//    args.push_back("--track-fds=all");
    args.push_back("--trace-children=yes");
    args.push_back("--error-limit=no");
    args.push_back("--num-callers=128");
    std::string nocapsCopy = parentPath + "coolforkit-nocaps";
    FileUtil::copy(parentPath + "coolforkit", nocapsCopy, true, true);
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
    std::string forKitPath = parentPath + "coolforkit";
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
    PrisonerPoll->setForKitProcess(ForKitProc);

    // ForKit always spawns one.
    ++OutstandingForks;

    LOG_INF("Launching forkit process: " << forKitPath << ' ' << args.cat(' ', 0));

    LastForkRequestTime = std::chrono::steady_clock::now();
    int child = Util::spawnProcess(forKitPath, args);
    ForKitProcId = child;

    LOG_INF("Forkit process launched: " << ForKitProcId);

    // Init the Admin manager
    Admin::instance().setForKitPid(ForKitProcId);

    const int balance = COOLWSD::NumPreSpawnedChildren - OutstandingForks;
    if (balance > 0)
        rebalanceChildren(balance);

    return ForKitProcId != -1;
#endif
}

void COOLWSD::sendMessageToForKit(const std::string& message)
{
    if (PrisonerPoll)
    {
        PrisonerPoll->sendMessageToForKit(message);
    }
}

#endif // !MOBILEAPP

/// Find the DocumentBroker for the given docKey, if one exists.
/// Otherwise, creates and adds a new one to DocBrokers.
/// May return null if terminating or MaxDocuments limit is reached.
/// After returning a valid instance DocBrokers must be cleaned up after exceptions.
static std::shared_ptr<DocumentBroker>
    findOrCreateDocBroker(const std::shared_ptr<ProtocolHandlerInterface>& proto,
                          DocumentBroker::ChildType type,
                          const std::string& uri,
                          const std::string& docKey,
                          const std::string& id,
                          const Poco::URI& uriPublic,
                          unsigned mobileAppDocId = 0)
{
    LOG_INF("Find or create DocBroker for docKey [" << docKey <<
            "] for session [" << id << "] on url [" << COOLWSD::anonymizeUrl(uriPublic.toString()) << "].");

    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);

    cleanupDocBrokers();

    if (SigUtil::getShutdownRequestFlag())
    {
        // TerminationFlag implies ShutdownRequested.
        LOG_ERR((SigUtil::getTerminationFlag() ? "TerminationFlag" : "ShudownRequestedFlag")
                << " set. Not loading new session [" << id << ']');
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
        if (docBroker->isUnloading())
        {
            LOG_WRN("DocBroker with docKey ["
                    << docKey << "] is unloading. Rejecting client request to load.");
            if (proto)
            {
                const std::string msg("error: cmd=load kind=docunloading");
                proto->sendTextMessage(msg.data(), msg.size());
                proto->shutdown(true, msg);
            }
            return nullptr;
        }
    }
    else
    {
        LOG_DBG("No DocumentBroker with docKey [" << docKey << "] found. New Child and Document.");
    }

    if (SigUtil::getShutdownRequestFlag())
    {
        // TerminationFlag implies ShutdownRequested.
        LOG_ERR((SigUtil::getTerminationFlag() ? "TerminationFlag" : "ShudownRequestedFlag")
                << " set. Not loading new session [" << id << ']');
        return nullptr;
    }

    // Indicate to the client that we're connecting to the docbroker.
    if (proto)
    {
        const std::string statusConnect = "statusindicator: connect";
        LOG_TRC("Sending to Client [" << statusConnect << "].");
        proto->sendTextMessage(statusConnect.data(), statusConnect.size());
    }

    if (!docBroker)
    {
        Util::assertIsLocked(DocBrokersMutex);

        if (DocBrokers.size() + 1 > COOLWSD::MaxDocuments)
        {
            LOG_INF("Maximum number of open documents of " << COOLWSD::MaxDocuments << " reached.");
#if ENABLE_SUPPORT_KEY
            shutdownLimitReached(proto);
            return nullptr;
#endif
        }

        // Set the one we just created.
        LOG_DBG("New DocumentBroker for docKey [" << docKey << "].");
        docBroker = std::make_shared<DocumentBroker>(type, uri, uriPublic, docKey, mobileAppDocId);
        DocBrokers.emplace(docKey, docBroker);
        LOG_TRC("Have " << DocBrokers.size() << " DocBrokers after inserting [" << docKey << "].");
    }

    return docBroker;
}

/// Handles the socket that the prisoner kit connected to WSD on.
class PrisonerRequestDispatcher : public WebSocketHandler
{
    int _pid; //< The Kit's PID (for logging).
    int _socketFD; //< The socket FD to the Kit (for logging).
    std::weak_ptr<ChildProcess> _childProcess;
public:
    PrisonerRequestDispatcher()
        : WebSocketHandler(/* isClient = */ false, /* isMasking = */ true)
        , _pid(0)
        , _socketFD(0)
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
            if (!docBroker->isUnloading() && !SigUtil::getShutdownRequestFlag())
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

            std::unique_lock<std::mutex> lock = docBroker->getLock();
            docBroker->disconnectedFromKit();
        }
        else if (!SigUtil::getShutdownRequestFlag())
        {
            LOG_WRN("Unassociated Kit (" << _pid << ") disconnected unexpectedly");
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
            LOG_ERR("Invalid socket while reading incoming message.");
            return;
        }

        Poco::MemoryInputStream message(&socket->getInBuffer()[0],
                                        socket->getInBuffer().size());
        Poco::Net::HTTPRequest request;

        try
        {
#if !MOBILEAPP
            if (!socket->parseHeader("Prisoner", message, request))
                return;

            LOG_TRC("Child connection with URI [" << COOLWSD::anonymizeUrl(request.getURI()) << "].");
            Poco::URI requestURI(request.getURI());
#ifndef KIT_IN_PROCESS
            if (requestURI.getPath() == FORKIT_URI)
            {
                if (socket->getPid() != COOLWSD::ForKitProcId)
                {
                    LOG_WRN("Connection request received on " << FORKIT_URI << " endpoint from unexpected ForKit process. Skipped.");
                    return;
                }
                COOLWSD::ForKitProc = std::make_shared<ForKitProcess>(COOLWSD::ForKitProcId, socket, request);
                socket->getInBuffer().clear();
                PrisonerPoll->setForKitProcess(COOLWSD::ForKitProc);
                return;
            }
#endif
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
                LOG_ERR("Invalid PID in child URI [" << COOLWSD::anonymizeUrl(request.getURI()) << "].");
                return;
            }

            if (jailId.empty())
            {
                LOG_ERR("Invalid JailId in child URI [" << COOLWSD::anonymizeUrl(request.getURI()) << "].");
                return;
            }

            socket->getInBuffer().clear();

            LOG_INF("New child [" << pid << "], jailId: " << jailId << '.');

            UnitWSD::get().newChild(*this);
#else
            pid_t pid = 100;
            std::string jailId = "jail";
            socket->getInBuffer().clear();
#endif
            LOG_TRC("Calling make_shared<ChildProcess>, for NewChildren?");

            auto child = std::make_shared<ChildProcess>(pid, jailId, socket, request);

            _pid = pid;
            _socketFD = socket->getFD();
            child->setSMapsFD(socket->getIncomingFD());
            _childProcess = child; // weak

            // Remove from prisoner poll since there is no activity
            // until we attach the childProcess (with this socket)
            // to a docBroker, which will do the polling.
            disposition.setMove(
                [this, child](const std::shared_ptr<Socket>&)
                {
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
            docBroker->handleInput(message);
        }
        else if (child && child->getPid() > 0)
        {
            LOG_WRN("Child " << child->getPid() << " has no DocBroker to handle message: ["
                             << message->abbr() << ']');
        }
        else
        {
            LOG_ERR("Cannot handle message with unassociated Kit (PID " << _pid << "): ["
                                                                        << message->abbr());
        }
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t & /* timeoutMaxMs */) override
    {
        return POLLIN;
    }

    void performWrites(std::size_t /*capacity*/) override {}
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
class ClientRequestDispatcher final : public SimpleSocketHandler
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
    static bool allowPostFrom(const std::string &address)
    {
        static bool init = false;
        static Util::RegexListMatcher hosts;
        if (!init)
        {
            const auto& app = Poco::Util::Application::instance();
            // Parse the host allow settings.
            for (size_t i = 0; ; ++i)
            {
                const std::string path = "net.post_allow.host[" + std::to_string(i) + ']';
                const auto host = app.config().getString(path, "");
                if (!host.empty())
                {
                    LOG_INF_S("Adding trusted POST_ALLOW host: [" << host << ']');
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

    static bool allowConvertTo(const std::string& address, const Poco::Net::HTTPRequest& request)
    {
        std::string addressToCheck = address;
        std::string hostToCheck = request.getHost();
        bool allow = allowPostFrom(addressToCheck) || HostUtil::allowedWopiHost(hostToCheck);

        if (!allow)
        {
            LOG_WRN_S("convert-to: Requesting address is denied: " << addressToCheck);
            return false;
        }
        else
        {
            LOG_TRC_S("convert-to: Requesting address is allowed: " << addressToCheck);
        }

        // Handle forwarded header and make sure all participating IPs are allowed
        if (request.has("X-Forwarded-For"))
        {
            const std::string fowardedData = request.get("X-Forwarded-For");
            StringVector tokens = StringVector::tokenize(fowardedData, ',');
            for (const auto& token : tokens)
            {
                std::string param = tokens.getParam(token);
                addressToCheck = Util::trim(param);
                try
                {
                    if (!allowPostFrom(addressToCheck))
                    {
                        hostToCheck = Poco::Net::DNS::resolve(addressToCheck).name();
                        allow &= HostUtil::allowedWopiHost(hostToCheck);
                    }
                }
                catch (const Poco::Exception& exc)
                {
                    LOG_ERR_S("Poco::Net::DNS::resolve(\"" << addressToCheck
                                                           << "\") failed: " << exc.displayText());
                    // We can't find out the hostname, and it already failed the IP check
                    allow = false;
                }
                if (!allow)
                {
                    LOG_WRN_S("convert-to: Requesting address is denied: " << addressToCheck);
                    return false;
                }
                else
                {
                    LOG_INF_S("convert-to: Requesting address is allowed: " << addressToCheck);
                }
            }
        }
        return allow;
    }

private:

    /// Set the socket associated with this ResponseClient.
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _id = COOLWSD::GetConnectionId();
        _socket = socket;
        setLogContext(socket->getFD());
        LOG_TRC("Connected to ClientRequestDispatcher");
    }

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition &disposition) override
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (!socket)
        {
            LOG_ERR("Invalid socket while handling incoming client request");
            return;
        }

#if !MOBILEAPP
        if (!COOLWSD::isSSLEnabled() && socket->sniffSSL())
        {
            LOG_ERR("Looks like SSL/TLS traffic on plain http port");
            HttpHelper::sendErrorAndShutdown(400, socket);
            return;
        }

        Poco::MemoryInputStream startmessage(&socket->getInBuffer()[0],
                                             socket->getInBuffer().size());

#if 0 // debug a specific command's payload
        if (Util::findInVector(socket->getInBuffer(), "insertfile") != std::string::npos)
        {
            std::ostringstream oss;
            oss << "Debug - specific command:\n";
            socket->dumpState(oss);
            LOG_INF(oss.str());
        }
#endif

        Poco::Net::HTTPRequest request;

        StreamSocket::MessageMap map;
        if (!socket->parseHeader("Client", startmessage, request, &map))
            return;

        LOG_DBG("Handling request: " << request.getURI());
        try
        {
            // We may need to re-write the chunks moving the inBuffer.
            socket->compactChunks(&map);
            Poco::MemoryInputStream message(&socket->getInBuffer()[0],
                                            socket->getInBuffer().size());
            // update the read cursor - headers are not altered by chunks.
            message.seekg(startmessage.tellg(), std::ios::beg);

            // re-write ServiceRoot and cache.
            RequestDetails requestDetails(request, COOLWSD::ServiceRoot);
            // LOG_TRC("Request details " << requestDetails.toString());

            // Config & security ...
            if (requestDetails.isProxy())
            {
                if (!COOLWSD::IsProxyPrefixEnabled)
                    throw BadRequestException("ProxyPrefix present but net.proxy_prefix is not enabled");
                else if (!socket->isLocal())
                    throw BadRequestException("ProxyPrefix request from non-local socket");
            }

            // Routing
            if (UnitWSD::get().handleHttpRequest(request, message, socket))
            {
                // Unit testing, nothing to do here
            }
            else if (requestDetails.equals(RequestDetails::Field::Type, "browser") || requestDetails.equals(RequestDetails::Field::Type, "wopi"))
            {
                // File server
                assert(socket && "Must have a valid socket");
                constexpr auto ProxyRemote = "/remote/";
                constexpr auto ProxyRemoteLen = sizeof(ProxyRemote) - 1;
                constexpr auto ProxyRemoteStatic = "/remote/static/";
                const auto uri = requestDetails.getURI();
                const auto pos = uri.find(ProxyRemoteStatic);
                if (pos != std::string::npos)
                {
                    if (Util::endsWith(uri, "lokit-extra-img.svg"))
                    {
                        ProxyRequestHandler::handleRequest(
                            uri.substr(pos + ProxyRemoteLen), socket,
                            ProxyRequestHandler::getProxyRatingServer());
                    }
#if ENABLE_FEATURE_LOCK
                    else
                    {
                        const Poco::URI unlockImageUri =
                            CommandControl::LockManager::getUnlockImageUri();
                        if (!unlockImageUri.empty())
                        {
                            const std::string& serverUri =
                                unlockImageUri.getScheme() + "://" + unlockImageUri.getAuthority();
                            ProxyRequestHandler::handleRequest(uri.substr(pos + ProxyRemoteLen),
                                                               socket, serverUri);
                        }
                    }
#endif
                }
                else
                {
                    FileServerRequestHandler::handleRequest(request, requestDetails, message, socket);
                    socket->shutdown();
                }
            }
            else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                     requestDetails.equals(1, "adminws"))
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
            else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                     requestDetails.equals(1, "getMetrics"))
            {
                // See metrics.txt
                std::shared_ptr<Poco::Net::HTTPResponse> response(new Poco::Net::HTTPResponse());

                if (!COOLWSD::AdminEnabled)
                    throw Poco::FileAccessDeniedException("Admin console disabled");

                try
                {
                    /* WARNING: security point, we may skip authentication */
                    bool skipAuthentication = COOLWSD::getConfigValue<bool>("security.enable_metrics_unauthenticated", false);
                    if (!skipAuthentication)
                        if (!FileServerRequestHandler::isAdminLoggedIn(request, *response))
                            throw Poco::Net::NotAuthenticatedException("Invalid admin login");
                }
                catch (const Poco::Net::NotAuthenticatedException& exc)
                {
                    //LOG_ERR("FileServerRequestHandler::NotAuthenticated: " << exc.displayText());
                    http::Response httpResponse(http::StatusCode::Unauthorized);
                    httpResponse.set("Content-Type", "text/html charset=UTF-8");
                    httpResponse.set("WWW-authenticate", "Basic realm=\"online\"");
                    socket->sendAndShutdown(httpResponse);
                    socket->ignoreInput();
                    return;
                }

                response->add("Last-Modified", Util::getHttpTimeNow());
                // Ask UAs to block if they detect any XSS attempt
                response->add("X-XSS-Protection", "1; mode=block");
                // No referrer-policy
                response->add("Referrer-Policy", "no-referrer");
                response->set("Server", HTTP_SERVER_STRING);
                response->add("Content-Type", "text/plain");
                response->add("X-Content-Type-Options", "nosniff");

                disposition.setTransfer(Admin::instance(),
                                        [response](const std::shared_ptr<Socket> &moveSocket){
                                            const std::shared_ptr<StreamSocket> streamSocket =
                                                std::static_pointer_cast<StreamSocket>(moveSocket);
                                            Admin::instance().sendMetrics(streamSocket, response);
                                        });
            }
            else if (requestDetails.isGetOrHead("/"))
                handleRootRequest(requestDetails, socket);

            else if (requestDetails.isGet("/favicon.ico"))
                handleFaviconRequest(requestDetails, socket);

            else if (requestDetails.equals(0, "hosting"))
            {
                if (requestDetails.equals(1, "discovery"))
                    handleWopiDiscoveryRequest(requestDetails, socket);
                else if (requestDetails.equals(1, "capabilities"))
                    handleCapabilitiesRequest(request, socket);
            }
            else if (requestDetails.isGet("/robots.txt"))
                handleRobotsTxtRequest(request, socket);

            else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                     requestDetails.equals(1, "media"))
            {
                handleMediaRequest(request, disposition, socket);
            }
            else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                     requestDetails.equals(1, "clipboard"))
            {
//              Util::dumpHex(std::cerr, socket->getInBuffer(), "clipboard:\n"); // lots of data ...
                handleClipboardRequest(request, message, disposition, socket);
            }

            else if (requestDetails.isProxy() && requestDetails.equals(2, "ws"))
                handleClientProxyRequest(request, requestDetails, message, disposition);

            else if (requestDetails.equals(RequestDetails::Field::Type, "cool") &&
                     requestDetails.equals(2, "ws") && requestDetails.isWebSocket())
                handleClientWsUpgrade(request, requestDetails, disposition, socket);

            else if (!requestDetails.isWebSocket() &&
                     (requestDetails.equals(RequestDetails::Field::Type, "cool") ||
                     requestDetails.equals(RequestDetails::Field::Type, "lool")))
            {
                // All post requests have url prefix 'cool', except when the prefix
                // is 'lool' e.g. when integrations use the old /lool/convert-to endpoint
                handlePostRequest(requestDetails, request, message, disposition, socket);
            }
            else
            {
                LOG_ERR("Unknown resource: " << requestDetails.toString());

                // Bad request.
                HttpHelper::sendErrorAndShutdown(400, socket);
                return;
            }
        }
        catch (const BadRequestException& ex)
        {
            LOG_ERR('#' << socket->getFD() << " bad request: ["
                        << COOLProtocol::getAbbreviatedMessage(socket->getInBuffer())
                        << "]: " << ex.what());

            // Bad request.
            HttpHelper::sendErrorAndShutdown(400, socket);
            return;
        }
        catch (const std::exception& exc)
        {
            LOG_ERR('#' << socket->getFD() << " Exception while processing incoming request: [" <<
                    COOLProtocol::getAbbreviatedMessage(socket->getInBuffer()) << "]: " << exc.what());

            // Bad request.
            // NOTE: Check _wsState to choose between HTTP response or WebSocket (app-level) error.
            http::Response httpResponse(http::StatusCode::BadRequest);
            httpResponse.set("Content-Length", "0");
            socket->sendAndShutdown(httpResponse);
            socket->ignoreInput();
            return;
        }

        // if we succeeded - remove the request from our input buffer
        // we expect one request per socket
        socket->eraseFirstInputBytes(map);
#else
        Poco::Net::HTTPRequest request;

#ifdef IOS
        // The URL of the document is sent over the FakeSocket by the code in
        // -[DocumentViewController userContentController:didReceiveScriptMessage:] when it gets the
        // HULLO message from the JavaScript in global.js.

        // The "app document id", the numeric id of the document, from the appDocIdCounter in CODocument.mm.
        char *space = strchr(socket->getInBuffer().data(), ' ');
        assert(space != nullptr);

        // The socket buffer is not nul-terminated so we can't just call strtoull() on the number at
        // its end, it might be followed in memory by more digits. Is there really no better way to
        // parse the number at the end of the buffer than to copy the bytes into a nul-terminated
        // buffer?
        const size_t appDocIdLen = (socket->getInBuffer().data() + socket->getInBuffer().size()) - (space + 1);
        char *appDocIdBuffer = (char *)malloc(appDocIdLen + 1);
        memcpy(appDocIdBuffer, space + 1, appDocIdLen);
        appDocIdBuffer[appDocIdLen] = '\0';
        unsigned appDocId = std::strtoul(appDocIdBuffer, nullptr, 10);
        free(appDocIdBuffer);

        handleClientWsUpgrade(
            request, std::string(socket->getInBuffer().data(), space - socket->getInBuffer().data()),
            disposition, socket, appDocId);
#else
        handleClientWsUpgrade(
            request, RequestDetails(std::string(socket->getInBuffer().data(),
                                                socket->getInBuffer().size())),
            disposition, socket);
#endif
        socket->getInBuffer().clear();
#endif
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t & /* timeoutMaxMs */) override
    {
        return POLLIN;
    }

    void performWrites(std::size_t /*capacity*/) override {}

#if !MOBILEAPP
    void handleRootRequest(const RequestDetails& requestDetails,
                           const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Must have a valid socket");

        LOG_DBG("HTTP request: " << requestDetails.getURI());
        const std::string mimeType = "text/plain";
        const std::string responseString = "OK";

        http::Response httpResponse(http::StatusCode::OK);
        httpResponse.set("Content-Length", std::to_string(responseString.size()));
        httpResponse.set("Content-Type", mimeType);
        httpResponse.set("Last-Modified", Util::getHttpTimeNow());
        httpResponse.set("Connection", "close");
        httpResponse.writeData(socket->getOutBuffer());
        if (requestDetails.isGet())
            socket->send(responseString);
        socket->flush();
        socket->shutdown();
        LOG_INF("Sent / response successfully.");
    }

    static void handleFaviconRequest(const RequestDetails &requestDetails,
                              const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Must have a valid socket");

        LOG_TRC_S("Favicon request: " << requestDetails.getURI());
        const std::string mimeType = "image/vnd.microsoft.icon";
        std::string faviconPath = Path(Application::instance().commandPath()).parent().toString() + "favicon.ico";
        if (!File(faviconPath).exists())
            faviconPath = COOLWSD::FileServerRoot + "/favicon.ico";

        HttpHelper::sendFileAndShutdown(socket, faviconPath, mimeType);
    }

    void handleWopiDiscoveryRequest(const RequestDetails &requestDetails,
                                    const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Must have a valid socket");

        LOG_DBG("Wopi discovery request: " << requestDetails.getURI());

        std::string xml = getFileContent("discovery.xml");
        std::string srvUrl =
#if ENABLE_SSL
            ((COOLWSD::isSSLEnabled() || COOLWSD::isSSLTermination()) ? "https://" : "http://")
#else
            "http://"
#endif
            + (COOLWSD::ServerName.empty() ? requestDetails.getHostUntrusted() : COOLWSD::ServerName)
            + COOLWSD::ServiceRoot;
        if (requestDetails.isProxy())
            srvUrl = requestDetails.getProxyPrefix();
        Poco::replaceInPlace(xml, std::string("%SRV_URI%"), srvUrl);

        http::Response httpResponse(http::StatusCode::OK);
        httpResponse.setBody(xml, "text/xml");
        httpResponse.set("Last-Modified", Util::getHttpTimeNow());
        httpResponse.set("X-Content-Type-Options", "nosniff");
        LOG_TRC("Sending back discovery.xml: " << xml);
        socket->sendAndShutdown(httpResponse);
        LOG_INF("Sent discovery.xml successfully.");
    }

    void handleCapabilitiesRequest(const Poco::Net::HTTPRequest& request,
                                   const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Must have a valid socket");

        LOG_DBG("Wopi capabilities request: " << request.getURI());

        const std::string capabilities = getCapabilitiesJson(request, socket);

        http::Response httpResponse(http::StatusCode::OK);
        httpResponse.set("Last-Modified", Util::getHttpTimeNow());
        httpResponse.setBody(capabilities, "application/json");
        httpResponse.set("X-Content-Type-Options", "nosniff");
        socket->sendAndShutdown(httpResponse);
        LOG_INF("Sent capabilities.json successfully.");
    }

    static void handleClipboardRequest(const Poco::Net::HTTPRequest& request,
                                Poco::MemoryInputStream& message,
                                SocketDisposition &disposition,
                                const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Must have a valid socket");

        LOG_DBG_S("Clipboard " << ((request.getMethod() == HTTPRequest::HTTP_GET) ? "GET" : "POST")
                               << " request: " << request.getURI());

        Poco::URI requestUri(request.getURI());
        Poco::URI::QueryParameters params = requestUri.getQueryParameters();
        std::string WOPISrc, serverId, viewId, tag, mime;
        for (const auto& it : params)
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
        LOG_TRC_S("Clipboard request for us: " << serverId << " with tag " << tag);

        if (serverId != Util::getProcessIdentifier())
        {
            LOG_ERR_S("Cluster configuration error: mis-matching serverid "
                      << serverId << " vs. " << Util::getProcessIdentifier()
                      << "on request to URL: " << request.getURI());

            // we got the wrong request.
            http::Response httpResponse(http::StatusCode::BadRequest);
            httpResponse.set("Content-Length", "0");
            socket->sendAndShutdown(httpResponse);
            socket->ignoreInput();
            return;
        }

        const auto docKey = RequestDetails::getDocKey(WOPISrc);

        std::shared_ptr<DocumentBroker> docBroker;
        {
            std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
            auto it = DocBrokers.find(docKey);
            if (it != DocBrokers.end())
                docBroker = it->second;
        }

        // If we have a valid docBroker, use it.
        // Note: there is a race here as DocBroker may
        // have already exited its SocketPoll, but we
        // haven't cleaned up the DocBrokers container.
        // Since we don't care about creating a new one,
        // we simply go to the fallback below.
        if (docBroker && docBroker->isAlive())
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
                    LOG_ERR_S("Invalid zero size set clipboard content");
            }
            // Do things in the right thread.
            LOG_TRC_S("Move clipboard request " << tag << " to docbroker thread with data: "
                                                << (data ? data->length() : 0) << " bytes");
            docBroker->setupTransfer(
                disposition,
                [docBroker, type, viewId, tag, data](const std::shared_ptr<Socket>& moveSocket)
                {
                    auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);
                    docBroker->handleClipboardRequest(type, streamSocket, viewId, tag, data);
                });
            LOG_TRC_S("queued clipboard command " << type << " on docBroker fetch");
        }
        // fallback to persistent clipboards if we can
        else if (!DocumentBroker::lookupSendClipboardTag(socket, tag, false))
        {
            LOG_ERR_S("Invalid clipboard request: " << serverId << " with tag " << tag
                                                    << " and broker: " << (docBroker ? "" : "not ")
                                                    << "found");

            std::string errMsg = "Empty clipboard item / session tag " + tag;

            // Bad request.
            HttpHelper::sendErrorAndShutdown(400, socket, errMsg);
        }
    }

    static void handleRobotsTxtRequest(const Poco::Net::HTTPRequest& request,
                                const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Must have a valid socket");

        LOG_DBG_S("HTTP request: " << request.getURI());
        const std::string responseString = "User-agent: *\nDisallow: /\n";

        http::Response httpResponse(http::StatusCode::OK);
        httpResponse.set("Last-Modified", Util::getHttpTimeNow());
        httpResponse.set("Content-Length", std::to_string(responseString.size()));
        httpResponse.set("Content-Type", "text/plain");
        httpResponse.set("Connection", "close");
        httpResponse.writeData(socket->getOutBuffer());

        if (request.getMethod() == Poco::Net::HTTPRequest::HTTP_GET)
        {
            socket->send(responseString);
        }

        socket->shutdown();
        LOG_INF_S("Sent robots.txt response successfully");
    }

    static void handleMediaRequest(const Poco::Net::HTTPRequest& request,
                                   SocketDisposition& /*disposition*/,
                                   const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Must have a valid socket");

        LOG_DBG_S("Media request: " << request.getURI());

        std::string decoded;
        Poco::URI::decode(request.getURI(), decoded);
        Poco::URI requestUri(decoded);
        Poco::URI::QueryParameters params = requestUri.getQueryParameters();
        std::string WOPISrc, serverId, viewId, tag, mime;
        for (const auto& it : params)
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

        LOG_TRC_S("Media request for us: [" << serverId << "] with tag [" << tag << "] and viewId ["
                                            << viewId << ']');

        if (serverId != Util::getProcessIdentifier())
        {
            LOG_ERR_S("Cluster configuration error: mis-matching serverid ["
                      << serverId << "] vs. [" << Util::getProcessIdentifier()
                      << "] on request to URL: " << request.getURI());

            // we got the wrong request.
            http::Response httpResponse(http::StatusCode::BadRequest);
            httpResponse.set("Content-Length", "0");
            socket->sendAndShutdown(httpResponse);
            socket->ignoreInput();
            return;
        }

        const auto docKey = RequestDetails::getDocKey(WOPISrc);
        LOG_TRC_S("Looking up DocBroker with docKey [" << docKey << "] referenced in WOPISrc ["
                                                       << WOPISrc
                                                       << "] in media URL: " + request.getURI());

        std::shared_ptr<DocumentBroker> docBroker;
        {
            std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
            auto it = DocBrokers.find(docKey);
            if (it == DocBrokers.end())
            {
                LOG_ERR_S("Unknown DocBroker with docKey ["
                          << docKey << "] referenced in WOPISrc [" << WOPISrc
                          << "] in media URL: " + request.getURI());

                http::Response httpResponse(http::StatusCode::BadRequest);
                httpResponse.set("Content-Length", "0");
                socket->sendAndShutdown(httpResponse);
                socket->ignoreInput();
                return;
            }

            docBroker = it->second;
        }

        // If we have a valid docBroker, use it.
        // Note: there is a race here as DocBroker may
        // have already exited its SocketPoll, but we
        // haven't cleaned up the DocBrokers container.
        // Since we don't care about creating a new one,
        // we simply go to the fallback below.
        if (docBroker && docBroker->isAlive())
        {
            // Do things in the right thread.
            LOG_TRC_S("Move media request " << tag << " to docbroker thread");
            docBroker->handleMediaRequest(socket, tag);
        }
    }

    static std::string getContentType(const std::string& fileName)
    {
        static std::unordered_map<std::string, std::string> aContentTypes{
            { "svg", "image/svg+xml" },
            { "pot", "application/vnd.ms-powerpoint" },
            { "xla", "application/vnd.ms-excel" },

            // Writer documents
            { "sxw", "application/vnd.sun.xml.writer" },
            { "odt", "application/vnd.oasis.opendocument.text" },
            { "fodt", "application/vnd.oasis.opendocument.text-flat-xml" },

            // Calc documents
            { "sxc", "application/vnd.sun.xml.calc" },
            { "ods", "application/vnd.oasis.opendocument.spreadsheet" },
            { "fods", "application/vnd.oasis.opendocument.spreadsheet-flat-xml" },

            // Impress documents
            { "sxi", "application/vnd.sun.xml.impress" },
            { "odp", "application/vnd.oasis.opendocument.presentation" },
            { "fodp", "application/vnd.oasis.opendocument.presentation-flat-xml" },

            // Draw documents
            { "sxd", "application/vnd.sun.xml.draw" },
            { "odg", "application/vnd.oasis.opendocument.graphics" },
            { "fodg", "application/vnd.oasis.opendocument.graphics-flat-xml" },

            // Chart documents
            { "odc", "application/vnd.oasis.opendocument.chart" },

            // Text master documents
            { "sxg", "application/vnd.sun.xml.writer.global" },
            { "odm", "application/vnd.oasis.opendocument.text-master" },

            // Math documents
            // In fact Math documents are not supported at all.
            // See: https://bugs.documentfoundation.org/show_bug.cgi?id=97006
            { "sxm", "application/vnd.sun.xml.math" },
            { "odf", "application/vnd.oasis.opendocument.formula" },

            // Text template documents
            { "stw", "application/vnd.sun.xml.writer.template" },
            { "ott", "application/vnd.oasis.opendocument.text-template" },

            // Writer master document templates
            { "otm", "application/vnd.oasis.opendocument.text-master-template" },

            // Spreadsheet template documents
            { "stc", "application/vnd.sun.xml.calc.template" },
            { "ots", "application/vnd.oasis.opendocument.spreadsheet-template" },

            // Presentation template documents
            { "sti", "application/vnd.sun.xml.impress.template" },
            { "otp", "application/vnd.oasis.opendocument.presentation-template" },

            // Drawing template documents
            { "std", "application/vnd.sun.xml.draw.template" },
            { "otg", "application/vnd.oasis.opendocument.graphics-template" },

            // MS Word
            { "doc", "application/msword" },
            { "dot", "application/msword" },

            // MS Excel
            { "xls", "application/vnd.ms-excel" },

            // MS PowerPoint
            { "ppt", "application/vnd.ms-powerpoint" },

            // OOXML wordprocessing
            { "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
            { "docm", "application/vnd.ms-word.document.macroEnabled.12" },
            { "dotx", "application/vnd.openxmlformats-officedocument.wordprocessingml.template" },
            { "dotm", "application/vnd.ms-word.template.macroEnabled.12" },

            // OOXML spreadsheet
            { "xltx", "application/vnd.openxmlformats-officedocument.spreadsheetml.template" },
            { "xltm", "application/vnd.ms-excel.template.macroEnabled.12" },
            { "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
            { "xlsb", "application/vnd.ms-excel.sheet.binary.macroEnabled.12" },
            { "xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12" },

            // OOXML presentation
            { "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
            { "pptm", "application/vnd.ms-powerpoint.presentation.macroEnabled.12" },
            { "potx", "application/vnd.openxmlformats-officedocument.presentationml.template" },
            { "potm", "application/vnd.ms-powerpoint.template.macroEnabled.12" },

            // Others
            { "wpd", "application/vnd.wordperfect" },
            { "pdb", "application/x-aportisdoc" },
            { "hwp", "application/x-hwp" },
            { "wps", "application/vnd.ms-works" },
            { "wri", "application/x-mswrite" },
            { "dif", "application/x-dif-document" },
            { "slk", "text/spreadsheet" },
            { "csv", "text/csv" },
            { "dbf", "application/x-dbase" },
            { "wk1", "application/vnd.lotus-1-2-3" },
            { "cgm", "image/cgm" },
            { "dxf", "image/vnd.dxf" },
            { "emf", "image/x-emf" },
            { "wmf", "image/x-wmf" },
            { "cdr", "application/coreldraw" },
            { "vsd", "application/vnd.visio2013" },
            { "vss", "application/vnd.visio" },
            { "pub", "application/x-mspublisher" },
            { "lrf", "application/x-sony-bbeb" },
            { "gnumeric", "application/x-gnumeric" },
            { "mw", "application/macwriteii" },
            { "numbers", "application/x-iwork-numbers-sffnumbers" },
            { "oth", "application/vnd.oasis.opendocument.text-web" },
            { "p65", "application/x-pagemaker" },
            { "rtf", "text/rtf" },
            { "txt", "text/plain" },
            { "fb2", "application/x-fictionbook+xml" },
            { "cwk", "application/clarisworks" },
            { "wpg", "image/x-wpg" },
            { "pages", "application/x-iwork-pages-sffpages" },
            { "ppsx", "application/vnd.openxmlformats-officedocument.presentationml.slideshow" },
            { "key", "application/x-iwork-keynote-sffkey" },
            { "abw", "application/x-abiword" },
            { "fh", "image/x-freehand" },
            { "sxs", "application/vnd.sun.xml.chart" },
            { "602", "application/x-t602" },
            { "bmp", "image/bmp" },
            { "png", "image/png" },
            { "gif", "image/gif" },
            { "tiff", "image/tiff" },
            { "jpg", "image/jpg" },
            { "jpeg", "image/jpeg" },
            { "pdf", "application/pdf" },
        };

        const std::string sExt = Poco::Path(fileName).getExtension();

        const auto it = aContentTypes.find(sExt);
        if (it != aContentTypes.end())
            return it->second;

        return "application/octet-stream";
    }

    static bool isSpreadsheet(const std::string& fileName)
    {
        const std::string sContentType = getContentType(fileName);

        return sContentType == "application/vnd.oasis.opendocument.spreadsheet"
               || sContentType
                      == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
               || sContentType == "application/vnd.ms-excel";
    }

    void handlePostRequest(const RequestDetails &requestDetails,
                           const Poco::Net::HTTPRequest& request,
                           Poco::MemoryInputStream& message,
                           SocketDisposition& disposition,
                           const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Must have a valid socket");

        LOG_INF("Post request: [" << COOLWSD::anonymizeUrl(requestDetails.getURI()) << ']');

        if (requestDetails.equals(1, "convert-to"))
        {
            // Validate sender - FIXME: should do this even earlier.
            if (!allowConvertTo(socket->clientAddress(), request))
            {
                LOG_WRN("Conversion requests not allowed from this address: " << socket->clientAddress());
                http::Response httpResponse(http::StatusCode::Forbidden);
                httpResponse.set("Content-Length", "0");
                socket->sendAndShutdown(httpResponse);
                socket->ignoreInput();
                return;
            }

            ConvertToPartHandler handler;
            HTMLForm form(request, message, handler);

            std::string format = (form.has("format") ? form.get("format") : "");
            // prefer what is in the URI
            if (requestDetails.size() > 2)
                format = requestDetails[2];

            const std::string fromPath = handler.getFilename();
            LOG_INF("Conversion request for URI [" << fromPath << "] format [" << format << "].");
            if (!fromPath.empty() && !format.empty())
            {
                Poco::URI uriPublic = RequestDetails::sanitizeURI(fromPath);
                const std::string docKey = RequestDetails::getDocKey(uriPublic);

                std::string options;
                if (form.has("options"))
                {
                    // Allow specifying options as-is, in case only data + format are used.
                    options = form.get("options");
                }

                const bool fullSheetPreview
                    = (form.has("FullSheetPreview") && form.get("FullSheetPreview") == "true");
                if (fullSheetPreview && format == "pdf" && isSpreadsheet(fromPath))
                {
                    //FIXME: We shouldn't have "true" as having the option already implies that
                    // we want it enabled (i.e. we shouldn't set the option if we don't want it).
                    options = ",FullSheetPreview=trueFULLSHEETPREVEND";
                }
                const std::string pdfVer = (form.has("PDFVer") ? form.get("PDFVer") : "");
                if (!pdfVer.empty())
                {
                    if (strcasecmp(pdfVer.c_str(), "PDF/A-1b") && strcasecmp(pdfVer.c_str(), "PDF/A-2b") && strcasecmp(pdfVer.c_str(), "PDF/A-3b")
                        && strcasecmp(pdfVer.c_str(), "PDF-1.5") && strcasecmp(pdfVer.c_str(), "PDF-1.6"))
                    {
                        LOG_ERR("Wrong PDF type: " << pdfVer << ". Conversion aborted.");
                        http::Response httpResponse(http::StatusCode::BadRequest);
                        httpResponse.set("Content-Length", "0");
                        socket->sendAndShutdown(httpResponse);
                        socket->ignoreInput();
                        return;
                    }
                   options += ",PDFVer=" + pdfVer + "PDFVEREND";
                }

                std::string lang = (form.has("lang") ? form.get("lang") : "");

                // This lock could become a bottleneck.
                // In that case, we can use a pool and index by publicPath.
                std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);

                LOG_DBG("New DocumentBroker for docKey [" << docKey << "].");
                auto docBroker = std::make_shared<ConvertToBroker>(fromPath, uriPublic, docKey, format, options, lang);
                handler.takeFile();

                cleanupDocBrokers();

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
        else if (requestDetails.equals(2, "insertfile"))
        {
            LOG_INF("Insert file request.");

            ConvertToPartHandler handler;
            HTMLForm form(request, message, handler);

            if (form.has("childid") && form.has("name"))
            {
                const std::string formChildid(form.get("childid"));
                const std::string formName(form.get("name"));

                // Validate the docKey
                const std::string decodedUri = requestDetails.getDocumentURI();
                const std::string docKey = RequestDetails::getDocKey(decodedUri);

                std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
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
                    const std::string dirPath = COOLWSD::ChildRoot + formChildid
                                              + JAILED_DOCUMENT_ROOT + "insertfile";
                    const std::string fileName = dirPath + '/' + form.get("name");
                    LOG_INF("Perform insertfile: " << formChildid << ", " << formName << ", filename: " << fileName);
                    File(dirPath).createDirectories();
                    File(handler.getFilename()).moveTo(fileName);

                    // Cleanup the directory after moving.
                    const std::string dir = Poco::Path(handler.getFilename()).parent().toString();
                    if (FileUtil::isEmptyDirectory(dir))
                        FileUtil::removeFile(dir);

                    handler.takeFile();

                    http::Response httpResponse(http::StatusCode::OK);
                    httpResponse.set("Content-Length", "0");
                    socket->sendAndShutdown(httpResponse);
                    socket->ignoreInput();
                    return;
                }
            }
        }
        else if (requestDetails.equals(2, "download"))
        {
            LOG_INF("File download request.");
            // TODO: Check that the user in question has access to this file!

            // 1. Validate the dockey
            const std::string decodedUri = requestDetails.getDocumentURI();
            const std::string docKey = RequestDetails::getDocKey(decodedUri);

            std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);
            auto docBrokerIt = DocBrokers.find(docKey);
            if (docBrokerIt == DocBrokers.end())
            {
                throw BadRequestException("DocKey [" + docKey + "] is invalid.");
            }

            std::string downloadId = requestDetails[3];
            std::string url = docBrokerIt->second->getDownloadURL(downloadId);
            docBrokerIt->second->unregisterDownloadId(downloadId);
            std::string jailId = docBrokerIt->second->getJailId();

            docBrokersLock.unlock();

            bool foundDownloadId = !url.empty();

            std::string decoded;
            Poco::URI::decode(url, decoded);

            const Path filePath(COOLWSD::ChildRoot + jailId + JAILED_DOCUMENT_ROOT + decoded);
            const std::string filePathAnonym = COOLWSD::anonymizeUrl(filePath.toString());

            if (foundDownloadId && filePath.isAbsolute() && File(filePath).exists())
            {
                LOG_INF("HTTP request for: " << filePathAnonym);

                const std::string& fileName = filePath.getFileName();
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

                Poco::Net::HTTPResponse response;

                // Instruct browsers to download the file, not display it
                // with the exception of SVG where we need the browser to
                // actually show it.
                const std::string contentType = getContentType(fileName);
                if (serveAsAttachment && contentType != "image/svg+xml")
                    response.set("Content-Disposition", "attachment; filename=\"" + fileName + '"');

                try
                {
                    HttpHelper::sendFileAndShutdown(socket, filePath.toString(), contentType, &response);
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
                if (foundDownloadId)
                    LOG_ERR("Download file [" << filePathAnonym << "] not found.");
                else
                    LOG_ERR("Download with id [" << downloadId << "] not found.");

                http::Response httpResponse(http::StatusCode::NotFound);
                httpResponse.set("Content-Length", "0");
                socket->sendAndShutdown(httpResponse);
            }
            return;
        }
        else if (requestDetails.equals(1, "render-search-result"))
        {
            RenderSearchResultPartHandler handler;
            HTMLForm form(request, message, handler);

            const std::string fromPath = handler.getFilename();

            LOG_INF("Create render-search-result POST command handler");

            if (fromPath.empty())
                return;

            Poco::URI uriPublic = RequestDetails::sanitizeURI(fromPath);
            const std::string docKey = RequestDetails::getDocKey(uriPublic);

            // This lock could become a bottleneck.
            // In that case, we can use a pool and index by publicPath.
            std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);

            LOG_DBG("New DocumentBroker for docKey [" << docKey << "].");
            auto docBroker = std::make_shared<RenderSearchResultBroker>(fromPath, uriPublic, docKey, handler.getSearchResultContent());
            handler.takeFile();

            cleanupDocBrokers();

            DocBrokers.emplace(docKey, docBroker);
            LOG_TRC("Have " << DocBrokers.size() << " DocBrokers after inserting [" << docKey << "].");

            if (!docBroker->executeCommand(disposition, _id))
            {
                LOG_WRN("Failed to create Client Session with id [" << _id << "] on docKey [" << docKey << "].");
                cleanupDocBrokers();
            }

            return;
        }

        throw BadRequestException("Invalid or unknown request.");
    }

    void handleClientProxyRequest(const Poco::Net::HTTPRequest& request,
                                  const RequestDetails &requestDetails,
                                  Poco::MemoryInputStream& message,
                                  SocketDisposition &disposition)
    {
        //FIXME: The DocumentURI includes the WOPISrc, which makes it potentially invalid URI.
        const std::string url = requestDetails.getLegacyDocumentURI();

        LOG_INF("URL [" << url << "] for Proxy request.");
        const auto uriPublic = RequestDetails::sanitizeURI(url);
        const auto docKey = RequestDetails::getDocKey(uriPublic);
        const std::string fileId = Util::getFilenameFromURL(docKey);
        Util::mapAnonymized(fileId, fileId); // Identity mapping, since fileId is already obfuscated

        LOG_INF("Starting Proxy request handler for session [" << _id << "] on url [" << COOLWSD::anonymizeUrl(url) << "].");

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

        LOG_INF("URL [" << COOLWSD::anonymizeUrl(url) << "] is " << (isReadOnly ? "readonly" : "writable") << '.');
        (void)request; (void)message; (void)disposition;

        std::shared_ptr<ProtocolHandlerInterface> none;
        // Request a kit process for this doc.
        std::shared_ptr<DocumentBroker> docBroker = findOrCreateDocBroker(
            none, DocumentBroker::ChildType::Interactive, url, docKey, _id, uriPublic);
        if (docBroker)
        {
            // need to move into the DocumentBroker context before doing session lookup / creation etc.
            std::string id = _id;
            docBroker->setupTransfer(disposition, [docBroker, id, uriPublic,
                                     isReadOnly, requestDetails]
                                    (const std::shared_ptr<Socket> &moveSocket)
                {
                    // Now inside the document broker thread ...
                    LOG_TRC_S("In the docbroker thread for " << docBroker->getDocKey());

                    const int fd = moveSocket->getFD();
                    auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);
                    try
                    {
                        docBroker->handleProxyRequest(
                            id, uriPublic, isReadOnly,
                            requestDetails, streamSocket);
                        return;
                    }
                    catch (const UnauthorizedRequestException& exc)
                    {
                        LOG_ERR_S("Unauthorized Request while starting session on "
                                  << docBroker->getDocKey() << " for socket #" << fd
                                  << ". Terminating connection. Error: " << exc.what());
                    }
                    catch (const StorageConnectionException& exc)
                    {
                        LOG_ERR_S("Storage error while starting session on "
                                  << docBroker->getDocKey() << " for socket #" << fd
                                  << ". Terminating connection. Error: " << exc.what());
                    }
                    catch (const std::exception& exc)
                    {
                        LOG_ERR_S("Error while starting session on "
                                  << docBroker->getDocKey() << " for socket #" << fd
                                  << ". Terminating connection. Error: " << exc.what());
                    }
                    // badness occurred:
                    HttpHelper::sendErrorAndShutdown(400, streamSocket);
                });
        }
        else
        {
            auto streamSocket = std::static_pointer_cast<StreamSocket>(disposition.getSocket());
            LOG_ERR("Failed to find document");
            // badness occurred:
            HttpHelper::sendErrorAndShutdown(400, streamSocket);
            // FIXME: send docunloading & re-try on client ?
        }
    }
#endif

    void handleClientWsUpgrade(const Poco::Net::HTTPRequest& request,
                               const RequestDetails &requestDetails,
                               SocketDisposition& disposition,
                               const std::shared_ptr<StreamSocket>& socket,
                               unsigned mobileAppDocId = 0)
    {
        const std::string url = requestDetails.getDocumentURI();
        assert(socket && "Must have a valid socket");

        // must be trace for anonymization
        LOG_TRC("Client WS request: " << requestDetails.getURI() << ", url: " << url << ", socket #" << socket->getFD());

        // First Upgrade.
        auto ws = std::make_shared<WebSocketHandler>(socket, request);

        // Response to clients beyond this point is done via WebSocket.
        try
        {
            if (COOLWSD::NumConnections >= COOLWSD::MaxConnections)
            {
                LOG_INF("Limit on maximum number of connections of " << COOLWSD::MaxConnections << " reached.");
#if ENABLE_SUPPORT_KEY
                shutdownLimitReached(ws);
                return;
#endif
            }

            LOG_INF("URL [" << url << "] for WS Request.");
            const auto uriPublic = RequestDetails::sanitizeURI(url);
            const auto docKey = RequestDetails::getDocKey(uriPublic);
            const std::string fileId = Util::getFilenameFromURL(docKey);
            Util::mapAnonymized(fileId, fileId); // Identity mapping, since fileId is already obfuscated

            LOG_INF("Starting GET request handler for session [" << _id << "] on url [" << COOLWSD::anonymizeUrl(url) << "].");

            // Indicate to the client that document broker is searching.
            static const std::string status("statusindicator: find");
            LOG_TRC("Sending to Client [" << status << "].");
            ws->sendMessage(status);

            LOG_INF("Sanitized URI [" << COOLWSD::anonymizeUrl(url) << "] to [" << COOLWSD::anonymizeUrl(uriPublic.toString()) <<
                    "] and mapped to docKey [" << docKey << "] for session [" << _id << "].");

            // Check if readonly session is required
            bool isReadOnly = false;
            for (const auto& param : uriPublic.getQueryParameters())
            {
                LOG_TRC("Query param: " << param.first << ", value: " << param.second);
                if (param.first == "permission" && param.second == "readonly")
                {
                    isReadOnly = true;
                }
            }

            LOG_INF("URL [" << COOLWSD::anonymizeUrl(url) << "] is " << (isReadOnly ? "readonly" : "writable") << '.');

            // Request a kit process for this doc.
            std::shared_ptr<DocumentBroker> docBroker = findOrCreateDocBroker(
                std::static_pointer_cast<ProtocolHandlerInterface>(ws),
                DocumentBroker::ChildType::Interactive, url, docKey, _id, uriPublic, mobileAppDocId);
            if (docBroker)
            {
                std::shared_ptr<ClientSession> clientSession =
                    docBroker->createNewClientSession(ws, _id, uriPublic, isReadOnly, requestDetails);
                if (clientSession)
                {
                    // Transfer the client socket to the DocumentBroker when we get back to the poll:
                    docBroker->setupTransfer(disposition, [docBroker, clientSession, ws]
                                            (const std::shared_ptr<Socket> &moveSocket)
                    {
                        try
                        {
                            auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);

                            // Set WebSocketHandler's socket after its construction for shared_ptr goodness.
                            streamSocket->setHandler(ws);

                            LOG_DBG_S('#' << moveSocket->getFD() << " handler is "
                                          << clientSession->getName());

                            // Add and load the session.
                            docBroker->addSession(clientSession);

                            COOLWSD::checkDiskSpaceAndWarnClients(true);
                            // Users of development versions get just an info
                            // when reaching max documents or connections
                            COOLWSD::checkSessionLimitsAndWarnClients();

                            sendLoadResult(clientSession, true, "");
                        }
                        catch (const UnauthorizedRequestException& exc)
                        {
                            LOG_ERR_S("Unauthorized Request while starting session on "
                                      << docBroker->getDocKey() << " for socket #"
                                      << moveSocket->getFD()
                                      << ". Terminating connection. Error: " << exc.what());
                            const std::string msg = "error: cmd=internal kind=unauthorized";
                            ws->shutdown(WebSocketHandler::StatusCodes::POLICY_VIOLATION, msg);
                            moveSocket->ignoreInput();
                        }
                        catch (const StorageConnectionException& exc)
                        {
                            LOG_ERR_S("Storage error while starting session on "
                                      << docBroker->getDocKey() << " for socket #"
                                      << moveSocket->getFD()
                                      << ". Terminating connection. Error: " << exc.what());
                            const std::string msg = "error: cmd=storage kind=loadfailed";
                            ws->shutdown(WebSocketHandler::StatusCodes::POLICY_VIOLATION, msg);
                            moveSocket->ignoreInput();
                        }
                        catch (const std::exception& exc)
                        {
                            LOG_ERR_S("Error while starting session on "
                                      << docBroker->getDocKey() << " for socket #"
                                      << moveSocket->getFD()
                                      << ". Terminating connection. Error: " << exc.what());
                            const std::string msg = "error: cmd=storage kind=loadfailed";
                            ws->shutdown(WebSocketHandler::StatusCodes::POLICY_VIOLATION, msg);
                            moveSocket->ignoreInput();
                        }
                    });
                }
                else
                {
                    LOG_WRN("Failed to create Client Session with id [" << _id << "] on docKey [" << docKey << "].");
                    throw std::runtime_error("Cannot create client session for doc " + docKey);
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
            socket->ignoreInput();
        }
    }

    /// Lookup cached file content.
    static const std::string& getFileContent(const std::string& filename)
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
            discoveryPath = COOLWSD::FileServerRoot + "/discovery.xml";
        }

        const std::string action = "action";
        const std::string favIconUrl = "favIconUrl";
        const std::string urlsrc = "urlsrc";

        const std::string rootUriValue = "%SRV_URI%";
        const std::string uriBaseValue = rootUriValue + "/browser/" COOLWSD_VERSION_HASH "/";
        const std::string uriValue = uriBaseValue + "cool.html?";

        LOG_DBG_S("Processing discovery.xml from " << discoveryPath);
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
            {
                const std::string ext = elem->getAttribute("ext");
                if (COOLWSD::EditFileExtensions.insert(ext).second) // Skip duplicates.
                    LOG_DBG_S("Enabling editing of [" << ext << "] extension files");
            }
            else if (elem->getAttribute("name") == "view_comment")
            {
                const std::string ext = elem->getAttribute("ext");
                if (COOLWSD::ViewWithCommentsFileExtensions.insert(ext).second) // Skip duplicates.
                    LOG_DBG_S("Enabling commenting on [" << ext << "] extension files");
            }
        }

        // turn "images/img.svg" into "http://server.tld/browser/12345abcd/images/img.svg"
        listNodes = docXML->getElementsByTagName("app");
        for (unsigned long it = 0; it < listNodes->length(); ++it)
        {
            Element* elem = static_cast<Element*>(listNodes->item(it));

            if (elem->hasAttribute(favIconUrl))
            {
                elem->setAttribute(favIconUrl, uriBaseValue + elem->getAttribute(favIconUrl));
            }
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
    std::string getCapabilitiesJson(const Poco::Net::HTTPRequest& request,
                                    const std::shared_ptr<StreamSocket>& socket)
    {
        assert(socket && "Must have a valid socket");

        // Can the convert-to be used?
        Poco::JSON::Object::Ptr convert_to = new Poco::JSON::Object;
        Poco::Dynamic::Var available = allowConvertTo(socket->clientAddress(), request);
        convert_to->set("available", available);
        if (available)
            convert_to->set("endpoint", "/cool/convert-to");

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

        // Set the Server ID
        capabilities->set("serverId", Util::getProcessIdentifier());

        std::string version, hash;
        Util::getVersionInfo(version, hash);

        // Set the product version
        capabilities->set("productVersion", version);

        // Set the product version hash
        capabilities->set("productVersionHash", hash);

        // Set that this is a proxy.php-enabled instance
        capabilities->set("hasProxyPrefix", COOLWSD::IsProxyPrefixEnabled);

        // Set if this instance supports Zotero
        capabilities->set("hasZoteroSupport", config::getBool("zotero.enable", true));

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
        return StreamSocket::create<StreamSocket>(std::string(), fd, false,
                                                  std::make_shared<ClientRequestDispatcher>());
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

        return StreamSocket::create<SslStreamSocket>(std::string(), fd, false,
                                                     std::make_shared<ClientRequestDispatcher>());
    }
};
#endif

class PrisonerSocketFactory final : public SocketFactory
{
    std::shared_ptr<Socket> create(const int fd) override
    {
        // No local delay.
        return StreamSocket::create<StreamSocket>(std::string(), fd, false,
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
    COOLWSDServer() :
        _acceptPoll("accept_poll")
    {
    }

    ~COOLWSDServer()
    {
        stop();
    }

    void findClientPort()
    {
        _serverSocket = findServerPort(ClientPortNumber);
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
        Admin::instance().start();
#endif
    }

    void stop()
    {
        _acceptPoll.joinThread();
        if (WebServerPoll)
            WebServerPoll->joinThread();
#if !MOBILEAPP
        Admin::instance().stop();
#endif
    }

    void dumpState(std::ostream& os)
    {
        // FIXME: add some stop-world magic before doing the dump(?)
        Socket::InhibitThreadChecks = true;
        SocketPoll::InhibitThreadChecks = true;

        std::string version, hash;
        Util::getVersionInfo(version, hash);

        os << "COOLWSDServer: " << version << " - " << hash
#if !MOBILEAPP
           << "\n  Kit version: " << COOLWSD::LOKitVersion
           << "\n  Ports: server " << ClientPortNumber << " prisoner " << MasterLocation
           << "\n  SSL: " << (COOLWSD::isSSLEnabled() ? "https" : "http")
           << "\n  SSL-Termination: " << (COOLWSD::isSSLTermination() ? "yes" : "no")
           << "\n  Security " << (COOLWSD::NoCapsForKit ? "no" : "") << " chroot, "
           << (COOLWSD::NoSeccomp ? "no" : "") << " api lockdown"
           << "\n  Admin: " << (COOLWSD::AdminEnabled ? "enabled" : "disabled")
           << "\n  RouteToken: " << COOLWSD::RouteToken
#endif
           << "\n  TerminationFlag: " << SigUtil::getTerminationFlag()
           << "\n  isShuttingDown: " << SigUtil::getShutdownRequestFlag()
           << "\n  NewChildren: " << NewChildren.size()
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
           << "\n  AnonymizeUserData: " << (COOLWSD::AnonymizeUserData ? "yes" : "no")
           << "\n  CheckCoolUser: " << (COOLWSD::CheckCoolUser ? "yes" : "no")
           << "\n  IsProxyPrefixEnabled: " << (COOLWSD::IsProxyPrefixEnabled ? "yes" : "no")
           << "\n  OverrideWatermark: " << COOLWSD::OverrideWatermark
           << "\n  UserInterface: " << COOLWSD::UserInterface
            ;

        os << "\nServer poll:\n";
        _acceptPoll.dumpState(os);

        os << "Web Server poll:\n";
        WebServerPoll->dumpState(os);

        os << "Prisoner poll:\n";
        PrisonerPoll->dumpState(os);

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

#if !MOBILEAPP
        os << "Converter count: " << ConvertToBroker::getInstanceCount() << '\n';
#endif

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

    /// Create the internal only, local socket for forkit / kits prisoners to talk to.
    std::shared_ptr<ServerSocket> findPrisonerServerPort()
    {
        std::shared_ptr<SocketFactory> factory = std::make_shared<PrisonerSocketFactory>();
#if !MOBILEAPP
        auto socket = std::make_shared<LocalServerSocket>(*PrisonerPoll, factory);

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
                                   ClientPortProto, *PrisonerPoll, factory);

        COOLWSD::prisonerServerSocketFD = socket->getFD();
        LOG_INF("Listening to prisoner connections on #" << COOLWSD::prisonerServerSocketFD);
#endif
        return socket;
    }

    /// Create the externally listening public socket
    std::shared_ptr<ServerSocket> findServerPort(int port)
    {
        std::shared_ptr<SocketFactory> factory;

#if ENABLE_SSL
        if (COOLWSD::isSSLEnabled())
            factory = std::make_shared<SslSocketFactory>();
        else
#endif
            factory = std::make_shared<PlainSocketFactory>();

        std::shared_ptr<ServerSocket> socket = ServerSocket::create(
            ClientListenAddr, port, ClientPortProto, *WebServerPoll, factory);

        while (!socket &&
#ifdef BUILDING_TESTS
               true
#else
               UnitWSD::isUnitTesting()
#endif
            )
        {
            ++port;
            LOG_INF("Client port " << (port - 1) << " is busy, trying " << port << '.');
            socket = ServerSocket::create(ClientListenAddr, port, ClientPortProto,
                                          *WebServerPoll, factory);
        }

        if (!socket)
        {
            LOG_FTL("Failed to listen on Server port(s) (" <<
                    ClientPortNumber << '-' << port << "). Exiting.");
            Util::forcedExit(EX_SOFTWARE);
        }

        ClientPortNumber = port;

#if !MOBILEAPP
        LOG_INF('#' << socket->getFD() << " Listening to client connections on port " << port);
#else
        LOG_INF("Listening to client connections on #" << socket->getFD());
#endif
        return socket;
    }
};

#if !MOBILEAPP
void COOLWSD::processFetchUpdate()
{
    try
    {
        const std::string url(INFOBAR_URL);
        if (url.empty())
            return; // No url, nothing to do.

        Poco::URI uriFetch(url);
        uriFetch.addQueryParameter("product", APP_NAME);
        uriFetch.addQueryParameter("version", COOLWSD_VERSION);
        LOG_TRC("Infobar update request from " << uriFetch.toString());
        std::shared_ptr<http::Session> sessionFetch = StorageBase::getHttpSession(uriFetch);
        if (!sessionFetch)
            return;

        http::Request request(uriFetch.getPathAndQuery());
        request.add("Accept", "application/json");

        const std::shared_ptr<const http::Response> httpResponse =
            sessionFetch->syncRequest(request);
        if (httpResponse->statusLine().statusCode() == Poco::Net::HTTPResponse::HTTP_OK)
        {
            LOG_DBG("Infobar update returned: " << httpResponse->getBody());

            std::lock_guard<std::mutex> lock(COOLWSD::FetchUpdateMutex);
            COOLWSD::LatestVersion = httpResponse->getBody();
        }
        else
            LOG_WRN("Failed to update the infobar. Got: "
                    << httpResponse->statusLine().statusCode() << ' '
                    << httpResponse->statusLine().reasonPhrase());
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
    SigUtil::setUserSignals();
    SigUtil::setFatalSignals("wsd " COOLWSD_VERSION " " COOLWSD_VERSION_HASH);
#endif

#if !MOBILEAPP
#  ifdef __linux__
    // down-pay all the forkit linking cost once & early.
    setenv("LD_BIND_NOW", "1", 1);
#  endif

    std::string version, hash;
    Util::getVersionInfo(version, hash);
    LOG_INF("Coolwsd version details: " << version << " - " << hash << " - id " << Util::getProcessIdentifier() << " - on " << Util::getLinuxVersion());
#endif

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
        throw MissingOptionException("lotemplate");
    }

    if (FileServerRoot.empty())
        FileServerRoot = Util::getApplicationPath();
    FileServerRoot = Poco::Path(FileServerRoot).absolute().toString();
    LOG_DBG("FileServerRoot: " << FileServerRoot);

    LOG_DBG("Initializing DelaySocket with " << SimulatedLatencyMs << "ms.");
    Delay delay(SimulatedLatencyMs);

    const auto fetchUpdateCheck = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::hours(std::max(getConfigValue<int>("fetch_update_check", 10), 0)));
#endif

    ClientRequestDispatcher::InitStaticFileContentCache();

    // Allocate our port - passed to prisoners.
    assert(Server && "The COOLWSDServer instance does not exist.");
    Server->findClientPort();

    TmpFontDir = ChildRoot + JailUtil::CHILDROOT_TMP_INCOMING_PATH;

    // Start the internal prisoner server and spawn forkit,
    // which in turn forks first child.
    Server->startPrisoners();

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
#endif

    if (LogLevel != "trace")
    {
        LOG_INF("WSD initialization complete: setting log-level to [" << LogLevel << "] as configured.");
        Log::logger().setLevel(LogLevel);
    }

    if (Log::logger().getLevel() >= Poco::Message::Priority::PRIO_INFORMATION)
        LOG_ERR("Log level is set very high to '" << LogLevel << "' this will have a "
                "significant performance impact. Do not use this in production.");
#endif

    // URI with /contents are public and we don't need to anonymize them.
    Util::mapAnonymized("contents", "contents");

    // Start the server.
    Server->start();

#if defined(__EMSCRIPTEN__)
    // It is not at all obvious that this is the ideal place to do the HULLO thing and call onopen
    // on TheFakeWebSocket. But it seems to work.
    handle_cool_message("HULLO");
    MAIN_THREAD_EM_ASM(window.TheFakeWebSocket.onopen(););
#endif

    /// The main-poll does next to nothing:
    SocketPoll mainWait("main");

#if !MOBILEAPP
    std::cerr << "Ready to accept connections on port " << ClientPortNumber <<  ".\n" << std::endl;
    if (SignalParent)
    {
        kill(getppid(), SIGUSR2);
    }
#endif

#if !MOBILEAPP
    // Start the remote font downloading polling thread.
    std::unique_ptr<RemoteFontConfigPoll> remoteFontConfigThread;
    try
    {
        // Fetch font settings from server if configured
        remoteFontConfigThread = Util::make_unique<RemoteFontConfigPoll>(config());
        remoteFontConfigThread->start();
    }
    catch (const Poco::Exception&)
    {
        LOG_DBG("No remote_font_config");
    }
#endif

    const auto startStamp = std::chrono::steady_clock::now();
#if !MOBILEAPP
    auto stampFetch = startStamp - (fetchUpdateCheck - std::chrono::milliseconds(60000));
#endif

    while (!SigUtil::getTerminationFlag() && !SigUtil::getShutdownRequestFlag())
    {
        // This timeout affects the recovery time of prespawned children.
        std::chrono::microseconds waitMicroS = SocketPoll::DefaultPollTimeoutMicroS * 4;

        if (UnitWSD::isUnitTesting())
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
        if (UnitWSD::isUnitTesting())
        {
            UnitWSD::get().checkTimeout(timeSinceStartMs);
        }

#if !MOBILEAPP
        const std::chrono::milliseconds durationFetch
            = std::chrono::duration_cast<std::chrono::milliseconds>(timeNow - stampFetch);
        if (fetchUpdateCheck > std::chrono::milliseconds::zero() && durationFetch > fetchUpdateCheck)
        {
            processFetchUpdate();
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

    if (TraceEventFile != NULL)
    {
        // If we have written any objects to it, it ends with a comma and newline. Back over those.
        if (ftell(TraceEventFile) > 2)
            fseek(TraceEventFile, -2, SEEK_CUR);
        // Close the JSON array.
        fprintf(TraceEventFile, "\n]\n");
        fclose(TraceEventFile);
        TraceEventFile = NULL;
    }

#if !defined(KIT_IN_PROCESS) && !MOBILEAPP
    // Terminate child processes
    LOG_INF("Requesting forkit process " << ForKitProcId << " to terminate.");
#if CODE_COVERAGE
    constexpr auto signal = SIGTERM;
#else
    constexpr auto signal = SIGKILL;
#endif
    SigUtil::killChild(ForKitProcId, signal);
#endif

    Server->stopPrisoners();

    if (UnitWSD::isUnitTesting())
    {
        Server->stop();
        Server.reset();
    }

    PrisonerPoll.reset();

    WebServerPoll.reset();

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

    JailUtil::cleanupJails(ChildRoot);
#endif // !MOBILEAPP

    const int returnValue = UnitBase::uninit();

    UnitBase::uninit();
    LOG_INF("Process [coolwsd] finished with exit status: " << returnValue);

    // At least on centos7, Poco deadlocks while
    // cleaning up its SSL context singleton.
    Util::forcedExit(returnValue);

    return returnValue;
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

        FileServerRequestHandler::uninitialize();
        JWTAuth::cleanup();

#if ENABLE_SSL
        // Finally, we no longer need SSL.
        if (COOLWSD::isSSLEnabled())
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

#if !defined(BUILDING_TESTS) && !defined(KIT_IN_PROCESS)
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

void dump_state()
{
    std::ostringstream oss;

    if (Server)
        Server->dumpState(oss);

    const std::string msg = oss.str();
    fprintf(stderr, "%s\n", msg.c_str());
    LOG_TRC(msg);
}

void forwardSigUsr2()
{
    LOG_TRC("forwardSigUsr2");

    Util::assertIsLocked(DocBrokersMutex);
    std::lock_guard<std::mutex> newChildLock(NewChildrenMutex);

#if !MOBILEAPP
#ifndef KIT_IN_PROCESS
    if (COOLWSD::ForKitProcId > 0)
    {
        LOG_INF("Sending SIGUSR2 to forkit " << COOLWSD::ForKitProcId);
        ::kill(COOLWSD::ForKitProcId, SIGUSR2);
    }
#endif
#endif

    for (const auto& child : NewChildren)
    {
        if (child && child->getPid() > 0)
        {
            LOG_INF("Sending SIGUSR2 to child " << child->getPid());
            ::kill(child->getPid(), SIGUSR2);
        }
    }

    for (const auto& pair : DocBrokers)
    {
        std::shared_ptr<DocumentBroker> docBroker = pair.second;
        if (docBroker)
        {
            LOG_INF("Sending SIGUSR2 to docBroker " << docBroker->getPid());
            ::kill(docBroker->getPid(), SIGUSR2);
        }
    }
}

// Avoid this in the Util::isFuzzing() case because libfuzzer defines its own main().
#if !MOBILEAPP && !LIBFUZZER

POCO_SERVER_MAIN(COOLWSD)

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
