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
#include <memory>
#include <mutex>
#include <string>

#include <Poco/URI.h>

#include <Util.hpp>

// Forwards.
class StorageBase;
class TileCache;

/// DocumentBroker is responsible for setting up a document
/// in jail and brokering loading it from Storage
/// and saving it back.
/// Contains URI, physical path, etc.
class DocumentBroker
{
public:

    static
    Poco::URI sanitizeURI(std::string uri);

    /// Returns a document-specific key based
    /// on the URI of the document.
    static
    std::string getDocKey(const Poco::URI& uri);

    DocumentBroker(const Poco::URI& uriPublic,
                   const std::string& docKey,
                   const std::string& childRoot);

    ~DocumentBroker()
    {
        Log::info() << "~DocumentBroker [" << _uriPublic.toString()
                    << "] destroyed with " << _sessionsCount
                    << " sessions." << Log::end;
    }

    void validate(const Poco::URI& uri);

    /// Loads a document from the public URI into the jail.
    bool load(const std::string& jailId);

    bool save();

    Poco::URI getPublicUri() const { return _uriPublic; }
    Poco::URI getJailedUri() const { return _uriJailed; }
    const std::string& getJailId() const { return _jailId; }
    const std::string& getDocKey() const { return _docKey; }
    unsigned decSessions() { return --_sessionsCount; }
    unsigned incSessions() { return ++_sessionsCount; }
    unsigned getSessionsCount() { return _sessionsCount; }
    TileCache& tileCache() { return *_tileCache; }

    std::string getJailRoot() const;

private:
    const Poco::URI _uriPublic;
    const std::string _docKey;
    const std::string _childRoot;
    Poco::URI _uriJailed;
    std::string _jailId;
    std::string _filename;
    std::unique_ptr<StorageBase> _storage;
    std::unique_ptr<TileCache> _tileCache;
    std::mutex _mutex;
    std::atomic<unsigned> _sessionsCount;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
