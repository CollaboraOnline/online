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
#include <deque>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

#include <Poco/URI.h>

#include "IoUtil.hpp"
#include "Log.hpp"
#include "TileDesc.hpp"
#include "Util.hpp"
#include "net/Socket.hpp"
#include "net/WebSocketHandler.hpp"

#include "common/SigUtil.hpp"
#include "common/Session.hpp"

#if !MOBILEAPP
#include "Admin.hpp"
#endif

// Forwards.
class PrisonerRequestDispatcher;
class DocumentBroker;
struct LockContext;
class StorageBase;
class TileCache;
class Message;

class TerminatingPoll : public SocketPoll
{
public:
    TerminatingPoll(const std::string &threadName) :
        SocketPoll(threadName) {}

    bool continuePolling() override
    {
        return SocketPoll::continuePolling() && !SigUtil::getTerminationFlag();
    }
};

#include "LOOLWSD.hpp"

/// Represents a new LOK child that is read
/// to host a document.
class ChildProcess : public WSProcess
{
public:
    /// @param pid is the process ID of the child.
    /// @param socket is the underlying Sockeet to the child.
    ChildProcess(const Poco::Process::PID pid,
                 const std::string& jailId,
                 const std::shared_ptr<StreamSocket>& socket,
                 const Poco::Net::HTTPRequest &request) :

        WSProcess("ChildProcess", pid, socket, std::make_shared<WebSocketHandler>(socket, request)),
        _jailId(jailId)
    {
    }


    ChildProcess(ChildProcess&& other) = delete;

    const ChildProcess& operator=(ChildProcess&& other) = delete;

    void setDocumentBroker(const std::shared_ptr<DocumentBroker>& docBroker);
    std::shared_ptr<DocumentBroker> getDocumentBroker() const { return _docBroker.lock(); }
    const std::string& getJailId() const { return _jailId; }

private:
    const std::string _jailId;
    std::weak_ptr<DocumentBroker> _docBroker;
};

class ClientSession;

/// DocumentBroker is responsible for setting up a document
/// in jail and brokering loading it from Storage
/// and saving it back.
/// Contains URI, physical path, etc.
class DocumentBroker : public std::enable_shared_from_this<DocumentBroker>
{
    class DocumentBrokerPoll;
public:
    static Poco::URI sanitizeURI(const std::string& uri);

    /// Returns a document-specific key based
    /// on the URI of the document.
    static std::string getDocKey(const Poco::URI& uri);

    /// Dummy document broker that is marked to destroy.
    DocumentBroker();

    /// Construct DocumentBroker with URI, docKey, and root path.
    DocumentBroker(const std::string& uri,
                   const Poco::URI& uriPublic,
                   const std::string& docKey);

    virtual ~DocumentBroker();

    /// Called when removed from the DocBrokers list
    virtual void dispose() {}

    /// Start processing events
    void startThread();

    /// Flag for termination. Note that this doesn't save any unsaved changes in the document
    void stop(const std::string& reason);

    /// Hard removes a session by ID, only for ClientSession.
    void finalRemoveSession(const std::string& id);

    /// Create new client session
    std::shared_ptr<ClientSession> createNewClientSession(
        const std::shared_ptr<ProtocolHandlerInterface> &ws,
        const std::string& id,
        const Poco::URI& uriPublic,
        const bool isReadOnly,
        const std::string& hostNoTrust);

    /// Thread safe termination of this broker if it has a lingering thread
    void joinThread();

    /// Notify that the load has completed
    virtual void setLoaded();

    bool isDocumentChangedInStorage() { return _documentChangedInStorage; }

    /// Save the document to Storage if it needs persisting.
    bool saveToStorage(const std::string& sesionId, bool success, const std::string& result = "", bool force = false);

    /// Save As the document to Storage.
    /// @param saveAsPath Absolute path to the jailed file.
    bool saveAsToStorage(const std::string& sesionId, const std::string& saveAsPath, const std::string& saveAsFilename, const bool isRename);

    bool isModified() const { return _isModified; }
    void setModified(const bool value);

    /// Save the document if the document is modified.
    /// @param force when true, will force saving if there
    /// has been any recent activity after the last save.
    /// @param dontSaveIfUnmodified when true, save will fail if the document is not modified.
    /// @return true if attempts to save or it also waits
    /// and receives save notification. Otherwise, false.
    bool autoSave(const bool force, const bool dontSaveIfUnmodified = true);

    Poco::URI getPublicUri() const { return _uriPublic; }
    const std::string& getJailId() const { return _jailId; }
    const std::string& getDocKey() const { return _docKey; }
    const std::string& getFilename() const { return _filename; };
    TileCache& tileCache() { return *_tileCache; }
    bool hasTileCache() { return _tileCache != nullptr; }
    bool isAlive() const;

    /// Are we running in either shutdown, or the polling thread.
    /// Asserts in the debug builds, otherwise just logs.
    void assertCorrectThread() const;

    /// Pretty print internal state to a stream.
    void dumpState(std::ostream& os);

    std::string getJailRoot() const;

    /// Add a new session. Returns the new number of sessions.
    size_t addSession(const std::shared_ptr<ClientSession>& session);

    /// Removes a session by ID. Returns the new number of sessions.
    size_t removeSession(const std::string& id);

    /// Add a callback to be invoked in our polling thread.
    void addCallback(const SocketPoll::CallbackFn& fn);

    /// Transfer this socket into our polling thread / loop.
    void addSocketToPoll(const std::shared_ptr<Socket>& socket);

    void alertAllUsers(const std::string& msg);

    void alertAllUsers(const std::string& cmd, const std::string& kind)
    {
        alertAllUsers("error: cmd=" + cmd + " kind=" + kind);
    }

    /// Invalidate the cursor position.
    void invalidateCursor(int x, int y, int w, int h)
    {
        _cursorPosX = x;
        _cursorPosY = y;
        _cursorWidth = w;
        _cursorHeight = h;
    }

    void invalidateTiles(const std::string& tiles, int normalizedViewId);
    void handleTileRequest(TileDesc& tile,
                           const std::shared_ptr<ClientSession>& session);
    void handleTileCombinedRequest(TileCombined& tileCombined,
                                   const std::shared_ptr<ClientSession>& session);
    void sendRequestedTiles(const std::shared_ptr<ClientSession>& session);
    void cancelTileRequests(const std::shared_ptr<ClientSession>& session);

    enum ClipboardRequest {
        CLIP_REQUEST_SET,
        CLIP_REQUEST_GET,
        CLIP_REQUEST_GET_RICH_HTML_ONLY
    };
    void handleClipboardRequest(ClipboardRequest type,  const std::shared_ptr<StreamSocket> &socket,
                                const std::string &viewId, const std::string &tag,
                                const std::shared_ptr<std::string> &data);
    static bool lookupSendClipboardTag(const std::shared_ptr<StreamSocket> &socket,
                                       const std::string &tag, bool sendError = false);

    bool isMarkedToDestroy() const { return _markToDestroy || _stop; }

    bool handleInput(const std::vector<char>& payload);

    /// Forward a message from client session to its respective child session.
    bool forwardToChild(const std::string& viewId, const std::string& message);

    int getRenderedTileCount() { return _debugRenderedTileCount; }

    /// Ask the document broker to close. Makes sure that the document is saved.
    void closeDocument(const std::string& reason);

    /// Get the PID of the associated child process
    Poco::Process::PID getPid() const { return _childProcess ? _childProcess->getPid() : 0; }

    std::unique_lock<std::mutex> getLock() { return std::unique_lock<std::mutex>(_mutex); }

    void updateLastActivityTime();

    /// Sends the .uno:Save command to LoKit.
    bool sendUnoSave(const std::string& sessionId, bool dontTerminateEdit = true,
                     bool dontSaveIfUnmodified = true, bool isAutosave = false,
                     bool isExitSave = false, const std::string& extendedData = std::string());

    /// Sends a message to all sessions
    void broadcastMessage(const std::string& message);

    /// Returns true iff an initial setting by the given name is already initialized.
    bool isInitialSettingSet(const std::string& name) const;

    /// Sets the initialization flag of a given initial setting.
    void setInitialSetting(const std::string& name);

    /// For testing only [!]
    std::vector<std::shared_ptr<ClientSession>> getSessionsTestOnlyUnsafe();

    /// Estimate memory usage / bytes
    size_t getMemorySize() const;

private:
    /// get the session id of a session that can write the document for save / locking.
    std::string getWriteableSessionId() const;

    void refreshLock();

    /// Loads a document from the public URI into the jail.
    bool load(const std::shared_ptr<ClientSession>& session, const std::string& jailId);
    bool isLoaded() const { return _isLoaded; }

    std::size_t getIdleTimeSecs() const
    {
        const auto duration = (std::chrono::steady_clock::now() - _lastActivityTime);
        return std::chrono::duration_cast<std::chrono::seconds>(duration).count();
    }

    std::unique_lock<std::mutex> getDeferredLock() { return std::unique_lock<std::mutex>(_mutex, std::defer_lock); }

    /// Called by the ChildProcess object to notify
    /// that it has terminated on its own.
    /// This happens either when the child exists
    /// or upon failing to process an incoming message.
    void childSocketTerminated();
    void handleTileResponse(const std::vector<char>& payload);
    void handleDialogPaintResponse(const std::vector<char>& payload, bool child);
    void handleTileCombinedResponse(const std::vector<char>& payload);
    void handleDialogRequest(const std::string& dialogCmd);

    /// Shutdown all client connections with the given reason.
    void shutdownClients(const std::string& closeReason);

    /// This gracefully terminates the connection
    /// with the child and cleans up ChildProcess etc.
    void terminateChild(const std::string& closeReason);

    /// Saves the doc to the storage.
    bool saveToStorageInternal(const std::string& sesionId, bool success,
                               const std::string& result = std::string(),
                               const std::string& saveAsPath = std::string(),
                               const std::string& saveAsFilename = std::string(),
                               const bool isRename = false, const bool force = false);

    /// True iff a save is in progress (requested but not completed).
    bool isSaving() const { return _lastSaveResponseTime < _lastSaveRequestTime; }

    /// True if we know the doc is modified or
    /// if there has been activity from a client after we last *requested* saving,
    /// since there are race conditions vis-a-vis user activity while saving.
    bool isPossiblyModified() const { return _isModified || (_lastSaveRequestTime < _lastActivityTime); }

    /// True iff there is at least one non-readonly session other than the given.
    /// Since only editable sessions can save, we need to use the last to
    /// save modified documents, otherwise we'll potentially have to save on
    /// every editable session disconnect, lest we lose data due to racing.
    bool haveAnotherEditableSession(const std::string& id) const;

    /// Loads a new session and adds to the sessions container.
    size_t addSessionInternal(const std::shared_ptr<ClientSession>& session);

    /// Starts the Kit <-> DocumentBroker shutdown handshake
    void disconnectSessionInternal(const std::string& id);

    /// Forward a message from child session to its respective client session.
    bool forwardToClient(const std::shared_ptr<Message>& payload);

    /// The thread function that all of the I/O for all sessions
    /// associated with this document.
    void pollThread();

    /// Sum the I/O stats from all connected sessions
    void getIOStats(uint64_t &sent, uint64_t &recv);

protected:
    /// Seconds to live for, or 0 forever
    int64_t _limitLifeSeconds;
    std::string _uriOrig;
private:
    const Poco::URI _uriPublic;
    /// URL-based key. May be repeated during the lifetime of WSD.
    const std::string _docKey;
    /// Short numerical ID. Unique during the lifetime of WSD.
    const std::string _docId;
    const std::string _childRoot;
    std::shared_ptr<ChildProcess> _childProcess;
    std::string _uriJailed;
    std::string _uriJailedAnonym;
    std::string _jailId;
    std::string _filename;

    /// Set to true when document changed in storage and we are waiting
    /// for user's command to act.
    bool _documentChangedInStorage;

    /// The last time we tried saving, regardless of whether the
    /// document was modified and saved or not.
    std::chrono::steady_clock::time_point _lastSaveTime;

    /// The last time we sent a save request to lokit.
    std::chrono::steady_clock::time_point _lastSaveRequestTime;

    /// The last time we received a response for a save request from lokit.
    std::chrono::steady_clock::time_point _lastSaveResponseTime;

    /// The document's last-modified time on storage.
    std::chrono::system_clock::time_point _documentLastModifiedTime;

    /// The jailed file last-modified time.
    std::chrono::system_clock::time_point _lastFileModifiedTime;

    /// All session of this DocBroker by ID.
    SessionMap<ClientSession> _sessions;

    /// If we set the user-requested inital (on load) settings to be forced.
    std::set<std::string> _isInitialStateSet;

    std::unique_ptr<StorageBase> _storage;
    std::unique_ptr<TileCache> _tileCache;
    std::atomic<bool> _markToDestroy;
    std::atomic<bool> _closeRequest;
    std::atomic<bool> _isLoaded;
    std::atomic<bool> _isModified;
    int _cursorPosX;
    int _cursorPosY;
    int _cursorWidth;
    int _cursorHeight;
    mutable std::mutex _mutex;
    std::unique_ptr<DocumentBrokerPoll> _poll;
    std::atomic<bool> _stop;
    std::string _closeReason;
    std::unique_ptr<LockContext> _lockCtx;

    /// Versioning is used to prevent races between
    /// painting and invalidation.
    std::atomic<size_t> _tileVersion;

    int _debugRenderedTileCount;

    std::chrono::steady_clock::time_point _lastActivityTime;
    std::chrono::steady_clock::time_point _threadStart;
    std::chrono::milliseconds _loadDuration;
    std::chrono::milliseconds _wopiLoadDuration;

    /// Unique DocBroker ID for tracing and debugging.
    static std::atomic<unsigned> DocBrokerId;
};

class ConvertToBroker : public DocumentBroker
{
    const std::string _format;
    const std::string _sOptions;
    std::shared_ptr<ClientSession> _clientSession;

public:
    /// Construct DocumentBroker with URI and docKey
    ConvertToBroker(const std::string& uri,
                    const Poco::URI& uriPublic,
                    const std::string& docKey,
                    const std::string& format,
                    const std::string& sOptions);
    virtual ~ConvertToBroker();

#if !MOBILEAPP
    /// Move socket to this broker for response & do conversion
    bool startConversion(SocketDisposition &disposition, const std::string &id);
#endif

    /// Called when removed from the DocBrokers list
    void dispose() override;

    /// When the load completes - lets start saving
    void setLoaded() override;

    /// How many live conversions are running.
    static size_t getInstanceCount();

    /// Cleanup path and its parent
    static void removeFile(const std::string &uri);
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
