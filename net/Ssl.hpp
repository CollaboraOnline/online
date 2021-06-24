/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <common/Util.hpp>

#include <atomic>
#include <cassert>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#include <openssl/ssl.h>
#include <openssl/rand.h>
#include <openssl/crypto.h>
#include <openssl/err.h>
#if OPENSSL_VERSION_NUMBER >= 0x0907000L
#include <openssl/conf.h>
#endif

class SslContext
{
public:
    SslContext(const std::string& certFilePath, const std::string& keyFilePath,
               const std::string& caFilePath, const std::string& cipherList);

    /// Returns a new SSL Context to be used with raw API.
    SSL* newSsl() { return SSL_new(_ctx); }

    ~SslContext();

private:
    void initDH();
    void initECDH();
    void shutdown();

    std::string getLastErrorMsg();

    // Multithreading support for OpenSSL.
    // Not needed in recent (1.x?) versions.
    static unsigned long id();
    static struct CRYPTO_dynlock_value* dynlockCreate(const char* file, int line);
    static void dynlock(int mode, struct CRYPTO_dynlock_value* lock, const char* file, int line);
    static void dynlockDestroy(struct CRYPTO_dynlock_value* lock, const char* file, int line);

private:
    SSL_CTX* _ctx;
};

namespace ssl
{
class Manager
{
public:
    static void initializeServerContext(const std::string& certFilePath,
                                        const std::string& keyFilePath,
                                        const std::string& caFilePath,
                                        const std::string& cipherList = std::string())
    {
        assert(!isServerContextInitialized() &&
               "Cannot initialize the server context more than once");
        ServerInstance.reset(new SslContext(certFilePath, keyFilePath, caFilePath, cipherList));
    }

    static void uninitializeServerContext() { ServerInstance.reset(); }

    /// Returns true iff the Server SslContext has been initialized.
    static bool isServerContextInitialized() { return !!ServerInstance; }

    static SSL* newServerSsl()
    {
        assert(isServerContextInitialized() && "Server SslContext is not initialized");
        return ServerInstance->newSsl();
    }

    static void initializeClientContext(const std::string& certFilePath,
                                        const std::string& keyFilePath,
                                        const std::string& caFilePath,
                                        const std::string& cipherList = std::string())
    {
        assert(!isClientContextInitialized() &&
               "Cannot initialize the client context more than once");
        ClientInstance.reset(new SslContext(certFilePath, keyFilePath, caFilePath, cipherList));
    }

    static void uninitializeClientContext() { ClientInstance.reset(); }

    /// Returns true iff the SslContext has been initialized.
    static bool isClientContextInitialized() { return !!ClientInstance; }

    static SSL* newClientSsl()
    {
        assert(isClientContextInitialized() && "Client SslContext is not initialized");
        return ClientInstance->newSsl();
    }

private:
    static std::unique_ptr<SslContext> ServerInstance;
    static std::unique_ptr<SslContext> ClientInstance;
};

} // namespace ssl

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
