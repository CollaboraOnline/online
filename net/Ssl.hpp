/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

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
    static void initialize(const std::string& certFilePath,
                           const std::string& keyFilePath,
                           const std::string& caFilePath,
                           const std::string& cipherList = "")
    {
        assert (!Instance);
        Instance.reset(new SslContext(certFilePath, keyFilePath, caFilePath, cipherList));
    }

    static void uninitialize();

    /// Returns true iff the SslContext has been initialized.
    static bool isInitialized() { return !!Instance; }

    static SSL* newSsl()
    {
        return SSL_new(Instance->_ctx);
    }

    ~SslContext();

private:
    SslContext(const std::string& certFilePath,
               const std::string& keyFilePath,
               const std::string& caFilePath,
               const std::string& cipherList);

    void initDH();
    void initECDH();
    void shutdown();

    std::string getLastErrorMsg();

    // Multithreading support for OpenSSL.
    // Not needed in recent (1.x?) versions.
    static void lock(int mode, int n, const char* file, int line);
    static unsigned long id();
    static struct CRYPTO_dynlock_value* dynlockCreate(const char* file, int line);
    static void dynlock(int mode, struct CRYPTO_dynlock_value* lock, const char* file, int line);
    static void dynlockDestroy(struct CRYPTO_dynlock_value* lock, const char* file, int line);

private:
    static std::unique_ptr<SslContext> Instance;

    std::vector<std::unique_ptr<std::mutex>> _mutexes;

    SSL_CTX* _ctx;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
