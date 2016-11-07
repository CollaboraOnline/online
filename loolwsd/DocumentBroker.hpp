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

#include <Poco/Net/WebSocket.h>
#include <Poco/URI.h>

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
        LOG_INF("ChildProcess ctor [" << _pid << "].");
    }

    ChildProcess(ChildProcess&& other) = delete;

    const ChildProcess& operator=(ChildProcess&& other) = delete;

    ~ChildProcess()
    {
        LOG_DBG("~ChildProcess dtor [" << _pid << "].");
        close(true);
    }

    void setDocumentBroker(const std::shared_ptr<DocumentBroker>& docBroker)
    {
        assert(docBroker && "Invalid DocumentBroker instance.");
        _docBroker = docBroker;
    }

    void stop()
    {
        LOG_DBG("Stopping ChildProcess [" << _pid << "]");
        _stop = true;

        try
        {
            if (_pid != -1 && _ws)
            {
                sendTextFrame("exit");
            }
        }
        catch (const std::exception&)
        {
            LOG_ERR("Failed to send 'exit' command to child [" << _pid << "].");
        }
    }

    void close(const bool rude)
    {
        try
        {
            LOG_DBG("Closing ChildProcess [" << _pid << "].");
            stop();
            IoUtil::shutdownWebSocket(_ws);
            if (_thread.joinable())
            {
                _thread.join();
            }

            _ws.reset();
            if (_pid != -1 && kill(_pid, 0) != 0)
            {
                if (rude)
                {
                    LOG_INF("Killing child [" << _pid << "].");
                    if (kill(_pid, SIGINT) != 0 && kill(_pid, 0) != 0)
                    {
                        Log::syserror("Cannot terminate lokit [" + std::to_string(_pid) + "]. Abandoning.");
                    }
                }
            }

            _pid = -1;
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Error while closing child process: " << ex.what());
        }
    }

    Poco::Process::PID getPid() const { return _pid; }

    /// Send a text payload to the child-process WS.
    bool sendTextFrame(const std::string& data)
    {
        try
        {
            if (_ws)
            {
                LOG_TRC("DocBroker to Child: " << data);
                _ws->sendFrame(data.data(), data.size());
                return true;
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Failed to send child [" << _pid << "] data [" <<
                    data << "] due to: " << exc.what());
            throw;
        }

        LOG_WRN("No socket between DocBroker and child to send [" << data << "]");
        return false;
    }

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
class DocumentBroker : public std::enable_shared_from_this<DocumentBroker>
{
public:
    static Poco::URI sanitizeURI(const std::string& uri);

    /// Returns a document-specific key based
    /// on the URI of the document.
    static std::string getDocKey(const Poco::URI& uri);

    /// Dummy document broker that is marked to destroy.
    DocumentBroker();

    DocumentBroker(const Poco::URI& uriPublic,
                   const std::string& docKey,
                   const std::string& childRoot,
                   const std::shared_ptr<ChildProcess>& childProcess);

    ~DocumentBroker();

    /// Loads a document from the public URI into the jail.
    bool load(std::shared_ptr<ClientSession>& session, const std::string& jailId);
    bool isLoaded() const { return _isLoaded; }
    void setLoaded() { _isLoaded = true; }

    /// Save the document to Storage if needs persisting.
    bool save(const std::string& sesionId, bool success, const std::string& result = "");
    bool isModified() const { return _isModified; }
    void setModified(const bool value);

    /// Save the document if the document is modified.
    /// @param force when true, will force saving if there
    /// has been any recent activity after the last save.
    /// @param waitTimeoutMs when >0 will wait for the save to
    /// complete before returning, or timeout.
    /// @return true if attempts to save or it also waits
    /// and receives save notification. Otherwise, false.
    bool autoSave(const bool force, const size_t waitTimeoutMs, std::unique_lock<std::mutex>& lock);

    Poco::URI getPublicUri() const { return _uriPublic; }
    Poco::URI getJailedUri() const { return _uriJailed; }
    const std::string& getJailId() const { return _jailId; }
    const std::string& getDocKey() const { return _docKey; }
    const std::string& getFilename() const { return _filename; };
    TileCache& tileCache() { return *_tileCache; }
    bool isAlive() const { return _childProcess && _childProcess->isAlive(); }
    size_t getSessionsCount() const
    {
        Util::assertIsLocked(_mutex);
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
    bool forwardToChild(const std::string& viewId, const std::string& message);

    int getRenderedTileCount() { return _debugRenderedTileCount; }

    /// Returns time taken in making calls to storage during load
    /// Currently, only makes sense in case storage is WOPI
    const std::chrono::duration<double> getStorageLoadDuration() const;

    /// Called by the ChildProcess object to notify
    /// that it has terminated on its own.
    /// This happens either when the child exists
    /// or upon failing to process an incoming message.
    void childSocketTerminated();

    /// This gracefully terminates the connection
    /// with the child and cleans up ChildProcess etc.
    /// We must be called under lock and it must be
    /// passed to us so we unlock before waiting on
    /// the ChildProcess thread, which can take our lock.
    void terminateChild(std::unique_lock<std::mutex>& lock);

    /// Get the PID of the associated child process
    Poco::Process::PID getPid() const { return _childProcess->getPid(); }

    std::unique_lock<std::mutex> getLock() { return std::unique_lock<std::mutex>(_mutex); }

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
    std::map<std::string, std::shared_ptr<ClientSession> > _sessions;
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

    int _debugRenderedTileCount;

    static constexpr auto IdleSaveDurationMs = 30 * 1000;
    static constexpr auto AutoSaveDurationMs = 300 * 1000;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
