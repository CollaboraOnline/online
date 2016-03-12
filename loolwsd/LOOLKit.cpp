/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * NB. this file is compiled both standalone, and as part of the LOOLBroker.
 */

#include <sys/prctl.h>
#include <sys/poll.h>
#include <sys/syscall.h>
#include <signal.h>
#include <ftw.h>
#include <utime.h>
#include <unistd.h>
#include <dlfcn.h>

#include <atomic>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <memory>

#include <Poco/Exception.h>
#include <Poco/Mutex.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Process.h>
#include <Poco/Runnable.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Thread.h>
#include <Poco/ThreadLocal.h>
#include <Poco/Util/Application.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitInit.h>
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include "Capabilities.hpp"
#include "ChildProcessSession.hpp"
#include "Common.hpp"
#include "LOKitHelper.hpp"
#include "LOOLProtocol.hpp"
#include "QueueHandler.hpp"
#include "Util.hpp"

using namespace LOOLProtocol;

using Poco::Exception;
using Poco::File;
using Poco::Net::HTTPClientSession;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Net::WebSocket;
using Poco::Path;
using Poco::Process;
using Poco::Runnable;
using Poco::StringTokenizer;
using Poco::Thread;
using Poco::ThreadLocal;
using Poco::Util::Application;

const std::string FIFO_PATH = "pipe";
const std::string FIFO_BROKER = "loolbroker.fifo";
const std::string FIFO_NOTIFY = "loolnotify.fifo";

static int writerNotify = -1;

namespace
{
    ThreadLocal<std::string> sourceForLinkOrCopy;
    ThreadLocal<Path> destinationForLinkOrCopy;

    int linkOrCopyFunction(const char *fpath,
                           const struct stat* /*sb*/,
                           int typeflag,
                           struct FTW* /*ftwbuf*/)
    {
        if (strcmp(fpath, sourceForLinkOrCopy->c_str()) == 0)
            return 0;

        assert(fpath[strlen(sourceForLinkOrCopy->c_str())] == '/');
        const char *relativeOldPath = fpath + strlen(sourceForLinkOrCopy->c_str()) + 1;
        Path newPath(*destinationForLinkOrCopy, Path(relativeOldPath));

        switch (typeflag)
        {
        case FTW_F:
            File(newPath.parent()).createDirectories();
            if (link(fpath, newPath.toString().c_str()) == -1)
            {
                Log::error("Error: link(\"" + std::string(fpath) + "\",\"" + newPath.toString() +
                           "\") failed. Exiting.");
                std::exit(Application::EXIT_SOFTWARE);
            }
            break;
        case FTW_DP:
            {
                struct stat st;
                if (stat(fpath, &st) == -1)
                {
                    Log::error("Error: stat(\"" + std::string(fpath) + "\") failed.");
                    return 1;
                }
                File(newPath).createDirectories();
                struct utimbuf ut;
                ut.actime = st.st_atime;
                ut.modtime = st.st_mtime;
                if (utime(newPath.toString().c_str(), &ut) == -1)
                {
                    Log::error("Error: utime(\"" + newPath.toString() + "\", &ut) failed.");
                    return 1;
                }
            }
            break;
        case FTW_DNR:
            Log::error("Cannot read directory '" + std::string(fpath) + "'");
            return 1;
        case FTW_NS:
            Log::error("nftw: stat failed for '" + std::string(fpath) + "'");
            return 1;
        case FTW_SLN:
            Log::error("nftw: symlink to nonexistent file: '" + std::string(fpath) + "', ignored.");
            break;
        default:
            assert(false);
        }
        return 0;
    }

    void linkOrCopy(const std::string& source, const Path& destination)
    {
        *sourceForLinkOrCopy = source;
        if (sourceForLinkOrCopy->back() == '/')
            sourceForLinkOrCopy->pop_back();
        *destinationForLinkOrCopy = destination;
        if (nftw(source.c_str(), linkOrCopyFunction, 10, FTW_DEPTH) == -1)
            Log::error("linkOrCopy: nftw() failed for '" + source + "'");
    }
}

class Connection: public Runnable
{
public:
    Connection(std::shared_ptr<ChildProcessSession> session,
               std::shared_ptr<WebSocket> ws) :
        _session(session),
        _ws(ws),
        _stop(false)
    {
        Log::info("Connection ctor in child for " + _session->getId());
    }

    ~Connection()
    {
        Log::info("~Connection dtor in child for " + _session->getId());
        stop();
    }

    std::shared_ptr<WebSocket> getWebSocket() const { return _ws; }
    std::shared_ptr<ChildProcessSession> getSession() { return _session; }

    void start()
    {
        _thread.start(*this);
    }

    bool isRunning()
    {
        return _thread.isRunning();
    }

    void stop()
    {
        _stop = true;
    }

    void join()
    {
        _thread.join();
    }

    void handle(TileQueue& queue, const std::string& firstLine, char* buffer, int n)
    {
        if (firstLine.find("paste") != 0)
        {
            // Everything else is expected to be a single line.
            assert(firstLine.size() == static_cast<std::string::size_type>(n));
            queue.put(firstLine);
        }
        else
            queue.put(std::string(buffer, n));
    }

    void run() override
    {
        const std::string thread_name = "kit_ws_" + _session->getId();

        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(thread_name.c_str()), 0, 0, 0) != 0)
            Log::error("Cannot set thread name to " + thread_name + ".");

        Log::debug("Thread [" + thread_name + "] started.");

        try
        {
            TileQueue queue;
            QueueHandler handler(queue, _session, "kit_queue_" + _session->getId());

            Thread queueHandlerThread;
            queueHandlerThread.start(handler);

            int flags;
            int n;
            do
            {
                char buffer[1024];
                n = _ws->receiveFrame(buffer, sizeof(buffer), flags);
                if (n > 0 && (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE)
                {
                    std::string firstLine = getFirstLine(buffer, n);
                    if (firstLine == "eof")
                    {
                        Log::info("Received EOF. Finishing.");
                        break;
                    }

                    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

                    if (firstLine == "disconnect")
                    {
                        Log::info("Client disconnected [" + (tokens.count() == 2 ? tokens[1] : std::string("no reason")) + "].");
                        break;
                    }

                    // Check if it is a "nextmessage:" and in that case read the large
                    // follow-up message separately, and handle that only.
                    int size;
                    if (tokens.count() == 2 && tokens[0] == "nextmessage:" && getTokenInteger(tokens[1], "size", size) && size > 0)
                    {
                        char largeBuffer[size];
                        n = _ws->receiveFrame(largeBuffer, size, flags);
                        if (n > 0 && (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE)
                        {
                            firstLine = getFirstLine(largeBuffer, n);
                            handle(queue, firstLine, largeBuffer, n);
                        }
                    }
                    else
                        handle(queue, firstLine, buffer, n);
                }
            }
            while (!_stop && n > 0 && (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE);
            Log::debug() << "Finishing " << thread_name << ". stop " << _stop
                         << ", payload size: " << n
                         << ", flags: " << std::hex << flags << Log::end;

            queue.clear();
            queue.put("eof");
            queueHandlerThread.join();

            _session->disconnect();
        }
        catch (const Exception& exc)
        {
            Log::error() << "Connection::run: Exception: " << exc.displayText()
                         << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                         << Log::end;
        }
        catch (const std::exception& exc)
        {
            Log::error(std::string("Connection::run: Exception: ") + exc.what());
        }
        catch (...)
        {
            Log::error("Connection::run:: Unexpected exception");
        }

        Log::debug("Thread [" + thread_name + "] finished.");
    }

private:
    Thread _thread;
    std::shared_ptr<ChildProcessSession> _session;
    std::shared_ptr<WebSocket> _ws;
    volatile bool _stop;
};

/// A document container.
/// Owns LOKitDocument instance and connections.
/// Manages the lifetime of a document.
/// Technically, we can host multiple documents
/// per process. But for security reasons don't.
/// However, we could have a loolkit instance
/// per user or group of users (a trusted circle).
class Document
{
public:
    /// We have two types of password protected documents
    /// 1) Documents which require password to view
    /// 2) Document which require password to modify
    enum class PasswordType { ToView, ToModify };

    Document(LibreOfficeKit *loKit,
             const std::string& jailId,
             const std::string& url)
      : _multiView(std::getenv("LOK_VIEW_CALLBACK")),
        _loKit(loKit),
        _jailId(jailId),
        _url(url),
        _loKitDocument(nullptr),
        _docPassword(""),
        _isDocPasswordProvided(false),
        _isDocLoaded(false),
        _isDocPasswordProtected(false),
        _docPasswordType(PasswordType::ToView),
        _clientViews(0)
    {
        (void)_isDocLoaded; // FIXME LOOLBroker.cpp includes LOOLKit.cpp
        Log::info("Document ctor for url [" + _url + "] on child [" + _jailId +
                  "] LOK_VIEW_CALLBACK=" + std::to_string(_multiView) + ".");
    }

    ~Document()
    {
        Log::info("~Document dtor for url [" + _url + "] on child [" + _jailId +
                  "]. There are " + std::to_string(_clientViews) + " views.");

        // Flag all connections to stop.
        for (auto aIterator : _connections)
        {
            aIterator.second->stop();
        }

        // Destroy all connections and views.
        for (auto aIterator : _connections)
        {
            try
            {
                // stop all websockets
                if (aIterator.second->isRunning())
                {
                    std::shared_ptr<WebSocket> ws = aIterator.second->getWebSocket();
                    if ( ws )
                    {
                        ws->shutdownReceive();
                        aIterator.second->join();
                    }
                }
            }
            catch(Poco::Net::NetException& exc)
            {
                Log::error() << "Document::~Document: NetException: " << exc.displayText()
                             << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                             << Log::end;
            }
        }

        std::unique_lock<std::recursive_mutex> lock(_mutex);

        // Destroy all connections and views.
        _connections.clear();

        // TODO. check what is happening when destroying lokit document
        // Destroy the document.
        if (_loKitDocument != nullptr)
        {
            _loKitDocument->pClass->destroy(_loKitDocument);
        }
    }

    void createSession(const std::string& sessionId, const unsigned intSessionId)
    {
        std::unique_lock<std::recursive_mutex> lock(_mutex);

        const auto& it = _connections.find(intSessionId);
        if (it != _connections.end())
        {
            // found item, check if still running
            if (it->second->isRunning())
            {
                Log::warn("Thread [" + sessionId + "] is already running.");
                return;
            }

            // Restore thread.
            Log::warn("Thread [" + sessionId + "] is not running. Restoring.");
            _connections.erase(intSessionId);
        }

        Log::info() << "Creating " << (_clientViews ? "new" : "first")
                    << " view for url: " << _url << " for thread: " << sessionId
                    << " on child: " << _jailId << Log::end;

        // Open websocket connection between the child process and the
        // parent. The parent forwards us requests that it can't handle.

        HTTPClientSession cs("127.0.0.1", MASTER_PORT_NUMBER);
        cs.setTimeout(0);
        HTTPRequest request(HTTPRequest::HTTP_GET, CHILD_URI + "sessionId=" + sessionId + "&jailId=" + _jailId);
        HTTPResponse response;

        auto ws = std::make_shared<WebSocket>(cs, request, response);
        ws->setReceiveTimeout(0);

        auto session = std::make_shared<ChildProcessSession>(sessionId, ws, _loKitDocument, _jailId,
                       [this](const std::string& id, const std::string& uri, const std::string& docPassword, bool isDocPasswordProvided) { return onLoad(id, uri, docPassword, isDocPasswordProvided); },
                       [this](const std::string& id) { onUnload(id); });
        // child -> 0,  sessionId -> 1, PID -> 2
        const std::string hello("child " + sessionId + " " + _jailId);
        session->sendTextFrame(hello);

        auto thread = std::make_shared<Connection>(session, ws);
        const auto aInserted = _connections.emplace(intSessionId, thread);

        if ( aInserted.second )
            thread->start();
        else
            Log::error("Connection already exists for child: " + _jailId + ", thread: " + sessionId);

        Log::debug("Connections: " + std::to_string(_connections.size()));
    }

    /// Purges dead connections and returns
    /// the remaining number of clients.
    size_t purgeSessions()
    {
        std::vector<std::shared_ptr<ChildProcessSession>> deadSessions;
        {
            std::unique_lock<std::recursive_mutex> lock(_mutex);

            for (auto it =_connections.cbegin(); it != _connections.cend(); )
            {
                if (!it->second->isRunning())
                {
                    deadSessions.push_back(it->second->getSession());
                    it = _connections.erase(it);
                }
                else
                {
                    ++it;
                }
            }
        }

        // Don't destroy sessions while holding our lock.
        // We may deadlock if a session is waiting on us
        // during callback initiated while handling a command
        // and the dtor tries to take its lock (which is taken).
        deadSessions.clear();

        std::unique_lock<std::recursive_mutex> lock(_mutex);
        return _connections.size();
    }

    /// Returns true if at least one *live* connection exists.
    /// Does not consider user activity, just socket status.
    bool hasConnections()
    {
        return purgeSessions() > 0;
    }

    /// Returns true if there is no activity and
    /// the document is saved.
    bool canDiscard()
    {
        //TODO: Implement proper time-out on inactivity.
        return !hasConnections();
    }

    /// Set Document password for given URL
    void setDocumentPassword(int nPasswordType)
    {
        Log::info() << "setDocumentPassword: passwordProtected=" << _isDocPasswordProtected
                    << " passwordProvided=" << _isDocPasswordProvided
                    << " password='" << _docPassword <<  "'" << Log::end;

        if (_isDocPasswordProtected && _isDocPasswordProvided)
        {
            // it means this is the second attempt with the wrong password; abort the load operation
            _loKit->pClass->setDocumentPassword(_loKit, _jailedUrl.c_str(), nullptr);
            return;
        }

        // One thing for sure, this is a password protected document
        _isDocPasswordProtected = true;
        if (nPasswordType == LOK_CALLBACK_DOCUMENT_PASSWORD)
            _docPasswordType = PasswordType::ToView;
        else if (nPasswordType == LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY)
            _docPasswordType = PasswordType::ToModify;

        Log::info("Caling _loKit->pClass->setDocumentPassword");
        if (_isDocPasswordProvided)
            _loKit->pClass->setDocumentPassword(_loKit, _jailedUrl.c_str(), _docPassword.c_str());
        else
            _loKit->pClass->setDocumentPassword(_loKit, _jailedUrl.c_str(), nullptr);
        Log::info("setDocumentPassword returned");
    }

private:
    static void KitCallback(int nType, const char* pPayload, void* pData)
    {
        Document* self = reinterpret_cast<Document*>(pData);
        Log::trace() << "Document::KitCallback "
                     << LOKitHelper::kitCallbackTypeToString(nType)
                     << " [" << (pPayload ? pPayload : "") << "]." << Log::end;

        if (self)
        {
            std::unique_lock<std::recursive_mutex> lock(self->_mutex);
            for (auto& it: self->_connections)
            {
                if (it.second->isRunning())
                {
                    auto session = it.second->getSession();
                    auto sessionLock = session->getLock();

                    switch (nType)
                    {
                    case LOK_CALLBACK_STATUS_INDICATOR_START:
                        session->sendTextFrame("statusindicatorstart:");
                        break;
                    case LOK_CALLBACK_STATUS_INDICATOR_SET_VALUE:
                        session->sendTextFrame("statusindicatorsetvalue: " + std::string(pPayload));
                        break;
                    case LOK_CALLBACK_STATUS_INDICATOR_FINISH:
                        session->sendTextFrame("statusindicatorfinish:");
                        break;
                    case LOK_CALLBACK_DOCUMENT_PASSWORD:
                    case LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY:
                        self->setDocumentPassword(nType);
                        break;
                    }

                    // Ideally, there would be only one *live* connection at this point of time
                    // So, just get the first running one and break out.
                    // TODO: Find a better way to find the correct connection.
                    break;
                }
            }
        }
    }

    static void ViewCallback(int , const char* , void* )
    {
        //TODO: Delegate the callback.
    }

    static void DocumentCallback(int nType, const char* pPayload, void* pData)
    {
        Document* self = reinterpret_cast<Document*>(pData);
        if (self)
        {
            std::unique_lock<std::recursive_mutex> lock(self->_mutex);

            for (auto& it: self->_connections)
            {
                if (it.second->isRunning())
                {
                    auto session = it.second->getSession();
                    if (session)
                    {
                        session->loKitCallback(nType, pPayload);
                    }
                }
            }
        }
    }

    /// Load a document (or view) and register callbacks.
    LibreOfficeKitDocument* onLoad(const std::string& sessionId, const std::string& uri, const std::string& docPassword, bool isDocPasswordProvided)
    {
        Log::info("Session " + sessionId + " is loading. " + std::to_string(_clientViews) + " views loaded.");
        const unsigned intSessionId = Util::decodeId(sessionId);

        std::unique_lock<std::recursive_mutex> lock(_mutex);

        const auto it = _connections.find(intSessionId);
        if (it == _connections.end() || !it->second)
        {
            Log::error("Cannot find session [" + sessionId + "] which decoded to " + std::to_string(intSessionId));
            return nullptr;
        }

        auto session = it->second->getSession();

        if (_loKitDocument == nullptr)
        {
            // This is the first time we are loading the document
            Log::info("Loading new document from URI: [" + uri + "] for session [" + sessionId + "].");

            if ( LIBREOFFICEKIT_HAS(_loKit, registerCallback))
            {
                _loKit->pClass->registerCallback(_loKit, KitCallback, this);
                _loKit->pClass->setOptionalFeatures(_loKit, LOK_FEATURE_DOCUMENT_PASSWORD |
                                                    LOK_FEATURE_DOCUMENT_PASSWORD_TO_MODIFY);
            }

            // Save the provided password with us and the jailed url
            _isDocPasswordProvided = isDocPasswordProvided;
            _docPassword = docPassword;
            _jailedUrl = uri;
            _isDocPasswordProtected = false;
            Log::info("Calling _loKit->pClass->documentLoad");
            if ((_loKitDocument = _loKit->pClass->documentLoad(_loKit, uri.c_str())) == nullptr)
            {
                Log::error("Failed to load: " + uri + ", error: " + _loKit->pClass->getError(_loKit));

                // Checking if wrong password or no password was reason for failure.
                if (_isDocPasswordProtected)
                {
                    if (!_isDocPasswordProvided)
                    {
                        std::string passwordFrame = "passwordrequired:";
                        if (_docPasswordType == PasswordType::ToView)
                            passwordFrame += "to-view";
                        else if (_docPasswordType == PasswordType::ToModify)
                            passwordFrame += "to-modify";
                        session->sendTextFrame("error: cmd=load kind=" + passwordFrame);
                    }
                    else
                        session->sendTextFrame("error: cmd=load kind=wrongpassword");
                }

                return nullptr;
            }
            Log::info("documentLoad() returned");

            // Notify the Admin thread
            std::ostringstream message;
            message << "document" << " "
                    << Process::id() << " "
                    << _url << " "
                    << "\r\n";
            Util::writeFIFO(writerNotify, message.str());

            if (_multiView)
            {
                Log::info("Loading view to document from URI: [" + uri + "] for session [" + sessionId + "].");
                const auto viewId = _loKitDocument->pClass->createView(_loKitDocument);

                _loKitDocument->pClass->registerCallback(_loKitDocument, ViewCallback, reinterpret_cast<void*>(intSessionId));

                Log::info() << "Document [" << _url << "] view ["
                            << viewId << "] loaded, leaving "
                            << (_clientViews + 1) << " views." << Log::end;
            }
            else
            {
                _loKitDocument->pClass->registerCallback(_loKitDocument, DocumentCallback, this);
            }
        }
        else
        {
            // Check if this document requires password
            if (_isDocPasswordProtected)
            {
                if (!isDocPasswordProvided)
                {
                    std::string passwordFrame = "passwordrequired:";
                    if (_docPasswordType == PasswordType::ToView)
                        passwordFrame += "to-view";
                    else if (_docPasswordType == PasswordType::ToModify)
                        passwordFrame += "to-modify";
                    session->sendTextFrame("error: cmd=load kind=" + passwordFrame);
                    return nullptr;
                }
                else if (docPassword != _docPassword)
                {
                    session->sendTextFrame("error: cmd=load kind=wrongpassword");
                    return nullptr;
                }
            }
        }

        ++_clientViews;

        std::ostringstream message;
        message << "addview" << " "
                << Process::id() << " "
                << sessionId << " "
                << "\r\n";
        Util::writeFIFO(writerNotify, message.str());

        return _loKitDocument;
    }

    void onUnload(const std::string& sessionId)
    {
        const unsigned intSessionId = Util::decodeId(sessionId);
        const auto it = _connections.find(intSessionId);
        if (it == _connections.end() || !it->second || !_loKitDocument)
        {
            // Nothing to do.
            return;
        }

        auto session = it->second->getSession();
        auto sessionLock = session->getLock();
        std::unique_lock<std::recursive_mutex> lock(_mutex);

        --_clientViews;

        std::ostringstream message;
        message << "rmview" << " "
                << Process::id() << " "
                << sessionId << " "
                << "\r\n";
        Util::writeFIFO(writerNotify, message.str());

        Log::info("Session " + sessionId + " is unloading. " + std::to_string(_clientViews) + " views will remain.");

        if (_multiView && _loKitDocument)
        {
            Log::info() << "Document [" << _url << "] session ["
                        << sessionId << "] unloaded, leaving "
                        << _clientViews << " views." << Log::end;

            const auto viewId = _loKitDocument->pClass->getView(_loKitDocument);
            _loKitDocument->pClass->registerCallback(_loKitDocument, nullptr, nullptr);
            _loKitDocument->pClass->destroyView(_loKitDocument, viewId);
        }
    }

private:

    const bool _multiView;
    LibreOfficeKit *_loKit;
    const std::string _jailId;
    const std::string _url;
    std::string _jailedUrl;

    LibreOfficeKitDocument *_loKitDocument;

    // Document password provided
    std::string _docPassword;
    // Whether password was provided or not
    bool _isDocPasswordProvided;
    // Whether documet has been opened successfully
    bool _isDocLoaded;
    // Whether document is password protected
    bool _isDocPasswordProtected;
    // Whether password is required to view the document, or modify it
    PasswordType _docPasswordType;

    std::recursive_mutex _mutex;
    std::map<unsigned, std::shared_ptr<Connection>> _connections;
    std::atomic<unsigned> _clientViews;
};

void lokit_main(const std::string& childRoot,
                const std::string& sysTemplate,
                const std::string& loTemplate,
                const std::string& loSubPath,
                const std::string& pipe)
{
#ifdef LOOLKIT_NO_MAIN
    // Reinitialize logging when forked.
    Log::initialize("kit");
    Util::rng::reseed();
#endif

    struct pollfd pollPipeBroker;
    ssize_t bytes = -1;
    int   ready = 0;
    bool  isUsedKit = false;
    char  buffer[READ_BUFFER_SIZE];
    char* start = nullptr;
    char* end = nullptr;

    assert(!childRoot.empty());
    assert(!sysTemplate.empty());
    assert(!loTemplate.empty());
    assert(!loSubPath.empty());
    assert(!pipe.empty());

    std::map<std::string, std::shared_ptr<Document>> _documents;

    static const std::string jailId = Util::encodeId(Util::rng::getNext());
    static const std::string process_name = "loolkit";

    if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(process_name.c_str()), 0, 0, 0) != 0)
        Log::error("Cannot set process name to " + process_name + ".");

    Util::setTerminationSignals();
    Util::setFatalSignals();

    Log::debug("Process [" + process_name + "] started.");

    static const std::string instdir_path = "/" + loSubPath + "/program";
    LibreOfficeKit* loKit = nullptr;

    try
    {
        int writerBroker;
        int readerBroker;

        if ((readerBroker = open(pipe.c_str(), O_RDONLY) ) < 0)
        {
            Log::error("Error: failed to open pipe [" + pipe + "] read only.");
            std::exit(Application::EXIT_SOFTWARE);
        }

        const Path pipePath = Path::forDirectory(childRoot + Path::separator() + FIFO_PATH);
        const std::string pipeBroker = Path(pipePath, FIFO_BROKER).toString();
        if ((writerBroker = open(pipeBroker.c_str(), O_WRONLY) ) < 0)
        {
            Log::error("Error: failed to open pipe [" + FIFO_BROKER + "] write only.");
            std::exit(Application::EXIT_SOFTWARE);
        }

        // Open notify pipe
        const std::string pipeNotify = Path(pipePath, FIFO_NOTIFY).toString();
        if ((writerNotify = open(pipeNotify.c_str(), O_WRONLY) ) < 0)
        {
            Log::error("Error: pipe opened for writing.");
            exit(Application::EXIT_SOFTWARE);
        }

        const Path jailPath = Path::forDirectory(childRoot + Path::separator() + jailId);
        Log::info("Jail path: " + jailPath.toString());

        File(jailPath).createDirectories();

#ifdef LOOLKIT_NO_MAIN
        // Create a symlink inside the jailPath so that the absolute pathname loTemplate, when
        // interpreted inside a chroot at jailPath, points to loSubPath (relative to the chroot).
        Path symlinkSource(jailPath, Path(loTemplate.substr(1)));

        File(symlinkSource.parent()).createDirectories();

        std::string symlinkTarget;
        for (auto i = 0; i < Path(loTemplate).depth(); i++)
            symlinkTarget += "../";
        symlinkTarget += loSubPath;

        Log::info("symlink(\"" + symlinkTarget + "\",\"" + symlinkSource.toString() + "\")");

        if (symlink(symlinkTarget.c_str(), symlinkSource.toString().c_str()) == -1)
        {
            Log::error("Error: symlink(\"" + symlinkTarget + "\",\"" + symlinkSource.toString() + "\") failed");
            throw Exception("symlink() failed");
        }
#endif

        Path jailLOInstallation(jailPath, loSubPath);
        jailLOInstallation.makeDirectory();
        File(jailLOInstallation).createDirectory();

        // Copy (link) LO installation and other necessary files into it from the template.
        linkOrCopy(sysTemplate, jailPath);
        linkOrCopy(loTemplate, jailLOInstallation);

        // We need this because sometimes the hostname is not resolved
        const std::vector<std::string> networkFiles = {"/etc/host.conf", "/etc/hosts", "/etc/nsswitch.conf", "/etc/resolv.conf"};
        for (const auto& filename : networkFiles)
        {
            const File networkFile(filename);
            if (networkFile.exists())
            {
                networkFile.copyTo(Path(jailPath, "/etc").toString());
            }
        }

        // Create the urandom and random devices
        File(Path(jailPath, "/dev")).createDirectory();
        if (mknod((jailPath.toString() + "/dev/random").c_str(),
                  S_IFCHR | S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH,
                  makedev(1, 8)) != 0)
        {
            Log::error("Error: mknod(" + jailPath.toString() + "/dev/random) failed.");

        }
        if (mknod((jailPath.toString() + "/dev/urandom").c_str(),
                  S_IFCHR | S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH,
                  makedev(1, 9)) != 0)
        {
            Log::error("Error: mknod(" + jailPath.toString() + "/dev/urandom) failed.");
        }

        Log::info("chroot(\"" + jailPath.toString() + "\")");
        if (chroot(jailPath.toString().c_str()) == -1)
        {
            Log::error("Error: chroot(\"" + jailPath.toString() + "\") failed.");
            std::exit(Application::EXIT_SOFTWARE);
        }

        if (chdir("/") == -1)
        {
            Log::error("Error: chdir(\"/\") in jail failed.");
            std::exit(Application::EXIT_SOFTWARE);
        }

        dropCapability(CAP_SYS_CHROOT);
        dropCapability(CAP_MKNOD);
        dropCapability(CAP_FOWNER);

        loKit = lok_init_2(instdir_path.c_str(), "file:///user");
        if (loKit == nullptr)
        {
            Log::error("Error: LibreOfficeKit initialization failed. Exiting.");
            std::exit(Application::EXIT_SOFTWARE);
        }

        Log::info("loolkit [" + std::to_string(Process::id()) + "] is ready.");

        std::string response;
        std::string message;

        while (!TerminationFlag)
        {
            if (start == end)
            {
                pollPipeBroker.fd = readerBroker;
                pollPipeBroker.events = POLLIN;
                pollPipeBroker.revents = 0;

                ready = poll(&pollPipeBroker, 1, POLL_TIMEOUT_MS);
                if (ready == 0)
                {
                    // time out maintenance
                    for (auto it = _documents.cbegin(); it != _documents.cend(); )
                    {
                        it = (it->second->canDiscard() ? _documents.erase(it) : ++it);
                    }

                    if (isUsedKit && _documents.empty())
                        TerminationFlag = true;
                }
                else
                if (ready < 0)
                {
                    Log::error("Failed to poll pipe [" + pipe + "].");
                    continue;
                }
                else
                if (pollPipeBroker.revents & (POLLIN | POLLPRI))
                {
                    bytes = Util::readFIFO(readerBroker, buffer, sizeof(buffer));
                    if (bytes < 0)
                    {
                        start = end = nullptr;
                        Log::error("Error reading message from pipe [" + pipe + "].");
                        continue;
                    }
                    start = buffer;
                    end = buffer + bytes;
                }
                else
                if (pollPipeBroker.revents & (POLLERR | POLLHUP))
                {
                    Log::error("Broken pipe [" + pipe + "] with broker.");
                    break;
                }
            }

            if (start != end)
            {
                char byteChar = *start++;
                while (start != end && byteChar != '\r' && byteChar != '\n')
                {
                    message += byteChar;
                    byteChar = *start++;
                }

                if (byteChar == '\r' && *start == '\n')
                {
                    start++;
                    StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
                    response = std::to_string(Process::id()) + " ";

                    Log::trace("Recv: " + message);

                    for (auto it = _documents.cbegin(); it != _documents.cend(); )
                    {
                        it = (it->second->canDiscard() ? _documents.erase(it) : ++it);
                    }

                    if (isUsedKit && _documents.empty())
                    {
                        TerminationFlag = true;
                        response += "down \r\n";
                    }
                    else if (tokens[0] == "query" && tokens.count() > 1)
                    {
                        if (tokens[1] == "url")
                        {
                            if (_documents.empty())
                            {
                                response += "empty \r\n";
                            }
                            else
                            {
                                // We really only support single URL hosting.
                                response += _documents.cbegin()->first + "\r\n";
                            }
                        }
                    }
                    else if (tokens[0] == "thread")
                    {
                        const std::string& sessionId = tokens[1];
                        const unsigned intSessionId = Util::decodeId(sessionId);
                        const std::string& url = tokens[2];

                        Log::debug("Thread request for session [" + sessionId + "], url: [" + url + "].");
                        auto it = _documents.lower_bound(url);
                        if (it == _documents.end())
                            it = _documents.emplace_hint(it, url, std::make_shared<Document>(loKit, jailId, url));

                        it->second->createSession(sessionId, intSessionId);
                        isUsedKit = true;
                        response += "ok \r\n";
                    }
                    else
                    {
                        response += "bad \r\n";
                    }

                    Util::writeFIFO(writerBroker, response);

                    // Don't log the CR LF at end
                    assert(response.length() > 2);
                    assert(response[response.length()-1] == '\n');
                    assert(response[response.length()-2] == '\r');
                    Log::trace("KitToBroker: " + response.substr(0, response.length()-2));
                    message.clear();
                }
            }
        }

        close(writerBroker);
        close(readerBroker);
    }
    catch (const Exception& exc)
    {
        Log::error() << exc.name() << ": " << exc.displayText()
                     << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                     << Log::end;
    }
    catch (const std::exception& exc)
    {
        Log::error(std::string("Exception: ") + exc.what());
    }

    Log::debug("Destroying documents.");
    _documents.clear();

    // Destroy LibreOfficeKit
    Log::debug("Destroying LibreOfficeKit.");
    if (loKit)
        loKit->pClass->destroy(loKit);

    std::ostringstream message;
    message << "rmdoc" << " "
            << Process::id() << " "
            << "\r\n";
    Util::writeFIFO(writerNotify, message.str());
    close(writerNotify);

    Log::info("Process [" + process_name + "] finished.");
}

#ifndef LOOLKIT_NO_MAIN

/// Simple argument parsing wrapper / helper for the above.
int main(int argc, char** argv)
{
    if (std::getenv("SLEEPFORDEBUGGER"))
    {
        std::cerr << "Sleeping " << std::getenv("SLEEPFORDEBUGGER")
                  << " seconds to attach debugger to process "
                  << Process::id() << std::endl;
        Thread::sleep(std::stoul(std::getenv("SLEEPFORDEBUGGER")) * 1000);
    }

    Log::initialize("kit");

    std::string childRoot;
    std::string sysTemplate;
    std::string loTemplate;
    std::string loSubPath;
    std::string pipe;

    for (int i = 1; i < argc; ++i)
    {
        char *cmd = argv[i];
        char *eq;

        if (std::strstr(cmd, "--childroot=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            childRoot = std::string(eq+1);
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
        else if (std::strstr(cmd, "--losubpath=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            loSubPath = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--pipe=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            pipe = std::string(eq+1);
        }
        else if (std::strstr(cmd, "--clientport=") == cmd)
        {
            eq = std::strchr(cmd, '=');
            ClientPortNumber = std::stoll(std::string(eq+1));
        }
    }

    if (loSubPath.empty())
    {
        Log::error("Error: --losubpath is empty");
        std::exit(Application::EXIT_SOFTWARE);
    }

    if (pipe.empty())
    {
        Log::error("Error: --pipe is empty");
        std::exit(Application::EXIT_SOFTWARE);
    }

    lokit_main(childRoot, sysTemplate, loTemplate, loSubPath, pipe);

    return Application::EXIT_OK;
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
