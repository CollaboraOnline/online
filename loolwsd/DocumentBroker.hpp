/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_DOCUMENTBROKER_HPP
#define INCLUDED_DOCUMENTBROKER_HPP

#include <atomic>
#include <mutex>
#include <string>

#include <Poco/Path.h>

#include "Storage.hpp"

/// DocumentBroker is responsible for setting up a document
/// in jail and brokering loading it from Storage
/// and saving it back.
/// Contains URI, physical path, etc.
class DocumentBroker
{
public:

    static
    Poco::URI sanitizeURI(std::string uri)
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

    /// Returns a document-specific key based
    /// on the URI of the document.
    static
    std::string getDocKey(const Poco::URI& uri)
    {
        // Keep the host as part of the key to close a potential security hole.
        std::string docKey;
        Poco::URI::encode(uri.getHost() + uri.getPath(), "", docKey);
        return docKey;
    }

    DocumentBroker(const Poco::URI& uriPublic,
                   const std::string& docKey,
                   const std::string& childRoot) :
       _uriPublic(uriPublic),
       _docKey(docKey),
       _childRoot(childRoot),
       _sessionsCount(0)
    {
        assert(!_docKey.empty());
        assert(!_childRoot.empty());
        Log::info("DocumentBroker [" + _uriPublic.toString() + "] created. DocKey: [" + _docKey + "]");
    }

    ~DocumentBroker()
    {
        Log::info("~DocumentBroker [" + _uriPublic.toString() + "] destroyed.");
    }

    void validate(const Poco::URI& uri)
    {
        Log::info("Validating: " + uri.toString());
        auto storage = createStorage("", "", uri);
        storage->getFileInfo(uri);
    }

    /// Loads a document from the public URI into the jail.
    bool load(const std::string& jailId)
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
        const auto jailPath = Poco::Path(JailedDocumentRoot, jailId);
        const std::string jailRoot = getJailRoot();

        Log::info("jailPath: " + jailPath.toString() + ", jailRoot: " + jailRoot);

        _storage = createStorage(jailRoot, jailPath.toString(), _uriPublic);

        const auto localPath = _storage->loadStorageFileToLocal();
        _uriJailed = Poco::URI(Poco::URI("file://"), localPath);
        return true;
    }

    bool save()
    {
        Log::debug("Saving to URI: " + _uriPublic.toString());

        assert(_storage);
        return _storage->saveLocalFileToStorage();
    }

    Poco::URI getPublicUri() const { return _uriPublic; }
    Poco::URI getJailedUri() const { return _uriJailed; }
    const std::string& getJailId() const { return _jailId; }
    const std::string& getDocKey() const { return _docKey; }
    unsigned decSessions() { return --_sessionsCount; }
    unsigned incSessions() { return ++_sessionsCount; }
    unsigned getSessionsCount() { return _sessionsCount; }

    std::string getJailRoot() const
    {
        assert(!_jailId.empty());
        return Poco::Path(_childRoot, _jailId).toString();
    }

private:
    const Poco::URI _uriPublic;
    const std::string _docKey;
    const std::string _childRoot;
    Poco::URI _uriJailed;
    std::string _jailId;
    std::string _filename;
    std::unique_ptr<StorageBase> _storage;
    std::mutex _mutex;
    std::atomic<unsigned> _sessionsCount;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
