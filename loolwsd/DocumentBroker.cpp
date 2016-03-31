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

#include "LOOLWSD.hpp"
#include "DocumentBroker.hpp"
#include "Storage.hpp"
#include "TileCache.hpp"

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

Poco::URI DocumentBroker::sanitizeURI(std::string uri)
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
                               const std::string& childRoot) :
    _uriPublic(uriPublic),
    _docKey(docKey),
    _childRoot(childRoot),
    _cacheRoot(getCachePath(uriPublic.toString())),
    _sessionsCount(0)
{
    assert(!_docKey.empty());
    assert(!_childRoot.empty());
    Log::info("DocumentBroker [" + _uriPublic.toString() + "] created. DocKey: [" + _docKey + "]");
}

void DocumentBroker::validate(const Poco::URI& uri)
{
    Log::info("Validating: " + uri.toString());
    auto storage = createStorage("", "", uri);
    storage->getFileInfo(uri);
}

bool DocumentBroker::load(const std::string& jailId)
{
    Log::debug("Loading from URI: " + _uriPublic.toString());

    std::unique_lock<std::mutex> lock(_mutex);

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

    auto storage = createStorage("", "", _uriPublic);
    const auto fileInfo = storage->getFileInfo(_uriPublic);
    _tileCache.reset(new TileCache(_uriPublic.toString(), fileInfo.ModifiedTime, _cacheRoot));

    _storage = createStorage(jailRoot, jailPath.toString(), _uriPublic);

    const auto localPath = _storage->loadStorageFileToLocal();
    _uriJailed = Poco::URI(Poco::URI("file://"), localPath);
    return true;
}

bool DocumentBroker::save()
{
    Log::debug("Saving to URI: " + _uriPublic.toString());

    assert(_storage && _tileCache);
    if (_storage->saveLocalFileToStorage())
    {
        _tileCache->documentSaved();
        return true;
    }

    return false;
}

std::string DocumentBroker::getJailRoot() const
{
    assert(!_jailId.empty());
    return Poco::Path(_childRoot, _jailId).toString();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
