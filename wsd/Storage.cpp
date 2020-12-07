/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <chrono>
#include <config.h>

#include "Storage.hpp"

#include <algorithm>
#include <memory>
#include <cassert>
#include <errno.h>
#include <fstream>
#include <iconv.h>
#include <string>

#include <Poco/Exception.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>

#if !MOBILEAPP

#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/Context.h>
#include <Poco/Net/DNS.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/NameValueCollection.h>
#include <Poco/Net/NetworkInterface.h>
#include <Poco/Net/SSLManager.h>

#endif

#include <Poco/StreamCopier.h>
#include <Poco/URI.h>

#include "Auth.hpp"
#include <Common.hpp>
#include "Exceptions.hpp"
#include <Log.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include "ProofKey.hpp"
#include <common/FileUtil.hpp>
#include <common/JsonUtil.hpp>

#ifdef IOS
#include <ios.h>
#endif

using std::size_t;

bool StorageBase::FilesystemEnabled;
bool StorageBase::WopiEnabled;
bool StorageBase::SSLAsScheme = true;
bool StorageBase::SSLEnabled = false;
Util::RegexListMatcher StorageBase::WopiHosts;

#if !MOBILEAPP

std::string StorageBase::getLocalRootPath() const
{
    std::string localPath = _jailPath;
    if (localPath[0] == '/')
    {
        // Remove the leading /
        localPath.erase(0, 1);
    }

    // /chroot/jailId/user/doc/childId
    const Poco::Path rootPath = Poco::Path(_localStorePath, localPath);
    Poco::File(rootPath).createDirectories();

    return rootPath.toString();
}

#endif

void StorageBase::initialize()
{
#if !MOBILEAPP
    const auto& app = Poco::Util::Application::instance();
    FilesystemEnabled = app.config().getBool("storage.filesystem[@allow]", false);

    // Parse the WOPI settings.
    WopiHosts.clear();
    WopiEnabled = app.config().getBool("storage.wopi[@allow]", false);
    if (WopiEnabled)
    {
        for (size_t i = 0; ; ++i)
        {
            const std::string path = "storage.wopi.host[" + std::to_string(i) + ']';
            const std::string host = app.config().getString(path, "");
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

    // false default for upgrade to preserve legacy configuration
    // in-config-file defaults are true.
    SSLAsScheme = LOOLWSD::getConfigValue<bool>("storage.ssl.as_scheme", false);

    // Fallback to ssl.enable if not set - for back compatibility & simplicity.
    SSLEnabled = LOOLWSD::getConfigValue<bool>(
        "storage.ssl.enable", LOOLWSD::getConfigValue<bool>("ssl.enable", true));

#if ENABLE_DEBUG
    char *StorageSSLEnabled = getenv("STORAGE_SSL_ENABLE");
    if (StorageSSLEnabled != NULL)
    {
        if (!strcasecmp(StorageSSLEnabled, "true"))
            SSLEnabled = true;
        else if (!strcasecmp(StorageSSLEnabled, "false"))
            SSLEnabled = false;
    }
#endif

    if (SSLEnabled)
    {
        sslClientParams.certificateFile = LOOLWSD::getPathFromConfigWithFallback("storage.ssl.cert_file_path", "ssl.cert_file_path");
        sslClientParams.privateKeyFile = LOOLWSD::getPathFromConfigWithFallback("storage.ssl.key_file_path", "ssl.key_file_path");
        sslClientParams.caLocation = LOOLWSD::getPathFromConfigWithFallback("storage.ssl.ca_file_path", "ssl.ca_file_path");
        sslClientParams.cipherList = LOOLWSD::getPathFromConfigWithFallback("storage.ssl.cipher_list", "ssl.cipher_list");

        sslClientParams.verificationMode = (sslClientParams.caLocation.empty() ? Poco::Net::Context::VERIFY_NONE : Poco::Net::Context::VERIFY_STRICT);
        sslClientParams.loadDefaultCAs = true;
    }
    else
        sslClientParams.verificationMode = Poco::Net::Context::VERIFY_NONE;

    Poco::SharedPtr<Poco::Net::PrivateKeyPassphraseHandler> consoleClientHandler = new Poco::Net::KeyConsoleHandler(false);
    Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidClientCertHandler = new Poco::Net::AcceptCertificateHandler(false);

    Poco::Net::Context::Ptr sslClientContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslClientParams);
    sslClientContext->disableProtocols(Poco::Net::Context::Protocols::PROTO_SSLV2 |
                                       Poco::Net::Context::Protocols::PROTO_SSLV3 |
                                       Poco::Net::Context::Protocols::PROTO_TLSV1);
    Poco::Net::SSLManager::instance().initializeClient(consoleClientHandler, invalidClientCertHandler, sslClientContext);
#endif
#else
    FilesystemEnabled = true;
#endif
}

bool StorageBase::allowedWopiHost(const std::string& host)
{
    return WopiEnabled && WopiHosts.match(host);
}

#if !MOBILEAPP

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

#endif

std::unique_ptr<StorageBase> StorageBase::create(const Poco::URI& uri, const std::string& jailRoot, const std::string& jailPath)
{
    // FIXME: By the time this gets called we have already sent to the client three
    // 'statusindicator:' messages: 'find', 'connect' and 'ready'. We should ideally do the checks
    // here much earlier. Also, using exceptions is lame and makes understanding the code harder,
    // but that is just my personal preference.

    std::unique_ptr<StorageBase> storage;

    if (UnitWSD::get().createStorage(uri, jailRoot, jailPath, storage))
    {
        LOG_INF("Storage create hooked.");
        if (storage)
        {
            return storage;
        }
    }
    else if (uri.isRelative() || uri.getScheme() == "file")
    {
        LOG_INF("Public URI [" << LOOLWSD::anonymizeUrl(uri.toString()) << "] is a file.");

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
        else
        {
            // guard against attempts to escape
            Poco::URI normalizedUri(uri);
            normalizedUri.normalize();

            std::vector<std::string> pathSegments;
            normalizedUri.getPathSegments(pathSegments);

            if (pathSegments.size() == 4 && pathSegments[0] == "tmp" && pathSegments[1] == "convert-to")
            {
                LOG_INF("Public URI [" << LOOLWSD::anonymizeUrl(normalizedUri.toString()) << "] is actually a convert-to tempfile.");
                return std::unique_ptr<StorageBase>(new LocalStorage(normalizedUri, jailRoot, jailPath));
            }
        }

        LOG_ERR("Local Storage is disabled by default. Enable in the config file or on the command-line to enable.");
    }
#if !MOBILEAPP
    else if (WopiEnabled)
    {
        LOG_INF("Public URI [" << LOOLWSD::anonymizeUrl(uri.toString()) << "] considered WOPI.");
        const auto& targetHost = uri.getHost();
        bool allowed(false);
        if (WopiHosts.match(targetHost) || isLocalhost(targetHost))
        {
            allowed = true;
        }
        if (!allowed)
        {
            // check if the IP address is in the list of allowed hosts
            const auto hostAddresses(Poco::Net::DNS::resolve(targetHost));
            for (auto &address : hostAddresses.addresses())
            {
                if (WopiHosts.match(address.toString()))
                {
                    allowed = true;
                    break;
                }
            }
        }
        if (allowed)
            return std::unique_ptr<StorageBase>(new WopiStorage(uri, jailRoot, jailPath));
        LOG_ERR("No acceptable WOPI hosts found matching the target host [" << targetHost << "] in config.");
        throw UnauthorizedRequestException("No acceptable WOPI hosts found matching the target host [" + targetHost + "] in config.");
    }
#endif
    throw BadRequestException("No Storage configured or invalid URI.");
}

std::atomic<unsigned> LocalStorage::LastLocalStorageId;

std::unique_ptr<LocalStorage::LocalFileInfo> LocalStorage::getLocalFileInfo()
{
    const Poco::Path path = Poco::Path(getUri().getPath());
    LOG_DBG("Getting info for local uri [" << LOOLWSD::anonymizeUrl(getUri().toString()) << "], path [" << LOOLWSD::anonymizeUrl(path.toString()) << "].");

    std::string str_path = path.toString();
    const auto& filename = path.getFileName();
    const Poco::File file = Poco::File(path);
    std::chrono::system_clock::time_point lastModified = Util::getFileTimestamp(str_path);
    const size_t size = file.getSize();

    setFileInfo(FileInfo({filename, "localhost", lastModified, size}));

    // Set automatic userid and username
    std::string userNameString;

#ifdef IOS
    if (user_name != nullptr)
        userNameString = std::string(user_name);
#endif
    if (userNameString.size() == 0)
        userNameString = "LocalHost#" + std::to_string(LastLocalStorageId++);

    return std::unique_ptr<LocalStorage::LocalFileInfo>(new LocalFileInfo({"localhost" + std::to_string(LastLocalStorageId), userNameString}));
}

std::string LocalStorage::downloadStorageFileToLocal(const Authorization& /*auth*/,
                                                     const std::string& /*cookies*/,
                                                     LockContext& /*lockCtx*/,
                                                     const std::string& /*templateUri*/)
{
#if !MOBILEAPP
    // /chroot/jailId/user/doc/childId/file.ext
    const std::string filename = Poco::Path(getUri().getPath()).getFileName();
    setRootFilePath(Poco::Path(getLocalRootPath(), filename).toString());
    setRootFilePathAnonym(LOOLWSD::anonymizeUrl(getRootFilePath()));
    LOG_INF("Public URI [" << LOOLWSD::anonymizeUrl(getUri().getPath()) <<
            "] jailed to [" << getRootFilePathAnonym() << "].");

    // Despite the talk about URIs it seems that _uri is actually just a pathname here
    const std::string publicFilePath = getUri().getPath();

    if (!FileUtil::checkDiskSpace(getRootFilePath()))
    {
        throw StorageSpaceLowException("Low disk space for " + getRootFilePathAnonym());
    }

    LOG_INF("Linking " << LOOLWSD::anonymizeUrl(publicFilePath) << " to " << getRootFilePathAnonym());
    if (!Poco::File(getRootFilePath()).exists() && link(publicFilePath.c_str(), getRootFilePath().c_str()) == -1)
    {
        // Failed
        LOG_WRN("link(\"" << LOOLWSD::anonymizeUrl(publicFilePath) << "\", \"" << getRootFilePathAnonym() << "\") failed. Will copy. "
                "Linking error: " << Util::symbolicErrno(errno) << ' ' << strerror(errno));
    }

    try
    {
        // Fallback to copying.
        if (!Poco::File(getRootFilePath()).exists())
        {
            FileUtil::copyFileTo(publicFilePath, getRootFilePath());
            _isCopy = true;
        }
    }
    catch (const Poco::Exception& exc)
    {
        LOG_ERR("copyTo(\"" << LOOLWSD::anonymizeUrl(publicFilePath) << "\", \""
                            << getRootFilePathAnonym() << "\") failed: " << exc.displayText());
        throw;
    }

    setLoaded(true);
    // Now return the jailed path.
#ifndef KIT_IN_PROCESS
    if (LOOLWSD::NoCapsForKit)
        return getRootFilePath();
    else
        return Poco::Path(getJailPath(), filename).toString();
#else
    return getRootFilePath();
#endif

#else // MOBILEAPP

    // In the mobile app we use no jail
    setRootFilePath(getUri().getPath());
    setLoaded(true);

    return getRootFilePath();
#endif
}

StorageBase::UploadResult LocalStorage::uploadLocalFileToStorage(
    const Authorization& /*auth*/, const std::string& /*cookies*/, LockContext& /*lockCtx*/,
    const std::string& /*saveAsPath*/, const std::string& /*saveAsFilename*/, bool /*isRename*/)
{
    try
    {
        LOG_TRC("Copying local file to local file storage (isCopy: " << _isCopy << ") for "
                                                                     << getRootFilePathAnonym());

        // Copy the file back.
        if (_isCopy && Poco::File(getRootFilePath()).exists())
            FileUtil::copyFileTo(getRootFilePath(), getUri().getPath());

        // update its fileinfo object. This is used later to check if someone else changed the
        // document while we are/were editing it
        const Poco::Path path = Poco::Path(getUri().getPath());
        std::string str_path = path.toString();
        getFileInfo().setModifiedTime(Util::getFileTimestamp(str_path));
        LOG_TRC("New FileInfo modified time in storage " << getFileInfo().getModifiedTime());
    }
    catch (const Poco::Exception& exc)
    {
        LOG_ERR("copyTo(\"" << getRootFilePathAnonym() << "\", \"" << LOOLWSD::anonymizeUrl(getUri().getPath())
                            << "\") failed: " << exc.displayText());
        return StorageBase::UploadResult::Result::FAILED;
    }

    return StorageBase::UploadResult::Result::OK;
}

#if !MOBILEAPP

Poco::Net::HTTPClientSession* StorageBase::getHTTPClientSession(const Poco::URI& uri)
{
    bool useSSL = false;
    if (SSLAsScheme)
    {
        // the WOPI URI itself should control whether we use SSL or not
        // for whether we verify vs. certificates, cf. above
        useSSL = uri.getScheme() != "http";
    }
    else
    {
        // We decoupled the Wopi communication from client communication because
        // the Wopi communication must have an independent policy.
        // So, we will use here only Storage settings.
        useSSL = SSLEnabled || LOOLWSD::isSSLTermination();
    }
    // We decoupled the Wopi communication from client communication because
    // the Wopi communication must have an independent policy.
    // So, we will use here only Storage settings.
    Poco::Net::HTTPClientSession* session = useSSL
        ? new Poco::Net::HTTPSClientSession(uri.getHost(), uri.getPort(),
                                            Poco::Net::SSLManager::instance().defaultClientContext())
        : new Poco::Net::HTTPClientSession(uri.getHost(), uri.getPort());

    // Set the timeout to the configured value.
    static int timeoutSec = LOOLWSD::getConfigValue<int>("net.connection_timeout_secs", 30);
    session->setTimeout(Poco::Timespan(timeoutSec, 0));

    return session;
}

namespace
{

static void addStorageDebugCookie(Poco::Net::HTTPRequest& request)
{
    (void) request;
#if ENABLE_DEBUG
    if (std::getenv("LOOL_STORAGE_COOKIE"))
    {
        Poco::Net::NameValueCollection nvcCookies;
        StringVector cookieTokens = Util::tokenize(std::string(std::getenv("LOOL_STORAGE_COOKIE")), ':');
        if (cookieTokens.size() == 2)
        {
            nvcCookies.add(cookieTokens[0], cookieTokens[1]);
            request.setCookies(nvcCookies);
            LOG_TRC("Added storage debug cookie [" << cookieTokens[0] << '=' << cookieTokens[1] << "].");
        }
    }
#endif
}

static void addStorageReuseCookie(Poco::Net::HTTPRequest& request, const std::string& reuseStorageCookies)
{
    if (!reuseStorageCookies.empty())
    {

        Poco::Net::NameValueCollection nvcCookies;
        request.getCookies(nvcCookies); // Preserve existing cookies.

        StringVector cookies = Util::tokenize(reuseStorageCookies, ':');
        LOG_TRC("Parsing reuse cookies to set in Wopi request ["
                << reuseStorageCookies << "], found " << cookies.size() << " cookies.");
        for (auto cookie : cookies)
        {
            StringVector cookieTokens = Util::tokenize(cookies.getParam(cookie), '=');
            if (cookieTokens.size() == 2)
            {
                nvcCookies.add(cookieTokens[0], cookieTokens[1]);
                LOG_DBG("Added storage reuse cookie [" << cookieTokens[0] << '=' << cookieTokens[1] << "].");
            }
        }

        request.setCookies(nvcCookies);
    }
}

// access_token must be decoded
void addWopiProof(Poco::Net::HTTPRequest& request, const Poco::URI& uri,
                  const std::string& access_token)
{
    assert(!uri.isRelative());
    for (const auto& header : GetProofHeaders(access_token, uri.toString()))
        request.set(header.first, header.second);
}

std::map<std::string, std::string> GetQueryParams(const Poco::URI& uri)
{
    std::map<std::string, std::string> result;
    for (const auto& param : uri.getQueryParameters())
        result.emplace(param);
    return result;
}

} // anonymous namespace

#endif // !MOBILEAPP

void LockContext::initSupportsLocks()
{
#if MOBILEAPP
    _supportsLocks = false;
#else
    if (_supportsLocks)
        return;

    // first time token setup
    _supportsLocks = true;
    _lockToken = "lool-lock" + Util::rng::getHexString(8);
#endif
}

bool LockContext::needsRefresh(const std::chrono::steady_clock::time_point &now) const
{
    static int refreshSeconds = LOOLWSD::getConfigValue<int>("storage.wopi.locking.refresh", 900);
    return _supportsLocks && _isLocked && refreshSeconds > 0 &&
        std::chrono::duration_cast<std::chrono::seconds>
        (now - _lastLockTime).count() >= refreshSeconds;
}

void LockContext::dumpState(std::ostream& os) const
{
    if (!_supportsLocks)
        return;
    os << "  lock:"
          "\n    locked: " << _isLocked;
    os << "\n    token: '" << _lockToken;
    os << "\n    last locked: " << Util::getSteadyClockAsString(_lastLockTime) << '\n';
}

#if !MOBILEAPP

void WopiStorage::initHttpRequest(Poco::Net::HTTPRequest& request, const Poco::URI& uri,
                                  const Authorization& auth, const std::string& cookies) const
{
    request.set("User-Agent", WOPI_AGENT_STRING);

    auth.authorizeRequest(request);

    addStorageDebugCookie(request);

    // TODO: Avoid repeated parsing.
    std::map<std::string, std::string> params = GetQueryParams(uri);
    const auto it = params.find("access_token");
    if (it != params.end())
        addWopiProof(request, uri, it->second);

    if (_reuseCookies)
        addStorageReuseCookie(request, cookies);

    // Helps wrt. debugging cluster cases from the logs
    request.set("X-LOOL-WOPI-ServerId", Util::getProcessIdentifier());
}

std::unique_ptr<WopiStorage::WOPIFileInfo> WopiStorage::getWOPIFileInfo(const Authorization& auth,
                                                                        const std::string& cookies,
                                                                        LockContext& lockCtx)
{
    // update the access_token to the one matching to the session
    Poco::URI uriObject(getUri());
    auth.authorizeURI(uriObject);
    const std::string uriAnonym = LOOLWSD::anonymizeUrl(uriObject.toString());

    LOG_DBG("Getting info for wopi uri [" << uriAnonym << "].");

    std::string wopiResponse;
    std::chrono::milliseconds callDurationMs;
    try
    {
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET,
                                       uriObject.getPathAndQuery(),
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        initHttpRequest(request, uriObject, auth, cookies);

        const auto startTime = std::chrono::steady_clock::now();

        std::unique_ptr<Poco::Net::HTTPClientSession> psession(getHTTPClientSession(uriObject));
        Log::StreamLogger logger = Log::trace();
        if (logger.enabled())
        {
            logger << "WOPI::CheckFileInfo request header for URI [" << uriAnonym << "]:\n";
            for (const auto& pair : request)
            {
                logger << '\t' << pair.first << ": " << pair.second << " / ";
            }

            LOG_END(logger, true);
        }

        psession->sendRequest(request);

        Poco::Net::HTTPResponse response;
        std::istream& rs = psession->receiveResponse(response);
        callDurationMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - startTime);

        Log::StreamLogger logRes = Log::trace();
        if (logRes.enabled())
        {
            logRes << "WOPI::CheckFileInfo response header for URI [" << uriAnonym
                   << "]: " << response.getStatus() << '\n';
            for (const auto& pair : response)
            {
                logRes << '\t' << pair.first << ": " << pair.second << " / ";
            }

            LOG_END(logRes, true);
        }

        if (response.getStatus() != Poco::Net::HTTPResponse::HTTP_OK)
        {
            LOG_ERR("WOPI::CheckFileInfo failed with " << response.getStatus() << ' ' << response.getReason());
            throw StorageConnectionException("WOPI::CheckFileInfo failed");
        }

        Poco::StreamCopier::copyToString(rs, wopiResponse);
    }
    catch (const Poco::Exception& pexc)
    {
        LOG_ERR("Cannot get file info from WOPI storage uri [" << uriAnonym << "]. Error: " <<
                pexc.displayText() << (pexc.nested() ? " (" + pexc.nested()->displayText() + ')' : ""));
        throw;
    }
    catch (const BadRequestException& exc)
    {
        LOG_ERR("Cannot get file info from WOPI storage uri [" << uriAnonym << "]. Error: " << exc.what());
    }

    Poco::JSON::Object::Ptr object;
    if (JsonUtil::parseJSON(wopiResponse, object))
    {
        if (LOOLWSD::AnonymizeUserData)
            LOG_DBG("WOPI::CheckFileInfo (" << callDurationMs << "): anonymizing...");
        else
            LOG_DBG("WOPI::CheckFileInfo (" << callDurationMs << "): " << wopiResponse);

        size_t size = 0;
        std::string filename, ownerId, lastModifiedTime;

        JsonUtil::findJSONValue(object, "Size", size);
        JsonUtil::findJSONValue(object, "OwnerId", ownerId);
        JsonUtil::findJSONValue(object, "BaseFileName", filename);
        JsonUtil::findJSONValue(object, "LastModifiedTime", lastModifiedTime);

        const std::chrono::system_clock::time_point modifiedTime = Util::iso8601ToTimestamp(lastModifiedTime, "LastModifiedTime");
        FileInfo fileInfo = FileInfo({filename, ownerId, modifiedTime, size});
        setFileInfo(fileInfo);

        if (LOOLWSD::AnonymizeUserData)
            Util::mapAnonymized(Util::getFilenameFromURL(filename), Util::getFilenameFromURL(getUri().toString()));

        auto wopiInfo = Util::make_unique<WopiStorage::WOPIFileInfo>(fileInfo, callDurationMs, object);
        if (wopiInfo->getSupportsLocks())
            lockCtx.initSupportsLocks();

        // If FileUrl is set, we use it for GetFile.
        _fileUrl = wopiInfo->getFileUrl();

        return wopiInfo;
    }
    else
    {
        if (LOOLWSD::AnonymizeUserData)
            wopiResponse = "obfuscated";

        LOG_ERR("WOPI::CheckFileInfo ("
                << callDurationMs
                << ") failed or no valid JSON payload returned. Access denied. Original response: ["
                << wopiResponse << "].");

        throw UnauthorizedRequestException("Access denied. WOPI::CheckFileInfo failed on: " + uriAnonym);
    }
}

void WopiStorage::WOPIFileInfo::init()
{
    _userCanWrite = false;
    _enableOwnerTermination = false;
    _hidePrintOption = false;
    _hideSaveOption = false;
    _hideExportOption = false;
    _disablePrint = false;
    _disableExport = false;
    _disableCopy = false;
    _disableInactiveMessages = false;
    _downloadAsPostMessage = false;
    _userCanNotWriteRelative = true;
    _enableInsertRemoteImage = false;
    _enableShare = false;
    _supportsLocks = false;
    _supportsRename = false;
    _userCanRename = false;
    _hideUserList = "false";
    _disableChangeTrackingRecord = WOPIFileInfo::TriState::Unset;
    _disableChangeTrackingShow = WOPIFileInfo::TriState::Unset;
    _hideChangeTrackingControls = WOPIFileInfo::TriState::Unset;
}

WopiStorage::WOPIFileInfo::WOPIFileInfo(const FileInfo &fileInfo,
                                        std::chrono::milliseconds callDurationMs,
                                        Poco::JSON::Object::Ptr &object)
{
    init();

    const std::string &filename = fileInfo.getFilename();
    const std::string &ownerId = fileInfo.getOwnerId();

    JsonUtil::findJSONValue(object, "UserId", _userId);
    JsonUtil::findJSONValue(object, "UserFriendlyName", _username);
    JsonUtil::findJSONValue(object, "TemplateSaveAs", _templateSaveAs);
    JsonUtil::findJSONValue(object, "TemplateSource", _templateSource);

    // UserFriendlyName is used as the Author when loading the document.
    // If it's missing, document loading fails. Since the UserFriendlyName
    // field is optional in WOPI specs, it's often left out by integrators.
    if (_username.empty())
    {
        _username = "UnknownUser"; // Default to something sensible yet friendly.
        if (!_userId.empty())
            _username += '_' + _userId;

        LOG_WRN("WOPI::CheckFileInfo does not specify a valid UserFriendlyName for the current "
                "user. Temporarily ["
                << _username << "] will be used until a valid name is specified.");
    }

    std::ostringstream wopiResponse;

    // Anonymize key values.
    if (LOOLWSD::AnonymizeUserData)
    {
        JsonUtil::findJSONValue(object, "ObfuscatedUserId", _obfuscatedUserId, false);
        if (!_obfuscatedUserId.empty())
        {
            Util::mapAnonymized(ownerId, _obfuscatedUserId);
            Util::mapAnonymized(_userId, _obfuscatedUserId);
            Util::mapAnonymized(_username, _obfuscatedUserId);
        }

        Poco::JSON::Object::Ptr anonObject(object);

        // Set anonymized version of the above fields before logging.
        // Note: anonymization caches the result, so we don't need to store here.
        if (LOOLWSD::AnonymizeUserData)
            anonObject->set("BaseFileName", LOOLWSD::anonymizeUrl(filename));

        // If obfuscatedUserId is provided, then don't log the originals and use it.
        if (LOOLWSD::AnonymizeUserData && _obfuscatedUserId.empty())
        {
            anonObject->set("OwnerId", LOOLWSD::anonymizeUsername(ownerId));
            anonObject->set("UserId", LOOLWSD::anonymizeUsername(_userId));
            anonObject->set("UserFriendlyName", LOOLWSD::anonymizeUsername(_username));
        }
        anonObject->stringify(wopiResponse);
    }
    else
        object->stringify(wopiResponse);

    LOG_DBG("WOPI::CheckFileInfo (" << callDurationMs << "): " << wopiResponse.str());

    JsonUtil::findJSONValue(object, "UserExtraInfo", _userExtraInfo);
    JsonUtil::findJSONValue(object, "WatermarkText", _watermarkText);
    JsonUtil::findJSONValue(object, "UserCanWrite", _userCanWrite);
    JsonUtil::findJSONValue(object, "PostMessageOrigin", _postMessageOrigin);
    JsonUtil::findJSONValue(object, "HidePrintOption", _hidePrintOption);
    JsonUtil::findJSONValue(object, "HideSaveOption", _hideSaveOption);
    JsonUtil::findJSONValue(object, "HideExportOption", _hideExportOption);
    JsonUtil::findJSONValue(object, "EnableOwnerTermination", _enableOwnerTermination);
    JsonUtil::findJSONValue(object, "DisablePrint", _disablePrint);
    JsonUtil::findJSONValue(object, "DisableExport", _disableExport);
    JsonUtil::findJSONValue(object, "DisableCopy", _disableCopy);
    JsonUtil::findJSONValue(object, "DisableInactiveMessages", _disableInactiveMessages);
    JsonUtil::findJSONValue(object, "DownloadAsPostMessage", _downloadAsPostMessage);
    JsonUtil::findJSONValue(object, "UserCanNotWriteRelative", _userCanNotWriteRelative);
    JsonUtil::findJSONValue(object, "EnableInsertRemoteImage", _enableInsertRemoteImage);
    JsonUtil::findJSONValue(object, "EnableShare", _enableShare);
    JsonUtil::findJSONValue(object, "HideUserList", _hideUserList);
    JsonUtil::findJSONValue(object, "SupportsLocks", _supportsLocks);
    JsonUtil::findJSONValue(object, "SupportsRename", _supportsRename);
    JsonUtil::findJSONValue(object, "UserCanRename", _userCanRename);
    JsonUtil::findJSONValue(object, "BreadcrumbDocName", _breadcrumbDocName);
    JsonUtil::findJSONValue(object, "FileUrl", _fileUrl);
    bool booleanFlag = false;
    if (JsonUtil::findJSONValue(object, "DisableChangeTrackingRecord", booleanFlag))
        _disableChangeTrackingRecord = (booleanFlag ? WOPIFileInfo::TriState::True : WOPIFileInfo::TriState::False);
    if (JsonUtil::findJSONValue(object, "DisableChangeTrackingShow", booleanFlag))
        _disableChangeTrackingShow = (booleanFlag ? WOPIFileInfo::TriState::True : WOPIFileInfo::TriState::False);
    if (JsonUtil::findJSONValue(object, "HideChangeTrackingControls", booleanFlag))
        _hideChangeTrackingControls = (booleanFlag ? WOPIFileInfo::TriState::True : WOPIFileInfo::TriState::False);

    std::string overrideWatermarks = LOOLWSD::getConfigValue<std::string>("watermark.text", "");
    if (!overrideWatermarks.empty())
        _watermarkText = overrideWatermarks;
}

bool WopiStorage::updateLockState(const Authorization& auth, const std::string& cookies,
                                  LockContext& lockCtx, bool lock)
{
    lockCtx._lockFailureReason.clear();
    if (!lockCtx._supportsLocks)
        return true;

    Poco::URI uriObject(getUri());
    auth.authorizeURI(uriObject);

    Poco::URI uriObjectAnonym(getUri());
    uriObjectAnonym.setPath(LOOLWSD::anonymizeUrl(uriObjectAnonym.getPath()));
    const std::string uriAnonym = uriObjectAnonym.toString();

    const std::string wopiLog(lock ? "WOPI::Lock" : "WOPI::Unlock");
    LOG_DBG(wopiLog << " requesting: " << uriAnonym);

    try
    {
        std::unique_ptr<Poco::Net::HTTPClientSession> psession(getHTTPClientSession(uriObject));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST,
                                       uriObject.getPathAndQuery(),
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        initHttpRequest(request, uriObject, auth, cookies);

        request.set("X-WOPI-Override", lock ? "LOCK" : "UNLOCK");
        request.set("X-WOPI-Lock", lockCtx._lockToken);
        if (!getExtendedData().empty())
            request.set("X-LOOL-WOPI-ExtendedData", getExtendedData());

        // IIS requires content-length for POST requests: see https://forums.iis.net/t/1119456.aspx
        request.setContentLength(0);

        psession->sendRequest(request);
        Poco::Net::HTTPResponse response;
        std::istream& rs = psession->receiveResponse(response);

        std::ostringstream oss;
        Poco::StreamCopier::copyStream(rs, oss);
        std::string responseString = oss.str();

        LOG_INF(wopiLog << " response: " << responseString <<
                " status " << response.getStatus());

        if (response.getStatus() == Poco::Net::HTTPResponse::HTTP_OK)
        {
            lockCtx._isLocked = lock;
            lockCtx._lastLockTime = std::chrono::steady_clock::now();
            return true;
        }
        else
        {
            std::string sMoreInfo = response.get("X-WOPI-LockFailureReason", "");
            if (!sMoreInfo.empty())
            {
                lockCtx._lockFailureReason = sMoreInfo;
                sMoreInfo = ", failure reason: \"" + sMoreInfo + "\"";
            }
            LOG_WRN("Un-successful " << wopiLog << " with status " << response.getStatus() <<
                    sMoreInfo << " and response: " << responseString);
        }
    }
    catch (const Poco::Exception& pexc)
    {
        LOG_ERR("Cannot " << wopiLog << " uri [" << uriAnonym << "]. Error: " <<
                pexc.displayText() << (pexc.nested() ? " (" + pexc.nested()->displayText() + ')' : ""));
    }
    catch (const BadRequestException& exc)
    {
        LOG_ERR("Cannot " << wopiLog << " uri [" << uriAnonym << "]. Error: " << exc.what());
    }
    return false;
}

/// uri format: http://server/<...>/wopi*/files/<id>/content
std::string WopiStorage::downloadStorageFileToLocal(const Authorization& auth,
                                                    const std::string& cookies,
                                                    LockContext& /*lockCtx*/,
                                                    const std::string& templateUri)
{
    if (!templateUri.empty())
    {
        // Download the template file and load it normally.
        // The document will get saved once loading in Core is complete.
        const std::string templateUriAnonym = LOOLWSD::anonymizeUrl(templateUri);
        try
        {
            LOG_INF("WOPI::GetFile template source: " << templateUriAnonym);
            return downloadDocument(Poco::URI(templateUri), templateUriAnonym, auth, cookies);
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Could not download template from [" + templateUriAnonym + "]. Error: "
                    << ex.what());
        }

        return std::string();
    }

    // First try the FileUrl, if provided.
    if (!_fileUrl.empty())
    {
        const std::string fileUrlAnonym = LOOLWSD::anonymizeUrl(_fileUrl);
        try
        {
            LOG_INF("WOPI::GetFile using FileUrl: " << fileUrlAnonym);
            return downloadDocument(Poco::URI(_fileUrl), fileUrlAnonym, auth, cookies);
        }
        catch (const std::exception& ex)
        {
            LOG_ERR("Could not download document from WOPI FileUrl [" + fileUrlAnonym
                        + "]. Will use default URL. Error: "
                    << ex.what());
        }
    }

    // Try the default URL, we either don't have FileUrl, or it failed.
    // WOPI URI to download files ends in '/contents'.
    // Add it's here to get the payload instead of file info.
    Poco::URI uriObject(getUri());
    uriObject.setPath(uriObject.getPath() + "/contents");
    auth.authorizeURI(uriObject);

    Poco::URI uriObjectAnonym(getUri());
    uriObjectAnonym.setPath(LOOLWSD::anonymizeUrl(uriObjectAnonym.getPath()) + "/contents");
    const std::string uriAnonym = uriObjectAnonym.toString();

    try
    {
        LOG_INF("WOPI::GetFile using default URI: " << uriAnonym);
        return downloadDocument(uriObject, uriAnonym, auth, cookies);
    }
    catch (const Poco::Exception& ex)
    {
        LOG_ERR("Cannot download document from WOPI storage uri [" + uriAnonym + "]. Error: "
                << ex.displayText()
                << (ex.nested() ? " (" + ex.nested()->displayText() + ')' : ""));
        throw;
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("Cannot download document from WOPI storage uri [" + uriAnonym + "]. Error: "
                << ex.what());
    }

    return std::string();
}

std::string WopiStorage::downloadDocument(const Poco::URI& uriObject, const std::string& uriAnonym,
                                          const Authorization& auth, const std::string& cookies)
{
    const auto startTime = std::chrono::steady_clock::now();
    std::unique_ptr<Poco::Net::HTTPClientSession> psession(getHTTPClientSession(uriObject));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET,
                                       uriObject.getPathAndQuery(),
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        initHttpRequest(request, uriObject, auth, cookies);

        psession->sendRequest(request);

        Poco::Net::HTTPResponse response;
        std::istream& rs = psession->receiveResponse(response);
        const std::chrono::milliseconds diff
            = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now()
                                                                    - startTime);
        _wopiLoadDuration += diff;

        Log::StreamLogger logger = Log::trace();
        if (logger.enabled())
        {
            logger << "WOPI::GetFile header for URI [" << uriAnonym << "]:\n";
            for (const auto& pair : response)
            {
                logger << '\t' << pair.first << ": " << pair.second << " / ";
            }

            LOG_END(logger, true);
        }

    if (response.getStatus() != Poco::Net::HTTPResponse::HTTP_OK)
    {
        std::ostringstream oss;
        Poco::StreamCopier::copyStream(rs, oss);
        LOG_ERR("WOPI::GetFile [" << uriAnonym
                                  << "] failed with Status Code: " << response.getStatus());
        throw StorageConnectionException("WOPI::GetFile [" + uriAnonym + "] failed: " + oss.str());
    }

    // Successful
    assert(response.getStatus() == Poco::Net::HTTPResponse::HTTP_OK);

    setRootFilePath(Poco::Path(getLocalRootPath(), getFileInfo().getFilename()).toString());
    setRootFilePathAnonym(LOOLWSD::anonymizeUrl(getRootFilePath()));

    std::ofstream ofs(getRootFilePath());
    std::copy(std::istreambuf_iterator<char>(rs), std::istreambuf_iterator<char>(),
              std::ostreambuf_iterator<char>(ofs));
    ofs.close();

    const FileUtil::Stat fileStat(getRootFilePath());
    const std::size_t filesize = (fileStat.good() ? fileStat.size() : 0);
    LOG_INF("WOPI::GetFile downloaded " << filesize << " bytes from [" << uriAnonym << "] -> "
                                        << getRootFilePathAnonym() << " in " << diff.count()
                                        << 's');
    setLoaded(true);

    // Now return the jailed path.
    if (LOOLWSD::NoCapsForKit)
        return getRootFilePath();
    else
        return Poco::Path(getJailPath(), getFileInfo().getFilename()).toString();
}

StorageBase::UploadResult
WopiStorage::uploadLocalFileToStorage(const Authorization& auth, const std::string& cookies,
                                    LockContext& lockCtx, const std::string& saveAsPath,
                                    const std::string& saveAsFilename, const bool isRename)
{
    // TODO: Check if this URI has write permission (canWrite = true)

    const bool isSaveAs = !saveAsPath.empty() && !saveAsFilename.empty();
    const std::string filePath(isSaveAs ? saveAsPath : getRootFilePath());
    const std::string filePathAnonym = LOOLWSD::anonymizeUrl(filePath);

    const FileUtil::Stat fileStat(filePath);
    if (!fileStat.good())
    {
        LOG_ERR("Cannot access file [" << filePathAnonym << "] to upload to wopi storage.");
    }

    const std::size_t size = (fileStat.good() ? fileStat.size() : 0);

    Poco::URI uriObject(getUri());
    uriObject.setPath(isSaveAs || isRename? uriObject.getPath(): uriObject.getPath() + "/contents");
    auth.authorizeURI(uriObject);

    const std::string uriAnonym = LOOLWSD::anonymizeUrl(uriObject.toString());

    LOG_INF("Uploading " << size << " bytes from [" << filePathAnonym << "] to URI via WOPI ["
                         << uriAnonym << "].");

    const auto startTime = std::chrono::steady_clock::now();
    try
    {
        std::unique_ptr<Poco::Net::HTTPClientSession> psession(getHTTPClientSession(uriObject));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST,
                                       uriObject.getPathAndQuery(),
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        initHttpRequest(request, uriObject, auth, cookies);

        if (!isSaveAs && !isRename)
        {
            // normal save
            request.set("X-WOPI-Override", "PUT");
            if (lockCtx._supportsLocks)
                request.set("X-WOPI-Lock", lockCtx._lockToken);
            request.set("X-LOOL-WOPI-IsModifiedByUser", isUserModified()? "true": "false");
            request.set("X-LOOL-WOPI-IsAutosave", isAutosave()? "true": "false");
            request.set("X-LOOL-WOPI-IsExitSave", isExitSave()? "true": "false");
            if (!getExtendedData().empty())
                request.set("X-LOOL-WOPI-ExtendedData", getExtendedData());

            if (!getForceSave())
            {
                // Request WOPI host to not overwrite if timestamps mismatch
                request.set("X-LOOL-WOPI-Timestamp", Util::getIso8601FracformatTime(getFileInfo().getModifiedTime()));
            }
        }
        else
        {
            // the suggested target has to be in UTF-7; default to extension
            // only when the conversion fails
            std::string suggestedTarget = '.' + Poco::Path(saveAsFilename).getExtension();

            //TODO: Perhaps we should cache this descriptor and reuse, as iconv_open might be expensive.
            const iconv_t cd = iconv_open("UTF-7", "UTF-8");
            if (cd == (iconv_t) -1)
                LOG_ERR("Failed to initialize iconv for UTF-7 conversion, using '" << suggestedTarget << "'.");
            else
            {
                std::vector<char> input(saveAsFilename.begin(), saveAsFilename.end());
                std::vector<char> buffer(8 * saveAsFilename.size());

                char* in = &input[0];
                size_t in_left = input.size();
                char* out = &buffer[0];
                size_t out_left = buffer.size();

                if (iconv(cd, &in, &in_left, &out, &out_left) == (size_t) -1)
                    LOG_ERR("Failed to convert '" << saveAsFilename << "' to UTF-7, using '" << suggestedTarget << "'.");
                else
                {
                    // conversion succeeded
                    suggestedTarget = std::string(&buffer[0], buffer.size() - out_left);
                    LOG_TRC("Converted '" << saveAsFilename << "' to UTF-7 as '" << suggestedTarget << "'.");
                }

                iconv_close(cd);
            }

            if (isRename)
            {
                // rename file
                request.set("X-WOPI-Override", "RENAME_FILE");
                request.set("X-WOPI-RequestedName", suggestedTarget);
            }
            else
            {
                // save as
                request.set("X-WOPI-Override", "PUT_RELATIVE");
                request.set("X-WOPI-Size", std::to_string(size));
                request.set("X-WOPI-SuggestedTarget", suggestedTarget);
            }
        }

        request.setContentType("application/octet-stream");
        request.setContentLength(size);

        std::ostream& os = psession->sendRequest(request);

        std::ifstream ifs(filePath);
        Poco::StreamCopier::copyStream(ifs, os);

        Poco::Net::HTTPResponse response;
        std::istream& rs = psession->receiveResponse(response);

        _wopiSaveDuration = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - startTime);

        WopiUploadDetails details
            = { filePathAnonym, uriAnonym, response.getReason(), response.getStatus(), size,
                isSaveAs,       isRename };

        std::ostringstream oss;
        Poco::StreamCopier::copyStream(rs, oss);
        return handleUploadToStorageResponse(details, oss.str());
    }
    catch (const Poco::Exception& pexc)
    {
        LOG_ERR("Cannot upload file to WOPI storage uri [" << uriAnonym << "]. Error: " <<
                pexc.displayText() << (pexc.nested() ? " (" + pexc.nested()->displayText() + ')' : ""));
    }
    catch (const BadRequestException& exc)
    {
        LOG_ERR("Cannot upload file to WOPI storage uri [" + uriAnonym + "]. Error: " << exc.what());
    }

    return StorageBase::UploadResult::Result::FAILED;
}

StorageBase::UploadResult
WopiStorage::handleUploadToStorageResponse(const WopiUploadDetails& details,
                                           std::string responseString)
{
    // Assume we failed, unless we have confirmation of success.
    StorageBase::UploadResult result(StorageBase::UploadResult::Result::FAILED);
    try
    {
        const std::string origResponseString = responseString;

        result.setErrorMsg(responseString);

        const std::string wopiLog(details.isSaveAs
                                      ? "WOPI::PutRelativeFile"
                                      : (details.isRename ? "WOPI::RenameFile" : "WOPI::PutFile"));

        if (Log::infoEnabled())
        {
            if (LOOLWSD::AnonymizeUserData)
            {
                Poco::JSON::Object::Ptr object;
                if (JsonUtil::parseJSON(responseString, object))
                {
                    // Anonymize the filename
                    std::string url;
                    std::string filename;
                    if (JsonUtil::findJSONValue(object, "Url", url)
                        && JsonUtil::findJSONValue(object, "Name", filename))
                    {
                        // Get the FileId form the URL, which we use as the anonymized filename.
                        std::string decodedUrl;
                        Poco::URI::decode(url, decodedUrl);
                        const std::string obfuscatedFileId = Util::getFilenameFromURL(decodedUrl);
                        Util::mapAnonymized(obfuscatedFileId,
                                            obfuscatedFileId); // Identity, to avoid re-anonymizing.

                        const std::string filenameOnly = Util::getFilenameFromURL(filename);
                        Util::mapAnonymized(filenameOnly, obfuscatedFileId);
                        object->set("Name", LOOLWSD::anonymizeUrl(filename));
                    }

                    // Stringify to log.
                    std::ostringstream ossResponse;
                    object->stringify(ossResponse);
                    responseString = ossResponse.str();
                }
            }

            LOG_INF(wopiLog << " uploaded " << details.size << " bytes from ["
                            << details.filePathAnonym << "] -> [" << details.uriAnonym
                            << "]: " << details.httpResponseCode << ' '
                            << details.httpResponseReason << ": " << responseString);
        }

        if (details.httpResponseCode == Poco::Net::HTTPResponse::HTTP_OK)
        {
            result.setResult(StorageBase::UploadResult::Result::OK);
            Poco::JSON::Object::Ptr object;
            if (JsonUtil::parseJSON(origResponseString, object))
            {
                const std::string lastModifiedTime
                    = JsonUtil::getJSONValue<std::string>(object, "LastModifiedTime");
                LOG_TRC(wopiLog << " returns LastModifiedTime [" << lastModifiedTime << "].");
                getFileInfo().setModifiedTime(
                    Util::iso8601ToTimestamp(lastModifiedTime, "LastModifiedTime"));

                if (details.isSaveAs || details.isRename)
                {
                    const std::string name = JsonUtil::getJSONValue<std::string>(object, "Name");
                    LOG_TRC(wopiLog << " returns Name [" << LOOLWSD::anonymizeUrl(name) << "].");

                    const std::string url = JsonUtil::getJSONValue<std::string>(object, "Url");
                    LOG_TRC(wopiLog << " returns Url [" << LOOLWSD::anonymizeUrl(url) << "].");

                    result.setSaveAsResult(name, url);
                }
                // Reset the force save flag now, if any, since we are done saving
                // Next saves shouldn't be saved forcefully unless commanded
                forceSave(false);
            }
            else
            {
                LOG_WRN("Invalid or missing JSON in " << wopiLog << " HTTP_OK response.");
            }
        }
        else if (details.httpResponseCode == Poco::Net::HTTPResponse::HTTP_REQUEST_ENTITY_TOO_LARGE)
        {
            result.setResult(StorageBase::UploadResult::Result::DISKFULL);
        }
        else if (details.httpResponseCode == Poco::Net::HTTPResponse::HTTP_UNAUTHORIZED
                 || details.httpResponseCode == Poco::Net::HTTPResponse::HTTP_FORBIDDEN)
        {
            result.setResult(StorageBase::UploadResult::Result::UNAUTHORIZED);
        }
        else if (details.httpResponseCode == Poco::Net::HTTPResponse::HTTP_CONFLICT)
        {
            result.setResult(StorageBase::UploadResult::Result::CONFLICT);
            Poco::JSON::Object::Ptr object;
            if (JsonUtil::parseJSON(origResponseString, object))
            {
                const unsigned loolStatusCode
                    = JsonUtil::getJSONValue<unsigned>(object, "LOOLStatusCode");
                if (loolStatusCode == static_cast<unsigned>(LOOLStatusCode::DOC_CHANGED))
                {
                    result.setResult(StorageBase::UploadResult::Result::DOC_CHANGED);
                }
            }
            else
            {
                LOG_WRN("Invalid or missing JSON in " << wopiLog << " HTTP_CONFLICT response.");
            }
        }
        else
        {
            // Internal server error, and other failures.
            LOG_ERR("Unexpected response to "
                    << wopiLog << ". Cannot upload file to WOPI storage uri [" << details.uriAnonym
                    << "]: " << details.httpResponseCode << ' ' << details.httpResponseReason
                    << ": " << responseString);
            result.setResult(StorageBase::UploadResult::Result::FAILED);
        }
    }
    catch (const Poco::Exception& pexc)
    {
        LOG_ERR("Cannot upload file to WOPI storage uri ["
                << details.uriAnonym << "]. Error: " << pexc.displayText()
                << (pexc.nested() ? " (" + pexc.nested()->displayText() + ')' : ""));
        result.setResult(StorageBase::UploadResult::Result::FAILED);
    }
    catch (const BadRequestException& exc)
    {
        LOG_ERR("Cannot upload file to WOPI storage uri [" + details.uriAnonym + "]. Error: "
                << exc.what());
        result.setResult(StorageBase::UploadResult::Result::FAILED);
    }

    return result;
}

#endif // !MOBILEAPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
