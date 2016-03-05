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
                const std::string& jailPath) :
        _localStorePath(localStorePath),
        _jailPath(jailPath)
    {
    }

    /// Returns a local file path given a URI or ID.
    /// If necessary copies the file locally first.
    virtual std::string getFilePathFromURI(const std::string& uri) = 0;

    /// Writes the contents of the file back to the source.
    virtual bool restoreFileToURI(const std::string& path, const std::string& uri) = 0;

protected:
    const std::string _localStorePath;
    const std::string _jailPath;
};

/// Trivial implementation of local storage that does not need do anything.
class LocalStorage : public StorageBase
{
public:
    LocalStorage(const std::string& localStorePath,
                 const std::string& jailPath) :
        StorageBase(localStorePath, jailPath)
    {
    }

    std::string getFilePathFromURI(const std::string& uri) override
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

        // /chroot/jailId/user/doc/childId/file.ext
        const auto filename = Poco::Path(uri).getFileName();
        const auto jailedFilePath = Poco::Path(rootPath, filename).toString();

        Log::info("Public URI [" + uri +
                  "] jailed to [" + jailedFilePath + "].");

        const auto publicFilePath = uri;
        Log::info("Linking " + publicFilePath + " to " + jailedFilePath);
        if (!Poco::File(jailedFilePath).exists() && link(publicFilePath.c_str(), jailedFilePath.c_str()) == -1)
        {
            // Failed
            Log::error("link(\"" + publicFilePath + "\", \"" + jailedFilePath + "\") failed.");
        }

        try
        {
            // Fallback to copying.
            if (!Poco::File(jailedFilePath).exists())
            {
                Log::info("Copying " + publicFilePath + " to " + jailedFilePath);
                Poco::File(publicFilePath).copyTo(jailedFilePath);
            }
        }
        catch (const Poco::Exception& exc)
        {
            Log::error("copyTo(\"" + publicFilePath + "\", \"" + jailedFilePath + "\") failed: " + exc.displayText());
            throw;
        }

        // Now return the jailed path.
        return Poco::Path(_jailPath, filename).toString();
    }

    bool restoreFileToURI(const std::string& path, const std::string& uri) override
    {
        // Nothing to do.
        (void)path;
        (void)uri;
        return false;
    }
};

class WopiStorage : public StorageBase
{
public:
    WopiStorage(const std::string& localStorePath,
                 const std::string& jailPath) :
        StorageBase(localStorePath, jailPath)
    {
    }

    /// uri format: http://server/<...>/wopi*/files/<id>/content
    std::string getFilePathFromURI(const std::string& uri) override
    {
        Poco::URI uriObject(uri);
        Poco::Net::HTTPClientSession session(uriObject.getHost(), uriObject.getPort());
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, uri, Poco::Net::HTTPMessage::HTTP_1_1);
        Poco::Net::HTTPResponse response;
        session.sendRequest(request);
        std::istream& rs = session.receiveResponse(response);
        Log::info() << "WOPI::GetFile Status: " <<  response.getStatus() << " " << response.getReason() << Log::end;

        //TODO: Get proper filename.
        const std::string local_filename = _localStorePath + "/filename";
        std::ofstream ofs(local_filename);
        std::copy(std::istreambuf_iterator<char>(rs),
                  std::istreambuf_iterator<char>(),
                  std::ostreambuf_iterator<char>(ofs));
        return local_filename;
    }

    bool restoreFileToURI(const std::string& path, const std::string& uri) override
    {
        Poco::URI uriObject(uri);
        Poco::Net::HTTPClientSession session(uriObject.getHost(), uriObject.getPort());
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, uri, Poco::Net::HTTPMessage::HTTP_1_1);

        std::ifstream ifs(path);
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
                  const std::string& url,
                  std::unique_ptr<AuthBase> authAgent) :
        StorageBase(localStorePath, jailPath),
        _url(url),
        _authAgent(std::move(authAgent))
    {
    }

    std::string getFilePathFromURI(const std::string& uri) override
    {
        // TODO: implement webdav GET.
        return uri;
    }

    bool restoreFileToURI(const std::string& path, const std::string& uri) override
    {
        // TODO: implement webdav PUT.
        (void)path;
        (void)uri;
        return false;
    }

private:
    const std::string _url;
    std::unique_ptr<AuthBase> _authAgent;
};

#endif
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
