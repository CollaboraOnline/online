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
#include <fstream>

#include <Poco/Net/HTTPResponse.h>

#include "Common.hpp"
#include "Auth.hpp"
#include "Util.hpp"

/// Base class of all Storage abstractions.
class StorageBase
{
public:

    /// localStorePath the absolute root path of the chroot.
    /// jailPath the path within the jail that the child uses.
    StorageBase(const std::string& localStorePath,
                const std::string& jailPath,
                const std::string& uri) :
        _localStorePath(localStorePath),
        _jailPath(jailPath),
        _uri(uri)
    {
    }

    std::string getLocalRootPath() const
    {
        auto localPath = _jailPath;
        if (localPath[0] == '/')
        {
            // Remove the leading /
            localPath.erase(0, 1);
        }

        // /chroot/jailId/user/doc/childId
        const auto rootPath = Poco::Path(_localStorePath, localPath);
        Poco::File(rootPath).createDirectories();

        return rootPath.toString();
    }

    const std::string& getUri() const { return _uri; }

    /// Returns a local file path given a URI or ID.
    /// If necessary copies the file locally first.
    virtual std::string loadStorageFileToLocal() = 0;

    /// Writes the contents of the file back to the source.
    virtual bool saveLocalFileToStorage() = 0;

protected:
    const std::string _localStorePath;
    const std::string _jailPath;
    const std::string _uri;
    std::string _jailedFilePath;
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
    }

    std::string loadStorageFileToLocal() override
    {
        const auto rootPath = getLocalRootPath();

        // /chroot/jailId/user/doc/childId/file.ext
        const auto filename = Poco::Path(_uri).getFileName();
        _jailedFilePath = Poco::Path(rootPath, filename).toString();

        Log::info("Public URI [" + _uri +
                  "] jailed to [" + _jailedFilePath + "].");

        const auto publicFilePath = _uri;
        Log::info("Linking " + publicFilePath + " to " + _jailedFilePath);
        if (!Poco::File(_jailedFilePath).exists() && link(publicFilePath.c_str(), _jailedFilePath.c_str()) == -1)
        {
            // Failed
            Log::error("link(\"" + publicFilePath + "\", \"" + _jailedFilePath + "\") failed.");
        }

        try
        {
            // Fallback to copying.
            if (!Poco::File(_jailedFilePath).exists())
            {
                Log::info("Copying " + publicFilePath + " to " + _jailedFilePath);
                Poco::File(publicFilePath).copyTo(_jailedFilePath);
                _isCopy = true;
            }
        }
        catch (const Poco::Exception& exc)
        {
            Log::error("copyTo(\"" + publicFilePath + "\", \"" + _jailedFilePath + "\") failed: " + exc.displayText());
            throw;
        }

        // Now return the jailed path.
        return Poco::Path(_jailPath, filename).toString();
    }

    bool saveLocalFileToStorage() override
    {
        try
        {
            // Copy the file back.
            if (_isCopy && Poco::File(_jailedFilePath).exists())
            {
                Log::info("Copying " + _jailedFilePath + " to " + _uri);
                Poco::File(_jailedFilePath).copyTo(_uri);
            }
        }
        catch (const Poco::Exception& exc)
        {
            Log::error("copyTo(\"" + _jailedFilePath + "\", \"" + _uri + "\") failed: " + exc.displayText());
            throw;
        }

        return true;
    }

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
    }

    /// uri format: http://server/<...>/wopi*/files/<id>/content
    std::string loadStorageFileToLocal() override
    {
        Log::info("Downloading URI [" + _uri + "].");

        Poco::URI uriObject(_uri);
        Poco::Net::HTTPClientSession session(uriObject.getHost(), uriObject.getPort());
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, uriObject.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
        request.set("User-Agent", "LOOLWSD WOPI Agent");
        session.sendRequest(request);

        Poco::Net::HTTPResponse response;
        std::istream& rs = session.receiveResponse(response);

        Log::info() << "WOPI::GetFile Status for URI [" << _uri << "]: "
                    << response.getStatus() << " " << response.getReason() << Log::end;

        auto logger = Log::debug();
        logger << "WOPI::GetFile header for URI [" << _uri << "]:\n";
        for (auto& pair : response)
        {
            logger << '\t' + pair.first + ": " + pair.second << '\n';
        }

        logger << Log::end;

        //TODO: Get proper filename.
        const auto filename = "filename";
        _jailedFilePath = Poco::Path(getLocalRootPath(), filename).toString();
        std::ofstream ofs(_jailedFilePath);
        std::copy(std::istreambuf_iterator<char>(rs),
                  std::istreambuf_iterator<char>(),
                  std::ostreambuf_iterator<char>(ofs));

        // Now return the jailed path.
        return Poco::Path(_jailPath, filename).toString();
    }

    bool saveLocalFileToStorage() override
    {
        Poco::URI uriObject(_uri);
        Poco::Net::HTTPClientSession session(uriObject.getHost(), uriObject.getPort());
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, _uri, Poco::Net::HTTPMessage::HTTP_1_1);

        std::ifstream ifs(_jailedFilePath);
        request.read(ifs);

        Poco::Net::HTTPResponse response;
        session.sendRequest(request);
        Log::info() << "WOPI::PutFile Status: " <<  response.getStatus() << " " << response.getReason() << Log::end;

        return (response.getStatus() == Poco::Net::HTTPResponse::HTTP_OK);
    }
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
    }

    std::string loadStorageFileToLocal() override
    {
        // TODO: implement webdav GET.
        return _uri;
    }

    bool saveLocalFileToStorage() override
    {
        // TODO: implement webdav PUT.
        return false;
    }

private:
    std::unique_ptr<AuthBase> _authAgent;
};

#endif
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
