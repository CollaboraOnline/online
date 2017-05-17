/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include "Storage.hpp"

#include <algorithm>
#include <cassert>
#include <fstream>
#include <string>

#include <Poco/DateTime.h>
#include <Poco/DateTimeParser.h>
#include <Poco/Exception.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/DNS.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/NameValueCollection.h>
#include <Poco/Net/NetworkInterface.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/StreamCopier.h>
#include <Poco/Timestamp.h>

// For residual Poco SSL usage.
#include <Poco/Net/Context.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/KeyConsoleHandler.h>

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

#if ENABLE_SSL
    // FIXME: should use our own SSL socket implementation here.
    Poco::Crypto::initializeCrypto();
    Poco::Net::initializeSSL();

    // Init client
    Poco::Net::Context::Params sslClientParams;

    // TODO: Be more strict and setup SSL key/certs for remove server and us
    sslClientParams.verificationMode = Poco::Net::Context::VERIFY_NONE;

    Poco::SharedPtr<Poco::Net::PrivateKeyPassphraseHandler> consoleClientHandler = new Poco::Net::KeyConsoleHandler(false);
    Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidClientCertHandler = new Poco::Net::AcceptCertificateHandler(false);

    Poco::Net::Context::Ptr sslClientContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslClientParams);
    Poco::Net::SSLManager::instance().initializeClient(consoleClientHandler, invalidClientCertHandler, sslClientContext);
#endif
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
        LOG_WRN("Poco::Net::DNS::resolveOne(\"" << targetHost << "\") failed: " << exc.displayText());
        try
        {
            targetAddress = Poco::Net::IPAddress(targetHost).toString();
        }
        catch (const Poco::Exception& exc1)
        {
            LOG_WRN("Poco::Net::IPAddress(\"" << targetHost << "\") failed: " << exc1.displayText());
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

std::unique_ptr<LocalStorage::LocalFileInfo> LocalStorage::getLocalFileInfo()
{
    const auto path = Poco::Path(_uri.getPath());
    LOG_DBG("Getting info for local uri [" << _uri.toString() << "], path [" << path.toString() << "].");

    const auto& filename = path.getFileName();
    const auto file = Poco::File(path);
    const auto lastModified = file.getLastModified();
    const auto size = file.getSize();

    _fileInfo = FileInfo({filename, "localhost", lastModified, size});

    // Set automatic userid and username
    return std::unique_ptr<LocalStorage::LocalFileInfo>(new LocalFileInfo({"localhost", std::string("Local Host #") + std::to_string(LastLocalStorageId++)}));
}

std::string LocalStorage::loadStorageFileToLocal(const std::string& /*accessToken*/)
{
    // /chroot/jailId/user/doc/childId/file.ext
    const auto filename = Poco::Path(_uri.getPath()).getFileName();
    _jailedFilePath = Poco::Path(getLocalRootPath(), filename).toString();
    LOG_INF("Public URI [" << _uri.getPath() <<
            "] jailed to [" << _jailedFilePath << "].");

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
        LOG_WRN("link(\"" << publicFilePath << "\", \"" << _jailedFilePath << "\") failed. Will copy.");
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
        LOG_ERR("copyTo(\"" << publicFilePath << "\", \"" << _jailedFilePath << "\") failed: " << exc.displayText());
        throw;
    }

    _isLoaded = true;
    // Now return the jailed path.
#ifndef KIT_IN_PROCESS
    if (LOOLWSD::NoCapsForKit)
        return _jailedFilePath;
    else
        return Poco::Path(_jailPath, filename).toString();
#else
    return _jailedFilePath;
#endif
}

StorageBase::SaveResult LocalStorage::saveLocalFileToStorage(const std::string& /*accessToken*/)
{
    try
    {
        // Copy the file back.
        if (_isCopy && Poco::File(_jailedFilePath).exists())
        {
            LOG_INF("Copying " << _jailedFilePath << " to " << _uri.getPath());
            Poco::File(_jailedFilePath).copyTo(_uri.getPath());
        }
    }
    catch (const Poco::Exception& exc)
    {
        LOG_ERR("copyTo(\"" << _jailedFilePath << "\", \"" << _uri.getPath() <<
                "\") failed: " << exc.displayText());
        throw;
    }

    return StorageBase::SaveResult::OK;
}

namespace {

inline
Poco::Net::HTTPClientSession* getHTTPClientSession(const Poco::URI& uri)
{
    // FIXME: if we're configured for http - we can still use an https:// wopi
    // host surely; of course - the converse is not true / sensible.
    return (LOOLWSD::isSSLEnabled() || LOOLWSD::isSSLTermination())
        ? new Poco::Net::HTTPSClientSession(uri.getHost(), uri.getPort(),
                                            Poco::Net::SSLManager::instance().defaultClientContext())
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

void setQueryParameter(Poco::URI& uriObject, const std::string& key, const std::string& value)
{
    Poco::URI::QueryParameters queryParams = uriObject.getQueryParameters();
    for (auto& param: queryParams)
    {
        if (param.first == key)
        {
            param.second = value;
            uriObject.setQueryParameters(queryParams);
            return;
        }
    }

    // it did not exist yet
    uriObject.addQueryParameter(key, value);
}


void addStorageDebugCookie(Poco::Net::HTTPRequest& request)
{
#if ENABLE_DEBUG
    if (std::getenv("LOOL_STORAGE_COOKIE"))
    {
        Poco::Net::NameValueCollection nvcCookies;
        std::vector<std::string> cookieTokens = LOOLProtocol::tokenize(std::string(std::getenv("LOOL_STORAGE_COOKIE")), ':');
        if (cookieTokens.size() == 2)
        {
            nvcCookies.add(cookieTokens[0], cookieTokens[1]);
            request.setCookies(nvcCookies);
            LOG_TRC("Added storage debug cookie [" << cookieTokens[0] << "=" << cookieTokens[1] << "].");
        }
    }
#endif
}

} // anonymous namespace

std::unique_ptr<WopiStorage::WOPIFileInfo> WopiStorage::getWOPIFileInfo(const std::string& accessToken)
{
    // update the access_token to the one matching to the session
    Poco::URI uriObject(_uri);
    setQueryParameter(uriObject, "access_token", accessToken);

    LOG_DBG("Getting info for wopi uri [" << uriObject.toString() << "].");

    std::string resMsg;
    const auto startTime = std::chrono::steady_clock::now();
    std::chrono::duration<double> callDuration(0);
    try
    {
        std::unique_ptr<Poco::Net::HTTPClientSession> psession(getHTTPClientSession(uriObject));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, uriObject.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
        request.set("User-Agent", "LOOLWSD WOPI Agent");
        addStorageDebugCookie(request);
        psession->sendRequest(request);

        Poco::Net::HTTPResponse response;
        std::istream& rs = psession->receiveResponse(response);
        callDuration = (std::chrono::steady_clock::now() - startTime);

        auto logger = Log::trace();
        if (logger.enabled())
        {
            logger << "WOPI::CheckFileInfo header for URI [" << uriObject.toString() << "]:\n";
            for (const auto& pair : response)
            {
                logger << '\t' << pair.first << ": " << pair.second << " / ";
            }

            LOG_END(logger);
        }

        if (response.getStatus() != Poco::Net::HTTPResponse::HTTP_OK)
        {
            LOG_ERR("WOPI::CheckFileInfo failed with " << response.getStatus() << ' ' << response.getReason());
            throw StorageConnectionException("WOPI::CheckFileInfo failed");
        }

        Poco::StreamCopier::copyToString(rs, resMsg);
    }
    catch(const Poco::Exception& pexc)
    {
        LOG_ERR("Cannot get file info from WOPI storage uri [" << uriObject.toString() << "]. Error: " << pexc.displayText() <<
                (pexc.nested() ? " (" + pexc.nested()->displayText() + ")" : ""));
        throw;
    }

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
    bool disablePrint = false;
    bool disableExport = false;
    bool disableCopy = false;
    std::string lastModifiedTime;

    LOG_DBG("WOPI::CheckFileInfo returned: " << resMsg << ". Call duration: " << callDuration.count() << "s");
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
        getWOPIValue(object, "DisablePrint", disablePrint);
        getWOPIValue(object, "DisableExport", disableExport);
        getWOPIValue(object, "DisableCopy", disableCopy);
        getWOPIValue(object, "LastModifiedTime", lastModifiedTime);
    }
    else
    {
        LOG_ERR("WOPI::CheckFileInfo failed and no JSON payload returned. Access denied.");
        throw UnauthorizedRequestException("Access denied. WOPI::CheckFileInfo failed on: " + uriObject.toString());
    }

    Poco::Timestamp modifiedTime = Poco::Timestamp::fromEpochTime(0);
    if (lastModifiedTime != "")
    {
        Poco::DateTime dateTime;
        int timeZoneDifferential;
        bool valid = false;
        try
        {
            Poco::DateTimeParser::parse(Poco::DateTimeFormat::ISO8601_FRAC_FORMAT, lastModifiedTime, dateTime, timeZoneDifferential);
            valid = true;
        }
        catch (const Poco::SyntaxException& exc)
        {
            LOG_WRN("LastModifiedTime property [" << lastModifiedTime << "] was invalid format: " << exc.displayText() <<
                    (exc.nested() ? " (" + exc.nested()->displayText() + ")" : ""));
        }
        if (valid)
        {
            modifiedTime = dateTime.timestamp();
        }
    }

    _fileInfo = FileInfo({filename, ownerId, modifiedTime, size});

    return std::unique_ptr<WopiStorage::WOPIFileInfo>(new WOPIFileInfo({userId, userName, canWrite, postMessageOrigin, hidePrintOption, hideSaveOption, hideExportOption, enableOwnerTermination, disablePrint, disableExport, disableCopy, callDuration}));
}

/// uri format: http://server/<...>/wopi*/files/<id>/content
std::string WopiStorage::loadStorageFileToLocal(const std::string& accessToken)
{
    // WOPI URI to download files ends in '/contents'.
    // Add it here to get the payload instead of file info.
    Poco::URI uriObject(_uri);
    uriObject.setPath(uriObject.getPath() + "/contents");
    setQueryParameter(uriObject, "access_token", accessToken);
    LOG_DBG("Wopi requesting: " << uriObject.toString());

    const auto startTime = std::chrono::steady_clock::now();
    try
    {
        std::unique_ptr<Poco::Net::HTTPClientSession> psession(getHTTPClientSession(uriObject));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, uriObject.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
        request.set("User-Agent", "LOOLWSD WOPI Agent");
        addStorageDebugCookie(request);
        psession->sendRequest(request);

        Poco::Net::HTTPResponse response;
        std::istream& rs = psession->receiveResponse(response);
        const std::chrono::duration<double> diff = (std::chrono::steady_clock::now() - startTime);
        _wopiLoadDuration += diff;

        auto logger = Log::trace();
        if (logger.enabled())
        {
            logger << "WOPI::GetFile header for URI [" << uriObject.toString() << "]:\n";
            for (const auto& pair : response)
            {
                logger << '\t' << pair.first << ": " << pair.second << " / ";
            }

            LOG_END(logger);
        }

        if (response.getStatus() != Poco::Net::HTTPResponse::HTTP_OK)
        {
            LOG_ERR("WOPI::GetFile failed with " << response.getStatus() << ' ' << response.getReason());
            throw StorageConnectionException("WOPI::GetFile failed");
        }
        else // Successful
        {
            _jailedFilePath = Poco::Path(getLocalRootPath(), _fileInfo._filename).toString();
            std::ofstream ofs(_jailedFilePath);
            std::copy(std::istreambuf_iterator<char>(rs),
                      std::istreambuf_iterator<char>(),
                      std::ostreambuf_iterator<char>(ofs));
            LOG_INF("WOPI::GetFile downloaded " << getFileSize(_jailedFilePath) << " bytes from [" << uriObject.toString() <<
                    "] -> " << _jailedFilePath << " in " << diff.count() << "s");

            _isLoaded = true;
            // Now return the jailed path.
            return Poco::Path(_jailPath, _fileInfo._filename).toString();
        }
    }
    catch(const Poco::Exception& pexc)
    {
        LOG_ERR("Cannot load document from WOPI storage uri [" + uriObject.toString() + "]. Error: " << pexc.displayText() <<
                (pexc.nested() ? " (" + pexc.nested()->displayText() + ")" : ""));
        throw;
    }

    return "";
}

StorageBase::SaveResult WopiStorage::saveLocalFileToStorage(const std::string& accessToken)
{
    // TODO: Check if this URI has write permission (canWrite = true)
    const auto size = getFileSize(_jailedFilePath);

    Poco::URI uriObject(_uri);
    uriObject.setPath(uriObject.getPath() + "/contents");
    setQueryParameter(uriObject, "access_token", accessToken);

    LOG_INF("Uploading URI via WOPI [" << uriObject.toString() << "] from [" << _jailedFilePath + "].");

    std::ostringstream oss;
    StorageBase::SaveResult saveResult = StorageBase::SaveResult::FAILED;
    try
    {
        std::unique_ptr<Poco::Net::HTTPClientSession> psession(getHTTPClientSession(uriObject));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, uriObject.getPathAndQuery(), Poco::Net::HTTPMessage::HTTP_1_1);
        request.set("X-WOPI-Override", "PUT");
        request.setContentType("application/octet-stream");
        request.setContentLength(size);
        addStorageDebugCookie(request);
        std::ostream& os = psession->sendRequest(request);
        std::ifstream ifs(_jailedFilePath);
        Poco::StreamCopier::copyStream(ifs, os);

        Poco::Net::HTTPResponse response;
        std::istream& rs = psession->receiveResponse(response);
        Poco::StreamCopier::copyStream(rs, oss);
        LOG_INF("WOPI::PutFile response: " << oss.str());
        LOG_INF("WOPI::PutFile uploaded " << size << " bytes from [" << _jailedFilePath <<
                "] -> [" << uriObject.toString() << "]: " <<
                response.getStatus() << " " << response.getReason());

        if (response.getStatus() == Poco::Net::HTTPResponse::HTTP_OK)
        {
            saveResult = StorageBase::SaveResult::OK;
        }
        else if (response.getStatus() == Poco::Net::HTTPResponse::HTTP_REQUESTENTITYTOOLARGE)
        {
            saveResult = StorageBase::SaveResult::DISKFULL;
        }
    }
    catch(const Poco::Exception& pexc)
    {
        LOG_ERR("Cannot save file to WOPI storage uri [" + uriObject.toString() + "]. Error: " << pexc.displayText() <<
                (pexc.nested() ? " (" + pexc.nested()->displayText() + ")" : ""));
        saveResult = StorageBase::SaveResult::FAILED;
    }

    return saveResult;
}

std::string WebDAVStorage::loadStorageFileToLocal(const std::string& /*accessToken*/)
{
    // TODO: implement webdav GET.
    _isLoaded = true;
    return _uri.toString();
}

StorageBase::SaveResult WebDAVStorage::saveLocalFileToStorage(const std::string& /*accessToken*/)
{
    // TODO: implement webdav PUT.
    return StorageBase::SaveResult::OK;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
