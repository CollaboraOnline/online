/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <memory>
#include <set>
#include <string>
#include <chrono>

#include <Poco/URI.h>
#include <Poco/Util/Application.h>

#include "COOLWSD.hpp"
#include "Log.hpp"
#include "Util.hpp"

/// A Storage Manager is responsible for the settings
/// of Storage and the creation of http::Session and
/// related objects.
class StorageConnectionManager final
{
public:
    static std::shared_ptr<StorageConnectionManager> create()
    {
        static std::weak_ptr<StorageConnectionManager> instance;
        std::shared_ptr<StorageConnectionManager> sm = instance.lock();
        if (!sm)
        {
            sm = std::shared_ptr<StorageConnectionManager>(new StorageConnectionManager());
            instance = sm;
        }

        return sm;
    }

    static std::shared_ptr<http::Session> getHttpSession(const Poco::URI& uri);

private:
    StorageConnectionManager() {}
#if 0
    void initialize()
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
        char* StorageSSLEnabled = getenv("STORAGE_SSL_ENABLE");
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
            sslClientParams.certificateFile = COOLWSD::getPathFromConfigWithFallback(
                "storage.ssl.cert_file_path", "ssl.cert_file_path");
            sslClientParams.privateKeyFile = COOLWSD::getPathFromConfigWithFallback(
                "storage.ssl.key_file_path", "ssl.key_file_path");
            sslClientParams.caLocation = COOLWSD::getPathFromConfigWithFallback(
                "storage.ssl.ca_file_path", "ssl.ca_file_path");
            sslClientParams.cipherList = COOLWSD::getPathFromConfigWithFallback(
                "storage.ssl.cipher_list", "ssl.cipher_list");

            sslClientParams.verificationMode =
                (sslClientParams.caLocation.empty() ? Poco::Net::Context::VERIFY_NONE
                                                    : Poco::Net::Context::VERIFY_STRICT);
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
        Poco::Net::SSLManager::instance().initializeClient(
            consoleClientHandler, invalidClientCertHandler, sslClientContext);

        // Initialize our client SSL context.
        ssl::Manager::initializeClientContext(
            sslClientParams.certificateFile, sslClientParams.privateKeyFile,
            sslClientParams.caLocation, sslClientParams.cipherList,
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
#endif

    /// Sanitize a URI by removing authorization tokens.
    Poco::URI sanitizeUri(Poco::URI uri)
    {
        static const std::string access_token("access_token");

        Poco::URI::QueryParameters queryParams = uri.getQueryParameters();
        for (auto& param : queryParams)
        {
            // Sanitize more params as needed.
            if (param.first == access_token)
            {
                // If access_token exists, clear it. But don't add it if not provided.
                param.second.clear();
                uri.setQueryParameters(queryParams);
                break;
            }
        }

        return uri;
    }

    /// Saves new URI when resource was moved
    // void setUri(const Poco::URI& uri) { _uri = sanitizeUri(uri); }

    static bool FilesystemEnabled;
    /// If true, use only the WOPI URL for whether to use SSL to talk to storage server
    static bool SSLAsScheme;
    /// If true, force SSL communication with storage server
    static bool SSLEnabled;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
