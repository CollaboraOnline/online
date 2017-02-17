/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "ssl.hpp"
#include "config.h"

#include <sys/syscall.h>

#include "Util.hpp"

std::atomic<int> SslContext::RefCount(0);
std::unique_ptr<SslContext> SslContext::Instance;
std::vector<std::unique_ptr<std::mutex>> SslContext::Mutexes;

SslContext::SslContext(const std::string& certFilePath,
                       const std::string& keyFilePath,
                       const std::string& caFilePath) :
    _ctx(nullptr)
{
    (void)certFilePath;
    (void)keyFilePath;
    (void)caFilePath;

#if OPENSSL_VERSION_NUMBER >= 0x0907000L
    OPENSSL_config(nullptr);
#endif

    SSL_library_init();
    SSL_load_error_strings();
    OpenSSL_add_all_algorithms();

    const std::vector<char> rand = Util::rng::getBytes(512);
    RAND_seed(&rand[0], rand.size());

    // Initialize multi-threading support.
    for (int x = 0; x < CRYPTO_num_locks(); ++x)
    {
        Mutexes.emplace_back(new std::mutex);
    }

    CRYPTO_set_locking_callback(&SslContext::lock);
    CRYPTO_set_id_callback(&SslContext::id);
    CRYPTO_set_dynlock_create_callback(&SslContext::dynlockCreate);
    CRYPTO_set_dynlock_lock_callback(&SslContext::dynlock);
    CRYPTO_set_dynlock_destroy_callback(&SslContext::dynlockDestroy);
}

SslContext::~SslContext()
{
    EVP_cleanup();
    ERR_free_strings();
    CRYPTO_set_locking_callback(0);
    CRYPTO_set_id_callback(0);

    CONF_modules_free();
}

void SslContext::lock(int mode, int n, const char* /*file*/, int /*line*/)
{
    if (mode & CRYPTO_LOCK)
    {
        Mutexes[n]->lock();
    }
    else
    {
        Mutexes[n]->unlock();
    }
}

unsigned long SslContext::id()
{
    return syscall(SYS_gettid);
}

CRYPTO_dynlock_value* SslContext::dynlockCreate(const char* /*file*/, int /*line*/)
{
    return new CRYPTO_dynlock_value;
}


void SslContext::dynlock(int mode, struct CRYPTO_dynlock_value* lock, const char* /*file*/, int /*line*/)
{
    if (mode & CRYPTO_LOCK)
    {
        lock->Mutex.lock();
    }
    else
    {
        lock->Mutex.unlock();
    }
}

void SslContext::dynlockDestroy(struct CRYPTO_dynlock_value* lock, const char* /*file*/, int /*line*/)
{
    delete lock;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
