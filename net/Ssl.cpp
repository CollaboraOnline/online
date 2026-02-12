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

/*
 * Implementation of OpenSSL context initialization and management.
 * Classes: SslContext, ssl::Lock (for OpenSSL < 1.1)
 */

#include <config.h>

#include "Ssl.hpp"

#include <common/Log.hpp>
#include <common/Util.hpp>

#include <unistd.h>

std::unique_ptr<SslContext> ssl::Manager::ServerInstance(nullptr);
std::unique_ptr<SslContext> ssl::Manager::ClientInstance(nullptr);

static const char* getCABundleFile()
{
    // Try the same locations that core's GetCABundleFile will
    const char* locations[] = {
        "/etc/pki/tls/certs/ca-bundle.crt",
        "/etc/pki/tls/certs/ca-bundle.trust.crt",
        "/etc/ssl/certs/ca-certificates.crt",
        "/var/lib/ca-certificates/ca-bundle.pem",
        "/etc/ssl/cert.pem"
    };
    for (const char* location : locations)
    {
        if (access(location, R_OK) == 0)
            return location;
    }
    return nullptr;
}

SslContext::SslContext(const std::string& certFilePath, const std::string& keyFilePath,
                       const std::string& caFilePath, const std::string& cipherList,
                       ssl::CertificateVerification verification)
    : _ctx(nullptr)
    , _verification(verification)
{
    LOG_INF("Initializing " << OPENSSL_VERSION_TEXT);

    const std::vector<char> rand = Util::rng::getBytes(512);
    RAND_seed(rand.data(), rand.size());

    OPENSSL_init_ssl(OPENSSL_INIT_LOAD_CONFIG, nullptr);

    // Create the Context. We only have one,
    // as we don't expect/support different servers in same process.
    _ctx = SSL_CTX_new(TLS_method());
    SSL_CTX_set_min_proto_version(_ctx, TLS1_2_VERSION); // TLS v1.2 is the minimum.

    // SSL_CTX_set_default_passwd_cb(_ctx, &privateKeyPassphraseCallback);
    ERR_clear_error();
    SSL_CTX_set_options(_ctx, SSL_OP_ALL);

    if (!getenv("SSL_CERT_FILE"))
    {
        const char* bundle = getCABundleFile();
        if (!bundle)
            throw std::runtime_error(std::string("Cannot load default CA bundle"));
        LOG_INF("Using SSL_CERT_FILE of: " << bundle);
        setenv("SSL_CERT_FILE", bundle, false);
    }
    SSL_CTX_set_default_verify_paths(_ctx);

    try
    {
        int errCode = 0;
        if (!caFilePath.empty())
        {
            errCode = SSL_CTX_load_verify_locations(_ctx, caFilePath.c_str(), nullptr);
            if (errCode != 1)
            {
                std::string msg = getLastErrorMsg();
                throw std::runtime_error(std::string("Cannot load CA file/directory at ") + caFilePath + " (" + msg + ')');
            }
        }

        if (!keyFilePath.empty())
        {
            errCode = SSL_CTX_use_PrivateKey_file(_ctx, keyFilePath.c_str(), SSL_FILETYPE_PEM);
            if (errCode != 1)
            {
                std::string msg = getLastErrorMsg();
                throw std::runtime_error(std::string("Error loading private key from file ") + keyFilePath + " (" + msg + ')');
            }
        }

        if (!certFilePath.empty())
        {
            errCode = SSL_CTX_use_certificate_chain_file(_ctx, certFilePath.c_str());
            if (errCode != 1)
            {
                std::string msg = getLastErrorMsg();
                throw std::runtime_error(std::string("Error loading certificate from file ") + certFilePath + " (" + msg + ')');
            }
        }

        const int sslVerifyMode = _verification == ssl::CertificateVerification::Disabled ? SSL_VERIFY_NONE : SSL_VERIFY_PEER;
        SSL_CTX_set_verify(_ctx, sslVerifyMode, nullptr /*&verifyServerCallback*/);

        SSL_CTX_set_cipher_list(_ctx, cipherList.c_str());
        SSL_CTX_set_verify_depth(_ctx, 9);

        // The write buffer may re-allocate, and we don't mind partial writes.
        // Without auto-retry, when SSL_read processes non-application data,
        // it would return with WANT_READ even when there is application data to
        // process. This is reasonable for blocking sockets, but inefficient for
        // non-blocking ones, which we use. So we enable auto-retry.
        SSL_CTX_set_mode(_ctx, SSL_MODE_ENABLE_PARTIAL_WRITE | SSL_MODE_ACCEPT_MOVING_WRITE_BUFFER |
                                   SSL_MODE_AUTO_RETRY);
        SSL_CTX_set_session_cache_mode(_ctx, SSL_SESS_CACHE_OFF);

        initDH();
        initECDH();
    }
    catch (...)
    {
        SSL_CTX_free(_ctx);
        _ctx = nullptr;
        throw;
    }
}

SslContext::~SslContext()
{
    SSL_CTX_free(_ctx);
}

void SslContext::initDH()
{
#ifndef OPENSSL_NO_DH
    SSL_CTX_set_dh_auto(_ctx, 1);
#endif
}

void SslContext::initECDH()
{
#ifndef OPENSSL_NO_EC
    #define DEFAULT_TLS_GROUPS "X448:X25519:P-521:P-384:P-256:ffdhe2048:ffdhe3072:ffdhe4096:ffdhe6144:ffdhe8192"
    if (SSL_CTX_set1_groups_list(_ctx, DEFAULT_TLS_GROUPS) == 0)
    {
        throw std::runtime_error("Cannot set ECDH groups: " DEFAULT_TLS_GROUPS);
    }
    SSL_CTX_set_options(_ctx, SSL_OP_SINGLE_ECDH_USE);
#endif
}

std::string SslContext::getLastErrorMsg()
{
    const unsigned long errCode = ERR_get_error();
    if (errCode != 0)
    {
        char buf[256];
        ERR_error_string_n(errCode, buf, sizeof(buf));
        return std::string(buf);
    }

    return "Success";
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
