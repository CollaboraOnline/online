/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * The main entry point for the LibreOfficeKit process serving
 * a document editing session.
 */

#include <dlfcn.h>
#include <ftw.h>
#include <sys/capability.h>
#include <unistd.h>
#include <utime.h>

#include <atomic>
#include <cassert>
#include <condition_variable>
#include <iostream>

#include <memory>
#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitInit.h>
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include <Poco/Exception.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Process.h>
#include <Poco/Runnable.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Thread.h>
#include <Poco/Util/Application.h>
#include <Poco/URI.h>

#include "ChildProcessSession.hpp"
#include "Common.hpp"
#include "IoUtil.hpp"
#include "LOKitHelper.hpp"
#include "LOOLProtocol.hpp"
#include "QueueHandler.hpp"
#include "Util.hpp"

#define LIB_SOFFICEAPP  "lib" "sofficeapp" ".so"
#define LIB_MERGED      "lib" "mergedlo" ".so"

typedef int (LokHookPreInit)  (const char *install_path, const char *user_profile_path);

using namespace LOOLProtocol;

using Poco::Exception;
using Poco::File;
using Poco::Net::NetException;
using Poco::Net::HTTPClientSession;
using Poco::Net::HTTPResponse;
using Poco::Net::HTTPRequest;
using Poco::Net::WebSocket;
using Poco::Path;
using Poco::Process;
using Poco::Runnable;
using Poco::StringTokenizer;
using Poco::Thread;
using Poco::Timestamp;
using Poco::Util::Application;
using Poco::URI;

namespace
{
    typedef enum { COPY_ALL, COPY_LO, COPY_NO_USR } LinkOrCopyType;
    LinkOrCopyType linkOrCopyType;
    std::string sourceForLinkOrCopy;
    Path destinationForLinkOrCopy;

    bool shouldCopyDir(const char *path)
    {
        switch (linkOrCopyType)
        {
        case COPY_NO_USR:
            // bind mounted.
            return strcmp(path,"usr");
        case COPY_LO:
            return
                strcmp(path, "program/wizards") &&
                strcmp(path, "sdk") &&
                strcmp(path, "share/basic") &&
                strcmp(path, "share/gallery") &&
                strcmp(path, "share/Scripts") &&
                strcmp(path, "share/template") &&
                strcmp(path, "share/config/wizard") &&
                strcmp(path, "share/config/wizard");
        default: // COPY_ALL
            return true;
        }
    }

    int linkOrCopyFunction(const char *fpath,
                           const struct stat* /*sb*/,
                           int typeflag,
                           struct FTW* /*ftwbuf*/)
    {
        if (strcmp(fpath, sourceForLinkOrCopy.c_str()) == 0)
            return 0;

        assert(fpath[strlen(sourceForLinkOrCopy.c_str())] == '/');
        const char *relativeOldPath = fpath + strlen(sourceForLinkOrCopy.c_str()) + 1;
        Path newPath(destinationForLinkOrCopy, Path(relativeOldPath));

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
        case FTW_D:
            {
                struct stat st;
                if (stat(fpath, &st) == -1)
                {
                    Log::error("Error: stat(\"" + std::string(fpath) + "\") failed.");
                    return 1;
                }
                if (!shouldCopyDir(relativeOldPath))
                {
                    Log::trace("skip redundant paths " + std::string(relativeOldPath));
                    return FTW_SKIP_SUBTREE;
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
            Log::error("nftw: unexpected type: '" + std::to_string(typeflag));
            assert(false);
            break;
        }
        return 0;
    }

    void linkOrCopy(const std::string& source,
                    const Path& destination,
                    LinkOrCopyType type)
    {
        linkOrCopyType = type;
        sourceForLinkOrCopy = source;
        if (sourceForLinkOrCopy.back() == '/')
            sourceForLinkOrCopy.pop_back();
        destinationForLinkOrCopy = destination;
        if (nftw(source.c_str(), linkOrCopyFunction, 10, FTW_ACTIONRETVAL) == -1)
            Log::error("linkOrCopy: nftw() failed for '" + source + "'");
    }

    void dropCapability(cap_value_t capability)
    {
        cap_t caps;
        cap_value_t cap_list[] = { capability };

        caps = cap_get_proc();
        if (caps == nullptr)
        {
            Log::error("Error: cap_get_proc() failed.");
            std::exit(1);
        }

        char *capText = cap_to_text(caps, nullptr);
        Log::trace("Capabilities first: " + std::string(capText));
        cap_free(capText);

        if (cap_set_flag(caps, CAP_EFFECTIVE, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1 ||
            cap_set_flag(caps, CAP_PERMITTED, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1)
        {
            Log::error("Error: cap_set_flag() failed.");
            std::exit(1);
        }

        if (cap_set_proc(caps) == -1)
        {
            Log::error("Error: cap_set_proc() failed.");
            std::exit(1);
        }

        capText = cap_to_text(caps, nullptr);
        Log::trace("Capabilities now: " + std::string(capText));
        cap_free(capText);

        cap_free(caps);
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
        join();
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
        // The thread is joinable only once.
        std::unique_lock<std::mutex> lock(_threadMutex);
        if (!_joined)
        {
            _thread.join();
            _joined = true;
        }
    }

    void handle(std::shared_ptr<TileQueue> queue, const std::string& firstLine, char* buffer, int n)
    {
        if (firstLine.find("paste") != 0)
        {
            // Everything else is expected to be a single line.
            assert(firstLine.size() == static_cast<std::string::size_type>(n));
            queue->put(firstLine);
        }
        else
            queue->put(std::string(buffer, n));
    }

    void run() override
    {
        const std::string thread_name = "kit_ws_" + _session->getId();

        Util::setThreadName(thread_name);

        Log::debug("Thread [" + thread_name + "] started.");

        try
        {
            auto queue = std::make_shared<TileQueue>();
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

            queue->clear();
            queue->put("eof");
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
    std::atomic<unsigned> _stop;
    std::mutex _threadMutex;
    std::atomic<unsigned> _joined;
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
             const std::string& docKey,
             const std::string& url)
      : _multiView(std::getenv("LOK_VIEW_CALLBACK")),
        _loKit(loKit),
        _jailId(jailId),
        _docKey(docKey),
        _url(url),
        _loKitDocument(nullptr),
        _docPassword(""),
        _isDocPasswordProvided(false),
        _isDocPasswordProtected(false),
        _docPasswordType(PasswordType::ToView),
        _isLoading(0),
        _clientViews(0)
    {
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
                    if (ws)
                    {
                        ws->shutdownReceive();
                        aIterator.second->join();
                    }
                }
            }
            catch(NetException& exc)
            {
                Log::error() << "Document::~Document: " << exc.displayText()
                             << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                             << Log::end;
            }
        }

        // Destroy all connections and views.
        _connections.clear();

        // TODO. check what is happening when destroying lokit document,
        // often it blows up.
        // Destroy the document.
        if (_loKitDocument != nullptr)
        {
            try
            {
                _loKitDocument->pClass->destroy(_loKitDocument);
            }
            catch (const std::exception& exc)
            {
                Log::error() << "Document::~Document: " << exc.what()
                             << Log::end;
            }
        }
    }

    const std::string& getUrl() const { return _url; }

    bool createSession(const std::string& sessionId, const unsigned intSessionId)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        try
        {
            const auto& it = _connections.find(intSessionId);
            if (it != _connections.end())
            {
                // found item, check if still running
                if (it->second->isRunning())
                {
                    Log::warn("Session [" + sessionId + "] is already running.");
                    return true;
                }

                // Restore thread. TODO: Review this logic.
                Log::warn("Session [" + sessionId + "] is not running. Restoring.");
                _connections.erase(intSessionId);
            }

            Log::info() << "Creating " << (_clientViews ? "new" : "first")
                        << " view for url: " << _url << " for sessionId: " << sessionId
                        << " on jailId: " << _jailId << Log::end;

            // Open websocket connection between the child process and the
            // parent. The parent forwards us requests that it can't handle (i.e most).
            HTTPClientSession cs("127.0.0.1", MASTER_PORT_NUMBER);
            cs.setTimeout(0);
            HTTPRequest request(HTTPRequest::HTTP_GET, std::string(CHILD_URI) + "sessionId=" + sessionId + "&jailId=" + _jailId + "&docKey=" + _docKey);
            HTTPResponse response;

            auto ws = std::make_shared<WebSocket>(cs, request, response);
            ws->setReceiveTimeout(0);

            auto session = std::make_shared<ChildProcessSession>(sessionId, ws, _loKitDocument, _jailId,
                           [this](const std::string& id, const std::string& uri, const std::string& docPassword, bool isDocPasswordProvided) { return onLoad(id, uri, docPassword, isDocPasswordProvided); },
                           [this](const std::string& id) { onUnload(id); });

            auto thread = std::make_shared<Connection>(session, ws);
            const auto aInserted = _connections.emplace(intSessionId, thread);
            if (aInserted.second)
            {
                thread->start();
            }
            else
            {
                Log::error("Connection already exists for child: " + _jailId + ", session: " + sessionId);
            }

            Log::debug("Connections: " + std::to_string(_connections.size()));
            return true;
        }
        catch (const std::exception& ex)
        {
            Log::error("Exception while creating session [" + sessionId + "] on url [" + _url + "] - '" + ex.what() + "'.");
            return false;
        }
    }

    /// Purges dead connections and returns
    /// the remaining number of clients.
    /// Returns -1 on failure.
    size_t purgeSessions()
    {
        std::vector<std::shared_ptr<ChildProcessSession>> deadSessions;
        size_t num_connections = 0;
        {
            std::unique_lock<std::mutex> lock(_mutex, std::defer_lock);
            if (!lock.try_lock())
            {
                // Not a good time, try later.
                return -1;
            }

            for (auto it = _connections.cbegin(); it != _connections.cend(); )
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

            num_connections = _connections.size();
        }

        // Don't destroy sessions while holding our lock.
        // We may deadlock if a session is waiting on us
        // during callback initiated while handling a command
        // and the dtor tries to take its lock (which is taken).
        deadSessions.clear();

        return num_connections;
    }

    /// Returns true if at least one *live* connection exists.
    /// Does not consider user activity, just socket status.
    bool hasConnections()
    {
        // -ve values for failure.
        return purgeSessions() != 0;
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
            std::unique_lock<std::mutex> lock(self->_mutex);
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
        Log::trace() << "Document::DocumentCallback "
                     << LOKitHelper::kitCallbackTypeToString(nType)
                     << " [" << (pPayload ? pPayload : "") << "]." << Log::end;
        Document* self = reinterpret_cast<Document*>(pData);
        if (self)
        {
            std::unique_lock<std::mutex> lock(self->_mutex);

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

        std::unique_lock<std::mutex> lock(_mutex);
        while (_isLoading)
        {
            _cvLoading.wait(lock);
        }

        // Flag and release lock.
        ++_isLoading;
        lock.unlock();

        try
        {
            load(sessionId, uri, docPassword, isDocPasswordProvided);
        }
        catch (const std::exception& exc)
        {
            Log::error("Exception while loading [" + uri + "] : " + exc.what());
        }

        // Done loading, let the next one in (if any).
        lock.lock();
        ++_clientViews;
        --_isLoading;
        _cvLoading.notify_one();

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
        std::unique_lock<std::mutex> lock(_mutex);

        Log::info("Session " + sessionId + " is unloading. Erasing connection.");
        _connections.erase(it);
        --_clientViews;
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

    LibreOfficeKitDocument* load(const std::string& sessionId, const std::string& uri, const std::string& docPassword, bool isDocPasswordProvided)
    {
        const unsigned intSessionId = Util::decodeId(sessionId);
        const auto it = _connections.find(intSessionId);
        if (it == _connections.end() || !it->second)
        {
            Log::error("Cannot find session [" + sessionId + "].");
            return nullptr;
        }

        auto session = it->second->getSession();

        if (_loKitDocument == nullptr)
        {
            // This is the first time we are loading the document
            Log::info("Loading new document from URI: [" + uri + "] for session [" + sessionId + "].");

            if (LIBREOFFICEKIT_HAS(_loKit, registerCallback))
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

            Log::debug("Calling documentLoad");
            _loKitDocument = _loKit->pClass->documentLoad(_loKit, uri.c_str());
            Log::debug("documentLoad returned");

            if (_loKitDocument == nullptr)
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

        return _loKitDocument;
    }

private:

    const bool _multiView;
    LibreOfficeKit* const _loKit;
    const std::string _jailId;
    const std::string _docKey;
    const std::string _url;
    std::string _jailedUrl;

    LibreOfficeKitDocument *_loKitDocument;

    // Document password provided
    std::string _docPassword;
    // Whether password was provided or not
    bool _isDocPasswordProvided;
    // Whether document is password protected
    bool _isDocPasswordProtected;
    // Whether password is required to view the document, or modify it
    PasswordType _docPasswordType;

    std::mutex _mutex;
    std::condition_variable _cvLoading;
    std::atomic_size_t _isLoading;
    std::map<unsigned, std::shared_ptr<Connection>> _connections;
    std::atomic_size_t _clientViews;
};

void lokit_main(const std::string& childRoot,
                const std::string& sysTemplate,
                const std::string& loTemplate,
                const std::string& loSubPath)
{
    // Reinitialize logging when forked.
    Log::initialize("kit");
    Util::rng::reseed();

    assert(!childRoot.empty());
    assert(!sysTemplate.empty());
    assert(!loTemplate.empty());
    assert(!loSubPath.empty());

    // We only host a single document in our lifetime.
    std::shared_ptr<Document> document;

    // Ideally this will be a random ID, but broker will cleanup
    // our jail directory when we die, and it's simpler to know
    // the jailId (i.e. the path) implicitly by knowing our pid.
    static const std::string pid = std::to_string(Process::id());
    static const std::string jailId = pid;
    static const std::string process_name = "loolkit";

    Util::setThreadName(process_name);

    Util::setTerminationSignals();
    Util::setFatalSignals();

    Log::debug("Process [" + process_name + "] started.");

    static const std::string instdir_path = "/" + loSubPath + "/program";
    LibreOfficeKit* loKit = nullptr;

    try
    {
        const Path jailPath = Path::forDirectory(childRoot + Path::separator() + jailId);
        Log::info("Jail path: " + jailPath.toString());
        File(jailPath).createDirectories();

        // Create a symlink inside the jailPath so that the absolute pathname loTemplate, when
        // interpreted inside a chroot at jailPath, points to loSubPath (relative to the chroot).
        Path symlinkSource(jailPath, Path(loTemplate.substr(1)));
        File(symlinkSource.parent()).createDirectories();

        std::string symlinkTarget;
        for (auto i = 0; i < Path(loTemplate).depth(); i++)
            symlinkTarget += "../";
        symlinkTarget += loSubPath;

        Log::debug("symlink(\"" + symlinkTarget + "\",\"" + symlinkSource.toString() + "\")");
        if (symlink(symlinkTarget.c_str(), symlinkSource.toString().c_str()) == -1)
        {
            Log::error("Error: symlink(\"" + symlinkTarget + "\",\"" + symlinkSource.toString() + "\") failed");
            throw Exception("symlink() failed");
        }

        Path jailLOInstallation(jailPath, loSubPath);
        jailLOInstallation.makeDirectory();
        File(jailLOInstallation).createDirectory();

        // Copy (link) LO installation and other necessary files into it from the template.
        bool bLoopMounted = false;
        if (getenv("LOOL_BIND_MOUNT"))
        {
            Path usrSrcPath(sysTemplate, "usr");
            Path usrDestPath(jailPath, "usr");
            File(usrDestPath).createDirectory();
            std::string mountCommand =
                std::string("loolmount ") +
                usrSrcPath.toString() +
                std::string(" ") +
                usrDestPath.toString();
            Log::debug("Initializing jail bind mount.");
            bLoopMounted = !system(mountCommand.c_str());
            Log::debug("Initialized jail bind mount.");
        }
        linkOrCopy(sysTemplate, jailPath,
                   bLoopMounted ? COPY_NO_USR : COPY_ALL);
        linkOrCopy(loTemplate, jailLOInstallation, COPY_LO);

        Log::debug("Initialized jail files.");

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

        Log::debug("Initialized jail nodes, dropped caps.");

        loKit = lok_init_2(instdir_path.c_str(), "file:///user");
        if (loKit == nullptr)
        {
            Log::error("Error: LibreOfficeKit initialization failed. Exiting.");
            std::exit(Application::EXIT_SOFTWARE);
        }

        Log::info("loolkit [" + std::to_string(Process::id()) + "] is ready.");

        // Open websocket connection between the child process and WSD.
        HTTPClientSession cs("127.0.0.1", MASTER_PORT_NUMBER);
        cs.setTimeout(0);
        HTTPRequest request(HTTPRequest::HTTP_GET, std::string(NEW_CHILD_URI) + "pid=" + pid);
        HTTPResponse response;
        auto ws = std::make_shared<WebSocket>(cs, request, response);
        ws->setReceiveTimeout(0);

        const std::string socketName = "ChildControllerWS";
        IoUtil::SocketProcessor(ws, response, [&socketName, &ws, &document, &loKit](const std::vector<char>& data)
                {
                    const std::string message(data.data(), data.size());
                    Log::debug(socketName + ": recv [" + message + "].");
                    StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

                    if (TerminationFlag)
                    {
                        Log::debug("Too late, we're going down");
                    }
                    else if (tokens[0] == "session")
                    {
                        const std::string& sessionId = tokens[1];
                        const unsigned intSessionId = Util::decodeId(sessionId);
                        const std::string& docKey = tokens[2];

                        std::string url;
                        URI::decode(docKey, url);
                        Log::info("New session [" + sessionId + "] request on url [" + url + "].");

                        if (!document)
                        {
                            document = std::make_shared<Document>(loKit, jailId, docKey, url);
                        }

                        // Validate and create session.
                        if (!(url == document->getUrl() &&
                            document->createSession(sessionId, intSessionId)))
                        {
                            Log::debug("Create Session failed");
                        }
                    }
                    else if (document && document->canDiscard())
                    {
                        TerminationFlag = true;
                    }
                    else
                    {
                        Log::info("bad unknown token [" + tokens[0] + "]");
                    }

                    return true;
                },
                [](){ return TerminationFlag; },
                socketName);

        // Cleanup jail.
        Util::removeFile(jailPath, true);
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

    Log::info("Process [" + process_name + "] finished.");
    _exit(Application::EXIT_OK);
}

/// Initializes LibreOfficeKit for cross-fork re-use.
bool globalPreinit(const std::string &loTemplate)
{
    const std::string libSofficeapp = loTemplate + "/program/" LIB_SOFFICEAPP;
    const std::string libMerged = loTemplate + "/program/" LIB_MERGED;

    std::string loadedLibrary;
    void *handle;
    if (File(libMerged).exists())
    {
        handle = dlopen(libMerged.c_str(), RTLD_GLOBAL|RTLD_NOW);
        if (!handle)
        {
            Log::error("Failed to load " + libMerged + ": " + std::string(dlerror()));
            return false;
        }
        loadedLibrary = libMerged;
    }
    else
    {
        if (File(libSofficeapp).exists())
        {
            handle = dlopen(libSofficeapp.c_str(), RTLD_GLOBAL|RTLD_NOW);
            if (!handle)
            {
                Log::error("Failed to load " + libSofficeapp + ": " + std::string(dlerror()));
                return false;
            }
            loadedLibrary = libSofficeapp;
        }
        else
        {
            Log::error("Neither " + libSofficeapp + " or " + libMerged + " exist.");
            return false;
        }
    }

    LokHookPreInit* preInit = (LokHookPreInit *)dlsym(handle, "lok_preinit");
    if (!preInit)
    {
        Log::error("No lok_preinit symbol in " + loadedLibrary + ": " + std::string(dlerror()));
        return false;
    }

    if (preInit((loTemplate + "/program").c_str(), "file:///user") != 0)
    {
        Log::error("lok_preinit() in " + loadedLibrary + " failed");
        return false;
    }

    return true;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
