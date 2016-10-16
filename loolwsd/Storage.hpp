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
#include "Log.hpp"
#include "Util.hpp"

/// Base class of all Storage abstractions.
class StorageBase
{
public:

    /// Represents a file's attributes.
    /// Used for local and network files.
    class FileInfo
    {
    public:
        FileInfo(const std::string& filename,
                 const Poco::Timestamp& modifiedTime,
                 size_t size,
                 const std::string& userId,
                 const std::string& userName)
            : _filename(filename),
              _modifiedTime(modifiedTime),
              _size(size),
              _userId(userId),
              _userName(userName)
        {
        }

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
    StorageBase(const Poco::URI& uri,
                const std::string& localStorePath,
                const std::string& jailPath) :
        _uri(uri),
        _localStorePath(localStorePath),
        _jailPath(jailPath),
        _fileInfo("", Poco::Timestamp(), 0, "", ""),
        _isLoaded(false)
    {
        Log::debug("Storage ctor: " + uri.toString());
    }

    std::string getLocalRootPath() const;

    const std::string getUri() const { return _uri.toString(); }

    bool isLoaded() const { return _isLoaded; }

    /// Returns information about the file.
    virtual FileInfo getFileInfo(const Poco::URI& uriPublic) = 0;

    /// Returns a local file path for the given URI.
    /// If necessary copies the file locally first.
    virtual std::string loadStorageFileToLocal() = 0;

    /// Writes the contents of the file back to the source.
    virtual bool saveLocalFileToStorage(const Poco::URI& uriPublic) = 0;

    static
    size_t getFileSize(const std::string& filename);

    /// Must be called at startup to configure.
    static void initialize();

    /// Storage object creation factory.
    static std::unique_ptr<StorageBase> create(const Poco::URI& uri,
                                               const std::string& jailRoot,
                                               const std::string& jailPath);

protected:
    const Poco::URI _uri;
    std::string _localStorePath;
    std::string _jailPath;
    std::string _jailedFilePath;
    FileInfo _fileInfo;
    bool _isLoaded;

    static bool FilesystemEnabled;
    static bool WopiEnabled;
    /// Allowed/denied WOPI hosts, if any and if WOPI is enabled.
    static Util::RegexListMatcher WopiHosts;
};

/// Trivial implementation of local storage that does not need do anything.
class LocalStorage : public StorageBase
{
public:
    LocalStorage(const Poco::URI& uri,
                 const std::string& localStorePath,
                 const std::string& jailPath) :
        StorageBase(uri, localStorePath, jailPath),
        _isCopy(false),
        _localStorageId(LocalStorage::LastLocalStorageId++)
    {
        Log::info("LocalStorage ctor with localStorePath: [" + localStorePath +
                  "], jailPath: [" + jailPath + "], uri: [" + uri.toString() + "].");
    }

    FileInfo getFileInfo(const Poco::URI& uriPublic) override;

    std::string loadStorageFileToLocal() override;

    bool saveLocalFileToStorage(const Poco::URI& uriPublic) override;

private:
    /// True if the jailed file is not linked but copied.
    bool _isCopy;
    static unsigned LastLocalStorageId;
    /// Used to differentiate between multiple localhost users.
    const unsigned _localStorageId;
};

/// WOPI protocol backed storage.
class WopiStorage : public StorageBase
{
public:
    WopiStorage(const Poco::URI& uri,
                const std::string& localStorePath,
                const std::string& jailPath) :
        StorageBase(uri, localStorePath, jailPath),
        _wopiLoadDuration(0)
    {
        Log::info("WopiStorage ctor with localStorePath: [" + localStorePath +
                  "], jailPath: [" + jailPath + "], uri: [" + uri.toString() + "].");
    }

    FileInfo getFileInfo(const Poco::URI& uriPublic) override;

    /// uri format: http://server/<...>/wopi*/files/<id>/content
    std::string loadStorageFileToLocal() override;

    bool saveLocalFileToStorage(const Poco::URI& uriPublic) override;

    /// Total time taken for making WOPI calls during load (includes GetFileInfo calls)
    const std::chrono::duration<double> getWopiLoadDuration() const { return _wopiLoadDuration; }

private:
    // Time spend in waiting for WOPI host during document load
    std::chrono::duration<double> _wopiLoadDuration;
};

/// WebDAV protocol backed storage.
class WebDAVStorage : public StorageBase
{
public:
    WebDAVStorage(const Poco::URI& uri,
                  const std::string& localStorePath,
                  const std::string& jailPath,
                  std::unique_ptr<AuthBase> authAgent) :
        StorageBase(uri, localStorePath, jailPath),
        _authAgent(std::move(authAgent))
    {
        Log::info("WebDAVStorage ctor with localStorePath: [" + localStorePath +
                  "], jailPath: [" + jailPath + "], uri: [" + uri.toString() + "].");
    }

    FileInfo getFileInfo(const Poco::URI& uriPublic) override;

    std::string loadStorageFileToLocal() override;

    bool saveLocalFileToStorage(const Poco::URI& uriPublic) override;

private:
    std::unique_ptr<AuthBase> _authAgent;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
