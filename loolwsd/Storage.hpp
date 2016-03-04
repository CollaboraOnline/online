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

#include <Poco/Net/HTTPResponse.h>

#include "Auth.hpp"
#include "Util.hpp"

/// Base class of all Storage abstractions.
class StorageBase
{
public:

    StorageBase(const std::string& localStorePath) :
        _localStorePath(localStorePath)
    {
    }

    /// Returns a local file path given a URI or ID.
    /// If necessary copies the file locally first.
    virtual std::string getFilePathFromURI(const std::string& uri) = 0;

    /// Writes the contents of the file back to the source.
    virtual bool restoreFileToURI(const std::string& path, const std::string& uri) = 0;

protected:
    const std::string _localStorePath;
};

/// Trivial implementation of local storage that does not need do anything.
class LocalStorage : public StorageBase
{
public:

    std::string getFilePathFromURI(const std::string& uri) override
    {
        // It's local already.
        // TODO: Validate access?
        return uri;
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
    WopiStorage(const std::string& localStorePath) :
        StorageBase(localStorePath)
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
                  const std::string& url,
                  std::unique_ptr<AuthBase> authAgent) :
        StorageBase(localStorePath),
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
