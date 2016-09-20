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
        [this]() { return !!this->_stop; });
}

namespace
{

/// Returns the cache path for a given document URI.
std::string getCachePath(const std::string& uri)
{
    Poco::SHA1Engine digestEngine;

    digestEngine.update(uri.c_str(), uri.size());

    return (LOOLWSD::Cache + "/" +
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
    _cursorPosX(0),
    _cursorPosY(0),
    _cursorWidth(0),
    _cursorHeight(0),
    _isLoaded(false),
    _isModified(false),
    _isEditLockHeld(false),
    _tileVersion(0)
{
    Log::info("Empty DocumentBroker (marked to destroy) created.");
}

DocumentBroker::DocumentBroker(const Poco::URI& uriPublic,
                               const std::string& docKey,
                               const std::string& childRoot,
                               std::shared_ptr<ChildProcess> childProcess) :
    _uriPublic(uriPublic),
    _docKey(docKey),
    _childRoot(childRoot),
    _cacheRoot(getCachePath(uriPublic.toString())),
    _childProcess(std::move(childProcess)),
    _lastSaveTime(std::chrono::steady_clock::now()),
    _markToDestroy(false),
    _lastEditableSession(false),
    _cursorPosX(0),
    _cursorPosY(0),
    _cursorWidth(0),
    _cursorHeight(0),
    _isLoaded(false),
    _isModified(false),
    _isEditLockHeld(false),
    _tileVersion(0)
{
    assert(!_docKey.empty());
    assert(!_childRoot.empty());

    Log::info("DocumentBroker [" + _uriPublic.toString() + "] created. DocKey: [" + _docKey + "]");
}

const StorageBase::FileInfo DocumentBroker::validate(const Poco::URI& uri)
{
    const auto uriString = uri.toString();
    Log::info("Validating: " + uriString);
    try
    {
        auto storage = StorageBase::create("", "", uri);
        auto fileinfo = storage->getFileInfo(uri);
        Log::info("After checkfileinfo: " + uriString + " -> " + fileinfo._filename);
        if (!fileinfo.isValid())
        {
            Log::error("Invalid file info for uri " + uriString);
            throw BadRequestException("Invalid URI or access denied.");
        }

        return fileinfo;
    }
    catch (const std::exception& ex)
    {
        Log::error("Exception while getting file info for uri " + uriString + ": " + ex.what());
        throw BadRequestException("Invalid URI or access denied.");
    }
}

bool DocumentBroker::load(const std::string& jailId)
{
    Log::debug("Loading from URI: " + _uriPublic.toString());

    std::unique_lock<std::mutex> lock(_mutex);

    if (_markToDestroy)
    {
        // Tearing down.
        return false;
    }

    if (_storage)
    {
        // Already loaded. Nothing to do.
        return true;
    }

    _jailId = jailId;

    // The URL is the publicly visible one, not visible in the chroot jail.
    // We need to map it to a jailed path and copy the file there.

    // user/doc/jailId
    const auto jailPath = Poco::Path(JAILED_DOCUMENT_ROOT, jailId);
    std::string jailRoot = getJailRoot();

    Log::info("jailPath: " + jailPath.toString() + ", jailRoot: " + jailRoot);

    if (LOOLWSD::NoCapsForKit)
        jailRoot = jailPath.toString() + "/" + getJailRoot();

    auto storage = StorageBase::create(jailRoot, jailPath.toString(), _uriPublic);
    if (storage)
    {
        const auto fileInfo = storage->getFileInfo(_uriPublic);
        _filename = fileInfo._filename;

        const auto localPath = storage->loadStorageFileToLocal();
        _uriJailed = Poco::URI(Poco::URI("file://"), localPath);

        // Use the local temp file's timestamp.
        _lastFileModifiedTime = Poco::File(storage->getLocalRootPath()).getLastModified();
        _tileCache.reset(new TileCache(_uriPublic.toString(), _lastFileModifiedTime, _cacheRoot));

        _storage = std::move(storage);
        return true;
    }

    return false;
}

bool DocumentBroker::save(bool success, const std::string& result)
{
    std::unique_lock<std::mutex> lock(_saveMutex);

    const auto uri = _uriPublic.toString();

    // If save requested, but core didn't save because document was unmodified
    // notify the waiting thread, if any.
    if (!success && result == "unmodified")
    {
        Log::debug() << "Save skipped as document was not modified";
        _saveCV.notify_all();
        return true;
    }

    // If we aren't destroying the last editable session just yet, and the file
    // timestamp hasn't changed, skip saving.
    const auto newFileModifiedTime = Poco::File(_storage->getLocalRootPath()).getLastModified();
    if (!isLastEditableSession() && newFileModifiedTime == _lastFileModifiedTime)
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
    if (_storage->saveLocalFileToStorage())
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
        (!_isModified && !force))
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
        for (auto& sessionIt: _sessions)
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
    for (auto& sessionIt: _sessions)
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

        Log::debug(".uno:Save arguments: " + oss.str());
        sessionIt.second->sendToInputQueue("uno .uno:Save " + oss.str());
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

void DocumentBroker::takeEditLock(const std::string& id)
{
    Log::debug("Session " + id + " taking the editing lock.");
    std::lock_guard<std::mutex> lock(_mutex);

    // Forward to all children.
    for (auto& it: _sessions)
    {
        it.second->setEditLock();
    }
}

size_t DocumentBroker::addSession(std::shared_ptr<ClientSession>& session)
{
    const auto id = session->getId();
    const std::string aMessage = "session " + id + " " + _docKey + "\n";

    std::lock_guard<std::mutex> lock(_mutex);

    // Request a new session from the child kit.
    Log::debug("DocBroker to Child: " + aMessage.substr(0, aMessage.length() - 1));
    _childProcess->getWebSocket()->sendFrame(aMessage.data(), aMessage.size());

    auto ret = _sessions.emplace(id, session);
    if (!ret.second)
    {
        Log::warn("DocumentBroker: Trying to add already existing session.");
    }

    if (session->isReadOnly())
    {
        Log::debug("Adding a readonly session [" + id + "]");
    }
    else if (!_isEditLockHeld)
    {
        Log::debug("Giving editing lock to the first editable session [" + id + "].");
        _isEditLockHeld = true;
    }

    // Below values are recalculated when startDestroy() is called (before destroying the
    // document). It is safe to reset their values to their defaults whenever a new session is added
    _lastEditableSession = false;
    _markToDestroy = false;

    return _sessions.size();
}

bool DocumentBroker::connectPeers(std::shared_ptr<PrisonerSession>& session)
{
    const auto id = session->getId();

    std::lock_guard<std::mutex> lock(_mutex);

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

        // pass the edit lock to first non-readonly session in map
        bool editLockGiven = false;
        for (auto& session: _sessions)
        {
            if (!session.second->isReadOnly())
            {
                session.second->setEditLock();
                editLockGiven = true;
                break;
            }
        }

        _isEditLockHeld = editLockGiven;
    }

    return _sessions.size();
}

bool DocumentBroker::handleInput(const std::vector<char>& payload)
{
    const auto msg = LOOLProtocol::getAbbreviatedMessage(payload);
    Log::trace("DocumentBroker got child message: [" + msg + "].");

    LOOLWSD::dumpOutgoingTrace(getJailId(), "0", msg);

    if (msg.find("tile:") == 0)
    {
        handleTileResponse(payload);
    }
    else if (msg.find("tilecombine:") == 0)
    {
       handleTileCombinedResponse(payload);
    }
    else
    {
        Log::error("Unexpected message: [" + msg + "].");
        return false;
    }

    return true;
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

    if (tileCache().subscribeToTileRendering(tile, session) > 0)
    {
        Log::debug() << "Sending render request for tile (" << tile.getPart() << ',' << tile.getTilePosX() << ',' << tile.getTilePosY() << ")." << Log::end;

        // Forward to child to render.
        const std::string request = "tile " + tile.serialize();
        _childProcess->getWebSocket()->sendFrame(request.data(), request.size());
    }
}

void DocumentBroker::handleTileCombinedRequest(TileCombined& tileCombined,
                                               const std::shared_ptr<ClientSession>& session)
{
    std::unique_lock<std::mutex> lock(_mutex);

    Log::trace() << "TileCombined request for " << tileCombined.serialize() << Log::end;

    // Satisfy as many tiles from the cache.
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
            const auto ver = tileCache().subscribeToTileRendering(tile, session);
            if (ver <= 0)
            {
                // Already rendering. Skip.
                continue;
            }
            else
            {
                const auto req = tile.serialize("tile");
                Log::debug() << "Tile request: " << req << Log::end;
                _childProcess->getWebSocket()->sendFrame(req.data(), req.size());
            }
        }
    }
}

void DocumentBroker::handleTileResponse(const std::vector<char>& payload)
{
    const std::string firstLine = getFirstLine(payload);
    try
    {
        auto tile = TileDesc::parse(firstLine);
        const auto buffer = payload.data();
        const auto length = payload.size();

        if (firstLine.size() < static_cast<std::string::size_type>(length) - 1)
        {
            // If the tile right under the cursor, give it priority.
            const bool priority = tile.intersectsWithRect(
                _cursorPosX, _cursorPosY,
                _cursorWidth, _cursorHeight);
            tileCache().saveTileAndNotify(
                tile, buffer + firstLine.size() + 1,
                length - firstLine.size() - 1, priority);
        }
        else
        {
            Log::debug() << "Render request declined for " << firstLine << Log::end;
            std::unique_lock<std::mutex> tileBeingRenderedLock(tileCache().getTilesBeingRenderedLock());
            tileCache().forgetTileBeingRendered(tile);
        }
    }
    catch (const std::exception& exc)
    {
        Log::error("Failed to process tile response [" + firstLine + "]: " + exc.what() + ".");
        //FIXME: Return error.
        //sendTextFrame("error: cmd=tile kind=syntax");
    }
}

void DocumentBroker::handleTileCombinedResponse(const std::vector<char>& payload)
{
    const std::string firstLine = getFirstLine(payload);
    Log::debug("Handling tile combined: " + firstLine);

    try
    {
        auto tileCombined = TileCombined::parse(firstLine);
        const auto buffer = payload.data();
        const auto length = payload.size();
        auto offset = firstLine.size() + 1;

        if (firstLine.size() < static_cast<std::string::size_type>(length) - 1)
        {
            for (const auto& tile : tileCombined.getTiles())
            {
                tileCache().saveTileAndNotify(tile, buffer + offset, tile.getImgSize(), false);
                offset += tile.getImgSize();
            }
        }
        else
        {
            Log::error() << "Render request failed for " << firstLine << Log::end;
            std::unique_lock<std::mutex> tileBeingRenderedLock(tileCache().getTilesBeingRenderedLock());
            for (const auto& tile : tileCombined.getTiles())
            {
                tileCache().forgetTileBeingRendered(tile);
            }
        }
    }
    catch (const std::exception& exc)
    {
        Log::error("Failed to process tile response [" + firstLine + "]: " + exc.what() + ".");
        //FIXME: Return error.
        //sendTextFrame("error: cmd=tile kind=syntax");
    }
}

void DocumentBroker::startDestroy(const std::string& id)
{
    std::unique_lock<std::mutex> lock(_mutex);

    auto currentSession = _sessions.find(id);
    assert(currentSession != _sessions.end());

    // Check if session which is being destroyed is last non-readonly session
    bool lastEditableSession = !currentSession->second->isReadOnly();
    for (auto& it: _sessions)
    {
        if (it.second->getId() == id)
            continue;

        if (!it.second->isReadOnly())
        {
            lastEditableSession = false;
        }
    }

    // Last editable session going away
    _lastEditableSession = lastEditableSession;

    // Last view going away, can destroy.
    _markToDestroy = (_sessions.size() <= 1);
}

void DocumentBroker::setModified(const bool value)
{
    _tileCache->setUnsavedChanges(value);
    _isModified = value;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
