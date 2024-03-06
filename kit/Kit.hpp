/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <Poco/Util/XMLConfiguration.h>
#include <map>
#include <string>

#include <common/Util.hpp>
#include <common/Session.hpp>
#include <common/ThreadPool.hpp>
#include <wsd/TileDesc.hpp>

#include "Socket.hpp"

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKit.hxx>

#if MOBILEAPP

#include "ClientSession.hpp"
#include "DocumentBroker.hpp"

#endif

void lokit_main(
#if !MOBILEAPP
    const std::string& childRoot, const std::string& jailId, const std::string& sysTemplate,
    const std::string& loTemplate, bool noCapabilities, bool noSeccomp, bool queryVersionInfo,
    bool displayVersion,
#else
    int docBrokerSocket, const std::string& userInterface,
#endif
    std::size_t numericIdentifier);

#ifdef IOS
void runKitLoopInAThread();
#endif

bool globalPreinit(const std::string& loTemplate);
/// Wrapper around private Document::ViewCallback().
void documentViewCallback(const int type, const char* p, void* data);

class DeltaGenerator;
class DocumentManagerInterface;

/// Descriptor class used to link a LOK
/// callback to a specific view.
struct CallbackDescriptor
{
    CallbackDescriptor(DocumentManagerInterface* const doc, const int viewId)
        : _doc(doc)
        , _viewId(viewId)
    {
    }

    DocumentManagerInterface* getDoc() const { return _doc; }

    int getViewId() const { return _viewId; }

private:
    DocumentManagerInterface* const _doc;
    const int _viewId;
};

/// User Info container used to store user information
/// till the end of process lifecycle - including
/// after any child session goes away
struct UserInfo
{
    UserInfo()
        : _readOnly(false)
    {
    }

    UserInfo(const std::string& userId, const std::string& userName,
             const std::string& userExtraInfo, const std::string& userPrivateInfo, bool readOnly)
        : _userId(userId)
        , _userName(userName)
        , _userExtraInfo(userExtraInfo)
        , _userPrivateInfo(userPrivateInfo)
        , _readOnly(readOnly)
    {
    }

    const std::string& getUserId() const { return _userId; }

    const std::string& getUserName() const { return _userName; }

    const std::string& getUserExtraInfo() const { return _userExtraInfo; }

    const std::string& getUserPrivateInfo() const { return _userPrivateInfo; }

    bool isReadOnly() const { return _readOnly; }

private:
    std::string _userId;
    std::string _userName;
    std::string _userExtraInfo;
    std::string _userPrivateInfo;
    bool _readOnly;
};

/// We have two types of password protected documents
/// 1) Documents which require password to view
/// 2) Document which require password to modify
enum class DocumentPasswordType
{
    ToView,
    ToModify
};

/// Check the ForkCounter, and if non-zero, fork more of them accordingly.
void forkLibreOfficeKit(const std::string& childRoot, const std::string& sysTemplate,
                        const std::string& loTemplate);

class Document;

/// The main main-loop of the Kit process
class KitSocketPoll final : public SocketPoll
{
    std::chrono::steady_clock::time_point _pollEnd;
    std::shared_ptr<Document> _document;

    static KitSocketPoll* mainPoll;

    KitSocketPoll();

public:
    ~KitSocketPoll();
    void drainQueue();

    static void dumpGlobalState(std::ostream& oss);
    static std::shared_ptr<KitSocketPoll> create();

    virtual void wakeupHook() override;

#if ENABLE_DEBUG
    struct ReEntrancyGuard
    {
        std::atomic<int>& _count;
        ReEntrancyGuard(std::atomic<int>& count)
            : _count(count)
        {
            count++;
        }
        ~ReEntrancyGuard() { _count--; }
    };
#endif
    int kitPoll(int timeoutMicroS);
    void setDocument(std::shared_ptr<Document> document) { _document = std::move(document); }

    // unusual LOK event from another thread, push into our loop to process.
    static bool pushToMainThread(LibreOfficeKitCallback callback, int type, const char* p,
                                 void* data);

#ifdef IOS
    static std::mutex KSPollsMutex;
    // static std::condition_variable KSPollsCV;
    static std::vector<std::weak_ptr<KitSocketPoll>> KSPolls;

    std::mutex terminationMutex;
    std::condition_variable terminationCV;
    bool terminationFlag;
#endif
};

class TileQueue;
class ChildSession;

// An abstract interface.
class DocumentManagerInterface
{
public:
    virtual ~DocumentManagerInterface() {}

    /// Request loading a document, or a new view, if one exists.
    virtual bool onLoad(const std::string& sessionId, const std::string& uriAnonym,
                        const std::string& renderOpts) = 0;

    /// Unload a client session, which unloads the document
    /// if it is the last and only.
    virtual void onUnload(const ChildSession& session) = 0;

    /// Access to the Kit instance.
    virtual std::shared_ptr<lok::Office> getLOKit() = 0;

    /// Access to the document instance.
    virtual std::shared_ptr<lok::Document> getLOKitDocument() = 0;

    /// Send msg to all active sessions.
    virtual bool notifyAll(const std::string& msg) = 0;

    /// Send updated view info to all active sessions.
    virtual void notifyViewInfo() = 0;
    virtual void updateEditorSpeeds(int id, int speed) = 0;

    virtual int getEditorId() const = 0;

    /// Get a view ID <-> UserInfo map.
    virtual std::map<int, UserInfo> getViewInfo() = 0;

    virtual std::string getObfuscatedFileId() = 0;

    virtual std::shared_ptr<TileQueue>& getTileQueue() = 0;

    virtual bool sendFrame(const char* buffer, int length, WSOpCode opCode = WSOpCode::Text) = 0;

    virtual void alertAllUsers(const std::string& cmd, const std::string& kind) = 0;

    virtual unsigned getMobileAppDocId() const = 0;

    /// See if we should clear out our memory
    virtual void trimIfInactive() = 0;

    virtual bool isDocPasswordProtected() const = 0;

    virtual bool haveDocPassword() const = 0;

    virtual std::string getDocPassword() const = 0;

    virtual DocumentPasswordType getDocPasswordType() const = 0;

    virtual void updateActivityHeader() const = 0;
};

/// A document container.
/// Owns LOKitDocument instance and connections.
/// Manages the lifetime of a document.
/// Technically, we can host multiple documents
/// per process. But for security reasons don't.
/// However, we could have a coolkit instance
/// per user or group of users (a trusted circle).
class Document final : public DocumentManagerInterface
{
public:
    Document(const std::shared_ptr<lok::Office>& loKit, const std::string& jailId,
             const std::string& docKey, const std::string& docId, const std::string& url,
             std::shared_ptr<TileQueue> tileQueue,
             const std::shared_ptr<WebSocketHandler>& websocketHandler, unsigned mobileAppDocId);
    virtual ~Document();

    const std::string& getUrl() const { return _url; }

    /// Post the message - in the unipoll world we're in the right thread anyway
    bool postMessage(const char* data, int size, const WSOpCode code) const;

    bool createSession(const std::string& sessionId);

    /// Purges dead connections and returns
    /// the remaining number of clients.
    /// Returns -1 on failure.
    std::size_t purgeSessions();

    void setDocumentPassword(int passwordType);

    void renderTiles(TileCombined& tileCombined);

    bool sendTextFrame(const std::string& message)
    {
        return sendFrame(message.data(), message.size());
    }

    bool sendFrame(const char* buffer, int length, WSOpCode opCode = WSOpCode::Text) override;

    void alertNotAsync()
    {
        // load unfortunately enables inputprocessing in some cases.
        if (processInputEnabled() && !_duringLoad)
            notifyAll("error: cmd=notasync kind=failure");
    }

    void alertAllUsers(const std::string& cmd, const std::string& kind) override
    {
        sendTextFrame("errortoall: cmd=" + cmd + " kind=" + kind);
    }

    /// Notify all views with the given message
    bool notifyAll(const std::string& msg) override
    {
        // Broadcast updated viewinfo to all clients.
        return sendTextFrame("client-all " + msg);
    }

    unsigned getMobileAppDocId() const override { return _mobileAppDocId; }

    void trimIfInactive() override;
    void trimAfterInactivity();

    // LibreOfficeKit callback entry points
    static void GlobalCallback(const int type, const char* p, void* data);
    static void ViewCallback(const int type, const char* p, void* data);

private:
    /// Helper method to broadcast callback and its payload to all clients
    void broadcastCallbackToClients(const int type, const std::string& payload)
    {
        _tileQueue->put("callback all " + std::to_string(type) + ' ' + payload);
    }

    /// Load a document (or view) and register callbacks.
    bool onLoad(const std::string& sessionId, const std::string& uriAnonym,
                const std::string& renderOpts) override;
    void onUnload(const ChildSession& session) override;

    std::map<int, UserInfo> getViewInfo() override { return _sessionUserInfo; }

    std::shared_ptr<TileQueue>& getTileQueue() override { return _tileQueue; }

    int getEditorId() const override { return _editorId; }

    bool isDocPasswordProtected() const override { return _isDocPasswordProtected; }

    bool haveDocPassword() const override { return _haveDocPassword; }

    std::string getDocPassword() const override { return _docPassword; }

    DocumentPasswordType getDocPasswordType() const override { return _docPasswordType; }

    void updateActivityHeader() const override;

    /// Notify all views of viewId and their associated usernames
    void notifyViewInfo() override;

    std::shared_ptr<ChildSession> findSessionByViewId(int viewId);

    void invalidateCanonicalId(const std::string& sessionId);

    std::string getViewProps(const std::shared_ptr<ChildSession>& session);

    void updateEditorSpeeds(int id, int speed) override;

private:
    // Get the color value for all author names from the core
    std::map<std::string, int> getViewColors();

    std::string getDefaultTheme(const std::shared_ptr<ChildSession>& session) const;

    std::shared_ptr<lok::Document> load(const std::shared_ptr<ChildSession>& session,
                                        const std::string& renderOpts);

    bool forwardToChild(const std::string& prefix, const std::vector<char>& payload);

    static std::string makeRenderParams(const std::string& renderOpts, const std::string& userName,
                                        const std::string& spellOnline, const std::string& theme);
    bool isTileRequestInsideVisibleArea(const TileCombined& tileCombined);

public:
    void enableProcessInput(bool enable = true) { _inputProcessingEnabled = enable; }
    bool processInputEnabled() const { return _inputProcessingEnabled; }
    bool hasQueueItems() const { return _tileQueue && !_tileQueue->isEmpty(); }

    // poll is idle, are we ?
    void checkIdle();
    void drainQueue();

    void dumpState(std::ostream& oss);

private:
    /// Return access to the lok::Office instance.
    std::shared_ptr<lok::Office> getLOKit() override { return _loKit; }

    /// Return access to the lok::Document instance.
    std::shared_ptr<lok::Document> getLOKitDocument() override;

    std::string getObfuscatedFileId() override { return _obfuscatedFileId; }

#if !MOBILEAPP
    /// Stops theads, flushes buffers, and exits the process.
    void flushAndExit(int code);
#endif

private:
    std::shared_ptr<lok::Office> _loKit;
    const std::string _jailId;
    /// URL-based key. May be repeated during the lifetime of WSD.
    const std::string _docKey;
    /// Short numerical ID. Unique during the lifetime of WSD.
    const std::string _docId;
    const std::string _url;
    const std::string _obfuscatedFileId;
    std::string _jailedUrl;
    std::string _renderOpts;

    std::shared_ptr<lok::Document> _loKitDocument;
#ifdef __ANDROID__
    static std::shared_ptr<lok::Document> _loKitDocumentForAndroidOnly;
#endif
    std::shared_ptr<TileQueue> _tileQueue;
    std::shared_ptr<WebSocketHandler> _websocketHandler;

    // Document password provided
    std::string _docPassword;
    // Whether password was provided or not
    bool _haveDocPassword;
    // Whether document is password protected
    bool _isDocPasswordProtected;
    // Whether password is required to view the document, or modify it
    DocumentPasswordType _docPasswordType;

    std::atomic<bool> _stop;

    ThreadPool _deltaPool;
    std::unique_ptr<DeltaGenerator> _deltaGen;

    std::condition_variable _cvLoading;
    int _editorId;
    bool _editorChangeWarning;
    std::map<int, std::unique_ptr<CallbackDescriptor>> _viewIdToCallbackDescr;
    SessionMap<ChildSession> _sessions;

    /// The timestamp of the last memory trimming.
    std::chrono::steady_clock::time_point _lastMemTrimTime;

    std::map<int, std::chrono::steady_clock::time_point> _lastUpdatedAt;
    std::map<int, int> _speedCount;
    /// For showing disconnected user info in the doc repair dialog.
    std::map<int, UserInfo> _sessionUserInfo;
#ifdef __ANDROID__
    friend std::shared_ptr<lok::Document> getLOKDocumentForAndroidOnly();
#endif

    const unsigned _mobileAppDocId;
    bool _inputProcessingEnabled;
    int _duringLoad;
};

/// main function of the forkit process or thread
int forkit_main(int argc, char** argv);

/// Anonymize the basename of filenames, preserving the path and extension.
std::string anonymizeUrl(const std::string& url);

/// Anonymize usernames.
std::string anonymizeUsername(const std::string& username);

/// Ensure there is no fatal system setup problem
void consistencyCheckJail();

/// check how many theads we have currently
int getCurrentThreadCount();

/// Fetch the latest montonically incrementing wire-id
TileWireId getCurrentWireId(bool increment = false);

#ifdef __ANDROID__
/// For the Android app, for now, we need access to the one and only document open to perform eg. saveAs() for printing.
std::shared_ptr<lok::Document> getLOKDocumentForAndroidOnly();
#endif

extern _LibreOfficeKit* loKitPtr;

/// Check if URP is enabled
bool isURPEnabled();

/// Start a URP connection, checking if URP is enabled and there is not already an active URP session
bool startURP(std::shared_ptr<lok::Office> LOKit, void** ppURPContext);

/// Ensure all recorded traces hit the disk
void flushTraceEventRecordings();

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
