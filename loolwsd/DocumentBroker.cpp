/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <cassert>

#include <Poco/Path.h>
#include <Poco/SHA1Engine.h>

#include "DocumentBroker.hpp"
#include "Exceptions.hpp"
#include "LOOLWSD.hpp"
#include "Storage.hpp"
#include "TileCache.hpp"
#include "LOOLProtocol.hpp"

using namespace LOOLProtocol;

void ChildProcess::socketProcessor()
{
    IoUtil::SocketProcessor(_ws,
        [this](const std::vector<char>& payload)
        {
            auto docBroker = this->_docBroker.lock();
            if (docBroker)
            {
                return docBroker->handleInput(payload);
            }

            Log::warn("No DocumentBroker to handle child message: [" + LOOLProtocol::getAbbreviatedMessage(payload) + "].");
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

DocumentBroker::DocumentBroker(const Poco::URI& uriPublic,
                               const std::string& docKey,
                               const std::string& childRoot,
                               std::shared_ptr<ChildProcess> childProcess) :
    _uriPublic(uriPublic),
    _docKey(docKey),
    _childRoot(childRoot),
    _cacheRoot(getCachePath(uriPublic.toString())),
    _childProcess(childProcess),
    _lastSaveTime(std::chrono::steady_clock::now()),
    _markToDestroy(false),
    _isLoaded(false),
    _isModified(false)
{
    assert(!_docKey.empty());
    assert(!_childRoot.empty());

    Log::info("DocumentBroker [" + _uriPublic.toString() + "] created. DocKey: [" + _docKey + "]");
}

void DocumentBroker::validate(const Poco::URI& uri)
{
    Log::info("Validating: " + uri.toString());
    try
    {
        auto storage = StorageBase::create("", "", uri);
        if (storage == nullptr || !storage->getFileInfo(uri).isValid())
        {
            throw BadRequestException("Invalid URI or access denied.");
        }
    }
    catch (const std::exception&)
    {
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
    const std::string jailRoot = getJailRoot();

    Log::info("jailPath: " + jailPath.toString() + ", jailRoot: " + jailRoot);

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

        _storage.reset(storage.release());
        return true;
    }

    return false;
}

bool DocumentBroker::save()
{
    std::unique_lock<std::mutex> lock(_saveMutex);

    const auto uri = _uriPublic.toString();

    // If the file hasn't been modified within the past 10 seconds, skip saving.
    // FIXME this is because currently the ChildProcessSession broadcasts the
    // unocommandresult, so we get called several times here, and have no real
    // possibility to distinguish who was the 1st caller.
    // The refactor to un-thread the ChildProcessSession, and move the
    // broadcasting up in the hierarchy (so that we can 'sniff' the
    // unocommandresult for .uno:Save at the place where it appears just once)
    // is planned post-release.
    const auto newFileModifiedTime = Poco::File(_storage->getLocalRootPath()).getLastModified();
    const auto elapsed = newFileModifiedTime - _lastFileModifiedTime;
    if (std::abs(elapsed) > 10 * 1000 * 1000)
    {
        // Nothing to do.
        Log::debug("Skipping unnecessary saving to URI [" + uri + "].");
        return true;
    }

    Log::debug("Saving to URI [" + uri + "].");

    assert(_storage && _tileCache);
    if (_storage->saveLocalFileToStorage())
    {
        _isModified = false;
        _tileCache->setUnsavedChanges(false);
        const auto fileInfo = _storage->getFileInfo(_uriPublic);
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
    Log::trace("Autosaving [" + _docKey + "].");

    std::unique_lock<std::mutex> lock(_mutex);
    if (_sessions.empty() || _storage == nullptr || !_isLoaded)
    {
        // Nothing to do.
        Log::trace("Nothing to autosave [" + _docKey + "].");
        return true;
    }

    bool sent = false;
    if (force || _isModified)
    {
        sent = sendUnoSave();
    }
    else
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

        // There has been some editing since we saved last?
        if (inactivityTimeMs < timeSinceLastSaveMs)
        {
            // Either we've been idle long enough, or it's auto-save time.
            // Or we are asked to save anyway.
            if (inactivityTimeMs >= IdleSaveDurationMs ||
                timeSinceLastSaveMs >= AutoSaveDurationMs)
            {
                sent = sendUnoSave();
            }
        }
    }

    if (sent && waitTimeoutMs > 0)
    {
        // Remeber the last save time, since this is the predicate.
        const auto lastSaveTime = _lastSaveTime;

        if (_saveCV.wait_for(lock, std::chrono::milliseconds(waitTimeoutMs)) == std::cv_status::no_timeout)
        {
            return true;
        }

        return (lastSaveTime != _lastSaveTime);
    }

    return sent;
}

bool DocumentBroker::sendUnoSave()
{
    Log::info("Autosave triggered for doc [" + _docKey + "].");
    assert(!_mutex.try_lock());

    // Save using session holding the edit-lock
    for (auto& sessionIt: _sessions)
    {
        if (sessionIt.second->isEditLocked())
        {
            auto queue = sessionIt.second->getQueue();
            if (queue)
            {
                queue->put("uno .uno:Save");
                return true;
            }
        }
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
        it.second->setEditLock(it.first == id);
    }
}

size_t DocumentBroker::addSession(std::shared_ptr<MasterProcessSession>& session)
{
    const auto id = session->getId();

    std::lock_guard<std::mutex> lock(_mutex);

    // Request a new session from the child kit.
    const std::string aMessage = "session " + id + " " + _docKey + "\n";
    Log::debug("DocBroker to Child: " + aMessage.substr(0, aMessage.length() - 1));
    _childProcess->getWebSocket()->sendFrame(aMessage.data(), aMessage.size());

    auto ret = _sessions.emplace(id, session);
    if (!ret.second)
    {
        Log::warn("DocumentBroker: Trying to add already existing session.");
    }

    if (_sessions.size() == 1)
    {
        Log::debug("Giving editing lock to the first session [" + id + "].");
        _sessions.begin()->second->markEditLock(true);
    }

    return _sessions.size();
}

bool DocumentBroker::connectPeers(std::shared_ptr<MasterProcessSession>& session)
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
        const auto haveEditLock = it->second->isEditLocked();
        it->second->markEditLock(false);
        _sessions.erase(it);

        if (haveEditLock)
        {
            // pass the edit lock to first session in map
            it = _sessions.begin();
            if (it != _sessions.end())
            {
                it->second->setEditLock(true);
            }
        }
    }

    return _sessions.size();
}

bool DocumentBroker::handleInput(const std::vector<char>& payload)
{
    Log::trace("DocumentBroker got child message: [" + LOOLProtocol::getAbbreviatedMessage(payload) + "].");

    //TODO: Handle message.
    return true;
}

bool DocumentBroker::canDestroy()
{
    std::unique_lock<std::mutex> lock(_mutex);

    if (_sessions.size() == 1)
    {
        // Last view going away, can destroy.
        _markToDestroy = true;
    }

    return _markToDestroy;
}

void DocumentBroker::setModified(const bool value)
{
    _tileCache->setUnsavedChanges(value);
    _isModified = value;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
