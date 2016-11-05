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
#include <fstream>

#include <Poco/Path.h>
#include <Poco/SHA1Engine.h>
#include <Poco/StringTokenizer.h>

#include "Admin.hpp"
#include "ClientSession.hpp"
#include "Exceptions.hpp"
#include "LOOLProtocol.hpp"
#include "LOOLWSD.hpp"
#include "Log.hpp"
#include "PrisonerSession.hpp"
#include "Storage.hpp"
#include "TileCache.hpp"
#include "Unit.hpp"

using namespace LOOLProtocol;

using Poco::StringTokenizer;

void ChildProcess::socketProcessor()
{
    IoUtil::SocketProcessor(_ws,
        [this](const std::vector<char>& payload)
        {
            if (UnitWSD::get().filterChildMessage(payload))
            {
                return true;
            }

            auto docBroker = this->_docBroker.lock();
            if (docBroker)
            {
                return docBroker->handleInput(payload);
            }

            Log::warn() << "Child " << this->_pid << " has no DocumentBroker to handle message: ["
                        << LOOLProtocol::getAbbreviatedMessage(payload) << "]." << Log::end;
            return true;
        },
        []() { },
        [this]() { return TerminationFlag || this->_stop; });

    Log::debug() << "Child [" << getPid() << "] WS terminated. Notifying DocBroker." << Log::end;


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

    return uriPublic;
}

std::string DocumentBroker::getDocKey(const Poco::URI& uri)
{
    // Keep the host as part of the key to close a potential security hole.
    std::string docKey;
    Poco::URI::encode(uri.getHost() + uri.getPath(), "", docKey);
    return docKey;
}

DocumentBroker::DocumentBroker() :
    _uriPublic(),
    _docKey(),
    _childRoot(),
    _cacheRoot(),
    _childProcess(),
    _lastSaveTime(std::chrono::steady_clock::now()),
    _markToDestroy(true),
    _lastEditableSession(true),
    _isLoaded(false),
    _isModified(false),
    _cursorPosX(0),
    _cursorPosY(0),
    _cursorWidth(0),
    _cursorHeight(0),
    _mutex(),
    _saveMutex(),
    _tileVersion(0),
    _debugRenderedTileCount(0)
{
    Log::info("Empty DocumentBroker (marked to destroy) created.");
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
    _mutex(),
    _saveMutex(),
    _tileVersion(0),
    _debugRenderedTileCount(0)
{
    assert(!_docKey.empty());
    assert(!_childRoot.empty());

    LOG_INF("DocumentBroker [" << _uriPublic.toString() <<
            "] created. DocKey: [" << _docKey << "]");
}

DocumentBroker::~DocumentBroker()
{
    Admin::instance().rmDoc(_docKey);

    LOG_INF("~DocumentBroker [" << _uriPublic.toString() <<
            "] destroyed with " << _sessions.size() <<
            " sessions left.");

    if (!_sessions.empty())
    {
        LOG_WRN("DocumentBroker still has unremoved sessions.");
    }
}

bool DocumentBroker::load(const std::string& sessionId, const std::string& jailId)
{
    {
        bool result;
        if (UnitWSD::get().filterLoad(sessionId, jailId, result))
            return result;
    }

    if (_markToDestroy)
    {
        // Tearing down.
        return false;
    }

    auto it = _sessions.find(sessionId);
    if (it == _sessions.end())
    {
        Log::error("Session with sessionId [" + sessionId + "] not found while loading");
        return false;
    }

    const Poco::URI& uriPublic = it->second->getPublicUri();
    Log::debug("Loading from URI: " + uriPublic.toString());

    _jailId = jailId;

    // The URL is the publicly visible one, not visible in the chroot jail.
    // We need to map it to a jailed path and copy the file there.

    // user/doc/jailId
    const auto jailPath = Poco::Path(JAILED_DOCUMENT_ROOT, jailId);
    std::string jailRoot = getJailRoot();

    Log::info("jailPath: " + jailPath.toString() + ", jailRoot: " + jailRoot);

    if (LOOLWSD::NoCapsForKit)
        jailRoot = jailPath.toString() + "/" + getJailRoot();

    if (_storage == nullptr)
    {
        // TODO: Maybe better to pass docKey to storage here instead of uriPublic here because
        // uriPublic would be different for each view of the document (due to
        // different query params like access token etc.)
        Log::debug("Creating new storage instance for URI [" + uriPublic.toString() + "].");
        _storage = StorageBase::create(uriPublic, jailRoot, jailPath.toString());
    }

    if (_storage)
    {
        // Call the storage specific file info functions
        std::string userid, username;
        std::chrono::duration<double> getInfoCallDuration;
        if (dynamic_cast<WopiStorage*>(_storage.get()) != nullptr)
        {
            const WopiStorage::WOPIFileInfo wopifileinfo = static_cast<WopiStorage*>(_storage.get())->getWOPIFileInfo(uriPublic);
            userid = wopifileinfo._userid;
            username = wopifileinfo._username;

            if (!wopifileinfo._userCanWrite)
            {
                Log::debug("Setting the session as readonly");
                it->second->setReadOnly();
            }

            if (!wopifileinfo._postMessageOrigin.empty())
            {
                it->second->sendTextFrame("wopi: postmessageorigin " + wopifileinfo._postMessageOrigin);
            }

            getInfoCallDuration = wopifileinfo._callDuration;
        }
        else if (dynamic_cast<LocalStorage*>(_storage.get()) != nullptr)
        {
            const LocalStorage::LocalFileInfo localfileinfo = static_cast<LocalStorage*>(_storage.get())->getLocalFileInfo(uriPublic);
            userid = localfileinfo._userid;
            username = localfileinfo._username;
        }

        Log::debug("Setting username [" + username + "] and userId [" + userid + "] for session [" + sessionId + "]");
        it->second->setUserId(userid);
        it->second->setUserName(username);

        // Get basic file information from the storage
        const auto fileInfo = _storage->getFileInfo();
        if (!fileInfo.isValid())
        {
            Log::error("Invalid fileinfo for URI [" + uriPublic.toString() + "].");
            return false;
        }

        // Lets load the document now
        const bool loaded = _storage->isLoaded();
        if (!loaded)
        {
            const auto localPath = _storage->loadStorageFileToLocal();
            _uriJailed = Poco::URI(Poco::URI("file://"), localPath);
            _filename = fileInfo._filename;

            // Use the local temp file's timestamp.
            _lastFileModifiedTime = Poco::File(_storage->getLocalRootPath()).getLastModified();
            _tileCache.reset(new TileCache(_uriPublic.toString(), _lastFileModifiedTime, _cacheRoot));
        }

        // Since document has been loaded, send the stats if its WOPI
        if (dynamic_cast<WopiStorage*>(_storage.get()) != nullptr)
        {
            // Get the time taken to load the file from storage
            auto callDuration = static_cast<WopiStorage*>(_storage.get())->getWopiLoadDuration();
            // Add the time taken to check file info
            callDuration += getInfoCallDuration;
            const std::string msg = "stats: wopiloadduration " + std::to_string(callDuration.count());
            Log::trace("Sending to Client [" + msg + "].");
            it->second->sendTextFrame(msg);
        }

        return true;
    }

    return false;
}

bool DocumentBroker::save(const std::string& sessionId, bool success, const std::string& result)
{
    std::unique_lock<std::mutex> lock(_saveMutex);

    const auto it = _sessions.find(sessionId);
    if (it == _sessions.end())
    {
        Log::error("Session with sessionId [" + sessionId + "] not found while saving");
        return false;
    }

    const Poco::URI& uriPublic = it->second->getPublicUri();
    const auto uri = uriPublic.toString();

    // If save requested, but core didn't save because document was unmodified
    // notify the waiting thread, if any.
    if (!success && result == "unmodified")
    {
        Log::debug("Save skipped as document was not modified");
        _saveCV.notify_all();
        return true;
    }

    // If we aren't destroying the last editable session just yet, and the file
    // timestamp hasn't changed, skip saving.
    const auto newFileModifiedTime = Poco::File(_storage->getLocalRootPath()).getLastModified();
    if (!_lastEditableSession && newFileModifiedTime == _lastFileModifiedTime)
    {
        // Nothing to do.
        Log::debug() << "Skipping unnecessary saving to URI [" << uri
                     << "]. File last modified "
                     << _lastFileModifiedTime.elapsed() / 1000000
                     << " seconds ago." << Log::end;
        return true;
    }

    Log::debug("Saving to URI [" + uri + "].");

    assert(_storage && _tileCache);
    if (_storage->saveLocalFileToStorage(uriPublic))
    {
        _isModified = false;
        _tileCache->setUnsavedChanges(false);
        _lastFileModifiedTime = newFileModifiedTime;
        _tileCache->saveLastModified(_lastFileModifiedTime);
        _lastSaveTime = std::chrono::steady_clock::now();
        Log::debug("Saved to URI [" + uri + "] and updated tile cache.");
        _saveCV.notify_all();
        return true;
    }

    Log::error("Failed to save to URI [" + uri + "].");
    return false;
}

bool DocumentBroker::autoSave(const bool force, const size_t waitTimeoutMs)
{
    std::unique_lock<std::mutex> lock(_mutex);
    if (_sessions.empty() || _storage == nullptr || !_isLoaded ||
        !_childProcess->isAlive() || (!_isModified && !force))
    {
        // Nothing to do.
        Log::trace("Nothing to autosave [" + _docKey + "].");
        return true;
    }

    // Remeber the last save time, since this is the predicate.
    const auto lastSaveTime = _lastSaveTime;
    Log::trace("Checking to autosave [" + _docKey + "].");

    bool sent = false;
    if (force)
    {
        Log::trace("Sending forced save command for [" + _docKey + "].");
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

        Log::trace("Most recent activity was " + std::to_string((int)inactivityTimeMs) + " ms ago.");
        const auto timeSinceLastSaveMs = getTimeSinceLastSaveMs();
        Log::trace("Time since last save is " + std::to_string((int)timeSinceLastSaveMs) + " ms.");

        // Either we've been idle long enough, or it's auto-save time.
        if (inactivityTimeMs >= IdleSaveDurationMs ||
            timeSinceLastSaveMs >= AutoSaveDurationMs)
        {
            Log::trace("Sending timed save command for [" + _docKey + "].");
            sent = sendUnoSave(true);
        }
    }

    if (sent && waitTimeoutMs > 0)
    {
        Log::trace("Waiting for save event for [" + _docKey + "].");
        if (_saveCV.wait_for(lock, std::chrono::milliseconds(waitTimeoutMs)) == std::cv_status::no_timeout)
        {
            Log::debug("Successfully persisted document [" + _docKey + "] or document was not modified");
            return true;
        }

        return (lastSaveTime != _lastSaveTime);
    }

    return sent;
}

bool DocumentBroker::sendUnoSave(const bool dontSaveIfUnmodified)
{
    Log::info("Autosave triggered for doc [" + _docKey + "].");
    Util::assertIsLocked(_mutex);

    // Save using session holding the edit-lock (or first if multview).
    for (auto& sessionIt : _sessions)
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
        Log::trace(".uno:Save arguments: " + saveArgs);
        const auto command = "uno .uno:Save " + saveArgs;
        forwardToChild(sessionIt.second->getId(), command);
        return true;
    }

    Log::error("Failed to auto-save doc [" + _docKey + "]: No valid sessions.");
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

    try
    {
        std::lock_guard<std::mutex> lock(_mutex);

        // Request a new session from the child kit.
        _childProcess->sendTextFrame(aMessage);

        auto ret = _sessions.emplace(id, session);
        if (!ret.second)
        {
            Log::warn("DocumentBroker: Trying to add already existing session.");
        }

        if (session->isReadOnly())
        {
            Log::debug("Adding a readonly session [" + id + "]");
        }

        // Below values are recalculated when startDestroy() is called (before destroying the
        // document). It is safe to reset their values to their defaults whenever a new session is added.
        _lastEditableSession = false;
        _markToDestroy = false;

        bool loaded;
        loaded = load(id, std::to_string(_childProcess->getPid()));
        if (!loaded)
        {
            const auto msg = "Failed to load document with URI [" + session->getPublicUri().toString() + "].";
            Log::error(msg);
            throw std::runtime_error(msg);
        }
    }
    catch (const StorageSpaceLowException&)
    {
        // We use the same message as is sent when some of lool's own locations are full,
        // even if in this case it might be a totally different location (file system, or
        // some other type of storage somewhere). This message is not sent to all clients,
        // though, just to all sessions of this document.
        alertAllUsersOfDocument("internal", "diskfull");
        throw;
    }

    // Tell the admin console about this new doc
    Admin::instance().addDoc(_docKey, getPid(), getFilename(), id);

    auto prisonerSession = std::make_shared<PrisonerSession>(id, shared_from_this());

    // Connect the prison session to the client.
    if (!connectPeers(prisonerSession))
    {
        Log::warn("Failed to connect " + session->getName() + " to its peer.");
    }

    return _sessions.size();
}

bool DocumentBroker::connectPeers(std::shared_ptr<PrisonerSession>& session)
{
    const auto id = session->getId();

    auto it = _sessions.find(id);
    if (it != _sessions.end())
    {
        it->second->setPeer(session);
        session->setPeer(it->second);
        return true;
    }

    return false;
}

size_t DocumentBroker::removeSession(const std::string& id)
{
    std::lock_guard<std::mutex> lock(_mutex);

    auto it = _sessions.find(id);
    if (it != _sessions.end())
    {
        _sessions.erase(it);

        // Let the child know the client has disconnected.
        const std::string msg("child-" + id + " disconnect");
        _childProcess->sendTextFrame(msg);
    }

    // Lets remove this session from the admin console too
    Admin::instance().rmDoc(_docKey, id);

    return _sessions.size();
}

void DocumentBroker::alertAllUsersOfDocument(const std::string& cmd, const std::string& kind)
{
    std::lock_guard<std::mutex> lock(_mutex);

    std::stringstream ss;
    ss << "error: cmd=" << cmd << " kind=" << kind;
    for (auto& it : _sessions)
    {
        it.second->sendTextFrame(ss.str());
    }
}

bool DocumentBroker::handleInput(const std::vector<char>& payload)
{
    const auto msg = LOOLProtocol::getAbbreviatedMessage(payload);
    Log::trace("DocumentBroker got child message: [" + msg + "].");

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
        Log::error("Unexpected message: [" + msg + "].");
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
    Log::trace() << "Tile request for " << tile.serialize() << Log::end;

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

    tileCache().subscribeToTileRendering(tile, session);

    // Forward to child to render.
    Log::debug() << "Sending render request for tile (" << tile.getPart() << ','
                 << tile.getTilePosX() << ',' << tile.getTilePosY() << ")." << Log::end;
    const std::string request = "tile " + tile.serialize();
    _childProcess->sendTextFrame(request);
    _debugRenderedTileCount++;
}

void DocumentBroker::handleTileCombinedRequest(TileCombined& tileCombined,
                                               const std::shared_ptr<ClientSession>& session)
{
    std::unique_lock<std::mutex> lock(_mutex);

    Log::trace() << "TileCombined request for " << tileCombined.serialize() << Log::end;

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
        Log::debug() << "Sending residual tilecombine: " << req << Log::end;
        _childProcess->sendTextFrame(req);
    }
}

void DocumentBroker::cancelTileRequests(const std::shared_ptr<ClientSession>& session)
{
    std::unique_lock<std::mutex> lock(_mutex);

    const auto canceltiles = tileCache().cancelTiles(session);
    if (!canceltiles.empty())
    {
        Log::debug() << "Forwarding canceltiles request: " << canceltiles << Log::end;
        _childProcess->sendTextFrame(canceltiles);
    }
}

void DocumentBroker::handleTileResponse(const std::vector<char>& payload)
{
    const std::string firstLine = getFirstLine(payload);
    Log::debug("Handling tile combined: " + firstLine);

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
            Log::debug() << "Render request declined for " << firstLine << Log::end;
            // They will get re-issued if we don't forget them.
        }
    }
    catch (const std::exception& exc)
    {
        Log::error("Failed to process tile response [" + firstLine + "]: " + exc.what() + ".");
    }
}

void DocumentBroker::handleTileCombinedResponse(const std::vector<char>& payload)
{
    const std::string firstLine = getFirstLine(payload);
    Log::debug("Handling tile combined: " + firstLine);

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
            Log::error() << "Render request declined for " << firstLine << Log::end;
            // They will get re-issued if we don't forget them.
        }
    }
    catch (const std::exception& exc)
    {
        Log::error("Failed to process tile response [" + firstLine + "]: " + exc.what() + ".");
    }
}

bool DocumentBroker::startDestroy(const std::string& id)
{
    std::unique_lock<std::mutex> lock(_mutex);

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
    Log::trace() << "Forwarding payload to child [" << viewId << "]: " << message << Log::end;

    const auto it = _sessions.find(viewId);
    if (it != _sessions.end())
    {
        const auto msg = "child-" + viewId + ' ' + message;
        _childProcess->sendTextFrame(msg);
        return true;
    }
    else
    {
        Log::warn() << "Client session [" << viewId << "] not found to forward message: " << message << Log::end;
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
        LOG_ERR("Failed to parse prefix of forward-to-client message: " << prefix);
    }

    return false;
}

void DocumentBroker::childSocketTerminated()
{
    std::lock_guard<std::mutex> lock(_mutex);

    if (!_childProcess->isAlive())
    {
        Log::error("Child for doc [" + _docKey + "] terminated prematurely.");
    }

    // We could restore the kit if this was unexpected.
    // For now, close the connections to cleanup.
    for (auto& pair : _sessions)
    {
        pair.second->shutdown(Poco::Net::WebSocket::WS_ENDPOINT_GOING_AWAY);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
