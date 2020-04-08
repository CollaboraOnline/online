/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "DocumentBroker.hpp"

#include <atomic>
#include <cassert>
#include <chrono>
#include <ctime>
#include <fstream>
#include <sstream>

#include <Poco/DigestStream.h>
#include <Poco/Exception.h>
#include <Poco/JSON/Object.h>
#include <Poco/Path.h>
#include <Poco/SHA1Engine.h>
#include <Poco/StreamCopier.h>

#include "Admin.hpp"
#include "ClientSession.hpp"
#include "Exceptions.hpp"
#include "LOOLWSD.hpp"
#include "SenderQueue.hpp"
#include "Storage.hpp"
#include "TileCache.hpp"
#include <common/Log.hpp>
#include <common/Message.hpp>
#include <common/Clipboard.hpp>
#include <common/Protocol.hpp>
#include <common/Unit.hpp>
#include <common/FileUtil.hpp>

#ifdef IOS
#import "DocumentViewController.h"
#endif

#include <sys/types.h>
#include <sys/wait.h>

#define TILES_ON_FLY_MIN_UPPER_LIMIT 10.0f

using namespace LOOLProtocol;

using Poco::JSON::Object;

#if ENABLE_DEBUG
#  define ADD_DEBUG_RENDERID (" renderid=cached\n")
#else
#  define ADD_DEBUG_RENDERID ("\n")
#endif

void ChildProcess::setDocumentBroker(const std::shared_ptr<DocumentBroker>& docBroker)
{
    assert(docBroker && "Invalid DocumentBroker instance.");
    _docBroker = docBroker;

    // Add the prisoner socket to the docBroker poll.
    docBroker->addSocketToPoll(_socket);
}

namespace
{

void sendLastModificationTime(const std::shared_ptr<Session>& session,
                              DocumentBroker* documentBroker,
                              const std::chrono::system_clock::time_point& documentLastModifiedTime)
{
    if (!session)
        return;

    std::stringstream stream;
    stream << "lastmodtime: " << documentLastModifiedTime;
    std::string message = stream.str();
    session->sendTextFrame(message);
    if (documentBroker)
        documentBroker->broadcastMessage(message);
}

}

Poco::URI DocumentBroker::sanitizeURI(const std::string& uri)
{
    // The URI of the document should be url-encoded.
#if !MOBILEAPP
    std::string decodedUri;
    Poco::URI::decode(uri, decodedUri);
    Poco::URI uriPublic(decodedUri);
#else
    Poco::URI uriPublic(uri);
#endif

    if (uriPublic.isRelative() || uriPublic.getScheme() == "file")
    {
        // TODO: Validate and limit access to local paths!
        uriPublic.normalize();
    }

    if (uriPublic.getPath().empty())
    {
        throw std::runtime_error("Invalid URI.");
    }

    // We decoded access token before embedding it in loleaflet.html
    // So, we need to decode it now to get its actual value
    Poco::URI::QueryParameters queryParams = uriPublic.getQueryParameters();
    for (auto& param: queryParams)
    {
        // look for encoded query params (access token as of now)
        if (param.first == "access_token")
        {
            std::string decodedToken;
            Poco::URI::decode(param.second, decodedToken);
            param.second = decodedToken;
        }
    }

    uriPublic.setQueryParameters(queryParams);
    return uriPublic;
}

std::string DocumentBroker::getDocKey(const Poco::URI& uri)
{
    // If multiple host-names are used to access us, then
    // they must be aliases. Permission to access aliased hosts
    // is checked at the point of accepting incoming connections.
    // At this point storing the hostname artificially discriminates
    // between aliases and forces same document (when opened from
    // alias hosts) to load as separate documents and sharing doesn't
    // work. Worse, saving overwrites one another.
    std::string docKey;
    Poco::URI::encode(uri.getPath(), "", docKey);
    return docKey;
}

/// The Document Broker Poll - one of these in a thread per document
class DocumentBroker::DocumentBrokerPoll final : public TerminatingPoll
{
    /// The DocumentBroker owning us.
    DocumentBroker& _docBroker;

public:
    DocumentBrokerPoll(const std::string &threadName, DocumentBroker& docBroker) :
        TerminatingPoll(threadName),
        _docBroker(docBroker)
    {
    }

    bool continuePolling() override
    {
#if MOBILEAPP
        if (MobileTerminationFlag)
        {
            LOG_TRC("Noticed MobileTerminationFlag.");
            MobileTerminationFlag = false;
            return false;
        }
#endif
        return TerminatingPoll::continuePolling();
    }

    void pollingThread() override
    {
        // Delegate to the docBroker.
        _docBroker.pollThread();
    }
};

std::atomic<unsigned> DocumentBroker::DocBrokerId(1);

DocumentBroker::DocumentBroker(const std::string& uri,
                               const Poco::URI& uriPublic,
                               const std::string& docKey) :
    _limitLifeSeconds(0),
    _uriOrig(uri),
    _uriPublic(uriPublic),
    _docKey(docKey),
    _docId(Util::encodeId(DocBrokerId++, 3)),
    _documentChangedInStorage(false),
    _lastSaveTime(std::chrono::steady_clock::now()),
    _lastSaveRequestTime(std::chrono::steady_clock::now() - std::chrono::milliseconds(COMMAND_TIMEOUT_MS)),
    _markToDestroy(false),
    _closeRequest(false),
    _isLoaded(false),
    _isModified(false),
    _cursorPosX(0),
    _cursorPosY(0),
    _cursorWidth(0),
    _cursorHeight(0),
    _poll(new DocumentBrokerPoll("docbroker_" + _docId, *this)),
    _stop(false),
    _closeReason("stopped"),
    _lockCtx(new LockContext()),
    _tileVersion(0),
    _debugRenderedTileCount(0),
    _wopiLoadDuration(0)
{
    assert(!_docKey.empty());
    assert(!LOOLWSD::ChildRoot.empty());

    LOG_INF("DocumentBroker [" << LOOLWSD::anonymizeUrl(_uriPublic.toString()) <<
            "] created with docKey [" << _docKey << "]");
}

void DocumentBroker::startThread()
{
    _poll->startThread();
}

void DocumentBroker::assertCorrectThread() const
{
    _poll->assertCorrectThread();
}

// The inner heart of the DocumentBroker - our poll loop.
void DocumentBroker::pollThread()
{
    LOG_INF("Starting docBroker polling thread for docKey [" << _docKey << "].");

    _threadStart = std::chrono::steady_clock::now();

    // Request a kit process for this doc.
#if !MOBILEAPP
    do
    {
        static const int timeoutMs = COMMAND_TIMEOUT_MS * 5;
        _childProcess = getNewChild_Blocks();
        if (_childProcess ||
            std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() -
                                                                  _threadStart).count() > timeoutMs)
            break;

        // Nominal time between retries, lest we busy-loop. getNewChild could also wait, so don't double that here.
        std::this_thread::sleep_for(std::chrono::milliseconds(CHILD_REBALANCE_INTERVAL_MS / 10));
    }
    while (!_stop && _poll->continuePolling() && !SigUtil::getTerminationFlag() && !SigUtil::getShutdownRequestFlag());
#else
    _childProcess = getNewChild_Blocks(getPublicUri().getPath());
#endif

    if (!_childProcess)
    {
        // Let the client know we can't serve now.
        LOG_ERR("Failed to get new child.");

        // FIXME: need to notify all clients and shut this down ...
        // FIXME: return something good down the websocket ...
#if 0
        const std::string msg = SERVICE_UNAVAILABLE_INTERNAL_ERROR;
        ws.sendMessage(msg);
        // abnormal close frame handshake
        ws.shutdown(WebSocketHandler::StatusCodes::ENDPOINT_GOING_AWAY);
#endif
        stop("Failed to get new child.");

        // Stop to mark it done and cleanup.
        _poll->stop();
        _poll->removeSockets();

        // Async cleanup.
        LOOLWSD::doHousekeeping();

        LOG_INF("Finished docBroker polling thread for docKey [" << _docKey << "].");
        return;
    }

    _childProcess->setDocumentBroker(shared_from_this());
    LOG_INF("Doc [" << _docKey << "] attached to child [" << _childProcess->getPid() << "].");

    static const bool AutoSaveEnabled = !std::getenv("LOOL_NO_AUTOSAVE");

#if !MOBILEAPP
    static const size_t IdleDocTimeoutSecs = LOOLWSD::getConfigValue<int>(
                                                      "per_document.idle_timeout_secs", 3600);

    // Used to accumulate B/W deltas.
    uint64_t adminSent = 0;
    uint64_t adminRecv = 0;
    auto lastBWUpdateTime = std::chrono::steady_clock::now();
    auto lastClipboardHashUpdateTime = std::chrono::steady_clock::now();

    const int limit_load_secs =
#ifdef ENABLE_DEBUG
        // paused waiting for a debugger to attach
        // ignore load time out
        std::getenv("PAUSEFORDEBUGGER") ? -1 :
#endif
        LOOLWSD::getConfigValue<int>("per_document.limit_load_secs", 100);

    const auto loadDeadline = std::chrono::steady_clock::now() + std::chrono::seconds(limit_load_secs);
#endif
    auto last30SecCheckTime = std::chrono::steady_clock::now();

    // Main polling loop goodness.
    while (!_stop && _poll->continuePolling() && !SigUtil::getTerminationFlag())
    {
        _poll->poll(SocketPoll::DefaultPollTimeoutMs);

        const auto now = std::chrono::steady_clock::now();

#if !MOBILEAPP
        // a tile's data is ~8k, a 4k screen is ~128 256x256 tiles
        if (_tileCache)
            _tileCache->setMaxCacheSize(8 * 1024 * 128 * _sessions.size());

        if (!_isLoaded && (limit_load_secs > 0) && (now > loadDeadline))
        {
            LOG_ERR("Doc [" << _docKey << "] is taking too long to load. Will kill process ["
                    << _childProcess->getPid() << "]. per_document.limit_load_secs set to "
                    << limit_load_secs << " secs.");
            broadcastMessage("error: cmd=load kind=docloadtimeout");

            // Brutal but effective.
            if (_childProcess)
                _childProcess->terminate();

            stop("Load timed out");
            continue;
        }

        if (_limitLifeSeconds > 0 &&
            std::chrono::duration_cast<std::chrono::seconds>(now - _threadStart).count() > _limitLifeSeconds)
        {
            LOG_WRN("Doc [" << _docKey << "] is taking too long to convert. Will kill process ["
                            << _childProcess->getPid() << "]. per_document.limit_convert_secs set to "
                            << _limitLifeSeconds << " secs.");
            broadcastMessage("error: cmd=load kind=docexpired");

            // Brutal but effective.
            if (_childProcess)
                _childProcess->terminate();

            stop("Load timed out");
            continue;
        }

        if (std::chrono::duration_cast<std::chrono::milliseconds>
                    (now - lastBWUpdateTime).count() >= COMMAND_TIMEOUT_MS)
        {
            lastBWUpdateTime = now;
            uint64_t sent, recv;
            getIOStats(sent, recv);
            // send change since last notification.
            Admin::instance().addBytes(getDocKey(),
                                       // connection drop transiently reduces this.
                                       (sent > adminSent ? (sent - adminSent): uint64_t(0)),
                                       (recv > adminRecv ? (recv - adminRecv): uint64_t(0)));
            adminSent = sent;
            adminRecv = recv;
            LOG_TRC("Doc [" << _docKey << "] added stats sent: " << sent << ", recv: " << recv << " bytes to totals.");
        }

        if (_storage && _lockCtx->needsRefresh(now))
            refreshLock();
#endif

        if (isSaving() &&
            std::chrono::duration_cast<std::chrono::milliseconds>
                    (now - _lastSaveRequestTime).count() <= COMMAND_TIMEOUT_MS)
        {
            // We are saving, nothing more to do but wait (until we save or we timeout).
            continue;
        }

        if (SigUtil::getShutdownRequestFlag() || _closeRequest)
        {
            const std::string reason = SigUtil::getShutdownRequestFlag() ? "recycling" : _closeReason;
            LOG_INF("Autosaving DocumentBroker for docKey [" << getDocKey() << "] for " << reason);
            if (!autoSave(isPossiblyModified()))
            {
                LOG_INF("Terminating DocumentBroker for docKey [" << getDocKey() << "].");
                stop(reason);
            }
        }
        else if (AutoSaveEnabled && !_stop &&
                 std::chrono::duration_cast<std::chrono::seconds>(now - last30SecCheckTime).count() >= 30)
        {
            LOG_TRC("Triggering an autosave.");
            autoSave(false);
            last30SecCheckTime = std::chrono::steady_clock::now();
        }

#if !MOBILEAPP
        if (std::chrono::duration_cast<std::chrono::minutes>(now - lastClipboardHashUpdateTime).count() >= 2)
        for (auto &it : _sessions)
        {
            if (it.second->staleWaitDisconnect(now))
            {
                std::string id = it.second->getId();
                LOG_WRN("Unusual, Kit session " + id + " failed its disconnect handshake, killing");
                finalRemoveSession(id);
                break; // it invalid.
            }
        }

        if (std::chrono::duration_cast<std::chrono::minutes>(now - lastClipboardHashUpdateTime).count() >= 5)
        {
            LOG_TRC("Rotating clipboard keys");
            for (auto &it : _sessions)
                it.second->rotateClipboardKey(true);

            lastClipboardHashUpdateTime = now;
        }

        if (false)
            ;
        // Remove idle documents after 1 hour.
        else if (isLoaded() && getIdleTimeSecs() >= IdleDocTimeoutSecs)
        {
            // Stop if there is nothing to save.
            LOG_INF("Autosaving idle DocumentBroker for docKey [" << getDocKey() << "] to kill.");
            if (!autoSave(isPossiblyModified()))
            {
                LOG_INF("Terminating idle DocumentBroker for docKey [" << getDocKey() << "].");
                stop("idle");
            }
        }
#endif
        else if (_sessions.empty() && (isLoaded() || _markToDestroy))
        {
            // If all sessions have been removed, no reason to linger.
            LOG_INF("Terminating dead DocumentBroker for docKey [" << getDocKey() << "].");
            stop("dead");
        }
    }

    LOG_INF("Finished polling doc [" << _docKey << "]. stop: " << _stop << ", continuePolling: " <<
            _poll->continuePolling() << ", ShutdownRequestFlag: " << SigUtil::getShutdownRequestFlag() <<
            ", TerminationFlag: " << SigUtil::getTerminationFlag() << ", closeReason: " << _closeReason << ". Flushing socket.");

    if (_isModified)
    {
        std::stringstream state;
        dumpState(state);
        LOG_ERR("DocumentBroker stopping although modified " << state.str());
    }

    // Flush socket data first.
    constexpr int flushTimeoutMs = POLL_TIMEOUT_MS * 2; // ~1000ms
    LOG_INF("Flushing socket for doc ["
            << _docKey << "] for " << flushTimeoutMs << " ms. stop: " << _stop
            << ", continuePolling: " << _poll->continuePolling()
            << ", ShutdownRequestFlag: " << SigUtil::getShutdownRequestFlag()
            << ", TerminationFlag: " << SigUtil::getTerminationFlag()
            << ". Terminating child with reason: [" << _closeReason << "].");
    const auto flushStartTime = std::chrono::steady_clock::now();
    while (_poll->getSocketCount())
    {
        const auto now = std::chrono::steady_clock::now();
        const int elapsedMs = std::chrono::duration_cast<std::chrono::milliseconds>(now - flushStartTime).count();
        if (elapsedMs > flushTimeoutMs)
            break;

        _poll->poll(std::min(flushTimeoutMs - elapsedMs, POLL_TIMEOUT_MS / 5));
    }

    LOG_INF("Finished flushing socket for doc [" << _docKey << "]. stop: " << _stop << ", continuePolling: " <<
            _poll->continuePolling() << ", ShutdownRequestFlag: " << SigUtil::getShutdownRequestFlag() <<
            ", TerminationFlag: " << SigUtil::getTerminationFlag() << ". Terminating child with reason: [" << _closeReason << "].");

    // Terminate properly while we can.
    terminateChild(_closeReason);

    // Stop to mark it done and cleanup.
    _poll->stop();
    _poll->removeSockets();

#if !MOBILEAPP
    // Async cleanup.
    LOOLWSD::doHousekeeping();
#endif

    if (_tileCache)
        _tileCache->clear();

    LOG_INF("Finished docBroker polling thread for docKey [" << _docKey << "].");
}

bool DocumentBroker::isAlive() const
{
    if (!_stop || _poll->isAlive())
        return true; // Polling thread not started or still running.

    // Shouldn't have live child process outside of the polling thread.
    return _childProcess && _childProcess->isAlive();
}

DocumentBroker::~DocumentBroker()
{
    assertCorrectThread();

#if !MOBILEAPP
    Admin::instance().rmDoc(_docKey);
#endif

    LOG_INF("~DocumentBroker [" << _docKey <<
            "] destroyed with " << _sessions.size() << " sessions left.");

    // Do this early - to avoid operating on _childProcess from two threads.
    _poll->joinThread();

    if (!_sessions.empty())
        LOG_WRN("DocumentBroker [" << _docKey << "] still has unremoved sessions.");

    // Need to first make sure the child exited, socket closed,
    // and thread finished before we are destroyed.
    _childProcess.reset();
}

void DocumentBroker::joinThread()
{
    _poll->joinThread();
}

void DocumentBroker::stop(const std::string& reason)
{
    LOG_DBG("Stopping DocumentBroker for docKey [" << _docKey << "] with reason: " << reason);
    _closeReason = reason; // used later in the polling loop
    _stop = true;
    _poll->wakeup();
}

bool DocumentBroker::load(const std::shared_ptr<ClientSession>& session, const std::string& jailId)
{
    assertCorrectThread();

    const std::string sessionId = session->getId();

    LOG_INF("Loading [" << _docKey << "] for session [" << sessionId << "] and jail [" << jailId << "].");

    {
        bool result;
        if (UnitWSD::get().filterLoad(sessionId, jailId, result))
            return result;
    }

    if (_markToDestroy)
    {
        // Tearing down.
        LOG_WRN("Will not load document marked to destroy. DocKey: [" << _docKey << "].");
        return false;
    }

    _jailId = jailId;

    // The URL is the publicly visible one, not visible in the chroot jail.
    // We need to map it to a jailed path and copy the file there.

    // user/doc/jailId
    const Poco::Path jailPath(JAILED_DOCUMENT_ROOT, jailId);
    std::string jailRoot = getJailRoot();

    LOG_INF("jailPath: " << jailPath.toString() << ", jailRoot: " << jailRoot);

    bool firstInstance = false;
    if (_storage == nullptr)
    {
        // Pass the public URI to storage as it needs to load using the token
        // and other storage-specific data provided in the URI.
        const Poco::URI& uriPublic = session->getPublicUri();
        LOG_DBG("Loading, and creating new storage instance for URI [" << LOOLWSD::anonymizeUrl(uriPublic.toString()) << "].");

        try
        {
            _storage = StorageBase::create(uriPublic, jailRoot, jailPath.toString());
        }
        catch (...)
        {
            session->sendMessage("loadstorage: failed");
            throw;
        }

        if (_storage == nullptr)
        {
            // We should get an exception, not null.
            LOG_ERR("Failed to create Storage instance for [" << _docKey << "] in " << jailPath.toString());
            return false;
        }
        firstInstance = true;
    }

    assert(_storage != nullptr);

    // Call the storage specific fileinfo functions
    std::string userId, username;
    std::string userExtraInfo;
    std::string watermarkText;
    std::string templateSource;

#if !MOBILEAPP
    std::chrono::duration<double> getInfoCallDuration(0);
    WopiStorage* wopiStorage = dynamic_cast<WopiStorage*>(_storage.get());
    if (wopiStorage != nullptr)
    {
        std::unique_ptr<WopiStorage::WOPIFileInfo> wopifileinfo = wopiStorage->getWOPIFileInfo(
            session->getAuthorization(), session->getCookies(), *_lockCtx);
        userId = wopifileinfo->getUserId();
        username = wopifileinfo->getUsername();
        userExtraInfo = wopifileinfo->getUserExtraInfo();
        watermarkText = wopifileinfo->getWatermarkText();
        templateSource = wopifileinfo->getTemplateSource();

        if (!wopifileinfo->getUserCanWrite() ||
            LOOLWSD::IsViewFileExtension(wopiStorage->getFileExtension()))
        {
            LOG_DBG("Setting the session as readonly");
            session->setReadOnly();
        }

        // Construct a JSON containing relevant WOPI host properties
        Object::Ptr wopiInfo = new Object();
        if (!wopifileinfo->getPostMessageOrigin().empty())
        {
            // Update the scheme to https if ssl or ssl termination is on
            if (wopifileinfo->getPostMessageOrigin().substr(0, 7) == "http://" &&
                (LOOLWSD::isSSLEnabled() || LOOLWSD::isSSLTermination()))
            {
                wopifileinfo->getPostMessageOrigin().replace(0, 4, "https");
                LOG_DBG("Updating PostMessageOrigin scheme to HTTPS. Updated origin is [" << wopifileinfo->getPostMessageOrigin() << "].");
            }

            wopiInfo->set("PostMessageOrigin", wopifileinfo->getPostMessageOrigin());
        }

        // If print, export are disabled, order client to hide these options in the UI
        if (wopifileinfo->getDisablePrint())
            wopifileinfo->setHidePrintOption(true);
        if (wopifileinfo->getDisableExport())
            wopifileinfo->setHideExportOption(true);

        wopiInfo->set("BaseFileName", wopiStorage->getFileInfo().getFilename());

        if (!wopifileinfo->getTemplateSaveAs().empty())
            wopiInfo->set("TemplateSaveAs", wopifileinfo->getTemplateSaveAs());

        if (!templateSource.empty())
                wopiInfo->set("TemplateSource", templateSource);

        wopiInfo->set("HidePrintOption", wopifileinfo->getHidePrintOption());
        wopiInfo->set("HideSaveOption", wopifileinfo->getHideSaveOption());
        wopiInfo->set("HideExportOption", wopifileinfo->getHideExportOption());
        wopiInfo->set("DisablePrint", wopifileinfo->getDisablePrint());
        wopiInfo->set("DisableExport", wopifileinfo->getDisableExport());
        wopiInfo->set("DisableCopy", wopifileinfo->getDisableCopy());
        wopiInfo->set("DisableInactiveMessages", wopifileinfo->getDisableInactiveMessages());
        wopiInfo->set("DownloadAsPostMessage", wopifileinfo->getDownloadAsPostMessage());
        wopiInfo->set("UserCanNotWriteRelative", wopifileinfo->getUserCanNotWriteRelative());
        wopiInfo->set("EnableInsertRemoteImage", wopifileinfo->getEnableInsertRemoteImage());
        wopiInfo->set("EnableShare", wopifileinfo->getEnableShare());
        wopiInfo->set("HideUserList", wopifileinfo->getHideUserList());
        wopiInfo->set("SupportsRename", wopifileinfo->getSupportsRename());
        wopiInfo->set("UserCanRename", wopifileinfo->getUserCanRename());
        if (wopifileinfo->getHideChangeTrackingControls() != WopiStorage::WOPIFileInfo::TriState::Unset)
            wopiInfo->set("HideChangeTrackingControls", wopifileinfo->getHideChangeTrackingControls() == WopiStorage::WOPIFileInfo::TriState::True);

        std::ostringstream ossWopiInfo;
        wopiInfo->stringify(ossWopiInfo);
        const std::string wopiInfoString = ossWopiInfo.str();
        LOG_TRC("Sending wopi info to client: " << wopiInfoString);

        // Contains PostMessageOrigin property which is necessary to post messages to parent
        // frame. Important to send this message immediately and not enqueue it so that in case
        // document load fails, loleaflet is able to tell its parent frame via PostMessage API.
        session->sendMessage("wopi: " + wopiInfoString);

        // Mark the session as 'Document owner' if WOPI hosts supports it
        if (userId == _storage->getFileInfo().getOwnerId())
        {
            LOG_DBG("Session [" << sessionId << "] is the document owner");
            session->setDocumentOwner(true);
        }

        getInfoCallDuration = wopifileinfo->getCallDuration();

        // Pass the ownership to client session
        session->setWopiFileInfo(wopifileinfo);
    }
    else
#endif
    {
        LocalStorage* localStorage = dynamic_cast<LocalStorage*>(_storage.get());
        if (localStorage != nullptr)
        {
            std::unique_ptr<LocalStorage::LocalFileInfo> localfileinfo = localStorage->getLocalFileInfo();
            userId = localfileinfo->getUserId();
            username = localfileinfo->getUsername();

            if (LOOLWSD::IsViewFileExtension(localStorage->getFileExtension()))
            {
                LOG_DBG("Setting the session as readonly");
                session->setReadOnly();
            }
        }
    }


#if ENABLE_SUPPORT_KEY
    if (!LOOLWSD::OverrideWatermark.empty())
        watermarkText = LOOLWSD::OverrideWatermark;
#endif

    LOG_DBG("Setting username [" << LOOLWSD::anonymizeUsername(username) << "] and userId [" <<
            LOOLWSD::anonymizeUsername(userId) << "] for session [" << sessionId << "]");

    session->setUserId(userId);
    session->setUserName(username);
    session->setUserExtraInfo(userExtraInfo);
    session->setWatermarkText(watermarkText);
    session->recalcCanonicalViewId(_sessions);

    // Basic file information was stored by the above getWOPIFileInfo() or getLocalFileInfo() calls
    const StorageBase::FileInfo fileInfo = _storage->getFileInfo();
    if (!fileInfo.isValid())
    {
        LOG_ERR("Invalid fileinfo for URI [" << session->getPublicUri().toString() << "].");
        return false;
    }

    if (firstInstance)
    {
        _documentLastModifiedTime = fileInfo.getModifiedTime();
        LOG_DBG("Document timestamp: " << _documentLastModifiedTime);
    }
    else
    {
        // Check if document has been modified by some external action
        LOG_TRC("Document modified time: " << fileInfo.getModifiedTime());
        static const std::chrono::system_clock::time_point Zero;
        if (_documentLastModifiedTime != Zero &&
            fileInfo.getModifiedTime() != Zero &&
            _documentLastModifiedTime != fileInfo.getModifiedTime())
        {
            LOG_DBG("Document " << _docKey << "] has been modified behind our back. " <<
                    "Informing all clients. Expected: " << _documentLastModifiedTime <<
                    ", Actual: " << fileInfo.getModifiedTime());

            _documentChangedInStorage = true;
            std::string message = "close: documentconflict";
            if (_isModified)
                message = "error: cmd=storage kind=documentconflict";

            session->sendTextFrame(message);
            broadcastMessage(message);
        }
    }

    sendLastModificationTime(session, this, _documentLastModifiedTime);

    // Let's load the document now, if not loaded.
    if (!_storage->isLoaded())
    {
        std::string localPath = _storage->loadStorageFileToLocal(
            session->getAuthorization(), session->getCookies(), *_lockCtx, templateSource);

        if (!_storage->updateLockState(session->getAuthorization(), session->getCookies(), *_lockCtx, true))
            LOG_ERR("Failed to lock!");

#if !MOBILEAPP
        // Check if we have a prefilter "plugin" for this document format
        for (const auto& plugin : LOOLWSD::PluginConfigurations)
        {
            try
            {
                const std::string extension(plugin->getString("prefilter.extension"));
                const std::string newExtension(plugin->getString("prefilter.newextension"));
                std::string commandLine(plugin->getString("prefilter.commandline"));

                if (localPath.length() > extension.length()+1 &&
                    strcasecmp(localPath.substr(localPath.length() - extension.length() -1).data(), (std::string(".") + extension).data()) == 0)
                {
                    // Extension matches, try the conversion. We convert the file to another one in
                    // the same (jail) directory, with just the new extension tacked on.

                    const std::string newRootPath = _storage->getRootFilePath() + "." + newExtension;

                    // The commandline must contain the space-separated substring @INPUT@ that is
                    // replaced with the input file name, and @OUTPUT@ for the output file name.
                    int inputs(0), outputs(0);

                    std::string input("@INPUT");
                    size_t pos = commandLine.find(input);
                    if (pos != std::string::npos)
                    {
                        commandLine.replace(pos, input.length(), _storage->getRootFilePath());
                        ++inputs;
                    }

                    std::string output("@OUTPUT@");
                    pos = commandLine.find(output);
                    if (pos != std::string::npos)
                    {
                        commandLine.replace(pos, output.length(), newRootPath);
                        ++outputs;
                    }

                    StringVector args(LOOLProtocol::tokenize(commandLine, ' '));
                    std::string command(args[0]);
                    args.erase(args.begin()); // strip the command

                    if (inputs != 1 || outputs != 1)
                        throw std::exception();

                    int process = Util::spawnProcess(command, args);
                    int status = -1;
                    const int rc = ::waitpid(process, &status, 0);
                    if (rc != 0)
                    {
                        LOG_ERR("Conversion from " << extension << " to " << newExtension << " failed (" << rc << ").");
                        return false;
                    }

                    _storage->setRootFilePath(newRootPath);
                    localPath += "." + newExtension;
                }

                // We successfully converted the file to something LO can use; break out of the for
                // loop.
                break;
            }
            catch (const std::exception&)
            {
                // This plugin is not a proper prefilter one
            }
        }
#endif

        std::ifstream istr(localPath, std::ios::binary);
        Poco::SHA1Engine sha1;
        Poco::DigestOutputStream dos(sha1);
        Poco::StreamCopier::copyStream(istr, dos);
        dos.close();
        LOG_INF("SHA1 for DocKey [" << _docKey << "] of [" << LOOLWSD::anonymizeUrl(localPath) << "]: " <<
                Poco::DigestEngine::digestToHex(sha1.digest()));

        std::string localPathEncoded;
        Poco::URI::encode(localPath, "#?", localPathEncoded);
        _uriJailed = Poco::URI(Poco::URI("file://"), localPathEncoded).toString();
        _uriJailedAnonym = Poco::URI(Poco::URI("file://"), LOOLWSD::anonymizeUrl(localPathEncoded)).toString();

        _filename = fileInfo.getFilename();

        // Use the local temp file's timestamp.
        _lastFileModifiedTime = templateSource.empty() ? Util::getFileTimestamp(_storage->getRootFilePath()) :
                std::chrono::system_clock::time_point();

        bool dontUseCache = false;
#if MOBILEAPP
        // avoid memory consumption for single-user local bits.
        // FIXME: arguably should/could do this for single user documents too.
        dontUseCache = true;
#endif

        _tileCache.reset(new TileCache(_storage->getUriString(), _lastFileModifiedTime, dontUseCache));
        _tileCache->setThreadOwner(std::this_thread::get_id());
    }

#if !MOBILEAPP
    LOOLWSD::dumpNewSessionTrace(getJailId(), sessionId, _uriOrig, _storage->getRootFilePath());

    // Since document has been loaded, send the stats if its WOPI
    if (wopiStorage != nullptr)
    {
        // Get the time taken to load the file from storage
        auto callDuration = wopiStorage->getWopiLoadDuration();
        // Add the time taken to check file info
        callDuration += getInfoCallDuration;
        _wopiLoadDuration = std::chrono::duration_cast<std::chrono::milliseconds>(callDuration);
        const std::string msg = "stats: wopiloadduration " + std::to_string(callDuration.count());
        LOG_TRC("Sending to Client [" << msg << "].");
        session->sendTextFrame(msg);
    }
#endif
    return true;
}

bool DocumentBroker::saveToStorage(const std::string& sessionId,
                                   bool success, const std::string& result, bool force)
{
    assertCorrectThread();

    // Force saving on exit, if enabled.
    if (!force && isMarkedToDestroy())
    {
        static const bool always_save = LOOLWSD::getConfigValue<bool>("per_document.always_save_on_exit", false);
        if (always_save)
        {
            LOG_TRC("Enabling forced saving to storage per always_save_on_exit config.");
            _storage->forceSave();
            force = true;
        }
    }

    constexpr bool isRename = false;
    const bool res = saveToStorageInternal(sessionId, success, result, /*saveAsPath*/ std::string(),
                                           /*saveAsFilename*/ std::string(), isRename, force);

    // If marked to destroy, or session is disconnected, remove.
    const auto it = _sessions.find(sessionId);
    if (_markToDestroy || (it != _sessions.end() && it->second->isCloseFrame()))
        disconnectSessionInternal(sessionId);

    // If marked to destroy, then this was the last session.
    if (_markToDestroy || _sessions.empty())
    {
        // Stop so we get cleaned up and removed.
        _stop = true;
    }

    return res;
}

bool DocumentBroker::saveAsToStorage(const std::string& sessionId, const std::string& saveAsPath, const std::string& saveAsFilename, const bool isRename)
{
    assertCorrectThread();

    return saveToStorageInternal(sessionId, true, "", saveAsPath, saveAsFilename, isRename);
}

bool DocumentBroker::saveToStorageInternal(const std::string& sessionId, bool success,
                                           const std::string& result, const std::string& saveAsPath,
                                           const std::string& saveAsFilename, const bool isRename,
                                           const bool force)
{
    assertCorrectThread();

    // Record that we got a response to avoid timing out on saving.
    _lastSaveResponseTime = std::chrono::steady_clock::now();

    // If save requested, but core didn't save because document was unmodified
    // notify the waiting thread, if any.
    LOG_TRC("Uploading to storage docKey [" << _docKey << "] for session [" << sessionId <<
            "]. Success: " << success << ", result: " << result << ", force: " << force);
    if (!success && result == "unmodified" && !isRename && !force)
    {
        LOG_DBG("Save skipped as document [" << _docKey << "] was not modified.");
        _lastSaveTime = std::chrono::steady_clock::now();
        _poll->wakeup();
        return true;
    }

    const auto it = _sessions.find(sessionId);
    if (it == _sessions.end())
    {
        LOG_ERR("Session with sessionId ["
                << sessionId << "] not found while storing document docKey [" << _docKey
                << "]. The document will not be uploaded to storage at this time.");
        return false;
    }

    // Check that we are actually about to upload a successfully saved document.
    if (!success && !force)
    {
        LOG_ERR("Cannot store docKey [" << _docKey << "] as .uno:Save has failed in LOK.");
        it->second->sendTextFrameAndLogError("error: cmd=storage kind=savefailed");
        return false;
    }

    if (force)
    {
        LOG_DBG("Document docKey [" << _docKey << "] will be forcefully uploaded to storage.");
    }

    const bool isSaveAs = !saveAsPath.empty();
    const Authorization auth = it->second->getAuthorization();
    const std::string uri = isSaveAs ? saveAsPath : it->second->getPublicUri().toString();

    // Map the FileId from the docKey to the new filename to anonymize the new filename as the FileId.
    const std::string newFilename = Util::getFilenameFromURL(uri);
    const std::string fileId = Util::getFilenameFromURL(_docKey);
    if (LOOLWSD::AnonymizeUserData)
        LOG_DBG("New filename [" << LOOLWSD::anonymizeUrl(newFilename) << "] will be known by its fileId [" << fileId << "]");

    Util::mapAnonymized(newFilename, fileId);
    const std::string uriAnonym = LOOLWSD::anonymizeUrl(uri);

    // If the file timestamp hasn't changed, skip saving.
    const std::chrono::system_clock::time_point newFileModifiedTime = Util::getFileTimestamp(_storage->getRootFilePath());
    if (!isSaveAs && newFileModifiedTime == _lastFileModifiedTime && !isRename)
    {
        // Nothing to do.
        auto timeInSec = std::chrono::duration_cast<std::chrono::seconds>
                                            (std::chrono::system_clock::now() - _lastFileModifiedTime);
        LOG_DBG("Skipping unnecessary saving to URI [" << uriAnonym << "] with docKey [" << _docKey <<
                "]. File last modified " << timeInSec.count() << " seconds ago.");
        _poll->wakeup();
        return true;
    }

    LOG_DBG("Persisting [" << _docKey << "] after saving to URI [" << uriAnonym << "].");

    assert(_storage && _tileCache);
    const StorageBase::SaveResult storageSaveResult = _storage->saveLocalFileToStorage(
        auth, it->second->getCookies(), *_lockCtx, saveAsPath, saveAsFilename, isRename);
    if (storageSaveResult.getResult() == StorageBase::SaveResult::OK)
    {
#if !MOBILEAPP
        WopiStorage* wopiStorage = dynamic_cast<WopiStorage*>(_storage.get());
        if (wopiStorage != nullptr)
            Admin::instance().setDocWopiUploadDuration(_docKey, std::chrono::duration_cast<std::chrono::milliseconds>(wopiStorage->getWopiSaveDuration()));
#endif

        if (!isSaveAs && !isRename)
        {
            // Saved and stored; update flags.
            setModified(false);
            _lastFileModifiedTime = newFileModifiedTime;
            _lastSaveTime = std::chrono::steady_clock::now();

            // Save the storage timestamp.
            _documentLastModifiedTime = _storage->getFileInfo().getModifiedTime();

            // After a successful save, we are sure that document in the storage is same as ours
            _documentChangedInStorage = false;

            LOG_DBG("Saved docKey [" << _docKey << "] to URI [" << uriAnonym << "] and updated timestamps. " <<
                    " Document modified timestamp: " << _documentLastModifiedTime);

            // Resume polling.
            _poll->wakeup();
        }
        else if (isRename)
        {
            // encode the name
            const std::string& filename = storageSaveResult.getSaveAsName();
            const std::string url = Poco::URI(storageSaveResult.getSaveAsUrl()).toString();
            std::string encodedName;
            Poco::URI::encode(filename, "", encodedName);
            const std::string filenameAnonym = LOOLWSD::anonymizeUrl(filename);

            std::ostringstream oss;
            oss << "renamefile: " << "filename=" << encodedName << " url=" << url;
            broadcastMessage(oss.str());
        }
        else
        {
            // normalize the url (mainly to " " -> "%20")
            const std::string url = Poco::URI(storageSaveResult.getSaveAsUrl()).toString();

            const std::string& filename = storageSaveResult.getSaveAsName();

            // encode the name
            std::string encodedName;
            Poco::URI::encode(filename, "", encodedName);
            const std::string filenameAnonym = LOOLWSD::anonymizeUrl(filename);

            std::ostringstream oss;
            oss << "saveas: url=" << url << " filename=" << encodedName
                << " xfilename=" << filenameAnonym;
            it->second->sendTextFrame(oss.str());

            LOG_DBG("Saved As docKey [" << _docKey << "] to URI [" << LOOLWSD::anonymizeUrl(url) <<
                    "] with name [" << filenameAnonym << "] successfully.");
        }

        sendLastModificationTime(it->second, this, _documentLastModifiedTime);

        return true;
    }
    else if (storageSaveResult.getResult() == StorageBase::SaveResult::DISKFULL)
    {
        LOG_WRN("Disk full while saving docKey [" << _docKey << "] to URI [" << uriAnonym <<
                "]. Making all sessions on doc read-only and notifying clients.");

        // Make everyone readonly and tell everyone that storage is low on diskspace.
        for (const auto& sessionIt : _sessions)
        {
            sessionIt.second->sendTextFrameAndLogError("error: cmd=storage kind=savediskfull");
        }
    }
    else if (storageSaveResult.getResult() == StorageBase::SaveResult::UNAUTHORIZED)
    {
        LOG_ERR("Cannot save docKey [" << _docKey << "] to storage URI [" << uriAnonym <<
                "]. Invalid or expired access token. Notifying client.");
        it->second->sendTextFrameAndLogError("error: cmd=storage kind=saveunauthorized");
    }
    else if (storageSaveResult.getResult() == StorageBase::SaveResult::FAILED)
    {
        //TODO: Should we notify all clients?
        LOG_ERR("Failed to save docKey [" << _docKey << "] to URI [" << uriAnonym << "]. Notifying client.");
        std::ostringstream oss;
        oss << "error: cmd=storage kind=" << (isRename ? "renamefailed" : "savefailed");
        it->second->sendTextFrame(oss.str());
    }
    else if (storageSaveResult.getResult() == StorageBase::SaveResult::DOC_CHANGED
             || storageSaveResult.getResult() == StorageBase::SaveResult::CONFLICT)
    {
        LOG_ERR("PutFile says that Document changed in storage");
        _documentChangedInStorage = true;
        std::string message = "close: documentconflict";
        if (_isModified)
            message = "error: cmd=storage kind=documentconflict";

        broadcastMessage(message);
    }

    return false;
}

void DocumentBroker::setLoaded()
{
    if (!_isLoaded)
    {
        _isLoaded = true;
        _loadDuration = std::chrono::duration_cast<std::chrono::milliseconds>(
                                std::chrono::steady_clock::now() - _threadStart);
        LOG_TRC("Document loaded in " << _loadDuration.count() << "ms");
    }
}

std::string DocumentBroker::getWriteableSessionId() const
{
    assertCorrectThread();

    std::string savingSessionId;
    for (auto& sessionIt : _sessions)
    {
        // Save the document using an editable and loaded session, or first ...
        if (savingSessionId.empty()
            || (!sessionIt.second->isReadOnly() && sessionIt.second->isViewLoaded()
                && !sessionIt.second->inWaitDisconnected()))
        {
            savingSessionId = sessionIt.second->getId();
        }

        // or if any of the sessions is document owner, use that.
        if (sessionIt.second->isDocumentOwner())
        {
            savingSessionId = sessionIt.second->getId();
            break;
        }
    }
    return savingSessionId;
}

void DocumentBroker::refreshLock()
{
    assertCorrectThread();

    std::string savingSessionId = getWriteableSessionId();
    LOG_TRC("Refresh lock " << _lockCtx->_lockToken << " with session " << savingSessionId);

    auto it = _sessions.find(savingSessionId);
    if (it == _sessions.end())
        LOG_ERR("No write-able session to refresh lock with");
    else
    {
        std::shared_ptr<ClientSession> session = it->second;
        if (!session || !_storage->updateLockState(session->getAuthorization(), session->getCookies(), *_lockCtx, true))
            LOG_ERR("Failed to refresh lock");
    }
}

bool DocumentBroker::autoSave(const bool force, const bool dontSaveIfUnmodified)
{
    assertCorrectThread();

    LOG_TRC("autoSave(): forceful? " << force);
    if (_sessions.empty() || _storage == nullptr || !_isLoaded ||
        !_childProcess->isAlive() || (!_isModified && !force))
    {
        // Nothing to do.
        LOG_TRC("Nothing to autosave [" << _docKey << "].");
        return false;
    }

    // Remember the last save time, since this is the predicate.
    LOG_TRC("Checking to autosave [" << _docKey << "].");

    // Which session to use when auto saving ?
    std::string savingSessionId = getWriteableSessionId();

    bool sent = false;
    if (force)
    {
        LOG_TRC("Sending forced save command for [" << _docKey << "].");
        // Don't terminate editing as this can be invoked by the admin OOM, but otherwise force saving anyway.
        // Flag isAutosave=false so the WOPI host wouldn't think this is a regular checkpoint and
        // potentially optimize it away. This is as good as user-issued save, since this is
        // triggered when the document is closed. In the case of network disconnection or browser crash
        // most users would want to have had the chance to hit save before the document unloaded.
        sent = sendUnoSave(savingSessionId, /*dontTerminateEdit=*/true,
                           dontSaveIfUnmodified, /*isAutosave=*/false,
                           /*isExitSave=*/true);
    }
    else if (_isModified)
    {
        const std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now();
        const std::chrono::milliseconds::rep inactivityTimeMs = std::chrono::duration_cast<std::chrono::milliseconds>(now - _lastActivityTime).count();
        const std::chrono::milliseconds::rep timeSinceLastSaveMs = std::chrono::duration_cast<std::chrono::milliseconds>(now - _lastSaveTime).count();
        LOG_TRC("Time since last save of docKey [" << _docKey << "] is " << timeSinceLastSaveMs <<
                "ms and most recent activity was " << inactivityTimeMs << "ms ago.");

        static const int idleSaveDurationMs = LOOLWSD::getConfigValue<int>("per_document.idlesave_duration_secs", 30) * 1000;
        static const int autoSaveDurationMs = LOOLWSD::getConfigValue<int>("per_document.autosave_duration_secs", 300) * 1000;
        bool save = false;
        // Zero or negative config value disables save.
        // Either we've been idle long enough, or it's auto-save time.
        if (idleSaveDurationMs > 0 && inactivityTimeMs >= idleSaveDurationMs)
        {
            save = true;
        }
        if (autoSaveDurationMs > 0 && timeSinceLastSaveMs >= autoSaveDurationMs)
        {
            save = true;
        }
        if (save)
        {
            LOG_TRC("Sending timed save command for [" << _docKey << "].");
            sent = sendUnoSave(savingSessionId, /*dontTerminateEdit=*/true,
                               /*dontSaveIfUnmodified=*/true, /*isAutosave=*/true,
                               /*isExitSave=*/false);
        }
    }

    return sent;
}

bool DocumentBroker::sendUnoSave(const std::string& sessionId, bool dontTerminateEdit,
                                 bool dontSaveIfUnmodified, bool isAutosave, bool isExitSave,
                                 const std::string& extendedData)
{
    assertCorrectThread();

    LOG_INF("Saving doc [" << _docKey << "].");

    if (_sessions.find(sessionId) != _sessions.end())
    {
        // Invalidate the timestamp to force persisting.
        _lastFileModifiedTime = std::chrono::system_clock::time_point();

        // We do not want save to terminate editing mode if we are in edit mode now

        std::ostringstream oss;
        // arguments init
        oss << "{";

        if (dontTerminateEdit)
        {
            oss << "\"DontTerminateEdit\":"
                << "{"
                << "\"type\":\"boolean\","
                << "\"value\":true"
                << "}";
        }

        if (dontSaveIfUnmodified)
        {
            if (dontTerminateEdit)
                oss << ",";

            oss << "\"DontSaveIfUnmodified\":"
                << "{"
                << "\"type\":\"boolean\","
                << "\"value\":true"
                << "}";
        }

        // arguments end
        oss << "}";

        assert(_storage);
        _storage->setIsAutosave(isAutosave || UnitWSD::get().isAutosave());
        _storage->setIsExitSave(isExitSave);
        _storage->setExtendedData(extendedData);

        const std::string saveArgs = oss.str();
        LOG_TRC(".uno:Save arguments: " << saveArgs);
        const auto command = "uno .uno:Save " + saveArgs;
        forwardToChild(sessionId, command);
        _lastSaveRequestTime = std::chrono::steady_clock::now();
#ifdef IOS
        // We need to do this so that file provider extensions notice. Just like in
        // -[DocumentViewController bye] I suspect that will read the file and then overwrite it
        // with the same contents, but oh well.
        CODocument *document = [[DocumentViewController singleton] document];
        [document saveToURL:[[[DocumentViewController singleton] document] fileURL]
           forSaveOperation:UIDocumentSaveForOverwriting
          completionHandler:^(BOOL success) {
                LOG_TRC("save completion handler gets " << (success?"YES":"NO"));
            }];
#endif
        return true;
    }

    LOG_ERR("Failed to save doc [" << _docKey << "]: No valid sessions.");
    return false;
}

std::string DocumentBroker::getJailRoot() const
{
    assert(!_jailId.empty());
    return Poco::Path(LOOLWSD::ChildRoot, _jailId).toString();
}

size_t DocumentBroker::addSession(const std::shared_ptr<ClientSession>& session)
{
    try
    {
        return addSessionInternal(session);
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to add session to [" << _docKey << "] with URI [" << LOOLWSD::anonymizeUrl(session->getPublicUri().toString()) << "]: " << exc.what());
        if (_sessions.empty())
        {
            LOG_INF("Doc [" << _docKey << "] has no more sessions. Marking to destroy.");
            _markToDestroy = true;
        }

        throw;
    }
}

size_t DocumentBroker::addSessionInternal(const std::shared_ptr<ClientSession>& session)
{
    assertCorrectThread();

    try
    {
        // First load the document, since this can fail.
        if (!load(session, _childProcess->getJailId()))
        {
            const auto msg = "Failed to load document with URI [" + session->getPublicUri().toString() + "].";
            LOG_ERR(msg);
            throw std::runtime_error(msg);
        }
    }
    catch (const StorageSpaceLowException&)
    {
        LOG_ERR("Out of storage while loading document with URI [" << session->getPublicUri().toString() << "].");

        // We use the same message as is sent when some of lool's own locations are full,
        // even if in this case it might be a totally different location (file system, or
        // some other type of storage somewhere). This message is not sent to all clients,
        // though, just to all sessions of this document.
        alertAllUsers("internal", "diskfull");
        throw;
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("loading document exception: " << exc.what());
        throw;
    }

    const std::string id = session->getId();

    // Request a new session from the child kit.
    const std::string aMessage = "session " + id + ' ' + _docKey + ' ' + _docId;
    _childProcess->sendTextFrame(aMessage);

#if !MOBILEAPP
    // Tell the admin console about this new doc
    Admin::instance().addDoc(_docKey, getPid(), getFilename(), id, session->getUserName(), session->getUserId());
    Admin::instance().setDocWopiDownloadDuration(_docKey, _wopiLoadDuration);
#endif

    // Add and attach the session.
    _sessions.emplace(session->getId(), session);
    session->setState(ClientSession::SessionState::LOADING);

    const size_t count = _sessions.size();
    LOG_TRC("Added " << (session->isReadOnly() ? "readonly" : "non-readonly") <<
            " session [" << id << "] to docKey [" <<
            _docKey << "] to have " << count << " sessions.");

    return count;
}

size_t DocumentBroker::removeSession(const std::string& id)
{
    assertCorrectThread();

    try
    {
        const auto it = _sessions.find(id);
        if (it == _sessions.end())
        {
            LOG_ERR("Invalid or unknown session [" << id << "] to remove.");
            return _sessions.size();
        }
        std::shared_ptr<ClientSession> session = it->second;

        // Last view going away, can destroy.
        _markToDestroy = (_sessions.size() <= 1);

        const bool lastEditableSession = !session->isReadOnly() && !haveAnotherEditableSession(id);
        static const bool dontSaveIfUnmodified = !LOOLWSD::getConfigValue<bool>("per_document.always_save_on_exit", false);

        LOG_INF("Removing session ["
                << id << "] on docKey [" << _docKey << "]. Have " << _sessions.size()
                << " sessions. IsReadOnly: " << session->isReadOnly()
                << ", IsViewLoaded: " << session->isViewLoaded() << ", IsWaitDisconnected: "
                << session->inWaitDisconnected() << ", MarkToDestroy: " << _markToDestroy
                << ", LastEditableSession: " << lastEditableSession << ", DontSaveIfUnmodified: "
                << dontSaveIfUnmodified << ", IsPossiblyModified: " << isPossiblyModified());

        // If last editable, save and don't remove until after uploading to storage.
        if (!lastEditableSession || !autoSave(isPossiblyModified(), dontSaveIfUnmodified))
            disconnectSessionInternal(id);
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Error while removing session [" << id << "]: " << ex.what());
    }

    return _sessions.size();
}

void DocumentBroker::disconnectSessionInternal(const std::string& id)
{
    assertCorrectThread();
    try
    {
#if !MOBILEAPP
        Admin::instance().rmDoc(_docKey, id);
#endif
        auto it = _sessions.find(id);
        if (it != _sessions.end())
        {
#if !MOBILEAPP
            LOOLWSD::dumpEndSessionTrace(getJailId(), id, _uriOrig);
#endif

            LOG_TRC("Disconnect session internal " << id <<
                    " destroy? " << _markToDestroy <<
                    " locked? " << _lockCtx->_isLocked);

            if (_markToDestroy && // last session to remove; FIXME: Editable?
                _lockCtx->_isLocked && _storage)
            {
                if (!_storage->updateLockState(it->second->getAuthorization(), it->second->getCookies(), *_lockCtx, false))
                    LOG_ERR("Failed to unlock!");
            }

            bool hardDisconnect;
            if (it->second->inWaitDisconnected())
            {
                LOG_TRC("hard disconnecting while waiting for disconnected handshake.");
                hardDisconnect = true;
            }
            else
            {
                hardDisconnect = it->second->disconnectFromKit();

                // Let the child know the client has disconnected.
                const std::string msg("child-" + id + " disconnect");
                _childProcess->sendTextFrame(msg);
            }

            if (hardDisconnect)
                finalRemoveSession(id);
            // else wait for disconnected.
        }
        else
        {
            LOG_TRC("Session [" << id << "] not found to disconnect from docKey [" <<
                    _docKey << "]. Have " << _sessions.size() << " sessions.");
        }
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Error while disconnecting session [" << id << "]: " << ex.what());
    }
}

void DocumentBroker::finalRemoveSession(const std::string& id)
{
    assertCorrectThread();
    try
    {
        auto it = _sessions.find(id);
        if (it != _sessions.end())
        {
            const bool readonly = (it->second ? it->second->isReadOnly() : false);

            // Remove. The caller must have a reference to the session
            // in question, lest we destroy from underneath them.
            it->second->dispose();
            _sessions.erase(it);
            const size_t count = _sessions.size();

            Log::StreamLogger logger = Log::trace();
            if (logger.enabled())
            {
                logger << "Removed " << (readonly ? "readonly" : "non-readonly")
                       << " session [" << id << "] from docKey ["
                       << _docKey << "] to have " << count << " sessions:";
                for (const auto& pair : _sessions)
                    logger << pair.second->getId() << ' ';

                LOG_END(logger, true);
            }

            return;
        }
        else
        {
            LOG_TRC("Session [" << id << "] not found to remove from docKey [" <<
                    _docKey << "]. Have " << _sessions.size() << " sessions.");
        }
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Error while removing session [" << id << "]: " << ex.what());
    }
}

std::shared_ptr<ClientSession> DocumentBroker::createNewClientSession(
    const std::shared_ptr<ProtocolHandlerInterface> &ws,
    const std::string& id,
    const Poco::URI& uriPublic,
    const bool isReadOnly,
    const std::string& hostNoTrust)
{
    try
    {
        // Now we have a DocumentBroker and we're ready to process client commands.
        if (ws)
        {
            const std::string statusReady = "statusindicator: ready";
            LOG_TRC("Sending to Client [" << statusReady << "].");
            ws->sendTextMessage(statusReady.c_str(), statusReady.size());
        }

        // In case of WOPI, if this session is not set as readonly, it might be set so
        // later after making a call to WOPI host which tells us the permission on files
        // (UserCanWrite param).
        auto session = std::make_shared<ClientSession>(ws, id, shared_from_this(), uriPublic, isReadOnly, hostNoTrust);
        session->construct();

        return session;
    }
    catch (const std::exception& exc)
    {
        LOG_WRN("Exception while preparing session [" << id << "]: " << exc.what());
    }

    return nullptr;
}

void DocumentBroker::addCallback(const SocketPoll::CallbackFn& fn)
{
    _poll->addCallback(fn);
}

void DocumentBroker::addSocketToPoll(const std::shared_ptr<Socket>& socket)
{
    _poll->insertNewSocket(socket);
}

void DocumentBroker::alertAllUsers(const std::string& msg)
{
    assertCorrectThread();

    if (UnitWSD::get().filterAlertAllusers(msg))
        return;

    auto payload = std::make_shared<Message>(msg, Message::Dir::Out);

    LOG_DBG("Alerting all users of [" << _docKey << "]: " << msg);
    for (auto& it : _sessions)
    {
        if (!it.second->inWaitDisconnected())
            it.second->enqueueSendMessage(payload);
    }
}

/// Handles input from the prisoner / child kit process
bool DocumentBroker::handleInput(const std::vector<char>& payload)
{
    auto message = std::make_shared<Message>(payload.data(), payload.size(), Message::Dir::Out);
    const auto& msg = message->abbr();
    LOG_TRC("DocumentBroker handling child message: [" << msg << "].");

#if !MOBILEAPP
    LOOLWSD::dumpOutgoingTrace(getJailId(), "0", msg);
#endif

    if (LOOLProtocol::getFirstToken(message->forwardToken(), '-') == "client")
    {
        forwardToClient(message);
    }
    else
    {
        const auto& command = message->firstToken();
        if (command == "tile:")
        {
            handleTileResponse(payload);
        }
        else if (command == "tilecombine:")
        {
            handleTileCombinedResponse(payload);
        }
        else if (command == "errortoall:")
        {
            LOG_CHECK_RET(message->tokens().size() == 3, false);
            std::string cmd, kind;
            LOOLProtocol::getTokenString((*message)[1], "cmd", cmd);
            LOG_CHECK_RET(cmd != "", false);
            LOOLProtocol::getTokenString((*message)[2], "kind", kind);
            LOG_CHECK_RET(kind != "", false);
            Util::alertAllUsers(cmd, kind);
        }
#if !MOBILEAPP
        else if (command == "procmemstats:")
        {
            int dirty;
            if (message->getTokenInteger("dirty", dirty))
            {
                Admin::instance().updateMemoryDirty(
                    _docKey, dirty + getMemorySize()/1024);
            }
        }
#endif
        else
        {
            LOG_ERR("Unexpected message: [" << msg << "].");
            return false;
        }
    }

    return true;
}

size_t DocumentBroker::getMemorySize() const
{
    return sizeof(DocumentBroker) +
        (!!_tileCache ? _tileCache->getMemorySize() : 0) +
        _sessions.size() * sizeof(ClientSession);
}

void DocumentBroker::invalidateTiles(const std::string& tiles, int normalizedViewId)
{
    // Remove from cache.
    _tileCache->invalidateTiles(tiles, normalizedViewId);
}

void DocumentBroker::handleTileRequest(TileDesc& tile,
                                       const std::shared_ptr<ClientSession>& session)
{
    assertCorrectThread();
    std::unique_lock<std::mutex> lock(_mutex);

    tile.setVersion(++_tileVersion);
    const std::string tileMsg = tile.serialize();
    LOG_TRC("Tile request for " << tileMsg);

    TileCache::Tile cachedTile = _tileCache->lookupTile(tile);
    if (cachedTile)
    {
        const std::string response = tile.serialize("tile:", ADD_DEBUG_RENDERID);
        session->sendTile(response, cachedTile);
        return;
    }

    if (tile.getBroadcast())
    {
        for (auto& it: _sessions)
        {
            if (!it.second->inWaitDisconnected())
                tileCache().subscribeToTileRendering(tile, it.second);
        }
    }
    else
    {
        tileCache().subscribeToTileRendering(tile, session);
    }

    // Forward to child to render.
    LOG_DBG("Sending render request for tile (" << tile.getPart() << ',' <<
            tile.getTilePosX() << ',' << tile.getTilePosY() << ").");
    const std::string request = "tile " + tileMsg;
    _childProcess->sendTextFrame(request);
    _debugRenderedTileCount++;
}

void DocumentBroker::handleTileCombinedRequest(TileCombined& tileCombined,
                                               const std::shared_ptr<ClientSession>& session)
{
    std::unique_lock<std::mutex> lock(_mutex);

    LOG_TRC("TileCombined request for " << tileCombined.serialize());

    // Check which newly requested tiles need rendering.
    std::vector<TileDesc> tilesNeedsRendering;
    for (auto& tile : tileCombined.getTiles())
    {
        tile.setVersion(++_tileVersion);
        TileCache::Tile cachedTile = _tileCache->lookupTile(tile);
        if(!cachedTile)
        {
            // Not cached, needs rendering.
            tilesNeedsRendering.push_back(tile);
            _debugRenderedTileCount++;
            tileCache().registerTileBeingRendered(tile);
        }
    }

    // Send rendering request, prerender before we actually send the tiles
    if (!tilesNeedsRendering.empty())
    {
        TileCombined newTileCombined = TileCombined::create(tilesNeedsRendering);

        // Forward to child to render.
        const std::string req = newTileCombined.serialize("tilecombine");
        LOG_TRC("Sending uncached residual tilecombine request to Kit: " << req);
        _childProcess->sendTextFrame(req);
    }

    // Accumulate tiles
    std::deque<TileDesc>& requestedTiles = session->getRequestedTiles();
    if (requestedTiles.empty())
    {
        requestedTiles = std::deque<TileDesc>(tileCombined.getTiles().begin(), tileCombined.getTiles().end());
    }
    // Drop duplicated tiles, but use newer version number
    else
    {
        for (const auto& newTile : tileCombined.getTiles())
        {
            const TileDesc& firstOldTile = *(requestedTiles.begin());
            if(!session->isTextDocument() && newTile.getPart() != firstOldTile.getPart())
            {
                LOG_WRN("Different part numbers in tile requests");
            }
            else if (newTile.getTileWidth() != firstOldTile.getTileWidth() ||
                     newTile.getTileHeight() != firstOldTile.getTileHeight() )
            {
                LOG_WRN("Different tile sizes in tile requests");
            }

            bool tileFound = false;
            for (auto& oldTile : requestedTiles)
            {
                if(oldTile.getTilePosX() == newTile.getTilePosX() &&
                   oldTile.getTilePosY() == newTile.getTilePosY() &&
                   oldTile.getNormalizedViewId() == newTile.getNormalizedViewId())
                {
                    oldTile.setVersion(newTile.getVersion());
                    oldTile.setOldWireId(newTile.getOldWireId());
                    oldTile.setWireId(newTile.getWireId());
                    tileFound = true;
                    break;
                }
            }
            if(!tileFound)
                requestedTiles.push_back(newTile);
        }
    }

    lock.unlock();
    lock.release();
    sendRequestedTiles(session);
}

/// lookup in global clipboard cache and send response, send error if missing if @sendError
bool DocumentBroker::lookupSendClipboardTag(const std::shared_ptr<StreamSocket> &socket,
                                            const std::string &tag, bool sendError)
{
    LOG_TRC("Clipboard request " << tag << " not for a live session - check cache.");
#if !MOBILEAPP
    std::shared_ptr<std::string> saved =
        LOOLWSD::SavedClipboards->getClipboard(tag);
    if (saved)
    {
            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "Last-Modified: " << Util::getHttpTimeNow() << "\r\n"
                << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                << "Content-Length: " << saved->length() << "\r\n"
                << "Content-Type: application/octet-stream\r\n"
                << "X-Content-Type-Options: nosniff\r\n"
                << "\r\n";
            oss.write(saved->c_str(), saved->length());
            socket->setSocketBufferSize(std::min(saved->length() + 256,
                                                 size_t(Socket::MaximumSendBufferSize)));
            socket->send(oss.str());
            socket->shutdown();
            LOG_INF("Found and queued clipboard response for send of size " << saved->length());
            return true;
    }
#endif

    if (!sendError)
        return false;

#if !MOBILEAPP
    // Bad request.
    std::ostringstream oss;
    oss << "HTTP/1.1 400\r\n"
        << "Date: " << Util::getHttpTimeNow() << "\r\n"
        << "User-Agent: LOOLWSD WOPI Agent\r\n"
        << "Content-Length: 0\r\n"
        << "\r\n"
        << "Failed to find this clipboard";
    socket->send(oss.str());
#endif
    socket->shutdown();

    return false;
}

void DocumentBroker::handleClipboardRequest(ClipboardRequest type,  const std::shared_ptr<StreamSocket> &socket,
                                            const std::string &viewId, const std::string &tag,
                                            const std::shared_ptr<std::string> &data)
{
    for (auto& it : _sessions)
    {
        if (it.second->matchesClipboardKeys(viewId, tag))
        {
            it.second->handleClipboardRequest(type, socket, tag, data);
            return;
        }
    }
    if (!lookupSendClipboardTag(socket, tag, true))
        LOG_ERR("Could not find matching session to handle clipboard request for " << viewId << " tag: " << tag);
}

void DocumentBroker::sendRequestedTiles(const std::shared_ptr<ClientSession>& session)
{
    std::unique_lock<std::mutex> lock(_mutex);

    // How many tiles we have on the visible area, set the upper limit accordingly
    Util::Rectangle normalizedVisArea = session->getNormalizedVisibleArea();

    float tilesOnFlyUpperLimit = 0;
    if (normalizedVisArea.hasSurface() && session->getTileWidthInTwips() != 0 && session->getTileHeightInTwips() != 0)
    {
        const int tilesFitOnWidth = std::ceil(normalizedVisArea.getRight() / session->getTileWidthInTwips()) -
                                    std::ceil(normalizedVisArea.getLeft() / session->getTileWidthInTwips()) + 1;
        const int tilesFitOnHeight = std::ceil(normalizedVisArea.getBottom() / session->getTileHeightInTwips()) -
                                     std::ceil(normalizedVisArea.getTop() / session->getTileHeightInTwips()) + 1;
        const int tilesInVisArea = tilesFitOnWidth * tilesFitOnHeight;

        tilesOnFlyUpperLimit = std::max(TILES_ON_FLY_MIN_UPPER_LIMIT, tilesInVisArea * 1.1f);
    }
    else
    {
        tilesOnFlyUpperLimit = 200; // Have a big number here to get all tiles requested by file opening
    }

    // Drop tiles which we are waiting for too long
    session->removeOutdatedTilesOnFly();

    // All tiles were processed on client side that we sent last time, so we can send
    // a new batch of tiles which was invalidated / requested in the meantime
    std::deque<TileDesc>& requestedTiles = session->getRequestedTiles();
    if (!requestedTiles.empty())
    {
        size_t delayedTiles = 0;
        std::vector<TileDesc> tilesNeedsRendering;
        size_t beingRendered = _tileCache->countTilesBeingRenderedForSession(session);
        while(session->getTilesOnFlyCount() + beingRendered < tilesOnFlyUpperLimit &&
              !requestedTiles.empty() &&
              // If we delayed all tiles we don't send any tile (we will when next tileprocessed message arrives)
              delayedTiles < requestedTiles.size())
        {
            TileDesc& tile = *(requestedTiles.begin());

            // We already sent out two versions of the same tile, let's not send the third one
            // until we get a tileprocessed message for this specific tile.
            if (session->countIdenticalTilesOnFly(tile) >= 2)
            {
                requestedTiles.push_back(requestedTiles.front());
                requestedTiles.pop_front();
                delayedTiles += 1;
                LOG_INF("Requested tile was delayed!");
                continue;
            }

            // Satisfy as many tiles from the cache.
            TileCache::Tile cachedTile = _tileCache->lookupTile(tile);
            if (cachedTile)
            {
                //TODO: Combine the response to reduce latency.
                const std::string response = tile.serialize("tile:", ADD_DEBUG_RENDERID);
                session->sendTile(response, cachedTile);
            }
            else
            {
                // Not cached, needs rendering.
                if (!tileCache().hasTileBeingRendered(tile) || // There is no in progress rendering of the given tile
                    tileCache().getTileBeingRenderedVersion(tile) < tile.getVersion()) // We need a newer version
                {
                    tile.setVersion(++_tileVersion);
                    tilesNeedsRendering.push_back(tile);
                    _debugRenderedTileCount++;
                }
                tileCache().subscribeToTileRendering(tile, session);
                beingRendered++;
            }
            requestedTiles.pop_front();
        }

        // Send rendering request for those tiles which were not prerendered
        if (!tilesNeedsRendering.empty())
        {
            TileCombined newTileCombined = TileCombined::create(tilesNeedsRendering);

            // Forward to child to render.
            const std::string req = newTileCombined.serialize("tilecombine");
            LOG_TRC("Some of the tiles were not prerendered. Sending residual tilecombine: " << req);
            _childProcess->sendTextFrame(req);
        }
    }
}

void DocumentBroker::cancelTileRequests(const std::shared_ptr<ClientSession>& session)
{
    std::unique_lock<std::mutex> lock(_mutex);

    // Clear tile requests
    session->clearTilesOnFly();

    session->getRequestedTiles().clear();

    session->resetWireIdMap();

    if (!hasTileCache())
        return;

    const std::string canceltiles = tileCache().cancelTiles(session);
    if (!canceltiles.empty())
    {
        LOG_DBG("Forwarding canceltiles request: " << canceltiles);
        _childProcess->sendTextFrame(canceltiles);
    }
}

void DocumentBroker::handleTileResponse(const std::vector<char>& payload)
{
    const std::string firstLine = getFirstLine(payload);
    LOG_DBG("Handling tile: " << firstLine);

    try
    {
        const size_t length = payload.size();
        if (firstLine.size() < static_cast<std::string::size_type>(length) - 1)
        {
            const TileDesc tile = TileDesc::parse(firstLine);
            const char* buffer = payload.data();
            const size_t offset = firstLine.size() + 1;

            std::unique_lock<std::mutex> lock(_mutex);

            tileCache().saveTileAndNotify(tile, buffer + offset, length - offset);
        }
        else
        {
            LOG_WRN("Dropping empty tile response: " << firstLine);
            // They will get re-issued if we don't forget them.
        }
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to process tile response [" << firstLine << "]: " << exc.what() << ".");
    }
}

void DocumentBroker::handleTileCombinedResponse(const std::vector<char>& payload)
{
    const std::string firstLine = getFirstLine(payload);
    LOG_DBG("Handling tile combined: " << firstLine);

    try
    {
        const size_t length = payload.size();
        if (firstLine.size() < static_cast<std::string::size_type>(length) - 1)
        {
            const TileCombined tileCombined = TileCombined::parse(firstLine);
            const char* buffer = payload.data();
            size_t offset = firstLine.size() + 1;

            std::unique_lock<std::mutex> lock(_mutex);

            for (const auto& tile : tileCombined.getTiles())
            {
                tileCache().saveTileAndNotify(tile, buffer + offset, tile.getImgSize());
                offset += tile.getImgSize();
            }
        }
        else
        {
            LOG_INF("Dropping empty tilecombine response: " << firstLine);
            // They will get re-issued if we don't forget them.
        }
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to process tile response [" << firstLine << "]: " << exc.what() << ".");
    }
}

bool DocumentBroker::haveAnotherEditableSession(const std::string& id) const
{
    assertCorrectThread();

    for (const auto& it : _sessions)
    {
        if (it.second->getId() != id &&
            it.second->isViewLoaded() &&
            !it.second->isReadOnly() &&
            !it.second->inWaitDisconnected())
        {
            // This is a loaded session that is non-readonly.
            return true;
        }
    }

    // None found.
    return false;
}

void DocumentBroker::setModified(const bool value)
{
    if (_isModified != value)
    {
        _isModified = value;
#if !MOBILEAPP
        Admin::instance().modificationAlert(_docKey, getPid(), value);
#endif
    }

    _storage->setUserModified(value);
}

bool DocumentBroker::isInitialSettingSet(const std::string& name) const
{
    return _isInitialStateSet.find(name) != _isInitialStateSet.end();
}

void DocumentBroker::setInitialSetting(const std::string& name)
{
    _isInitialStateSet.emplace(name);
}

bool DocumentBroker::forwardToChild(const std::string& viewId, const std::string& message)
{
    assertCorrectThread();

    // Ignore userinactive, useractive message until document is loaded
    if (!isLoaded() && (message == "userinactive" || message == "useractive"))
    {
        return true;
    }

    LOG_TRC("Forwarding payload to child [" << viewId << "]: " << getAbbreviatedMessage(message));

    if (Log::traceEnabled() && Util::startsWith(message, "paste "))
        LOG_TRC("Logging paste payload (" << message.size() << " bytes) '" << message << "' end paste");

    std::string msg = "child-" + viewId + ' ' + message;

    const auto it = _sessions.find(viewId);
    if (it != _sessions.end())
    {
        assert(!_uriJailed.empty());

        StringVector tokens = LOOLProtocol::tokenize(msg);
        if (tokens.size() > 1 && tokens.equals(1, "load"))
        {
            // The json options must come last.
            msg = tokens[0] + ' ' + tokens[1] + ' ' + tokens[2];
            msg += " jail=" + _uriJailed;
            msg += " xjail=" + _uriJailedAnonym;
            msg += ' ' + tokens.cat(std::string(" "), 3);
        }

        _childProcess->sendTextFrame(msg);
        return true;
    }

    // try the not yet created sessions
    LOG_WRN("Child session [" << viewId << "] not found to forward message: " << getAbbreviatedMessage(message));

    return false;
}

bool DocumentBroker::forwardToClient(const std::shared_ptr<Message>& payload)
{
    assertCorrectThread();

    const std::string& msg = payload->abbr();
    const std::string& prefix = payload->forwardToken();
    LOG_TRC("Forwarding payload to [" << prefix << "]: " << msg);

    std::string name;
    std::string sid;
    if (LOOLProtocol::parseNameValuePair(payload->forwardToken(), name, sid, '-') && name == "client")
    {
        const auto& data = payload->data().data();
        const auto& size = payload->size();

        if (sid == "all")
        {
            // Broadcast to all.
            // Events could cause the removal of sessions.
            std::map<std::string, std::shared_ptr<ClientSession>> sessions(_sessions);
            for (const auto& it : _sessions)
            {
                if (!it.second->inWaitDisconnected())
                    it.second->handleKitToClientMessage(data, size);
            }
        }
        else
        {
            const auto it = _sessions.find(sid);
            if (it != _sessions.end())
            {
                // Take a ref as the session could be removed from _sessions
                // if it's the save confirmation keeping a stopped session alive.
                std::shared_ptr<ClientSession> session = it->second;
                return session->handleKitToClientMessage(data, size);
            }
            else
            {
                LOG_WRN("Client session [" << sid << "] not found to forward message: " << msg);
            }
        }
    }
    else
    {
        LOG_ERR("Unexpected prefix of forward-to-client message: " << prefix);
    }

    return false;
}

void DocumentBroker::shutdownClients(const std::string& closeReason)
{
    assertCorrectThread();
    LOG_INF("Terminating " << _sessions.size() << " clients of doc [" << _docKey << "] with reason: " << closeReason);

    // First copy into local container, since removeSession
    // will erase from _sessions, but will leave the last.
    std::map<std::string, std::shared_ptr<ClientSession>> sessions = _sessions;
    for (const auto& pair : sessions)
    {
        std::shared_ptr<ClientSession> session = pair.second;
        try
        {
            if (session->inWaitDisconnected())
                finalRemoveSession(session->getId());
            else
            {
                // Notify the client and disconnect.
                session->shutdownGoingAway(closeReason);

                // Remove session, save, and mark to destroy.
                removeSession(session->getId());
            }
        }
        catch (const std::exception& exc)
        {
            LOG_WRN("Error while shutting down client [" <<
                    session->getName() << "]: " << exc.what());
        }
    }
}

void DocumentBroker::childSocketTerminated()
{
    assertCorrectThread();

    if (!_childProcess->isAlive())
    {
        LOG_ERR("Child for doc [" << _docKey << "] terminated prematurely.");
    }

    // We could restore the kit if this was unexpected.
    // For now, close the connections to cleanup.
    shutdownClients("terminated");
}

void DocumentBroker::terminateChild(const std::string& closeReason)
{
    assertCorrectThread();

    LOG_INF("Terminating doc [" << _docKey << "] with reason: " << closeReason);

    // Close all running sessions first.
    shutdownClients(closeReason);

    if (_childProcess)
    {
        LOG_INF("Terminating child [" << getPid() << "] of doc [" << _docKey << "].");

        _childProcess->close();
    }

    stop(closeReason);
}

void DocumentBroker::closeDocument(const std::string& reason)
{
    assertCorrectThread();

    LOG_DBG("Closing DocumentBroker for docKey [" << _docKey << "] with reason: " << reason);
    _closeReason = reason;
    _closeRequest = true;
}

void DocumentBroker::broadcastMessage(const std::string& message)
{
    assertCorrectThread();

    LOG_DBG("Broadcasting message [" << message << "] to all sessions.");
    for (const auto& sessionIt : _sessions)
    {
        sessionIt.second->sendTextFrame(message);
    }
}

void DocumentBroker::updateLastActivityTime()
{
    _lastActivityTime = std::chrono::steady_clock::now();
#if !MOBILEAPP
    Admin::instance().updateLastActivityTime(_docKey);
#endif
}

void DocumentBroker::getIOStats(uint64_t &sent, uint64_t &recv)
{
    sent = 0;
    recv = 0;
    assertCorrectThread();
    for (const auto& sessionIt : _sessions)
    {
        uint64_t s, r;
        sessionIt.second->getIOStats(s, r);
        sent += s;
        recv += r;
    }
}

static std::atomic<size_t> NumConverters;

size_t ConvertToBroker::getInstanceCount()
{
    return NumConverters;
}

ConvertToBroker::ConvertToBroker(const std::string& uri,
                                 const Poco::URI& uriPublic,
                                 const std::string& docKey,
                                 const std::string& format,
                                 const std::string& sOptions) :
    DocumentBroker(uri, uriPublic, docKey),
    _format(format),
    _sOptions(sOptions)
{
    static const int limit_convert_secs = LOOLWSD::getConfigValue<int>("per_document.limit_convert_secs", 100);
    NumConverters++;
    _limitLifeSeconds = limit_convert_secs;
}

#if !MOBILEAPP
bool ConvertToBroker::startConversion(SocketDisposition &disposition, const std::string &id)
{
    std::shared_ptr<ConvertToBroker> docBroker = std::static_pointer_cast<ConvertToBroker>(shared_from_this());

    // Create a session to load the document.
    const bool isReadOnly = true;
    // FIXME: associate this with moveSocket (?)
    std::shared_ptr<ProtocolHandlerInterface> nullPtr;
    _clientSession = std::make_shared<ClientSession>(nullPtr, id, docBroker, getPublicUri(), isReadOnly, "nocliphost");
    _clientSession->construct();

    if (!_clientSession)
        return false;

    disposition.setMove([docBroker] (const std::shared_ptr<Socket> &moveSocket)
        {
            // Perform all of this after removing the socket

            // Make sure the thread is running before adding callback.
            docBroker->startThread();

            // We no longer own this socket.
            moveSocket->setThreadOwner(std::thread::id(0));

            docBroker->addCallback([docBroker, moveSocket]()
                 {
                     auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);
                     docBroker->_clientSession->setSaveAsSocket(streamSocket);

                     // Move the socket into DocBroker.
                     docBroker->addSocketToPoll(moveSocket);

                     // First add and load the session.
                     docBroker->addSession(docBroker->_clientSession);

                     // Load the document manually and request saving in the target format.
                     std::string encodedFrom;
                     Poco::URI::encode(docBroker->getPublicUri().getPath(), "", encodedFrom);
                     const std::string _load = "load url=" + encodedFrom;
                     std::vector<char> loadRequest(_load.begin(), _load.end());
                     docBroker->_clientSession->handleMessage(loadRequest);

                     // Save is done in the setLoaded
                 });
        });
    return true;
}
#endif

void ConvertToBroker::dispose()
{
    if (!_uriOrig.empty())
    {
        NumConverters--;
        removeFile(_uriOrig);
        _uriOrig.clear();
    }
}

ConvertToBroker::~ConvertToBroker()
{
    dispose();
}

void ConvertToBroker::removeFile(const std::string &uriOrig)
{
    if (!uriOrig.empty())
    {
        try {
            // Remove source file and directory
            Poco::Path path = uriOrig;
            Poco::File(path).remove();
            Poco::File(path.makeParent()).remove();
        } catch (const std::exception &ex) {
            LOG_ERR("Error while removing conversion temporary: '" << uriOrig << "' - " << ex.what());
        }
    }
}

void ConvertToBroker::setLoaded()
{
    DocumentBroker::setLoaded();

    // FIXME: Check for security violations.
    Poco::Path toPath(getPublicUri().getPath());
    toPath.setExtension(_format);
    const std::string toJailURL = "file://" + std::string(JAILED_DOCUMENT_ROOT) + toPath.getFileName();
    std::string encodedTo;
    Poco::URI::encode(toJailURL, "", encodedTo);

    // Convert it to the requested format.
    const std::string saveAsCmd = "saveas url=" + encodedTo + " format=" + _format + " options=" + _sOptions;

    // Send the save request ...
    std::vector<char> saveasRequest(saveAsCmd.begin(), saveAsCmd.end());

    _clientSession->handleMessage(saveasRequest);
}

std::vector<std::shared_ptr<ClientSession>> DocumentBroker::getSessionsTestOnlyUnsafe()
{
    std::vector<std::shared_ptr<ClientSession>> result;
    for (auto& it : _sessions)
        result.push_back(it.second);
    return result;
}

void DocumentBroker::dumpState(std::ostream& os)
{
    std::unique_lock<std::mutex> lock(_mutex);

    uint64_t sent, recv;
    getIOStats(sent, recv);

    auto now = std::chrono::steady_clock::now();

    os << " Broker: " << LOOLWSD::anonymizeUrl(_filename) << " pid: " << getPid();
    if (_markToDestroy)
        os << " *** Marked to destroy ***";
    else
        os << " has live sessions";
    if (_isLoaded)
        os << "\n  loaded in: " << _loadDuration.count() << "ms";
    else
        os << "\n  still loading... " <<
            std::chrono::duration_cast<std::chrono::seconds>(
                now - _threadStart).count() << "s";
    os << "\n  sent: " << sent;
    os << "\n  recv: " << recv;
    os << "\n  modified?: " << _isModified;
    os << "\n  jail id: " << _jailId;
    os << "\n  filename: " << LOOLWSD::anonymizeUrl(_filename);
    os << "\n  public uri: " << _uriPublic.toString();
    os << "\n  jailed uri: " << LOOLWSD::anonymizeUrl(_uriJailed);
    os << "\n  doc key: " << _docKey;
    os << "\n  doc id: " << _docId;
    os << "\n  num sessions: " << _sessions.size();
    os << "\n  thread start: " << Util::getSteadyClockAsString(_threadStart);
    os << "\n  last saved: " << Util::getSteadyClockAsString(_lastSaveTime);
    os << "\n  last save request: " << Util::getSteadyClockAsString(_lastSaveRequestTime);
    os << "\n  last save response: " << Util::getSteadyClockAsString(_lastSaveResponseTime);
    os << "\n  last modifed: " << Util::getHttpTime(_documentLastModifiedTime);
    os << "\n  file last modifed: " << Util::getHttpTime(_lastFileModifiedTime);
    if (_limitLifeSeconds)
        os << "\n  life limit in seconds: " << _limitLifeSeconds;
    os << "\n  idle time: " << getIdleTimeSecs();
    os << "\n  cursor " << _cursorPosX << ", " << _cursorPosY
      << "( " << _cursorWidth << "," << _cursorHeight << ")\n";
    _lockCtx->dumpState(os);
    if (_tileCache)
        _tileCache->dumpState(os);

    _poll->dumpState(os);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
