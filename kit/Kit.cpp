/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * The main entry point for the LibreOfficeKit process serving
 * a document editing session.
 */

#include <Poco/File.h>
#include <config.h>

#include <dlfcn.h>
#ifdef __linux__
#include <sys/capability.h>
#include <sys/sysmacros.h>
#endif
#ifdef __FreeBSD__
#include <sys/capsicum.h>
#endif
#include <unistd.h>
#include <utime.h>
#include <sys/time.h>
#include <sys/resource.h>
#include <sysexits.h>

#include <atomic>
#include <cassert>
#include <climits>
#include <condition_variable>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <memory>
#include <string>
#include <sstream>
#include <thread>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitInit.h>

#include <Poco/Exception.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/Socket.h>
#include <Poco/URI.h>

#include "ChildSession.hpp"
#include <Common.hpp>
#include <MobileApp.hpp>
#include <FileUtil.hpp>
#include <common/JailUtil.hpp>
#include "KitHelper.hpp"
#include "Kit.hpp"
#include <Protocol.hpp>
#include <Log.hpp>
#include <Png.hpp>
#include <Rectangle.hpp>
#include <TileDesc.hpp>
#include <Unit.hpp>
#include <UserMessages.hpp>
#include <Util.hpp>
#include "Watermark.hpp"
#include "RenderTiles.hpp"
#include "SetupKitEnvironment.hpp"

#if !MOBILEAPP
#include <common/SigUtil.hpp>
#include <common/Seccomp.hpp>
#include <utility>
#endif

#ifdef FUZZER
#include <kit/DummyLibreOfficeKit.hpp>
#include <wsd/LOOLWSD.hpp>
#endif

#if MOBILEAPP
#include "LOOLWSD.hpp"
#endif

#ifdef IOS
#include "ios.h"
#endif

#define LIB_SOFFICEAPP  "lib" "sofficeapp" ".so"
#define LIB_MERGED      "lib" "mergedlo" ".so"

using Poco::Exception;
using Poco::File;
using Poco::JSON::Array;
using Poco::JSON::Object;
using Poco::JSON::Parser;
using Poco::URI;

#ifndef BUILDING_TESTS
using Poco::Path;
#endif

using namespace LOOLProtocol;

extern "C" { void dump_kit_state(void); /* easy for gdb */ }

// We only host a single document in our lifetime.
class Document;
#ifndef BUILDING_TESTS
static bool AnonymizeUserData = false;
static uint64_t AnonymizationSalt = 82589933;
#endif

/// When chroot is enabled, this is blank as all
/// the paths inside the jail, relative to it's jail.
/// E.g. /tmp/user/docs/...
/// However, without chroot, the jail path is
/// absolute in the system root.
/// I.e. ChildRoot/JailId/tmp/user/docs/...
/// We need to know where the jail really is
/// because WSD doesn't know if chroot will succeed
/// or fail, but it assumes the document path to
/// be relative to the root of the jail (i.e. chroot
/// expected to succeed). If it fails, or when caps
/// are disabled, file paths would be relative to the
/// system root, not the jail.
static std::string JailRoot;

#if !MOBILEAPP

static LokHookFunction2* initFunction = nullptr;

namespace
{
#ifndef BUILDING_TESTS
#ifndef __FreeBSD__
    void dropCapability(cap_value_t capability)
    {
        cap_t caps;
        cap_value_t cap_list[] = { capability };

        caps = cap_get_proc();
        if (caps == nullptr)
        {
            LOG_SFL("cap_get_proc() failed.");
            Log::shutdown();
            std::_Exit(1);
        }

        char *capText = cap_to_text(caps, nullptr);
        LOG_TRC("Capabilities first: " << capText);
        cap_free(capText);

        if (cap_set_flag(caps, CAP_EFFECTIVE, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1 ||
            cap_set_flag(caps, CAP_PERMITTED, sizeof(cap_list)/sizeof(cap_list[0]), cap_list, CAP_CLEAR) == -1)
        {
            LOG_SFL("cap_set_flag() failed.");
            Log::shutdown();
            std::_Exit(1);
        }

        if (cap_set_proc(caps) == -1)
        {
            LOG_SFL("cap_set_proc() failed.");
            Log::shutdown();
            std::_Exit(1);
        }

        capText = cap_to_text(caps, nullptr);
        LOG_TRC("Capabilities now: " << capText);
        cap_free(capText);

        cap_free(caps);
    }
#endif // __FreeBSD__
#endif // BUILDING_TESTS
} // namespace

#endif // !MOBILEAPP

/// A document container.
/// Owns LOKitDocument instance and connections.
/// Manages the lifetime of a document.
/// Technically, we can host multiple documents
/// per process. But for security reasons don't.
/// However, we could have a loolkit instance
/// per user or group of users (a trusted circle).
class Document final : public DocumentManagerInterface
{
public:
    /// We have two types of password protected documents
    /// 1) Documents which require password to view
    /// 2) Document which require password to modify
    enum class PasswordType { ToView, ToModify };

public:
    Document(const std::shared_ptr<lok::Office>& loKit,
             const std::string& jailId,
             const std::string& docKey,
             const std::string& docId,
             const std::string& url,
             std::shared_ptr<TileQueue> tileQueue,
             const std::shared_ptr<WebSocketHandler>& websocketHandler,
             unsigned mobileAppDocId)
      : _loKit(loKit),
        _jailId(jailId),
        _docKey(docKey),
        _docId(docId),
        _url(url),
        _obfuscatedFileId(Util::getFilenameFromURL(docKey)),
        _tileQueue(std::move(tileQueue)),
        _websocketHandler(websocketHandler),
        _docPassword(""),
        _haveDocPassword(false),
        _isDocPasswordProtected(false),
        _docPasswordType(PasswordType::ToView),
        _stop(false),
        _isLoading(0),
        _editorId(-1),
        _editorChangeWarning(false),
        _mobileAppDocId(mobileAppDocId),
        _inputProcessingEnabled(true)
    {
        LOG_INF("Document ctor for [" << _docKey <<
                "] url [" << anonymizeUrl(_url) << "] on child [" << _jailId <<
                "] and id [" << _docId << "].");
        assert(_loKit);

    }

    virtual ~Document()
    {
        LOG_INF("~Document dtor for [" << _docKey <<
                "] url [" << anonymizeUrl(_url) << "] on child [" << _jailId <<
                "] and id [" << _docId << "]. There are " <<
                _sessions.size() << " views.");

        // Wait for the callback worker to finish.
        _stop = true;

        _tileQueue->put("eof");

        for (const auto& session : _sessions)
        {
            session.second->resetDocManager();
        }

#ifdef IOS
        deallocateDocumentDataForMobileAppDocId(_mobileAppDocId);
#endif

    }

    const std::string& getUrl() const { return _url; }

    /// Post the message - in the unipoll world we're in the right thread anyway
    bool postMessage(const char* data, int size, const WSOpCode code) const
    {
        LOG_TRC("postMessage called with: " << getAbbreviatedMessage(data, size));
        if (!_websocketHandler)
        {
            LOG_ERR("Child Doc: Bad socket while sending [" << getAbbreviatedMessage(data, size) << "].");
            return false;
        }

        _websocketHandler->sendMessage(data, size, code);
        return true;
    }

    bool createSession(const std::string& sessionId, int canonicalViewId)
    {
        std::unique_lock<std::mutex> lock(_mutex);

        try
        {
            if (_sessions.find(sessionId) != _sessions.end())
            {
                LOG_WRN("Session [" << sessionId << "] on url [" << anonymizeUrl(_url) << "] already exists.");
                return true;
            }

            LOG_INF("Creating " << (_sessions.empty() ? "first" : "new") <<
                    " session for url: " << anonymizeUrl(_url) << " for sessionId: " <<
                    sessionId << " on jailId: " << _jailId);

            auto session = std::make_shared<ChildSession>(
                _websocketHandler, sessionId,
                _jailId, JailRoot, *this);
            _sessions.emplace(sessionId, session);
            session->setCanonicalViewId(canonicalViewId);

            int viewId = session->getViewId();
            _lastUpdatedAt[viewId] = std::chrono::steady_clock::now();
            _speedCount[viewId] = 0;

            LOG_DBG("Sessions: " << _sessions.size());
            return true;
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Exception while creating session [" << sessionId <<
                    "] on url [" << anonymizeUrl(_url) << "] - '" << ex.what() << "'.");
            return false;
        }
    }

    /// Purges dead connections and returns
    /// the remaining number of clients.
    /// Returns -1 on failure.
    std::size_t purgeSessions()
    {
        std::vector<std::shared_ptr<ChildSession>> deadSessions;
        std::size_t num_sessions = 0;
        {
            std::unique_lock<std::mutex> lock(_mutex, std::defer_lock);
            if (!lock.try_lock())
            {
                // Not a good time, try later.
                return -1;
            }

            // If there are no live sessions, we don't need to do anything at all and can just
            // bluntly exit, no need to clean up our own data structures. Also, there is a bug that
            // causes the deadSessions.clear() call below to crash in some situations when the last
            // session is being removed.
            for (auto it = _sessions.cbegin(); it != _sessions.cend(); )
            {
                if (it->second->isCloseFrame())
                {
                    deadSessions.push_back(it->second);
                    it = _sessions.erase(it);
                }
                else
                {
                    ++it;
                }
            }

            num_sessions = _sessions.size();
#if !MOBILEAPP
            if (num_sessions == 0)
            {
                LOG_FTL("Document [" << anonymizeUrl(_url) << "] has no more views, exiting bluntly.");
                Log::shutdown();
                std::_Exit(EX_OK);
            }
#endif
        }

        // Don't destroy sessions while holding our lock.
        // We may deadlock if a session is waiting on us
        // during callback initiated while handling a command
        // and the dtor tries to take its lock (which is taken).
        deadSessions.clear();

        return num_sessions;
    }

    /// Set Document password for given URL
    void setDocumentPassword(int passwordType)
    {
        LOG_INF("setDocumentPassword: passwordProtected=" << _isDocPasswordProtected <<
                " passwordProvided=" << _haveDocPassword <<
                " password='" << _docPassword << '\'');

        if (_isDocPasswordProtected && _haveDocPassword)
        {
            // it means this is the second attempt with the wrong password; abort the load operation
            _loKit->setDocumentPassword(_jailedUrl.c_str(), nullptr);
            return;
        }

        // One thing for sure, this is a password protected document
        _isDocPasswordProtected = true;
        if (passwordType == LOK_CALLBACK_DOCUMENT_PASSWORD)
            _docPasswordType = PasswordType::ToView;
        else if (passwordType == LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY)
            _docPasswordType = PasswordType::ToModify;

        LOG_INF("Calling _loKit->setDocumentPassword");
        if (_haveDocPassword)
            _loKit->setDocumentPassword(_jailedUrl.c_str(), _docPassword.c_str());
        else
            _loKit->setDocumentPassword(_jailedUrl.c_str(), nullptr);
        LOG_INF("setDocumentPassword returned");
    }

    void renderTile(const StringVector& tokens)
    {
        TileCombined tileCombined(TileDesc::parse(tokens));
        renderTiles(tileCombined, false);
    }

    void renderCombinedTiles(const StringVector& tokens)
    {
        TileCombined tileCombined = TileCombined::parse(tokens);
        renderTiles(tileCombined, true);
    }

    void renderTiles(TileCombined &tileCombined, bool combined)
    {
        // Find a session matching our view / render settings.
        const auto session = _sessions.findByCanonicalId(tileCombined.getNormalizedViewId());
        if (!session)
        {
            LOG_ERR("Session is not found. Maybe exited after rendering request.");
            return;
        }

        if (!_loKitDocument)
        {
            LOG_ERR("Tile rendering requested before loading document.");
            return;
        }

        if (_loKitDocument->getViewsCount() <= 0)
        {
            LOG_ERR("Tile rendering requested without views.");
            return;
        }

#ifdef FIXME_RENDER_SETTINGS
        // if necessary select a suitable rendering view eg. with 'show non-printing chars'
        if (tileCombined.getNormalizedViewId())
            _loKitDocument->setView(session->getViewId());
#endif

        const auto blenderFunc = [&](unsigned char* data, int offsetX, int offsetY,
                                     std::size_t pixmapWidth, std::size_t pixmapHeight,
                                     int pixelWidth, int pixelHeight, LibreOfficeKitTileMode mode) {
            if (session->watermark())
                session->watermark()->blending(data, offsetX, offsetY, pixmapWidth, pixmapHeight,
                                               pixelWidth, pixelHeight, mode);
        };

        const auto postMessageFunc = [&](const char* buffer, std::size_t length) {
            postMessage(buffer, length, WSOpCode::Binary);
        };

        if (!RenderTiles::doRender(_loKitDocument, tileCombined, _pngCache, _pngPool, combined,
                                   blenderFunc, postMessageFunc))
        {
            LOG_DBG("All tiles skipped, not producing empty tilecombine: message");
            return;
        }
    }

    bool sendTextFrame(const std::string& message)
    {
        return sendFrame(message.data(), message.size());
    }

    bool sendFrame(const char* buffer, int length, WSOpCode opCode = WSOpCode::Text) override
    {
        try
        {
            return postMessage(buffer, length, opCode);
        }
        catch (const Exception& exc)
        {
            LOG_ERR("Document::sendFrame: Exception: " << exc.displayText() <<
                    (exc.nested() ? "( " + exc.nested()->displayText() + ')' : ""));
        }

        return false;
    }

    void alertAllUsers(const std::string& cmd, const std::string& kind) override
    {
        alertAllUsers("errortoall: cmd=" + cmd + " kind=" + kind);
    }

    unsigned getMobileAppDocId() const override
    {
        return _mobileAppDocId;
    }

    static void GlobalCallback(const int type, const char* p, void* data)
    {
        if (SigUtil::getTerminationFlag())
        {
            return;
        }

        const std::string payload = p ? p : "(nil)";
        LOG_TRC("Document::GlobalCallback " << lokCallbackTypeToString(type) <<
                " [" << payload << "].");
        Document* self = static_cast<Document*>(data);
        if (type == LOK_CALLBACK_DOCUMENT_PASSWORD_TO_MODIFY ||
            type == LOK_CALLBACK_DOCUMENT_PASSWORD)
        {
            // Mark the document password type.
            self->setDocumentPassword(type);
            return;
        }
        else if (type == LOK_CALLBACK_STATUS_INDICATOR_SET_VALUE)
        {
            for (auto& it : self->_sessions)
            {
                std::shared_ptr<ChildSession> session = it.second;
                if (session && !session->isCloseFrame())
                {
                    session->loKitCallback(type, payload);
                }
            }
            return;
        }
        else if (type == LOK_CALLBACK_PROFILE_FRAME)
            return; // already trace dumped above.

        // Broadcast leftover status indicator callbacks to all clients
        self->broadcastCallbackToClients(type, payload);
    }

    static void ViewCallback(const int type, const char* p, void* data)
    {
        if (SigUtil::getTerminationFlag())
        {
            return;
        }

        CallbackDescriptor* descriptor = static_cast<CallbackDescriptor*>(data);
        assert(descriptor && "Null callback data.");
        assert(descriptor->getDoc() && "Null Document instance.");

        std::shared_ptr<TileQueue> tileQueue = descriptor->getDoc()->getTileQueue();
        assert(tileQueue && "Null TileQueue.");

        const std::string payload = p ? p : "(nil)";
        LOG_TRC("Document::ViewCallback [" << descriptor->getViewId() <<
                "] [" << lokCallbackTypeToString(type) <<
                "] [" << payload << "].");

        // when we examine the content of the JSON
        std::string targetViewId;

        if (type == LOK_CALLBACK_CELL_CURSOR)
        {
            StringVector tokens(Util::tokenize(payload, ','));
            // Payload may be 'EMPTY'.
            if (tokens.size() == 4)
            {
                int cursorX = std::stoi(tokens[0]);
                int cursorY = std::stoi(tokens[1]);
                int cursorWidth = std::stoi(tokens[2]);
                int cursorHeight = std::stoi(tokens[3]);

                tileQueue->updateCursorPosition(0, 0, cursorX, cursorY, cursorWidth, cursorHeight);
            }
        }
        else if (type == LOK_CALLBACK_INVALIDATE_VISIBLE_CURSOR)
        {
            Poco::JSON::Parser parser;
            const Poco::Dynamic::Var result = parser.parse(payload);
            const auto& command = result.extract<Poco::JSON::Object::Ptr>();
            std::string rectangle = command->get("rectangle").toString();
            StringVector tokens(Util::tokenize(rectangle, ','));
            // Payload may be 'EMPTY'.
            if (tokens.size() == 4)
            {
                int cursorX = std::stoi(tokens[0]);
                int cursorY = std::stoi(tokens[1]);
                int cursorWidth = std::stoi(tokens[2]);
                int cursorHeight = std::stoi(tokens[3]);

                tileQueue->updateCursorPosition(0, 0, cursorX, cursorY, cursorWidth, cursorHeight);
            }
        }
        else if (type == LOK_CALLBACK_INVALIDATE_VIEW_CURSOR ||
                 type == LOK_CALLBACK_CELL_VIEW_CURSOR)
        {
            Poco::JSON::Parser parser;
            const Poco::Dynamic::Var result = parser.parse(payload);
            const auto& command = result.extract<Poco::JSON::Object::Ptr>();
            targetViewId = command->get("viewId").toString();
            std::string part = command->get("part").toString();
            std::string text = command->get("rectangle").toString();
            StringVector tokens(Util::tokenize(text, ','));
            // Payload may be 'EMPTY'.
            if (tokens.size() == 4)
            {
                int cursorX = std::stoi(tokens[0]);
                int cursorY = std::stoi(tokens[1]);
                int cursorWidth = std::stoi(tokens[2]);
                int cursorHeight = std::stoi(tokens[3]);

                tileQueue->updateCursorPosition(std::stoi(targetViewId), std::stoi(part), cursorX, cursorY, cursorWidth, cursorHeight);
            }
        }

        // merge various callback types together if possible
        if (type == LOK_CALLBACK_INVALIDATE_TILES ||
            type == LOK_CALLBACK_DOCUMENT_SIZE_CHANGED)
        {
            // no point in handling invalidations or page resizes per-view,
            // all views have to be in sync
            tileQueue->put("callback all " + std::to_string(type) + ' ' + payload);
        }
        else
            tileQueue->put("callback " + std::to_string(descriptor->getViewId()) + ' ' + std::to_string(type) + ' ' + payload);

        LOG_TRC("Document::ViewCallback end.");
    }

private:

    /// Helper method to broadcast callback and its payload to all clients
    void broadcastCallbackToClients(const int type, const std::string& payload)
    {
        _tileQueue->put("callback all " + std::to_string(type) + ' ' + payload);
    }

    /// Load a document (or view) and register callbacks.
    bool onLoad(const std::string& sessionId,
                const std::string& uriAnonym,
                const std::string& renderOpts,
                const std::string& docTemplate) override
    {
        std::unique_lock<std::mutex> lock(_mutex);

        LOG_INF("Loading url [" << uriAnonym << "] for session [" << sessionId <<
                "] which has " << (_sessions.size() - 1) <<
                " sessions. Another load in progress: " << _isLoading);

        while (_isLoading)
            _cvLoading.wait(lock);

        // This shouldn't happen, but for sanity.
        const auto it = _sessions.find(sessionId);
        if (it == _sessions.end() || !it->second)
        {
            LOG_ERR("Cannot find session [" << sessionId << "] to load view for.");
            return false;
        }

        std::shared_ptr<ChildSession> session = it->second;

        // Flag and release lock.
        ++_isLoading;

        Util::ScopeGuard g([this]() {
            // Not loading.
            --_isLoading;
            _cvLoading.notify_one();
        });

        lock.unlock();

        try
        {
            if (!load(session, renderOpts, docTemplate))
                return false;
        }
        catch (const std::exception &exc)
        {
            LOG_ERR("Exception while loading url [" << uriAnonym <<
                    "] for session [" << sessionId << "]: " << exc.what());
            return false;
        }

        return true;
    }

    void onUnload(const ChildSession& session) override
    {
        const auto& sessionId = session.getId();
        LOG_INF("Unloading session [" << sessionId << "] on url [" << anonymizeUrl(_url) << "].");

        const int viewId = session.getViewId();
        _tileQueue->removeCursorPosition(viewId);

        if (_loKitDocument == nullptr)
        {
            LOG_ERR("Unloading session [" << sessionId << "] without loKitDocument.");
            return;
        }

        _loKitDocument->setView(viewId);
        _loKitDocument->registerCallback(nullptr, nullptr);
        _loKit->registerCallback(nullptr, nullptr);

        int viewCount = _loKitDocument->getViewsCount();
        if (viewCount == 1)
        {
            std::unique_lock<std::mutex> lock(_mutex);
#if !MOBILEAPP
            if (_sessions.empty())
            {
                LOG_INF("Document [" << anonymizeUrl(_url) << "] has no more views, exiting bluntly.");
                Log::shutdown();
                std::_Exit(EX_OK);
            }
#endif
            LOG_INF("Document [" << anonymizeUrl(_url) << "] has no more views, but has " <<
                    _sessions.size() << " sessions still. Destroying the document.");
#ifdef __ANDROID__
            _loKitDocumentForAndroidOnly.reset();
#endif
            _loKitDocument.reset();
            LOG_INF("Document [" << anonymizeUrl(_url) << "] session [" << sessionId << "] unloaded Document.");
            return;
        }
        else
        {
            _loKitDocument->destroyView(viewId);
        }

        // Since callback messages are processed on idle-timer,
        // we could receive callbacks after destroying a view.
        // Retain the CallbackDescriptor object, which is shared with Core.
        // _viewIdToCallbackDescr.erase(viewId);

        viewCount = _loKitDocument->getViewsCount();
        LOG_INF("Document [" << anonymizeUrl(_url) << "] session [" <<
                sessionId << "] unloaded view [" << viewId << "]. Have " <<
                viewCount << " view" << (viewCount != 1 ? "s." : "."));

        if (viewCount > 0)
        {
            // Broadcast updated view info
            notifyViewInfo();
        }
    }

    std::map<int, UserInfo> getViewInfo() override
    {
        std::unique_lock<std::mutex> lock(_mutex);

        return _sessionUserInfo;
    }

    std::mutex& getMutex() override
    {
        return _mutex;
    }

    std::shared_ptr<TileQueue>& getTileQueue() override
    {
        return _tileQueue;
    }

    int getEditorId() const override
    {
        return _editorId;
    }

    /// Notify all views with the given message
    bool notifyAll(const std::string& msg) override
    {
        // Broadcast updated viewinfo to all clients.
        return sendTextFrame("client-all " + msg);
    }

    /// Notify all views of viewId and their associated usernames
    void notifyViewInfo() override
    {
        // Get the list of view ids from the core
        const int viewCount = getLOKitDocument()->getViewsCount();
        std::vector<int> viewIds(viewCount);
        getLOKitDocument()->getViewIds(viewIds.data(), viewCount);

        const std::map<int, UserInfo> viewInfoMap = _sessionUserInfo;

        const std::map<std::string, int> viewColorsMap = getViewColors();

        // Double check if list of viewids from core and our list matches,
        // and create an array of JSON objects containing id and username
        std::ostringstream oss;
        oss << "viewinfo: [";
        for (const auto& viewId : viewIds)
        {
            oss << "{\"id\":" << viewId << ',';
            int color = 0;
            const auto itView = viewInfoMap.find(viewId);
            if (itView == viewInfoMap.end())
            {
                LOG_ERR("No username found for viewId [" << viewId << "].");
                oss << "\"username\":\"Unknown\",";
            }
            else
            {
                oss << "\"userid\":\"" << itView->second.getUserId() << "\",";
                const std::string username = itView->second.getUserName();
                oss << "\"username\":\"" << username << "\",";
                if (!itView->second.getUserExtraInfo().empty())
                    oss << "\"userextrainfo\":" << itView->second.getUserExtraInfo() << ',';
                const bool readonly = itView->second.isReadOnly();
                oss << "\"readonly\":\"" << readonly << "\",";
                const auto it = viewColorsMap.find(username);
                if (it != viewColorsMap.end())
                {
                    color = it->second;
                }
            }

            oss << "\"color\":" << color << "},";
        }

        if (viewCount > 0)
            oss.seekp(-1, std::ios_base::cur); // Remove last comma.
        oss << ']';

        // Broadcast updated viewinfo to all clients.
        notifyAll(oss.str());
    }

    void updateEditorSpeeds(int id, int speed) override
    {
        int maxSpeed = -1, fastestUser = -1;

        auto now = std::chrono::steady_clock::now();
        _lastUpdatedAt[id] = now;
        _speedCount[id] = speed;

        for (const auto& it : _sessions)
        {
            const std::shared_ptr<ChildSession> session = it.second;
            int sessionId = session->getViewId();

            auto duration = (_lastUpdatedAt[id] - now);
            std::chrono::milliseconds::rep durationInMs = std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
            if (_speedCount[sessionId] != 0 && durationInMs > 5000)
            {
                _speedCount[sessionId] = session->getSpeed();
                _lastUpdatedAt[sessionId] = now;
            }
            if (_speedCount[sessionId] > maxSpeed)
            {
                maxSpeed = _speedCount[sessionId];
                fastestUser = sessionId;
            }
        }
        // 0 for preventing selection of the first always
        // 1 for preventing new users from directly becoming editors
        if (_editorId != fastestUser && (maxSpeed != 0 && maxSpeed != 1)) {
            if (!_editorChangeWarning && _editorId != -1)
            {
                _editorChangeWarning = true;
            }
            else
            {
                _editorChangeWarning = false;
                _editorId = fastestUser;
                for (const auto& it : _sessions)
                    it.second->sendTextFrame("editor: " + std::to_string(_editorId));
            }
        }
        else
            _editorChangeWarning = false;
    }

private:

    // Get the color value for all author names from the core
    std::map<std::string, int> getViewColors()
    {
        char* values = _loKitDocument->getCommandValues(".uno:TrackedChangeAuthors");
        const std::string colorValues = std::string(values == nullptr ? "" : values);
        std::free(values);

        std::map<std::string, int> viewColors;
        try
        {
            if (!colorValues.empty())
            {
                Poco::JSON::Parser parser;
                Poco::JSON::Object::Ptr root = parser.parse(colorValues).extract<Poco::JSON::Object::Ptr>();
                if (root->get("authors").type() == typeid(Poco::JSON::Array::Ptr))
                {
                    Poco::JSON::Array::Ptr authorsArray = root->get("authors").extract<Poco::JSON::Array::Ptr>();
                    for (auto& authorVar: *authorsArray)
                    {
                        Poco::JSON::Object::Ptr authorObj = authorVar.extract<Poco::JSON::Object::Ptr>();
                        std::string authorName = authorObj->get("name").convert<std::string>();
                        int colorValue = authorObj->get("color").convert<int>();
                        viewColors[authorName] = colorValue;
                    }
                }
            }
        }
        catch(const Exception& exc)
        {
            LOG_ERR("Poco Exception: " << exc.displayText() <<
                    (exc.nested() ? " (" + exc.nested()->displayText() + ')' : ""));
        }

        return viewColors;
    }

    std::shared_ptr<lok::Document> load(const std::shared_ptr<ChildSession>& session,
                                        const std::string& renderOpts,
                                        const std::string& docTemplate)
    {
        const std::string sessionId = session->getId();

        const std::string& uri = session->getJailedFilePath();
        const std::string& uriAnonym = session->getJailedFilePathAnonym();
        const std::string& userName = session->getUserName();
        const std::string& userNameAnonym = session->getUserNameAnonym();
        const std::string& docPassword = session->getDocPassword();
        const bool haveDocPassword = session->getHaveDocPassword();
        const std::string& lang = session->getLang();
        const std::string& deviceFormFactor = session->getDeviceFormFactor();
        std::string spellOnline;

        std::string options;
        if (!lang.empty())
            options = "Language=" + lang;

        if (!deviceFormFactor.empty())
            options += ",DeviceFormFactor=" + deviceFormFactor;

        if (!_loKitDocument)
        {
            // This is the first time we are loading the document
            LOG_INF("Loading new document from URI: [" << uriAnonym << "] for session [" << sessionId << "].");

            _loKit->registerCallback(GlobalCallback, this);

            const int flags = LOK_FEATURE_DOCUMENT_PASSWORD
                             | LOK_FEATURE_DOCUMENT_PASSWORD_TO_MODIFY
                             | LOK_FEATURE_PART_IN_INVALIDATION_CALLBACK
                             | LOK_FEATURE_NO_TILED_ANNOTATIONS
                             | LOK_FEATURE_RANGE_HEADERS
                             | LOK_FEATURE_VIEWID_IN_VISCURSOR_INVALIDATION_CALLBACK;
            _loKit->setOptionalFeatures(flags);

            // Save the provided password with us and the jailed url
            _haveDocPassword = haveDocPassword;
            _docPassword = docPassword;
            _jailedUrl = uri;
            _isDocPasswordProtected = false;

            const char *pURL = docTemplate.empty() ? uri.c_str() : docTemplate.c_str();
            LOG_DBG("Calling lokit::documentLoad(" << FileUtil::anonymizeUrl(pURL) << ", \"" << options << "\").");
            const auto start = std::chrono::steady_clock::now();
            _loKitDocument.reset(_loKit->documentLoad(pURL, options.c_str()));
#ifdef __ANDROID__
            _loKitDocumentForAndroidOnly = _loKitDocument;
#endif
            const auto duration = std::chrono::steady_clock::now() - start;
            const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
            LOG_DBG("Returned lokit::documentLoad(" << FileUtil::anonymizeUrl(pURL) << ") in "
                                                    << elapsed);
#ifdef IOS
            getDocumentDataForMobileAppDocId(_mobileAppDocId).loKitDocument = _loKitDocument.get();
#endif
            if (!_loKitDocument || !_loKitDocument->get())
            {
                LOG_ERR("Failed to load: " << uriAnonym << ", error: " << _loKit->getError());

                // Checking if wrong password or no password was reason for failure.
                if (_isDocPasswordProtected)
                {
                    LOG_INF("Document [" << uriAnonym << "] is password protected.");
                    if (!_haveDocPassword)
                    {
                        LOG_INF("No password provided for password-protected document [" << uriAnonym << "].");
                        std::string passwordFrame = "passwordrequired:";
                        if (_docPasswordType == PasswordType::ToView)
                            passwordFrame += "to-view";
                        else if (_docPasswordType == PasswordType::ToModify)
                            passwordFrame += "to-modify";
                        session->sendTextFrameAndLogError("error: cmd=load kind=" + passwordFrame);
                    }
                    else
                    {
                        LOG_INF("Wrong password for password-protected document [" << uriAnonym << "].");
                        session->sendTextFrameAndLogError("error: cmd=load kind=wrongpassword");
                    }
                    return nullptr;
                }

                session->sendTextFrameAndLogError("error: cmd=load kind=faileddocloading");
                return nullptr;
            }

            // Only save the options on opening the document.
            // No support for changing them after opening a document.
            _renderOpts = renderOpts;
            spellOnline = session->getSpellOnline();
        }
        else
        {
            LOG_INF("Document with url [" << uriAnonym << "] already loaded. Need to create new view for session [" << sessionId << "].");

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
                    session->sendTextFrameAndLogError("error: cmd=load kind=" + passwordFrame);
                    return nullptr;
                }
                else if (docPassword != _docPassword)
                {
                    session->sendTextFrameAndLogError("error: cmd=load kind=wrongpassword");
                    return nullptr;
                }
            }

            LOG_INF("Creating view to url [" << uriAnonym << "] for session [" << sessionId << "] with " << options << '.');
            _loKitDocument->createView(options.c_str());
            LOG_TRC("View to url [" << uriAnonym << "] created.");
        }

        LOG_INF("Initializing for rendering session [" << sessionId << "] on document url [" <<
                anonymizeUrl(_url) << "] with: [" << makeRenderParams(_renderOpts, userNameAnonym, spellOnline) << "].");

        // initializeForRendering() should be called before
        // registerCallback(), as the previous creates a new view in Impress.
        const std::string renderParams = makeRenderParams(_renderOpts, userName, spellOnline);

        _loKitDocument->initializeForRendering(renderParams.c_str());

        const int viewId = _loKitDocument->getView();
        session->setViewId(viewId);

        _sessionUserInfo[viewId] = UserInfo(session->getViewUserId(), session->getViewUserName(),
                                            session->getViewUserExtraInfo(), session->isReadOnly());

        _loKitDocument->setViewLanguage(viewId, lang.c_str());

        _viewIdToCallbackDescr.emplace(viewId,
                                       std::unique_ptr<CallbackDescriptor>(new CallbackDescriptor({ this, viewId })));
        _loKitDocument->registerCallback(ViewCallback, _viewIdToCallbackDescr[viewId].get());

        const int viewCount = _loKitDocument->getViewsCount();
        LOG_INF("Document url [" << anonymizeUrl(_url) << "] for session [" <<
                sessionId << "] loaded view [" << viewId << "]. Have " <<
                viewCount << " view" << (viewCount != 1 ? "s." : "."));

        session->initWatermark();

        return _loKitDocument;
    }

    bool forwardToChild(const std::string& prefix, const std::vector<char>& payload)
    {
        assert(payload.size() > prefix.size());

        // Remove the prefix and trim.
        std::size_t index = prefix.size();
        for ( ; index < payload.size(); ++index)
        {
            if (payload[index] != ' ')
            {
                break;
            }
        }

        const char* data = payload.data() + index;
        std::size_t size = payload.size() - index;

        std::string name;
        std::string sessionId;
        if (LOOLProtocol::parseNameValuePair(prefix, name, sessionId, '-') && name == "child")
        {
            std::unique_lock<std::mutex> lock(_mutex);

            const auto it = _sessions.find(sessionId);
            if (it != _sessions.end())
            {
                std::shared_ptr<ChildSession> session = it->second;

                static const std::string disconnect("disconnect");
                if (size == disconnect.size() &&
                    strncmp(data, disconnect.data(), disconnect.size()) == 0)
                {
                    if(session->getViewId() == _editorId) {
                        _editorId = -1;
                    }
                    LOG_DBG("Removing ChildSession [" << sessionId << "].");

                    // Tell them we're going quietly.
                    session->sendTextFrame("disconnected:");

                    _sessions.erase(it);
                    const std::size_t count = _sessions.size();
                    LOG_DBG("Have " << count << " child" << (count == 1 ? "" : "ren") <<
                            " after removing ChildSession [" << sessionId << "].");

                    // No longer needed, and allow session dtor to take it.
                    lock.unlock();
                    session.reset();
                    return true;
                }

                // No longer needed, and allow the handler to take it.
                lock.unlock();
                if (session)
                {
                    std::vector<char> vect(size);
                    vect.assign(data, data + size);

                    // TODO this is probably wrong...
                    session->handleMessage(vect);
                    return true;
                }
            }

            const std::string abbrMessage = getAbbreviatedMessage(data, size);
            LOG_WRN("Child session [" << sessionId << "] not found to forward message: " << abbrMessage);
        }
        else
        {
            LOG_ERR("Failed to parse prefix of forward-to-child message: " << prefix);
        }

        return false;
    }

    template <typename T>
    static Object::Ptr makePropertyValue(const std::string& type, const T& val)
    {
        Object::Ptr obj = new Object();
        obj->set("type", type);
        obj->set("value", val);
        return obj;
    }

    static std::string makeRenderParams(const std::string& renderOpts, const std::string& userName, const std::string& spellOnline)
    {
        Object::Ptr renderOptsObj;

        // Fill the object with renderoptions, if any
        if (!renderOpts.empty())
        {
            Parser parser;
            Poco::Dynamic::Var var = parser.parse(renderOpts);
            renderOptsObj = var.extract<Object::Ptr>();
        }
        else if (!userName.empty())
        {
            renderOptsObj = new Object();
        }

        // Append name of the user, if any, who opened the document to rendering options
        if (!userName.empty())
        {
            // userName must be decoded already.
            renderOptsObj->set(".uno:Author", makePropertyValue("string", userName));
        }

        if (!spellOnline.empty())
        {
            bool bSet = (spellOnline != "false");
            renderOptsObj->set(".uno:SpellOnline", makePropertyValue("boolean", bSet));
        }

        if (renderOptsObj)
        {
            std::ostringstream ossRenderOpts;
            renderOptsObj->stringify(ossRenderOpts);
            return ossRenderOpts.str();
        }

        return std::string();
    }

public:
    void enableProcessInput(bool enable = true){ _inputProcessingEnabled = enable; }
    bool processInputEnabled() const { return _inputProcessingEnabled; }

    bool hasQueueItems() const
    {
        return _tileQueue && !_tileQueue->isEmpty();
    }

    void drainQueue(const std::chrono::steady_clock::time_point &/*now*/)
    {
        try
        {
            while (processInputEnabled() && hasQueueItems())
            {
                if (_stop || SigUtil::getTerminationFlag())
                {
                    LOG_INF("_stop or TerminationFlag is set, breaking Document::drainQueue of loop");
                    break;
                }

                const TileQueue::Payload input = _tileQueue->pop();

                LOG_TRC("Kit handling queue message: " << LOOLProtocol::getAbbreviatedMessage(input));

                const StringVector tokens = Util::tokenize(input.data(), input.size());

                if (tokens.equals(0, "eof"))
                {
                    LOG_INF("Received EOF. Finishing.");
                    break;
                }

                if (tokens.equals(0, "tile"))
                {
                    renderTile(tokens);
                }
                else if (tokens.equals(0, "tilecombine"))
                {
                    renderCombinedTiles(tokens);
                }
                else if (LOOLProtocol::getFirstToken(tokens[0], '-') == "child")
                {
                    forwardToChild(tokens[0], input);
                }
                else if (tokens.equals(0, "callback"))
                {
                    if (tokens.size() >= 3)
                    {
                        bool broadcast = false;
                        int viewId = -1;
                        int exceptViewId = -1;

                        const std::string& target = tokens[1];
                        if (target == "all")
                        {
                            broadcast = true;
                        }
                        else if (LOOLProtocol::matchPrefix("except-", target))
                        {
                            exceptViewId = std::stoi(target.substr(7));
                            broadcast = true;
                        }
                        else
                        {
                            viewId = std::stoi(target);
                        }

                        const int type = std::stoi(tokens[2]);

                        // payload is the rest of the message
                        const std::size_t offset = tokens[0].length() + tokens[1].length()
                                                   + tokens[2].length() + 3; // + delims
                        const std::string payload(input.data() + offset, input.size() - offset);

                        // Forward the callback to the same view, demultiplexing is done by the LibreOffice core.
                        // TODO: replace with a map to be faster.
                        bool isFound = false;
                        for (auto& it : _sessions)
                        {
                            std::shared_ptr<ChildSession> session = it.second;
                            if (session && ((broadcast && (session->getViewId() != exceptViewId)) || (!broadcast && (session->getViewId() == viewId))))
                            {
                                if (!it.second->isCloseFrame())
                                {
                                    isFound = true;
                                    session->loKitCallback(type, payload);
                                }
                                else
                                {
                                    LOG_ERR("Session-thread of session [" << session->getId() << "] for view [" <<
                                            viewId << "] is not running. Dropping [" << lokCallbackTypeToString(type) <<
                                            "] payload [" << payload << "].");
                                }

                                if (!broadcast)
                                {
                                    break;
                                }
                            }
                        }

                        if (!isFound)
                        {
                            LOG_WRN("Document::ViewCallback. Session [" << viewId <<
                                    "] is no longer active to process [" << lokCallbackTypeToString(type) <<
                                    "] [" << payload << "] message to Master Session.");
                        }
                    }
                    else
                    {
                        LOG_ERR("Invalid callback message: [" << LOOLProtocol::getAbbreviatedMessage(input) << "].");
                    }
                }
                else
                {
                    LOG_ERR("Unexpected request: [" << LOOLProtocol::getAbbreviatedMessage(input) << "].");
                }
            }

        }
        catch (const std::exception& exc)
        {
            LOG_FTL("drainQueue: Exception: " << exc.what());
#if !MOBILEAPP
            Log::shutdown();
            std::_Exit(EX_SOFTWARE);
#endif
        }
        catch (...)
        {
            LOG_FTL("drainQueue: Unknown exception");
#if !MOBILEAPP
            Log::shutdown();
            std::_Exit(EX_SOFTWARE);
#endif
        }
    }

private:
    /// Return access to the lok::Office instance.
    std::shared_ptr<lok::Office> getLOKit() override
    {
        return _loKit;
    }

    /// Return access to the lok::Document instance.
    std::shared_ptr<lok::Document> getLOKitDocument() override
    {
        if (!_loKitDocument)
        {
            LOG_ERR("Document [" << _docKey << "] is not loaded.");
            throw std::runtime_error("Document " + _docKey + " is not loaded.");
        }

        return _loKitDocument;
    }

    std::string getObfuscatedFileId() override
    {
        return _obfuscatedFileId;
    }

    void alertAllUsers(const std::string& msg)
    {
        sendTextFrame(msg);
    }

public:
    void dumpState(std::ostream& oss)
    {
        oss << "Kit Document:\n"
            << "\n\tstop: " << _stop
            << "\n\tisLoading: " << _isLoading
            << "\n\tjailId: " << _jailId
            << "\n\tdocKey: " << _docKey
            << "\n\tdocId: " << _docId
            << "\n\turl: " << _url
            << "\n\tobfuscatedFileId: " << _obfuscatedFileId
            << "\n\tjailedUrl: " << _jailedUrl
            << "\n\trenderOpts: " << _renderOpts
            << "\n\thaveDocPassword: " << _haveDocPassword // not the pwd itself
            << "\n\tisDocPasswordProtected: " << _isDocPasswordProtected
            << "\n\tdocPasswordType: " << (int)_docPasswordType
            << "\n\teditorId: " << _editorId
            << "\n\teditorChangeWarning: " << _editorChangeWarning
            << "\n";

        // dumpState:
        // TODO: _websocketHandler - but this is an odd one.
        // TODO: std::shared_ptr<TileQueue> _tileQueue;
        // TODO: PngCache _pngCache;
        // TODO: std::map<int, std::unique_ptr<CallbackDescriptor>> _viewIdToCallbackDescr;
        // ThreadPool _pngPool;

        _sessions.dumpState(oss);

        // TODO: std::map<int, std::chrono::steady_clock::time_point> _lastUpdatedAt;
        // TODO: std::map<int, int> _speedCount;

        /// For showing disconnected user info in the doc repair dialog.
        // TODO: std::map<int, UserInfo> _sessionUserInfo;
        // TODO: std::chrono::steady_clock::time_point _lastMemStatsTime;
    }

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

    PngCache _pngCache;

    // Document password provided
    std::string _docPassword;
    // Whether password was provided or not
    bool _haveDocPassword;
    // Whether document is password protected
    bool _isDocPasswordProtected;
    // Whether password is required to view the document, or modify it
    PasswordType _docPasswordType;

    std::atomic<bool> _stop;
    mutable std::mutex _mutex;

    ThreadPool _pngPool;

    std::condition_variable _cvLoading;
    std::atomic_size_t _isLoading;
    int _editorId;
    bool _editorChangeWarning;
    std::map<int, std::unique_ptr<CallbackDescriptor>> _viewIdToCallbackDescr;
    SessionMap<ChildSession> _sessions;

    std::map<int, std::chrono::steady_clock::time_point> _lastUpdatedAt;
    std::map<int, int> _speedCount;
    /// For showing disconnected user info in the doc repair dialog.
    std::map<int, UserInfo> _sessionUserInfo;
    std::chrono::steady_clock::time_point _lastMemStatsTime;
#ifdef __ANDROID__
    friend std::shared_ptr<lok::Document> getLOKDocumentForAndroidOnly();
#endif

    const unsigned _mobileAppDocId;
    bool _inputProcessingEnabled;
};

#ifdef __ANDROID__

std::shared_ptr<lok::Document> Document::_loKitDocumentForAndroidOnly = std::shared_ptr<lok::Document>();

std::shared_ptr<lok::Document> getLOKDocumentForAndroidOnly()
{
    return Document::_loKitDocumentForAndroidOnly;
}

#endif

class KitSocketPoll final : public SocketPoll
{
    std::chrono::steady_clock::time_point _pollEnd;
    std::shared_ptr<Document> _document;

    static KitSocketPoll *mainPoll;

    KitSocketPoll() :
        SocketPoll("kit")
    {
#ifdef IOS
        terminationFlag = false;
#endif
        mainPoll = this;
    }

public:
    ~KitSocketPoll()
    {
        // Just to make it easier to set a breakpoint
        mainPoll = nullptr;
    }

    static void dumpGlobalState(std::ostream &oss)
    {
        if (mainPoll)
        {
            if (!mainPoll->_document)
                oss << "KitSocketPoll: no doc\n";
            else
            {
                mainPoll->_document->dumpState(oss);
                mainPoll->dumpState(oss);
            }
        }
        else
            oss << "KitSocketPoll: none\n";
    }

    static std::shared_ptr<KitSocketPoll> create()
    {
        KitSocketPoll *p = new KitSocketPoll();
        auto result = std::shared_ptr<KitSocketPoll>(p);

#ifdef IOS
        std::unique_lock<std::mutex> lock(KSPollsMutex);
        KSPolls.push_back(result);
#endif
        return result;
    }

    // process pending message-queue events.
    void drainQueue(const std::chrono::steady_clock::time_point &now)
    {
        SigUtil::checkDumpGlobalState(dump_kit_state);

        if (_document)
            _document->drainQueue(now);
    }

    // called from inside poll, inside a wakeup
    void wakeupHook()
    {
        _pollEnd = std::chrono::steady_clock::now();
    }

    // a LOK compatible poll function merging the functions.
    // returns the number of events signalled
    int kitPoll(int timeoutMicroS)
    {
        if (SigUtil::getTerminationFlag())
        {
            LOG_TRC("Termination of unipoll mainloop flagged");
            return -1;
        }

        // The maximum number of extra events to process beyond the first.
        int maxExtraEvents = 15;
        int eventsSignalled = 0;

        if (timeoutMicroS < 0)
        {
            // Flush at most 1 + maxExtraEvents, or return when nothing left.
            while (poll(0) > 0 && maxExtraEvents-- > 0)
                ++eventsSignalled;
        }
        else
        {
            // Flush at most maxEvents+1, or return when nothing left.
            _pollEnd = std::chrono::steady_clock::now() + std::chrono::microseconds(timeoutMicroS);
            do
            {
                int realTimeout = timeoutMicroS;
                if (_document && _document->hasQueueItems())
                    realTimeout = 0;
                if (poll(realTimeout) <= 0)
                    break;

                const auto now = std::chrono::steady_clock::now();
                drainQueue(now);

                timeoutMicroS = std::chrono::duration_cast<std::chrono::microseconds>(_pollEnd - now).count();
                ++eventsSignalled;
            }
            while (timeoutMicroS > 0 && !SigUtil::getTerminationFlag() && maxExtraEvents-- > 0);
        }

        drainQueue(std::chrono::steady_clock::now());

#if !MOBILEAPP
        if (_document && _document->purgeSessions() == 0)
        {
            LOG_INF("Last session discarded. Setting TerminationFlag");
            SigUtil::setTerminationFlag();
            return -1;
        }
#endif
        // Report the number of events we processed.
        return eventsSignalled;
    }

    void setDocument(std::shared_ptr<Document> document)
    {
        _document = std::move(document);
    }

#ifdef IOS
    static std::mutex KSPollsMutex;
    // static std::condition_variable KSPollsCV;
    static std::vector<std::weak_ptr<KitSocketPoll>> KSPolls;

    std::mutex terminationMutex;
    std::condition_variable terminationCV;
    bool terminationFlag;
#endif
};

KitSocketPoll *KitSocketPoll::mainPoll = nullptr;

#ifdef IOS

std::mutex KitSocketPoll::KSPollsMutex;
// std::condition_variable KitSocketPoll::KSPollsCV;
std::vector<std::weak_ptr<KitSocketPoll>> KitSocketPoll::KSPolls;

#endif

class KitWebSocketHandler final : public WebSocketHandler
{
    std::shared_ptr<TileQueue> _queue;
    std::string _socketName;
    std::shared_ptr<lok::Office> _loKit;
    std::string _jailId;
    std::shared_ptr<Document> _document;
    std::shared_ptr<KitSocketPoll> _ksPoll;
    const unsigned _mobileAppDocId;

public:
    KitWebSocketHandler(const std::string& socketName, const std::shared_ptr<lok::Office>& loKit, const std::string& jailId, std::shared_ptr<KitSocketPoll> ksPoll, unsigned mobileAppDocId) :
        WebSocketHandler(/* isClient = */ true, /* isMasking */ false),
        _queue(std::make_shared<TileQueue>()),
        _socketName(socketName),
        _loKit(loKit),
        _jailId(jailId),
        _ksPoll(ksPoll),
        _mobileAppDocId(mobileAppDocId)
    {
    }

    ~KitWebSocketHandler()
    {
        // Just to make it easier to set a breakpoint
    }

protected:
    void handleMessage(const std::vector<char>& data) override
    {
        std::string message(data.data(), data.size());

#if !MOBILEAPP
        if (UnitKit::get().filterKitMessage(this, message))
            return;
#endif
        StringVector tokens = Util::tokenize(message);
        Log::StreamLogger logger = Log::debug();
        if (logger.enabled())
        {
            logger << _socketName << ": recv [";
            for (const auto& token : tokens)
            {
                // Don't log user-data, there are anonymized versions that get logged instead.
                if (Util::startsWith(tokens.getParam(token), "jail") ||
                    Util::startsWith(tokens.getParam(token), "author") ||
                    Util::startsWith(tokens.getParam(token), "name") ||
                    Util::startsWith(tokens.getParam(token), "url"))
                    continue;

                logger << tokens.getParam(token) << ' ';
            }

            LOG_END(logger, true);
        }

        // Note: Syntax or parsing errors here are unexpected and fatal.
        if (SigUtil::getTerminationFlag())
        {
            LOG_DBG("Too late, TerminationFlag is set, we're going down");
        }
        else if (tokens.equals(0, "session"))
        {
            const std::string& sessionId = tokens[1];
            const std::string& docKey = tokens[2];
            const std::string& docId = tokens[3];
            const int canonicalViewId = std::stoi(tokens[4]);
            const std::string fileId = Util::getFilenameFromURL(docKey);
            Util::mapAnonymized(fileId, fileId); // Identity mapping, since fileId is already obfuscated

            std::string url;
            URI::decode(docKey, url);
            LOG_INF("New session [" << sessionId << "] request on url [" << url << "] with viewId " << canonicalViewId);
#ifndef IOS
            Util::setThreadName("kit" SHARED_DOC_THREADNAME_SUFFIX + docId);
#endif
            if (!_document)
            {
                _document = std::make_shared<Document>(
                    _loKit, _jailId, docKey, docId, url, _queue,
                    std::static_pointer_cast<WebSocketHandler>(shared_from_this()),
                    _mobileAppDocId);
                _ksPoll->setDocument(_document);
            }

            // Validate and create session.
            if (!(url == _document->getUrl() && _document->createSession(sessionId, canonicalViewId)))
            {
                LOG_DBG("CreateSession failed.");
            }
        }

        else if (tokens.equals(0, "exit"))
        {
#if !MOBILEAPP
            LOG_INF("Terminating immediately due to parent 'exit' command.");
            Log::shutdown();
            std::_Exit(EX_SOFTWARE);
#else
#ifdef IOS
            LOG_INF("Setting our KitSocketPoll's termination flag due to 'exit' command.");
            std::unique_lock<std::mutex> lock(_ksPoll->terminationMutex);
            _ksPoll->terminationFlag = true;
            _ksPoll->terminationCV.notify_all();
#else
            LOG_INF("Setting TerminationFlag due to 'exit' command.");
            SigUtil::setTerminationFlag();
#endif
            _document.reset();
#endif
        }
        else if (tokens.equals(0, "tile") || tokens.equals(0, "tilecombine") || tokens.equals(0, "canceltiles") ||
                tokens.equals(0, "paintwindow") || tokens.equals(0, "resizewindow") ||
                LOOLProtocol::getFirstToken(tokens[0], '-') == "child")
        {
            if (_document)
            {
                _queue->put(message);
            }
            else
            {
                LOG_WRN("No document while processing " << tokens[0] << " request.");
            }
        }
        else if (tokens.size() == 3 && tokens.equals(0, "setconfig"))
        {
#if !MOBILEAPP
            // Currently only rlimit entries are supported.
            if (!Rlimit::handleSetrlimitCommand(tokens))
            {
                LOG_ERR("Unknown setconfig command: " << message);
            }
#endif
        }
        else if (tokens.equals(0, "setloglevel"))
        {
            Log::logger().setLevel(tokens[1]);
        }
        else
        {
            LOG_ERR("Bad or unknown token [" << tokens[0] << ']');
        }
    }

    virtual void enableProcessInput(bool enable = true) override
    {
        WebSocketHandler::enableProcessInput(enable);
        if (_document)
            _document->enableProcessInput(enable);

        // Wake up poll to process data from socket input buffer
        if (enable && _ksPoll)
        {
            _ksPoll->wakeup();
        }
    }

    void onDisconnect() override
    {
#if !MOBILEAPP
        LOG_WRN("Kit connection lost without exit arriving from wsd. Setting TerminationFlag");
        SigUtil::setTerminationFlag();
#endif
#ifdef IOS
        {
            std::unique_lock<std::mutex> lock(_ksPoll->terminationMutex);
            _ksPoll->terminationFlag = true;
            _ksPoll->terminationCV.notify_all();
        }
#endif
        _ksPoll.reset();
    }
};

void documentViewCallback(const int type, const char* payload, void* data)
{
    Document::ViewCallback(type, payload, data);
}

/// Called by LOK main-loop the central location for data processing.
int pollCallback(void* pData, int timeoutUs)
{
#ifndef IOS
    if (!pData)
        return 0;
    else
        return reinterpret_cast<KitSocketPoll*>(pData)->kitPoll(timeoutUs);
#else
    std::unique_lock<std::mutex> lock(KitSocketPoll::KSPollsMutex);
    std::vector<std::shared_ptr<KitSocketPoll>> v;
    for (const auto &i : KitSocketPoll::KSPolls)
    {
        auto p = i.lock();
        if (p)
            v.push_back(p);
    }
    lock.unlock();
    if (v.size() == 0)
    {
        std::this_thread::sleep_for(std::chrono::microseconds(timeoutUs));
    }
    else
    {
        for (const auto &p : v)
            p->kitPoll(timeoutUs);
    }

    // We never want to exit the main loop
    return 0;
#endif
}

/// Called by LOK main-loop
void wakeCallback(void* pData)
{
#ifndef IOS
    if (!pData)
        return;
    else
        return reinterpret_cast<KitSocketPoll*>(pData)->wakeup();
#else
    std::unique_lock<std::mutex> lock(KitSocketPoll::KSPollsMutex);
    if (KitSocketPoll::KSPolls.size() == 0)
        return;

    std::vector<std::shared_ptr<KitSocketPoll>> v;
    for (const auto &i : KitSocketPoll::KSPolls)
    {
        auto p = i.lock();
        if (p)
            v.push_back(p);
    }
    lock.unlock();
    for (const auto &p : v)
        p->wakeup();
#endif
}

#ifndef BUILDING_TESTS

void lokit_main(
#if !MOBILEAPP
                const std::string& childRoot,
                const std::string& jailId,
                const std::string& sysTemplate,
                const std::string& loTemplate,
                bool noCapabilities,
                bool noSeccomp,
                bool queryVersion,
                bool displayVersion,
#else
                int docBrokerSocket,
                const std::string& userInterface,
#endif
                std::size_t numericIdentifier
                )
{
#if !MOBILEAPP

#ifndef FUZZER
    SigUtil::setFatalSignals();
    SigUtil::setTerminationSignals();
#endif

    Util::setThreadName("kit_spare_" + Util::encodeId(numericIdentifier, 3));

    // Reinitialize logging when forked.
    const bool logToFile = std::getenv("LOOL_LOGFILE");
    const char* logFilename = std::getenv("LOOL_LOGFILENAME");
    const char* logLevel = std::getenv("LOOL_LOGLEVEL");
    const char* logColor = std::getenv("LOOL_LOGCOLOR");
    std::map<std::string, std::string> logProperties;
    if (logToFile && logFilename)
    {
        logProperties["path"] = std::string(logFilename);
    }

    Util::rng::reseed();

    const std::string LogLevel = logLevel ? logLevel : "trace";
    const bool bTraceStartup = (std::getenv("LOOL_TRACE_STARTUP") != nullptr);
    Log::initialize("kit", bTraceStartup ? "trace" : logLevel, logColor != nullptr, logToFile, logProperties);
    if (bTraceStartup && LogLevel != "trace")
    {
        LOG_INF("Setting log-level to [trace] and delaying setting to configured [" << LogLevel << "] until after Kit initialization.");
    }

    const char* pAnonymizationSalt = std::getenv("LOOL_ANONYMIZATION_SALT");
    if (pAnonymizationSalt)
    {
        AnonymizationSalt = std::stoull(std::string(pAnonymizationSalt));
        AnonymizeUserData = true;
    }

    LOG_INF("User-data anonymization is " << (AnonymizeUserData ? "enabled." : "disabled."));

    assert(!childRoot.empty());
    assert(!sysTemplate.empty());
    assert(!loTemplate.empty());

    LOG_DBG("Process started.");

    std::string userdir_url;
    std::string instdir_path;
    int ProcSMapsFile = -1;

    // lokit's destroy typically throws from
    // framework/source/services/modulemanager.cxx:198
    // So we insure it lives until std::_Exit is called.
    std::shared_ptr<lok::Office> loKit;
    ChildSession::NoCapsForKit = noCapabilities;
#endif // MOBILEAPP

    try
    {
#if !MOBILEAPP
        const Path jailPath = Path::forDirectory(childRoot + '/' + jailId);
        const std::string jailPathStr = jailPath.toString();
        LOG_INF("Jail path: " << jailPathStr);
        File(jailPath).createDirectories();
        chmod(jailPathStr.c_str(), S_IXUSR | S_IWUSR | S_IRUSR);

        if (!ChildSession::NoCapsForKit)
        {
            std::chrono::time_point<std::chrono::steady_clock> jailSetupStartTime
                = std::chrono::steady_clock::now();

            userdir_url = "file:///tmp/user";
            instdir_path = '/' + std::string(JailUtil::LO_JAIL_SUBPATH) + "/program";

            Poco::Path jailLOInstallation(jailPath, JailUtil::LO_JAIL_SUBPATH);
            jailLOInstallation.makeDirectory();
            const std::string loJailDestPath = jailLOInstallation.toString();

            // The bind-mount implementation: inlined here to mirror
            // the fallback link/copy version bellow.
            const auto mountJail = [&]() -> bool {
                // Mount sysTemplate for the jail directory.
                LOG_INF("Mounting " << sysTemplate << " -> " << jailPathStr);
                if (!JailUtil::bind(sysTemplate, jailPathStr)
                    || !JailUtil::remountReadonly(sysTemplate, jailPathStr))
                {
                    LOG_WRN("Failed to mount [" << sysTemplate << "] -> [" << jailPathStr
                                                << "], will link/copy contents.");
                    return false;
                }

                // Mount loTemplate inside it.
                LOG_INF("Mounting " << loTemplate << " -> " << loJailDestPath);
                Poco::File(loJailDestPath).createDirectories();
                if (!JailUtil::bind(loTemplate, loJailDestPath)
                    || !JailUtil::remountReadonly(loTemplate, loJailDestPath))
                {
                    LOG_WRN("Failed to mount [" << loTemplate << "] -> [" << loJailDestPath
                                                << "], will link/copy contents.");
                    return false;
                }

                // Hard-random tmpdir inside the jail for added sercurity.
                const std::string tempRoot = Poco::Path(childRoot, "tmp").toString();
                Poco::File(tempRoot).createDirectories();
                const std::string tmpSubDir = FileUtil::createRandomTmpDir(tempRoot);
                const std::string jailTmpDir = Poco::Path(jailPath, "tmp").toString();
                LOG_INF("Mounting random temp dir " << tmpSubDir << " -> " << jailTmpDir);
                if (!JailUtil::bind(tmpSubDir, jailTmpDir))
                {
                    LOG_WRN("Failed to mount [" << tmpSubDir << "] -> [" << jailTmpDir
                                                << "], will link/copy contents.");
                    return false;
                }

                return true;
            };

            // Copy (link) LO installation and other necessary files into it from the template.
            bool bindMount = JailUtil::isBindMountingEnabled();
            if (bindMount)
            {
                if (!mountJail())
                {
                    LOG_INF("Cleaning up jail before linking/copying.");
                    JailUtil::removeJail(jailPathStr);
                    bindMount = false;
                    JailUtil::disableBindMounting();
                }
            }

            if (!bindMount)
            {
                LOG_INF("Mounting is disabled, will link/copy " << sysTemplate << " -> "
                                                                << jailPathStr);

                JailUtil::linkOrCopySysTemplate(sysTemplate, jailPathStr);
                JailUtil::linkOrCopyLoTemplate(loTemplate, jailPathStr);

                // Update the dynamic files inside the jail.
                if (!JailUtil::SysTemplate::updateDynamicFiles(jailPathStr))
                {
                    LOG_WRN(
                        "Failed to update the dynamic files in the jail ["
                        << jailPathStr
                        << "]. If the systemplate directory is owned by a superuser or is "
                           "read-only, running the installation scripts with the owner's account "
                           "should update these files. Some functionality may be missing.");
                }

                // Create a file to mark this a copied jail.
                JailUtil::markJailCopied(jailPathStr);
            }

            // Setup the devices inside /tmp and set TMPDIR.
            JailUtil::setupJailDevNodes(Poco::Path(jailPath, "/tmp").toString());
            ::setenv("TMPDIR", "/tmp", 1);

            // HOME must be writable, so create it in /tmp.
            constexpr const char* HomePathInJail = "/tmp/home";
            Poco::File(Poco::Path(jailPath, HomePathInJail)).createDirectories();
            ::setenv("HOME", HomePathInJail, 1);

            const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::steady_clock::now() - jailSetupStartTime);
            LOG_DBG("Initialized jail files in " << ms);

            ProcSMapsFile = open("/proc/self/smaps", O_RDONLY);
            if (ProcSMapsFile < 0)
                LOG_SYS("Failed to open /proc/self/smaps. Memory stats will be missing.");

            LOG_INF("chroot(\"" << jailPathStr << "\")");
            if (chroot(jailPathStr.c_str()) == -1)
            {
                LOG_SFL("chroot(\"" << jailPathStr << "\") failed.");
                Log::shutdown();
                std::_Exit(EX_SOFTWARE);
            }

            if (chdir("/") == -1)
            {
                LOG_SFL("chdir(\"/\") in jail failed.");
                Log::shutdown();
                std::_Exit(EX_SOFTWARE);
            }

#ifndef __FreeBSD__
            dropCapability(CAP_SYS_CHROOT);
            dropCapability(CAP_MKNOD);
            dropCapability(CAP_FOWNER);
#else
            cap_enter();
#endif

            LOG_DBG("Initialized jail nodes, dropped caps.");
        }
        else // noCapabilities set
        {
            LOG_WRN("Security warning: running without chroot jails is insecure.");
            LOG_INF("Using template ["
                    << loTemplate << "] as install subpath directly, without chroot jail setup.");
            userdir_url = "file:///" + jailPathStr + "/tmp/user";
            instdir_path = '/' + loTemplate + "/program";
            JailRoot = jailPathStr;
        }

        LOG_DBG("Initializing LOK with instdir [" << instdir_path << "] and userdir ["
                                                  << userdir_url << "].");

        LibreOfficeKit *kit;
        {
            const char *instdir = instdir_path.c_str();
            const char *userdir = userdir_url.c_str();
#ifndef KIT_IN_PROCESS
            kit = UnitKit::get().lok_init(instdir, userdir);
#else
            kit = nullptr;
#ifdef FUZZER
            if (LOOLWSD::DummyLOK)
                kit = dummy_lok_init_2(instdir, userdir);
#endif
#endif
            if (!kit)
            {
                kit = (initFunction ? initFunction(instdir, userdir)
                                    : lok_init_2(instdir, userdir));
            }

            loKit = std::make_shared<lok::Office>(kit);
            if (!loKit)
            {
                LOG_FTL("LibreOfficeKit initialization failed. Exiting.");
                Log::shutdown();
                std::_Exit(EX_SOFTWARE);
            }
        }

        // Lock down the syscalls that can be used
        if (!Seccomp::lockdown(Seccomp::Type::KIT))
        {
            if (!noSeccomp)
            {
                LOG_FTL("LibreOfficeKit seccomp security lockdown failed. Exiting.");
                Log::shutdown();
                std::_Exit(EX_SOFTWARE);
            }

            LOG_ERR("LibreOfficeKit seccomp security lockdown failed, but configured to continue. "
                    "You are running in a significantly less secure mode.");
        }

        rlimit rlim = { 0, 0 };
        if (getrlimit(RLIMIT_AS, &rlim) == 0)
            LOG_INF("RLIMIT_AS is " << Util::getHumanizedBytes(rlim.rlim_max) << " (" << rlim.rlim_max << " bytes)");
        else
            LOG_SYS("Failed to get RLIMIT_AS.");

        if (getrlimit(RLIMIT_STACK, &rlim) == 0)
            LOG_INF("RLIMIT_STACK is " << Util::getHumanizedBytes(rlim.rlim_max) << " (" << rlim.rlim_max << " bytes)");
        else
            LOG_SYS("Failed to get RLIMIT_STACK.");

        if (getrlimit(RLIMIT_FSIZE, &rlim) == 0)
            LOG_INF("RLIMIT_FSIZE is " << Util::getHumanizedBytes(rlim.rlim_max) << " (" << rlim.rlim_max << " bytes)");
        else
            LOG_SYS("Failed to get RLIMIT_FSIZE.");

        if (getrlimit(RLIMIT_NOFILE, &rlim) == 0)
            LOG_INF("RLIMIT_NOFILE is " << rlim.rlim_max << " files.");
        else
            LOG_SYS("Failed to get RLIMIT_NOFILE.");

        LOG_INF("Process is ready.");

        std::string pathAndQuery(NEW_CHILD_URI);
        pathAndQuery.append("?jailid=");
        pathAndQuery.append(jailId);
        if (queryVersion)
        {
            char* versionInfo = loKit->getVersionInfo();
            std::string versionString(versionInfo);
            if (displayVersion)
                std::cout << "office version details: " << versionString << std::endl;
            std::string encodedVersion;
            Poco::URI::encode(versionString, "?#/", encodedVersion);
            pathAndQuery.append("&version=");
            pathAndQuery.append(encodedVersion);
            free(versionInfo);
        }

#else // MOBILEAPP

#ifndef IOS
        // Was not done by the preload.
        // For iOS we call it in -[AppDelegate application: didFinishLaunchingWithOptions:]
        setupKitEnvironment(userInterface);
#endif

#if (defined(__linux__) && !defined(__ANDROID__)) || defined(__FreeBSD__)
        Poco::URI userInstallationURI("file", LO_PATH);
        LibreOfficeKit *kit = lok_init_2(LO_PATH "/program", userInstallationURI.toString().c_str());
#else

#ifdef IOS // In the iOS app we call lok_init_2() just once, when the app starts
        static LibreOfficeKit *kit = lo_kit;
#else
        static LibreOfficeKit *kit = lok_init_2(nullptr, nullptr);
#endif

#endif

        assert(kit);

        static std::shared_ptr<lok::Office> loKit = std::make_shared<lok::Office>(kit);
        assert(loKit);

        LOOLWSD::LOKitVersion = loKit->getVersionInfo();

        // Dummies
        const std::string jailId = "jailid";

#endif // MOBILEAPP

        auto mainKit = KitSocketPoll::create();
        mainKit->runOnClientThread(); // We will do the polling on this thread.

        std::shared_ptr<KitWebSocketHandler> websocketHandler =
            std::make_shared<KitWebSocketHandler>("child_ws", loKit, jailId, mainKit, numericIdentifier);

#if !MOBILEAPP
        mainKit->insertNewUnixSocket(MasterLocation, pathAndQuery, websocketHandler, ProcSMapsFile);
#else
        mainKit->insertNewFakeSocket(docBrokerSocket, websocketHandler);
#endif

        LOG_INF("New kit client websocket inserted.");

#if !MOBILEAPP
        if (bTraceStartup && LogLevel != "trace")
        {
            LOG_INF("Kit initialization complete: setting log-level to [" << LogLevel << "] as configured.");
            Log::logger().setLevel(LogLevel);
        }
#endif

#ifndef IOS
        if (!LIBREOFFICEKIT_HAS(kit, runLoop))
        {
            LOG_ERR("Kit is missing Unipoll API");
            std::cout << "Fatal: out of date LibreOfficeKit - no Unipoll API\n";
            std::_Exit(EX_SOFTWARE);
        }

        LOG_INF("Kit unipoll loop run");

        loKit->runLoop(pollCallback, wakeCallback, mainKit.get());

        LOG_INF("Kit unipoll loop run terminated.");

#if MOBILEAPP
        SocketPoll::wakeupWorld();
#else
        // Trap the signal handler, if invoked,
        // to prevent exiting.
        LOG_INF("Process finished.");
        Log::shutdown();

        // Let forkit handle the jail cleanup.
#endif

#else // IOS
        std::unique_lock<std::mutex> lock(mainKit->terminationMutex);
        mainKit->terminationCV.wait(lock,[&]{ return mainKit->terminationFlag; } );
#endif // !IOS
    }
    catch (const Exception& exc)
    {
        LOG_ERR("Poco Exception: " << exc.displayText() <<
                (exc.nested() ? " (" + exc.nested()->displayText() + ')' : ""));
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Exception: " << exc.what());
    }

#if !MOBILEAPP

    LOG_INF("Process finished.");
    Log::shutdown();
    // Wait for the signal handler, if invoked, to prevent exiting until done.
    SigUtil::waitSigHandlerTrap();
    std::_Exit(EX_OK);

#endif
}

#ifdef IOS

// In the iOS app we can have several documents open in the app process at the same time, thus
// several lokit_main() functions running at the same time. We want just one LO main loop, though,
// so we start it separately in its own thread.

void runKitLoopInAThread()
{
    std::thread([&]
                {
                    Util::setThreadName("lokit_runloop");

                    std::shared_ptr<lok::Office> loKit = std::make_shared<lok::Office>(lo_kit);
                    int dummy;
                    loKit->runLoop(pollCallback, wakeCallback, &dummy);

                    // Should never return
                    assert(false);

                    NSLog(@"loKit->runLoop() unexpectedly returned");

                    std::abort();
                }).detach();
}

#endif // IOS

#endif // !BUILDING_TESTS

std::string anonymizeUrl(const std::string& url)
{
#ifndef BUILDING_TESTS
    return AnonymizeUserData ? Util::anonymizeUrl(url, AnonymizationSalt) : url;
#else
    return url;
#endif
}

#if !MOBILEAPP

/// Initializes LibreOfficeKit for cross-fork re-use.
bool globalPreinit(const std::string &loTemplate)
{
#ifdef FUZZER
    if (LOOLWSD::DummyLOK)
        return true;
#endif
    const std::string libSofficeapp = loTemplate + "/program/" LIB_SOFFICEAPP;
    const std::string libMerged = loTemplate + "/program/" LIB_MERGED;

    std::string loadedLibrary;
    void *handle;
    if (File(libMerged).exists())
    {
        LOG_TRC("dlopen(" << libMerged << ", RTLD_GLOBAL|RTLD_NOW)");
        handle = dlopen(libMerged.c_str(), RTLD_GLOBAL|RTLD_NOW);
        if (!handle)
        {
            LOG_FTL("Failed to load " << libMerged << ": " << dlerror());
            return false;
        }
        loadedLibrary = libMerged;
    }
    else
    {
        if (File(libSofficeapp).exists())
        {
            LOG_TRC("dlopen(" << libSofficeapp << ", RTLD_GLOBAL|RTLD_NOW)");
            handle = dlopen(libSofficeapp.c_str(), RTLD_GLOBAL|RTLD_NOW);
            if (!handle)
            {
                LOG_FTL("Failed to load " << libSofficeapp << ": " << dlerror());
                return false;
            }
            loadedLibrary = libSofficeapp;
        }
        else
        {
            LOG_FTL("Neither " << libSofficeapp << " or " << libMerged << " exist.");
            return false;
        }
    }

    LokHookPreInit* preInit = reinterpret_cast<LokHookPreInit *>(dlsym(handle, "lok_preinit"));
    if (!preInit)
    {
        LOG_FTL("No lok_preinit symbol in " << loadedLibrary << ": " << dlerror());
        return false;
    }

    initFunction = reinterpret_cast<LokHookFunction2 *>(dlsym(handle, "libreofficekit_hook_2"));
    if (!initFunction)
    {
        LOG_FTL("No libreofficekit_hook_2 symbol in " << loadedLibrary << ": " << dlerror());
    }

    // Disable problematic components that may be present from a
    // desktop or developer's install if env. var not set.
    ::setenv("UNODISABLELIBRARY",
             "abp avmediagst avmediavlc cmdmail losessioninstall OGLTrans PresenterScreen "
             "syssh ucpftp1 ucpgio1 ucphier1 ucpimage updatecheckui updatefeed updchk"
             // Database
             "dbaxml dbmm dbp dbu deployment firebird_sdbc mork "
             "mysql mysqlc odbc postgresql-sdbc postgresql-sdbc-impl sdbc2 sdbt"
             // Java
             "javaloader javavm jdbc rpt rptui rptxml ",
             0 /* no overwrite */);

    LOG_TRC("Invoking lok_preinit(" << loTemplate << "/program\", \"file:///tmp/user\")");
    const auto start = std::chrono::steady_clock::now();
    if (preInit((loTemplate + "/program").c_str(), "file:///tmp/user") != 0)
    {
        LOG_FTL("lok_preinit() in " << loadedLibrary << " failed");
        return false;
    }

    LOG_TRC("Finished lok_preinit(" << loTemplate << "/program\", \"file:///tmp/user\") in "
                                    << std::chrono::duration_cast<std::chrono::milliseconds>(
                                           std::chrono::steady_clock::now() - start));
    return true;
}

/// Anonymize usernames.
std::string anonymizeUsername(const std::string& username)
{
#ifndef BUILDING_TESTS
    return AnonymizeUserData ? Util::anonymize(username, AnonymizationSalt) : username;
#else
    return username;
#endif
}

#endif // !MOBILEAPP

void dump_kit_state()
{
    std::ostringstream oss;
    KitSocketPoll::dumpGlobalState(oss);

    const std::string msg = oss.str();
    fprintf(stderr, "%s", msg.c_str());
    LOG_TRC(msg);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
