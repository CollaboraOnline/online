/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <chrono>
#include <memory>
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
#include <Poco/Net/SSLManager.h>

#include <cassert>
#include <errno.h>

#include <Auth.hpp>
#include <HostUtil.hpp>
#include <ProofKey.hpp>
#include <HttpRequest.hpp>

#endif

#include <Poco/StreamCopier.h>
#include <Poco/URI.h>

#include <Common.hpp>
#include <Exceptions.hpp>
#include <Storage.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <common/FileUtil.hpp>
#include <common/JsonUtil.hpp>
#include <common/TraceEvent.hpp>
#include <NetUtil.hpp>
#include <CommandControl.hpp>

#ifdef IOS
#include <ios.h>
#elif defined(__ANDROID__)
#include "androidapp.hpp"
#elif defined(GTKAPP)
#include "gtk.hpp"
#elif WASMAPP
#include "wasmapp.hpp"
#endif // IOS

bool StorageBase::FilesystemEnabled;
bool StorageBase::SSLAsScheme = true;
bool StorageBase::SSLEnabled = false;

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

    //parse wopi.storage.host only when there is no storage.wopi.alias_groups entry in config
    if (!app.config().has("storage.wopi.alias_groups"))
    {
        HostUtil::parseWopiHost(app.config());
    }

#if ENABLE_FEATURE_LOCK
    CommandControl::LockManager::parseLockedHost(app.config());
#endif

    HostUtil::parseAliases(app.config());

#if ENABLE_SSL
    // FIXME: should use our own SSL socket implementation here.
    Poco::Crypto::initializeCrypto();
    Poco::Net::initializeSSL();

    // Init client
    Poco::Net::Context::Params sslClientParams;

    // false default for upgrade to preserve legacy configuration
    // in-config-file defaults are true.
    SSLAsScheme = COOLWSD::getConfigValue<bool>("storage.ssl.as_scheme", false);

    // Fallback to ssl.enable if not set - for back compatibility & simplicity.
    SSLEnabled = COOLWSD::getConfigValue<bool>(
        "storage.ssl.enable", COOLWSD::getConfigValue<bool>("ssl.enable", true));

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
        sslClientParams.certificateFile = COOLWSD::getPathFromConfigWithFallback("storage.ssl.cert_file_path", "ssl.cert_file_path");
        sslClientParams.privateKeyFile = COOLWSD::getPathFromConfigWithFallback("storage.ssl.key_file_path", "ssl.key_file_path");
        sslClientParams.caLocation = COOLWSD::getPathFromConfigWithFallback("storage.ssl.ca_file_path", "ssl.ca_file_path");
        sslClientParams.cipherList = COOLWSD::getPathFromConfigWithFallback("storage.ssl.cipher_list", "ssl.cipher_list");

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

    // Initialize our client SSL context.
    ssl::Manager::initializeClientContext(
        sslClientParams.certificateFile, sslClientParams.privateKeyFile, sslClientParams.caLocation,
        sslClientParams.cipherList,
        sslClientParams.caLocation.empty() ? ssl::CertificateVerification::Disabled
                                           : ssl::CertificateVerification::Required);
    if (!ssl::Manager::isClientContextInitialized())
        LOG_ERR("Failed to initialize Client SSL.");
    else
        LOG_INF("Initialized Client SSL.");
#endif
#else
    FilesystemEnabled = true;
#endif
}

#if !MOBILEAPP

bool isLocalhost(const std::string& targetHost)
{
    const std::string targetAddress = net::resolveHostAddress(targetHost);

    if (net::isLocalhost(targetHost))
    {
        LOG_INF("WOPI host [" << targetHost << "] is on the same host as the WOPI client: \""
                              << targetAddress << "\". Connection is allowed.");
        return true;
    }

    LOG_INF("WOPI host [" << targetHost << "] is not on the same host as the WOPI client: \""
                          << targetAddress << "\". Connection is not allowed.");
    return false;
}

#endif

StorageBase::StorageType StorageBase::validate(const Poco::URI& uri, bool takeOwnership)
{
    if (uri.isRelative() || uri.getScheme() == "file")
    {
        LOG_DBG("Public URI [" << COOLWSD::anonymizeUrl(uri.toString()) << "] is a file");

#if ENABLE_DEBUG
        if (std::getenv("FAKE_UNAUTHORIZED"))
        {
            LOG_DBG("FAKE_UNAUTHORIZED envar is set, unauthorized uri ["
                    << COOLWSD::anonymizeUrl(uri.toString()) << ']');
            return StorageBase::StorageType::Unauthorized;
        }
#endif
        if (FilesystemEnabled || takeOwnership)
        {
            LOG_DBG("Validated URI [" << COOLWSD::anonymizeUrl(uri.toString())
                                      << "] as FileSystem");
            return StorageBase::StorageType::FileSystem;
        }

        LOG_DBG("Local Storage is disabled by default. Enable in the config file or on the "
                "command-line to enable.");
    }
#if !MOBILEAPP
    else if (HostUtil::isWopiEnabled())
    {
        const auto& targetHost = uri.getHost();
        HostUtil::setFirstHost(uri);
        if (HostUtil::allowedWopiHost(targetHost) || isLocalhost(targetHost))
        {
            LOG_DBG("Validated URI [" << COOLWSD::anonymizeUrl(uri.toString()) << "] as WOPI");
            return StorageBase::StorageType::Wopi;
        }

        // check if the IP address is in the list of allowed hosts
        const auto hostAddresses(Poco::Net::DNS::resolve(targetHost));
        for (const auto& address : hostAddresses.addresses())
        {
            if (HostUtil::allowedWopiHost(address.toString()))
            {
                LOG_DBG("Validated URI [" << COOLWSD::anonymizeUrl(uri.toString()) << "] as WOPI");
                return StorageBase::StorageType::Wopi;
            }
        }

        LOG_DBG("No acceptable WOPI hosts found matching the target host ["
                << targetHost << "] in config for URI [" << COOLWSD::anonymizeUrl(uri.toString())
                << ']');
        return StorageBase::StorageType::Unauthorized;
    }
#endif

    LOG_DBG("No Storage configured or invalid URI [" << COOLWSD::anonymizeUrl(uri.toString())
                                                     << ']');
    return StorageBase::StorageType::Unsupported;
}

std::unique_ptr<StorageBase> StorageBase::create(const Poco::URI& uri, const std::string& jailRoot,
                                                 const std::string& jailPath, bool takeOwnership)
{
    // FIXME: By the time this gets called we have already sent to the client three
    // 'statusindicator:' messages: 'find', 'connect' and 'ready'. We should ideally do the checks
    // here much earlier. Also, using exceptions is lame and makes understanding the code harder,
    // but that is just my personal preference.

    std::unique_ptr<StorageBase> storage;
    if (UnitBase::isUnitTesting() && UnitWSD::get().createStorage(uri, jailRoot, jailPath, storage))
    {
        if (storage)
        {
            LOG_INF("Storage create hooked via UnitWSD");
            return storage;
        }
    }

    const StorageBase::StorageType type = validate(uri, takeOwnership);
    switch (type)
    {
        case StorageBase::StorageType::Unsupported:
            LOG_ERR("Unsupported URI [" << COOLWSD::anonymizeUrl(uri.toString())
                                        << "] or no storage configured");
            throw BadRequestException("No Storage configured or invalid URI " +
                                      COOLWSD::anonymizeUrl(uri.toString()) + ']');

            break;
        case StorageBase::StorageType::Unauthorized:
            LOG_ERR("No acceptable WOPI hosts found matching the target host [" << uri.getHost()
                                                                                << "] in config");
            throw UnauthorizedRequestException(
                "No acceptable WOPI hosts found matching the target host [" + uri.getHost() +
                "] in config");
            break;
        case StorageBase::StorageType::FileSystem:
            return std::make_unique<LocalStorage>(uri, jailRoot, jailPath, takeOwnership);
            break;
#if !MOBILEAPP
        case StorageBase::StorageType::Wopi:
            return std::make_unique<WopiStorage>(uri, jailRoot, jailPath);
            break;
#endif //!MOBILEAPP
    }

    throw BadRequestException("No Storage configured or invalid URI " +
                              COOLWSD::anonymizeUrl(uri.toString()) + ']');
}

std::atomic<unsigned> LocalStorage::LastLocalStorageId;

std::unique_ptr<LocalStorage::LocalFileInfo> LocalStorage::getLocalFileInfo()
{
    const Poco::Path path = getUri().getPath();
    LOG_DBG("Getting info for local uri [" << COOLWSD::anonymizeUrl(getUri().toString()) << "], path [" << COOLWSD::anonymizeUrl(path.toString()) << "].");

    const FileUtil::Stat stat(path.toString());
    const std::chrono::system_clock::time_point lastModified = stat.modifiedTimepoint();

    setFileInfo(FileInfo(path.getFileName(), "LocalOwner",
                         Util::getIso8601FracformatTime(lastModified)));

    // Set automatic userid and username.
    const std::string userId = std::to_string(LastLocalStorageId++);
    std::string userNameString;

#if MOBILEAPP
    if (user_name != nullptr)
        userNameString = std::string(user_name);
#endif
    if (userNameString.empty())
        userNameString = "LocalUser#" + userId;

    return std::make_unique<LocalStorage::LocalFileInfo>("LocalUser" + userId, userNameString);
}

std::string LocalStorage::downloadStorageFileToLocal(const Authorization& /*auth*/,
                                                     LockContext& /*lockCtx*/,
                                                     const std::string& /*templateUri*/)
{
#if !MOBILEAPP
    // /chroot/jailId/user/doc/childId/file.ext
    const std::string filename = Poco::Path(getUri().getPath()).getFileName();
    setRootFilePath(Poco::Path(getLocalRootPath(), filename).toString());
    setRootFilePathAnonym(COOLWSD::anonymizeUrl(getRootFilePath()));
    LOG_INF("Public URI [" << COOLWSD::anonymizeUrl(getUri().getPath()) <<
            "] jailed to [" << getRootFilePathAnonym() << "].");

    // Despite the talk about URIs it seems that _uri is actually just a pathname here
    const std::string publicFilePath = getUri().getPath();
    if (!Poco::File(publicFilePath).exists())
    {
        LOG_ERR("Local file URI [" << publicFilePath << "] invalid or doesn't exist.");
        throw BadRequestException("Invalid URI: " + getUri().toString());
    }

    if (!FileUtil::checkDiskSpace(getRootFilePath()))
    {
        throw StorageSpaceLowException("Low disk space for " + getRootFilePathAnonym());
    }

    if (_isTemporaryFile)
    {
        try
        {
            // Neither link nor copy, just move, it's a temporary file.
            Poco::File(publicFilePath).moveTo(getRootFilePath());

            // Cleanup the directory after moving.
            const std::string dir = Poco::Path(publicFilePath).parent().toString();
            if (FileUtil::isEmptyDirectory(dir))
                FileUtil::removeFile(dir);
        }
        catch (const Poco::Exception& exc)
        {
            LOG_ERR("Failed to move [" << COOLWSD::anonymizeUrl(publicFilePath) << "] to ["
                                       << getRootFilePathAnonym() << "]: " << exc.displayText());
        }
    }

    if (!FileUtil::Stat(getRootFilePath()).exists())
    {
        // Try to link.
        LOG_INF("Linking " << COOLWSD::anonymizeUrl(publicFilePath) << " to "
                           << getRootFilePathAnonym());
        if (!Poco::File(getRootFilePath()).exists()
            && link(publicFilePath.c_str(), getRootFilePath().c_str()) == -1)
        {
            // Failed
            LOG_INF("link(\"" << COOLWSD::anonymizeUrl(publicFilePath) << "\", \""
                              << getRootFilePathAnonym() << "\") failed. Will copy. Linking error: "
                              << Util::symbolicErrno(errno) << ' ' << strerror(errno));
        }
    }

    try
    {
        // Fallback to copying.
        if (!FileUtil::Stat(getRootFilePath()).exists())
        {
            FileUtil::copyFileTo(publicFilePath, getRootFilePath());
            _isCopy = true;
        }
    }
    catch (const Poco::Exception& exc)
    {
        LOG_ERR("copyTo(\"" << COOLWSD::anonymizeUrl(publicFilePath) << "\", \""
                            << getRootFilePathAnonym() << "\") failed: " << exc.displayText());
        throw;
    }

    setDownloaded(true);

    // Now return the jailed path.
    if (COOLWSD::NoCapsForKit)
        return getRootFilePath();
    else
        return Poco::Path(getJailPath(), filename).toString();

#else // MOBILEAPP

    // In the mobile app we use no jail
    setRootFilePath(getUri().getPath());

    return getRootFilePath();
#endif
}

void LocalStorage::uploadLocalFileToStorageAsync(const Authorization& /*auth*/,
                                                 LockContext& /*lockCtx*/,
                                                 const std::string& /*saveAsPath*/,
                                                 const std::string& /*saveAsFilename*/,
                                                 bool /*isRename*/, const Attributes&, SocketPoll&,
                                                 const AsyncUploadCallback& asyncUploadCallback)
{
    const std::string path = getUri().getPath();

    // Assume failure by default.
    UploadResult res = UploadResult(UploadResult::Result::FAILED, "Internal error");
    try
    {
        LOG_TRC("Copying local file to local file storage (isCopy: " << _isCopy << ") for "
                                                                     << getRootFilePathAnonym());

        // Copy the file back.
        if (_isCopy && Poco::File(getRootFilePathUploading()).exists())
            FileUtil::copyFileTo(getRootFilePathUploading(), path);

        // update its fileinfo object. This is used later to check if someone else changed the
        // document while we are/were editing it
        setLastModifiedTime(
            Util::getIso8601FracformatTime(FileUtil::Stat(path).modifiedTimepoint()));
        LOG_TRC("New FileInfo modified time in storage " << getLastModifiedTime());
        res = UploadResult(UploadResult::Result::OK);
    }
    catch (const Poco::Exception& exc)
    {
        LOG_ERR("copyTo(\"" << getRootFilePathAnonym() << "\", \"" << COOLWSD::anonymizeUrl(path)
                            << "\") failed: " << exc.displayText());
        // Default UploadResult is failure.
    }

    if (asyncUploadCallback)
        asyncUploadCallback(AsyncUpload(AsyncUpload::State::Complete, res));
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
        useSSL = SSLEnabled || COOLWSD::isSSLTermination();
    }
    // We decoupled the Wopi communication from client communication because
    // the Wopi communication must have an independent policy.
    // So, we will use here only Storage settings.
    Poco::Net::HTTPClientSession* session = useSSL
        ? new Poco::Net::HTTPSClientSession(uri.getHost(), uri.getPort(),
                                            Poco::Net::SSLManager::instance().defaultClientContext())
        : new Poco::Net::HTTPClientSession(uri.getHost(), uri.getPort());

    // Set the timeout to the configured value.
    static int timeoutSec = COOLWSD::getConfigValue<int>("net.connection_timeout_secs", 30);
    session->setTimeout(Poco::Timespan(timeoutSec, 0));

    return session;
}

std::shared_ptr<http::Session> StorageBase::getHttpSession(const Poco::URI& uri)
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
        useSSL = SSLEnabled || COOLWSD::isSSLTermination();
    }

    const auto protocol
        = useSSL ? http::Session::Protocol::HttpSsl : http::Session::Protocol::HttpUnencrypted;

    // Create the session.
    auto httpSession = http::Session::create(uri.getHost(), protocol, uri.getPort());

    static int timeoutSec = COOLWSD::getConfigValue<int>("net.connection_timeout_secs", 30);
    httpSession->setTimeout(std::chrono::seconds(timeoutSec));

    return httpSession;
}

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
    _lockToken = "cool-lock" + Util::rng::getHexString(8);
#endif
}

bool LockContext::needsRefresh(const std::chrono::steady_clock::time_point &now) const
{
    return _supportsLocks && _isLocked && _refreshSeconds > std::chrono::seconds::zero() &&
           (now - _lastLockTime) >= _refreshSeconds;
}

void LockContext::dumpState(std::ostream& os) const
{
    if (!_supportsLocks)
        return;

    os << "\n  LockContext:";
    os << "\n    locked: " << _isLocked;
    os << "\n    token: " << _lockToken;
    os << "\n    last locked: " << Util::getSteadyClockAsString(_lastLockTime);
}

#if !MOBILEAPP

/// A helper class to invoke the AsyncUploadCallback
/// when it exits its scope.
/// By default it invokes the callback with a failure state.
class ScopedInvokeAsyncUploadCallback
{
public:
    ScopedInvokeAsyncUploadCallback(StorageBase::AsyncUploadCallback asyncUploadCallback)
        : _asyncUploadCallback(std::move(asyncUploadCallback))
        , _arg(StorageBase::AsyncUpload(
              StorageBase::AsyncUpload::State::Error,
              StorageBase::UploadResult(StorageBase::UploadResult::Result::FAILED)))
    {
    }

    ~ScopedInvokeAsyncUploadCallback()
    {
        if (_asyncUploadCallback)
            _asyncUploadCallback(_arg);
    }

    /// Set a new callback argument.
    void setArg(StorageBase::AsyncUpload arg) { _arg = std::move(arg); }

private:
    StorageBase::AsyncUploadCallback _asyncUploadCallback;
    StorageBase::AsyncUpload _arg;
};

#endif // !MOBILEAPP

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
