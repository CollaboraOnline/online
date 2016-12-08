/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "Storage.hpp"
#include "config.h"

#include <algorithm>
#include <cassert>
#include <fstream>
#include <string>

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/DNS.h>
#include <Poco/Exception.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/NetworkInterface.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/StreamCopier.h>

#include "Auth.hpp"
#include "Common.hpp"
#include "Exceptions.hpp"
#include "common/FileUtil.hpp"
#include "LOOLWSD.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "Util.hpp"

bool StorageBase::FilesystemEnabled;
bool StorageBase::WopiEnabled;
Util::RegexListMatcher StorageBase::WopiHosts;

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

void StorageBase::initialize()
{
    const auto& app = Poco::Util::Application::instance();
    FilesystemEnabled = app.config().getBool("storage.filesystem[@allow]", false);

    // Parse the WOPI settings.
    WopiHosts.clear();
    WopiEnabled = app.config().getBool("storage.wopi[@allow]", false);
    if (WopiEnabled)
    {
        for (size_t i = 0; ; ++i)
        {
            const std::string path = "storage.wopi.host[" + std::to_string(i) + "]";
            const auto host = app.config().getString(path, "");
            if (!host.empty())
            {
                if (app.config().getBool(path + "[@allow]", false))
                {
                    LOG_INF("Adding trusted WOPI host: [" << host << "].");
                    WopiHosts.allow(host);
                }
                else
                {
                    LOG_INF("Adding blocked WOPI host: [" << host << "].");
                    WopiHosts.deny(host);
                }
            }
            else if (!app.config().has(path))
            {
                break;
            }
        }
    }
}

bool isLocalhost(const std::string& targetHost)
{
    std::string targetAddress;
    try
    {
        targetAddress = Poco::Net::DNS::resolveOne(targetHost).toString();
    }
    catch (const Poco::Exception& exc)
    {
        Log::warn("Poco::Net::DNS::resolveOne(\"" + targetHost + "\") failed: " + exc.displayText());
        try
        {
            targetAddress = Poco::Net::IPAddress(targetHost).toString();
        }
        catch (const Poco::Exception& exc1)
        {
            Log::warn("Poco::Net::IPAddress(\"" + targetHost + "\") failed: " + exc1.displayText());
        }
    }

    Poco::Net::NetworkInterface::NetworkInterfaceList list = Poco::Net::NetworkInterface::list(true,true);
    for (auto& netif : list)
    {
        std::string address = netif.address().toString();
        address = address.substr(0, address.find('%', 0));
        if (address == targetAddress)
        {
            LOG_INF("WOPI host is on the same host as the WOPI client: \"" <<
                    targetAddress << "\". Connection is allowed.");
            return true;
        }
    }

    LOG_INF("WOPI host is not on the same host as the WOPI client: \"" <<
            targetAddress << "\". Connection is not allowed.");
    return false;
}

std::unique_ptr<StorageBase> StorageBase::create(const Poco::URI& uri, const std::string& jailRoot, const std::string& jailPath)
{
    // FIXME: By the time this gets called we have already sent to the client three
    // 'statusindicator:' messages: 'find', 'connect' and 'ready'. We should ideally do the checks
    // here much earlier. Also, using exceptions is lame and makes understanding the code harder,
    // but that is just my personal preference.

    std::unique_ptr<StorageBase> storage;

    if (UnitWSD::get().createStorage(uri, jailRoot, jailPath, storage))
    {
        LOG_INF("Storage load hooked.");
        if (storage)
        {
            return storage;
        }
    }
    else if (uri.isRelative() || uri.getScheme() == "file")
    {
        LOG_INF("Public URI [" << uri.toString() << "] is a file.");

#if ENABLE_DEBUG
        if (std::getenv("FAKE_UNAUTHORIZED"))
        {
            LOG_FTL("Faking an UnauthorizedRequestException");
            throw UnauthorizedRequestException("No acceptable WOPI hosts found matching the target host in config.");
        }
#endif
        if (FilesystemEnabled)
        {
            return std::unique_ptr<StorageBase>(new LocalStorage(uri, jailRoot, jailPath));
        }

        LOG_ERR("Local Storage is disabled by default. Enable in the config file or on the command-line to enable.");
    }
    else if (WopiEnabled)
    {
        LOG_INF("Public URI [" << uri.toString() << "] considered WOPI.");
        const auto& targetHost = uri.getHost();
        if (WopiHosts.match(targetHost) || isLocalhost(targetHost))
        {
            return std::unique_ptr<StorageBase>(new WopiStorage(uri, jailRoot, jailPath));
        }

        throw UnauthorizedRequestException("No acceptable WOPI hosts found matching the target host [" + targetHost + "] in config.");
    }

    throw BadRequestException("No Storage configured or invalid URI.");
}

std::atomic<unsigned> LocalStorage::LastLocalStorageId;

LocalStorage::LocalFileInfo LocalStorage::getLocalFileInfo(const Poco::URI& uriPublic)
{
    const auto path = Poco::Path(uriPublic.getPath());
    Log::debug("Getting info for local uri [" + uriPublic.toString() + "], path [" + path.toString() + "].");

    if (!_fileInfo.isValid())
    {
        const auto& filename = path.getFileName();
        const auto file = Poco::File(path);
        const auto lastModified = file.getLastModified();
        const auto size = file.getSize();

        _fileInfo = FileInfo({filename, "localhost", lastModified, size});
    }

    // Set automatic userid and username
    return LocalFileInfo({"localhost", std::string("Local Host #") + std::to_string(LastLocalStorageId++)});
}

std::string LocalStorage::loadStorageFileToLocal()
{
    const auto rootPath = getLocalRootPath();

    // /chroot/jailId/user/doc/childId/file.ext
    const auto filename = Poco::Path(_uri.getPath()).getFileName();
    _jailedFilePath = Poco::Path(rootPath, filename).toString();
    LOG_INF("Public URI [" << _uri.getPath() <<
            "] jailed to [" + _jailedFilePath + "].");

    // Despite the talk about URIs it seems that _uri is actually just a pathname here
    const auto publicFilePath = _uri.getPath();

    if (!FileUtil::checkDiskSpace(publicFilePath))
    {
        throw StorageSpaceLowException("Low disk space for " + publicFilePath);
    }

    LOG_INF("Linking " << publicFilePath << " to " << _jailedFilePath);
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
            LOG_INF("Copying " << publicFilePath << " to " << _jailedFilePath);
            Poco::File(publicFilePath).copyTo(_jailedFilePath);
            _isCopy = true;
        }
    }
    catch (const Poco::Exception& exc)
    {
        Log::error("copyTo(\"" + publicFilePath + "\", \"" + _jailedFilePath + "\") failed: " + exc.displayText());
        throw;
    }

    _isLoaded = true;
    // Now return the jailed path.
    return Poco::Path(_jailPath, filename).toString();
}

StorageBase::SaveResult LocalStorage::saveLocalFileToStorage(const Poco::URI& uriPublic)
{
    try
    {
        // Copy the file back.
        if (_isCopy && Poco::File(_jailedFilePath).exists())
        {
            LOG_INF("Copying " << _jailedFilePath << " to " << uriPublic.getPath());
            Poco::File(_jailedFilePath).copyTo(uriPublic.getPath());
        }
    }
    catch (const Poco::Exception& exc)
    {
        LOG_ERR("copyTo(\"" << _jailedFilePath << "\", \"" << uriPublic.getPath() <<
                "\") failed: " << exc.displayText());
        throw;
    }

    return StorageBase::SaveResult::OK;
}

namespace {

static inline
Poco::Net::HTTPClientSession* getHTTPClientSession(const Poco::URI& uri)
{
    return (LOOLWSD::isSSLEnabled() || LOOLWSD::isSSLTermination()) ? new Poco::Net::HTTPSClientSession(uri.getHost(), uri.getPort(), Poco::Net::SSLManager::instance().defaultClientContext())
                       : new Poco::Net::HTTPClientSession(uri.getHost(), uri.getPort());
}

int getLevenshteinDist(const std::string& string1, const std::string& string2) {
    int matrix[string1.size() + 1][string2.size() + 1];
    std::memset(matrix, 0, sizeof(matrix[0][0]) * (string1.size() + 1) * (string2.size() + 1));

    for (size_t i = 0; i < string1.size() + 1; i++)
    {
        for (size_t j = 0; j < string2.size() + 1; j++)
        {
            if (i == 0)
            {
                matrix[i][j] = j;
            }
            else if (j == 0)
            {
                matrix[i][j] = i;
            }
            else if (string1[i - 1] == string2[j - 1])
            {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else
            {
                matrix[i][j] = 1 + std::min(std::min(matrix[i][j - 1], matrix[i - 1][j]),
                                            matrix[i - 1][j - 1]);
            }
        }
    }

    return matrix[string1.size()][string2.size()];
}

template <typename T>
void getWOPIValue(const Poco::JSON::Object::Ptr &object, const std::string& key, T& value)
{
    std::vector<std::string> propertyNames;
    object->getNames(propertyNames);

    // Check each property name against given key
    // and accept with a mis-spell tolerance of 2
    // TODO: propertyNames can be pruned after getting its value
    for (const auto& userInput: propertyNames)
    {
        std::string string1(key), string2(userInput);
        std::transform(key.begin(), key.end(), string1.begin(), tolower);
        std::transform(userInput.begin(), userInput.end(), string2.begin(), tolower);
        int levDist = getLevenshteinDist(string1, string2);

        if (levDist > 2) /* Mis-spelling tolerance */
            continue;
        else if (levDist > 0 || key != userInput)
        {
            LOG_WRN("Incorrect JSON property [" << userInput << "]. Did you mean " << key << " ?");
            return;
        }

        try
        {
            const Poco::Dynamic::Var valueVar = object->get(userInput);
            value = valueVar.convert<T>();
        }
        catch (const Poco::Exception& exc)
        {
            LOG_ERR("getWOPIValue: " << exc.displayText() <<
                    (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
        }

        return;
    }

    LOG_WRN("Missing JSON property [" << key << "]");
}

} // anonymous namespace

WopiStorage::WOPIFileInfo WopiStorage::getWOPIFileInfo(const Poco::URI& uriPublic)
{
    Log::debug("Getting info for wopi uri [" + uriPublic.toString() + "].");

    const auto startTime = std::chrono::steady_clock::now();
    std::unique_ptr<Poco::Net::HTTPClientSession> psession(getHTTPClientSession(uriPublic));

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, uriPublic.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
    request.set("User-Agent", "LOOLWSD WOPI Agent");
    psession->sendRequest(request);

    Poco::Net::HTTPResponse response;

    std::istream& rs = psession->receiveResponse(response);
    auto logger = Log::trace();
    logger << "WOPI::CheckFileInfo header for URI [" << uriPublic.toString() << "]:\n";
    for (auto& pair : response)
    {
        logger << '\t' + pair.first + ": " + pair.second << " / ";
    }

    logger << Log::end;

    // Parse the response.
    std::string filename;
    size_t size = 0;
    std::string ownerId;
    std::string userId;
    std::string userName;
    bool canWrite = false;
    bool enableOwnerTermination = false;
    std::string postMessageOrigin;
    bool hidePrintOption = false;
    bool hideSaveOption = false;
    bool hideExportOption = false;
    std::string resMsg;
    Poco::StreamCopier::copyToString(rs, resMsg);

    const auto endTime = std::chrono::steady_clock::now();
    const std::chrono::duration<double> callDuration = (endTime - startTime);
    Log::debug("WOPI::CheckFileInfo returned: " + resMsg + ". Call duration: " + std::to_string(callDuration.count()) + "s");
    const auto index = resMsg.find_first_of('{');
    if (index != std::string::npos)
    {
        const std::string stringJSON = resMsg.substr(index);
        Poco::JSON::Parser parser;
        const auto result = parser.parse(stringJSON);
        const auto& object = result.extract<Poco::JSON::Object::Ptr>();
        getWOPIValue(object, "BaseFileName", filename);
        getWOPIValue(object, "Size", size);
        getWOPIValue(object, "OwnerId", ownerId);
        getWOPIValue(object, "UserId", userId);
        getWOPIValue(object, "UserFriendlyName", userName);
        getWOPIValue(object, "UserCanWrite", canWrite);
        getWOPIValue(object, "PostMessageOrigin", postMessageOrigin);
        getWOPIValue(object, "HidePrintOption", hidePrintOption);
        getWOPIValue(object, "HideSaveOption", hideSaveOption);
        getWOPIValue(object, "HideExportOption", hideExportOption);
        getWOPIValue(object, "EnableOwnerTermination", enableOwnerTermination);
    }
    else
        Log::error("WOPI::CheckFileInfo is missing JSON payload");

    if (!_fileInfo.isValid())
    {
        // WOPI doesn't support file last modified time.
        _fileInfo = FileInfo({filename, ownerId, Poco::Timestamp(), size});
    }

    return WOPIFileInfo({userId, userName, canWrite, postMessageOrigin, hidePrintOption, hideSaveOption, hideExportOption, enableOwnerTermination, callDuration});
}

/// uri format: http://server/<...>/wopi*/files/<id>/content
std::string WopiStorage::loadStorageFileToLocal()
{
    // WOPI URI to download files ends in '/contents'.
    // Add it here to get the payload instead of file info.
    Poco::URI uriObject(_uri);
    uriObject.setPath(uriObject.getPath() + "/contents");
    Log::debug("Wopi requesting: " + uriObject.toString());

    const auto startTime = std::chrono::steady_clock::now();
    std::unique_ptr<Poco::Net::HTTPClientSession> psession(getHTTPClientSession(uriObject));

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, uriObject.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
    request.set("User-Agent", "LOOLWSD WOPI Agent");
    psession->sendRequest(request);

    Poco::Net::HTTPResponse response;
    std::istream& rs = psession->receiveResponse(response);

    auto logger = Log::trace();
    logger << "WOPI::GetFile header for URI [" << uriObject.toString() << "]:\n";
    for (auto& pair : response)
    {
        logger << '\t' + pair.first + ": " + pair.second << " / ";
    }

    logger << Log::end;

    _jailedFilePath = Poco::Path(getLocalRootPath(), _fileInfo._filename).toString();
    std::ofstream ofs(_jailedFilePath);
    std::copy(std::istreambuf_iterator<char>(rs),
              std::istreambuf_iterator<char>(),
              std::ostreambuf_iterator<char>(ofs));
    const auto endTime = std::chrono::steady_clock::now();
    const std::chrono::duration<double> diff = (endTime - startTime);
    _wopiLoadDuration += diff;
    const auto size = getFileSize(_jailedFilePath);
    LOG_INF("WOPI::GetFile downloaded " << size << " bytes from [" << uriObject.toString() <<
            "] -> " << _jailedFilePath << " in " << diff.count() << "s : " <<
            response.getStatus() << " " << response.getReason());

    _isLoaded = true;
    // Now return the jailed path.
    return Poco::Path(_jailPath, _fileInfo._filename).toString();
}

StorageBase::SaveResult WopiStorage::saveLocalFileToStorage(const Poco::URI& uriPublic)
{
    LOG_INF("Uploading URI [" << uriPublic.toString() << "] from [" << _jailedFilePath + "].");
    // TODO: Check if this URI has write permission (canWrite = true)
    const auto size = getFileSize(_jailedFilePath);

    Poco::URI uriObject(uriPublic);
    uriObject.setPath(uriObject.getPath() + "/contents");
    Log::debug("Wopi posting: " + uriObject.toString());

    std::unique_ptr<Poco::Net::HTTPClientSession> psession(getHTTPClientSession(uriObject));

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, uriObject.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
    request.set("X-WOPI-Override", "PUT");
    request.setContentType("application/octet-stream");
    request.setContentLength(size);

    std::ostream& os = psession->sendRequest(request);
    std::ifstream ifs(_jailedFilePath);
    Poco::StreamCopier::copyStream(ifs, os);

    Poco::Net::HTTPResponse response;
    std::istream& rs = psession->receiveResponse(response);
    std::ostringstream oss;
    Poco::StreamCopier::copyStream(rs, oss);

    LOG_INF("WOPI::PutFile response: " << oss.str());
    LOG_INF("WOPI::PutFile uploaded " << size << " bytes from [" << _jailedFilePath <<
            "] -> [" << uriObject.toString() << "]: " <<
            response.getStatus() << " " << response.getReason());

    StorageBase::SaveResult saveResult = StorageBase::SaveResult::FAILED;
    if (response.getStatus() == Poco::Net::HTTPResponse::HTTP_OK)
    {
        saveResult = StorageBase::SaveResult::OK;
    }
    else if (response.getStatus() == Poco::Net::HTTPResponse::HTTP_REQUESTENTITYTOOLARGE)
    {
        saveResult = StorageBase::SaveResult::DISKFULL;
    }

    return saveResult;
}

std::string WebDAVStorage::loadStorageFileToLocal()
{
    // TODO: implement webdav GET.
    _isLoaded = true;
    return _uri.toString();
}

StorageBase::SaveResult WebDAVStorage::saveLocalFileToStorage(const Poco::URI& /*uriPublic*/)
{
    // TODO: implement webdav PUT.
    return StorageBase::SaveResult::OK;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
