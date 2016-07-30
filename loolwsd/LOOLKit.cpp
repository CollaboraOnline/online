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
#include <limits.h>
#include <malloc.h>
#include <stdlib.h>
#include <sys/capability.h>
#include <unistd.h>
#include <utime.h>

#include <atomic>
#include <cassert>
#include <condition_variable>
#include <cstdlib>
#include <iostream>
#include <memory>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitInit.h>

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
#include <Poco/URI.h>
#include <Poco/Util/Application.h>

#include "ChildSession.hpp"
#include "Common.hpp"
#include "IoUtil.hpp"
#include "LOKitHelper.hpp"
#include "LOOLProtocol.hpp"
#include "LibreOfficeKit.hpp"
#include "Log.hpp"
#include "Png.hpp"
#include "QueueHandler.hpp"
#include "Rectangle.hpp"
#include "TileDesc.hpp"
#include "Unit.hpp"
#include "UserMessages.hpp"
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
            return strcmp(path,"usr") != 0;
        case COPY_LO:
            return
                strcmp(path, "program/wizards") != 0 &&
                strcmp(path, "sdk") != 0 &&
                strcmp(path, "share/basic") != 0 &&
                strcmp(path, "share/gallery") != 0 &&
                strcmp(path, "share/Scripts") != 0 &&
                strcmp(path, "share/template") != 0 &&
                strcmp(path, "share/config/wizard") != 0 &&
                strcmp(path, "share/config/wizard") != 0;
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
        case FTW_SLN:
            File(newPath.parent()).createDirectories();
            if (link(fpath, newPath.toString().c_str()) == -1)
            {
                Log::syserror("link(\"" + std::string(fpath) + "\",\"" + newPath.toString() +
                           "\") failed. Exiting.");
                std::_Exit(Application::EXIT_SOFTWARE);
            }
            break;
        case FTW_D:
            {
                struct stat st;
                if (stat(fpath, &st) == -1)
                {
                    Log::syserror("stat(\"" + std::string(fpath) + "\") failed.");
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
                    Log::syserror("utime(\"" + newPath.toString() + "\") failed.");
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
            Log::syserror("cap_get_proc() failed.");
            std::_Exit(1);
        }

        char *capText = cap_to_text(caps, nullptr);
        Log::trace("Capabilities first: " + std::string(capText));
        cap_free(capText);

        if (cap_set_flag(caps, CAP_EFFECTIVE, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1 ||
            cap_set_flag(caps, CAP_PERMITTED, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1)
        {
            Log::syserror("cap_set_flag() failed.");
            std::_Exit(1);
        }

        if (cap_set_proc(caps) == -1)
        {
            Log::syserror("cap_set_proc() failed.");
            std::_Exit(1);
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
    Connection(std::shared_ptr<ChildSession> session,
               std::shared_ptr<WebSocket> ws) :
        _session(std::move(session)),
        _ws(std::move(ws)),
        _stop(false),
        _joined(false)
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
    std::shared_ptr<ChildSession> getSession() { return _session; }

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

    void run() override
    {
        Util::setThreadName("kit_ws_" + _session->getId());

        Log::debug("Thread started.");

        try
        {
            auto queue = std::make_shared<TileQueue>();
            QueueHandler handler(queue, _session, "kit_queue_" + _session->getId());

            Thread queueHandlerThread;
            queueHandlerThread.start(handler);
            std::shared_ptr<ChildSession> session = _session;

            IoUtil::SocketProcessor(_ws,
                [&queue](const std::vector<char>& payload)
                {
                    queue->put(payload);
                    return true;
                },
                [&session]() { session->closeFrame(); },
                [&queueHandlerThread]() { return TerminationFlag || !queueHandlerThread.isRunning(); });

            queue->clear();
            queue->put("eof");
            queueHandlerThread.join();

            if (session->isCloseFrame())
            {
                Log::trace("Normal close handshake.");
                _ws->shutdown();
            }
            else
            {
                Log::trace("Abnormal close handshake.");
               _ws->shutdown(WebSocket::WS_ENDPOINT_GOING_AWAY, SERVICE_UNAVALABLE_INTERNAL_ERROR);
            }
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

        Log::debug("Thread finished.");
    }

private:
    Thread _thread;
    std::shared_ptr<ChildSession> _session;
    std::shared_ptr<WebSocket> _ws;
    std::atomic<bool> _stop;
    std::mutex _threadMutex;
    std::atomic<bool> _joined;
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

    Document(const std::shared_ptr<lok::Office>& loKit,
             const std::string& jailId,
             const std::string& docKey,
             const std::string& url)
      : _multiView(std::getenv("LOK_VIEW_CALLBACK")),
        _loKit(loKit),
        _jailId(jailId),
        _docKey(docKey),
        _url(url),
        _docPassword(""),
        _haveDocPassword(false),
        _isDocPasswordProtected(false),
        _docPasswordType(PasswordType::ToView),
        _isLoading(0),
        _clientViews(0)
    {
        Log::info("Document ctor for url [" + _url + "] on child [" + _jailId +
                  "] LOK_VIEW_CALLBACK=" + std::to_string(_multiView) + ".");
        assert(_loKit && _loKit->get());
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
            HTTPClientSession cs("127.0.0.1", MasterPortNumber);
            cs.setTimeout(0);
            const auto childUrl = std::string(CHILD_URI) + "sessionId=" + sessionId + "&jailId=" + _jailId + "&docKey=" + _docKey;
            HTTPRequest request(HTTPRequest::HTTP_GET, childUrl);
            HTTPResponse response;

            auto ws = std::make_shared<WebSocket>(cs, request, response);
            ws->setReceiveTimeout(0);

            auto session = std::make_shared<ChildSession>(sessionId, ws, _jailId,
                           [this](const std::string& id, const std::string& uri, const std::string& docPassword,
                                  const std::string& renderOpts, bool haveDocPassword) { return onLoad(id, uri, docPassword, renderOpts, haveDocPassword); },
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
        std::vector<std::shared_ptr<ChildSession>> deadSessions;
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
                    << " passwordProvided=" << _haveDocPassword
                    << " password='" << _docPassword <<  "'" << Log::end;

        if (_isDocPasswordProtected && _haveDocPassword)
        {
            // it means this is the second attempt with the wrong password; abort the load operation
            _loKit->setDocumentPassword(_jailedUrl.c_str(), nullptr);
            return;
        }

        // One thing for sure, this is a password protected document
        _isDocPasswordProtected = true;
        if (nPasswordType == LOK_CALLBACK_DOCUMENT_PASSWORD)
            _docPasswordType = PasswordType::ToView;
        else if (nPasswordType == LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY)
            _docPasswordType = PasswordType::ToModify;

        Log::info("Calling _loKit->setDocumentPassword");
        if (_haveDocPassword)
            _loKit->setDocumentPassword(_jailedUrl.c_str(), _docPassword.c_str());
        else
            _loKit->setDocumentPassword(_jailedUrl.c_str(), nullptr);
        Log::info("setDocumentPassword returned");
    }

    void renderTile(StringTokenizer& tokens, const std::shared_ptr<Poco::Net::WebSocket>& ws)
    {
        auto tile = TileDesc::parse(tokens);

        // Send back the request with all optional parameters given in the request.
        const auto tileMsg = tile.serialize("tile:");
#if ENABLE_DEBUG
        const std::string response = tileMsg + " renderid=" + Util::UniqueId() + "\n";
#else
        const std::string response = tileMsg + "\n";
#endif

        std::vector<char> output;
        output.reserve(response.size() + (4 * tile.getWidth() * tile.getHeight()));
        output.resize(response.size());
        std::memcpy(output.data(), response.data(), response.size());

        std::vector<unsigned char> pixmap;
        pixmap.resize(output.capacity());

        std::unique_lock<std::recursive_mutex> lock(ChildSession::getLock());
        if (!_loKitDocument)
        {
            Log::error("Tile rendering requested before loading document.");
            return;
        }

        Timestamp timestamp;
        _loKitDocument->paintPartTile(pixmap.data(), tile.getPart(),
                                      tile.getWidth(), tile.getHeight(),
                                      tile.getTilePosX(), tile.getTilePosY(),
                                      tile.getTileWidth(), tile.getTileHeight());
        Log::trace() << "paintTile at (" << tile.getPart() << ',' << tile.getTilePosX() << ',' << tile.getTilePosY()
                     << ") rendered in " << (timestamp.elapsed()/1000.) << " ms" << Log::end;
        const auto mode = static_cast<LibreOfficeKitTileMode>(_loKitDocument->getTileMode());

        if (!png::encodeBufferToPNG(pixmap.data(), tile.getWidth(), tile.getHeight(), output, mode))
        {
            //FIXME: Return error.
            //sendTextFrame("error: cmd=tile kind=failure");
            Log::error("Failed to encode tile into PNG.");
            return;
        }

        const auto length = output.size();
        if (length > SMALL_MESSAGE_SIZE)
        {
            const std::string nextmessage = "nextmessage: size=" + std::to_string(length);
            ws->sendFrame(nextmessage.data(), nextmessage.size());
        }

        Log::trace("Sending render-tile response (" + std::to_string(length) + " bytes) for: " + response);
        ws->sendFrame(output.data(), length, WebSocket::FRAME_BINARY);
    }

    void renderCombinedTiles(StringTokenizer& tokens, const std::shared_ptr<Poco::Net::WebSocket>& ws)
    {
        auto tileCombined = TileCombined::parse(tokens);
        auto& tiles = tileCombined.getTiles();

        Util::Rectangle renderArea;
        std::vector<Util::Rectangle> tileRecs;
        tileRecs.reserve(tiles.size());

        for (auto& tile : tiles)
        {
            Util::Rectangle rectangle(tile.getTilePosX(), tile.getTilePosY(),
                                      tileCombined.getTileWidth(), tileCombined.getTileHeight());

            if (tileRecs.empty())
            {
                renderArea = rectangle;
            }
            else
            {
                renderArea.extend(rectangle);
            }

            tileRecs.push_back(rectangle);
        }

        const size_t tilesByX = renderArea.getWidth() / tileCombined.getTileWidth();
        const size_t tilesByY = renderArea.getHeight() / tileCombined.getTileHeight();
        const size_t pixmapWidth = tilesByX * tileCombined.getWidth();
        const size_t pixmapHeight = tilesByY * tileCombined.getHeight();
        const size_t pixmapSize = 4 * pixmapWidth * pixmapHeight;
        std::vector<unsigned char> pixmap(pixmapSize, 0);

        std::unique_lock<std::recursive_mutex> lock(ChildSession::getLock());
        if (!_loKitDocument)
        {
            Log::error("Tile rendering requested before loading document.");
            return;
        }

        Timestamp timestamp;
        _loKitDocument->paintPartTile(pixmap.data(), tileCombined.getPart(),
                                      pixmapWidth, pixmapHeight,
                                      renderArea.getLeft(), renderArea.getTop(),
                                      renderArea.getWidth(), renderArea.getHeight());
        Log::debug() << "paintTile (combined) called, tile at [" << renderArea.getLeft() << ", " << renderArea.getTop() << "]"
                     << " (" << renderArea.getWidth() << ", " << renderArea.getHeight() << ") rendered in "
                     << double(timestamp.elapsed())/1000 <<  " ms." << Log::end;
        const auto mode = static_cast<LibreOfficeKitTileMode>(_loKitDocument->getTileMode());

        std::vector<char> output;
        output.reserve(pixmapWidth * pixmapHeight * 4);

        size_t tileIndex = 0;
        for (Util::Rectangle& tileRect : tileRecs)
        {
            const int positionX = (tileRect.getLeft() - renderArea.getLeft()) / tileCombined.getTileWidth();
            const int positionY = (tileRect.getTop() - renderArea.getTop())  / tileCombined.getTileHeight();

            const auto oldSize = output.size();
            const auto pixelWidth = tileCombined.getWidth();
            const auto pixelHeight = tileCombined.getHeight();
            if (!png::encodeSubBufferToPNG(pixmap.data(), positionX * pixelWidth, positionY * pixelHeight,
                                           pixelWidth, pixelHeight, pixmapWidth, pixmapHeight, output, mode))
            {
                //FIXME: Return error.
                //sendTextFrame("error: cmd=tile kind=failure");
                Log::error("Failed to encode tile into PNG.");
                return;
            }

            const auto imgSize = output.size() - oldSize;
            Log::trace() << "Encoded tile #" << tileIndex << " in " << imgSize << " bytes." << Log::end;
            tiles[tileIndex++].setImgSize(imgSize);
        }

#if ENABLE_DEBUG
        const auto tileMsg = tileCombined.serialize("tilecombine:") + " renderid=" + Util::UniqueId() + "\n";
#else
        const auto tileMsg = tileCombined.serialize("tilecombine:") + "\n";
#endif
        Log::trace("Sending back painted tiles for " + tileMsg);

        std::vector<char> response;
        response.resize(tileMsg.size() + output.size());
        std::copy(tileMsg.begin(), tileMsg.end(), response.begin());
        std::copy(output.begin(), output.end(), response.begin() + tileMsg.size());

        const auto length = response.size();
        if (length > SMALL_MESSAGE_SIZE)
        {
            const std::string nextmessage = "nextmessage: size=" + std::to_string(length);
            ws->sendFrame(nextmessage.data(), nextmessage.size());
        }

        ws->sendFrame(response.data(), length, WebSocket::FRAME_BINARY);
    }

private:

    static void ViewCallback(int , const char* , void* )
    {
        //TODO: Delegate the callback.
    }

    static void DocumentCallback(const int nType, const char* pPayload, void* pData)
    {
        Log::trace() << "Document::DocumentCallback "
                     << LOKitHelper::kitCallbackTypeToString(nType)
                     << " [" << (pPayload ? pPayload : "") << "]." << Log::end;
        Document* self = reinterpret_cast<Document*>(pData);
        if (self == nullptr)
        {
            return;
        }

        std::unique_lock<std::mutex> lock(self->_mutex);

        if (nType == LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY ||
            nType == LOK_CALLBACK_DOCUMENT_PASSWORD)
        {
            // Mark the document password type.
            self->setDocumentPassword(nType);
            return;
        }

        // Broadcast to all clients.
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

    /// Load a document (or view) and register callbacks.
    std::shared_ptr<lok::Document> onLoad(const std::string& sessionId,
                                   const std::string& uri,
                                   const std::string& docPassword,
                                   const std::string& renderOpts,
                                   bool haveDocPassword)
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
            load(sessionId, uri, docPassword, renderOpts, haveDocPassword);
            if (!_loKitDocument || !_loKitDocument->get())
            {
                return nullptr;
            }
        }
        catch (const std::exception& exc)
        {
            Log::error("Exception while loading [" + uri + "] : " + exc.what());
            return nullptr;
        }

        // Done loading, let the next one in (if any).
        assert(_loKitDocument && _loKitDocument->get() && "Uninitialized lok::Document instance");
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

            const auto viewId = _loKitDocument->getView();
            _loKitDocument->registerCallback(nullptr, nullptr);
            _loKitDocument->destroyView(viewId);
        }
    }

private:

    std::shared_ptr<lok::Document> load(const std::string& sessionId,
                                        const std::string& uri,
                                        const std::string& docPassword,
                                        const std::string& renderOpts,
                                        bool haveDocPassword)
    {
        const unsigned intSessionId = Util::decodeId(sessionId);
        const auto it = _connections.find(intSessionId);
        if (it == _connections.end() || !it->second)
        {
            Log::error("Cannot find session [" + sessionId + "].");
            return nullptr;
        }

        auto session = it->second->getSession();

        if (!_loKitDocument)
        {
            // This is the first time we are loading the document
            Log::info("Loading new document from URI: [" + uri + "] for session [" + sessionId + "].");


            auto lock(_loKit->getLock());
            if (LIBREOFFICEKIT_HAS(_loKit->get(), registerCallback))
            {
                _loKit->get()->pClass->registerCallback(_loKit->get(), DocumentCallback, this);
                const auto flags = LOK_FEATURE_DOCUMENT_PASSWORD
                                 | LOK_FEATURE_DOCUMENT_PASSWORD_TO_MODIFY;
                _loKit->setOptionalFeatures(flags);
            }

            // Save the provided password with us and the jailed url
            _haveDocPassword = haveDocPassword;
            _docPassword = docPassword;
            _jailedUrl = uri;
            _isDocPasswordProtected = false;

            Log::debug("Calling lokit::documentLoad.");
            _loKitDocument = _loKit->documentLoad(uri.c_str());
            Log::debug("Returned lokit::documentLoad.");

            if (!_loKitDocument || !_loKitDocument->get())
            {
                Log::error("Failed to load: " + uri + ", error: " + _loKit->getError());

                // Checking if wrong password or no password was reason for failure.
                if (_isDocPasswordProtected)
                {
                    Log::info("Document [" + uri + "] is password protected.");
                    if (!_haveDocPassword)
                    {
                        Log::info("No password provided for password-protected document [" + uri + "].");
                        std::string passwordFrame = "passwordrequired:";
                        if (_docPasswordType == PasswordType::ToView)
                            passwordFrame += "to-view";
                        else if (_docPasswordType == PasswordType::ToModify)
                            passwordFrame += "to-modify";
                        session->sendTextFrame("error: cmd=load kind=" + passwordFrame);
                    }
                    else
                    {
                        Log::info("Wrong password for password-protected document [" + uri + "].");
                        session->sendTextFrame("error: cmd=load kind=wrongpassword");
                    }
                }

                return nullptr;
            }

            // Only save the options on opening the document.
            // No support for changing them after opening a document.
            _renderOpts = renderOpts;
        }
        else
        {
            // Check if this document requires password
            if (_isDocPasswordProtected)
            {
                if (!haveDocPassword)
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

        if (_multiView)
        {
            Log::info("Loading view to document from URI: [" + uri + "] for session [" + sessionId + "].");
            const auto viewId = _loKitDocument->createView();

            Log::info() << "Document [" << _url << "] view ["
                        << viewId << "] loaded, leaving "
                        << (_clientViews + 1) << " views." << Log::end;
        }

        // initializeForRendering() should be called before
        // registerCallback(), as the previous creates a new view in Impress.
        _loKitDocument->initializeForRendering(_renderOpts.c_str());

        _loKitDocument->registerCallback(DocumentCallback, this);

        return _loKitDocument;
    }

private:

    const bool _multiView;
    std::shared_ptr<lok::Office> _loKit;
    const std::string _jailId;
    const std::string _docKey;
    const std::string _url;
    std::string _jailedUrl;
    std::string _renderOpts;

    std::shared_ptr<lok::Document> _loKitDocument;

    // Document password provided
    std::string _docPassword;
    // Whether password was provided or not
    bool _haveDocPassword;
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

namespace {
    void symlinkPathToJail(const Path& jailPath, const std::string &loTemplate,
                           const std::string &loSubPath)
    {
        Path symlinkSource(jailPath, Path(loTemplate.substr(1)));
        File(symlinkSource.parent()).createDirectories();

        std::string symlinkTarget;
        for (auto i = 0; i < Path(loTemplate).depth(); i++)
            symlinkTarget += "../";
        symlinkTarget += loSubPath;

        Log::debug("symlink(\"" + symlinkTarget + "\",\"" + symlinkSource.toString() + "\")");
        if (symlink(symlinkTarget.c_str(), symlinkSource.toString().c_str()) == -1)
        {
            Log::syserror("symlink(\"" + symlinkTarget + "\",\"" + symlinkSource.toString() + "\") failed");
            throw Exception("symlink() failed");
        }
    }
}

void lokit_main(const std::string& childRoot,
                const std::string& sysTemplate,
                const std::string& loTemplate,
                const std::string& loSubPath,
                bool noCapabilities,
                bool queryVersion)
{
    // Reinitialize logging when forked.
    Log::initialize("kit", getenv("LOOL_LOGLEVEL"), getenv("LOOL_LOGCOLOR"));
    Util::rng::reseed();

    assert(!childRoot.empty());
    assert(!sysTemplate.empty());
    assert(!loTemplate.empty());
    assert(!loSubPath.empty());

    // We only host a single document in our lifetime.
    std::shared_ptr<Document> document;

    // Ideally this will be a random ID, but forkit will cleanup
    // our jail directory when we die, and it's simpler to know
    // the jailId (i.e. the path) implicitly by knowing our pid.
    static const std::string pid = std::to_string(Process::id());
    static const std::string jailId = pid;

    Util::setThreadName("loolkit");

    Log::debug("Process started.");

    Util::setTerminationSignals();
    Util::setFatalSignals();

    std::string userdir_url;
    std::string instdir_path;

    Path jailPath;
    bool bRunInsideJail = !noCapabilities;
    try
    {
        jailPath = Path::forDirectory(childRoot + "/" + jailId);
        Log::info("Jail path: " + jailPath.toString());
        File(jailPath).createDirectories();

        if (bRunInsideJail)
        {
            userdir_url = "file:///user";
            instdir_path = "/" + loSubPath + "/program";

            // Create a symlink inside the jailPath so that the absolute pathname loTemplate, when
            // interpreted inside a chroot at jailPath, points to loSubPath (relative to the chroot).
            symlinkPathToJail(jailPath, loTemplate, loSubPath);

            // Font paths can end up as realpaths so match that too.
            char *resolved = realpath(loTemplate.c_str(), NULL);
            if (resolved)
            {
                if (strcmp(loTemplate.c_str(), resolved) != 0)
                    symlinkPathToJail(jailPath, std::string(resolved), loSubPath);
                free (resolved);
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

            // We need this because sometimes the hostname is not resolved
            const auto networkFiles = {"/etc/host.conf", "/etc/hosts", "/etc/nsswitch.conf", "/etc/resolv.conf"};
            for (const auto& filename : networkFiles)
            {
                const auto etcPath = Path(jailPath, filename).toString();
                const File networkFile(filename);
                if (networkFile.exists() && !File(etcPath).exists())
                {
                    networkFile.copyTo(etcPath);
                }
            }

            Log::debug("Initialized jail files.");

            // Create the urandom and random devices
            File(Path(jailPath, "/dev")).createDirectory();
            if (mknod((jailPath.toString() + "/dev/random").c_str(),
                      S_IFCHR | S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH,
                      makedev(1, 8)) != 0)
            {
                Log::syserror("mknod(" + jailPath.toString() + "/dev/random) failed.");
            }
            if (mknod((jailPath.toString() + "/dev/urandom").c_str(),
                      S_IFCHR | S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH,
                      makedev(1, 9)) != 0)
            {
                Log::syserror("mknod(" + jailPath.toString() + "/dev/urandom) failed.");
            }

            Log::info("chroot(\"" + jailPath.toString() + "\")");
            if (chroot(jailPath.toString().c_str()) == -1)
            {
                Log::syserror("chroot(\"" + jailPath.toString() + "\") failed.");
                std::_Exit(Application::EXIT_SOFTWARE);
            }

            if (chdir("/") == -1)
            {
                Log::syserror("chdir(\"/\") in jail failed.");
                std::_Exit(Application::EXIT_SOFTWARE);
            }

            dropCapability(CAP_SYS_CHROOT);
            dropCapability(CAP_MKNOD);
            dropCapability(CAP_FOWNER);

            Log::debug("Initialized jail nodes, dropped caps.");
        }
        else // noCapabilities set
        {
            Log::info("Using template " + loTemplate + " as install subpath - skipping jail setup");
            userdir_url = "file:///" + jailPath.toString() + "/user";
            instdir_path = "/" + loTemplate + "/program";
        }

        std::shared_ptr<lok::Office> loKit;
        {
            const char *instdir = instdir_path.c_str();
            const char *userdir = userdir_url.c_str();
            auto kit = UnitKit::get().lok_init(instdir, userdir);
            if (!kit)
            {
                kit = lok_init_2(instdir, userdir);
            }

            loKit = std::make_shared<lok::Office>(kit);
            if (!loKit || !loKit->get())
            {
                Log::error("LibreOfficeKit initialization failed. Exiting.");
                std::_Exit(Application::EXIT_SOFTWARE);
            }
        }

        assert(loKit && loKit->get());
        Log::info("Process is ready.");

        // Open websocket connection between the child process and WSD.
        HTTPClientSession cs("127.0.0.1", MasterPortNumber);
        cs.setTimeout(0);

        std::string requestUrl = std::string(NEW_CHILD_URI) + "pid=" + pid;
        if (queryVersion)
        {
            char* versionInfo = loKit->getVersionInfo();
            std::string encodedVersionStr;
            URI::encode(std::string(versionInfo), "", encodedVersionStr);
            requestUrl += "&version=" + encodedVersionStr;
            free(versionInfo);
        }
        HTTPRequest request(HTTPRequest::HTTP_GET, requestUrl);
        HTTPResponse response;
        auto ws = std::make_shared<WebSocket>(cs, request, response);
        ws->setReceiveTimeout(0);

        const std::string socketName = "ChildControllerWS";
        IoUtil::SocketProcessor(ws,
                [&socketName, &ws, &document, &loKit](const std::vector<char>& data)
                {
                    std::string message(data.data(), data.size());

                    if (UnitKit::get().filterKitMessage(ws, message))
                        return true;

                    Log::debug(socketName + ": recv [" + LOOLProtocol::getAbbreviatedMessage(message) + "].");
                    StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

                    // Note: Syntax or parsing errors here are unexpected and fatal.
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
                            Log::debug("CreateSession failed.");
                        }
                    }
                    else if (tokens[0] == "tile")
                    {
                        if (document)
                        {
                            document->renderTile(tokens, ws);
                        }
                        else
                        {
                            Log::warn("No document while processing tile request.");
                        }
                    }
                    else if (tokens[0] == "tilecombine")
                    {
                        if (document)
                        {
                            document->renderCombinedTiles(tokens, ws);
                        }
                        else
                        {
                            Log::warn("No document while processing tilecombine request.");
                        }
                    }
                    else if (document && document->canDiscard())
                    {
                        TerminationFlag = true;
                    }
                    else
                    {
                        Log::info("Bad or unknown token [" + tokens[0] + "]");
                    }

                    return true;
                },
                []() {},
                [&document]()
                {
                    if (document && document->canDiscard())
                        TerminationFlag = true;
                    return TerminationFlag.load();
                });

        // Clean up jail if we created one
        if (bRunInsideJail && !jailPath.isRelative())
        {
            // In theory we should here do Util::removeFile("/", true), because we are inside the
            // chroot jail, and all of it can be removed now when we are exiting. (At least the root
            // of the chroot jail probably would not be removed even if we tried, so we still would
            // need to complete the cleanup in loolforkit.)

            // But: It is way too risky to actually do that (effectively, "rm -rf /") as it would
            // trash a developer's machine if something goes wrong while hacking and debugging and
            // the process isn't in a chroot after all when it comes here.

            // So just remove what we can reasonably safely assume won't exist as global pathnames
            // on a developer's machine, loSubpath (typically "/lo") and JAILED_DOCUMENT_ROOT
            // ("/user/docs/").

            Log::info("Removing '/" + loSubPath + "'");
            Util::removeFile("/" + loSubPath, true);
            Log::info("Removing '" + std::string(JAILED_DOCUMENT_ROOT) + "'");
            Util::removeFile(std::string(JAILED_DOCUMENT_ROOT), true);
        }
    }
    catch (const Exception& exc)
    {
        Log::error() << "Poco Exception: " << exc.displayText()
                     << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                     << Log::end;
    }
    catch (const std::exception& exc)
    {
        Log::error(std::string("Exception: ") + exc.what());
    }

    // Sleep a second here in case we get a fatal signal just when about to finish up, which sadly
    // seems to happen often, so that handleFatalSignal() in Util.cpp has time to produce a
    // backtrace.
    sleep(1);
    Log::info("Process finished.");
    std::_Exit(Application::EXIT_OK);
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
