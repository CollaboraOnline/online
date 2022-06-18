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
#include <utility>

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

/// A ChildProcess object represents a Kit process that hosts a document and manipulates the
/// document using the LibreOfficeKit API. It isn't actually a child of the WSD process, but a
/// grandchild. The comments loosely talk about "child" anyway.

class ChildProcess : public WSProcess
{
public:
    /// @param pid is the process ID of the child.
    /// @param socket is the underlying Sockeet to the child.
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

    /// Notify that the document has dialogs before load
    virtual void setInteractive(bool value);

    /// If not yet locked, try to lock
    bool attemptLock(const ClientSession& session, std::string& failReason);

    bool isDocumentChangedInStorage() { return _documentChangedInStorage; }

    /// Invoked by the client to rename the document filename.
    /// Returns an error message in case of failure, otherwise an empty string.
    std::string handleRenameFileCommand(std::string sessionId, std::string newFilename);

    /// Handle the save response from Core and upload to storage as necessary.
    /// Also notifies clients of the result.
    void handleSaveResponse(const std::string& sessionId, bool success, const std::string& result);

    /// Check if uploading is needed, and start uploading.
    /// The current state of uploading must be introspected separately.
    void checkAndUploadToStorage(const std::string& sessionId);

    /// Upload the document to Storage if it needs persisting.
    /// Results are logged and broadcast to users.
    void uploadToStorage(const std::string& sesionId, bool force);

    /// UploadAs the document to Storage, with a new name.
    /// @param uploadAsPath Absolute path to the jailed file.
    void uploadAsToStorage(const std::string& sessionId, const std::string& uploadAsPath,
                           const std::string& uploadAsFilename, const bool isRename);

    /// Uploads the document right after loading from a template.
    /// Template-loading requires special handling because the
    /// document changes once loaded into a non-template format.
    void uploadAfterLoadingTemplate(const std::string& sessionId);

    bool isModified() const { return _isModified; }
    void setModified(const bool value);

    /// Save the document if the document is modified.
    /// @param force when true, will force saving if there
    /// has been any recent activity after the last save.
    /// @param dontSaveIfUnmodified when true, save will fail if the document is not modified.
    /// @return true if attempts to save or it also waits
    /// and receives save notification. Otherwise, false.
    bool autoSave(const bool force, const bool dontSaveIfUnmodified = true);

    /// Saves the document and stops if there was nothing to autosave.
    void autoSaveAndStop(const std::string& reason);

    bool isAsyncUploading() const;

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

    void handleTileRequest(const StringVector &tokens, bool forceKeyframe,
                           const std::shared_ptr<ClientSession>& session);
    void handleTileCombinedRequest(TileCombined& tileCombined, bool forceKeyframe,
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

    /// True if any flag to unload or terminate is set.
    bool isUnloading() const
    {
        return _docState.isMarkedToDestroy() || _stop || _docState.isUnloadRequested() ||
               _docState.isCloseRequested() || SigUtil::getShutdownRequestFlag() ||
               SigUtil::getTerminationFlag();
    }

    bool isMarkedToDestroy() const { return _docState.isMarkedToDestroy() || _stop; }

    virtual bool handleInput(const std::vector<char>& payload);

    /// Forward a message from client session to its respective child session.
    bool forwardToChild(const std::string& viewId, const std::string& message);

    int getRenderedTileCount() { return _debugRenderedTileCount; }

    /// Ask the document broker to close. Makes sure that the document is saved.
    void closeDocument(const std::string& reason);

    /// Flag that we have been disconnected from the Kit and request unloading.
    void disconnectedFromKit();

    /// Get the PID of the associated child process
    pid_t getPid() const { return _childProcess ? _childProcess->getPid() : 0; }

    std::unique_lock<std::mutex> getLock() { return std::unique_lock<std::mutex>(_mutex); }

    void updateLastActivityTime();

    /// This updates the editing sessionId which is used for auto-saving.
    void updateEditingSessionId(const std::string& viewId)
    {
        if (_lastEditingSessionId != viewId)
            _lastEditingSessionId = viewId;
    }

    /// Sends the .uno:Save command to LoKit.
    bool sendUnoSave(const std::string& sessionId, bool dontTerminateEdit = true,
                     bool dontSaveIfUnmodified = true, bool isAutosave = false,
                     bool isExitSave = false, const std::string& extendedData = std::string());

    /// Sends a message to all sessions.
    /// Returns the number of sessions sent the message to.
    std::size_t broadcastMessage(const std::string& message) const;

    /// Sends a message to all sessions except for the session passed as the param
    void broadcastMessageToOthers(const std::string& message, const std::shared_ptr<ClientSession>& _session) const;

    /// Broadcasts 'blockui' command to all users with an optional message.
    void blockUI(const std::string& msg)
    {
        broadcastMessage("blockui: " + msg);
    }

    /// Broadcasts 'unblockui' command to all users.
    void unblockUI()
    {
        broadcastMessage("unblockui: ");
    }

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
    /// Note that if there is no loaded and writable session, the first will be returned.
    std::string getWriteableSessionId() const;

    void refreshLock();

    /// Loads a document from the public URI into the jail.
    bool download(const std::shared_ptr<ClientSession>& session, const std::string& jailId);
    bool isLoaded() const { return _docState.hadLoaded(); }
    bool isInteractive() const { return _docState.isInteractive(); }

    std::size_t getIdleTimeSecs() const
    {
        const auto duration = (std::chrono::steady_clock::now() - _lastActivityTime);
        return std::chrono::duration_cast<std::chrono::seconds>(duration).count();
    }

    std::unique_lock<std::mutex> getDeferredLock() { return std::unique_lock<std::mutex>(_mutex, std::defer_lock); }

    void handleTileResponse(const std::vector<char>& payload);
    void handleDialogPaintResponse(const std::vector<char>& payload, bool child);
    void handleTileCombinedResponse(const std::vector<char>& payload);
    void handleDialogRequest(const std::string& dialogCmd);

    /// Invoked to issue a save before renaming the document filename.
    void startRenameFileCommand();

    /// Finish handling the renamefile command.
    void endRenameFileCommand();

    /// Shutdown all client connections with the given reason.
    void shutdownClients(const std::string& closeReason);

    /// This gracefully terminates the connection
    /// with the child and cleans up ChildProcess etc.
    void terminateChild(const std::string& closeReason);

    /// Encodes whether or not saving is possible
    /// (regardless of whether we need to or not).
    STATE_ENUM(
        CanSave,
        Yes, //< Saving is possible.
        NoKit, //< There is no Kit.
        NotLoaded, //< No document is loaded.
        NoWriteSession, //< No available session can write.
    );

    /// Returns the state of whether saving is possible.
    /// (regardless of whether we need to or not).
    CanSave canSaveToDisk() const
    {
        if (_docState.isDisconnected() || getPid() <= 0)
        {
            return CanSave::NoKit;
        }

        if (!isLoaded())
        {
            return CanSave::NotLoaded;
        }

        if (_sessions.empty() || getWriteableSessionId().empty())
        {
            return CanSave::NoWriteSession;
        }

        return CanSave::Yes;
    }

    /// Encodes whether or not uploading is possible.
    /// (regardless of whether we need to or not).
    STATE_ENUM(
        CanUpload,
        Yes, //< Uploading is possible.
        NoStorage, //< Storage instance missing.
    );

    /// Returns the state of whether uploading is possible.
    /// (regardless of whether we need to or not).
    CanUpload canUploadToStorage() const
    {
        if (!_storage)
        {
            return CanUpload::NoStorage;
        }

        return CanUpload::Yes;
    }

    /// Encodes whether or not uploading is needed.
    STATE_ENUM(
        NeedToUpload,
        No, //< No need to upload, data up-to-date.
        Yes, //< Data is out of date.
        Force //< Force uploading, typically because always_save_on_exit is set.
    );

    /// Returns the state of the need to upload.
    /// This includes out-of-date Document in Storage or
    /// always_save_on_exit.
    NeedToUpload needToUploadToStorage() const;

    /// Returns true iff the document on disk is newer than the one in Storage.
    bool isStorageOutdated() const;

    /// Upload the doc to the storage.
    void uploadToStorageInternal(const std::string& sesionId, const std::string& saveAsPath,
                                 const std::string& saveAsFilename, const bool isRename,
                                 const bool force);

    /// Handles the completion of uploading to storage, both success and failure cases.
    void handleUploadToStorageResponse(const StorageBase::UploadResult& uploadResult);

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

    /// True if there has been activity from a client after we last *requested* saving,
    /// since there are race conditions vis-a-vis user activity while saving.
    bool haveActivityAfterSaveRequest() const
    {
        return _saveManager.lastSaveRequestTime() < _lastActivityTime;
    }

    /// Encodes whether or not saving is needed.
    STATE_ENUM(NeedToSave,
               No, //< No need to save, data up-to-date.
               Maybe, //< We have activity post saving.
               Yes_Modified, //< Data is out of date.
               Yes_LastSaveFailed, //< Yes, need to produce file on disk.
               Force //< Force saving, typically because the user requested.
    );

    /// Returns the state of the need to save.
    NeedToSave needToSaveToDisk() const;

    /// True if we know the doc is modified or
    /// if there has been activity from a client after we last *requested* saving,
    /// since there are race conditions vis-a-vis user activity while saving.
    bool isPossiblyModified() const
    {
        if (haveActivityAfterSaveRequest())
        {
            // Always assume possible modification when we have
            // user input after sending a .uno:Save, due to racing.
            return true;
        }

        if (_isViewFileExtension)
        {
            // ViewFileExtensions do not update the ModifiedStatus,
            // but, we want a success save anyway (including unmodified).
            return !_saveManager.lastSaveSuccessful();
        }

        // Regulard editable files, rely on the ModifiedStatus.
        return isModified();
    }

    /// True iff there is at least one non-readonly session other than the given.
    /// Since only editable sessions can save, we need to use the last to
    /// save modified documents, otherwise we'll potentially have to save on
    /// every editable session disconnect, lest we lose data due to racing.
    bool haveAnotherEditableSession(const std::string& id) const;

    /// Returns the number of active sessions.
    /// This includes only those that are loaded and not waiting disconnection.
    std::size_t countActiveSessions() const;

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
    /// Request manager.
    /// Encapsulates common fields for
    /// Save and Upload requests.
    class RequestManager
    {
    public:
        RequestManager()
            : _lastRequestTime(now())
            , _lastResponseTime(now())
            , _lastRequestFailureCount(0)
        {
        }

        /// Sets the time the last request was made to now.
        void markLastRequestTime() { _lastRequestTime = now(); }

        /// Returns the time the last request was made.
        std::chrono::steady_clock::time_point lastRequestTime() const { return _lastRequestTime; }

        /// How much time passed since the last request,
        /// regardless of whether we got a response or not.
        const std::chrono::milliseconds timeSinceLastRequest() const
        {
            return std::chrono::duration_cast<std::chrono::milliseconds>(now() - _lastRequestTime);
        }

        /// True iff there is an active request and it has timed out.
        bool hasLastRequestTimedOut(std::chrono::milliseconds timeoutMs) const
        {
            return isActive() && timeSinceLastRequest() >= timeoutMs;
        }


        /// Sets the time the last response was received to now.
        void markLastResponseTime() { _lastResponseTime = now(); }

        /// Returns the time the last response was received.
        std::chrono::steady_clock::time_point lastResponseTime() const { return _lastResponseTime; }

        /// How much time passed since the last response,
        /// regardless of whether there is a newer request or not.
        const std::chrono::milliseconds timeSinceLastResponse() const
        {
            return std::chrono::duration_cast<std::chrono::milliseconds>(now() - _lastResponseTime);
        }


        /// Returns true iff there is an active request in progress.
        bool isActive() const { return _lastResponseTime < _lastRequestTime; }


        /// Sets the last request's result, either to success or failure.
        /// And marks the last response time.
        void setLastRequestResult(bool success)
        {
            markLastResponseTime();
            if (success)
            {
                _lastRequestFailureCount = 0;
            }
            else
            {
                ++_lastRequestFailureCount;
            }
        }

        /// Indicates whether the last request was successful or not.
        bool lastRequestSuccessful() const { return _lastRequestFailureCount == 0; }

        /// Returns the number of failures in the previous requests. 0 for success.
        std::size_t lastRequestFailureCount() const { return _lastRequestFailureCount; }


        /// Helper to get the current time.
        static std::chrono::steady_clock::time_point now()
        {
            return std::chrono::steady_clock::now();
        }

    private:
        /// The last time we started an a request.
        std::chrono::steady_clock::time_point _lastRequestTime;

        /// The last time we received a response.
        std::chrono::steady_clock::time_point _lastResponseTime;

        /// Counts the number of previous request that failed.
        /// Note that this is interpretted by the request in question.
        /// For example, Core's Save operation turns 'false' for success
        /// when the file is unmodified, but that is still a successful result.
        std::size_t _lastRequestFailureCount;
    };

    /// Responsible for managing document saving.
    /// Tracks auto-saveing and its frequency.
    /// Tracks the last save request and response times.
    /// Tracks the local file's last modified time.
    /// Tracks the time a save response was received.
    class SaveManager final
    {
    public:
        SaveManager()
            : _autosaveInterval(std::chrono::seconds(30))
            , _lastAutosaveCheckTime(RequestManager::now())
            , _isAutosaveEnabled(std::getenv("COOL_NO_AUTOSAVE") == nullptr)
        {
        }

        /// Return true iff auto save is enabled.
        bool isAutosaveEnabled() const { return _isAutosaveEnabled; }

        /// Returns true if we should issue an auto-save.
        bool needAutosaveCheck() const
        {
            return isAutosaveEnabled()
                   && std::chrono::duration_cast<std::chrono::seconds>(RequestManager::now()
                                                                       - _lastAutosaveCheckTime)
                          >= _autosaveInterval;
        }

        /// Marks autosave check done.
        void autosaveChecked() { _lastAutosaveCheckTime = RequestManager::now(); }

        /// Called to postpone autosaving by at least the given duration.
        void postponeAutosave(std::chrono::seconds seconds)
        {
            const auto now = RequestManager::now();

            const auto nextAutosaveCheck = _lastAutosaveCheckTime + _autosaveInterval;
            const auto postponeTime = now + seconds;
            if (nextAutosaveCheck < postponeTime)
            {
                // Next autosave check will happen before the desired time.
                // Let's postpone it by the difference.
                const auto delay = postponeTime - nextAutosaveCheck;
                _lastAutosaveCheckTime += delay;
                LOG_TRC("Autosave check postponed by "
                        << std::chrono::duration_cast<std::chrono::milliseconds>(delay));
            }
        }

        /// Marks the last save request as now.
        void markLastSaveRequestTime() { _request.markLastRequestTime(); }

        /// Returns whether the last save was successful or not.
        bool lastSaveSuccessful() const { return _request.lastRequestSuccessful(); }

        /// Returns the number of previous save failures. 0 for success.
        std::size_t saveFailureCount() const { return _request.lastRequestFailureCount(); }

        /// Sets whether the last save was successful or not.
        void setLastSaveResult(bool success)
        {
            LOG_DBG("Save " << (success ? "succeeded" : "failed") << " after "
                            << _request.timeSinceLastRequest());
            _request.setLastRequestResult(success);
        }

        /// Returns the last save request time.
        std::chrono::steady_clock::time_point lastSaveRequestTime() const
        {
            return _request.lastRequestTime();
        }

        /// Marks the last save response as now.
        void markLastSaveResponseTime() { _request.markLastResponseTime(); }

        /// Returns the last save response time.
        std::chrono::steady_clock::time_point lastSaveResponseTime() const
        {
            return _request.lastResponseTime();
        }

        /// Set the last modified time of the document.
        void setLastModifiedTime(std::chrono::system_clock::time_point time)
        {
            _lastModifiedTime = time;
        }

        /// Returns the last modified time of the document.
        std::chrono::system_clock::time_point getLastModifiedTime() const
        {
            return _lastModifiedTime;
        }

        /// True iff a save is in progress (requested but not completed).
        bool isSaving() const { return _request.isActive(); }

        /// Set the maximum time to wait for saving to finish.
        void setSavingTimeout(std::chrono::seconds savingTimeout)
        {
            _savingTimeout = savingTimeout;
        }

        /// True iff the last save request has timed out.
        bool hasSavingTimedOut() const
        {
            return _request.hasLastRequestTimedOut(_savingTimeout);
        }

        /// The duration elapsed since we sent the last save request to Core.
        std::chrono::milliseconds timeSinceLastSaveRequest() const
        {
            return _request.timeSinceLastRequest();
        }

        /// The duration elapsed since we received the last save response from Core.
        std::chrono::milliseconds timeSinceLastSaveResponse() const
        {
            return _request.timeSinceLastResponse();
        }

        /// True if we aren't saving and the minimum time since last save has elapsed.
        bool canSaveNow(std::chrono::milliseconds minTime) const
        {
            return !isSaving() && std::min(_request.timeSinceLastRequest(),
                                           _request.timeSinceLastResponse()) >= minTime;
        }

        void dumpState(std::ostream& os, const std::string& indent = "\n  ")
        {
            const auto now = std::chrono::steady_clock::now();
            os << indent << "isSaving now: " << std::boolalpha << isSaving();
            os << indent << "auto-save enabled: " << std::boolalpha << _isAutosaveEnabled;
            os << indent << "auto-save interval: " << _autosaveInterval;
            os << indent
               << "last auto-save check time: " << Util::getTimeForLog(now, _lastAutosaveCheckTime);
            os << indent << "auto-save check needed: " << std::boolalpha << needAutosaveCheck();

            os << indent
               << "last save request: " << Util::getTimeForLog(now, lastSaveRequestTime());
            os << indent
               << "last save response: " << Util::getTimeForLog(now, lastSaveResponseTime());

            os << indent << "since last save request: " << timeSinceLastSaveRequest();
            os << indent << "since last save response: " << timeSinceLastSaveResponse();

            os << indent
               << "file last modified time: " << Util::getTimeForLog(now, _lastModifiedTime);
            os << indent << "last save timed-out: " << std::boolalpha << hasSavingTimedOut();
            os << indent << "last save successful: " << lastSaveSuccessful();
            os << indent << "save failure count: " << saveFailureCount();
        }

    private:
        /// Request tracking logic.
        RequestManager _request;

        /// The document's last-modified time.
        std::chrono::system_clock::time_point _lastModifiedTime;

        /// The number of seconds between autosave checks for modification.
        const std::chrono::seconds _autosaveInterval;

        /// The maximum time to wait for saving to finish.
        std::chrono::seconds _savingTimeout;

        /// The last autosave check time.
        std::chrono::steady_clock::time_point _lastAutosaveCheckTime;

        /// Whether auto-saving is enabled at all or not.
        const bool _isAutosaveEnabled;
    };

    /// Represents an upload request.
    class UploadRequest final
    {
    public:
        UploadRequest(std::string uriAnonym,
                      std::chrono::system_clock::time_point newFileModifiedTime,
                      const std::shared_ptr<class ClientSession>& session, bool isSaveAs,
                      bool isRename)
            : _startTime(std::chrono::steady_clock::now())
            , _uriAnonym(std::move(uriAnonym))
            , _newFileModifiedTime(newFileModifiedTime)
            , _session(session)
            , _isSaveAs(isSaveAs)
            , _isRename(isRename)
        {
        }

        const std::chrono::milliseconds timeSinceRequest() const
        {
            return std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::steady_clock::now() - _startTime);
        }

        const std::string& uriAnonym() const { return _uriAnonym; }
        const std::chrono::system_clock::time_point& newFileModifiedTime() const
        {
            return _newFileModifiedTime;
        }

        std::shared_ptr<class ClientSession> session() const { return _session.lock(); }
        bool isSaveAs() const { return _isSaveAs; }
        bool isRename() const { return _isRename; }

    private:
        const std::chrono::steady_clock::time_point _startTime; //< The time we made the request.
        const std::string _uriAnonym;
        const std::chrono::system_clock::time_point _newFileModifiedTime;
        const std::weak_ptr<class ClientSession> _session;
        const bool _isSaveAs;
        const bool _isRename;
    };

    /// Responsible for managing document uploading into storage.
    class StorageManager final
    {
    public:
        StorageManager()
            : _lastUploadTime(RequestManager::now())
        {
        }

        /// Marks the last time we attempted to upload, regardless of outcome, to now.
        void markLastUploadTime() { _lastUploadTime = RequestManager::now(); }

        // Gets the last time we attempted to upload.
        std::chrono::steady_clock::time_point getLastUploadTime() const { return _lastUploadTime; }

        /// Returns whether the last upload was successful or not.
        bool lastUploadSuccessful() const { return _request.lastRequestSuccessful(); }

        /// Sets whether the last upload was successful or not.
        void setLastUploadResult(bool success)
        {
            LOG_DBG("Upload " << (success ? "succeeded" : "failed") << " after "
                              << _request.timeSinceLastRequest());
            _request.setLastRequestResult(success);
        }

        /// The duration elapsed since we sent the last upload request to storage.
        std::chrono::milliseconds timeSinceLastUploadRequest() const
        {
            return _request.timeSinceLastRequest();
        }

        /// The duration elapsed since we received the last upload response from storage.
        std::chrono::milliseconds timeSinceLastUploadResponse() const
        {
            return _request.timeSinceLastResponse();
        }

        /// Returns the number of previous upload failures. 0 for success.
        std::size_t uploadFailureCount() const { return _request.lastRequestFailureCount(); }

        /// Get the modified-timestamp of the local file on disk we last uploaded.
        std::chrono::system_clock::time_point getLastUploadedFileModifiedTime() const
        {
            return _lastUploadedFileModifiedTime;
        }

        /// Set the modified-timestamp of the local file on disk we last uploaded.
        void setLastUploadedFileModifiedTime(std::chrono::system_clock::time_point modifiedTime)
        {
            _lastUploadedFileModifiedTime = modifiedTime;
        }

        /// Set the last modified time of the document.
        void setLastModifiedTime(const std::string& time) { _lastModifiedTime = time; }

        /// Returns the last modified time of the document.
        const std::string& getLastModifiedTime() const { return _lastModifiedTime; }

        void dumpState(std::ostream& os, const std::string& indent = "\n  ")
        {
            const auto now = std::chrono::steady_clock::now();
            os << indent << "last upload time: " << Util::getTimeForLog(now, getLastUploadTime());
            os << indent << "last upload was successful: " << lastUploadSuccessful();
            os << indent << "upload failure count: " << uploadFailureCount();
            os << indent << "last modified time (on server): " << _lastModifiedTime;
            os << indent << "since last upload request: " << timeSinceLastUploadRequest();
            os << indent << "since last upload response: " << timeSinceLastUploadResponse();
            os << indent
               << "file last modified: " << Util::getTimeForLog(now, _lastUploadedFileModifiedTime);
        }

    private:
        /// Request tracking logic.
        RequestManager _request;

        /// The last time we tried uploading, regardless of whether the
        /// document was modified and a newer version saved
        /// and uploaded or not. In effect, this tracks the time we
        /// synchronized with Storage (i.e. the last time we either uploaded
        /// or had nothing new to upload). It is redundant as it is
        /// equivalent to the larger of 'Last Save Response Time' and
        /// 'Last Storage Response Time', and should be removed.
        std::chrono::steady_clock::time_point _lastUploadTime;

        /// The modified-timestamp of the local file on disk we uploaded last.
        std::chrono::system_clock::time_point _lastUploadedFileModifiedTime;

        /// The modified time of the document in storage, as reported by the server.
        std::string _lastModifiedTime;
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
        STATE_ENUM(Status,
                   None, //< Doesn't exist, pending downloading.
                   Downloading, //< Download from Storage to disk. Synchronous.
                   Loading, //< Loading the document in Core.
                   Live, //< General availability for viewing/editing.
                   Destroying, //< End-of-life, marked to destroy.
                   Destroyed //< Unloading complete, destruction pending.
        );

        /// The current activity taking place.
        /// Meaningful only when Status is Status::Live, but
        /// we may Save and Upload during Status::Destroying.
        STATE_ENUM(Activity,
                   None, //< No particular activity.
                   Rename, //< The document is being renamed.
                   SaveAs, //< The document format is being converted.
                   Conflict, //< The document is conflicted in storaged.
                   Save, //< The document is being saved, manually or auto-save.
                   Upload, //< The document is being uploaded to storage.
        );

        DocumentState()
            : _status(Status::None)
            , _activity(Activity::None)
            , _loaded(false)
            , _closeRequested(false)
            , _unloadRequested(false)
            , _disconnected(false)
            , _interactive(false)
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

        DocumentState::Activity activity() const { return _activity; }
        void setActivity(Activity newActivity)
        {
            LOG_TRC("Setting Document Activity from " << toString(_activity) << " to "
                                                      << toString(newActivity));
            _activity = newActivity;
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

        void setInteractive(bool value) { _interactive = value; }
        bool isInteractive() const { return _interactive; }

        /// Flag to unload the document. Irreversible.
        void setUnloadRequested() { _unloadRequested = true; }
        bool isUnloadRequested() const { return _unloadRequested; }

        /// Flag that we are disconnected from the Kit. Irreversible.
        void setDisconnected() { _disconnected = true; }
        bool isDisconnected() const { return _disconnected; }

        void dumpState(std::ostream& os, const std::string& indent = "\n  ")
        {
            os << indent << "doc state: " << toString(status());
            os << indent << "doc activity: " << toString(activity());
            os << indent << "doc loaded: " << _loaded;
            os << indent << "interactive: " << _interactive;
            os << indent << "close requested: " << _closeRequested;
            os << indent << "unload requested: " << _unloadRequested;
            os << indent << "disconnected from kit: " << _disconnected;
        }

    private:
        Status _status;
        Activity _activity;
        std::atomic<bool> _loaded; //< If the document ever loaded (check isLive to see if it still is).
        std::atomic<bool> _closeRequested; //< Owner-Termination flag.
        std::atomic<bool> _unloadRequested; //< Unload-Requested flag, which may be reset.
        std::atomic<bool> _disconnected; //< Disconnected from the Kit. Implies unloading.
        bool _interactive; //< If the document has interactive dialogs before load
    };

    /// Transition to a given activity. Returns false if an activity exists.
    bool startActivity(DocumentState::Activity activity)
    {
        if (activity == DocumentState::Activity::None)
        {
            LOG_DBG("Error: Cannot start 'None' activity.");
            assert(!"Cannot start 'None' activity.");
            return false;
        }

        if (_docState.activity() != DocumentState::Activity::None)
        {
            LOG_DBG("Error: Cannot start new activity ["
                    << DocumentState::toString(activity) << "] while executing ["
                    << DocumentState::toString(_docState.activity()) << ']');
            assert(!"Cannot start new activity while executing another.");
            return false;
        }

        _docState.setActivity(activity);
        return true;
    }

    /// Ends the current activity.
    void endActivity()
    {
        LOG_DBG("Ending [" << DocumentState::toString(_docState.activity()) << "] activity.");
        _docState.setActivity(DocumentState::Activity::None);
    }

    /// Performs aggregated work after servicing all client sessions
    void processBatchUpdates();

    /// The main state of the document.
    DocumentState _docState;

    /// Set to true when document changed in storage and we are waiting
    /// for user's command to act.
    bool _documentChangedInStorage;

    /// True for file that COOLWSD::IsViewFileExtension return true.
    /// These files, such as PDF, don't have a reliable ModifiedStatus.
    bool _isViewFileExtension;

    /// Manage saving in Core.
    SaveManager _saveManager;

    /// The current upload request, if any.
    /// For now we can only have one at a time.
    std::unique_ptr<UploadRequest> _uploadRequest;

    /// Manage uploading to Storage.
    StorageManager _storageManager;

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
    std::string _renameFilename; //< The new filename to rename to.
    std::string _renameSessionId; //< The sessionId used for renaming.
    std::string _lastEditingSessionId; //< The last session edited, for auto-saving.

    /// Versioning is used to prevent races between
    /// painting and invalidation.
    std::atomic<std::size_t> _tileVersion;

    int _debugRenderedTileCount;

    std::chrono::steady_clock::time_point _lastNotifiedActivityTime;
    std::chrono::steady_clock::time_point _lastActivityTime;
    std::chrono::steady_clock::time_point _threadStart;
    std::chrono::milliseconds _loadDuration;
    std::chrono::milliseconds _wopiDownloadDuration;

    /// Unique DocBroker ID for tracing and debugging.
    static std::atomic<unsigned> DocBrokerId;

    // Relevant only in the mobile apps
    const unsigned _mobileAppDocId;

    // Maps download id -> URL
    std::map<std::string, std::string> _registeredDownloadLinks;
};

#if !MOBILEAPP
class StatelessBatchBroker : public DocumentBroker
{
protected:
    std::shared_ptr<ClientSession> _clientSession;

public:
    StatelessBatchBroker(const std::string& uri,
                   const Poco::URI& uriPublic,
                   const std::string& docKey)
        : DocumentBroker(ChildType::Batch, uri, uriPublic, docKey)
    {}

    virtual ~StatelessBatchBroker()
    {}

    /// Cleanup path and its parent
    static void removeFile(const std::string &uri);
};

class ConvertToBroker final : public StatelessBatchBroker
{
    const std::string _format;
    const std::string _sOptions;

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

    /// When the load completes - lets start saving
    void setLoaded() override;

    /// Called when removed from the DocBrokers list
    void dispose() override;

    /// How many live conversions are running.
    static std::size_t getInstanceCount();

private:
    bool isConvertTo() const override { return true; }
};

class RenderSearchResultBroker final : public StatelessBatchBroker
{
    std::shared_ptr<std::vector<char>> _pSearchResultContent;
    std::vector<char> _aResposeData;
    std::shared_ptr<StreamSocket> _socket;

public:
    RenderSearchResultBroker(std::string const& uri,
                             Poco::URI const& uriPublic,
                             std::string const& docKey,
                             std::shared_ptr<std::vector<char>> const& pSearchResultContent);

    virtual ~RenderSearchResultBroker();

    void setResponseSocket(std::shared_ptr<StreamSocket> const & socket)
    {
        _socket = socket;
    }

    /// Execute command(s) and move the socket to this broker
    bool executeCommand(SocketDisposition& disposition, std::string const& id);

    /// Override method to start executing when the document is loaded
    void setLoaded() override;

    /// Called when removed from the DocBrokers list
    void dispose() override;

    /// Override to filter out the data that is returned by a command
    bool handleInput(const std::vector<char>& payload) override;

    /// How many instances are running.
    static std::size_t getInstanceCount();
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
