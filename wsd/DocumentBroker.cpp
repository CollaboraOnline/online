/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "DocumentBroker.hpp"
#include "config.h"

#include <cassert>
#include <ctime>
#include <fstream>
#include <sstream>

#include <Poco/JSON/Object.h>
#include <Poco/Path.h>
#include <Poco/SHA1Engine.h>
#include <Poco/StringTokenizer.h>

#include "Admin.hpp"
#include "ClientSession.hpp"
#include "Exceptions.hpp"
#include "Protocol.hpp"
#include "LOOLWSD.hpp"
#include "Log.hpp"
#include "PrisonerSession.hpp"
#include "Storage.hpp"
#include "TileCache.hpp"
#include "SenderQueue.hpp"
#include "Unit.hpp"

using namespace LOOLProtocol;

using Poco::JSON::Object;
using Poco::StringTokenizer;

void ChildProcess::socketProcessor()
{
    const auto name = "docbrk_ws_" + std::to_string(_pid);
    Util::setThreadName(name);

    IoUtil::SocketProcessor(_ws, name,
        [this](const std::vector<char>& payload)
        {
            const auto message = LOOLProtocol::getAbbreviatedMessage(payload);
            LOG_TRC("Recv from child [" << message << "].");

            if (UnitWSD::get().filterChildMessage(payload))
            {
                return true;
            }

            auto docBroker = this->_docBroker.lock();
            if (docBroker)
            {
                // We should never destroy the broker, since
                // it owns us and will wait on this thread.
                assert(docBroker.use_count() > 1);
                return docBroker->handleInput(payload);
            }

            LOG_WRN("Child " << this->_pid <<
                    " has no DocumentBroker to handle message: [" << message << "].");
            return true;
        },
        []() { },
        [this]() { return TerminationFlag || this->_stop; });

    LOG_DBG("Child [" << getPid() << "] WS terminated. Notifying DocBroker.");

    // Notify the broker that we're done.
    auto docBroker = _docBroker.lock();
    if (docBroker && !_stop)
    {
        // No need to notify if asked to stop.
        docBroker->childSocketTerminated();
    }
}

namespace
{

/// Returns the cache path for a given document URI.
std::string getCachePath(const std::string& uri)
{
    Poco::SHA1Engine digestEngine;

    digestEngine.update(uri.c_str(), uri.size());

    return (LOOLWSD::Cache + '/' +
            Poco::DigestEngine::digestToHex(digestEngine.digest()).insert(3, "/").insert(2, "/").insert(1, "/"));
}
}

Poco::URI DocumentBroker::sanitizeURI(const std::string& uri)
{
    // The URI of the document should be url-encoded.
    std::string decodedUri;
    Poco::URI::decode(uri, decodedUri);
    auto uriPublic = Poco::URI(decodedUri);

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

DocumentBroker::DocumentBroker(const Poco::URI& uriPublic,
                               const std::string& docKey,
                               const std::string& childRoot,
                               const std::shared_ptr<ChildProcess>& childProcess) :
    _uriPublic(uriPublic),
    _docKey(docKey),
    _childRoot(childRoot),
    _cacheRoot(getCachePath(uriPublic.toString())),
    _childProcess(childProcess),
    _lastSaveTime(std::chrono::steady_clock::now()),
    _markToDestroy(false),
    _lastEditableSession(false),
    _isLoaded(false),
    _isModified(false),
    _cursorPosX(0),
    _cursorPosY(0),
    _cursorWidth(0),
    _cursorHeight(0),
    _tileVersion(0),
    _debugRenderedTileCount(0)
{
    assert(!_docKey.empty());
    assert(!_childRoot.empty());

    LOG_INF("DocumentBroker [" << _uriPublic.toString() << "] created. DocKey: [" << _docKey << "]");
}

DocumentBroker::~DocumentBroker()
{
    Admin::instance().rmDoc(_docKey);

    LOG_INF("~DocumentBroker [" << _uriPublic.toString() <<
            "] destroyed with " << _sessions.size() << " sessions left.");

    if (!_sessions.empty())
    {
        LOG_WRN("DocumentBroker still has unremoved sessions.");
    }

    // Need to first make sure the child exited, socket closed,
    // and thread finished before we are destroyed.
    _childProcess.reset();
}

bool DocumentBroker::load(std::shared_ptr<ClientSession>& session, const std::string& jailId)
{
    Util::assertIsLocked(_mutex);

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
    const auto jailPath = Poco::Path(JAILED_DOCUMENT_ROOT, jailId);
    std::string jailRoot = getJailRoot();
    if (LOOLWSD::NoCapsForKit)
    {
        jailRoot = jailPath.toString() + "/" + getJailRoot();
    }

    LOG_INF("jailPath: " << jailPath.toString() << ", jailRoot: " << jailRoot);

    if (_storage == nullptr)
    {
        // Pass the public URI to storage as it needs to load using the token
        // and other storage-specific data provided in the URI.
        const Poco::URI& uriPublic = session->getPublicUri();
        LOG_DBG("Loading, and creating new storage instance for URI [" << uriPublic.toString() << "].");

        _storage = StorageBase::create(uriPublic, jailRoot, jailPath.toString());
        if (_storage == nullptr)
        {
            // We should get an exception, not null.
            LOG_ERR("Failed to create Storage instance for [" << _docKey << "] in " << jailPath.toString());
            return false;
        }
    }

    assert(_storage != nullptr);

    // Call the storage specific fileinfo functions
    std::string userid, username;
    std::chrono::duration<double> getInfoCallDuration(0);
    if (dynamic_cast<WopiStorage*>(_storage.get()) != nullptr)
    {
        std::unique_ptr<WopiStorage::WOPIFileInfo> wopifileinfo = static_cast<WopiStorage*>(_storage.get())->getWOPIFileInfo(session->getAccessToken());
        userid = wopifileinfo->_userid;
        username = wopifileinfo->_username;

        if (!wopifileinfo->_userCanWrite)
        {
            LOG_DBG("Setting the session as readonly");
            session->setReadOnly();
        }

        // Construct a JSON containing relevant WOPI host properties
        Object::Ptr wopiInfo = new Object();
        if (!wopifileinfo->_postMessageOrigin.empty())
        {
            wopiInfo->set("PostMessageOrigin", wopifileinfo->_postMessageOrigin);
        }

        // If print, export are disabled, order client to hide these options in the UI
        if (wopifileinfo->_disablePrint)
            wopifileinfo->_hidePrintOption = true;
        if (wopifileinfo->_disableExport)
            wopifileinfo->_hideExportOption = true;

        wopiInfo->set("HidePrintOption", wopifileinfo->_hidePrintOption);
        wopiInfo->set("HideSaveOption", wopifileinfo->_hideSaveOption);
        wopiInfo->set("HideExportOption", wopifileinfo->_hideExportOption);
        wopiInfo->set("DisablePrint", wopifileinfo->_disablePrint);
        wopiInfo->set("DisableExport", wopifileinfo->_disableExport);
        wopiInfo->set("DisableCopy", wopifileinfo->_disableCopy);

        std::ostringstream ossWopiInfo;
        wopiInfo->stringify(ossWopiInfo);
        session->sendTextFrame("wopi: " + ossWopiInfo.str());

        // Mark the session as 'Document owner' if WOPI hosts supports it
        if (userid == _storage->getFileInfo()._ownerId)
        {
            LOG_DBG("Session [" + sessionId + "] is the document owner");
            session->setDocumentOwner(true);
        }

        getInfoCallDuration = wopifileinfo->_callDuration;

        // Pass the ownership to client session
        session->setWopiFileInfo(wopifileinfo);
    }
    else if (dynamic_cast<LocalStorage*>(_storage.get()) != nullptr)
    {
        std::unique_ptr<LocalStorage::LocalFileInfo> localfileinfo = static_cast<LocalStorage*>(_storage.get())->getLocalFileInfo();
        userid = localfileinfo->_userid;
        username = localfileinfo->_username;
    }

    LOG_DBG("Setting username [" << username << "] and userId [" << userid << "] for session [" << sessionId << "]");
    session->setUserId(userid);
    session->setUserName(username);

    // Get basic file information from the storage
    const auto fileInfo = _storage->getFileInfo();
    if (!fileInfo.isValid())
    {
        LOG_ERR("Invalid fileinfo for URI [" << session->getPublicUri().toString() << "].");
        return false;
    }

    // Lets load the document now
    const bool loaded = _storage->isLoaded();
    if (!loaded)
    {
        const auto localPath = _storage->loadStorageFileToLocal(session->getAccessToken());
        _uriJailed = Poco::URI(Poco::URI("file://"), localPath);
        _filename = fileInfo._filename;

        // Use the local temp file's timestamp.
        _lastFileModifiedTime = Poco::File(_storage->getRootFilePath()).getLastModified();
        _tileCache.reset(new TileCache(_storage->getUri(), _lastFileModifiedTime, _cacheRoot));
    }

    // Since document has been loaded, send the stats if its WOPI
    if (dynamic_cast<WopiStorage*>(_storage.get()) != nullptr)
    {
        // Get the time taken to load the file from storage
        auto callDuration = static_cast<WopiStorage*>(_storage.get())->getWopiLoadDuration();
        // Add the time taken to check file info
        callDuration += getInfoCallDuration;
        const std::string msg = "stats: wopiloadduration " + std::to_string(callDuration.count());
        LOG_TRC("Sending to Client [" << msg << "].");
        session->sendTextFrame(msg);
    }

    return true;
}

bool DocumentBroker::save(const std::string& sessionId, bool success, const std::string& result)
{
    std::unique_lock<std::mutex> lock(_saveMutex);

    const auto it = _sessions.find(sessionId);
    if (it == _sessions.end())
    {
        LOG_ERR("Session with sessionId [" << sessionId << "] not found while saving");
        return false;
    }

    const std::string accessToken = it->second->getAccessToken();
    const auto uri = it->second->getPublicUri().toString();

    // If save requested, but core didn't save because document was unmodified
    // notify the waiting thread, if any.
    LOG_TRC("Saving to storage docKey [" << _docKey << "] for session [" << sessionId <<
            "]. Success: " << success << ", result: " << result);
    if (!success && result == "unmodified")
    {
        LOG_DBG("Save skipped as document was not modified");
        _saveCV.notify_all();
        return true;
    }

    // If we aren't destroying the last editable session just yet, and the file
    // timestamp hasn't changed, skip saving.
    const auto newFileModifiedTime = Poco::File(_storage->getRootFilePath()).getLastModified();
    if (!_lastEditableSession && newFileModifiedTime == _lastFileModifiedTime)
    {
        // Nothing to do.
        LOG_DBG("Skipping unnecessary saving to URI [" << uri << "]. File last modified " <<
                _lastFileModifiedTime.elapsed() / 1000000 << " seconds ago.");
        return true;
    }

    LOG_DBG("Saving to URI [" << uri << "].");

    assert(_storage && _tileCache);
    StorageBase::SaveResult storageSaveResult = _storage->saveLocalFileToStorage(accessToken);
    if (storageSaveResult == StorageBase::SaveResult::OK)
    {
        _isModified = false;
        _tileCache->setUnsavedChanges(false);
        _lastFileModifiedTime = newFileModifiedTime;
        _tileCache->saveLastModified(_lastFileModifiedTime);
        _lastSaveTime = std::chrono::steady_clock::now();
        LOG_DBG("Saved to URI [" << uri << "] and updated tile cache.");
        _saveCV.notify_all();
        return true;
    }
    else if (storageSaveResult == StorageBase::SaveResult::DISKFULL)
    {
        // Make everyone readonly and tell everyone that storage is low on diskspace
        for (auto& sessionIt : _sessions)
        {
            sessionIt.second->setReadOnly();
            sessionIt.second->sendTextFrame("error: cmd=storage kind=savediskfull");
        }
    }
    else if (storageSaveResult == StorageBase::SaveResult::FAILED)
    {
        it->second->sendTextFrame("error: cmd=storage kind=savefailed");
    }

    LOG_ERR("Failed to save to URI [" << uri << "].");
    return false;
}

bool DocumentBroker::autoSave(const bool force, const size_t waitTimeoutMs, std::unique_lock<std::mutex>& lock)
{
    Util::assertIsLocked(lock);

    if (_sessions.empty() || _storage == nullptr || !_isLoaded ||
        !_childProcess->isAlive() || (!_isModified && !force))
    {
        // Nothing to do.
        LOG_TRC("Nothing to autosave [" << _docKey << "].");
        return true;
    }

    // Remeber the last save time, since this is the predicate.
    const auto lastSaveTime = _lastSaveTime;
    LOG_TRC("Checking to autosave [" << _docKey << "].");

    bool sent = false;
    if (force)
    {
        LOG_TRC("Sending forced save command for [" << _docKey << "].");
        sent = sendUnoSave(true);
    }
    else if (_isModified)
    {
        // Find the most recent activity.
        double inactivityTimeMs = std::numeric_limits<double>::max();
        for (auto& sessionIt : _sessions)
        {
            inactivityTimeMs = std::min(sessionIt.second->getInactivityMS(), inactivityTimeMs);
        }

        LOG_TRC("Most recent activity was " << inactivityTimeMs << " ms ago.");
        const auto timeSinceLastSaveMs = getTimeSinceLastSaveMs();
        LOG_TRC("Time since last save is " << timeSinceLastSaveMs << " ms.");

        // Either we've been idle long enough, or it's auto-save time.
        if (inactivityTimeMs >= IdleSaveDurationMs ||
            timeSinceLastSaveMs >= AutoSaveDurationMs)
        {
            LOG_TRC("Sending timed save command for [" << _docKey << "].");
            sent = sendUnoSave(true);
        }
    }

    if (sent && waitTimeoutMs > 0)
    {
        LOG_TRC("Waiting for save event for [" << _docKey << "].");
        if (_saveCV.wait_for(lock, std::chrono::milliseconds(waitTimeoutMs)) == std::cv_status::no_timeout)
        {
            LOG_DBG("Successfully persisted document [" << _docKey << "] or document was not modified");
            return true;
        }

        return (lastSaveTime != _lastSaveTime);
    }

    return sent;
}

bool DocumentBroker::sendUnoSave(const bool dontSaveIfUnmodified)
{
    LOG_INF("Autosave triggered for doc [" << _docKey << "].");
    Util::assertIsLocked(_mutex);

    std::shared_ptr<ClientSession> savingSession;
    for (auto& sessionIt : _sessions)
    {
        // Save the document using first session available ...
        if (!savingSession)
        {
            savingSession = sessionIt.second;
        }

        // or if any of the sessions is document owner, use that.
        if (sessionIt.second->isDocumentOwner())
        {
            savingSession = sessionIt.second;
            break;
        }
    }

    if (savingSession)
    {
        // Invalidate the timestamp to force persisting.
        _lastFileModifiedTime.fromEpochTime(0);

        // We do not want save to terminate editing mode if we are in edit mode now

        std::ostringstream oss;
        // arguments init
        oss << "{";

        // Mention DontTerminateEdit always
        oss << "\"DontTerminateEdit\":"
            << "{"
            << "\"type\":\"boolean\","
            << "\"value\":true"
            << "}";

        // Mention DontSaveIfUnmodified
        if (dontSaveIfUnmodified)
        {
            oss << ","
                << "\"DontSaveIfUnmodified\":"
                << "{"
                << "\"type\":\"boolean\","
                << "\"value\":true"
                << "}";
        }

        // arguments end
        oss << "}";

        const auto saveArgs = oss.str();
        LOG_TRC(".uno:Save arguments: " << saveArgs);
        const auto command = "uno .uno:Save " + saveArgs;
        forwardToChild(savingSession->getId(), command);
        return true;
    }

    LOG_ERR("Failed to auto-save doc [" << _docKey << "]: No valid sessions.");
    return false;
}

std::string DocumentBroker::getJailRoot() const
{
    assert(!_jailId.empty());
    return Poco::Path(_childRoot, _jailId).toString();
}

size_t DocumentBroker::addSession(std::shared_ptr<ClientSession>& session)
{
    const auto id = session->getId();
    const std::string aMessage = "session " + id + " " + _docKey;

    std::unique_lock<std::mutex> lock(_mutex);

    try
    {
        // First load the document, since this can fail.
        if (!load(session, std::to_string(_childProcess->getPid())))
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

    // Below values are recalculated when startDestroy() is called (before destroying the
    // document). It is safe to reset their values to their defaults whenever a new session is added.
    _lastEditableSession = false;
    _markToDestroy = false;

    if (session->isReadOnly())
    {
        LOG_DBG("Adding a readonly session [" << id << "]");
    }

    if (!_sessions.emplace(id, session).second)
    {
        LOG_WRN("DocumentBroker: Trying to add already existing session.");
    }

    const auto count = _sessions.size();

    lock.unlock();

    // Request a new session from the child kit.
    _childProcess->sendTextFrame(aMessage);

    // Tell the admin console about this new doc
    Admin::instance().addDoc(_docKey, getPid(), getFilename(), id);

    // Now we are ready to bridge between the kit and client.
    session->bridgePrisonerSession();

    return count;
}

size_t DocumentBroker::removeSession(const std::string& id)
{
    Util::assertIsLocked(_mutex);

    try
    {
        Admin::instance().rmDoc(_docKey, id);

        auto it = _sessions.find(id);
        if (it != _sessions.end())
        {
            _sessions.erase(it);

            // Let the child know the client has disconnected.
            const std::string msg("child-" + id + " disconnect");
            _childProcess->sendTextFrame(msg);
        }
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Error while removing session [" << id << "]: " << ex.what());
    }

    return _sessions.size();
}

void DocumentBroker::alertAllUsers(const std::string& msg)
{
    Util::assertIsLocked(_mutex);

    auto payload = std::make_shared<MessagePayload>(msg);

    LOG_DBG("Alerting all users of [" << _docKey << "]: " << msg);
    for (auto& it : _sessions)
    {
        it.second->enqueueSendMessage(payload);
    }
}

bool DocumentBroker::handleInput(const std::vector<char>& payload)
{
    const auto msg = LOOLProtocol::getAbbreviatedMessage(payload);
    LOG_TRC("DocumentBroker got child message: [" << msg << "].");

    LOOLWSD::dumpOutgoingTrace(getJailId(), "0", msg);

    const auto command = LOOLProtocol::getFirstToken(msg);
    if (command == "tile:")
    {
        handleTileResponse(payload);
    }
    else if (command == "tilecombine:")
    {
        handleTileCombinedResponse(payload);
    }
    else if (LOOLProtocol::getFirstToken(command, '-') == "client")
    {
        forwardToClient(command, payload);
    }
    else if (command == "errortoall:")
    {
        StringTokenizer tokens(msg, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        assert(tokens.count() == 3);
        std::string cmd, kind;
        LOOLProtocol::getTokenString(tokens, "cmd", cmd);
        assert(cmd != "");
        LOOLProtocol::getTokenString(tokens, "kind", kind);
        assert(kind != "");
        Util::alertAllUsers(cmd, kind);
    }
    else
    {
        LOG_ERR("Unexpected message: [" << msg << "].");
        return false;
    }

    return true;
}

void DocumentBroker::invalidateTiles(const std::string& tiles)
{
    std::unique_lock<std::mutex> lock(_mutex);

    // Remove from cache.
    _tileCache->invalidateTiles(tiles);
}

void DocumentBroker::handleTileRequest(TileDesc& tile,
                                       const std::shared_ptr<ClientSession>& session)
{
    std::unique_lock<std::mutex> lock(_mutex);

    tile.setVersion(++_tileVersion);
    const auto tileMsg = tile.serialize();
    LOG_TRC("Tile request for " << tile.serialize());

    std::unique_ptr<std::fstream> cachedTile = _tileCache->lookupTile(tile);
    if (cachedTile)
    {
#if ENABLE_DEBUG
        const std::string response = tile.serialize("tile:") + " renderid=cached\n";
#else
        const std::string response = tile.serialize("tile:") + '\n';
#endif

        std::vector<char> output;
        output.reserve(static_cast<size_t>(4) * tile.getWidth() * tile.getHeight());
        output.resize(response.size());
        std::memcpy(output.data(), response.data(), response.size());

        assert(cachedTile->is_open());
        cachedTile->seekg(0, std::ios_base::end);
        const auto pos = output.size();
        std::streamsize size = cachedTile->tellg();
        output.resize(pos + size);
        cachedTile->seekg(0, std::ios_base::beg);
        cachedTile->read(output.data() + pos, size);
        cachedTile->close();

        session->sendBinaryFrame(output.data(), output.size());
        return;
    }

    if (tile.getBroadcast())
    {
        for (auto& it: _sessions)
        {
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
    const std::string request = "tile " + tile.serialize();
    _childProcess->sendTextFrame(request);
    _debugRenderedTileCount++;
}

void DocumentBroker::handleTileCombinedRequest(TileCombined& tileCombined,
                                               const std::shared_ptr<ClientSession>& session)
{
    std::unique_lock<std::mutex> lock(_mutex);

    LOG_TRC("TileCombined request for " << tileCombined.serialize());

    // Satisfy as many tiles from the cache.
    std::vector<TileDesc> tiles;
    for (auto& tile : tileCombined.getTiles())
    {
        std::unique_ptr<std::fstream> cachedTile = _tileCache->lookupTile(tile);
        if (cachedTile)
        {
            //TODO: Combine the response to reduce latency.
#if ENABLE_DEBUG
            const std::string response = tile.serialize("tile:") + " renderid=cached\n";
#else
            const std::string response = tile.serialize("tile:") + "\n";
#endif

            std::vector<char> output;
            output.reserve(static_cast<size_t>(4) * tile.getWidth() * tile.getHeight());
            output.resize(response.size());
            std::memcpy(output.data(), response.data(), response.size());

            assert(cachedTile->is_open());
            cachedTile->seekg(0, std::ios_base::end);
            const auto pos = output.size();
            std::streamsize size = cachedTile->tellg();
            output.resize(pos + size);
            cachedTile->seekg(0, std::ios_base::beg);
            cachedTile->read(output.data() + pos, size);
            cachedTile->close();

            session->sendBinaryFrame(output.data(), output.size());
        }
        else
        {
            // Not cached, needs rendering.
            tile.setVersion(++_tileVersion);
            tileCache().subscribeToTileRendering(tile, session);
            tiles.push_back(tile);
            _debugRenderedTileCount++;
        }
    }

    if (!tiles.empty())
    {
        auto newTileCombined = TileCombined::create(tiles);
        newTileCombined.setVersion(++_tileVersion);

        // Forward to child to render.
        const auto req = newTileCombined.serialize("tilecombine");
        LOG_DBG("Sending residual tilecombine: " << req);
        _childProcess->sendTextFrame(req);
    }
}

void DocumentBroker::cancelTileRequests(const std::shared_ptr<ClientSession>& session)
{
    std::unique_lock<std::mutex> lock(_mutex);

    const auto canceltiles = tileCache().cancelTiles(session);
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
        const auto length = payload.size();
        if (firstLine.size() < static_cast<std::string::size_type>(length) - 1)
        {
            const auto tile = TileDesc::parse(firstLine);
            const auto buffer = payload.data();
            const auto offset = firstLine.size() + 1;
            tileCache().saveTileAndNotify(tile, buffer + offset, length - offset);
        }
        else
        {
            LOG_DBG("Render request declined for " << firstLine);
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
        const auto length = payload.size();
        if (firstLine.size() < static_cast<std::string::size_type>(length) - 1)
        {
            const auto tileCombined = TileCombined::parse(firstLine);
            const auto buffer = payload.data();
            auto offset = firstLine.size() + 1;
            for (const auto& tile : tileCombined.getTiles())
            {
                tileCache().saveTileAndNotify(tile, buffer + offset, tile.getImgSize());
                offset += tile.getImgSize();
            }
        }
        else
        {
            LOG_ERR("Render request declined for " << firstLine);
            // They will get re-issued if we don't forget them.
        }
    }
    catch (const std::exception& exc)
    {
        LOG_ERR("Failed to process tile response [" << firstLine << "]: " << exc.what() << ".");
    }
}

bool DocumentBroker::startDestroy(const std::string& id)
{
    Util::assertIsLocked(_mutex);

    const auto currentSession = _sessions.find(id);
    assert(currentSession != _sessions.end());

    // Check if the session being destroyed is the last non-readonly session or not.
    _lastEditableSession = !currentSession->second->isReadOnly();
    if (_lastEditableSession && !_sessions.empty())
    {
        for (const auto& it : _sessions)
        {
            if (it.second->getId() != id &&
                !it.second->isReadOnly())
            {
                // Found another editable.
                _lastEditableSession = false;
                break;
            }
        }
    }

    // Last view going away, can destroy.
    _markToDestroy = (_sessions.size() <= 1);
    return _lastEditableSession;
}

void DocumentBroker::setModified(const bool value)
{
    _tileCache->setUnsavedChanges(value);
    _isModified = value;
}

bool DocumentBroker::forwardToChild(const std::string& viewId, const std::string& message)
{
    LOG_TRC("Forwarding payload to child [" << viewId << "]: " << message);

    const auto it = _sessions.find(viewId);
    if (it != _sessions.end())
    {
        const auto msg = "child-" + viewId + ' ' + message;
        _childProcess->sendTextFrame(msg);
        return true;
    }
    else
    {
        LOG_WRN("Client session [" << viewId << "] not found to forward message: " << message);
    }

    return false;
}

bool DocumentBroker::forwardToClient(const std::string& prefix, const std::vector<char>& payload)
{
    assert(payload.size() > prefix.size());

    // Remove the prefix and trim.
    size_t index = prefix.size();
    for ( ; index < payload.size(); ++index)
    {
        if (payload[index] != ' ')
        {
            break;
        }
    }

    auto data = payload.data() + index;
    auto size = payload.size() - index;
    const auto message = getAbbreviatedMessage(data, size);
    LOG_TRC("Forwarding payload to " << prefix << ' ' << message);

    std::string name;
    std::string sid;
    if (LOOLProtocol::parseNameValuePair(prefix, name, sid, '-') && name == "client")
    {
        const auto it = _sessions.find(sid);
        if (it != _sessions.end())
        {
            const auto peer = it->second->getPeer();
            if (peer)
            {
                return peer->handleInput(data, size);
            }
            else
            {
                LOG_WRN("Client session [" << sid << "] has no peer to forward message: " << message);
            }
        }
        else
        {
            LOG_WRN("Client session [" << sid << "] not found to forward message: " << message);
        }
    }
    else
    {
        LOG_ERR("Unexpected prefix of forward-to-client message: " << prefix);
    }

    return false;
}

void DocumentBroker::childSocketTerminated()
{
    std::lock_guard<std::mutex> lock(_mutex);

    if (!_childProcess->isAlive())
    {
        LOG_ERR("Child for doc [" << _docKey << "] terminated prematurely.");
    }

    // We could restore the kit if this was unexpected.
    // For now, close the connections to cleanup.
    for (auto& pair : _sessions)
    {
        try
        {
            pair.second->shutdown(Poco::Net::WebSocket::WS_ENDPOINT_GOING_AWAY);
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Error while terminating client connection [" << pair.first << "]: " << ex.what());
        }
    }
}

void DocumentBroker::terminateChild(std::unique_lock<std::mutex>& lock, const std::string& closeReason)
{
    Util::assertIsLocked(_mutex);
    Util::assertIsLocked(lock);

    LOG_INF("Terminating child [" << getPid() << "] of doc [" << _docKey << "].");

    // Close all running sessions
    for (auto& pair : _sessions)
    {
        try
        {
            // See protocol.txt for this application-level close frame.
            pair.second->sendTextFrame("close: " + closeReason);
            pair.second->shutdown(Poco::Net::WebSocket::WS_ENDPOINT_GOING_AWAY, closeReason);
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Error while terminating client connection [" << pair.first << "]: " << ex.what());
        }
    }

    // First flag to stop as it might be waiting on our lock
    // to process some incoming message.
    _childProcess->stop();

    // Release the lock and wait for the thread to finish.
    lock.unlock();

    _childProcess->close(false);
}

void DocumentBroker::closeDocument(const std::string& reason)
{
    auto lock = getLock();

    terminateChild(lock, reason);
}

void DocumentBroker::updateLastActivityTime()
{
    _lastActivity = std::time(nullptr);
    Admin::instance().updateLastActivityTime(_docKey);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
