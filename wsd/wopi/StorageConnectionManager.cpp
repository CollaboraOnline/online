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

#if MOBILEAPP
#error "Mobile doesn't need or support WOPI"
#endif

#include "StorageConnectionManager.hpp"

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

#include <Auth.hpp>
#include <HostUtil.hpp>
#include <ProofKey.hpp>
#include <HttpRequest.hpp>

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

#include <Poco/Exception.h>
#include <Poco/URI.h>

#include <iconv.h>
#include <string>

bool StorageConnectionManager::SSLAsScheme = true;
bool StorageConnectionManager::SSLEnabled = false;

namespace
{
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

void initHttpRequest(Poco::Net::HTTPRequest& request, const Poco::URI& uri,
                     const Authorization& auth)
{
    request.set("User-Agent", http::getAgentString());

    auth.authorizeRequest(request);

    // addStorageDebugCookie(request);

    // TODO: Avoid repeated parsing.
    std::map<std::string, std::string> params = GetQueryParams(uri);
    const auto it = params.find("access_token");
    if (it != params.end())
        addWopiProof(request, uri, it->second);

    // Helps wrt. debugging cluster cases from the logs
    request.set("X-COOL-WOPI-ServerId", Util::getProcessIdentifier());
}

} // namespace

http::Request StorageConnectionManager::createHttpRequest(const Poco::URI& uri,
                                                          const Authorization& auth)
{
    http::Request httpRequest(uri.getPathAndQuery());

    //FIXME: Hack Hack Hack! Use own version.
    Poco::Net::HTTPRequest request;
    ::initHttpRequest(request, uri, auth);

    // Copy the headers, including the cookies.
    for (const auto& pair : request)
    {
        httpRequest.header().set(pair.first, pair.second);
    }

    return httpRequest;
}

std::shared_ptr<http::Session>
StorageConnectionManager::getHttpSession(const Poco::URI& uri, std::chrono::seconds timeout)
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
        useSSL = SSLEnabled || ConfigUtil::isSSLTermination();
    }

    const auto protocol =
        useSSL ? http::Session::Protocol::HttpSsl : http::Session::Protocol::HttpUnencrypted;

    // Create the session.
    auto httpSession = http::Session::create(uri.getHost(), protocol, uri.getPort());

    if (timeout == std::chrono::seconds::zero())
    {
        CONFIG_STATIC const std::chrono::seconds defTimeout = std::chrono::seconds(
            ConfigUtil::getConfigValue<int>("net.connection_timeout_secs", 30));
        timeout = defTimeout;
    }

    httpSession->setTimeout(timeout);

    return httpSession;
}

void StorageConnectionManager::initialize()
{
#if ENABLE_SSL
    // FIXME: should use our own SSL socket implementation here.
    Poco::Crypto::initializeCrypto();
    Poco::Net::initializeSSL();

    // Init client
    Poco::Net::Context::Params sslClientParams;

    // false default for upgrade to preserve legacy configuration
    // in-config-file defaults are true.
    SSLAsScheme = ConfigUtil::getConfigValue<bool>("storage.ssl.as_scheme", false);

    // Fallback to ssl.enable if not set - for back compatibility & simplicity.
    SSLEnabled = ConfigUtil::getConfigValue<bool>(
        "storage.ssl.enable", ConfigUtil::getConfigValue<bool>("ssl.enable", true));

#if ENABLE_DEBUG
    char* StorageSSLEnabled = getenv("STORAGE_SSL_ENABLE");
    if (StorageSSLEnabled != NULL)
    {
        if (!strcasecmp(StorageSSLEnabled, "true"))
            SSLEnabled = true;
        else if (!strcasecmp(StorageSSLEnabled, "false"))
            SSLEnabled = false;
    }
#endif // ENABLE_DEBUG

    if (SSLEnabled || SSLAsScheme)
    {
        if (ConfigUtil::isSslEnabled())
        {
            sslClientParams.certificateFile = ConfigUtil::getPathFromConfigWithFallback(
                "storage.ssl.cert_file_path", "ssl.cert_file_path");
            sslClientParams.privateKeyFile = ConfigUtil::getPathFromConfigWithFallback(
                "storage.ssl.key_file_path", "ssl.key_file_path");
            sslClientParams.caLocation = ConfigUtil::getPathFromConfigWithFallback(
                "storage.ssl.ca_file_path", "ssl.ca_file_path");
        }
        else
        {
            sslClientParams.certificateFile =
                ConfigUtil::getPathFromConfig("storage.ssl.cert_file_path");
            sslClientParams.privateKeyFile =
                ConfigUtil::getPathFromConfig("storage.ssl.key_file_path");
            sslClientParams.caLocation = ConfigUtil::getPathFromConfig("storage.ssl.ca_file_path");
        }
        sslClientParams.cipherList =
            ConfigUtil::getPathFromConfigWithFallback("storage.ssl.cipher_list", "ssl.cipher_list");
        const bool sslVerification = ConfigUtil::getConfigValue<bool>("ssl.ssl_verification", true);
        sslClientParams.verificationMode =
            !sslVerification ? Poco::Net::Context::VERIFY_NONE : Poco::Net::Context::VERIFY_STRICT;
        sslClientParams.loadDefaultCAs = true;
    }
    else
        sslClientParams.verificationMode = Poco::Net::Context::VERIFY_NONE;

    Poco::SharedPtr<Poco::Net::PrivateKeyPassphraseHandler> consoleClientHandler =
        new Poco::Net::KeyConsoleHandler(false);
    Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidClientCertHandler =
        new Poco::Net::AcceptCertificateHandler(false);

    Poco::Net::Context::Ptr sslClientContext =
        new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslClientParams);
    sslClientContext->disableProtocols(Poco::Net::Context::Protocols::PROTO_SSLV2 |
                                       Poco::Net::Context::Protocols::PROTO_SSLV3 |
                                       Poco::Net::Context::Protocols::PROTO_TLSV1);
    Poco::Net::SSLManager::instance().initializeClient(std::move(consoleClientHandler),
                                                       std::move(invalidClientCertHandler),
                                                       std::move(sslClientContext));

    // Initialize our client SSL context.
    ssl::Manager::initializeClientContext(
        sslClientParams.certificateFile, sslClientParams.privateKeyFile, sslClientParams.caLocation,
        sslClientParams.cipherList,
        sslClientParams.verificationMode == Poco::Net::Context::VERIFY_NONE
            ? ssl::CertificateVerification::Disabled
            : ssl::CertificateVerification::Required);
    if (!ssl::Manager::isClientContextInitialized())
        LOG_ERR("Failed to initialize Client SSL.");
    else
        LOG_INF("Initialized Client SSL.");
#endif // ENABLE_SSL
}
