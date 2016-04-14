/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <cassert>
#include <string>
#include <fstream>

#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/StreamCopier.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>

#include "Common.hpp"
#include "Auth.hpp"
#include "Storage.hpp"
#include "Util.hpp"
#include "Unit.hpp"

///////////////////
// StorageBase Impl
///////////////////
std::string StorageBase::getLocalRootPath() const
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

size_t StorageBase::getFileSize(const std::string& filename)
{
    return std::ifstream(filename, std::ifstream::ate | std::ifstream::binary).tellg();
}

std::unique_ptr<StorageBase> StorageBase::create(const std::string& jailRoot, const std::string& jailPath, const Poco::URI& uri)
{
    std::unique_ptr<StorageBase> storage;

    if (UnitWSD::get().createStorage(jailRoot, jailPath, uri, storage))
        Log::info("Storage load hooked");
    else if (uri.isRelative() || uri.getScheme() == "file")
    {
        if (!Poco::Util::Application::instance().config().getBool("storage.filesystem[@allow]", false))
        {
            Log::error("Local Storage is disabled by default. Specify allowlocalstorage on the command-line to enable.");
            return nullptr;
        }

        Log::info("Public URI [" + uri.toString() + "] is a file.");
        storage = std::unique_ptr<StorageBase>(new LocalStorage(jailRoot, jailPath, uri.getPath()));
    }
    else
    {
        Log::info("Public URI [" + uri.toString() +
                  "] assuming cloud storage.");
        //TODO: Configure the storage to use. For now, assume it's WOPI.
        storage = std::unique_ptr<StorageBase>(new WopiStorage(jailRoot, jailPath, uri.toString()));
    }
    return storage;
}

////////////////////
// LocalStorage Impl
/////////////////////
StorageBase::FileInfo LocalStorage::getFileInfo(const Poco::URI& uri)
{
    const auto path = uri.getPath();
    Log::debug("Getting info for local uri [" + uri.toString() + "], path [" + path + "].");
    const auto filename = Poco::Path(path).getFileName();
    const auto lastModified = Poco::File(path).getLastModified();
    const auto size = Poco::File(path).getSize();
    return FileInfo({filename, lastModified, size});
}

std::string LocalStorage::loadStorageFileToLocal()
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
        Log::warn("link(\"" + publicFilePath + "\", \"" + _jailedFilePath + "\") failed. Will copy.");
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

bool LocalStorage::saveLocalFileToStorage()
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

///////////////////
// WopiStorage Impl
///////////////////
StorageBase::FileInfo WopiStorage::getFileInfo(const Poco::URI& uri)
{
    Log::debug("Getting info for wopi uri [" + uri.toString() + "].");

    Poco::URI uriObject(uri);
#if ENABLE_SSL
    Poco::Net::HTTPSClientSession session(uriObject.getHost(), uriObject.getPort(), Poco::Net::SSLManager::instance().defaultClientContext());
#else
    Poco::Net::HTTPClientSession session(uriObject.getHost(), uriObject.getPort());
#endif
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, uriObject.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
    request.set("User-Agent", "LOOLWSD WOPI Agent");
    session.sendRequest(request);

    Poco::Net::HTTPResponse response;
    std::istream& rs = session.receiveResponse(response);

    auto logger = Log::trace();
    logger << "WOPI::CheckFileInfo header for URI [" << uri.toString() << "]:\n";
    for (auto& pair : response)
    {
        logger << '\t' + pair.first + ": " + pair.second << " / ";
    }

    logger << Log::end;

    // Parse the response.
    std::string filename;
    size_t size = 0;
    std::string resMsg;
    Poco::StreamCopier::copyToString(rs, resMsg);
    Log::debug("WOPI::CheckFileInfo returned: " + resMsg);
    const auto index = resMsg.find_first_of("{");
    if (index != std::string::npos)
    {
        const std::string stringJSON = resMsg.substr(index);
        Poco::JSON::Parser parser;
        const auto result = parser.parse(stringJSON);
        const auto object = result.extract<Poco::JSON::Object::Ptr>();
        filename = object->get("BaseFileName").toString();
        size = std::stoul (object->get("Size").toString(), nullptr, 0);
    }

    // WOPI doesn't support file last modified time.
    return FileInfo({filename, Poco::Timestamp(), size});
}

/// uri format: http://server/<...>/wopi*/files/<id>/content
std::string WopiStorage::loadStorageFileToLocal()
{
    Log::info("Downloading URI [" + _uri + "].");

    _fileInfo = getFileInfo(Poco::URI(_uri));
    if (_fileInfo.Size == 0 && _fileInfo.Filename.empty())
    {
        //TODO: Should throw a more appropriate exception.
        throw std::runtime_error("Failed to load file from storage.");
    }

    // WOPI URI to download files ends in '/contents'.
    // Add it here to get the payload instead of file info.
    Poco::URI uriObject(_uri);
    const auto url = uriObject.getPath() + "/contents?" + uriObject.getQuery();
    Log::debug("Wopi requesting: " + url);

#if ENABLE_SSL
    Poco::Net::HTTPSClientSession session(uriObject.getHost(), uriObject.getPort(), Poco::Net::SSLManager::instance().defaultClientContext());
#else
    Poco::Net::HTTPClientSession session(uriObject.getHost(), uriObject.getPort());
#endif
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, url, Poco::Net::HTTPMessage::HTTP_1_1);
    request.set("User-Agent", "LOOLWSD WOPI Agent");
    session.sendRequest(request);

    Poco::Net::HTTPResponse response;
    std::istream& rs = session.receiveResponse(response);

    auto logger = Log::trace();
    logger << "WOPI::GetFile header for URI [" << _uri << "]:\n";
    for (auto& pair : response)
    {
        logger << '\t' + pair.first + ": " + pair.second << " / ";
    }

    logger << Log::end;

    _jailedFilePath = Poco::Path(getLocalRootPath(), _fileInfo.Filename).toString();
    std::ofstream ofs(_jailedFilePath);
    std::copy(std::istreambuf_iterator<char>(rs),
              std::istreambuf_iterator<char>(),
              std::ostreambuf_iterator<char>(ofs));
    const auto size = getFileSize(_jailedFilePath);

    Log::info() << "WOPI::GetFile downloaded " << size << " bytes from [" << _uri
                << "] -> " << _jailedFilePath << ": "
                << response.getStatus() << " " << response.getReason() << Log::end;

    // Now return the jailed path.
    return Poco::Path(_jailPath, _fileInfo.Filename).toString();
}

bool WopiStorage::saveLocalFileToStorage()
{
    Log::info("Uploading URI [" + _uri + "] from [" + _jailedFilePath + "].");
    const auto size = getFileSize(_jailedFilePath);

    Poco::URI uriObject(_uri);
    const auto url = uriObject.getPath() + "/contents?" + uriObject.getQuery();
    Log::debug("Wopi posting: " + url);

#if ENABLE_SSL
    Poco::Net::HTTPSClientSession session(uriObject.getHost(), uriObject.getPort(), Poco::Net::SSLManager::instance().defaultClientContext());
#else
    Poco::Net::HTTPClientSession session(uriObject.getHost(), uriObject.getPort());
#endif
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, url, Poco::Net::HTTPMessage::HTTP_1_1);
    request.set("X-WOPIOverride", "PUT");
    request.setContentType("application/octet-stream");
    request.setContentLength(size);

    std::ostream& os = session.sendRequest(request);
    std::ifstream ifs(_jailedFilePath);
    Poco::StreamCopier::copyStream(ifs, os);

    Poco::Net::HTTPResponse response;
    std::istream& rs = session.receiveResponse(response);
    std::ostringstream oss;
    Poco::StreamCopier::copyStream(rs, oss);

    Log::info("WOPI::PutFile response: " + oss.str());
    const auto success = (response.getStatus() == Poco::Net::HTTPResponse::HTTP_OK);
    Log::info() << "WOPI::PutFile uploaded " << size << " bytes from [" << _jailedFilePath  << "]:"
                << "] -> [" << _uri << "]: "
                <<  response.getStatus() << " " << response.getReason() << Log::end;

    return success;
}

//////////////////////
// WebDAVStorage Impl
///////////////////////
StorageBase::FileInfo WebDAVStorage::getFileInfo(const Poco::URI& uri)
{
    Log::debug("Getting info for webdav uri [" + uri.toString() + "].");
    (void)uri;
    assert(!"Not Implemented!");
    return FileInfo({"bazinga", Poco::Timestamp(), 0});
}

std::string WebDAVStorage::loadStorageFileToLocal()
{
    // TODO: implement webdav GET.
    return _uri;
}

bool WebDAVStorage::saveLocalFileToStorage()
{
    // TODO: implement webdav PUT.
    return false;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
