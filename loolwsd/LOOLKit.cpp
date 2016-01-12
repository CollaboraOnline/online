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

#include <atomic>
#include <memory>
#include <iostream>

#include <Poco/Net/WebSocket.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Thread.h>
#include <Poco/ThreadPool.h>
#include <Poco/Runnable.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Exception.h>
#include <Poco/Process.h>
#include <Poco/Environment.h>
#include <Poco/NotificationQueue.h>
#include <Poco/Notification.h>
#include <Poco/Mutex.h>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitInit.h>

#include "Common.hpp"
#include "QueueHandler.hpp"
#include "Util.hpp"
#include "ChildProcessSession.hpp"
#include "LOOLProtocol.hpp"

using namespace LOOLProtocol;
using Poco::Net::WebSocket;
using Poco::Net::HTTPClientSession;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Thread;
using Poco::Runnable;
using Poco::StringTokenizer;
using Poco::Exception;
using Poco::Process;
using Poco::Notification;
using Poco::NotificationQueue;
using Poco::FastMutex;

const std::string CHILD_URI = "/loolws/child/";
const std::string LOKIT_BROKER = "/tmp/loolbroker.fifo";

class CallBackNotification: public Poco::Notification
{
public:
    typedef Poco::AutoPtr<CallBackNotification> Ptr;

    CallBackNotification(const int nType, const std::string& rPayload, std::shared_ptr<ChildProcessSession>& pSession)
      : m_nType(nType),
        m_aPayload(rPayload),
        m_pSession(pSession)
    {
    }

    const int m_nType;
    const std::string m_aPayload;
    const std::shared_ptr<ChildProcessSession> m_pSession;
};

// This thread handles callbacks from the
// lokit instance.
class CallBackWorker: public Runnable
{
public:
    CallBackWorker(NotificationQueue& queue):
        _queue(queue),
        _stop(false)
    {
    }

    std::string callbackTypeToString (const int nType)
    {
        switch (nType)
        {
        case LOK_CALLBACK_INVALIDATE_TILES:
            return std::string("LOK_CALLBACK_INVALIDATE_TILES");
        case LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR:
            return std::string("LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR");
        case LOK_CALLBACK_TEXT_SELECTION:
            return std::string("LOK_CALLBACK_TEXT_SELECTION");
        case LOK_CALLBACK_TEXT_SELECTION_START:
            return std::string("LOK_CALLBACK_TEXT_SELECTION_START");
        case LOK_CALLBACK_TEXT_SELECTION_END:
            return std::string("LOK_CALLBACK_TEXT_SELECTION_END");
        case LOK_CALLBACK_CURSOR_VISIBLE:
            return std::string("LOK_CALLBACK_CURSOR_VISIBLE");
        case LOK_CALLBACK_GRAPHIC_SELECTION:
            return std::string("LOK_CALLBACK_GRAPHIC_SELECTION");
        case LOK_CALLBACK_CELL_CURSOR:
            return std::string("LOK_CALLBACK_CELL_CURSOR");
        case LOK_CALLBACK_CELL_FORMULA:
            return std::string("LOK_CALLBACK_CELL_FORMULA");
        case LOK_CALLBACK_MOUSE_POINTER:
            return std::string("LOK_CALLBACK_MOUSE_POINTER");
        case LOK_CALLBACK_SEARCH_RESULT_SELECTION:
            return std::string("LOK_CALLBACK_SEARCH_RESULT_SELECTION");
        case LOK_CALLBACK_UNO_COMMAND_RESULT:
            return std::string("LOK_CALLBACK_UNO_COMMAND_RESULT");
        case LOK_CALLBACK_HYPERLINK_CLICKED:
            return std::string("LOK_CALLBACK_HYPERLINK_CLICKED");
        case LOK_CALLBACK_STATE_CHANGED:
            return std::string("LOK_CALLBACK_STATE_CHANGED");
        case LOK_CALLBACK_STATUS_INDICATOR_START:
            return std::string("LOK_CALLBACK_STATUS_INDICATOR_START");
        case LOK_CALLBACK_STATUS_INDICATOR_SET_VALUE:
            return std::string("LOK_CALLBACK_STATUS_INDICATOR_SET_VALUE");
        case LOK_CALLBACK_STATUS_INDICATOR_FINISH:
            return std::string("LOK_CALLBACK_STATUS_INDICATOR_FINISH");
        case LOK_CALLBACK_SEARCH_NOT_FOUND:
            return std::string("LOK_CALLBACK_SEARCH_NOT_FOUND");
        case LOK_CALLBACK_DOCUMENT_SIZE_CHANGED:
            return std::string("LOK_CALLBACK_DOCUMENT_SIZE_CHANGED");
        case LOK_CALLBACK_SET_PART:
            return std::string("LOK_CALLBACK_SET_PART");
        }
        return std::to_string(nType);
    }

    void callback(const int nType, const std::string& rPayload, std::shared_ptr<ChildProcessSession> pSession)
    {
        auto lock = pSession->getLock();

        Log::trace() << "Callback [" << pSession->getViewId() << "] "
                     << callbackTypeToString(nType)
                     << " [" << rPayload << "]." << Log::end;

        switch (static_cast<LibreOfficeKitCallbackType>(nType))
        {
        case LOK_CALLBACK_INVALIDATE_TILES:
            {
                int curPart = pSession->getLoKitDocument()->pClass->getPart(pSession->getLoKitDocument());
                pSession->sendTextFrame("curpart: part=" + std::to_string(curPart));
                if (pSession->getDocType() == "text")
                {
                    curPart = 0;
                }

                StringTokenizer tokens(rPayload, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
                if (tokens.count() == 4)
                {
                    int x, y, width, height;

                    try
                    {
                        x = std::stoi(tokens[0]);
                        y = std::stoi(tokens[1]);
                        width = std::stoi(tokens[2]);
                        height = std::stoi(tokens[3]);
                    }
                    catch (const std::out_of_range&)
                    {
                        // something went wrong, invalidate everything
                        Log::warn("Ignoring integer values out of range: " + rPayload);
                        x = 0;
                        y = 0;
                        width = INT_MAX;
                        height = INT_MAX;
                    }

                    pSession->sendTextFrame("invalidatetiles:"
                                       " part=" + std::to_string(curPart) +
                                       " x=" + std::to_string(x) +
                                       " y=" + std::to_string(y) +
                                       " width=" + std::to_string(width) +
                                       " height=" + std::to_string(height));
                }
                else
                {
                    pSession->sendTextFrame("invalidatetiles: " + rPayload);
                }
            }
            break;
        case LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR:
            pSession->sendTextFrame("invalidatecursor: " + rPayload);
            break;
        case LOK_CALLBACK_TEXT_SELECTION:
            pSession->sendTextFrame("textselection: " + rPayload);
            break;
        case LOK_CALLBACK_TEXT_SELECTION_START:
            pSession->sendTextFrame("textselectionstart: " + rPayload);
            break;
        case LOK_CALLBACK_TEXT_SELECTION_END:
            pSession->sendTextFrame("textselectionend: " + rPayload);
            break;
        case LOK_CALLBACK_CURSOR_VISIBLE:
            pSession->sendTextFrame("cursorvisible: " + rPayload);
            break;
        case LOK_CALLBACK_GRAPHIC_SELECTION:
            pSession->sendTextFrame("graphicselection: " + rPayload);
            break;
        case LOK_CALLBACK_CELL_CURSOR:
            pSession->sendTextFrame("cellcursor: " + rPayload);
            break;
        case LOK_CALLBACK_CELL_FORMULA:
            pSession->sendTextFrame("cellformula: " + rPayload);
            break;
        case LOK_CALLBACK_MOUSE_POINTER:
            pSession->sendTextFrame("mousepointer: " + rPayload);
            break;
        case LOK_CALLBACK_HYPERLINK_CLICKED:
            pSession->sendTextFrame("hyperlinkclicked: " + rPayload);
            break;
        case LOK_CALLBACK_STATE_CHANGED:
            pSession->sendTextFrame("statechanged: " + rPayload);
            break;
        case LOK_CALLBACK_STATUS_INDICATOR_START:
            pSession->sendTextFrame("statusindicatorstart:");
            break;
        case LOK_CALLBACK_STATUS_INDICATOR_SET_VALUE:
            pSession->sendTextFrame("statusindicatorsetvalue: " + rPayload);
            break;
        case LOK_CALLBACK_STATUS_INDICATOR_FINISH:
            pSession->sendTextFrame("statusindicatorfinish:");
            break;
        case LOK_CALLBACK_SEARCH_NOT_FOUND:
            pSession->sendTextFrame("searchnotfound: " + rPayload);
            break;
        case LOK_CALLBACK_SEARCH_RESULT_SELECTION:
            pSession->sendTextFrame("searchresultselection: " + rPayload);
            break;
        case LOK_CALLBACK_DOCUMENT_SIZE_CHANGED:
            pSession->getStatus("", 0);
            pSession->getPartPageRectangles("", 0);
            break;
        case LOK_CALLBACK_SET_PART:
            pSession->sendTextFrame("setpart: " + rPayload);
            break;
        case LOK_CALLBACK_UNO_COMMAND_RESULT:
            pSession->sendTextFrame("unocommandresult: " + rPayload);
            break;
        }
    }

    void run()
    {
        static const std::string thread_name = "kit_callback";
#ifdef __linux
        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(thread_name.c_str()), 0, 0, 0) != 0)
            Log::error("Cannot set thread name to " + thread_name + ".");
#endif
        Log::debug("Thread [" + thread_name + "] started.");

        while (!_stop && !TerminationFlag)
        {
            Notification::Ptr aNotification(_queue.waitDequeueNotification());
            if (!TerminationFlag && aNotification)
            {
                CallBackNotification::Ptr aCallBackNotification = aNotification.cast<CallBackNotification>();
                if (aCallBackNotification)
                {
                    const auto nType = aCallBackNotification->m_nType;
                    try
                    {
                        callback(nType, aCallBackNotification->m_aPayload, aCallBackNotification->m_pSession);
                    }
                    catch (const Exception& exc)
                    {
                        Log::error() << "Error while handling callback [" << callbackTypeToString(nType) << "]. "
                                     << exc.displayText()
                                     << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                                     << Log::end;
                    }
                    catch (const std::exception& exc)
                    {
                        Log::error("Error while handling callback [" + callbackTypeToString(nType) + "]. " +
                                   std::string("Exception: ") + exc.what());
                    }
                    catch (...)
                    {
                        Log::error("Unexpected Exception while handling callback [" + callbackTypeToString(nType) + "].");
                    }
                }
            }
            else break;
        }

        Log::debug("Thread [" + thread_name + "] finished.");
    }

    void wakeUpAll()
    {
        _queue.wakeUpAll();
    }

    void stop()
    {
        _stop = true;
    }

private:
    NotificationQueue& _queue;
    volatile bool _stop;
};

class Connection: public Runnable
{
public:
    Connection(LibreOfficeKit *loKit, LibreOfficeKitDocument *loKitDocument,
               const std::string& jailId, const std::string& sessionId,
               std::function<LibreOfficeKitDocument*(const std::string&, const std::string&)> onLoad,
               std::function<void(const std::string&)> onUnload) :
        _loKit(loKit),
        _loKitDocument(loKitDocument),
        _jailId(jailId),
        _sessionId(sessionId),
        _stop(false),
        _onLoad(onLoad),
        _onUnload(onUnload)
    {
        Log::info("Connection ctor in child: " + _jailId + ", thread: " + _sessionId);
    }

    ~Connection()
    {
        Log::info("~Connection dtor in child: " + _jailId + ", thread: " + _sessionId);
        stop();
    }

    const std::string& getSessionId() const { return _sessionId; }
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

    void run() override
    {
        static const std::string thread_name = "kit_ws_" + _sessionId;
#ifdef __linux
        if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(thread_name.c_str()), 0, 0, 0) != 0)
            Log::error("Cannot set thread name to " + thread_name + ".");
#endif
        Log::debug("Thread [" + thread_name + "] started.");

        try
        {
            // Open websocket connection between the child process and the
            // parent. The parent forwards us requests that it can't handle.

            HTTPClientSession cs("127.0.0.1", MASTER_PORT_NUMBER);
            cs.setTimeout(0);
            HTTPRequest request(HTTPRequest::HTTP_GET, CHILD_URI + _sessionId);
            HTTPResponse response;
            _ws = std::make_shared<WebSocket>(cs, request, response);

            _session.reset(new ChildProcessSession(_sessionId, _ws, _loKit, _loKitDocument, _jailId, _onLoad, _onUnload));
            _ws->setReceiveTimeout(0);

            // child Jail TID PID
            std::string hello("child " + _jailId + " " +
                              _sessionId + " " + std::to_string(Process::id()));
            _session->sendTextFrame(hello);

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
                        break;

                    StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

                    // The only kind of messages a child process receives are the single-line ones (?)
                    assert(firstLine.size() == static_cast<std::string::size_type>(n));

                    queue.put(firstLine);
                }
            }
            while (n > 0 && (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE && !_stop);

            queue.clear();
            queue.put("eof");
            queueHandlerThread.join();

            // We should probably send the Client some sensible message and reason.
            _session->sendTextFrame("eof");
            _session.reset();
        }
        catch (const Exception& exc)
        {
            Log::error() << "Error: " << exc.displayText()
                         << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                         << Log::end;
        }
        catch (const std::exception& exc)
        {
            Log::error(std::string("Exception: ") + exc.what());
        }
        catch (...)
        {
            Log::error("Unexpected Exception.");
        }

        Log::debug("Thread [" + thread_name + "] finished.");
    }

private:
    LibreOfficeKit *_loKit;
    LibreOfficeKitDocument *_loKitDocument;
    const std::string _jailId;
    const std::string _sessionId;
    Thread _thread;
    std::shared_ptr<ChildProcessSession> _session;
    volatile bool _stop;
    std::function<LibreOfficeKitDocument*(const std::string&, const std::string&)> _onLoad;
    std::function<void(const std::string&)> _onUnload;
    std::shared_ptr<WebSocket> _ws;
};

// A document container.
// Owns LOKitDocument instance and connections.
// Manages the lifetime of a document.
// Technically, we can host multiple documents
// per process. But for security reasons don't.
// However, we could have a loolkit instance
// per user or group of users (a trusted circle).
class Document
{
public:
    Document(LibreOfficeKit *loKit,
             const std::string& jailId,
             const std::string& url)
      : _multiView(getenv("LOK_VIEW_CALLBACK")),
        _loKit(loKit),
        _jailId(jailId),
        _url(url),
        _loKitDocument(nullptr),
        _clientViews(0),
        _callbackWorker(_callbackQueue)
    {
        Log::info("Document ctor for url [" + _url + "] on child [" + _jailId +
                  "] LOK_VIEW_CALLBACK=" + std::to_string(_multiView) + ".");

        _callbackThread.start(_callbackWorker);
    }

    ~Document()
    {
        std::unique_lock<std::mutex> lock(_mutex);

        Log::info("~Document dtor for url [" + _url + "] on child [" + _jailId +
                  "]. There are " + std::to_string(_clientViews) + " views.");

        // Wait for the callback worker to finish.
        _callbackWorker.stop();
        _callbackWorker.wakeUpAll();
        _callbackThread.join();

        // Flag all connections to stop.
        for (auto aIterator : _connections)
        {
            aIterator.second->stop();
        }

        // Destroy all connections and views.
        for (auto aIterator : _connections)
        {
            if (TerminationState == LOOLState::LOOL_ABNORMAL)
            {
                // stop all websockets
                std::shared_ptr<WebSocket> ws = aIterator.second->getWebSocket();
                if ( ws )
                    ws->shutdownReceive();
            }
            else
            {
                // wait until loolwsd close all websockets
                aIterator.second->join();
            }
        }

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
        std::unique_lock<std::mutex> lock(_mutex);

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
                    << " view for url: " << _url << "for thread: " << sessionId
                    << " on child: " << _jailId << Log::end;

        auto thread = std::make_shared<Connection>(_loKit, _loKitDocument, _jailId, sessionId,
                                                   [this](const std::string& id, const std::string& uri) { return onLoad(id, uri); },
                                                   [this](const std::string& id) { onUnload(id); });

        const auto aInserted = _connections.emplace(intSessionId, thread);

        if ( aInserted.second )
            thread->start();
        else
            Log::error("Connection already exists for child: " + _jailId + ", thread: " + sessionId);

        Log::debug("Connections: " + std::to_string(_connections.size()));
    }

    void purgeSessions()
    {
        std::unique_lock<std::mutex> lock(_mutex);

        for (auto it =_connections.cbegin(); it != _connections.cend(); )
        {
            if (!it->second->isRunning())
            {
                _connections.erase(it++);
                continue;
            }
            it++;
        }
    }

    bool hasConnections()
    {
        std::unique_lock<std::mutex> lock(_mutex);

        return !_connections.empty();
    }

private:

    static void ViewCallback(int , const char* , void* )
    {
        //TODO: Delegate the callback.
        //const unsigned intSessionId = reinterpret_cast<unsigned>(pData);
        //auto pNotif = new CallBackNotification(nType, pPayload ? pPayload : "(nil)", pData);
        //_callbackQueue.enqueueNotification(pNotif);
    }

    static void DocumentCallback(int nType, const char* pPayload, void* pData)
    {
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
                        auto pNotif = new CallBackNotification(nType, pPayload ? pPayload : "(nil)", session);
                        _callbackQueue.enqueueNotification(pNotif);
                    }
                }
            }
        }
    }

    /// Load a document (or view) and register callbacks.
    LibreOfficeKitDocument* onLoad(const std::string& sessionId, const std::string& uri)
    {
        Log::info("Session " + sessionId + " is loading. " + std::to_string(_clientViews) + " views loaded.");
        const unsigned intSessionId = Util::decodeId(sessionId);

        std::unique_lock<std::mutex> lock(_mutex);

        const auto it = _connections.find(intSessionId);
        if (it == _connections.end() || !it->second)
        {
            Log::error("Cannot find session [" + sessionId + "] which decoded to " + std::to_string(intSessionId));
            return nullptr;
        }

        if (_loKitDocument == nullptr)
        {
            Log::info("Loading new document from URI: [" + uri + "] for session [" + sessionId + "].");

            if ( LIBREOFFICEKIT_HAS(_loKit, registerCallback))
                _loKit->pClass->registerCallback(_loKit, DocumentCallback, this);

            // documentLoad will trigger callback, which needs to take the lock.
            lock.unlock();
            if ((_loKitDocument = _loKit->pClass->documentLoad(_loKit, uri.c_str())) == nullptr)
            {
                Log::error("Failed to load: " + uri + ", error: " + _loKit->pClass->getError(_loKit));
                return nullptr;
            }

            // Retake the lock.
            lock.lock();
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

        ++_clientViews;
        return _loKitDocument;
    }

    void onUnload(const std::string& sessionId)
    {
        Log::info("Session " + sessionId + " is unloading. " + std::to_string(_clientViews - 1) + " views left.");
        const unsigned intSessionId = Util::decodeId(sessionId);

        std::unique_lock<std::mutex> lock(_mutex);

        const auto it = _connections.find(intSessionId);
        if (it == _connections.end() || !it->second)
        {
            Log::error("Cannot find session [" + sessionId + "] which decoded to " + std::to_string(intSessionId));
            return;
        }

        --_clientViews;

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

    LibreOfficeKitDocument *_loKitDocument;

    std::mutex _mutex;
    std::map<unsigned, std::shared_ptr<Connection>> _connections;
    std::atomic<unsigned> _clientViews;

    CallBackWorker _callbackWorker;
    Thread _callbackThread;
    static Poco::NotificationQueue _callbackQueue;
};

Poco::NotificationQueue Document::_callbackQueue;

void lokit_main(const std::string &loSubPath, const std::string& jailId, const std::string& pipe)
{
#ifdef LOOLKIT_NO_MAIN
    // Reinitialize logging when forked.
    Log::initialize("kit");
#endif

    struct pollfd aPoll;
    ssize_t nBytes = -1;
    char  aBuffer[PIPE_BUFFER];
    char* pStart = nullptr;
    char* pEnd = nullptr;

    assert(!jailId.empty());
    assert(!loSubPath.empty());

    std::map<std::string, std::shared_ptr<Document>> _documents;

    static const std::string process_name = "loolkit";
#ifdef __linux
    if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(process_name.c_str()), 0, 0, 0) != 0)
        Log::error("Cannot set process name to " + process_name + ".");
    Util::setSignals(false);
#endif
    Log::debug("Process [" + process_name + "] started.");

    static const std::string instdir_path =
#ifdef __APPLE__
                    ("/" + loSubPath + "/Frameworks");
#else
                    ("/" + loSubPath + "/program");
#endif

    std::unique_ptr<LibreOfficeKit> loKit(lok_init_2(instdir_path.c_str(), "file:///user"));

    if (!loKit)
    {
        Log::error("Error: LibreOfficeKit initialization failed. Exiting.");
        exit(-1);
    }

    try
    {
        int writerBroker;
        int readerBroker;

        if ( (readerBroker = open(pipe.c_str(), O_RDONLY) ) < 0 )
        {
            Log::error("Error: failed to open pipe [" + pipe + "] read only.");
            exit(-1);
        }

        if ( (writerBroker = open(LOKIT_BROKER.c_str(), O_WRONLY) ) < 0 )
        {
            Log::error("Error: failed to open pipe [" + LOKIT_BROKER + "] write only.");
            exit(-1);
        }

        Log::info("loolkit [" + std::to_string(Process::id()) + "] is ready.");

        std::string aResponse;
        std::string aMessage;

        while (!TerminationFlag)
        {
            if ( pStart == pEnd )
            {
                aPoll.fd = readerBroker;
                aPoll.events = POLLIN;
                aPoll.revents = 0;

                if (poll(&aPoll, 1, -1) < 0)
                {
                    Log::error("Failed to poll pipe [" + pipe + "].");
                    continue;
                }
                else
                if (aPoll.revents & POLLIN)
                {
                    nBytes = Util::readFIFO(readerBroker, aBuffer, sizeof(aBuffer));
                    if (nBytes < 0)
                    {
                        pStart = pEnd = nullptr;
                        Log::error("Error reading message from pipe [" + pipe + "].");
                        continue;
                    }
                    pStart = aBuffer;
                    pEnd   = aBuffer + nBytes;
                }
                else
                if (aPoll.revents & (POLLERR | POLLHUP))
                {
                    Log::error("Broken pipe [" + pipe + "] with broker.");
                    break;
                }
            }

            if ( pStart != pEnd )
            {
                char aChar = *pStart++;
                while (pStart != pEnd && aChar != '\r' && aChar != '\n')
                {
                    aMessage += aChar;
                    aChar = *pStart++;
                }

                if ( aChar == '\r' && *pStart == '\n')
                {
                    pStart++;
                    StringTokenizer tokens(aMessage, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
                    aResponse = std::to_string(Process::id()) + " ";

                    if (tokens[0] == "search")
                    {
                        if (_documents.empty())
                        {
                            aResponse += "empty \r\n";
                        }
                        else
                        {
                            const auto& it = _documents.find(tokens[1]);
                            aResponse += (it != _documents.end() ? "ok \r\n" : "no \r\n");
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
                            it = _documents.emplace_hint(it, url, std::make_shared<Document>(loKit.get(), jailId, url));

                        it->second->createSession(sessionId, intSessionId);
                        aResponse += "ok \r\n";
                    }
                    else
                    {
                        aResponse = "bad \r\n";
                    }

                    Util::writeFIFO(writerBroker, aResponse.c_str(), aResponse.length() );
                    aMessage.clear();
                }
            }
        }

        Poco::ThreadPool::defaultPool().joinAll();

        close(writerBroker);
        close(readerBroker);
    }
    catch (const Exception& exc)
    {
        Log::error() << exc.name() << ": " << exc.displayText()
                     << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                     << Log::end;
        TerminationState = LOOLState::LOOL_ABNORMAL;
    }
    catch (const std::exception& exc)
    {
        Log::error(std::string("Exception: ") + exc.what());
        TerminationState = LOOLState::LOOL_ABNORMAL;
    }

    _documents.clear();

    // Destroy LibreOfficeKit
    loKit->pClass->destroy(loKit.get());
    loKit.release();

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

    std::string loSubPath;
    std::string jailId;
    std::string pipe;

    for (int i = 1; i < argc; ++i)
    {
        char *cmd = argv[i];
        char *eq  = nullptr;
        if (strstr(cmd, "--losubpath=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                loSubPath = std::string(++eq);
        }
        else if (strstr(cmd, "--jailid=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                jailId = std::string(++eq);
        }
        else if (strstr(cmd, "--pipe=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                pipe = std::string(++eq);
        }
        else if (strstr(cmd, "--clientport=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                ClientPortNumber = std::stoll(std::string(++eq));
        }
    }

    if (loSubPath.empty())
    {
        Log::error("Error: --losubpath is empty");
        exit(1);
    }

    if (jailId.empty())
    {
        Log::error("Error: --jailid is empty");
        exit(1);
    }

    if ( pipe.empty() )
    {
        Log::error("Error: --pipe is empty");
        exit(1);
    }

    try
    {
        Poco::Environment::get("LD_BIND_NOW");
    }
    catch (const Poco::NotFoundException& exc)
    {
        Log::warn("Note: LD_BIND_NOW is not set.");
    }

    try
    {
        Poco::Environment::get("LOK_VIEW_CALLBACK");
    }
    catch (const Poco::NotFoundException& exc)
    {
        Log::warn("Note: LOK_VIEW_CALLBACK is not set.");
    }

    lokit_main(loSubPath, jailId, pipe);

    return 0;
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
