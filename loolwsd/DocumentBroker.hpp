/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_DOCUMENTBROKER_HPP
#define INCLUDED_DOCUMENTBROKER_HPP

#include <csignal>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

#include <Poco/URI.h>
#include <Poco/Net/WebSocket.h>

#include "IoUtil.hpp"
#include "Log.hpp"
#include "Storage.hpp"
#include "TileCache.hpp"
#include "Util.hpp"

// Forwards.
class DocumentBroker;

/// Represents a new LOK child that is read
/// to host a document.
class ChildProcess
{
public:
    /// @param pid is the process ID of the child.
    /// @param ws is the control WebSocket to the child.
    ChildProcess(const Poco::Process::PID pid, const std::shared_ptr<Poco::Net::WebSocket>& ws) :
        _pid(pid),
        _ws(ws),
        _stop(false)
    {
        _thread = std::thread([this]() { this->socketProcessor(); });
        Log::info("ChildProcess ctor [" + std::to_string(_pid) + "].");
    }

    ChildProcess(ChildProcess&& other) = delete;

    const ChildProcess& operator=(ChildProcess&& other) = delete;

    ~ChildProcess()
    {
        if (_pid > 0)
        {
            Log::info("~ChildProcess dtor [" + std::to_string(_pid) + "].");
            close(false);
        }
    }

    void setDocumentBroker(const std::shared_ptr<DocumentBroker>& docBroker)
    {
        assert(docBroker && "Invalid DocumentBroker instance.");
        _docBroker = docBroker;
    }

    void close(const bool rude)
    {
        _stop = true;
        IoUtil::shutdownWebSocket(_ws);
        _thread.join();
        _ws.reset();
        if (_pid != -1)
        {
            Log::info("Closing child [" + std::to_string(_pid) + "].");
            if (rude && kill(_pid, SIGINT) != 0 && kill(_pid, 0) != 0)
            {
                Log::syserror("Cannot terminate lokit [" + std::to_string(_pid) + "]. Abandoning.");
            }

           _pid = -1;
        }
    }

    Poco::Process::PID getPid() const { return _pid; }
    std::shared_ptr<Poco::Net::WebSocket> getWebSocket() const { return _ws; }

    /// Check whether this child is alive and able to respond.
    bool isAlive() const
    {
        try
        {
            if (_pid > 1 && _ws && kill(_pid, 0) == 0)
            {
                // We don't care about the response (and shouldn't read here).
                _ws->sendFrame("PING", 4, Poco::Net::WebSocket::FRAME_OP_PING);
                return true;
            }
        }
        catch (const std::exception& exc)
        {
        }

        return false;
    }

private:
    void socketProcessor();

private:
    Poco::Process::PID _pid;
    std::shared_ptr<Poco::Net::WebSocket> _ws;
    std::weak_ptr<DocumentBroker> _docBroker;
    std::thread _thread;
    std::atomic<bool> _stop;
};

class PrisonerSession;
class ClientSession;

/// DocumentBroker is responsible for setting up a document
/// in jail and brokering loading it from Storage
/// and saving it back.
/// Contains URI, physical path, etc.
class DocumentBroker
{
public:

    static Poco::URI sanitizeURI(const std::string& uri);

    /// Returns a document-specific key based
    /// on the URI of the document.
    static
    std::string getDocKey(const Poco::URI& uri);

    /// Dummy document broker that is marked to destroy.
    DocumentBroker();

    DocumentBroker(const Poco::URI& uriPublic,
                   const std::string& docKey,
                   const std::string& childRoot,
                   std::shared_ptr<ChildProcess> childProcess);

    ~DocumentBroker()
    {
        Log::info() << "~DocumentBroker [" << _uriPublic.toString()
                    << "] destroyed with " << getSessionsCount()
                    << " sessions left." << Log::end;
    }

    const StorageBase::FileInfo validate(const Poco::URI& uri);

    /// Loads a document from the public URI into the jail.
    bool load(const std::string& jailId);
    bool isLoaded() const { return _isLoaded; }
    void setLoaded() { _isLoaded = true; }

    /// Save the document to Storage if needs persisting.
    bool save(bool success, const std::string& result = "");
    bool isModified() const { return _isModified; }
    void setModified(const bool value);

    /// Save the document if the document is modified.
    /// @param force when true, will force saving if there
    /// has been any recent activity after the last save.
    /// @param waitTimeoutMs when >0 will wait for the save to
    /// complete before returning, or timeout.
    /// @return true if attempts to save or it also waits
    /// and receives save notification. Otherwise, false.
    bool autoSave(const bool force, const size_t waitTimeoutMs);

    Poco::URI getPublicUri() const { return _uriPublic; }
    Poco::URI getJailedUri() const { return _uriJailed; }
    const std::string& getJailId() const { return _jailId; }
    const std::string& getDocKey() const { return _docKey; }
    const std::string& getFilename() const { return _filename; };
    TileCache& tileCache() { return *_tileCache; }
    bool isAlive() const { return _childProcess && _childProcess->isAlive(); }
    size_t getSessionsCount() const
    {
        std::lock_guard<std::mutex> lock(_mutex);
        return _sessions.size();
    }

    /// @eturn the time in milliseconds since last save.
    double getTimeSinceLastSaveMs() const
    {
        const auto duration = (std::chrono::steady_clock::now() - _lastSaveTime);
        return std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
    }

    std::string getJailRoot() const;

    /// Add a new session. Returns the new number of sessions.
    size_t addSession(std::shared_ptr<ClientSession>& session);
    /// Connect a prison session to its client peer.
    bool connectPeers(std::shared_ptr<PrisonerSession>& session);
    /// Removes a session by ID. Returns the new number of sessions.
    size_t removeSession(const std::string& id);

    void alertAllUsersOfDocument(const std::string& cmd, const std::string& kind);

    /// Invalidate the cursor position.
    void invalidateCursor(int x, int y, int w, int h)
    {
        _cursorPosX = x;
        _cursorPosY = y;
        _cursorWidth = w;
        _cursorHeight = h;
    }

    void invalidateTiles(const std::string& tiles);
    void handleTileRequest(TileDesc& tile,
                           const std::shared_ptr<ClientSession>& session);
    void handleTileCombinedRequest(TileCombined& tileCombined,
                                   const std::shared_ptr<ClientSession>& session);
    void cancelTileRequests(const std::shared_ptr<ClientSession>& session);
    void handleTileResponse(const std::vector<char>& payload);
    void handleTileCombinedResponse(const std::vector<char>& payload);

    /// Called before destroying any session.
    /// This method calculates and sets important states of
    /// session being destroyed. Returns true if session id
    /// is the last editable session.
    bool startDestroy(const std::string& id);
    bool isMarkedToDestroy() const { return _markToDestroy; }

    bool handleInput(const std::vector<char>& payload);

    /// Forward a message from client session to its respective child session.
    bool forwardToChild(const std::string& viewId, const char *buffer, int length);

private:

    /// Sends the .uno:Save command to LoKit.
    bool sendUnoSave(const bool dontSaveIfUnmodified);

    /// Saves the document to Storage (assuming LO Core saved to local copy).
    bool saveToStorage();

    /// Forward a message from child session to its respective client session.
    bool forwardToClient(const std::string& prefix, const std::vector<char>& payload);

private:
    const Poco::URI _uriPublic;
    const std::string _docKey;
    const std::string _childRoot;
    const std::string _cacheRoot;
    std::shared_ptr<ChildProcess> _childProcess;
    Poco::URI _uriJailed;
    std::string _jailId;
    std::string _filename;
    std::chrono::steady_clock::time_point _lastSaveTime;
    Poco::Timestamp _lastFileModifiedTime;
    std::map<std::string, std::shared_ptr<ClientSession>> _sessions;
    std::unique_ptr<StorageBase> _storage;
    std::unique_ptr<TileCache> _tileCache;
    std::atomic<bool> _markToDestroy;
    std::atomic<bool> _lastEditableSession;
    std::atomic<bool> _isLoaded;
    std::atomic<bool> _isModified;
    int _cursorPosX;
    int _cursorPosY;
    int _cursorWidth;
    int _cursorHeight;
    mutable std::mutex _mutex;
    std::condition_variable _saveCV;
    std::mutex _saveMutex;

    /// Versioning is used to prevent races between
    /// painting and invalidation.
    std::atomic<size_t> _tileVersion;

    static constexpr auto IdleSaveDurationMs = 30 * 1000;
    static constexpr auto AutoSaveDurationMs = 300 * 1000;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
