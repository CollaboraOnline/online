/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <assert.h>
#include "Ssl.hpp"

#include <sys/syscall.h>

#include "Util.hpp"

extern "C"
{
    // Multithreading support for OpenSSL.
    // Not needed in recent (1.x?) versions.
    struct CRYPTO_dynlock_value
    {
        std::mutex Mutex;
    };
}

std::unique_ptr<SslContext> SslContext::Instance(nullptr);

SslContext::SslContext(const std::string& certFilePath,
                       const std::string& keyFilePath,
                       const std::string& caFilePath) :
    _ctx(nullptr)
{
    const std::vector<char> rand = Util::rng::getBytes(512);
    RAND_seed(&rand[0], rand.size());

    // Initialize multi-threading support.
    for (int x = 0; x < CRYPTO_num_locks(); ++x)
    {
        _mutexes.emplace_back(new std::mutex);
    }

#if OPENSSL_VERSION_NUMBER >= 0x0907000L
    OPENSSL_config(nullptr);
#endif

    SSL_library_init();
    SSL_load_error_strings();
    OpenSSL_add_all_algorithms();

    CRYPTO_set_locking_callback(&SslContext::lock);
    CRYPTO_set_id_callback(&SslContext::id);
    CRYPTO_set_dynlock_create_callback(&SslContext::dynlockCreate);
    CRYPTO_set_dynlock_lock_callback(&SslContext::dynlock);
    CRYPTO_set_dynlock_destroy_callback(&SslContext::dynlockDestroy);

    // Create the Context. We only have one,
    // as we don't expect/support different servers in same process.
#if OPENSSL_VERSION_NUMBER >= 0x10100000L
    _ctx = SSL_CTX_new(TLS_server_method());
#else
    _ctx = SSL_CTX_new(SSLv23_server_method());
#endif

    // SSL_CTX_set_default_passwd_cb(_ctx, &privateKeyPassphraseCallback);
    ERR_clear_error();
    SSL_CTX_set_options(_ctx, SSL_OP_ALL);

    try
    {
        int errCode = 0;
        if (!caFilePath.empty())
        {
            errCode = SSL_CTX_load_verify_locations(_ctx, caFilePath.c_str(), 0);
            if (errCode != 1)
            {
                std::string msg = getLastErrorMsg();
                throw std::runtime_error(std::string("Cannot load CA file/directory at ") + caFilePath + " (" + msg + ")");
            }
        }

        if (!keyFilePath.empty())
        {
            errCode = SSL_CTX_use_PrivateKey_file(_ctx, keyFilePath.c_str(), SSL_FILETYPE_PEM);
            if (errCode != 1)
            {
                std::string msg = getLastErrorMsg();
                throw std::runtime_error(std::string("Error loading private key from file ") + keyFilePath + " (" + msg + ")");
            }
        }

        if (!certFilePath.empty())
        {
            errCode = SSL_CTX_use_certificate_chain_file(_ctx, certFilePath.c_str());
            if (errCode != 1)
            {
                std::string msg = getLastErrorMsg();
                throw std::runtime_error(std::string("Error loading certificate from file ") + certFilePath + " (" + msg + ")");
            }
        }

        SSL_CTX_set_verify(_ctx, SSL_VERIFY_NONE, nullptr /*&verifyServerCallback*/);
        SSL_CTX_set_cipher_list(_ctx, "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH");
        SSL_CTX_set_verify_depth(_ctx, 9);

        // The write buffer may re-allocate, and we don't mind partial writes.
        SSL_CTX_set_mode(_ctx, SSL_MODE_ENABLE_PARTIAL_WRITE |
                               SSL_MODE_ACCEPT_MOVING_WRITE_BUFFER);
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
    EVP_cleanup();
    ERR_free_strings();
    CRYPTO_set_locking_callback(0);
    CRYPTO_set_id_callback(0);

    CONF_modules_free();

    _mutexes.clear();
}

void SslContext::uninitialize()
{
    assert (Instance);
    Instance.reset();
}

void SslContext::lock(int mode, int n, const char* /*file*/, int /*line*/)
{
    assert(n < CRYPTO_num_locks());
    if (Instance)
    {
        if (mode & CRYPTO_LOCK)
        {
            Instance->_mutexes[n]->lock();
        }
        else
        {
            Instance->_mutexes[n]->unlock();
        }
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

void SslContext::initDH()
{
#ifndef OPENSSL_NO_DH
    // 1024-bit MODP Group with 160-bit prime order subgroup (RFC5114)
    // -----BEGIN DH PARAMETERS-----
    // MIIBDAKBgQCxC4+WoIDgHd6S3l6uXVTsUsmfvPsGo8aaap3KUtI7YWBz4oZ1oj0Y
    // mDjvHi7mUsAT7LSuqQYRIySXXDzUm4O/rMvdfZDEvXCYSI6cIZpzck7/1vrlZEc4
    // +qMaT/VbzMChUa9fDci0vUW/N982XBpl5oz9p21NpwjfH7K8LkpDcQKBgQCk0cvV
    // w/00EmdlpELvuZkF+BBN0lisUH/WQGz/FCZtMSZv6h5cQVZLd35pD1UE8hMWAhe0
    // sBuIal6RVH+eJ0n01/vX07mpLuGQnQ0iY/gKdqaiTAh6CR9THb8KAWm2oorWYqTR
    // jnOvoy13nVkY0IvIhY9Nzvl8KiSFXm7rIrOy5QICAKA=
    // -----END DH PARAMETERS-----
    //

    static const unsigned char dh1024_p[] =
    {
        0xB1,0x0B,0x8F,0x96,0xA0,0x80,0xE0,0x1D,0xDE,0x92,0xDE,0x5E,
        0xAE,0x5D,0x54,0xEC,0x52,0xC9,0x9F,0xBC,0xFB,0x06,0xA3,0xC6,
        0x9A,0x6A,0x9D,0xCA,0x52,0xD2,0x3B,0x61,0x60,0x73,0xE2,0x86,
        0x75,0xA2,0x3D,0x18,0x98,0x38,0xEF,0x1E,0x2E,0xE6,0x52,0xC0,
        0x13,0xEC,0xB4,0xAE,0xA9,0x06,0x11,0x23,0x24,0x97,0x5C,0x3C,
        0xD4,0x9B,0x83,0xBF,0xAC,0xCB,0xDD,0x7D,0x90,0xC4,0xBD,0x70,
        0x98,0x48,0x8E,0x9C,0x21,0x9A,0x73,0x72,0x4E,0xFF,0xD6,0xFA,
        0xE5,0x64,0x47,0x38,0xFA,0xA3,0x1A,0x4F,0xF5,0x5B,0xCC,0xC0,
        0xA1,0x51,0xAF,0x5F,0x0D,0xC8,0xB4,0xBD,0x45,0xBF,0x37,0xDF,
        0x36,0x5C,0x1A,0x65,0xE6,0x8C,0xFD,0xA7,0x6D,0x4D,0xA7,0x08,
        0xDF,0x1F,0xB2,0xBC,0x2E,0x4A,0x43,0x71,
    };

    static const unsigned char dh1024_g[] =
    {
        0xA4,0xD1,0xCB,0xD5,0xC3,0xFD,0x34,0x12,0x67,0x65,0xA4,0x42,
        0xEF,0xB9,0x99,0x05,0xF8,0x10,0x4D,0xD2,0x58,0xAC,0x50,0x7F,
        0xD6,0x40,0x6C,0xFF,0x14,0x26,0x6D,0x31,0x26,0x6F,0xEA,0x1E,
        0x5C,0x41,0x56,0x4B,0x77,0x7E,0x69,0x0F,0x55,0x04,0xF2,0x13,
        0x16,0x02,0x17,0xB4,0xB0,0x1B,0x88,0x6A,0x5E,0x91,0x54,0x7F,
        0x9E,0x27,0x49,0xF4,0xD7,0xFB,0xD7,0xD3,0xB9,0xA9,0x2E,0xE1,
        0x90,0x9D,0x0D,0x22,0x63,0xF8,0x0A,0x76,0xA6,0xA2,0x4C,0x08,
        0x7A,0x09,0x1F,0x53,0x1D,0xBF,0x0A,0x01,0x69,0xB6,0xA2,0x8A,
        0xD6,0x62,0xA4,0xD1,0x8E,0x73,0xAF,0xA3,0x2D,0x77,0x9D,0x59,
        0x18,0xD0,0x8B,0xC8,0x85,0x8F,0x4D,0xCE,0xF9,0x7C,0x2A,0x24,
        0x85,0x5E,0x6E,0xEB,0x22,0xB3,0xB2,0xE5,
    };

    DH* dh = DH_new();
    if (!dh)
    {
        std::string msg = getLastErrorMsg();
        throw std::runtime_error("Error creating Diffie-Hellman parameters: " + msg);
    }

    dh->p = BN_bin2bn(dh1024_p, sizeof(dh1024_p), 0);
    dh->g = BN_bin2bn(dh1024_g, sizeof(dh1024_g), 0);
    dh->length = 160;
    if ((!dh->p) || (!dh->g))
    {
        DH_free(dh);
        throw std::runtime_error("Error creating Diffie-Hellman parameters");
    }

    SSL_CTX_set_tmp_dh(_ctx, dh);
    SSL_CTX_set_options(_ctx, SSL_OP_SINGLE_DH_USE);
    DH_free(dh);
#endif
}

void SslContext::initECDH()
{
#if OPENSSL_VERSION_NUMBER >= 0x0090800fL
#ifndef OPENSSL_NO_ECDH
    const int nid = OBJ_sn2nid("prime256v1");
    if (nid == 0)
    {
        throw std::runtime_error("Unknown ECDH curve name: prime256v1");
    }

    EC_KEY* ecdh = EC_KEY_new_by_curve_name(nid);
    if (!ecdh)
    {
        throw std::runtime_error("Cannot create ECDH curve");
    }

    SSL_CTX_set_tmp_ecdh(_ctx, ecdh);
    SSL_CTX_set_options(_ctx, SSL_OP_SINGLE_ECDH_USE);
    EC_KEY_free(ecdh);
#endif
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
