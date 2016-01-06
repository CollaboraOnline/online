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

namespace
{
    void handleSignal(int aSignal)
    {
        Log::info() << "Signal received: " << strsignal(aSignal) << Log::end;
        TerminationFlag = true;
    }

    void setSignals(bool isIgnored)
    {
#ifdef __linux
        struct sigaction aSigAction;

        sigemptyset(&aSigAction.sa_mask);
        aSigAction.sa_flags = 0;
        aSigAction.sa_handler = (isIgnored ? SIG_IGN : handleSignal);

        sigaction(SIGTERM, &aSigAction, nullptr);
        sigaction(SIGINT, &aSigAction, nullptr);
        sigaction(SIGQUIT, &aSigAction, nullptr);
        sigaction(SIGHUP, &aSigAction, nullptr);
#endif
    }
}

// This thread handles callbacks from the
// lokit instance.
class CallBackWorker: public Runnable
{
public:
    CallBackWorker(NotificationQueue& queue):
        _queue(queue)
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
            return std::string("LLOK_CALLBACK_CELL_CURSOR");
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
        return std::string("");
    }

    void callback(const int nType, const std::string& rPayload, void* pData)
    {
        ChildProcessSession *srv = reinterpret_cast<ChildProcessSession *>(pData);
        Log::trace() << "Callback [" << srv->getViewId() << "] "
                     << callbackTypeToString(nType)
                     << " [" << rPayload << "]." << Log::end;

        switch ((LibreOfficeKitCallbackType) nType)
        {
        case LOK_CALLBACK_INVALIDATE_TILES:
            {
                int curPart = srv->_loKitDocument->pClass->getPart(srv->_loKitDocument);
                srv->sendTextFrame("curpart: part=" + std::to_string(curPart));
                if (srv->_docType == "text")
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

                    srv->sendTextFrame("invalidatetiles:"
                                       " part=" + std::to_string(curPart) +
                                       " x=" + std::to_string(x) +
                                       " y=" + std::to_string(y) +
                                       " width=" + std::to_string(width) +
                                       " height=" + std::to_string(height));
                }
                else
                {
                    srv->sendTextFrame("invalidatetiles: " + rPayload);
                }
            }
            break;
        case LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR:
            srv->sendTextFrame("invalidatecursor: " + rPayload);
            break;
        case LOK_CALLBACK_TEXT_SELECTION:
            srv->sendTextFrame("textselection: " + rPayload);
            break;
        case LOK_CALLBACK_TEXT_SELECTION_START:
            srv->sendTextFrame("textselectionstart: " + rPayload);
            break;
        case LOK_CALLBACK_TEXT_SELECTION_END:
            srv->sendTextFrame("textselectionend: " + rPayload);
            break;
        case LOK_CALLBACK_CURSOR_VISIBLE:
            srv->sendTextFrame("cursorvisible: " + rPayload);
            break;
        case LOK_CALLBACK_GRAPHIC_SELECTION:
            srv->sendTextFrame("graphicselection: " + rPayload);
            break;
        case LOK_CALLBACK_CELL_CURSOR:
            srv->sendTextFrame("cellcursor: " + rPayload);
            break;
        case LOK_CALLBACK_CELL_FORMULA:
            srv->sendTextFrame("cellformula: " + rPayload);
            break;
        case LOK_CALLBACK_MOUSE_POINTER:
            srv->sendTextFrame("mousepointer: " + rPayload);
            break;
        case LOK_CALLBACK_HYPERLINK_CLICKED:
            srv->sendTextFrame("hyperlinkclicked: " + rPayload);
            break;
        case LOK_CALLBACK_STATE_CHANGED:
            srv->sendTextFrame("statechanged: " + rPayload);
            break;
        case LOK_CALLBACK_STATUS_INDICATOR_START:
            srv->sendTextFrame("statusindicatorstart:");
            break;
        case LOK_CALLBACK_STATUS_INDICATOR_SET_VALUE:
            srv->sendTextFrame("statusindicatorsetvalue: " + rPayload);
            break;
        case LOK_CALLBACK_STATUS_INDICATOR_FINISH:
            srv->sendTextFrame("statusindicatorfinish:");
            break;
        case LOK_CALLBACK_SEARCH_NOT_FOUND:
            srv->sendTextFrame("searchnotfound: " + rPayload);
            break;
        case LOK_CALLBACK_SEARCH_RESULT_SELECTION:
            srv->sendTextFrame("searchresultselection: " + rPayload);
            break;
        case LOK_CALLBACK_DOCUMENT_SIZE_CHANGED:
            srv->getStatus("", 0);
            srv->getPartPageRectangles("", 0);
            break;
        case LOK_CALLBACK_SET_PART:
            srv->sendTextFrame("setpart: " + rPayload);
            break;
        case LOK_CALLBACK_UNO_COMMAND_RESULT:
            srv->sendTextFrame("unocommandresult: " + rPayload);
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

        while (!TerminationFlag)
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
                        FastMutex::ScopedLock lock(_mutex);
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

private:
    NotificationQueue& _queue;
    static FastMutex   _mutex;
};

FastMutex CallBackWorker::_mutex;

class Connection: public Runnable
{
public:
    Connection(LibreOfficeKit *loKit, LibreOfficeKitDocument *loKitDocument,
               const std::string& childId, const std::string& sessionId,
               std::function<void(LibreOfficeKitDocument*, int)> onLoad,
               std::function<void(int)> onUnload) :
        _loKit(loKit),
        _loKitDocument(loKitDocument),
        _childId(childId),
        _sessionId(sessionId),
        _stop(false),
        _onLoad(onLoad),
        _onUnload(onUnload)
    {
        Log::info("Connection ctor in child: " + childId + ", thread: " + _sessionId);
    }

    ~Connection()
    {
        Log::info("~Connection dtor in child: " + _childId + ", thread: " + _sessionId);
        stop();
    }

    const std::string& getSessionId() const { return _sessionId; }

    LibreOfficeKitDocument * getLOKitDocument()
    {
        return (_session ? _session->_loKitDocument : nullptr);
    }

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
        static const std::string thread_name = "kit_socket_" + _sessionId;
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
            HTTPRequest request(HTTPRequest::HTTP_GET, CHILD_URI);
            HTTPResponse response;
            auto ws = std::make_shared<WebSocket>(cs, request, response);

            _session.reset(new ChildProcessSession(_sessionId, ws, _loKit, _loKitDocument, _childId, _onLoad, _onUnload));
            ws->setReceiveTimeout(0);

            // child Jail TID PID
            std::string hello("child " + _childId + " " +
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
                n = ws->receiveFrame(buffer, sizeof(buffer), flags);

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

            _session->sendTextFrame("eof");
        }
        catch (const Exception& exc)
        {
            Log::error() << exc.displayText()
                         << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                         << Log::end;
        }
        catch (const std::exception& exc)
        {
            Log::error(std::string("Exception: ") + exc.what());
        }

        Log::debug("Thread [" + thread_name + "] finished.");
    }

private:
    LibreOfficeKit *_loKit;
    LibreOfficeKitDocument *_loKitDocument;
    const std::string _childId;
    const std::string _sessionId;
    Thread _thread;
    std::shared_ptr<ChildProcessSession> _session;
    volatile bool _stop;
    std::function<void(LibreOfficeKitDocument*, int)> _onLoad;
    std::function<void(int)> _onUnload;
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
    Document(LibreOfficeKit *loKit, const std::string& childId,
             const std::string& url)
      : _loKit(loKit),
        _childId(childId),
        _url(url),
        _loKitDocument(nullptr)
    {
        Log::info("Document ctor for url [" + url + "] on child [" + childId + "].");
    }

    ~Document()
    {
        // Destroy all connections and views.
        // wait until loolwsd close all websockets
        for (auto aIterator : _connections)
        {
            if (aIterator.second->isRunning())
                aIterator.second->join();
        }

        // Get the document to destroy later.
        auto loKitDocument = _connections.size() > 0
                            ? _connections.begin()->second->getLOKitDocument()
                            : nullptr;

        // Destroy all connections and views.
        _connections.clear();

        // TODO. check what is happening when destroying lokit document
        // Destroy the document.
        if (loKitDocument != nullptr)
        {
            loKitDocument->pClass->destroy(loKitDocument);
        }
    }

    void createSession(const std::string& sessionId)
    {
        const auto& aItem = _connections.find(sessionId);
        if (aItem != _connections.end())
        {
            // found item, check if still running
            Log::debug("Found thread for [" + sessionId + "] " +
                       (aItem->second->isRunning() ? "Running" : "Stopped"));

            if (!aItem->second->isRunning())
            {
                // Restore thread.
                Log::warn("Thread [" + sessionId + "] is not running. Restoring.");
                _connections.erase(sessionId);

                auto thread = std::make_shared<Connection>(_loKit, aItem->second->getLOKitDocument(), _childId, sessionId,
                                                           [this](LibreOfficeKitDocument *loKitDocument, const int viewId) { onLoad(loKitDocument, viewId); },
                                                           [this](const int viewId) { onUnload(viewId); });
                _connections.emplace(sessionId, thread);
                thread->start();
            }
        }
        else
        {
            // new thread id
            Log::debug("Starting new thread for request [" + sessionId + "]");
            std::shared_ptr<Connection> thread;
            if ( _connections.empty() )
            {
                Log::info("Creating main thread for child: " + _childId + ", thread: " + sessionId);
                thread = std::make_shared<Connection>(_loKit, nullptr, _childId, sessionId,
                                                      [this](LibreOfficeKitDocument *loKitDocument, const int viewId) { onLoad(loKitDocument, viewId); },
                                                      [this](const int viewId) { onUnload(viewId); });
            }
            else
            {
                Log::info("Creating view thread for child: " + _childId + ", thread: " + sessionId);
                auto aConnection = _connections.begin();
                thread = std::make_shared<Connection>(_loKit, aConnection->second->getLOKitDocument(), _childId, sessionId,
                                                      [this](LibreOfficeKitDocument *loKitDocument, const int viewId) { onLoad(loKitDocument, viewId); },
                                                      [this](const int viewId) { onUnload(viewId); });
            }

            auto aInserted = _connections.emplace(sessionId, thread);

            if ( aInserted.second )
                thread->start();
            else
                Log::error("Connection already exists for child: " + _childId + ", thread: " + sessionId);

            Log::debug("Connections: " + std::to_string(_connections.size()));
        }
    }

private:

    void onLoad(LibreOfficeKitDocument *loKitDocument, const int viewId)
    {
        Log::info("Document [" + _url + "] loaded as view #" + std::to_string(viewId) + ".");
        if (_loKitDocument != nullptr)
            assert(_loKitDocument == loKitDocument);
        _loKitDocument = loKitDocument;
    }

    void onUnload(const int viewId)
    {
        Log::info("Document [" + _url + "] view #" + std::to_string(viewId)+ " unloaded.");
    }

private:

    LibreOfficeKit *_loKit;
    const std::string _childId;
    const std::string _url;

    LibreOfficeKitDocument *_loKitDocument;

    std::map<std::string, std::shared_ptr<Connection>> _connections;
};

void lokit_main(const std::string &loSubPath, const std::string& childId, const std::string& pipe)
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

    std::map<std::string, std::shared_ptr<Document>> _documents;

    assert(!childId.empty());
    assert(!loSubPath.empty());

    static const std::string process_name = "loolkit";
#ifdef __linux
    if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(process_name.c_str()), 0, 0, 0) != 0)
        Log::error("Cannot set process name to " + process_name + ".");
    setSignals(false);
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

        CallBackWorker callbackWorker(ChildProcessSession::_callbackQueue);
        Poco::ThreadPool::defaultPool().start(callbackWorker);

        Log::info("Child [" + childId + "] is ready.");

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

                    if (tokens[0] == "search")
                    {
                        aResponse = std::to_string(Process::id()) + " ";
                        if (_documents.empty())
                        {
                            aResponse += "empty \r\n";
                        }
                        else
                        {
                            const auto& it = _documents.find(tokens[1]);
                            aResponse += (it != _documents.end() ? "ok \r\n" : "no \r\n");
                        }

                        Util::writeFIFO(writerBroker, aResponse.c_str(), aResponse.length());
                    }
                    else if (tokens[0] == "thread")
                    {
                        const std::string& sessionId = tokens[1];
                        const std::string& url = tokens[2];
                        Log::debug("Thread request for session [" + sessionId + "], url: [" + url + "].");

                        auto it = _documents.lower_bound(url);
                        if (it == _documents.end())
                            it = _documents.emplace_hint(it, url, std::make_shared<Document>(loKit.get(), childId, url));

                        it->second->createSession(sessionId);
                    }
                    else
                    {
                        aResponse = "bad message \r\n";
                        Util::writeFIFO(writerBroker, aResponse.c_str(), aResponse.length() );
                    }
                    aMessage.clear();
                }
            }
        }

        // wait callback worker finish
        callbackWorker.wakeUpAll();
        Poco::ThreadPool::defaultPool().joinAll();

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
    std::string childId;
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
        else if (strstr(cmd, "--child=") == cmd)
        {
            eq = strchrnul(cmd, '=');
            if (*eq)
                childId = std::string(++eq);
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

    if ( childId.empty() )
    {
        Log::error("Error: --child is 0");
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
        Log::error(std::string("Exception: ") + exc.what());
    }

    try
    {
        Poco::Environment::get("LOK_VIEW_CALLBACK");
    }
    catch (const Poco::NotFoundException& exc)
    {
        Log::error(std::string("Exception: ") + exc.what());
    }

    lokit_main(loSubPath, childId, pipe);

    return 0;
}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
