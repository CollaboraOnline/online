/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_DOCUMENTSTOREMANAGER_HPP
#define INCLUDED_DOCUMENTSTOREMANAGER_HPP

#include <atomic>
#include <mutex>
#include <string>

#include <Poco/Path.h>

#include "Storage.hpp"

/// A DocumentStoreManager as mananged by us.
/// Contains URI, physical path, etc.
class DocumentStoreManager
{
public:

    static
    Poco::URI getUri(std::string uri)
    {
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

        Log::info("Public URI [" + uriPublic.toString() + "].");
        if (uriPublic.getPath().empty())
        {
            throw std::runtime_error("Invalid URI.");
        }

        return uriPublic;
    }

    static
    std::shared_ptr<DocumentStoreManager> create(const std::string& uri,
                                        const std::string& jailRoot,
                                        const std::string& childId)
    {
        std::string decodedUri;
        Poco::URI::decode(uri, decodedUri);
        auto uriPublic = Poco::URI(decodedUri);

        if (uriPublic.isRelative() || uriPublic.getScheme() == "file")
        {
            // TODO: Validate and limit access to local paths!
            uriPublic.normalize();
        }

        Log::info("Public URI [" + uriPublic.toString() + "].");
        if (uriPublic.getPath().empty())
        {
            throw std::runtime_error("Invalid URI.");
        }

        return create(uriPublic, jailRoot, childId);
    }

    static
    std::shared_ptr<DocumentStoreManager> create(
                                        const Poco::URI& uriPublic,
                                        const std::string& jailRoot,
                                        const std::string& childId)
    {
        Log::info("Creating DocumentStoreManager with uri: " + uriPublic.toString() + ", jailRoot: " + jailRoot + ", childId: " + childId);

        // The URL is the publicly visible one, not visible in the chroot jail.
        // We need to map it to a jailed path and copy the file there.

        // user/doc/childId
        const auto jailPath = Poco::Path(JailedDocumentRoot, childId);

        Log::info("jailPath: " + jailPath.toString() + ", jailRoot: " + jailRoot);

        auto uriJailed = uriPublic;
        std::unique_ptr<StorageBase> storage;
        if (uriPublic.isRelative() || uriPublic.getScheme() == "file")
        {
            Log::info("Public URI [" + uriPublic.toString() + "] is a file.");
            storage.reset(new LocalStorage(jailRoot, jailPath.toString(), uriPublic.getPath()));
            const auto localPath = storage->loadStorageFileToLocal();
            uriJailed = Poco::URI(Poco::URI("file://"), localPath);
        }
        else
        {
            Log::info("Public URI [" + uriPublic.toString() +
                      "] assuming cloud storage.");
            //TODO: Configure the storage to use. For now, assume it's WOPI.
            storage.reset(new WopiStorage(jailRoot, jailPath.toString(), uriPublic.toString()));
            const auto localPath = storage->loadStorageFileToLocal();
            uriJailed = Poco::URI(Poco::URI("file://"), localPath);
        }

        auto document = std::shared_ptr<DocumentStoreManager>(new DocumentStoreManager(uriPublic, uriJailed, childId, storage));

        return document;
    }

    ~DocumentStoreManager()
    {
        Log::info("~DocumentStoreManager [" + _uriPublic.toString() + "] destroyed.");
    }

    bool save()
    {
        assert(_storage);
        return _storage->saveLocalFileToStorage();
    }

    Poco::URI getPublicUri() const { return _uriPublic; }
    Poco::URI getJailedUri() const { return _uriJailed; }
    std::string getJailId() const { return _jailId; }

private:
    DocumentStoreManager(const Poco::URI& uriPublic,
                         const Poco::URI& uriJailed,
                         const std::string& jailId,
                         std::unique_ptr<StorageBase>& storage) :
       _uriPublic(uriPublic),
       _uriJailed(uriJailed),
       _jailId(jailId),
       _storage(std::move(storage))
    {
        Log::info("DocumentStoreManager [" + _uriPublic.toString() + "] created.");
    }

private:
    const Poco::URI _uriPublic;
    const Poco::URI _uriJailed;
    const std::string _jailId;

    std::unique_ptr<StorageBase> _storage;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
