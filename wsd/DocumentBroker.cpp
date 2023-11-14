/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
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
#include <ios>
#include <fstream>
#include <memory>
#include <string>
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
#include "JailUtil.hpp"
#include "COOLWSD.hpp"
#include "SenderQueue.hpp"
#include "Socket.hpp"
#include "Storage.hpp"
#include "TileCache.hpp"
#include "ProxyProtocol.hpp"
#include "Util.hpp"
#include "QuarantineUtil.hpp"
#include <common/JsonUtil.hpp>
#include <common/Log.hpp>
#include <common/Message.hpp>
#include <common/Clipboard.hpp>
#include <common/Protocol.hpp>
#include <common/Unit.hpp>
#include <common/FileUtil.hpp>
#include <CommandControl.hpp>

#if !MOBILEAPP
#include <net/HttpHelper.hpp>
#endif
#include <sys/types.h>
#include <sys/wait.h>

#define TILES_ON_FLY_MIN_UPPER_LIMIT 10.0f

using namespace COOLProtocol;

using Poco::JSON::Object;

void UrpHandler::handleIncomingMessage(SocketDisposition&)
{
    std::shared_ptr<StreamSocket> socket = _socket.lock();
    if (!socket)
    {
        LOG_ERR("Invalid socket while handling incoming client request");
        return;
    }

    Buffer& data = socket->getInBuffer();
    if (data.empty())
    {
        LOG_DBG("No data to process from the socket");
        return;
    }

    ChildProcess* child = _childProcess;
    std::shared_ptr<DocumentBroker> docBroker =
        child && child->getPid() > 0 ? child->getDocumentBroker() : nullptr;
    if (docBroker)
        docBroker->onUrpMessage(data.data(), data.size());

    // Remove consumed data.
    data.clear();
}

void ChildProcess::setDocumentBroker(const std::shared_ptr<DocumentBroker>& docBroker)
{
    assert(docBroker && "Invalid DocumentBroker instance.");
    _docBroker = docBroker;

    // Add the prisoner socket to the docBroker poll.
    docBroker->addSocketToPoll(getSocket());
    // if URP is enabled, also add its socket to the poll
    if (_urpFromKit)
        docBroker->addSocketToPoll(_urpFromKit);
    if (_urpToKit)
        docBroker->addSocketToPoll(_urpToKit);
    if (UnitWSD::isUnitTesting())
    {
        UnitWSD::get().onDocBrokerAttachKitProcess(docBroker->getDocKey(), getPid());
    }
}

void DocumentBroker::broadcastLastModificationTime(
    const std::shared_ptr<ClientSession>& session) const
{
    if (_storageManager.getLastModifiedTime().empty())
        // No time from the storage (e.g., SharePoint 2013 and 2016) -> don't send
        return;

    std::ostringstream stream;
    stream << "lastmodtime: " << _storageManager.getLastModifiedTime();
    const std::string message = stream.str();

    // While loading, the current session is not yet added to
    // the sessions container, so we need to send to it directly.
    if (session)
        session->sendTextFrame(message);
    broadcastMessage(message);
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

    void pollingThread() override
    {
        // Delegate to the docBroker.
        _docBroker.pollThread();
    }
};

std::atomic<unsigned> DocumentBroker::DocBrokerId(1);

DocumentBroker::DocumentBroker(ChildType type, const std::string& uri, const Poco::URI& uriPublic,
                               const std::string& docKey, unsigned mobileAppDocId)
    : _limitLifeSeconds(std::chrono::seconds::zero())
    , _uriOrig(uri)
    , _type(type)
    , _uriPublic(uriPublic)
    , _docKey(docKey)
    , _docId(Util::encodeId(DocBrokerId++, 3))
    , _documentChangedInStorage(false)
    , _isViewFileExtension(false)
    , _saveManager(std::chrono::seconds(std::getenv("COOL_NO_AUTOSAVE") != nullptr
                                            ? 0
                                            : COOLWSD::getConfigValueNonZero<int>(
                                                  "per_document.idlesave_duration_secs", 30)),
                   std::chrono::seconds(std::getenv("COOL_NO_AUTOSAVE") != nullptr
                                            ? 0
                                            : COOLWSD::getConfigValueNonZero<int>(
                                                  "per_document.autosave_duration_secs", 300)),
                   std::chrono::milliseconds(COOLWSD::getConfigValueNonZero<int>(
                       "per_document.min_time_between_saves_ms", 500)))
    , _storageManager(std::chrono::milliseconds(
          COOLWSD::getConfigValueNonZero<int>("per_document.min_time_between_uploads_ms", 5000)))
    , _isModified(false)
    , _cursorPosX(0)
    , _cursorPosY(0)
    , _cursorWidth(0)
    , _cursorHeight(0)
    , _poll(
          std::make_unique<DocumentBrokerPoll>("doc" SHARED_DOC_THREADNAME_SUFFIX + _docId, *this))
    , _stop(false)
    , _lockCtx(std::make_unique<LockContext>())
    , _tileVersion(0)
    , _debugRenderedTileCount(0)
    , _loadDuration(0)
    , _wopiDownloadDuration(0)
    , _mobileAppDocId(mobileAppDocId)
    , _alwaysSaveOnExit(COOLWSD::getConfigValue<bool>("per_document.always_save_on_exit", false))
#if !MOBILEAPP
    , _admin(Admin::instance())
#endif
    , _unitWsd(UnitWSD::isUnitTesting() ? &UnitWSD::get() : nullptr)
{
    assert(!_docKey.empty());
    assert(!COOLWSD::ChildRoot.empty());

#if !MOBILEAPP
    assert(_mobileAppDocId == 0 && "Unexpected to have mobileAppDocId in the non-mobile build");
#endif
#ifdef IOS
    assert(_mobileAppDocId > 0 && "Unexpected to have no mobileAppDocId in the iOS build");
#endif

    LOG_INF("DocumentBroker [" << COOLWSD::anonymizeUrl(_uriPublic.toString())
                               << "] created with docKey [" << _docKey
                               << "], always_save_on_exit: " << _alwaysSaveOnExit);

    if (_unitWsd)
    {
        _unitWsd->onDocBrokerCreate(_docKey);
    }
}

void DocumentBroker::setupPriorities()
{
#if !MOBILEAPP
    if (_type == ChildType::Batch)
    {
        int prio = COOLWSD::getConfigValue<int>("per_document.batch_priority", 5);
        Util::setProcessAndThreadPriorities(_childProcess->getPid(), prio);
    }
#endif
}

void DocumentBroker::setupTransfer(SocketDisposition &disposition,
                                   SocketDisposition::MoveFunction transferFn)
{
    disposition.setTransfer(*_poll, std::move(transferFn));
}

void DocumentBroker::assertCorrectThread(const char* filename, int line) const
{
    _poll->assertCorrectThread(filename, line);
}

// The inner heart of the DocumentBroker - our poll loop.
void DocumentBroker::pollThread()
{
    _threadStart = std::chrono::steady_clock::now();

    LOG_INF("Starting docBroker polling thread for docKey [" << _docKey << ']');

    // Request a kit process for this doc.
    do
    {
        static constexpr std::chrono::milliseconds timeoutMs(COMMAND_TIMEOUT_MS * 5);
        _childProcess = getNewChild_Blocks(_mobileAppDocId);
        if (_childProcess
            || std::chrono::duration_cast<std::chrono::milliseconds>(
                   std::chrono::steady_clock::now() - _threadStart)
                   > timeoutMs)
            break;

        // Nominal time between retries, lest we busy-loop. getNewChild could also wait, so don't double that here.
        std::this_thread::sleep_for(std::chrono::milliseconds(CHILD_REBALANCE_INTERVAL_MS / 10));
    } while (!_stop && _poll->continuePolling() && !SigUtil::getShutdownRequestFlag());

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

        // Async cleanup.
        COOLWSD::doHousekeeping();

        LOG_INF("Finished docBroker polling thread for docKey [" << _docKey << "].");
        return;
    }

    // We have a child process.
    _childProcess->setDocumentBroker(shared_from_this());
    LOG_INF("Doc [" << _docKey << "] attached to child [" << _childProcess->getPid() << "].");

    setupPriorities();

#if !MOBILEAPP
    static const std::size_t IdleDocTimeoutSecs
        = COOLWSD::getConfigValue<int>("per_document.idle_timeout_secs", 3600);

    // Used to accumulate B/W deltas.
    uint64_t adminSent = 0;
    uint64_t adminRecv = 0;
    auto lastBWUpdateTime = std::chrono::steady_clock::now();
    auto lastClipboardHashUpdateTime = std::chrono::steady_clock::now();

    const int limit_load_secs =
#if ENABLE_DEBUG
        // paused waiting for a debugger to attach
        // ignore load time out
        std::getenv("PAUSEFORDEBUGGER") ? -1 :
#endif
        COOLWSD::getConfigValue<int>("per_document.limit_load_secs", 100);

    auto loadDeadline = std::chrono::steady_clock::now() + std::chrono::seconds(limit_load_secs);
#endif

    const auto limStoreFailures =
        COOLWSD::getConfigValue<int>("per_document.limit_store_failures", 5);

    // Main polling loop goodness.
    while (!_stop && _poll->continuePolling() && !SigUtil::getTerminationFlag())
    {
        // Poll more frequently while unloading to cleanup sooner.
        const bool unloading = isMarkedToDestroy() || _docState.isUnloadRequested();
        _poll->poll(unloading ? SocketPoll::DefaultPollTimeoutMicroS / 16
                              : SocketPoll::DefaultPollTimeoutMicroS);

        // Consolidate updates across multiple processed events.
        processBatchUpdates();

        if (_stop)
        {
            LOG_DBG("Doc [" << _docKey << "] is flagged to stop after returning from poll.");
            break;
        }

        if (_unitWsd && _unitWsd->isFinished())
        {
            stop("UnitTestFinished");
            break;
        }

#if !MOBILEAPP
        const auto now = std::chrono::steady_clock::now();

        // a tile's data is ~8k, a 4k screen is ~256 256x256 tiles -
        // so double that - 4Mb per view.
        if (_tileCache)
            _tileCache->setMaxCacheSize(8 * 1024 * 256 * 2 * _sessions.size());

        if (isInteractive())
        {
            // It is possible to dismiss the interactive dialog,
            // exit the Kit process, or even crash. We would deadlock.
            if (isUnloading())
            {
                // We expect to have either isMarkedToDestroy() or
                // isCloseRequested() in that case.
                stop("abortedinteractive");
            }

            // Extend the deadline while we are interactiving with the user.
            loadDeadline = now + std::chrono::seconds(limit_load_secs);
            continue;
        }

        if (!isLoaded() && (limit_load_secs > 0) && (now > loadDeadline))
        {
            LOG_ERR("Doc [" << _docKey << "] is taking too long to load. Will kill process ["
                    << _childProcess->getPid() << "]. per_document.limit_load_secs set to "
                    << limit_load_secs << " secs.");
            broadcastMessage("error: cmd=load kind=docloadtimeout");

            // Brutal but effective.
            if (_childProcess)
                _childProcess->terminate();

            stop("Doc lifetime expired");
            continue;
        }

        // Check if we had a sunset time and expired.
        if (_limitLifeSeconds > std::chrono::seconds::zero()
            && std::chrono::duration_cast<std::chrono::seconds>(now - _threadStart)
                   > _limitLifeSeconds)
        {
            LOG_WRN("Doc [" << _docKey << "] is taking too long to convert. Will kill process ["
                            << _childProcess->getPid()
                            << "]. per_document.limit_convert_secs set to "
                            << _limitLifeSeconds.count() << " secs.");
            broadcastMessage("error: cmd=load kind=docexpired");

            // Brutal but effective.
            if (_childProcess)
                _childProcess->terminate();

            stop("Convert-to timed out");
            continue;
        }

        if (std::chrono::duration_cast<std::chrono::milliseconds>
                    (now - lastBWUpdateTime).count() >= COMMAND_TIMEOUT_MS)
        {
            lastBWUpdateTime = now;
            uint64_t sent = 0, recv = 0;
            getIOStats(sent, recv);

            uint64_t deltaSent = 0, deltaRecv = 0;

            // connection drop transiently reduces this.
            if (sent > adminSent)
            {
                deltaSent = sent - adminSent;
                adminSent = sent;
            }
            if (recv > deltaRecv)
            {
                deltaRecv = recv - adminRecv;
                adminRecv = recv;
            }
            LOG_TRC("Doc [" << _docKey << "] added stats sent: +" << deltaSent << ", recv: +" << deltaRecv << " bytes to totals.");

            // send change since last notification.
            _admin.addBytes(getDocKey(), deltaSent, deltaRecv);
        }

        if (_storage && _lockCtx->needsRefresh(now))
            refreshLock();
#endif

        LOG_TRC("Poll: current activity: " << DocumentState::name(_docState.activity()));
        switch (_docState.activity())
        {
            case DocumentState::Activity::None:
            {
                // Check if there are queued activities.
                if (!_renameFilename.empty() && !_renameSessionId.empty())
                {
                    startRenameFileCommand();
                    // Nothing more to do until the save is complete.
                    continue;
                }

#if !MOBILEAPP
                // Remove idle documents after 1 hour.
                if (isLoaded() && getIdleTimeSecs() >= IdleDocTimeoutSecs)
                {
                    autoSaveAndStop("idle");
                }
                else
#endif
                if (_sessions.empty() && (isLoaded() || _docState.isMarkedToDestroy()))
                {
                    if (!isLoaded())
                    {
                        // Nothing to do; no sessions, not loaded, marked to destroy.
                        stop("dead");
                    }
                    else if (_saveManager.isSaving() || isAsyncUploading())
                    {
                        LOG_DBG("Don't terminate dead DocumentBroker: async saving in progress for "
                                "docKey ["
                                << getDocKey() << "].");
                        continue;
                    }

                    autoSaveAndStop("dead");
                }
                else if (_docState.isUnloadRequested() || SigUtil::getShutdownRequestFlag() ||
                         _docState.isCloseRequested())
                {
                    if (limStoreFailures > 0 && (_saveManager.saveFailureCount() >=
                                                     static_cast<std::size_t>(limStoreFailures) ||
                                                 _storageManager.uploadFailureCount() >=
                                                     static_cast<std::size_t>(limStoreFailures)))
                    {
                        LOG_ERR("Failed to store the document and reached maximum retry count of "
                                << limStoreFailures
                                << ". Giving up. The document should be recoverable from the "
                                   "quarantine. Save failures: "
                                << _saveManager.saveFailureCount()
                                << ", Upload failures: " << _storageManager.uploadFailureCount());
                        stop("storefailed");
                        continue;
                    }

                    const std::string reason =
                        SigUtil::getShutdownRequestFlag()
                            ? "recycling"
                            : (!_closeReason.empty() ? _closeReason : "unloading");
                    autoSaveAndStop(reason);
                }
                else if (!_stop && _saveManager.needAutoSaveCheck())
                {
                    LOG_TRC("Triggering an autosave by timer");
                    autoSave(/*force=*/false, /*dontSaveIfUnmodified=*/true);
                }
                else if (!isAsyncUploading() && !_storageManager.lastUploadSuccessful() &&
                         needToUploadToStorage() != NeedToUpload::No)
                {
                    // Retry uploading, if the last one failed and we can try again.
                    const auto session = getWriteableSession();
                    if (session && !session->getAuthorization().isExpired())
                    {
                        checkAndUploadToStorage(session, /*justSaved=*/false);
                    }
                }
            }
            break;

            case DocumentState::Activity::Save:
            case DocumentState::Activity::SaveAs:
            {
                if (_docState.isDisconnected())
                {
                    // We will never save. No need to wait for timeout.
                    LOG_DBG("Doc disconnected while saving. Ending save activity.");
                    _saveManager.setLastSaveResult(/*success=*/false, /*newVersion=*/false);
                    endActivity();
                }
                else
                if (_saveManager.hasSavingTimedOut())
                {
                    LOG_DBG("Saving timedout. Ending save activity.");
                    _saveManager.setLastSaveResult(/*success=*/false, /*newVersion=*/false);
                    endActivity();
                }
            }
            break;

            // We have some activity ongoing.
            default:
            {
                constexpr std::chrono::seconds postponeAutosaveDuration(30);
                LOG_TRC("Postponing autosave check by " << postponeAutosaveDuration);
                _saveManager.postponeAutosave(postponeAutosaveDuration);
            }
            break;
        }

#if !MOBILEAPP
        if (std::chrono::duration_cast<std::chrono::minutes>(now - lastClipboardHashUpdateTime).count() >= 2)
        {
            for (auto &it : _sessions)
            {
                if (it.second->staleWaitDisconnect(now))
                {
                    std::string id = it.second->getId();
                    LOG_WRN("Unusual, Kit session " + id + " failed its disconnect handshake, killing");
                    finalRemoveSession(it.second);
                    break; // it invalid.
                }
            }
        }

        if (std::chrono::duration_cast<std::chrono::minutes>(now - lastClipboardHashUpdateTime).count() >= 5)
        {
            LOG_TRC("Rotating clipboard keys");
            for (auto &it : _sessions)
                it.second->rotateClipboardKey(true);

            lastClipboardHashUpdateTime = now;
        }
#endif
    }

    LOG_INF("Finished polling doc ["
            << _docKey << "]. stop: " << _stop << ", continuePolling: " << _poll->continuePolling()
            << ", CloseReason: [" << _closeReason << ']'
            << ", ShutdownRequestFlag: " << SigUtil::getShutdownRequestFlag()
            << ", TerminationFlag: " << SigUtil::getTerminationFlag());

    if (_childProcess && _sessions.empty())
    {
        LOG_INF("Requesting termination of child [" << getPid() << "] for doc [" << _docKey
                                                    << "] as there are no sessions");
        _childProcess->requestTermination();
    }

    // Check for data-loss.
    std::string reason;
    bool dataLoss = false;
    if (haveModifyActivityAfterSaveRequest() || !_saveManager.lastSaveSuccessful() ||
        !_storageManager.lastUploadSuccessful() || isStorageOutdated())
    {
        // If we are exiting because the owner discarded conflict changes, don't detect data loss.
        if (!(_docState.isCloseRequested() && _documentChangedInStorage))
        {
            dataLoss = true;
            if (haveModifyActivityAfterSaveRequest())
                reason = "have unsaved modifications";
            else
                reason = !_saveManager.lastSaveSuccessful() ? "flagged as modified"
                                                            : "not uploaded to storage";

            // The test may override (if it was expected).
            if (_unitWsd && !_unitWsd->onDataLoss("Data-loss detected while exiting [" + _docKey +
                                                  "]: " + reason))
                reason.clear();
        }
    }

    if (!reason.empty() || (_unitWsd && _unitWsd->isFinished() && _unitWsd->failed()))
    {
        std::stringstream state;
        state << "DocBroker [" << _docKey << " stopped "
              << (reason.empty() ? "because of test failure" : ("although " + reason)) << ": ";
        dumpState(state);
        LOG_WRN(state.str());
    }

    // Flush socket data first, if any.
    if (_poll->getSocketCount())
    {
        constexpr auto flushTimeoutMicroS =
            std::chrono::microseconds(POLL_TIMEOUT_MICRO_S * 2); // ~2000ms
        LOG_INF("Flushing " << _poll->getSocketCount() << " sockets for doc [" << _docKey
                            << "] for " << flushTimeoutMicroS);

        const auto flushStartTime = std::chrono::steady_clock::now();
        while (_poll->getSocketCount())
        {
            const auto now = std::chrono::steady_clock::now();
            const auto elapsedMicroS =
                std::chrono::duration_cast<std::chrono::microseconds>(now - flushStartTime);
            if (elapsedMicroS > flushTimeoutMicroS)
                break;

            const std::chrono::microseconds timeoutMicroS =
                std::min(flushTimeoutMicroS - elapsedMicroS,
                         std::chrono::microseconds(POLL_TIMEOUT_MICRO_S / 5));
            if (_poll->poll(timeoutMicroS) == 0 && UnitWSD::isUnitTesting())
            {
                // Polling timed out, no more data to flush.
                break;
            }

            processBatchUpdates();
        }

        LOG_INF("Finished flushing socket for doc [" << _docKey << ']');
    }

    // Terminate properly while we can.
    LOG_DBG("Terminating child with reason: [" << _closeReason << ']');
    terminateChild(_closeReason);

    // Stop to mark it done and cleanup.
    _poll->stop();

#if !MOBILEAPP
    if (dataLoss || _docState.disconnected() == DocumentState::Disconnected::Unexpected)
    {
        // Quarantine the last copy, if different.
        LOG_WRN((dataLoss ? "Data loss " : "Crash ") << "detected, will quarantine last version of ["
                << getDocKey() << "] if necessary. Quarantine enabled: " << bool(_quarantine)
                << ", Storage available: " << bool(_storage));
        if (_storage && _quarantine)
        {
            const std::string uploading = _storage->getRootFilePathUploading();
            if (FileUtil::Stat(uploading).exists())
            {
                LOG_WRN("Quarantining the .uploading file: " << uploading);
                _quarantine->quarantineFile(uploading);
            }
            else
            {
                const std::string upload = _storage->getRootFilePathToUpload();
                if (FileUtil::Stat(upload).exists())
                {
                    LOG_WRN("Quarantining the .upload file: " << upload);
                    _quarantine->quarantineFile(upload);
                }
                else
                {
                    // Fallback to quarantining the original document.
                    LOG_WRN("Quarantining the original document file: " << _filename);
                    _quarantine->quarantineFile(_storage->getRootFilePath());
                }
            }
        }
    }
    else if (_quarantine)
    {
        // Gracefully unloaded.
        LOG_DBG("Cleaning up quarantined files for [" << getDocKey() << ']');
        _quarantine->removeQuarantinedFiles();
    }

    // Async cleanup.
    COOLWSD::doHousekeeping();
#endif

    if (_tileCache)
        _tileCache->clear();

    LOG_INF("Finished docBroker polling thread for docKey [" << _docKey << ']');
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
    ASSERT_CORRECT_THREAD();

    LOG_INF("~DocumentBroker [" << _docKey << "] destroyed with " << _sessions.size()
                                << " sessions left");

    // Do this early - to avoid operating on _childProcess from two threads.
    _poll->joinThread();

    for (const auto& sessionIt : _sessions)
    {
        if (sessionIt.second->isLive())
        {
            LOG_WRN("Destroying DocumentBroker ["
                    << _docKey << "] while having " << _sessions.size()
                    << " unremoved sessions, at least one is still live");
            break;
        }
    }

    // Need to first make sure the child exited, socket closed,
    // and thread finished before we are destroyed.
    _childProcess.reset();

#if !MOBILEAPP
    // Remove from the admin last, to avoid racing the next test.
    _admin.rmDoc(_docKey);
#endif

    if (_unitWsd)
    {
        _unitWsd->DocBrokerDestroy(_docKey);
    }
}

void DocumentBroker::joinThread()
{
    _poll->joinThread();
}

void DocumentBroker::stop(const std::string& reason)
{
    if (_closeReason.empty() || _closeReason == reason)
    {
        LOG_DBG("Stopping DocumentBroker for docKey [" << _docKey << "] with reason: " << reason);
        _closeReason = reason; // used later in the polling loop
    }
    else
    {
        LOG_DBG("Stopping DocumentBroker for docKey ["
                << _docKey << "] with existing close reason: " << _closeReason
                << " (ignoring requested reason: " << reason << ')');
    }

    _stop = true;
    _poll->wakeup();
}

bool DocumentBroker::download(const std::shared_ptr<ClientSession>& session, const std::string& jailId)
{
    ASSERT_CORRECT_THREAD();

    const std::string sessionId = session->getId();

    LOG_INF("Loading [" << _docKey << "] for session [" << sessionId << "] in jail [" << jailId
                        << ']');

    if (_unitWsd)
    {
        bool result;
        if (_unitWsd->filterLoad(sessionId, jailId, result))
            return result;
    }

    if (_docState.isMarkedToDestroy())
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
    const std::string jailRoot = getJailRoot();

    LOG_INF("JailPath for docKey [" << _docKey << "]: [" << jailPath.toString() << "], jailRoot: ["
                                    << jailRoot << ']');

    bool firstInstance = false;
    if (_storage == nullptr)
    {
        _docState.setStatus(DocumentState::Status::Downloading);

        // Pass the public URI to storage as it needs to load using the token
        // and other storage-specific data provided in the URI.
        const Poco::URI& uriPublic = session->getPublicUri();
        LOG_DBG("Creating new storage instance for URI ["
                << COOLWSD::anonymizeUrl(uriPublic.toString()) << ']');

        try
        {
            _storage = StorageBase::create(uriPublic, jailRoot, jailPath.toString(),
                                           /*takeOwnership=*/isConvertTo());
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

    LOG_ASSERT(_storage);

    // Call the storage specific fileinfo functions
    std::string userId, username;
    std::string userExtraInfo;
    std::string userPrivateInfo;
    std::string watermarkText;
    std::string templateSource;

#if !MOBILEAPP
    std::chrono::milliseconds checkFileInfoCallDurationMs = std::chrono::milliseconds::zero();
    WopiStorage* wopiStorage = dynamic_cast<WopiStorage*>(_storage.get());
    if (wopiStorage != nullptr)
    {
        LOG_DBG("CheckFileInfo for docKey [" << _docKey << ']');
        std::chrono::steady_clock::time_point start = std::chrono::steady_clock::now();
        std::unique_ptr<WopiStorage::WOPIFileInfo> wopiFileInfo =
            wopiStorage->getWOPIFileInfo(session->getAuthorization(), *_lockCtx);

        checkFileInfoCallDurationMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - start);

        userId = wopiFileInfo->getUserId();
        username = wopiFileInfo->getUsername();
        userExtraInfo = wopiFileInfo->getUserExtraInfo();
        userPrivateInfo = wopiFileInfo->getUserPrivateInfo();
        watermarkText = wopiFileInfo->getWatermarkText();
        templateSource = wopiFileInfo->getTemplateSource();

        _isViewFileExtension = COOLWSD::IsViewFileExtension(wopiStorage->getFileExtension());
        if (!wopiFileInfo->getUserCanWrite()) // Readonly.
        {
            LOG_DBG("Setting session [" << sessionId << "] to readonly for UserCanWrite=false");
            session->setWritable(false);
        }
        else if (CommandControl::LockManager::isLockedReadOnlyUser()) // Readonly.
        {
            LOG_DBG("Setting session [" << sessionId << "] to readonly for LockedReadOnlyUser");
            session->setWritable(false);
        }
        else if (_isViewFileExtension) // PDF and the like: only commenting, no editing.
        {
            LOG_DBG("Setting session [" << sessionId << "] to readonly for ViewFileExtension ["
                                        << wopiStorage->getFileExtension()
                                        << "] and allowing comments");
            session->setWritable(true);
            session->setReadOnly(true);
            session->setAllowChangeComments(true);
        }
        else // Fully writable document, with comments.
        {
            LOG_DBG("Setting session [" << sessionId << "] to writable and allowing comments");
            session->setWritable(true);
            session->setReadOnly(false);
            session->setAllowChangeComments(true);
        }

        // Mark the session as 'Document owner' if WOPI hosts supports it
        if (userId == _storage->getFileInfo().getOwnerId())
        {
            LOG_DBG("Session [" << sessionId << "] is the document owner");
            session->setDocumentOwner(true);
        }

        // We will send the client about information of the usage type of the file.
        // Some file types may be treated differently than others.
        session->sendFileMode(session->isReadOnly(), session->isAllowChangeComments());

        // Construct a JSON containing relevant WOPI host properties
        Object::Ptr wopiInfo = new Object();
        if (!wopiFileInfo->getPostMessageOrigin().empty())
        {
            wopiInfo->set("PostMessageOrigin", wopiFileInfo->getPostMessageOrigin());
        }

        // If print, export are disabled, order client to hide these options in the UI
        if (wopiFileInfo->getDisablePrint())
            wopiFileInfo->setHidePrintOption(true);
        if (wopiFileInfo->getDisableExport())
            wopiFileInfo->setHideExportOption(true);

        wopiInfo->set("BaseFileName", wopiStorage->getFileInfo().getFilename());
        if (wopiFileInfo->getBreadcrumbDocName().size())
            wopiInfo->set("BreadcrumbDocName", wopiFileInfo->getBreadcrumbDocName());

        if (!wopiFileInfo->getTemplateSaveAs().empty())
            wopiInfo->set("TemplateSaveAs", wopiFileInfo->getTemplateSaveAs());

        if (!templateSource.empty())
                wopiInfo->set("TemplateSource", templateSource);

        wopiInfo->set("HidePrintOption", wopiFileInfo->getHidePrintOption());
        wopiInfo->set("HideSaveOption", wopiFileInfo->getHideSaveOption());
        wopiInfo->set("HideExportOption", wopiFileInfo->getHideExportOption());
        wopiInfo->set("HideRepairOption", wopiFileInfo->getHideRepairOption());
        wopiInfo->set("DisablePrint", wopiFileInfo->getDisablePrint());
        wopiInfo->set("DisableExport", wopiFileInfo->getDisableExport());
        wopiInfo->set("DisableCopy", wopiFileInfo->getDisableCopy());
        wopiInfo->set("DisableInactiveMessages", wopiFileInfo->getDisableInactiveMessages());
        wopiInfo->set("DownloadAsPostMessage", wopiFileInfo->getDownloadAsPostMessage());
        wopiInfo->set("UserCanNotWriteRelative", wopiFileInfo->getUserCanNotWriteRelative());
        wopiInfo->set("EnableInsertRemoteImage", wopiFileInfo->getEnableInsertRemoteImage());
        wopiInfo->set("EnableRemoteLinkPicker", wopiFileInfo->getEnableRemoteLinkPicker());
        wopiInfo->set("EnableShare", wopiFileInfo->getEnableShare());
        wopiInfo->set("HideUserList", wopiFileInfo->getHideUserList());
        wopiInfo->set("SupportsRename", wopiFileInfo->getSupportsRename());
        wopiInfo->set("UserCanRename", wopiFileInfo->getUserCanRename());
        wopiInfo->set("FileUrl", wopiFileInfo->getFileUrl());
        wopiInfo->set("UserCanWrite", wopiFileInfo->getUserCanWrite());
        if (wopiFileInfo->getHideChangeTrackingControls() !=
            WopiStorage::WOPIFileInfo::TriState::Unset)
                wopiInfo->set("HideChangeTrackingControls",
                              wopiFileInfo->getHideChangeTrackingControls() ==
                                  WopiStorage::WOPIFileInfo::TriState::True);
        wopiInfo->set("IsOwner", session->isDocumentOwner());

        std::ostringstream ossWopiInfo;
        wopiInfo->stringify(ossWopiInfo);
        const std::string wopiInfoString = ossWopiInfo.str();
        LOG_TRC("Sending wopi info to client: " << wopiInfoString);

        // Contains PostMessageOrigin property which is necessary to post messages to parent
        // frame. Important to send this message immediately and not enqueue it so that in case
        // document load fails, cool is able to tell its parent frame via PostMessage API.
        session->sendMessage("wopi: " + wopiInfoString);

        if (config::getBool("logging.userstats", false))
        {
            // using json because fetching details from json string is easier and will be consistent
            Object::Ptr userStats = new Object();
            userStats->set("PostMessageOrigin", wopiFileInfo->getPostMessageOrigin());
            userStats->set("UserID", COOLWSD::anonymizeUsername(userId));
            userStats->set("BaseFileName", wopiStorage->getFileInfo().getFilename());
            userStats->set("UserCanWrite", wopiFileInfo->getUserCanWrite());

            std::ostringstream ossUserStats;
            userStats->stringify(ossUserStats);
            const std::string userStatsString = ossUserStats.str();

            LOG_ANY("User stats: " << userStatsString);
        }

        // Pass the ownership to client session
        session->setWopiFileInfo(wopiFileInfo);
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

            _isViewFileExtension = COOLWSD::IsViewFileExtension(localStorage->getFileExtension());
            if (_isViewFileExtension)
            {
                LOG_DBG("Setting session [" << sessionId << "] as readonly");
                session->setReadOnly(true);
                if (_isViewFileExtension)
                {
                    LOG_DBG("Allow session [" << sessionId
                                              << "] to change comments on document with extension ["
                                              << localStorage->getFileExtension() << ']');
                    session->setAllowChangeComments(true);
                }
                // Related to fix for issue #5887: only send a read-only
                // message for "view file extension" document types
                session->sendFileMode(session->isReadOnly(), session->isAllowChangeComments());
            }
#ifdef MOBILEAPP
            else
            {
                // Fix issue #5887 by assuming that documents are writable on iOS and Android
                // The iOS and Android app saves directly to local disk so, other than for
                // "view file extension" document types or other cases that
                // I am missing, we can assume the document is writable until
                // a write failure occurs.
                LOG_DBG("Setting session [" << sessionId << "] to writable and allowing comments");
                session->setWritable(true);
                session->setReadOnly(false);
                session->setAllowChangeComments(true);
            }
#endif
        }
    }

#if ENABLE_SUPPORT_KEY
    if (!COOLWSD::OverrideWatermark.empty())
        watermarkText = COOLWSD::OverrideWatermark;
#endif

    session->setUserId(userId);
    session->setUserName(username);
    session->setUserExtraInfo(userExtraInfo);
    session->setUserPrivateInfo(userPrivateInfo);
    session->setWatermarkText(watermarkText);

    LOG_DBG("Setting username [" << COOLWSD::anonymizeUsername(username) << "] and userId [" <<
            COOLWSD::anonymizeUsername(userId) << "] for session [" << sessionId <<
            "] is canonical id " << session->getCanonicalViewId());

    // Basic file information was stored by the above getWOPIFileInfo() or getLocalFileInfo() calls
    const StorageBase::FileInfo fileInfo = _storage->getFileInfo();
    if (!fileInfo.isValid())
    {
        LOG_ERR("Invalid fileinfo for URI [" << session->getPublicUri().toString() << "].");
        return false;
    }

    if (firstInstance)
    {
        _storageManager.setLastModifiedTime(fileInfo.getLastModifiedTime());
        LOG_DBG("Document timestamp: " << _storageManager.getLastModifiedTime());
    }
    else
    {
        // Check if document has been modified by some external action
        LOG_TRC("Document modified time: " << fileInfo.getLastModifiedTime());
        if (!_storageManager.getLastModifiedTime().empty() &&
            !fileInfo.getLastModifiedTime().empty() &&
            _storageManager.getLastModifiedTime() != fileInfo.getLastModifiedTime())
        {
            LOG_DBG("Document [" << _docKey << "] has been modified behind our back. "
                                 << "Informing all clients. Expected: "
                                 << _storageManager.getLastModifiedTime()
                                 << ", Actual: " << fileInfo.getLastModifiedTime());

            _documentChangedInStorage = true;
            // Do not reload the document ("close: documentconflict") if there are
            // any changes in the loaded document, either saved or unsaved.
            const std::string message =
                (_lastStorageAttrs.isUserModified() || _currentStorageAttrs.isUserModified() ||
                 isPossiblyModified())
                    ? "error: cmd=storage kind=documentconflict"
                    : "close: documentconflict";

            session->sendTextFrame(message);
            broadcastMessage(message);
        }
    }

    broadcastLastModificationTime(session);

    // Let's download the document now, if not downloaded.
    std::chrono::milliseconds getFileCallDurationMs = std::chrono::milliseconds::zero();
    if (!_storage->isDownloaded())
    {
        LOG_DBG("Download file for docKey [" << _docKey << ']');
        std::chrono::steady_clock::time_point start = std::chrono::steady_clock::now();
        std::string localPath = _storage->downloadStorageFileToLocal(session->getAuthorization(),
                                                                     *_lockCtx, templateSource);
        if (localPath.empty())
        {
            throw std::runtime_error("Failed to retrieve document from storage");
        }

        getFileCallDurationMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - start);

        _docState.setStatus(DocumentState::Status::Loading); // Done downloading.

        // Only lock the document on storage for editing sessions
        // FIXME: why not lock before downloadStorageFileToLocal? Would also prevent race conditions
        if (!session->isReadOnly())
        {
            std::string error;
            if (!updateStorageLockState(*session, /*lock=*/true, error))
            {
                LOG_ERR("Failed to lock docKey [" << _docKey << "] with session ["
                                                  << session->getId()
                                                  << "] after downloading: " << error);
            }
        }

#if !MOBILEAPP
        // Check if we have a prefilter "plugin" for this document format
        for (const auto& plugin : COOLWSD::PluginConfigurations)
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

                    const std::string newRootPath = _storage->getRootFilePath() + '.' + newExtension;

                    // The commandline must contain the space-separated substring @INPUT@ that is
                    // replaced with the input file name, and @OUTPUT@ for the output file name.
                    int inputs(0), outputs(0);

                    std::string input("@INPUT");
                    std::size_t pos = commandLine.find(input);
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

                    StringVector args(StringVector::tokenize(commandLine, ' '));
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
                    localPath += '.' + newExtension;
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

        const std::string localFilePath = Poco::Path(getJailRoot(), localPath).toString();
        std::ifstream istr(localFilePath, std::ios::binary);
        Poco::SHA1Engine sha1;
        Poco::DigestOutputStream dos(sha1);
        Poco::StreamCopier::copyStream(istr, dos);
        dos.close();
        LOG_INF("SHA1 for DocKey [" << _docKey << "] of [" << COOLWSD::anonymizeUrl(localPath) << "]: " <<
                Poco::DigestEngine::digestToHex(sha1.digest()));

        std::string localPathEncoded;
        Poco::URI::encode(localPath, "#?", localPathEncoded);
        _uriJailed = Poco::URI(Poco::URI("file://"), localPathEncoded).toString();
        _uriJailedAnonym = Poco::URI(Poco::URI("file://"), COOLWSD::anonymizeUrl(localPathEncoded)).toString();

        _filename = fileInfo.getFilename();
#if !MOBILEAPP
        _quarantine = std::make_unique<Quarantine>(*this, _filename);
#endif

        if (!templateSource.empty())
        {
            // Invalid timestamp for templates, to force uploading once we save-after-loading.
            _saveManager.setLastModifiedTime(std::chrono::system_clock::time_point());
            _storageManager.setLastUploadedFileModifiedTime(
                std::chrono::system_clock::time_point());
        }
        else
        {
            // Use the local temp file's timestamp.
            const auto timepoint = FileUtil::Stat(localFilePath).modifiedTimepoint();
            _saveManager.setLastModifiedTime(timepoint);
            _storageManager.setLastUploadedFileModifiedTime(timepoint); // Used to detect modifications.
        }

        bool dontUseCache = false;
#if MOBILEAPP
        // avoid memory consumption for single-user local bits.
        // FIXME: arguably should/could do this for single user documents too.
        dontUseCache = true;
#endif

        _tileCache = std::make_unique<TileCache>(_storage->getUri().toString(),
                                                 _saveManager.getLastModifiedTime(), dontUseCache);
        _tileCache->setThreadOwner(std::this_thread::get_id());
    }

#if !MOBILEAPP
    COOLWSD::dumpNewSessionTrace(getJailId(), sessionId, _uriOrig, _storage->getRootFilePath());

    // Since document has been loaded, send the stats if its WOPI
    if (wopiStorage != nullptr)
    {
        // Add the time taken to load the file from storage and to check file info.
        _wopiDownloadDuration += getFileCallDurationMs + checkFileInfoCallDurationMs;
        const auto downloadSecs = _wopiDownloadDuration.count() / 1000.;
        const std::string msg
            = "stats: wopiloadduration " + std::to_string(downloadSecs); // In seconds.
        LOG_TRC("Sending to Client [" << msg << "].");
        session->sendTextFrame(msg);
    }
#endif
    return true;
}

std::string DocumentBroker::handleRenameFileCommand(std::string sessionId,
                                                    std::string newFilename)
{
    if (newFilename.empty())
        return "error: cmd=renamefile kind=invalid"; //TODO: better filename validation.

    if (_docState.activity() == DocumentState::Activity::Rename)
    {
        if (_renameFilename != newFilename)
            return "error: cmd=renamefile kind=conflict"; // Renaming in progress.
    }

    _renameFilename = std::move(newFilename);
    _renameSessionId = std::move(sessionId);

    if (_docState.activity() == DocumentState::Activity::None)
    {
        // We can start by saving now.
        startRenameFileCommand();
    }

    return std::string();
}

void DocumentBroker::startRenameFileCommand()
{
    LOG_DBG("Starting renamefile command execution");

    if (_renameSessionId.empty() || _renameFilename.empty())
    {
        assert(!"Saving before renaming without valid filename or sessionId.");
        LOG_DBG("Error: Trying to saveBeforeRename with invalid filename ["
                << _renameFilename << "] and/or sessionId [" << _renameSessionId << "]");
        return;
    }

    // Transition.
    if (!startActivity(DocumentState::Activity::Rename))
    {
        return;
    }

    blockUI("rename"); // Prevent user interaction while we start renaming.

    const auto it = _sessions.find(_renameSessionId);
    if (it == _sessions.end())
    {
        LOG_ERR("Session [" << _renameSessionId << "] not found to save docKey [" << _docKey
                            << "] before renaming. The document will not be renamed.");
        broadcastSaveResult(false, "Renaming session not found");
        endRenameFileCommand();
        return;
    }

    constexpr bool dontTerminateEdit = false; // We will save, rename, and reload: terminate.
    constexpr bool dontSaveIfUnmodified = true;
    constexpr bool isAutosave = false;
    sendUnoSave(it->second, dontTerminateEdit, dontSaveIfUnmodified, isAutosave);
}

void DocumentBroker::endRenameFileCommand()
{
    LOG_DBG("Ending renamefile command execution");

    _renameSessionId.clear();
    _renameFilename.clear();

    unblockUI();

    endActivity();
}

bool DocumentBroker::updateStorageLockState(ClientSession& session, bool lock, std::string& error)
{
    if (session.getAuthorization().isExpired())
    {
        error = "Expired authorization token";
        return false;
    }

    if (lock && session.isReadOnly())
    {
        // Readonly sessions cannot lock, only editors can.
        error = "Readonly session";
        return false;
    }

    const StorageBase::LockUpdateResult result = _storage->updateLockState(
        session.getAuthorization(), *_lockCtx, lock, _currentStorageAttrs);
    error = _lockCtx->_lockFailureReason;

    switch (result)
    {
        case StorageBase::LockUpdateResult::UNSUPPORTED:
            LOG_DBG("Locks on docKey [" << _docKey << "] are unsupported");
            return true; // Not an error.
            break;
        case StorageBase::LockUpdateResult::OK:
            LOG_DBG((lock ? "Locked" : "Unlocked") << " docKey [" << _docKey << "] successfully");
            return true;
            break;
        case StorageBase::LockUpdateResult::UNAUTHORIZED:
            LOG_ERR("Failed to " << (lock ? "Locked" : "Unlocked") << " docKey [" << _docKey
                                 << "]. Invalid or expired access token. Notifying client and "
                                    "invalidating the authorization token of session ["
                                 << session.getId() << "]. This session will now be read-only");
            session.invalidateAuthorizationToken();
            if (lock)
            {
                // If we can't unlock, we don't want to set the document to read-only mode.
                session.setLockFailed(error);
            }
            break;
        case StorageBase::LockUpdateResult::FAILED:
            LOG_ERR("Failed to " << (lock ? "Locked" : "Unlocked") << " docKey [" << _docKey
                                 << "] with reason [" << error
                                 << "]. Notifying client and making session [" << session.getId()
                                 << "] read-only");

            if (lock)
            {
                // If we can't unlock, we don't want to set the document to read-only mode.
                session.setLockFailed(error);
            }
            break;
    }

    return false;
}

bool DocumentBroker::attemptLock(ClientSession& session, std::string& failReason)
{
    return updateStorageLockState(session, /*lock=*/true, failReason);
}

DocumentBroker::NeedToUpload DocumentBroker::needToUploadToStorage() const
{
    const CanUpload canUpload = canUploadToStorage();
    if (canUpload != CanUpload::Yes)
    {
        // This can happen when we reject the connection (unauthorized).
        LOG_TRC("Cannot upload to storage: " << name(canUpload));
        return NeedToUpload::No;
    }

    // When destroying, we might have to force uploading if always_save_on_exit=true.
    // If unloadRequested is set, assume we will unload after uploading and exit.
    if (isUnloading() && _alwaysSaveOnExit && _saveManager.version() > 0)
    {
        if (_documentChangedInStorage)
        {
            LOG_INF("Need to upload per always_save_on_exit config while the document has a "
                    "conflict");
        }
        else
        {
            LOG_INF("Need to upload per always_save_on_exit config "
                    << (isMarkedToDestroy() ? "MarkedToDestroy" : "Unloading"));
        }

        return NeedToUpload::Yes;
    }

    // Retry uploading only for retryable failures, not conflicts.
    if (!_storageManager.lastUploadSuccessful() && !_documentChangedInStorage)
    {
        LOG_DBG("Uploading to storage as last attempt had failed");
        return NeedToUpload::Yes;
    }

    // Finally, see if we have a newer version than storage.
    if (isStorageOutdated())
        return NeedToUpload::Yes; // Timestamp changed, upload.

    return NeedToUpload::No; // No reason to upload, seems up-to-date.
}

bool DocumentBroker::isStorageOutdated() const
{
    if (!_storage)
    {
        return false;
    }

    // Get the modified-time of the file on disk.
    const auto st = FileUtil::Stat(_storage->getRootFilePathUploading());
    if (!st.exists())
    {
        LOG_TRC("File to upload to storage [" << _storage->getRootFilePathUploading()
                                              << "] does not exist");
        return false;
    }

    const std::chrono::system_clock::time_point currentModifiedTime = st.modifiedTimepoint();
    const std::chrono::system_clock::time_point lastModifiedTime =
        _storageManager.getLastUploadedFileModifiedTime();

    LOG_TRC("File to upload to storage ["
            << _storage->getRootFilePathUploading() << "] was modified at " << currentModifiedTime
            << " and the last uploaded file was modified at " << lastModifiedTime << ", which are "
            << (currentModifiedTime == lastModifiedTime ? "identical" : "different"));

    // Compare to the last uploaded file's modified-time.
    return currentModifiedTime != lastModifiedTime;
}

void DocumentBroker::handleSaveResponse(const std::shared_ptr<ClientSession>& session,
                                        const Poco::JSON::Object::Ptr& json)
{
    ASSERT_CORRECT_THREAD();

    const bool success = json->get("success").toString() == "true";
    std::string result;
    if (json->has("result"))
    {
        const Poco::Dynamic::Var parsedResultJSON = json->get("result");
        const auto& resultObj = parsedResultJSON.extract<Poco::JSON::Object::Ptr>();
        if (resultObj->get("type").toString() == "string")
            result = resultObj->get("value").toString();
    }

    if (json->has("wasModified"))
    {
        // If Core reports the modified state before saving,
        // use it to report to the Storage with more confidence.
        const bool wasModified = (json->get("wasModified").toString() == "true");
        LOG_DBG("Core reported that the file was " << (wasModified ? "" : "not ")
                                                   << "modified before saving");
        _nextStorageAttrs.setUserModified(wasModified);
    }

    // Update the storage attributes to capture what's
    // new and applies to this new version and reset the next.
    // These are the attributes of the version to be uploaded.
    // Note: these are owned by us and this is thread-safe.
    _currentStorageAttrs.merge(_nextStorageAttrs);
    _nextStorageAttrs.reset();

    // Record that we got a response to avoid timing out on saving.
    _saveManager.setLastSaveResult(success || result == "unmodified", /*newVersion=*/success);

    if (success)
        LOG_DBG("Save result from Core: saved (during " << DocumentState::name(_docState.activity())
                                                        << ") in "
                                                        << _saveManager.lastSaveDuration());
    else if (result == "unmodified")
        LOG_DBG("Save result from Core: unmodified (during "
                << DocumentState::name(_docState.activity()) << ") in "
                << _saveManager.lastSaveDuration());
    else // Failure with error.
        LOG_WRN("Save result from Core (failure): " << result << " (during "
                                                    << DocumentState::name(_docState.activity())
                                                    << ") in " << _saveManager.lastSaveDuration());

#if !MOBILEAPP
    // Create the 'upload' file regardless of success or failure,
    // because we don't know if the last upload worked or not.
    // DocBroker will have to decide to upload or skip.
    const std::string oldName = _storage->getRootFilePathToUpload();
    const std::string newName = _storage->getRootFilePathUploading();

    // Rename even if no new save, in case we have an older version.
    if (rename(oldName.c_str(), newName.c_str()) < 0)
    {
        // It's not an error if there was no file to rename, when the document isn't modified.
        const auto onrre = errno;
        if (success || onrre != ENOENT)
            LOG_ERR("Failed to rename [" << oldName << "] to [" << newName << "] ("
                                          << Util::symbolicErrno(onrre) << ": "
                                          << std::strerror(onrre) << ')');
        else
            LOG_DBG("Failed to rename [" << oldName << "] to [" << newName << "] ("
                                          << Util::symbolicErrno(onrre) << ": "
                                          << std::strerror(onrre) << ')');
    }
    else
    {
        LOG_TRC("Renamed [" << oldName << "] to [" << newName << ']');
    }

    if (_quarantine)
        _quarantine->quarantineFile(newName);
#endif //!MOBILEAPP

    // Let the clients know of any save failures.
    if (!success && result != "unmodified")
    {
        LOG_INF("Failed to save docKey [" << _docKey
                                          << "] as .uno:Save has failed in LOK. Notifying clients");
        session->sendTextFrameAndLogError("error: cmd=storage kind=savefailed");
        broadcastSaveResult(false, "Could not save the document");
    }

    checkAndUploadToStorage(session, /*justSaved=*/success || result == "unmodified");
}

// This is called when either we just got save response, or,
// there was nothing to save and want to check for uploading.
void DocumentBroker::checkAndUploadToStorage(const std::shared_ptr<ClientSession>& session,
                                             bool justSaved)
{
    const std::string sessionId = session->getId();
    LOG_TRC("checkAndUploadToStorage with session [" << sessionId << "], justSaved: " << justSaved);

    // See if we have anything to upload.
    const NeedToUpload needToUploadState = needToUploadToStorage();

    LOG_TRC("checkAndUploadToStorage with session ["
            << session->getId() << "], justSaved: " << justSaved
            << ", activity: " << DocumentState::name(_docState.activity())
            << ", needToUpload: " << name(needToUploadState));

    // Handle activity-specific logic.
    switch (_docState.activity())
    {
        case DocumentState::Activity::Rename:
        {
            // If we have nothing to upload, do the rename now.
            if (needToUploadState == NeedToUpload::No)
            {
                const auto it = _sessions.find(_renameSessionId);
                if (it == _sessions.end())
                {
                    LOG_ERR("Session [" << _renameSessionId << "] not found to rename docKey ["
                                        << _docKey << "]. The document will not be renamed.");
                    broadcastSaveResult(false, "Renaming session not found");
                    endRenameFileCommand();
                }
                else
                {
                    LOG_DBG("Renaming in storage as there is no new version to upload first");
                    std::string uploadAsPath;
                    constexpr bool isRename = true;
                    constexpr bool isExport = false;
                    constexpr bool force = false;
                    uploadToStorageInternal(it->second, uploadAsPath, _renameFilename, isRename,
                                            isExport, force);
                }

                return;
            }
        }
        break;

        case DocumentState::Activity::Save:
        {
            // Done saving.
            endActivity();
        }

        default:
        break;
    }

#if !MOBILEAPP
    // Avoid multiple uploads during unloading if we know we need to save a new version.
    const bool unloading = isUnloading();
    const bool modified =
        justSaved ? haveModifyActivityAfterSaveRequest() : needToSaveToDisk() != NeedToSave::No;

    if (modified && unloading)
    {
        // We are unloading but have possible modifications. Save again (done in poll).
        LOG_DBG("Document [" << getDocKey()
                             << "] is unloading, but was possibly modified during saving. Skipping "
                                "upload to save again before unloading");

        assert(canSaveToDisk() == CanSave::Yes && "Cannot save to disk");
        return;
    }
#endif

    if (needToUploadState != NeedToUpload::No)
    {
        uploadToStorage(session, /*force=*/false);
    }
    else if (!isAsyncUploading())
    {
        // If session is disconnected, remove.
        LOG_TRC("Nothing to upload, disconnecting closed sessions");
        for (const auto& pair : _sessions)
        {
            if (pair.second->isCloseFrame() && !pair.second->inWaitDisconnected())
            {
                LOG_TRC("Disconnecting session [" << pair.second->getName() << ']');
                disconnectSessionInternal(pair.second);
            }
        }
    }
}

void DocumentBroker::uploadToStorage(const std::shared_ptr<ClientSession>& session, bool force)
{
    ASSERT_CORRECT_THREAD();

    LOG_TRC("uploadToStorage [" << session->getId() << "]: " << (force ? "" : "not") << " forced");

    // Upload immediately if forced or had no failures. Otherwise, throttle (on failure).
    if (force || _storageManager.lastUploadSuccessful() ||
        _storageManager.canUploadNow(isUnloading()))
    {
        constexpr bool isRename = false;
        constexpr bool isExport = false;
        uploadToStorageInternal(session, /*saveAsPath*/ std::string(),
                                /*saveAsFilename*/ std::string(), isRename, isExport, force);
    }
    else
    {
        LOG_DBG("Last upload had failed and it's only been "
                << _storageManager.timeSinceLastUploadResponse()
                << " since. Min time between uploads: " << _storageManager.minTimeBetweenUploads());
    }
}

void DocumentBroker::uploadAsToStorage(const std::shared_ptr<ClientSession>& session,
                                       const std::string& uploadAsPath,
                                       const std::string& uploadAsFilename, const bool isRename,
                                       const bool isExport)
{
    ASSERT_CORRECT_THREAD();

    uploadToStorageInternal(session, uploadAsPath, uploadAsFilename, isRename, isExport, /*force=*/false);
}

void DocumentBroker::uploadAfterLoadingTemplate(const std::shared_ptr<ClientSession>& session)
{
    LOG_ASSERT_MSG(session, "Must have a valid ClientSession");

#if !MOBILEAPP
    // Create the 'upload' file as it gets created only when
    // handling .uno:Save, which isn't issued for templates
    // (save is done in Kit right after loading a template).
    const std::string oldName = _storage->getRootFilePathToUpload();
    const std::string newName = _storage->getRootFilePathUploading();
    if (rename(oldName.c_str(), newName.c_str()) < 0)
    {
        // It's not an error if there was no file to rename, when the document isn't modified.
        LOG_SYS("Expected to renamed the document [" << oldName << "] after template-loading to ["
                                                     << newName << ']');
    }
    else
    {
        LOG_TRC("Renamed [" << oldName << "] to [" << newName << ']');
    }
#endif //!MOBILEAPP

    uploadToStorage(session, /*force=*/false);
}

void DocumentBroker::uploadToStorageInternal(const std::shared_ptr<ClientSession>& session,
                                             const std::string& saveAsPath,
                                             const std::string& saveAsFilename, const bool isRename,
                                             const bool isExport, const bool force)
{
    ASSERT_CORRECT_THREAD();
    LOG_ASSERT_MSG(session, "Must have a valid ClientSession");

    const std::string sessionId = session->getId();
    if (!session->isEditable())
    {
        LOG_WRN("Session [" << sessionId << "] is read-only and cannot upload docKey [" << _docKey
                            << ']');
        return;
    }

    LOG_DBG("Uploading to storage docKey [" << _docKey << "] for session [" << sessionId
                                            << "]. Force: " << force);

    const bool isSaveAs = !saveAsPath.empty();
    const std::string uri = isSaveAs ? saveAsPath : session->getPublicUri().toString();

    // Map the FileId from the docKey to the new filename to anonymize the new filename as the FileId.
    const std::string newFilename = Util::getFilenameFromURL(uri);
    const std::string fileId = Util::getFilenameFromURL(_docKey);
    if (COOLWSD::AnonymizeUserData)
    {
        LOG_DBG("New filename [" << COOLWSD::anonymizeUrl(newFilename)
                                 << "] will be known by its fileId [" << fileId << ']');

        Util::mapAnonymized(newFilename, fileId);
    }

    assert(_storage && "Must have a valid Storage instance");

    const std::string uriAnonym = COOLWSD::anonymizeUrl(uri);

    // If the file timestamp hasn't changed, skip uploading.
    const std::string filePath = _storage->getRootFilePathUploading();
    const std::chrono::system_clock::time_point newFileModifiedTime
        = FileUtil::Stat(filePath).modifiedTimepoint();
    if (!isSaveAs && newFileModifiedTime == _saveManager.getLastModifiedTime() && !isRename
        && !force)
    {
        // Nothing to do.
        const auto timeInSec = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::system_clock::now() - _saveManager.getLastModifiedTime());
        LOG_DBG("Skipping unnecessary uploading to URI [" << uriAnonym << "] with docKey [" << _docKey <<
                "]. File last modified " << timeInSec.count() << " seconds ago, timestamp unchanged.");
        _poll->wakeup();
        broadcastSaveResult(true, "unmodified");
        return;
    }

    LOG_DBG("Uploading [" << _docKey << "] after saving to URI [" << uriAnonym << "].");

    _uploadRequest = std::make_unique<UploadRequest>(uriAnonym, newFileModifiedTime, session,
                                                     isSaveAs, isExport, isRename);

    StorageBase::AsyncUploadCallback asyncUploadCallback =
        [this](const StorageBase::AsyncUpload& asyncUp)
    {
        switch (asyncUp.state())
        {
            case StorageBase::AsyncUpload::State::Running:
                LOG_TRC("Async upload of [" << _docKey << "] is in progress during "
                                            << DocumentState::name(_docState.activity()));
                return;

            case StorageBase::AsyncUpload::State::Complete:
            {
                LOG_TRC("Finished uploading [" << _docKey << "] during "
                                               << DocumentState::name(_docState.activity())
                                               << ", processing results.");
                return handleUploadToStorageResponse(asyncUp.result());
            }

            case StorageBase::AsyncUpload::State::None: // Unexpected: fallback.
            case StorageBase::AsyncUpload::State::Error:
            default:
                broadcastSaveResult(false, "Could not upload document to storage");
        }

        LOG_WRN("Failed to upload [" << _docKey << "] asynchronously. "
                                     << DocumentState::name(_docState.activity()));
        _storageManager.setLastUploadResult(false);

        switch (_docState.activity())
        {
            case DocumentState::Activity::None:
                break;

            case DocumentState::Activity::Rename:
            {
                LOG_DBG("Failed to renameFile because uploading post-save failed.");
                const std::string renameSessionId = _renameSessionId;
                endRenameFileCommand();

                auto it = _sessions.find(renameSessionId);
                if (it != _sessions.end() && it->second)
                    it->second->sendTextFrameAndLogError("error: cmd=renamefile kind=failed");
            }
            break;

            default:
                break;
        }
    };

    _lastStorageAttrs = _currentStorageAttrs;
    _currentStorageAttrs.reset();

    // Once set, isUnloading shouldn't be unset.
    _lastStorageAttrs.setIsExitSave(isUnloading());

    if (force)
    {
        // Don't reset the force flag if it was set
        // (which would imply we failed to upload).
        _lastStorageAttrs.setForced(true);
    }

    _nextStorageAttrs.reset();

    _storageManager.markLastUploadRequestTime();
    _storage->uploadLocalFileToStorageAsync(session->getAuthorization(), *_lockCtx, saveAsPath,
                                            saveAsFilename, isRename, _lastStorageAttrs, *_poll,
                                            asyncUploadCallback);
}

void DocumentBroker::handleUploadToStorageResponse(const StorageBase::UploadResult& uploadResult)
{
    if (!_uploadRequest)
    {
        // We shouldn't get here if there is no active upload request.
        LOG_ERR("No active upload request while handling upload result.");
        return;
    }

    // Storage upload is considered successful only when storage returns OK.
    const bool lastUploadSuccessful =
        uploadResult.getResult() == StorageBase::UploadResult::Result::OK;
    LOG_TRC("lastUploadSuccessful: " << lastUploadSuccessful);
    _storageManager.setLastUploadResult(lastUploadSuccessful);

    if (_unitWsd)
        _unitWsd->onDocumentUploaded(lastUploadSuccessful);

#if !MOBILEAPP
    if (lastUploadSuccessful && !isModified())
    {
        // Flag the document as uploaded in the admin console.
        // But only when isModified() == false because it might happen
        // by the time we finish uploading there is further modification
        // to the document.
        _admin.uploadedAlert(_docKey, getPid(), lastUploadSuccessful);
    }
    _admin.getModel().sendMigrateMsgAfterSave(lastUploadSuccessful, _docKey);
#endif

    if (uploadResult.getResult() == StorageBase::UploadResult::Result::OK)
    {
        LOG_DBG("Last upload result: OK");
#if !MOBILEAPP
        WopiStorage* wopiStorage = dynamic_cast<WopiStorage*>(_storage.get());
        if (wopiStorage != nullptr)
            _admin.setDocWopiUploadDuration(_docKey, wopiStorage->getWopiSaveDuration());
#endif

        if (!_uploadRequest->isSaveAs() && !_uploadRequest->isRename())
        {
            // Saved and stored; update flags.
            _saveManager.setLastModifiedTime(_uploadRequest->newFileModifiedTime());

            // Save the storage timestamp.
            _storageManager.setLastModifiedTime(_storage->getLastModifiedTime());

            // Set the timestamp of the file we uploaded, to detect changes.
            _storageManager.setLastUploadedFileModifiedTime(_uploadRequest->newFileModifiedTime());

            // After a successful save, we are sure that document in the storage is same as ours
            _documentChangedInStorage = false;

            // Reset the storage attributes; They've been used and we can discard them.
            _lastStorageAttrs.reset();

            LOG_DBG("Uploaded docKey ["
                    << _docKey << "] to URI [" << _uploadRequest->uriAnonym()
                    << "] and updated timestamps. Document modified timestamp: "
                    << _storageManager.getLastModifiedTime()
                    << ". Current Activity: " << DocumentState::name(_docState.activity()));

            // Handle activity-specific logic.
            switch (_docState.activity())
            {
                case DocumentState::Activity::Rename:
                {
                    const auto it = _sessions.find(_renameSessionId);
                    if (it == _sessions.end())
                    {
                        LOG_ERR("Session [" << _renameSessionId << "] not found to rename docKey ["
                                            << _docKey << "]. The document will not be renamed.");
                        broadcastSaveResult(false, "Renaming session not found");
                        endRenameFileCommand();
                    }
                    else
                    {
                        LOG_DBG("Renaming in storage as we just finished pending upload");
                        std::string uploadAsPath;
                        constexpr bool isRename = true;
                        constexpr bool isExport = false;
                        constexpr bool force = false;
                        uploadToStorageInternal(it->second, uploadAsPath, _renameFilename, isRename,
                                                isExport, force);
                    }
                }
                break;

                default:
                {
                    // Check stop conditions.
                }
                break;
            }

            // Resume polling.
            _poll->wakeup();
        }
        else if (_uploadRequest->isRename())
        {
            endRenameFileCommand();

            // encode the name
            const std::string& filename = uploadResult.getSaveAsName();
            auto uri = Poco::URI(uploadResult.getSaveAsUrl());

            // Remove the access_token, which belongs to the renaming user.
            Poco::URI::QueryParameters queryParams = uri.getQueryParameters();
            queryParams.erase(std::remove_if(queryParams.begin(), queryParams.end(),
                                             [](const std::pair<std::string, std::string>& pair)
                                             { return pair.first == "access_token"; }),
                              queryParams.end());
            uri.setQueryParameters(queryParams);

            const std::string url = uri.toString();
            std::string encodedName = Util::encodeURIComponent(filename);
            const std::string filenameAnonym = COOLWSD::anonymizeUrl(filename);
            std::ostringstream oss;
            oss << "renamefile: " << "filename=" << encodedName << " url=" << url;
            broadcastMessage(oss.str());
            broadcastMessage("close: reloadafterrename");
        }
        else
        {
            // normalize the url (mainly to " " -> "%20")
            const std::string url = Poco::URI(uploadResult.getSaveAsUrl()).toString();

            const std::string& filename = uploadResult.getSaveAsName();

            // encode the name
            std::string encodedName;
            Poco::URI::encode(filename, "", encodedName);
            const std::string filenameAnonym = COOLWSD::anonymizeUrl(filename);

            const auto session = _uploadRequest->session();
            if (session)
            {
                LOG_DBG("Uploaded SaveAs docKey [" << _docKey << "] to URI ["
                                                   << COOLWSD::anonymizeUrl(url) << "] with name ["
                                                   << filenameAnonym << "] successfully.");

                std::ostringstream oss;
                oss << (_uploadRequest->isExport() ? "exportas:" : "saveas:") << " url=" << url << " filename=" << encodedName
                    << " xfilename=" << filenameAnonym;
                session->sendTextFrame(oss.str());

                const auto fileExtension = _filename.substr(_filename.find_last_of('.'));
                if (!strcasecmp(fileExtension.c_str(), ".csv") || !strcasecmp(fileExtension.c_str(), ".txt"))
                {
                    broadcastMessageToOthers("warn: " + oss.str() + " username=" + session->getUserName(), session);
                }
            }
            else
            {
                LOG_DBG("Uploaded SaveAs docKey ["
                        << _docKey << "] to URI [" << COOLWSD::anonymizeUrl(url) << "] with name ["
                        << filenameAnonym << "] successfully, but the client session is closed.");
            }
        }

        broadcastLastModificationTime();

        if (_docState.isUnloadRequested())
        {
            // We just uploaded, flag to destroy if unload is requested.
            LOG_DBG("Unload requested after uploading, marking to destroy.");
            _docState.markToDestroy();
        }

        // If marked to destroy, and there are no late-arriving modifications, then stop.
        if ((_docState.isMarkedToDestroy() || _sessions.empty()) && !isPossiblyModified())
        {
            // Stop so we get cleaned up and removed.
            LOG_DBG("Stopping after uploading because "
                    << (_sessions.empty() ? "there are no active sessions left."
                                          : "the document is marked to destroy."));
            stop("unloading");
        }

        // After uploading, disconnect the sessions pending disconnection.
        for (const auto& pair : _sessions)
        {
            if (pair.second->isCloseFrame() && !pair.second->inWaitDisconnected())
            {
                disconnectSessionInternal(pair.second);
            }
        }

        return;
    }
    else if (uploadResult.getResult() == StorageBase::UploadResult::Result::TOO_LARGE)
    {
        LOG_WRN("Got Entitity Too Large while uploading docKey ["
                << _docKey << "] to URI [" << _uploadRequest->uriAnonym()
                << "]. If a reverse-proxy is used, it might be misconfigured. Alternatively, the "
                   "WOPI host might be low on disk or hitting a quota limit. Making all sessions "
                   "on doc read-only and notifying clients.");

        // Make everyone readonly and tell everyone that the file is too large for the storage.
        for (const auto& sessionIt : _sessions)
        {
            sessionIt.second->sendTextFrameAndLogError("error: cmd=storage kind=savetoolarge");
            sessionIt.second->setWritable(false);
        }

        broadcastSaveResult(false, "Too large", uploadResult.getReason());
    }
    else if (uploadResult.getResult() == StorageBase::UploadResult::Result::DISKFULL)
    {
        LOG_WRN("Disk full while uploading docKey ["
                << _docKey << "] to URI [" << _uploadRequest->uriAnonym()
                << "]. Making all sessions on doc read-only and notifying clients.");

        // Make everyone readonly and tell everyone that storage is low on diskspace.
        for (const auto& sessionIt : _sessions)
        {
            sessionIt.second->sendTextFrameAndLogError("error: cmd=storage kind=savediskfull");
            sessionIt.second->setWritable(false);
        }

        broadcastSaveResult(false, "Disk full", uploadResult.getReason());
    }
    else if (uploadResult.getResult() == StorageBase::UploadResult::Result::UNAUTHORIZED)
    {
        LOG_DBG("Last upload result: UNAUTHORIZED");
        const auto session = _uploadRequest->session();
        if (session)
        {
            LOG_ERR("Cannot upload docKey ["
                    << _docKey << "] to storage URI [" << _uploadRequest->uriAnonym()
                    << "]. Invalid or expired access token. Notifying client and invalidating the "
                       "authorization token of session ["
                    << session->getId() << ']');
            session->sendTextFrameAndLogError("error: cmd=storage kind=saveunauthorized");
            session->invalidateAuthorizationToken();
        }
        else
        {
            LOG_ERR("Cannot upload docKey ["
                    << _docKey << "] to storage URI [" << _uploadRequest->uriAnonym()
                    << "]. Invalid or expired access token. The client session is closed.");
        }

        broadcastSaveResult(false, "Invalid or expired access token");
    }
    else if (uploadResult.getResult() == StorageBase::UploadResult::Result::FAILED)
    {
        LOG_DBG("Last upload result: FAILED");

        //TODO: Should we notify all clients?
        const auto session = _uploadRequest->session();
        if (session)
        {
            LOG_ERR("Failed to upload docKey [" << _docKey << "] to URI [" << _uploadRequest->uriAnonym()
                                                << "]. Notifying client.");
            const std::string msg = std::string("error: cmd=storage kind=")
                                    + (_uploadRequest->isRename() ? "renamefailed" : "savefailed");
            session->sendTextFrame(msg);
        }
        else
        {
            LOG_ERR("Failed to upload docKey [" << _docKey << "] to URI [" << _uploadRequest->uriAnonym()
                                                << "]. The client session is closed.");
        }

        broadcastSaveResult(false, "Save failed", uploadResult.getReason());
    }
    else if (uploadResult.getResult() == StorageBase::UploadResult::Result::DOC_CHANGED
             || uploadResult.getResult() == StorageBase::UploadResult::Result::CONFLICT)
    {
        LOG_ERR("PutFile says that Document [" << _docKey << "] changed in storage");
        _documentChangedInStorage = true;
        // Do not reload the document ("close: documentconflict") if there are
        // any changes in the loaded document, either saved or unsaved.
        const std::string message = (_lastStorageAttrs.isUserModified() ||
                                     _currentStorageAttrs.isUserModified() || isPossiblyModified())
                                        ? "error: cmd=storage kind=documentconflict"
                                        : "close: documentconflict";

        const std::size_t activeClients = broadcastMessage(message);
        broadcastSaveResult(false, "Conflict: Document changed in storage",
                            uploadResult.getReason());
        LOG_TRC("There are " << activeClients
                             << " active clients after broadcasting documentconflict");
        if (activeClients == 0)
        {
            // No clients were contacted; we will never resolve this conflict.
            LOG_WRN("The document ["
                    << _docKey
                    << "] could not be uploaded to storage because there is a newer version there, "
                       "and no active clients exist to resolve the conflict. The document should "
                       "be recoverable from the quarantine. Stopping.");
            stop("conflict");
        }
    }

    // We failed to upload, merge the last attributes into the current one.
    _currentStorageAttrs.merge(_lastStorageAttrs);
    _lastStorageAttrs.reset();
}

void DocumentBroker::broadcastSaveResult(bool success, const std::string& result, const std::string& errorMsg)
{
    const std::string resultstr = success ? "true" : "false";
    // Some sane limit, otherwise we get problems transferring this to the client with large strings (can be a whole webpage)
    std::string errorMsgFormatted = COOLProtocol::getAbbreviatedMessage(errorMsg);
    // Replace reserved characters
    errorMsgFormatted = Poco::translate(errorMsgFormatted, "\"", "'");
    broadcastMessage("commandresult: { \"command\": \"save\", \"success\": " + resultstr +
                     ", \"result\": \"" + result + "\", \"errorMsg\": \"" + errorMsgFormatted  + "\"}");
}

void DocumentBroker::setLoaded()
{
    if (!isLoaded())
    {
        _docState.setLive();
        _loadDuration = std::chrono::duration_cast<std::chrono::milliseconds>(
                                std::chrono::steady_clock::now() - _threadStart);
        const auto minTimeoutSecs = ((_loadDuration * 4).count() + 500) / 1000;
        _saveManager.setSavingTimeout(
            std::max(std::chrono::seconds(minTimeoutSecs), std::chrono::seconds(5)));
        LOG_DBG("Document loaded in " << _loadDuration << ", saving-timeout set to "
                                      << _saveManager.getSavingTimeout());
    }
}

void DocumentBroker::setInteractive(bool value)
{
    if (isInteractive() != value)
    {
        _docState.setInteractive(value);
        LOG_TRC("Document has interactive dialogs before load");
    }
}

std::shared_ptr<ClientSession> DocumentBroker::getWriteableSession() const
{
    ASSERT_CORRECT_THREAD();

    std::shared_ptr<ClientSession> savingSession;
    for (const auto& sessionIt : _sessions)
    {
        const auto& session = sessionIt.second;

        // Save the document using a session that is loaded, editable, and
        // with a valid authorization token, or the first.
        // Note that isViewLoaded() precludes inWaitDisconnected().
        if (!savingSession || (session->isViewLoaded() && session->isEditable() &&
                               !session->getAuthorization().isExpired()))
        {
            savingSession = session;
        }

        // or if any of the sessions is document owner, use that.
        //FIXME: can the owner be read-only?
        if (session->isDocumentOwner())
        {
            savingSession = session;
            break;
        }
    }

    return savingSession;
}

void DocumentBroker::refreshLock()
{
    ASSERT_CORRECT_THREAD();

    const std::shared_ptr<ClientSession> session = getWriteableSession();
    if (!session)
    {
        LOG_ERR("No write-able session to refresh lock with");
        _lockCtx->bumpTimer();
    }
    else if (session->getAuthorization().isExpired())
    {
        LOG_ERR("No write-able session with valid authorization to refresh lock with");
        _lockCtx->bumpTimer();
    }
    else
    {
        const std::string savingSessionId = session->getId();
        LOG_TRC("Refresh lock " << _lockCtx->_lockToken << " with session [" << savingSessionId << ']');
        std::string error;
        if (!updateStorageLockState(*session, /*lock=*/true, error))
        {
            LOG_ERR("Failed to refresh lock of docKey [" << _docKey << "] with session ["
                                                         << savingSessionId << "]: " << error);
        }
    }
}

DocumentBroker::NeedToSave DocumentBroker::needToSaveToDisk() const
{
    if (!_saveManager.lastSaveSuccessful())
    {
        // When saving is attempted and fails, we have no file on disk.
        return NeedToSave::Yes_LastSaveFailed;
    }

    if (isModified())
    {
        // ViewFileExtensions do not update the ModifiedStatus, but,
        // we expect a successful save anyway (including unmodified).
        if (!_isViewFileExtension)
        {
            return NeedToSave::Yes_Modified;
        }

        assert(_isViewFileExtension && "Not a view-file");
        // Fallback to check for activity post-saving.
    }

    assert(_saveManager.lastSaveSuccessful() && "Last save failed");

    if (haveModifyActivityAfterSaveRequest())
    {
        return NeedToSave::Maybe;
    }

    return NeedToSave::No;
}

bool DocumentBroker::manualSave(const std::shared_ptr<ClientSession>& session,
                                bool dontTerminateEdit, bool dontSaveIfUnmodified,
                                const std::string& extendedData)
{
    // If we aren't saving already.
    if (_docState.activity() != DocumentState::Activity::Save)
    {
        LOG_DBG("Manual save by " << session->getName() << " on docKey [" << _docKey << ']');
        return sendUnoSave(session, dontTerminateEdit, dontSaveIfUnmodified,
                           /*isAutosave=*/false, extendedData);
    }

    LOG_DBG("Document [" << _docKey << "] is currently saving and cannot issue another save");
    return false;
}

bool DocumentBroker::autoSave(const bool force, const bool dontSaveIfUnmodified)
{
    ASSERT_CORRECT_THREAD();

    // If we aren't saving already.
    if (_docState.activity() == DocumentState::Activity::Save)
    {
        LOG_DBG("Document [" << _docKey
                             << "] is currently saving and cannot issue another save for autosave");
        return true; // We are saving, wait for the results.
    }

    _saveManager.autoSaveChecked();

    LOG_TRC("autoSave(): forceful? " << force
                                     << ", dontSaveIfUnmodified: " << dontSaveIfUnmodified);

    const CanSave canSave = canSaveToDisk();
    if (canSave != CanSave::Yes)
    {
        LOG_DBG("Cannot save to disk: " << name(canSave));
        return false;
    }

    if (!isModified() && !force)
    {
        // Nothing to do.
        LOG_TRC("Nothing to autosave [" << _docKey << ']');
        return false;
    }

    // Which session to use when auto saving ?
    // Prefer the last editing view, if still valid, otherwise, find the first writable sessionId.
    // Note: a loaded view cannot be disconnecting.
    const auto itLastEditingSession = _sessions.find(_lastEditingSessionId);
    const std::shared_ptr<ClientSession> savingSession =
        (itLastEditingSession != _sessions.end() && itLastEditingSession->second->isEditable() &&
         itLastEditingSession->second->isViewLoaded())
            ? itLastEditingSession->second
            : getWriteableSession();

    if (!savingSession)
    {
        LOG_ERR("No session to use for saving");
        return false;
    }

    const std::string savingSessionId = savingSession->getId();

    // Remember the last save time, since this is the predicate.
    LOG_TRC("Checking to autosave [" << _docKey << "] using session [" << savingSessionId << ']');

    bool sent = false;
    if (force)
    {
        LOG_TRC("Sending forced save command for [" << _docKey << "].");
        // Don't terminate editing as this can be invoked by the admin OOM, but otherwise force saving anyway.
        // Flag isAutosave=false so the WOPI host wouldn't think this is a regular checkpoint and
        // potentially optimize it away. This is as good as user-issued save, since this is
        // triggered when the document is closed. In the case of network disconnection or browser crash
        // most users would want to have had the chance to hit save before the document unloaded.
        sent = sendUnoSave(savingSession, /*dontTerminateEdit=*/true, dontSaveIfUnmodified,
                           /*isAutosave=*/false);
    }
    else if (isModified())
    {
        const std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now();
        const std::chrono::milliseconds inactivityTime
            = std::chrono::duration_cast<std::chrono::milliseconds>(now - _lastActivityTime);
        const auto timeSinceLastSave = std::min(_saveManager.timeSinceLastSaveRequest(),
                                                _storageManager.timeSinceLastUploadResponse());
        LOG_TRC("DocKey [" << _docKey << "] is modified. It has been " << timeSinceLastSave
                           << " since last save and the most recent activity was " << inactivityTime
                           << " ago. Idle save is "
                           << (_saveManager.isIdleSaveEnabled() ? "" : "not ")
                           << "enabled, auto save is "
                           << (_saveManager.isAutoSaveEnabled() ? "" : "not ")
                           << "enabled with interval of " << _saveManager.autoSaveInterval());

        // Either we've been idle long enough, or it's auto-save time.
        bool save = _saveManager.isIdleSaveEnabled() &&
                    inactivityTime >= _saveManager.idleSaveInterval() &&
                    timeSinceLastSave >= _saveManager.idleSaveInterval();

        // Save if it's been long enough since the last save and/or upload.
        if (!save && _saveManager.isAutoSaveEnabled() &&
            timeSinceLastSave >= _saveManager.autoSaveInterval())
        {
            save = true;
        }

        if (save)
        {
            LOG_TRC("Sending timed save command for [" << _docKey << ']');
            sent = sendUnoSave(savingSession, /*dontTerminateEdit=*/true,
                               /*dontSaveIfUnmodified=*/true, /*isAutosave=*/true);
        }
    }

    return sent;
}

void DocumentBroker::autoSaveAndStop(const std::string& reason)
{
    LOG_TRC("autoSaveAndStop for docKey [" << getDocKey() << "]: " << reason);

    if (_saveManager.isSaving() || isAsyncUploading())
    {
        LOG_TRC("Async saving/uploading in progress for docKey [" << getDocKey() << ']');
        return;
    }

    const NeedToSave needToSave = needToSaveToDisk();
    const NeedToUpload needToUpload = needToUploadToStorage();
    bool canStop = (needToSave == NeedToSave::No && needToUpload == NeedToUpload::No);
    LOG_TRC("autoSaveAndStop for docKey [" << getDocKey() << "]: " << name(needToSave) << ", "
                                           << name(needToUpload) << ", canStop: " << canStop);

    if (!canStop && needToSave == NeedToSave::No && !isStorageOutdated())
    {
        if (_alwaysSaveOnExit && !_storageManager.lastUploadSuccessful())
        {
            const auto limStoreFailures =
                COOLWSD::getConfigValue<int>("per_document.limit_store_failures", 5);

            if (limStoreFailures > 0 &&
                _storageManager.uploadFailureCount() >= static_cast<std::size_t>(limStoreFailures))
            {
                LOG_TRC("Uploads for always-save-on-exit are failing. Will stop");
                canStop = true;
            }
            else
            {
                LOG_TRC("Always-save-on-exit is set but last upload failed. Cannot stop.");
                canStop = false;
            }
        }
        else
        {
            LOG_TRC("autoSaveAndStop for docKey ["
                    << getDocKey()
                    << "] has nothing to save and Storage is up-to-date, canStop: true");
            canStop = true;
        }
    }

    if (!canStop && needToSave != NeedToSave::No)
    {
        // Check that we *can* save, now that we know we need to.
        const CanSave canSave = canSaveToDisk();
        if (canSave != CanSave::Yes)
        {
            LOG_ERR("Cannot save because " << name(canSave) << " though " << name(needToSave)
                                           << ". May have data loss, but must stop");
            canStop = true;
        }
    }

    if (!canStop && needToUpload == NeedToUpload::No)
    {
        // Here we don't check for the modified flag because it can come in
        // very late, or not at all. We care that there is nothing to upload
        // and the last save succeeded, possibly because there was no
        // modifications, and there has been no activity since.
        LOG_ASSERT_MSG(_saveManager.lastSaveRequestTime() < _saveManager.lastSaveResponseTime(),
                       "Unexpected active save in flight");
        LOG_ASSERT_MSG(!_saveManager.isSaving(), "Unexpected active save in flight");
        if (!haveModifyActivityAfterSaveRequest() && _saveManager.lastSaveSuccessful())
        {
            // We can stop, but the modified flag is set. Delayed ModifiedStatus?
            if (isModified())
            {
                if (_saveManager.timeSinceLastSaveResponse() < std::chrono::seconds(2))
                {
                    LOG_INF("Can stop " << reason << " DocumentBroker for docKey [" << getDocKey()
                                        << "] but will wait for isModified to clear.");
                    return;
                }

                LOG_WRN("Will stop " << reason << " DocumentBroker for docKey [" << getDocKey()
                                     << "] even with isModified, which is not clearing.");
            }

            // Nothing to upload and last save was successful; stop.
            canStop = true;
            LOG_TRC("autoSaveAndStop for docKey ["
                    << getDocKey() << "]: no modifications since last successful save. Stopping.");
        }
        else if (needToSave == NeedToSave::No)
        {
            // Nothing to upload and no modifications; stop.
            LOG_ASSERT_MSG(!isPossiblyModified(), "Unexpected isPossiblyModified with NeedToSave::No");
            canStop = true;
            LOG_TRC("autoSaveAndStop for docKey [" << getDocKey() << "]: not modified. Stopping.");
        }
    }

    // Don't hammer on saving.
    if (!canStop && _saveManager.canSaveNow(isUnloading()))
    {
        // Stop if there is nothing to save.
        const bool possiblyModified = isPossiblyModified();
        LOG_INF("Autosaving " << reason << " DocumentBroker for docKey [" << getDocKey()
                              << "] before terminating. isPossiblyModified: "
                              << (possiblyModified ? "yes" : "no")
                              << ", conflict: " << (_documentChangedInStorage ? "yes" : "no"));
        if (!autoSave(/*force=*/possiblyModified, /*dontSaveIfUnmodified=*/true))
        {
            // Nothing to save. Try to upload if necessary.
            const auto session = getWriteableSession();
            if (session && !session->getAuthorization().isExpired())
            {
                checkAndUploadToStorage(session, /*justSaved=*/false);
                if (isAsyncUploading())
                {
                    LOG_DBG("Uploading document before stopping.");
                    return;
                }
            }
            else
            {
                // There is nothing to do here except to detect data-loss and stop.
                if (isStorageOutdated())
                {
                    LOG_WRN("The document ["
                            << _docKey
                            << "] could not be uploaded to storage because there are no writable "
                               "sessions, or no authorization tokens, to upload. The document "
                               "should be recoverable from the quarantine. Stopping.");
                }

                canStop = true;
            }
        }
    }
    else if (!canStop)
    {
        LOG_TRC("Too soon to issue another save on ["
                << getDocKey() << "]: " << _saveManager.timeSinceLastSaveRequest()
                << " since last save request, " << _saveManager.timeSinceLastSaveResponse()
                << " since last save response, and last save took "
                << _saveManager.lastSaveDuration()
                << ". Min time between saves: " << _saveManager.minTimeBetweenSaves());
    }

    if (canStop)
    {
        // Nothing to save, nothing to upload, and no modifications. Stop.
        LOG_INF("Nothing to save or upload. Terminating "
                << reason << " DocumentBroker for docKey [" << getDocKey() << ']');
        stop(reason);
    }
}

bool DocumentBroker::sendUnoSave(const std::shared_ptr<ClientSession>& session,
                                 bool dontTerminateEdit, bool dontSaveIfUnmodified, bool isAutosave,
                                 const std::string& extendedData)
{
    ASSERT_CORRECT_THREAD();

    LOG_ASSERT_MSG(session, "Got null ClientSession");
    const std::string sessionId = session->getId();

    LOG_INF("Saving doc [" << _docKey << "] using session [" << sessionId << ']');

    // Invalidate the timestamp to force persisting.
    _saveManager.setLastModifiedTime(std::chrono::system_clock::time_point());

    std::ostringstream oss;
    // arguments init
    oss << '{';

    if (dontTerminateEdit)
    {
        // We do not want save to terminate editing mode if we are in edit mode now.
        //TODO: Perhaps we want to terminate if forced by the user,
        // otherwise autosave doesn't terminate?
        oss << "\"DontTerminateEdit\":"
               "{"
               "\"type\":\"boolean\","
               "\"value\":true"
               "}";
    }

    if (dontSaveIfUnmodified)
    {
        if (dontTerminateEdit)
            oss << ',';

        oss << "\"DontSaveIfUnmodified\":"
               "{"
               "\"type\":\"boolean\","
               "\"value\":true"
               "}";
    }

    // arguments end
    oss << '}';

    // At this point, if we have any potential modifications, we need to capture the fact.
    // If Core does report something different after saving, we'll update this flag.
    _nextStorageAttrs.setUserModified(isModified() || haveModifyActivityAfterSaveRequest());

    // Note: It's odd to capture these here, but this function is used from ClientSession too.
    _nextStorageAttrs.setIsAutosave(isAutosave || (_unitWsd && _unitWsd->isAutosave()));
    _nextStorageAttrs.setExtendedData(extendedData);

    const std::string saveArgs = oss.str();
    LOG_TRC(".uno:Save arguments: " << saveArgs);
    const auto command = "uno .uno:Save " + saveArgs;
    if (forwardToChild(session, command))
    {
        _saveManager.markLastSaveRequestTime();
        if (_docState.activity() == DocumentState::Activity::None)
        {
            // If we aren't in the midst of any particular activity,
            // then this is a generic save on its own.
            startActivity(DocumentState::Activity::Save);
        }

        return true;
    }

    LOG_ERR("Failed to save doc ["
            << _docKey << "]: Failed to forward .uno:Save command to session [" << sessionId
            << ']');
    return false;
}

std::string DocumentBroker::getJailRoot() const
{
    assert(!_jailId.empty());
    return Poco::Path(COOLWSD::ChildRoot, _jailId).toString();
}

std::size_t DocumentBroker::addSession(const std::shared_ptr<ClientSession>& session)
{
    try
    {
        return addSessionInternal(session);
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to add session to [" << _docKey << "] with URI [" << COOLWSD::anonymizeUrl(session->getPublicUri().toString()) << "]: " << exc.what());
        if (_sessions.empty())
        {
            LOG_INF("Doc [" << _docKey << "] has no more sessions. Marking to destroy.");
            _docState.markToDestroy();
        }

        throw;
    }
}

std::size_t DocumentBroker::addSessionInternal(const std::shared_ptr<ClientSession>& session)
{
    ASSERT_CORRECT_THREAD();

    try
    {
        // First, download the document, since this can fail.
        if (!download(session, _childProcess->getJailId()))
        {
            const auto msg = "Failed to load document with URI [" + session->getPublicUri().toString() + "].";
            LOG_ERR(msg);
            throw std::runtime_error(msg);
        }
    }
    catch (const StorageSpaceLowException&)
    {
        LOG_ERR("Out of storage while loading document with URI [" << session->getPublicUri().toString() << "].");

        // We use the same message as is sent when some of cool's own locations are full,
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
    const Poco::URI& uri = _storage->getUri();
    // Create uri without query parameters
    const std::string wopiSrc(uri.getScheme() + "://" + uri.getAuthority() + uri.getPath());
    _admin.addDoc(_docKey, getPid(), getFilename(), id, session->getUserName(),
                  session->getUserId(), _childProcess->getSMapsFD(), wopiSrc, session->isReadOnly());
    _admin.setDocWopiDownloadDuration(_docKey, _wopiDownloadDuration);
#endif

    // Add and attach the session.
    _sessions.emplace(session->getId(), session);
    session->setState(ClientSession::SessionState::LOADING);

    const std::size_t count = _sessions.size();
    LOG_TRC("Added " << (session->isReadOnly() ? "readonly" : "non-readonly") <<
            " session [" << id << "] to docKey [" <<
            _docKey << "] to have " << count << " sessions.");

    if (_unitWsd)
    {
        _unitWsd->onDocBrokerAddSession(_docKey, session);
    }

    return count;
}

std::size_t DocumentBroker::removeSession(const std::shared_ptr<ClientSession>& session)
{
    ASSERT_CORRECT_THREAD();

    LOG_ASSERT_MSG(session, "Got null ClientSession");
    const std::string id = session->getId();
    try
    {
        const std::size_t activeSessionCount = countActiveSessions();

        const bool lastEditableSession = session->isEditable() && !haveAnotherEditableSession(id);
        const bool dontSaveIfUnmodified = !_alwaysSaveOnExit;

        LOG_INF("Removing session [" << id << "] on docKey [" << _docKey << "]. Have "
                                     << _sessions.size() << " sessions (" << activeSessionCount
                                     << " active). IsLive: " << session->isLive()
                                     << ", IsReadOnly: " << session->isReadOnly()
                                     << ", IsAllowChangeComments: " << session->isAllowChangeComments()
                                     << ", IsEditable: " << session->isEditable()
                                     << ", Unloading: " << _docState.isUnloadRequested()
                                     << ", MarkToDestroy: " << _docState.isMarkedToDestroy()
                                     << ", LastEditableSession: " << lastEditableSession
                                     << ", DontSaveIfUnmodified: " << dontSaveIfUnmodified
                                     << ", IsPossiblyModified: " << isPossiblyModified());

        // In theory, we almost could do this here:

        // #if MOBILEAPP
        // There is always just one "session" in a mobile app, and the same one process continues
        // running, so no need to delay the disconnectSessionInternal() call. Doing it like this
        // will also get rid of the docbroker and lokit_main thread for the document quicker.

        // But, in reality it has unintended side effects on iOS because if you have done changes to
        // the document, it does get saved, but that is only to the temporary copy. It is only in
        // the document callback handler for LOK_CALLBACK_UNO_COMMAND_RESULT that we then call the
        // system API to save that copy back to where it came from. See the
        // LOK_CALLBACK_UNO_COMMAND_RESULT case in ChildSession::loKitCallback() in
        // ChildSession.cpp. If we did use the below code snippet here, the document callback would
        // get unregistered right away in Document::onUnload in Kit.cpp.

        // autoSave(isPossiblyModified(), dontSaveIfUnmodified);
        // disconnectSessionInternal(id);
        // stop("stopped");

        // So just go down the same code path as for normal Online:

        // If last editable, save (if not saving already) and
        // don't remove until after uploading to storage.
        if (!lastEditableSession ||
            (!_saveManager.isSaving() &&
             !autoSave(/*force=*/isPossiblyModified(), dontSaveIfUnmodified)))
        {
            disconnectSessionInternal(session);
        }

        // Last view going away; can destroy?
        if (activeSessionCount <= 1)
        {
            if (_saveManager.isSaving() || isAsyncUploading())
            {
                // Don't destroy just yet, wait until save and upload are done.
                // Notice that the save and/or upload could have been triggered
                // earlier, and not necessarily here when removing this last session.
                _docState.setUnloadRequested();
                LOG_DBG("Removing last session and will unload after saving and uploading. Setting "
                        "UnloadRequested flag.");
            }
            else if (_sessions.empty())
            {
                // Nothing to save, and we were the last.
                _docState.markToDestroy();
                LOG_DBG("No more sessions after removing last. Setting MarkToDestroy flag.");
            }
        }
        else if (activeSessionCount > 0)
        {
            LOG_ASSERT_MSG(!_docState.isMarkedToDestroy(),
                           "Have active sessions while marked to destroy");
        }
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Error while removing session [" << id << "]: " << ex.what());
    }

    return _sessions.size();
}

void DocumentBroker::disconnectSessionInternal(const std::shared_ptr<ClientSession>& session)
{
    ASSERT_CORRECT_THREAD();

    LOG_ASSERT_MSG(session, "Got null ClientSession");
    const std::string id = session->getId();
    try
    {
#if !MOBILEAPP
        _admin.rmDoc(_docKey, id);
        COOLWSD::dumpEndSessionTrace(getJailId(), id, _uriOrig);
#endif
        if (_docState.isUnloadRequested())
        {
            // We must be the last session, flag to destroy if unload is requested.
            LOG_ASSERT_MSG(countActiveSessions() <= 1, "Unload-requested with multiple sessions");
            LOG_TRC("Unload requested while disconnecting session ["
                    << id << "], having " << _sessions.size() << " sessions, marking to destroy");
            _docState.markToDestroy();
        }

        const bool lastEditableSession = session->isEditable() && !haveAnotherEditableSession(id);

        LOG_TRC("Disconnect session internal "
                << id << ", LastEditableSession: " << lastEditableSession << " destroy? "
                << _docState.isMarkedToDestroy() << " locked? " << _lockCtx->_isLocked << ", have "
                << _sessions.size() << " sessions (inclusive)");

        // Unlock the document, if last editable sessions, before we lose a token that can unlock.
        std::string error;
        if (lastEditableSession && _lockCtx->_isLocked && _storage &&
            !updateStorageLockState(*session, /*lock=*/false, error))
        {
            LOG_ERR("Failed to unlock docKey [" << _docKey
                                                << "] before disconnecting last editable session ["
                                                << session->getName() << "]: " << error);
        }

        bool hardDisconnect;
        if (session->inWaitDisconnected())
        {
            LOG_TRC("Removing session [" << id << "] while waiting for disconnected handshake");
            hardDisconnect = true;
        }
        else
        {
            LOG_DBG("Disconnecting session [" << id << "] from Kit");
            hardDisconnect = session->disconnectFromKit();

#if !MOBILEAPP
            if (!isLoaded() && _sessions.empty())
            {
                // We aren't even loaded and no other views--kill.
                // If we send disconnect, we risk hanging because we flag Core for
                // quiting via unipoll, but Core would still continue loading.
                // If at the end of loading it shows a dialog (such as the macro or
                // csv import dialogs), it will wait for their dismissal indefinetely.
                // Neither would our load-timeout kick in, since we would be gone.
                LOG_INF("Session [" << session->getName() << "] disconnected but DocKey ["
                                    << _docKey
                                    << "] isn't loaded yet. Terminating the child roughly");
                _childProcess->terminate();
            }
#endif
        }

        if (hardDisconnect)
            finalRemoveSession(session);
        // else wait for disconnected.
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Error while disconnecting session [" << id << "]: " << ex.what());
    }
}

void DocumentBroker::finalRemoveSession(const std::shared_ptr<ClientSession>& session)
{
    ASSERT_CORRECT_THREAD();

    LOG_ASSERT_MSG(session, "Got null ClientSession");
    const std::string sessionId = session->getId();
    try
    {
        if (_unitWsd)
        {
            // Notify test code before removal.
            _unitWsd->onDocBrokerRemoveSession(_docKey, session);
        }

        const bool readonly = session->isReadOnly();
        session->dispose();

        // Remove. The caller must have a reference to the session
        // in question, lest we destroy from underneath them.
        _sessions.erase(sessionId);

        LOG_TRC("Removed " << (readonly ? "" : "non-") << "readonly session [" << sessionId
                           << "] from docKey [" << _docKey << "] to have " << _sessions.size()
                           << " sessions:" <<
                [&](auto& log)
                {
                    for (const auto& pair : _sessions)
                        log << pair.second->getId() << ' ';
                });
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Error while removing session [" << sessionId << "]: " << ex.what());
    }
}

std::shared_ptr<ClientSession> DocumentBroker::createNewClientSession(
    const std::shared_ptr<ProtocolHandlerInterface> &ws,
    const std::string& id,
    const Poco::URI& uriPublic,
    const bool isReadOnly,
    const RequestDetails &requestDetails)
{
    try
    {
        if (isMarkedToDestroy() || _docState.isUnloadRequested())
        {
            LOG_WRN("DocBroker [" << getDocKey()
                                  << "] is unloading. Rejecting client request to load session ["
                                  << id << ']');
            if (ws)
            {
                const std::string msg("error: cmd=load kind=docunloading");
                ws->sendTextMessage(msg.data(), msg.size());
                ws->shutdown(true, msg);
            }

            return nullptr;
        }

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
        auto session = std::make_shared<ClientSession>(ws, id, shared_from_this(), uriPublic, isReadOnly, requestDetails);
        session->construct();

        return session;
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Exception while preparing session [" << id << "]: " << exc.what());
    }

    return nullptr;
}

void DocumentBroker::addCallback(const SocketPoll::CallbackFn& fn)
{
    _poll->addCallback(fn);
}

void DocumentBroker::addSocketToPoll(const std::shared_ptr<StreamSocket>& socket)
{
    _poll->insertNewSocket(socket);
}

void DocumentBroker::alertAllUsers(const std::string& msg)
{
    ASSERT_CORRECT_THREAD();

    if (_unitWsd && _unitWsd->filterAlertAllusers(msg))
        return;

    auto payload = std::make_shared<Message>(msg, Message::Dir::Out);

    LOG_DBG("Alerting all users of [" << _docKey << "]: " << msg);
    for (auto& it : _sessions)
    {
        if (!it.second->inWaitDisconnected())
            it.second->enqueueSendMessage(payload);
    }
}

void DocumentBroker::setKitLogLevel(const std::string& level)
{
    ASSERT_CORRECT_THREAD();
    _childProcess->sendTextFrame("setloglevel " + level);
}

std::string DocumentBroker::getDownloadURL(const std::string& downloadId)
{
    auto aFound = _registeredDownloadLinks.find(downloadId);
    if (aFound != _registeredDownloadLinks.end())
        return aFound->second;

    return "";
}

void DocumentBroker::unregisterDownloadId(const std::string& downloadId)
{
    auto aFound = _registeredDownloadLinks.find(downloadId);
    if (aFound != _registeredDownloadLinks.end())
        _registeredDownloadLinks.erase(aFound);
}

/// Handles input from the prisoner / child kit process
bool DocumentBroker::handleInput(const std::shared_ptr<Message>& message)
{
    LOG_TRC("DocumentBroker handling child message: [" << message->abbr() << ']');

#if !MOBILEAPP
    if (COOLWSD::TraceDumper)
        COOLWSD::dumpOutgoingTrace(getJailId(), "0", message->abbr());
#endif

    if (_unitWsd && _unitWsd->filterLOKitMessage(message))
        return true;

    if (COOLProtocol::getFirstToken(message->forwardToken(), '-') == "client")
    {
        forwardToClient(message);
    }
    else
    {
        if (message->firstTokenMatches("tile:"))
        {
            handleTileResponse(message);
        }
        else if (message->firstTokenMatches("tilecombine:"))
        {
            handleTileCombinedResponse(message);
        }
        else if (message->firstTokenMatches("errortoall:"))
        {
            LOG_CHECK_RET(message->tokens().size() == 3, false);
            std::string cmd, kind;
            COOLProtocol::getTokenString((*message)[1], "cmd", cmd);
            LOG_CHECK_RET(cmd != "", false);
            COOLProtocol::getTokenString((*message)[2], "kind", kind);
            LOG_CHECK_RET(kind != "", false);
            Util::alertAllUsers(cmd, kind);
        }
        else if (message->firstTokenMatches("registerdownload:"))
        {
            LOG_CHECK_RET(message->tokens().size() == 4, false);
            std::string downloadid, url, clientId;
            COOLProtocol::getTokenString((*message)[1], "downloadid", downloadid);
            LOG_CHECK_RET(downloadid != "", false);
            COOLProtocol::getTokenString((*message)[2], "url", url);
            LOG_CHECK_RET(url != "", false);
            COOLProtocol::getTokenString((*message)[3], "clientid", clientId);
            LOG_CHECK_RET(!clientId.empty(), false);

            std::string decoded;
            Poco::URI::decode(url, decoded);
            const std::string filePath(COOLWSD::ChildRoot + getJailId() + JAILED_DOCUMENT_ROOT + decoded);

            std::ifstream ifs(filePath);
            const std::string svg((std::istreambuf_iterator<char>(ifs)),
                                (std::istreambuf_iterator<char>()));
            ifs.close();

            if (svg.empty())
                LOG_WRN("Empty download: [id: " << downloadid << ", url: " << url << "].");

            const auto it = _sessions.find(clientId);
            if (it != _sessions.end())
            {
                std::ofstream ofs(filePath);
                ofs << it->second->processSVGContent(svg);
            }

            _registeredDownloadLinks[downloadid] = url;
        }
        else if (message->firstTokenMatches("traceevent:"))
        {
            LOG_CHECK_RET(message->tokens().size() == 1, false);
            if (COOLWSD::TraceEventFile != NULL && TraceEvent::isRecordingOn())
            {
                const auto firstLine = message->firstLine();
                if (firstLine.size() < message->size())
                    COOLWSD::writeTraceEventRecording(message->data().data() + firstLine.size() + 1,
                                                      message->size() - firstLine.size() - 1);
            }
        }
        else if (message->firstTokenMatches("forcedtraceevent:"))
        {
            LOG_CHECK_RET(message->tokens().size() == 1, false);
            if (COOLWSD::TraceEventFile != NULL)
            {
                const auto firstLine = message->firstLine();
                if (firstLine.size() < message->size())
                    COOLWSD::writeTraceEventRecording(message->data().data() + firstLine.size() + 1,
                                                      message->size() - firstLine.size() - 1);
            }
        }
        else
        {
            LOG_ERR("Unexpected message: [" << message->abbr() << "].");
            return false;
        }
    }

    return true;
}

std::size_t DocumentBroker::getMemorySize() const
{
    return sizeof(DocumentBroker) +
        (!!_tileCache ? _tileCache->getMemorySize() : 0) +
        _sessions.size() * sizeof(ClientSession);
}

// Expected to be legacy, ~all new requests are tilecombinedRequests
void DocumentBroker::handleTileRequest(const StringVector &tokens, bool forceKeyframe,
                                       const std::shared_ptr<ClientSession>& session)
{
    ASSERT_CORRECT_THREAD();
    std::unique_lock<std::mutex> lock(_mutex);

    TileDesc tile = TileDesc::parse(tokens);
    tile.setNormalizedViewId(session->getCanonicalViewId());

    tile.setVersion(++_tileVersion);
    const std::string tileMsg = tile.serialize();
    LOG_TRC("Tile request for " << tileMsg);

    if (!hasTileCache())
    {
        LOG_WRN("Tile request without a loaded document?");
        return;
    }

    if (forceKeyframe)
    {
        LOG_TRC("forcing a keyframe for tilecombined tile");
        session->resetTileSeq(tile);
    }

    Tile cachedTile = _tileCache->lookupTile(tile);
    if (cachedTile && cachedTile->isValid())
    {
        session->sendTileNow(tile, cachedTile);
        return;
    }

    if (!cachedTile)
        tile.forceKeyframe();

    auto now = std::chrono::steady_clock::now();
    tileCache().subscribeToTileRendering(tile, session, now);

    // Forward to child to render.
    LOG_DBG("Sending render request for tile (" << tile.getPart() << ',' <<
            tile.getEditMode() << ',' << tile.getTilePosX() << ',' << tile.getTilePosY() << ").");
    const std::string request = "tile " + tileMsg;
    _childProcess->sendTextFrame(request);
    _debugRenderedTileCount++;
}

void DocumentBroker::sendTileCombine(const TileCombined& newTileCombined)
{
    assert(!newTileCombined.hasDuplicates());

    // Forward to child to render.
    const std::string req = newTileCombined.serialize("tilecombine");
    LOG_TRC("Some of the tiles were not prerendered. Sending residual tilecombine: " << req);
    _childProcess->sendTextFrame(req);
}

void DocumentBroker::handleTileCombinedRequest(TileCombined& tileCombined, bool forceKeyframe,
                                               const std::shared_ptr<ClientSession>& session)
{
    std::unique_lock<std::mutex> lock(_mutex);

    assert(!tileCombined.hasDuplicates());

    LOG_TRC("TileCombined request for " << tileCombined.serialize() << " from " <<
            (forceKeyframe ? "client" : "wsd"));
    if (!hasTileCache())
    {
        LOG_WRN("Combined tile request without a loaded document?");
        return;
    }

    // Check which newly requested tiles need rendering.
    const auto now = std::chrono::steady_clock::now();
    std::vector<TileDesc> tilesNeedsRendering;
    for (auto& tile : tileCombined.getTiles())
    {
        tile.setVersion(++_tileVersion);

        // client can force keyframe with an oldWid == 0 on tile
        if (forceKeyframe && tile.getOldWireId() == 0)
        {
            // combinedtiles requests direct from the browser get flagged.
            // The browser may have dropped / cleaned its cache, so we can't
            // rely on what we think we have sent it to send a delta in this
            // case; so forget what we last sent.
            LOG_TRC("forcing a keyframe for tilecombined tile (" << tile.getPart() << ',' <<
                    tile.getEditMode() << ',' << tile.getTilePosX() << ',' << tile.getTilePosY() << ").");
            session->resetTileSeq(tile);
            // don't force a keyframe to be rendered, only to be sent.
            tile.setOldWireId(1);
        }

        Tile cachedTile = _tileCache->lookupTile(tile);
        if(!cachedTile || !cachedTile->isValid())
        {
            if (!cachedTile)
                tile.forceKeyframe();
            tilesNeedsRendering.push_back(tile);
            _debugRenderedTileCount++;
            tileCache().subscribeToTileRendering(tile, session, now);
        }
    }

    // Send rendering request, prerender before we actually send the tiles
    if (!tilesNeedsRendering.empty())
        sendTileCombine(TileCombined::create(tilesNeedsRendering));

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
            bool tileFound = false;
            for (auto& oldTile : requestedTiles)
            {
                if(oldTile.getTilePosX() == newTile.getTilePosX() &&
                   oldTile.getTilePosY() == newTile.getTilePosY() &&
                   oldTile.sameTileCombineParams(newTile))
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
        COOLWSD::SavedClipboards->getClipboard(tag);
    if (saved)
    {
            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "Last-Modified: " << Util::getHttpTimeNow() << "\r\n"
                << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                << "Content-Length: " << saved->length() << "\r\n"
                << "Content-Type: application/octet-stream\r\n"
                << "X-Content-Type-Options: nosniff\r\n"
                << "Connection: close\r\n"
                << "\r\n";
            oss.write(saved->c_str(), saved->length());
            socket->setSocketBufferSize(
                std::min(saved->length() + 256, std::size_t(Socket::MaximumSendBufferSize)));
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
    HttpHelper::sendError(http::StatusCode::BadRequest, socket, "Failed to find this clipboard",
                          "Connection: close\r\n");
#endif
    socket->shutdown();
    socket->ignoreInput();

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

void DocumentBroker::handleMediaRequest(std::string range,
                                        const std::shared_ptr<Socket>& socket,
                                        const std::string& tag)
{
    LOG_DBG("handleMediaRequest: " << tag);

    auto streamSocket = std::static_pointer_cast<StreamSocket>(socket);
    if (!streamSocket)
    {
        LOG_ERR("Invalid socket to handle media request in Doc [" << _docId << "] with tag [" << tag
                                                                  << ']');
        return;
    }

    const auto it = _embeddedMedia.find(tag);
    if (it == _embeddedMedia.end())
    {
        LOG_ERR("Invalid media request in Doc [" << _docId << "] with tag [" << tag << ']');
        return;
    }

    LOG_DBG("Media: " << it->second);
    Poco::JSON::Object::Ptr object;
    if (JsonUtil::parseJSON(it->second, object))
    {
        LOG_ASSERT(JsonUtil::getJSONValue<std::string>(object, "id") == tag);
        const std::string url = JsonUtil::getJSONValue<std::string>(object, "url");
        LOG_ASSERT(!url.empty());
        if (Util::startsWith(Util::toLower(url), "file://"))
        {
            // For now, we only support file:// schemes.
            // In the future, we may/should support http.
#if !MOBILEAPP
            // We always extract media files in /tmp. Normally, we are in jail (chroot),
            // and this would need to be accessed from WSD through the JailRoot path.
            // But, when we have NoCapsForKit there is no jail, so the media file ends
            // up in the host (AppImage) /tmp
            const std::string root = COOLWSD::NoCapsForKit ? "/" : getJailRoot();
#else
            const std::string root = getJailRoot();
#endif
            const std::string path = root + url.substr(sizeof("file://") - 1);

            auto session = std::make_shared<http::server::Session>();
            session->asyncUpload(path, "video/mp4", range);
            auto handler = std::static_pointer_cast<ProtocolHandlerInterface>(session);
            streamSocket->setHandler(handler);
        }
    }
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

    auto now = std::chrono::steady_clock::now();

    // All tiles were processed on client side that we sent last time, so we can send
    // a new batch of tiles which was invalidated / requested in the meantime
    std::deque<TileDesc>& requestedTiles = session->getRequestedTiles();
    if (!requestedTiles.empty() && hasTileCache())
    {
        std::size_t delayedTiles = 0;
        std::vector<TileDesc> tilesNeedsRendering;
        bool allSamePartAndSize = true;
        std::size_t beingRendered = _tileCache->countTilesBeingRenderedForSession(session, now);
        while (session->getTilesOnFlyCount() + beingRendered < tilesOnFlyUpperLimit &&
              !requestedTiles.empty() &&
              // If we delayed all tiles we don't send any tile (we will when next tileprocessed message arrives)
              delayedTiles < requestedTiles.size())
        {
            TileDesc& tile = *(requestedTiles.begin());

            // We already sent out two versions of the same tile, let's not send the third one
            // until we get a tileprocessed message for this specific tile.
            if (session->countIdenticalTilesOnFly(tile) >= 2)
            {
                LOG_DBG("Requested tile " << tile.getWireId() << " was delayed (already sent a version)!");
                requestedTiles.push_back(requestedTiles.front());
                requestedTiles.pop_front();
                delayedTiles += 1;
                continue;
            }

            // Satisfy as many tiles from the cache.
            Tile cachedTile = _tileCache->lookupTile(tile);
            if (cachedTile && cachedTile->isValid())
            {
                // It is typical for a request not to have a wireId. If the result is generated
                // without using the cache then doRender will send a timecombine result with wireIds
                // set. But if we use the cache here we send a response using the wireId of the request.

                // With no wireId in the request the result will have wireId of 0 and
                // in CanvasTileLayer.js tile::needsFetch such a tile will always return true
                // for needsFetch and is wasted.
                if (tile.getWireId() == 0)
                    tile.setWireId(cachedTile->_wids.back());

                // TODO: Combine the response to reduce latency.
                session->sendTileNow(tile, cachedTile);
            }
            else
            {
                // Not cached, needs rendering.
                if (!tileCache().hasTileBeingRendered(tile, &now) || // There is no in progress rendering of the given tile
                    tileCache().getTileBeingRenderedVersion(tile) < tile.getVersion()) // We need a newer version
                {
                    tile.setVersion(++_tileVersion);
                    if (!cachedTile) // forceKeyframe
                    {
                        LOG_TRC("Forcing keyframe for tile was oldwid " << tile.getOldWireId());
                        tile.setOldWireId(0);
                    }
                    allSamePartAndSize &= tilesNeedsRendering.empty() || tile.sameTileCombineParams(tilesNeedsRendering.back());
                    tilesNeedsRendering.push_back(tile);
                    _debugRenderedTileCount++;
                }
                if (tileCache().subscribeToTileRendering(tile, session, now))
                    beingRendered++;
            }
            requestedTiles.pop_front();
        }

        // Send rendering request for those tiles which were not prerendered
        if (!tilesNeedsRendering.empty())
        {
            if (allSamePartAndSize)
            {
                // typically all requests match sufficiently to form a single tilecombine
                sendTileCombine(TileCombined::create(tilesNeedsRendering));
            }
            else
            {
                // but if not, split them by matching groups of requests to send a separate
                // tilecombine for each group
                std::vector<std::vector<TileDesc>> groupsNeedsRendering(1);
                auto it = tilesNeedsRendering.begin();
                // start off with one group bucket
                groupsNeedsRendering[0].push_back(*it++);
                while (it != tilesNeedsRendering.end())
                {
                    bool inserted = false;
                    // check if tile should go into an existing group bucket
                    for (size_t i = 0; i < groupsNeedsRendering.size(); ++i)
                    {
                        if (it->sameTileCombineParams(groupsNeedsRendering[i][0]))
                        {
                            groupsNeedsRendering[i].push_back(*it);
                            inserted = true;
                            break;
                        }
                    }
                    // if not, add another and put it there
                    if (!inserted)
                    {
                        groupsNeedsRendering.emplace_back();
                        groupsNeedsRendering.back().push_back(*it);
                    }
                    ++it;
                }
                for (const auto& group : groupsNeedsRendering)
                    sendTileCombine(TileCombined::create(group));
            }
        }
    }
}

void DocumentBroker::handleTileResponse(const std::shared_ptr<Message>& message)
{
    const std::string firstLine = message->firstLine();
    LOG_DBG("Handling tile: " << firstLine);

    try
    {
        const std::size_t length = message->size();
        if (firstLine.size() < static_cast<std::string::size_type>(length) - 1)
        {
            const TileDesc tile = TileDesc::parse(firstLine);
            const char* buffer = message->data().data();
            const std::size_t offset = firstLine.size() + 1;

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
        LOG_ERR("Failed to process tile response [" << firstLine << "]: " << exc.what() << '.');
    }
}

void DocumentBroker::handleTileCombinedResponse(const std::shared_ptr<Message>& message)
{
    const std::string firstLine = message->firstLine();
    LOG_DBG("Handling tile combined: " << firstLine);

    try
    {
        const std::size_t length = message->size();
        if (firstLine.size() <= static_cast<std::string::size_type>(length) - 1)
        {
            const TileCombined tileCombined = TileCombined::parse(firstLine);
            const char* buffer = message->data().data();
            std::size_t offset = firstLine.size() + 1;

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
        LOG_ERR("Failed to process tile response [" << firstLine << "]: " << exc.what() << '.');
    }
}

bool DocumentBroker::haveAnotherEditableSession(const std::string& id) const
{
    ASSERT_CORRECT_THREAD();

    for (const auto& it : _sessions)
    {
        if (it.second->getId() != id && it.second->isViewLoaded() && it.second->isEditable())
        {
            // This is a loaded session that is non-readonly.
            return true;
        }
    }

    // None found.
    return false;
}

std::size_t DocumentBroker::countActiveSessions() const
{
    ASSERT_CORRECT_THREAD();

    std::size_t count = 0;
    for (const auto& it : _sessions)
    {
        if (it.second->isLive())
        {
            ++count;
        }
    }

    return count;
}

void DocumentBroker::setModified(const bool value)
{
#if !MOBILEAPP
    // Flag the document as modified in the admin console.
    _admin.modificationAlert(_docKey, getPid(), value);

    // Flag the document as uploaded in the admin console.
    _admin.uploadedAlert(
        _docKey, getPid(), !isAsyncUploading() && needToUploadToStorage() == NeedToUpload::No);
#endif

    LOG_DBG("Modified state set to " << value << " for Doc [" << _docId << ']');
    _isModified = value;
}

bool DocumentBroker::isInitialSettingSet(const std::string& name) const
{
    return _isInitialStateSet.find(name) != _isInitialStateSet.end();
}

void DocumentBroker::setInitialSetting(const std::string& name)
{
    _isInitialStateSet.emplace(name);
}

bool DocumentBroker::forwardUrpToChild(const std::string& message)
{
    if (!_childProcess)
        return false;
    return _childProcess->sendUrpMessage(message);
}

bool DocumentBroker::forwardToChild(const std::shared_ptr<ClientSession>& session,
                                    const std::string& message, bool binary)
{
    if (Util::startsWith(message, "urp "))
        return forwardUrpToChild(message);

    ASSERT_CORRECT_THREAD();
    LOG_ASSERT_MSG(session, "Must have a valid ClientSession");
    LOG_ASSERT_MSG(_sessions.find(session->getId()) != _sessions.end(),
                   "ClientSession must be known");

    // Ignore userinactive, useractive message until document is loaded
    if (!isLoaded() && (message == "userinactive" || message == "useractive"))
    {
        return true;
    }

    const std::string viewId = session->getId();

    LOG_TRC("Forwarding payload to child [" << viewId << "]: " << getAbbreviatedMessage(message));

#if 0 // extreme paste debugging - message can be giant and binary
    if (Log::traceEnabled() && Util::startsWith(message, "paste "))
        LOG_TRC("Logging paste payload (" << message.size() << " bytes) '" << message << "' end paste");
#endif

    std::string msg = "child-" + viewId + ' ';
    if (Util::startsWith(message, "load "))
    {
        // Special-case loading.
        const StringVector tokens = StringVector::tokenize(message);
        if (tokens.size() > 1 && tokens.equals(0, "load"))
        {
            LOG_ASSERT_MSG(!_uriJailed.empty(), "Must have valid _uriJailed");

            // The json options must come last.
            msg += "load " + tokens[1];
            msg += " jail=" + _uriJailed;
            msg += " xjail=" + _uriJailedAnonym;
            msg += ' ' + tokens.cat(' ', 2);
            return _childProcess->sendFrame(msg, binary);
        }
    }

    // Forward message with prefix to the Kit.
    return _childProcess->sendFrame(msg + message, binary);
}

bool DocumentBroker::forwardToClient(const std::shared_ptr<Message>& payload)
{
    ASSERT_CORRECT_THREAD();

    const std::string& prefix = payload->forwardToken();
    LOG_TRC("Forwarding payload to [" << prefix << "]: " << payload->abbr());

    std::string name;
    std::string sid;
    if (COOLProtocol::parseNameValuePair(prefix, name, sid, '-') && name == "client")
    {
        if (sid == "all")
        {
            // Broadcast to all.
            // Events could cause the removal of sessions.
            std::map<std::string, std::shared_ptr<ClientSession>> sessions(_sessions);
            for (const auto& it : _sessions)
            {
                if (!it.second->inWaitDisconnected())
                    it.second->handleKitToClientMessage(payload);
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
                return session->handleKitToClientMessage(payload);
            }
            else
            {
                const std::string abbreviatedPayload = COOLWSD::AnonymizeUserData ? "..." : payload->abbr();
                LOG_WRN("Client session [" << sid << "] not found to forward message: " << abbreviatedPayload);
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
    ASSERT_CORRECT_THREAD();
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
                finalRemoveSession(session);
            else
            {
                // Notify the client and disconnect.
                session->shutdownGoingAway(closeReason);

                // Remove session, save, and mark to destroy.
                removeSession(session);
            }
        }
        catch (const std::exception& exc)
        {
            LOG_ERR("Error while shutting down client [" <<
                    session->getName() << "]: " << exc.what());
        }
    }
}

void DocumentBroker::terminateChild(const std::string& closeReason)
{
    ASSERT_CORRECT_THREAD();

    LOG_INF("Terminating doc [" << _docKey << "] with reason: " << closeReason);

    // Close all running sessions first.
    shutdownClients(closeReason);

    if (_childProcess)
    {
        LOG_INF("Terminating child [" << getPid() << "] of doc [" << _docKey << ']');

        _childProcess->close();
    }

    stop(closeReason);
}

void DocumentBroker::closeDocument(const std::string& reason)
{
    ASSERT_CORRECT_THREAD();

    _docState.setCloseRequested();
    _closeReason = reason;
    if (_documentChangedInStorage)
    {
        // Discarding changes in the face of conflict in storage.
        LOG_DBG("Closing DocumentBroker for docKey ["
                << _docKey << "] and discarding changes with reason: " << reason);
        stop(reason);
    }
    else
    {
        LOG_DBG("Closing DocumentBroker for docKey [" << _docKey << "] with reason: " << reason);
    }
}

void DocumentBroker::disconnectedFromKit(bool unexpected)
{
    // Always set the disconnected flag.
    _docState.setDisconnected(unexpected ? DocumentState::Disconnected::Unexpected
                                         : DocumentState::Disconnected::Normal);
    if (_closeReason.empty())
    {
        // If we have a reason to close, no advantage in clobbering it.
        LOG_INF("DocBroker [" << _docKey << "] Disconnected from Kit. Flagging to close");
        closeDocument("docdisconnected");
    }
    else
    {
        LOG_INF("DocBroker [" << _docKey << "] Disconnected from Kit while closing with reason ["
                              << _closeReason << ']');
    }
}

std::size_t DocumentBroker::broadcastMessage(const std::string& message) const
{
    ASSERT_CORRECT_THREAD();

    LOG_DBG("Broadcasting message [" << message << "] to all " << _sessions.size() << " sessions.");
    std::size_t count = 0;
    for (const auto& sessionIt : _sessions)
    {
        count += (!sessionIt.second->isCloseFrame() && sessionIt.second->sendTextFrame(message));
    }

    return count;
}

void DocumentBroker::broadcastMessageToOthers(const std::string& message, const std::shared_ptr<ClientSession>& _session) const
{
    ASSERT_CORRECT_THREAD();

    LOG_DBG("Broadcasting message [" << message << "] to all, except for " << _session->getId() << _sessions.size() <<  " sessions.");
    for (const auto& sessionIt : _sessions)
    {
        if (sessionIt.second == _session) continue;
        sessionIt.second->sendTextFrame(message);
    }
}

void DocumentBroker::processBatchUpdates()
{
#if !MOBILEAPP
    const auto timeSinceLastNotifyMs =
        std::chrono::duration_cast<std::chrono::milliseconds>(
            _lastActivityTime - _lastNotifiedActivityTime).count();

    if (timeSinceLastNotifyMs > 250)
    {
        _admin.updateLastActivityTime(_docKey);
        _lastNotifiedActivityTime = _lastActivityTime;
    }
#endif
}

void DocumentBroker::getIOStats(uint64_t &sent, uint64_t &recv)
{
    sent = 0;
    recv = 0;
    ASSERT_CORRECT_THREAD();
    for (const auto& sessionIt : _sessions)
    {
        uint64_t s = 0, r = 0;
        sessionIt.second->getIOStats(s, r);
        sent += s;
        recv += r;
    }
}

#if !MOBILEAPP

void StatelessBatchBroker::removeFile(const std::string &uriOrig)
{
    // Remove and report errors on failure.
    FileUtil::removeFile(uriOrig);
    const std::string dir = Poco::Path(uriOrig).parent().toString();
    if (FileUtil::isEmptyDirectory(dir))
        FileUtil::removeFile(dir);
}

static std::atomic<std::size_t> gConvertToBrokerInstanceCouter;

std::size_t ConvertToBroker::getInstanceCount()
{
    return gConvertToBrokerInstanceCouter;
}

ConvertToBroker::ConvertToBroker(const std::string& uri,
                                 const Poco::URI& uriPublic,
                                 const std::string& docKey,
                                 const std::string& format,
                                 const std::string& sOptions,
                                 const std::string& lang)
    : StatelessBatchBroker(uri, uriPublic, docKey)
    , _format(format)
    , _sOptions(sOptions)
    , _lang(lang)
{
    LOG_TRC("Created ConvertToBroker: uri: [" << uri << "], uriPublic: [" << uriPublic.toString()
                                              << "], docKey: [" << docKey << "], format: ["
                                              << format << "], options: [" << sOptions << "], lang: ["
                                              << lang << "].");

    static const std::chrono::seconds limit_convert_secs(
        COOLWSD::getConfigValue<int>("per_document.limit_convert_secs", 100));
    _limitLifeSeconds = limit_convert_secs;
    ++gConvertToBrokerInstanceCouter;
}

ConvertToBroker::~ConvertToBroker()
{}

bool ConvertToBroker::startConversion(SocketDisposition &disposition, const std::string &id)
{
    std::shared_ptr<ConvertToBroker> docBroker = std::static_pointer_cast<ConvertToBroker>(shared_from_this());

    // Create a session to load the document.
    const bool isReadOnly = true;
    // FIXME: associate this with moveSocket (?)
    std::shared_ptr<ProtocolHandlerInterface> nullPtr;
    RequestDetails requestDetails("convert-to");
    _clientSession = std::make_shared<ClientSession>(nullPtr, id, docBroker, getPublicUri(), isReadOnly, requestDetails);
    _clientSession->construct();

    docBroker->setupTransfer(disposition, [docBroker] (const std::shared_ptr<Socket> &moveSocket)
        {
            auto streamSocket = std::static_pointer_cast<StreamSocket>(moveSocket);
            docBroker->_clientSession->setSaveAsSocket(streamSocket);

            // First add and load the session.
            docBroker->addSession(docBroker->_clientSession);

            // Load the document manually and request saving in the target format.
            std::string encodedFrom;
            Poco::URI::encode(docBroker->getPublicUri().getPath(), "", encodedFrom);

            docBroker->sendStartMessage(docBroker->_clientSession, encodedFrom);

            // Save is done in the setLoaded
        });
    return true;
}

void ConvertToBroker::sendStartMessage(const std::shared_ptr<ClientSession>& clientSession,
                                       const std::string& encodedFrom)
{
    // add batch mode, no interactive dialogs
    std::string load = "load url=" + encodedFrom + " batch=true";
    if (!getLang().empty())
        load += " lang=" + getLang();
    std::vector<char> loadRequest(load.begin(), load.end());
    clientSession->handleMessage(loadRequest);
}

void ExtractLinkTargetsBroker::sendStartMessage(const std::shared_ptr<ClientSession>& clientSession,
                                                const std::string& encodedFrom)
{
    ConvertToBroker::sendStartMessage(clientSession, encodedFrom);

    const auto command = "extractlinktargets url=" + encodedFrom;
    forwardToChild(clientSession, command);
}

void GetThumbnailBroker::sendStartMessage(const std::shared_ptr<ClientSession>& clientSession,
                                          const std::string& encodedFrom)
{
    clientSession->setThumbnailSession(true);
    clientSession->setThumbnailTarget(_target);

    ConvertToBroker::sendStartMessage(clientSession, encodedFrom);
}

void ConvertToBroker::dispose()
{
    if (!_uriOrig.empty())
    {
        gConvertToBrokerInstanceCouter--;
        removeFile(_uriOrig);
        _uriOrig.clear();
    }
}

void ConvertToBroker::setLoaded()
{
    DocumentBroker::setLoaded();

    if (isGetThumbnail())
        return;

    // FIXME: Check for security violations.
    Poco::Path toPath(getPublicUri().getPath());
    toPath.setExtension(_format);

    // file:///user/docs/filename.ext normally, file:///<jail-root>/user/docs/filename.ext in the nocaps case
    const std::string toJailURL = "file://" +
        (COOLWSD::NoCapsForKit? getJailRoot(): "") +
        std::string(JAILED_DOCUMENT_ROOT) + toPath.getFileName();

    std::string encodedTo;
    Poco::URI::encode(toJailURL, "", encodedTo);

    // Convert it to the requested format.
    const std::string saveAsCmd = "saveas url=" + encodedTo + " format=" + _format + " options=" + _sOptions;

    // Send the save request ...
    std::vector<char> saveasRequest(saveAsCmd.begin(), saveAsCmd.end());

    _clientSession->handleMessage(saveasRequest);
}


static std::atomic<std::size_t> gRenderSearchResultBrokerInstanceCouter;

std::size_t RenderSearchResultBroker::getInstanceCount()
{
    return gRenderSearchResultBrokerInstanceCouter;
}

RenderSearchResultBroker::RenderSearchResultBroker(
                            std::string const& uri,
                            Poco::URI const& uriPublic,
                            std::string const& docKey,
                            std::shared_ptr<std::vector<char>> const& pSearchResultContent)
    : StatelessBatchBroker(uri, uriPublic, docKey)
    , _pSearchResultContent(pSearchResultContent)
{
    LOG_TRC("Created RenderSearchResultBroker: uri: [" << uri << "], uriPublic: [" << uriPublic.toString()
                                              << "], docKey: [" << docKey << "].");
    gConvertToBrokerInstanceCouter++;
}

RenderSearchResultBroker::~RenderSearchResultBroker()
{}

bool RenderSearchResultBroker::executeCommand(SocketDisposition& disposition, std::string const& id)
{
    std::shared_ptr<RenderSearchResultBroker> docBroker = std::static_pointer_cast<RenderSearchResultBroker>(shared_from_this());

    const bool isReadOnly = true;

    std::shared_ptr<ProtocolHandlerInterface> emptyProtocolHandler;
    RequestDetails requestDetails("render-search-result");
    _clientSession = std::make_shared<ClientSession>(emptyProtocolHandler, id, docBroker, getPublicUri(), isReadOnly, requestDetails);
    _clientSession->construct();

    docBroker->setupTransfer(disposition, [docBroker] (std::shared_ptr<Socket>const & moveSocket)
    {
        docBroker->setResponseSocket(std::static_pointer_cast<StreamSocket>(moveSocket));

        // First add and load the session.
        docBroker->addSession(docBroker->_clientSession);

        // Load the document manually.
        std::string encodedFrom;
        Poco::URI::encode(docBroker->getPublicUri().getPath(), "", encodedFrom);
        // add batch mode, no interactive dialogs
        const std::string _load = "load url=" + encodedFrom + " batch=true";
        std::vector<char> loadRequest(_load.begin(), _load.end());
        docBroker->_clientSession->handleMessage(loadRequest);
    });

    return true;
}

void RenderSearchResultBroker::setLoaded()
{
    DocumentBroker::setLoaded();

    // Send the rendersearchresult request ...
    const std::string renderSearchResultCmd = "rendersearchresult ";
    std::vector<char> renderSearchResultRequest(renderSearchResultCmd.begin(), renderSearchResultCmd.end());
    renderSearchResultRequest.resize(renderSearchResultCmd.size() + _pSearchResultContent->size());
    std::copy(_pSearchResultContent->begin(), _pSearchResultContent->end(), renderSearchResultRequest.begin() + renderSearchResultCmd.size());
    _clientSession->handleMessage(renderSearchResultRequest);
}

void RenderSearchResultBroker::dispose()
{
    if (!_uriOrig.empty())
    {
        gRenderSearchResultBrokerInstanceCouter--;
        removeFile(_uriOrig);
        _uriOrig.clear();
    }
}

bool RenderSearchResultBroker::handleInput(const std::shared_ptr<Message>& message)
{
    bool bResult = DocumentBroker::handleInput(message);

    if (bResult)
    {
        auto const& messageData = message->data();

        static std::string commandString = "rendersearchresult:\n";
        static std::vector<char> commandStringVector(commandString.begin(), commandString.end());

        if (messageData.size() >= commandStringVector.size())
        {
           bool bEquals = std::equal(commandStringVector.begin(), commandStringVector.end(),
                                      messageData.begin());
            if (bEquals)
            {
                _aResposeData.resize(messageData.size() - commandStringVector.size());
                std::copy(messageData.begin() + commandStringVector.size(), messageData.end(), _aResposeData.begin());

                std::string aDataString(_aResposeData.data(), _aResposeData.size());
                // really not ideal that the response works only with std::string
                http::Response httpResponse(http::StatusCode::OK);
                httpResponse.setBody(aDataString, "image/png");
                httpResponse.set("Connection", "close");
                _socket->sendAndShutdown(httpResponse);

                removeSession(_clientSession);
                stop("Finished RenderSearchResult handler.");
            }
        }
    }
    return bResult;
}

#endif

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

    uint64_t sent = 0, recv = 0;
    getIOStats(sent, recv);

    const auto now = std::chrono::steady_clock::now();

    os << std::boolalpha;
    os << " Broker: " << getDocKey() << " pid: " << getPid();
    if (_docState.isMarkedToDestroy())
        os << " *** Marked to destroy ***";
    else
        os << " has live sessions";
    if (isLoaded())
        os << "\n  loaded in: " << _loadDuration;
    else
        os << "\n  still loading... "
           << std::chrono::duration_cast<std::chrono::seconds>(now - _threadStart);
    os << "\n  child PID: " << (_childProcess ? _childProcess->getPid() : 0);
    os << "\n  sent: " << sent;
    os << "\n  recv: " << recv;
    os << "\n  jail id: " << _jailId;
    os << "\n  filename: " << COOLWSD::anonymizeUrl(_filename);
    os << "\n  public uri: " << _uriPublic.toString();
    os << "\n  jailed uri: " << COOLWSD::anonymizeUrl(_uriJailed);
    os << "\n  doc key: " << _docKey;
    os << "\n  doc id: " << _docId;
    os << "\n  num sessions: " << _sessions.size();
    os << "\n  thread start: " << Util::getTimeForLog(now, _threadStart);
    os << "\n  stop: " << _stop;
    os << "\n  closeReason: " << _closeReason;
    os << "\n  modified?: " << isModified();
    os << "\n  possibly-modified: " << isPossiblyModified();
    os << "\n  canSave: " << name(canSaveToDisk());
    os << "\n  canUpload: " << name(canUploadToStorage());
    os << "\n  isStorageOutdated: " << isStorageOutdated();
    os << "\n  needToUpload: " << name(needToUploadToStorage());
    os << "\n  lastActivityTime: " << Util::getTimeForLog(now, _lastActivityTime);
    os << "\n  haveActivityAfterSaveRequest: " << haveActivityAfterSaveRequest();
    os << "\n  lastModifyActivityTime: " << Util::getTimeForLog(now, _lastModifyActivityTime);
    os << "\n  haveModifyActivityAfterSaveRequest: " << haveModifyActivityAfterSaveRequest();
    os << "\n  isViewFileExtension: " << _isViewFileExtension;
#if !MOBILEAPP
    os << "\n  last quarantined version: "
       << (_quarantine ? _quarantine->lastQuarantinedFilePath() : "<unavailable>");
#endif

    if (_limitLifeSeconds > std::chrono::seconds::zero())
        os << "\n  life limit in seconds: " << _limitLifeSeconds.count();
    os << "\n  idle time: " << getIdleTimeSecs();
    os << "\n  cursor X: " << _cursorPosX << ", Y: " << _cursorPosY << ", W: " << _cursorWidth
       << ", H: " << _cursorHeight;

    os << "\n  DocumentState:";
    _docState.dumpState(os, "\n    ");

    if (_docState.activity() == DocumentState::Activity::Rename)
        os << "\n  (new name: " << _renameFilename << ')';

    os << "\n  SaveManager:";
    _saveManager.dumpState(os, "\n    ");

    os << "\n  StorageManager:";
    _storageManager.dumpState(os, "\n    ");

    os << "\n    Last StorageAttributes:";
    _lastStorageAttrs.dumpState(os, "\n      ");
    os << "\n    Current StorageAttributes:";
    _currentStorageAttrs.dumpState(os, "\n      ");
    os << "\n    Next StorageAttributes:";
    _nextStorageAttrs.dumpState(os, "\n      ");

    _lockCtx->dumpState(os);

    if (_tileCache)
        _tileCache->dumpState(os);

    _poll->dumpState(os);

#if !MOBILEAPP
    // Bit nasty - need a cleaner way to dump state.
    os << "\n  Sessions [" << _sessions.size() << "]:";
    for (const auto &it : _sessions)
    {
        auto proto = it.second->getProtocol();
        auto proxy = dynamic_cast<ProxyProtocolHandler *>(proto.get());
        if (proxy)
            proxy->dumpProxyState(os);
        else
            std::static_pointer_cast<MessageHandlerInterface>(it.second)->dumpState(os);
    }
#endif

    os << '\n';
}

bool DocumentBroker::isAsyncUploading() const
{
    if (!_storage)
        return false;

    StorageBase::AsyncUpload::State state = _storage->queryLocalFileToStorageAsyncUploadState().state();

    return state == StorageBase::AsyncUpload::State::Running;
}

void DocumentBroker::addEmbeddedMedia(const std::string& id, const std::string& json)
{
    LOG_TRC("Adding embeddedmedia with id [" << id << "]: " << json);

    // Store the original json with the internal, temporary, file URI.
    _embeddedMedia[id] = json;
}

void DocumentBroker::removeEmbeddedMedia(const std::string& json)
{
    Poco::JSON::Object::Ptr object;
    if (JsonUtil::parseJSON(json, object))
    {
        const std::string id = JsonUtil::getJSONValue<std::string>(object, "id");
        if (id.empty())
        {
            LOG_ERR("Invalid embeddedmedia json without id: " << json);
        }
        else
        {
            LOG_TRC("Removing embeddedmedia with id [" << id << "]: " << json);
            _embeddedMedia.erase(id);
        }
    }
}

void DocumentBroker::onUrpMessage(const char* data, size_t len)
{
    const auto session = getWriteableSession();
    if (session)
    {
        static const std::string header = "urp: ";
        size_t responseSize = header.size() + len;
        std::vector<char> response(responseSize);
        std::memcpy(response.data(), header.data(), header.size());
        std::memcpy(response.data() + header.size(), data, len);
        session->sendBinaryFrame(response.data(), responseSize);
    }
}

// not beautiful - but neither is editing mobile project files.
#if MOBILEAPP
#  include "Exceptions.cpp"
#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
