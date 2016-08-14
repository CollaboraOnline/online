/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Storage abstraction.
#ifndef INCLUDED_STORAGE_HPP
#define INCLUDED_STORAGE_HPP

#include <string>
#include <set>

#include <Poco/Util/Application.h>
#include <Poco/URI.h>

#include "Auth.hpp"
#include "Util.hpp"

/// Base class of all Storage abstractions.
class StorageBase
{
public:

    class FileInfo
    {
    public:
        bool isValid() const
        {
            return !_filename.empty() && _size > 0;
        }

        std::string _filename;
        Poco::Timestamp _modifiedTime;
        size_t _size;
        std::string _userId;
        std::string _userName;
    };

    /// localStorePath the absolute root path of the chroot.
    /// jailPath the path within the jail that the child uses.
    StorageBase(const std::string& localStorePath,
                const std::string& jailPath,
                const std::string& uri) :
        _localStorePath(localStorePath),
        _jailPath(jailPath),
        _uri(uri)
    {
        Log::debug("Storage ctor: " + uri);
    }

    std::string getLocalRootPath() const;

    const std::string& getUri() const { return _uri; }

    /// Returns information about the file.
    virtual FileInfo getFileInfo(const Poco::URI& uri) = 0;

    /// Returns a local file path for the given URI.
    /// If necessary copies the file locally first.
    virtual std::string loadStorageFileToLocal() = 0;

    /// Writes the contents of the file back to the source.
    /// TODO: Should we save to the specific client's URI?
    /// The advantage is that subseqent views (to the first)
    /// will not depend on the token of the first.
    virtual bool saveLocalFileToStorage() = 0;

    static
    size_t getFileSize(const std::string& filename);

    /// Must be called at startup to configure.
    static void initialize();

    /// Storage object creation factory.
    static std::unique_ptr<StorageBase> create(const std::string& jailRoot,
                                               const std::string& jailPath,
                                               const Poco::URI& uri);

protected:
    const std::string _localStorePath;
    const std::string _jailPath;
    const std::string _uri;
    std::string _jailedFilePath;
    FileInfo _fileInfo;

    static bool _filesystemEnabled;
    static bool _wopiEnabled;
    /// Allowed/denied WOPI hosts, if any and if WOPI is enabled.
    static Util::RegexListMatcher _wopiHosts;
};

/// Trivial implementation of local storage that does not need do anything.
class LocalStorage : public StorageBase
{
public:
    LocalStorage(const std::string& localStorePath,
                 const std::string& jailPath,
                 const std::string& uri) :
        StorageBase(localStorePath, jailPath, uri),
        _isCopy(false)
    {
        Log::info("LocalStorage ctor with localStorePath: [" + localStorePath +
                  "], jailPath: [" + jailPath + "], uri: [" + uri + "].");
    }

    FileInfo getFileInfo(const Poco::URI& uri) override;

    std::string loadStorageFileToLocal() override;

    bool saveLocalFileToStorage() override;

private:
    /// True if the jailed file is not linked but copied.
    bool _isCopy;
};

class WopiStorage : public StorageBase
{
public:
    WopiStorage(const std::string& localStorePath,
                const std::string& jailPath,
                const std::string& uri) :
        StorageBase(localStorePath, jailPath, uri)
    {
        Log::info("WopiStorage ctor with localStorePath: [" + localStorePath +
                  "], jailPath: [" + jailPath + "], uri: [" + uri + "].");
    }

    FileInfo getFileInfo(const Poco::URI& uri) override;

    /// uri format: http://server/<...>/wopi*/files/<id>/content
    std::string loadStorageFileToLocal() override;

    bool saveLocalFileToStorage() override;
};

class WebDAVStorage : public StorageBase
{
public:
    WebDAVStorage(const std::string& localStorePath,
                  const std::string& jailPath,
                  const std::string& uri,
                  std::unique_ptr<AuthBase> authAgent) :
        StorageBase(localStorePath, jailPath, uri),
        _authAgent(std::move(authAgent))
    {
        Log::info("WebDAVStorage ctor with localStorePath: [" + localStorePath +
                  "], jailPath: [" + jailPath + "], uri: [" + uri + "].");
    }

    FileInfo getFileInfo(const Poco::URI& uri) override;

    std::string loadStorageFileToLocal() override;

    bool saveLocalFileToStorage() override;

private:
    std::unique_ptr<AuthBase> _authAgent;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
