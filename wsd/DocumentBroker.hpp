/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

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

#include "Log.hpp"
#include "TileDesc.hpp"
#include "Util.hpp"
#include "net/Socket.hpp"
#include "net/WebSocketHandler.hpp"
#include "Storage.hpp"

#include "common/SigUtil.hpp"
#include "common/Session.hpp"

#if !MOBILEAPP
#include "Admin.hpp"
#endif

// Forwards.
class PrisonerRequestDispatcher;
class DocumentBroker;
struct LockContext;
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

/// A ChildProcess object represents a KIT process that hosts a document and manipulates the
/// document using the LibreOfficeKit API. It isn't actually a child of the WSD process, but a
/// grandchild. The comments loosely talk about "child" anyway.

class ChildProcess : public WSProcess
{
public:
    /// @param pid is the process ID of the child.
    /// @param socket is the underlying Socket to the child.
    ChildProcess(const pid_t pid,
                 const std::string& jailId,
                 const std::shared_ptr<StreamSocket>& socket,
                 const Poco::Net::HTTPRequest &request) :
        WSProcess("ChildProcess", pid, socket, std::make_shared<WebSocketHandler>(socket, request)),
        _jailId(jailId),
        _smapsFD(-1)
    {
    }

    ChildProcess(ChildProcess&& other) = delete;

    virtual ~ChildProcess(){ ::close(_smapsFD); }

    const ChildProcess& operator=(ChildProcess&& other) = delete;

    void setDocumentBroker(const std::shared_ptr<DocumentBroker>& docBroker);
    std::shared_ptr<DocumentBroker> getDocumentBroker() const { return _docBroker.lock(); }
    const std::string& getJailId() const { return _jailId; }
    void setSMapsFD(int smapsFD) { _smapsFD = smapsFD;}
    int getSMapsFD(){ return _smapsFD; }

private:
    const std::string _jailId;
    std::weak_ptr<DocumentBroker> _docBroker;
    int _smapsFD;
};

class RequestDetails;
class ClientSession;

/// DocumentBroker is responsible for setting up a document in jail and brokering loading it from
/// Storage and saving it back.

/// Contains URI, physical path, etc.

/// There is one DocumentBroker object in the WSD process for each document that is open (in 1..n sessions).

/// The Document State:
///
/// The Document lifecycle is managed through
/// the DocumentState class, which encapsulates
/// the different stages of the Document's
/// main-sequence events:
///
/// To disambiguate between Storage and Core, we
/// use 'Download' for Reading from the Storage,
/// and 'Load' for Loading a document in Core.
/// Similarly, we 'Upload' to Storage after we
/// 'Save' the document in Core.
///
/// None: the Document doesn't exist, pending downloading.
/// Downloading: the Document is being downloaded from Storage.
/// Loading: the Document is being loaded into Core.
/// Live: Steady-state; the document is available (see below).
/// Destroying: End-of-life, marked to save/upload and destroy.
/// Destroyed: Unloading complete, destruction of class pending.
///

/// The Document Data State:
///
/// There are three locations to track:
/// 1) the Storage (wopi host)
/// 2) the Local file on disk (in jail)
/// 3) in memory (in Core).
///
/// We download the document from Storage to disk, then
/// we load it in memory (Core). From then on, we track the
/// state after modification (in memory), saving (to disk),
/// and uploading (to Storage).
///
/// Download: Storage -> Local
///     Load: Local -> Core
///     Save: Core -> Local
///   Upload: Local -> Storage
///
/// This is the state matrix during the key operations:
/// |-------------------------------------------|
/// | State       | Storage | Local   | Core    |
/// |-------------|---------|---------|---------|
/// | Downloading | Reading | Writing | Idle    |
/// | Loading     | Idle    | Reading | Writing |
/// | Saving      | Idle    | Writing | Reading |
/// | Uploading   | Writing | Reading | Idle    |
/// |-------------------------------------------|
///
/// Downloading is done synchronously, for now, but
/// is provisioned for async in the state machine.
/// Similarly, we could download asynchronously,
/// but there is little to gain by doing that,
/// since nothing much can happen without, or
/// before, loading a document.
///
/// The decision for Saving and Uploading are separate.
/// Without the user's intervention, we auto-save
/// when the user has been idle for some configurable
/// time, or when a certain configurable minimum time
/// has elapsed since the last save (regardless of user
/// activity). Once we get the save result from Core
/// (and ideally with success), we upload the document
/// immediately. Previously, this was a synchronous
/// process, which is now being reworked into an asynch.
///
/// The user can invoke both Save and Upload operations
/// however, and in more than one way.
/// Saving can of course be done by simply invoking the
/// command, which also uploads.
/// Forced Uploading has a narrower use-case: when the
/// Storage has a newer version of the document,
/// uploading fails with 'document conflict' error, which
/// the user can override by forcing uploading to Storage,
/// thereby overwriting the Storage version with the
/// current one.
/// Then there are the Save-As and Rename commands, which
/// only affect the document in Storage by invoking
/// the upload functionality with special headers.
///
/// When either of these operations fails, the next
/// opportunity to review potential actions is during
/// the next poll cycle.
/// To separate these two operations in code and in time,
/// we need to track the document version in each of
/// Core and Storage. That is, when the document is saved
/// a newer 'version number' is assigned, so that it would
/// be different from the 'version number' of the document
/// in Storage. The easiest way to achieve this is by
/// using the modified time on the file on disk. While
/// this has certain limitations, in practice it's a
/// good solution. We expect each time Core saves the
/// Document to disk, the file's timestamp will change.
/// Each time we Upload a version of the Document to
/// Storage, we track the local file's timestamp that we
/// uploaded. We then need to Upload only when the last
/// Uploaded timestamp is different from that on disk.
/// Although it's technically possible for the system
/// clock to change, it's unlikely for the timestamp to
/// be identical to the last Uploaded one, down to the
/// millisecond.
///
/// This way, if, say, Uploading fails after
/// Saving, if the subsequent Save fails, we don't skip
/// Uploading, since the Storage would still be outdated.
/// Similarly, if after Saving we fail to Upload, a
/// subsequent Save might yield 'unmodified' result and
/// fail to Save a new copy of the document. This should
/// not skip Uploading, since the document on disk is
/// still newer than the one in Storage.
///
/// Notice that we cannot compare the timestamp of the
/// file on disk to the timestamp returned from Storage.
/// For one, the Storage might not even provide a
/// timestamp (or a valid one). But more importantly,
/// the timestamp on disk might not be comparable to
/// that in Storage (due to timezone and/or precision
/// differences).
///
/// Two new managers are provisioned to mind about these
/// two domains: SaveManager and StorageManager.
/// SaveManager is reponsible for tracking the operations
/// between Core and local disk, while StorageManager
/// for those between Storage and local disk.
/// In practice, each represents and tracks the state of
/// the Document in Core and Storage, respectively.
///

class DocumentBroker : public std::enable_shared_from_this<DocumentBroker>
{
    class DocumentBrokerPoll;

    void setupPriorities();

public:
    /// How to prioritize this document.
    enum class ChildType {
        Interactive, Batch
    };

    static Poco::URI sanitizeURI(const std::string& uri);

    /// Returns a document-specific key based
    /// on the URI of the document.
    static std::string getDocKey(const Poco::URI& uri);

    /// Dummy document broker that is marked to destroy.
    DocumentBroker();

    DocumentBroker(ChildType type,
                   const std::string& uri,
                   const Poco::URI& uriPublic,
                   const std::string& docKey,
                   unsigned mobileAppDocId = 0);

    virtual ~DocumentBroker();

    /// Called when removed from the DocBrokers list
    virtual void dispose() {}

    /// setup the transfer of a socket into this DocumentBroker poll.
    void setupTransfer(SocketDisposition &disposition,
                       SocketDisposition::MoveFunction transferFn);

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
        const RequestDetails &requestDetails);

    /// Find or create a new client session for the PHP proxy
    void handleProxyRequest(
        const std::string& id,
        const Poco::URI& uriPublic,
        const bool isReadOnly,
        const RequestDetails &requestDetails,
        const std::shared_ptr<StreamSocket> &socket);

    /// Thread safe termination of this broker if it has a lingering thread
    void joinThread();

    /// Notify that the load has completed
    virtual void setLoaded();

    /// If not yet locked, try to lock
    bool attemptLock(const ClientSession& session, std::string& failReason);

    bool isDocumentChangedInStorage() { return _documentChangedInStorage; }

    bool isLastStorageUploadSuccessful() { return _lastStorageUploadSuccessful; }

    /// Handle the save response from Core and upload to storage as necessary.
    /// Also notifies clients of the result.
    void handleSaveResponse(const std::string& sessionId, bool success, const std::string& result);

    /// Upload the document to Storage if it needs persisting.
    /// Results are logged and broadcast to users.
    void uploadToStorage(const std::string& sesionId, bool success, const std::string& result,
                         bool force);

    /// UploadAs the document to Storage, with a new name.
    /// @param uploadAsPath Absolute path to the jailed file.
    void uploadAsToStorage(const std::string& sesionId, const std::string& uploadAsPath,
                           const std::string& uploadAsFilename, const bool isRename);

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
    std::size_t addSession(const std::shared_ptr<ClientSession>& session);

    /// Removes a session by ID. Returns the new number of sessions.
    std::size_t removeSession(const std::string& id);

    /// Add a callback to be invoked in our polling thread.
    void addCallback(const SocketPoll::CallbackFn& fn);

    /// Transfer this socket into our polling thread / loop.
    void addSocketToPoll(const std::shared_ptr<Socket>& socket);

    void alertAllUsers(const std::string& msg);

    void alertAllUsers(const std::string& cmd, const std::string& kind)
    {
        alertAllUsers("error: cmd=" + cmd + " kind=" + kind);
    }

    /// Sets the log level of kit.
    void setKitLogLevel(const std::string& level);

    /// Invalidate the cursor position.
    void invalidateCursor(int x, int y, int w, int h)
    {
        _cursorPosX = x;
        _cursorPosY = y;
        _cursorWidth = w;
        _cursorHeight = h;
    }

    void invalidateTiles(const std::string& tiles, int normalizedViewId)
    {
        // Remove from cache.
        _tileCache->invalidateTiles(tiles, normalizedViewId);
    }

    void handleTileRequest(const StringVector &tokens,
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

    bool isMarkedToDestroy() const { return _docState.isMarkedToDestroy() || _stop; }

    bool handleInput(const std::vector<char>& payload);

    /// Forward a message from client session to its respective child session.
    bool forwardToChild(const std::string& viewId, const std::string& message);

    int getRenderedTileCount() { return _debugRenderedTileCount; }

    /// Ask the document broker to close. Makes sure that the document is saved.
    void closeDocument(const std::string& reason);

    /// Get the PID of the associated child process
    pid_t getPid() const { return _childProcess ? _childProcess->getPid() : 0; }

    std::unique_lock<std::mutex> getLock() { return std::unique_lock<std::mutex>(_mutex); }

    void updateLastActivityTime();

    /// Sends the .uno:Save command to LoKit.
    bool sendUnoSave(const std::string& sessionId, bool dontTerminateEdit = true,
                     bool dontSaveIfUnmodified = true, bool isAutosave = false,
                     bool isExitSave = false, const std::string& extendedData = std::string());

    /// Sends a message to all sessions
    void broadcastMessage(const std::string& message) const;

    /// Returns true iff an initial setting by the given name is already initialized.
    bool isInitialSettingSet(const std::string& name) const;

    /// Sets the initialization flag of a given initial setting.
    void setInitialSetting(const std::string& name);

    /// For testing only [!]
    std::vector<std::shared_ptr<ClientSession>> getSessionsTestOnlyUnsafe();

    /// Estimate memory usage / bytes
    std::size_t getMemorySize() const;

    /// Get URL for corresponding download id if registered, or empty string otherwise
    std::string getDownloadURL(const std::string& downloadId);

    /// Remove download id mapping
    void unregisterDownloadId(const std::string& downloadId);

private:
    /// get the session id of a session that can write the document for save / locking.
    std::string getWriteableSessionId() const;

    void refreshLock();

    /// Loads a document from the public URI into the jail.
    bool download(const std::shared_ptr<ClientSession>& session, const std::string& jailId);
    bool isLoaded() const { return _docState.hadLoaded(); }

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

    /// Upload the doc to the storage.
    void uploadToStorageInternal(const std::string& sesionId, bool success,
                                 const std::string& result, const std::string& saveAsPath,
                                 const std::string& saveAsFilename, const bool isRename,
                                 const bool force);

    struct StorageUploadDetails
    {
        const std::string uriAnonym;
        const std::chrono::system_clock::time_point newFileModifiedTime;
        const std::weak_ptr<class ClientSession> session;
        const bool isSaveAs;
        const bool isRename;
    };

    void handleUploadToStorageResponse(const StorageUploadDetails& details,
                                       const StorageBase::UploadResult& uploadResult);

    /**
     * Report back the save result to PostMessage users (Action_Save_Resp)
     * @param success: Whether saving was successful
     * @param result: Short message why saving was (not) successful
     * @param errorMsg: Long error msg (Error message from WOPI host if any)
     */
    void broadcastSaveResult(bool success, const std::string& result = std::string(),
                             const std::string& errorMsg = std::string());

    /// Broadcasts to all sessions the last modification time of the document.
    void broadcastLastModificationTime(const std::shared_ptr<ClientSession>& session = nullptr) const;

    /// True if we know the doc is modified or
    /// if there has been activity from a client after we last *requested* saving,
    /// since there are race conditions vis-a-vis user activity while saving.
    bool isPossiblyModified() const
    {
        return isModified() || (_saveManager.lastSaveRequestTime() < _lastActivityTime);
    }

    /// True iff there is at least one non-readonly session other than the given.
    /// Since only editable sessions can save, we need to use the last to
    /// save modified documents, otherwise we'll potentially have to save on
    /// every editable session disconnect, lest we lose data due to racing.
    bool haveAnotherEditableSession(const std::string& id) const;

    /// Loads a new session and adds to the sessions container.
    std::size_t addSessionInternal(const std::shared_ptr<ClientSession>& session);

    /// Starts the Kit <-> DocumentBroker shutdown handshake
    void disconnectSessionInternal(const std::string& id);

    /// Forward a message from child session to its respective client session.
    bool forwardToClient(const std::shared_ptr<Message>& payload);

    /// The thread function that all of the I/O for all sessions
    /// associated with this document.
    void pollThread();

    /// Sum the I/O stats from all connected sessions
    void getIOStats(uint64_t &sent, uint64_t &recv);

    /// Returns true iff this is a Convert-To request.
    /// This is needed primarily for security reasons,
    /// because we can't trust the given file-path is
    /// a convert-to request or doctored to look like one.
    virtual bool isConvertTo() const { return false; }

private:
    /// Responsible for managing document saving.
    /// Tracks auto-saveing and its frequency.
    /// Tracks the last save request and response times.
    /// Tracks the local file's last modified time.
    class SaveManager final
    {
    public:
        SaveManager()
            : _lastAutosaveCheckTime(now())
            , _lastSaveRequestTime(now())
            , _lastSaveResponseTime(now())
            , _isAutosaveEnabled(std::getenv("LOOL_NO_AUTOSAVE") == nullptr)
        {
        }

        /// Return true iff auto save is enabled.
        bool isAutosaveEnabled() const { return _isAutosaveEnabled; }

        /// Returns true if we should issue an auto-save.
        bool needAutosaveCheck() const
        {
            return isAutosaveEnabled()
                   && std::chrono::duration_cast<std::chrono::seconds>(now()
                                                                       - _lastAutosaveCheckTime)
                          >= std::chrono::seconds(30);
        }

        /// Marks autosave check done.
        void autosaveChecked() { _lastAutosaveCheckTime = now(); }

        /// How much time passed since the last save request.
        const std::chrono::milliseconds timeSinceLastSaveRequest() const
        {
            return std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::steady_clock::now() - _lastSaveRequestTime);
        }

        /// Marks the last save request as now.
        void markLastSaveRequestTime() { _lastSaveRequestTime = now(); }

        /// Returns the last save request time.
        /// TODO: Remove: temporary for logging only.
        std::chrono::steady_clock::time_point lastSaveRequestTime() const
        {
            return _lastSaveRequestTime;
        }

        /// Marks the last save response as now.
        void markLastSaveResponseTime() { _lastSaveResponseTime = now(); }

        /// Returns the last save response time.
        /// TODO: Remove: temporary for logging only.
        std::chrono::steady_clock::time_point lastSaveResponseTime() const
        {
            return _lastSaveResponseTime;
        }

        /// True iff a save is in progress (requested but not completed).
        bool isSaving() const { return _lastSaveResponseTime < _lastSaveRequestTime; }

        /// True iff the last save request has timed out.
        bool hasSavingTimedOut() const
        {
            return isSaving()
                   && std::chrono::duration_cast<std::chrono::milliseconds>(now()
                                                                            - _lastSaveRequestTime)
                          >= std::chrono::milliseconds(COMMAND_TIMEOUT_MS);
        }

        std::chrono::system_clock::time_point getModifiedTime() const { return _modifiedTime; }

        void setModifiedTime(std::chrono::system_clock::time_point time) { _modifiedTime = time; }

    private:
        /// Helper to get the current time.
        static std::chrono::steady_clock::time_point now()
        {
            return std::chrono::steady_clock::now();
        }

    private:
        /// The time we last did an auto-save check, regarldess of outcome.
        std::chrono::steady_clock::time_point _lastAutosaveCheckTime;

        /// The last time we sent a save request to lokit.
        std::chrono::steady_clock::time_point _lastSaveRequestTime;

        /// The last time we received a response for a save request from lokit.
        std::chrono::steady_clock::time_point _lastSaveResponseTime;

        /// The jailed file last-modified time.
        std::chrono::system_clock::time_point _modifiedTime;

        /// Whether auto-saving is enabled at all or not.
        const bool _isAutosaveEnabled;
    };

    /// Responsible for managing document uploading into storage.
    class StorageManager final
    {
    public:
        StorageManager()
        {
        }

        /// Returns the modified time of the document in storage.
        std::chrono::system_clock::time_point getModifiedTime() const { return _modifiedTime; }

        /// Set the modified time of the document in storage.
        void setModifiedTime(std::chrono::system_clock::time_point time) { _modifiedTime = time; }

    private:
        /// The document's last-modified time on storage.
        std::chrono::system_clock::time_point _modifiedTime;
    };

protected:
    /// Seconds to live for, or 0 forever
    std::chrono::seconds _limitLifeSeconds;
    std::string _uriOrig;

private:
    /// What type are we: affects priority.
    ChildType _type;
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

    /// The state of the document.
    /// This regulates all other primary operations.
    class DocumentState
    {
    public:
        /// Strictly speaking, these are phases that are directional.
        /// A document starts as New and progresses towards Unloaded.
        /// Upon error, intermediary states may be skipped.
        enum class Status
        {
            None, //< Doesn't exist, pending downloading.
            Downloading, //< Download from Storage to disk. Synchronous.
            Loading, //< Loading the document in Core.
            Live, //< General availability for viewing/editing.
            Destroying, //< End-of-life, marked to destroy.
            Destroyed //< Unloading complete, destruction pending.
        };

        static std::string toString(Status status)
        {
#define CASE(X)                                                                                    \
    case X:                                                                                        \
        return #X;
            switch (status)
            {
                CASE(Status::None);
                CASE(Status::Downloading);
                CASE(Status::Loading);
                CASE(Status::Live);
                CASE(Status::Destroying);
                CASE(Status::Destroyed);
            }

#undef CASE
            return "Unknown Document Status";
        }

        DocumentState()
            : _status(Status::None)
            , _closeRequested(false)
            , _loaded(false)
        {
        }

        DocumentState::Status status() const { return _status; }
        void setStatus(Status newStatus)
        {
            LOG_TRC("Setting DocumentState from " << toString(_status) << " to "
                                                  << toString(newStatus));
            assert(newStatus >= _status && "The document status cannot regress");
            _status = newStatus;
        }

        /// True iff the document had ever loaded completely, without implying it's still loaded.
        bool hadLoaded() const { return _loaded; }

        /// True iff the document is fully loaded and available for viewing/editing.
        bool isLive() const { return _status == Status::Live; }

        /// Transitions to Status::Live, implying the document has loaded.
        void setLive()
        {
            LOG_TRC("Setting DocumentState to Status::Live from " << toString(_status));
            // assert(_status == Status::Loading
            //        && "Document wasn't in Loading state to transition to Status::Live");
            _loaded = true;
            setStatus(Status::Live);
        }

        /// Flags the document for unloading and destruction.
        void markToDestroy() { _status = Status::Destroying; }
        bool isMarkedToDestroy() const { return _status >= Status::Destroying; }

        /// Flag document termination. Cannot be reset.
        void setCloseRequested() { _closeRequested = true; }
        bool isCloseRequested() const { return _closeRequested; }

    private:
        Status _status;
        std::atomic<bool> _closeRequested; //< Owner-Termination flag.
        std::atomic<bool> _loaded; //< If the document ever loaded (check isLive to see if it still is).
    };

    /// The main state of the document.
    DocumentState _docState;

    /// Set to true when document changed in storage and we are waiting
    /// for user's command to act.
    bool _documentChangedInStorage;

    /// Indicates whether the last uploadToStorage operation was successful.
    bool _lastStorageUploadSuccessful;

    /// Manage saving in Core.
    SaveManager _saveManager;

    /// Manage uploading to Storage.
    StorageManager _storageManager;

    /// The last time we tried saving, regardless of whether the
    /// document was modified and saved or not.
    std::chrono::steady_clock::time_point _lastSaveTime;

    /// All session of this DocBroker by ID.
    SessionMap<ClientSession> _sessions;

    /// If we set the user-requested initial (on load) settings to be forced.
    std::set<std::string> _isInitialStateSet;

    std::unique_ptr<StorageBase> _storage;
    std::unique_ptr<TileCache> _tileCache;
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
    std::atomic<std::size_t> _tileVersion;

    int _debugRenderedTileCount;

    std::chrono::steady_clock::time_point _lastActivityTime;
    std::chrono::steady_clock::time_point _threadStart;
    std::chrono::milliseconds _loadDuration;
    std::chrono::milliseconds _wopiLoadDuration;

    /// Unique DocBroker ID for tracing and debugging.
    static std::atomic<unsigned> DocBrokerId;

    // Relevant only in the mobile apps
    const unsigned _mobileAppDocId;

    // Maps download id -> URL
    std::map<std::string, std::string> _registeredDownloadLinks;
};

#if !MOBILEAPP
class ConvertToBroker final : public DocumentBroker
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

    /// Move socket to this broker for response & do conversion
    bool startConversion(SocketDisposition &disposition, const std::string &id);

    /// Called when removed from the DocBrokers list
    void dispose() override;

    /// When the load completes - lets start saving
    void setLoaded() override;

    /// How many live conversions are running.
    static std::size_t getInstanceCount();

    /// Cleanup path and its parent
    static void removeFile(const std::string &uri);

private:
    bool isConvertTo() const override { return true; }
};
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
