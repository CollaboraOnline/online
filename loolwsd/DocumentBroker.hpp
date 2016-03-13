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
    std::shared_ptr<DocumentBroker> create(std::string uri, const std::string& childRoot)
    {
        Log::info("Creating DocumentBroker for uri: " + uri + ".");

        // The URI of the document is url-encoded
        // and passed in our URL.
        if (uri.size() > 1 && uri[0] == '/')
        {
            // Remove leading '/'.
            uri.erase(0, 1);
        }

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

        std::string docKey;
        Poco::URI::encode(uriPublic.getPath(), "", docKey);

        return std::shared_ptr<DocumentBroker>(new DocumentBroker(uriPublic, docKey, childRoot));
    }

    ~DocumentBroker()
    {
        Log::info("~DocumentBroker [" + _uriPublic.toString() + "] destroyed.");
    }

    /// Loads a document from the public URI into the jail.
    bool load(const std::string& jailId)
    {
        Log::debug("Loading from URI: " + _uriPublic.toString());

        std::unique_lock<std::mutex> lock(_mutex);

        if (_storage)
        {
            // Already loaded. Just return.
            return true;
        }

        _jailId = jailId;

        // The URL is the publicly visible one, not visible in the chroot jail.
        // We need to map it to a jailed path and copy the file there.

        // user/doc/jailId
        const auto jailPath = Poco::Path(JailedDocumentRoot, jailId);
        const std::string jailRoot = getJailRoot();

        Log::info("jailPath: " + jailPath.toString() + ", jailRoot: " + jailRoot);

        if (_uriPublic.isRelative() || _uriPublic.getScheme() == "file")
        {
            Log::info("Public URI [" + _uriPublic.toString() + "] is a file.");
            _storage.reset(new LocalStorage(jailRoot, jailPath.toString(), _uriPublic.getPath()));
        }
        else
        {
            Log::info("Public URI [" + _uriPublic.toString() +
                      "] assuming cloud storage.");
            //TODO: Configure the storage to use. For now, assume it's WOPI.
            _storage.reset(new WopiStorage(jailRoot, jailPath.toString(), _uriPublic.toString()));
        }

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

    std::string getJailRoot() const
    {
        assert(!_jailId.empty());
        return Poco::Path(_childRoot, _jailId).toString();
    }

private:
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

private:
    const Poco::URI _uriPublic;
    const std::string _docKey;
    const std::string _childRoot;
    Poco::URI _uriJailed;
    std::string _jailId;
    std::unique_ptr<StorageBase> _storage;
    std::mutex _mutex;
    std::atomic<unsigned> _sessionsCount;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
