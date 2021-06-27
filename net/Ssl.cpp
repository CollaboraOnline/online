/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <assert.h>
#include <unistd.h>
#include "Ssl.hpp"

#ifdef __FreeBSD__
#include <pthread_np.h>
#endif

#include <sys/syscall.h>
#include <Util.hpp>

extern "C"
{
    // Multithreading support for OpenSSL.
    // Not needed in recent (1.x?) versions.
    struct CRYPTO_dynlock_value
    {
    public:
        void lock() { _mutex.lock(); }
        void unlock() { _mutex.unlock(); }
    private:
        std::mutex _mutex;
    };
}

namespace ssl
{

// The locking API is removed from 1.1 onward.
#if OPENSSL_VERSION_NUMBER < 0x10100000L

/// Manages the SSL locks.
class Lock
{
public:
    Lock()
    {
        for (int x = 0; x < CRYPTO_num_locks(); ++x)
        {
            _mutexes.emplace_back(new std::mutex);
        }
    }

    void lock(int mode, int n)
    {
        assert(n < CRYPTO_num_locks() && "Unexpected lock index");
        if (mode & CRYPTO_LOCK)
        {
            _mutexes[n]->lock();
        }
        else
        {
            _mutexes[n]->unlock();
        }
    }

private:
    std::vector<std::unique_ptr<std::mutex>> _mutexes;
};

/// Locks are shared across SSL Contexts (by openssl design).
static inline void lock(int mode, int n, const char* /*file*/, int /*line*/)
{
    static ssl::Lock lock;
    lock.lock(mode, n);
}

#endif
} // namespace ssl

std::unique_ptr<SslContext> ssl::Manager::ServerInstance(nullptr);
std::unique_ptr<SslContext> ssl::Manager::ClientInstance(nullptr);

SslContext::SslContext(const std::string& certFilePath, const std::string& keyFilePath,
                       const std::string& caFilePath, const std::string& cipherList,
                       ssl::CertificateVerification verification)
    : _ctx(nullptr)
    , _verification(verification)
{
    const std::vector<char> rand = Util::rng::getBytes(512);
    RAND_seed(&rand[0], rand.size());

#if OPENSSL_VERSION_NUMBER >= 0x0907000L && OPENSSL_VERSION_NUMBER < 0x10100003L
    OPENSSL_config(nullptr);
#endif

#if OPENSSL_VERSION_NUMBER >= 0x10100003L
    OPENSSL_init_ssl(OPENSSL_INIT_LOAD_CONFIG, nullptr);
#else
    SSL_library_init();
    SSL_load_error_strings();
    OpenSSL_add_all_algorithms();
#endif

    CRYPTO_set_locking_callback(&ssl::lock);
    CRYPTO_set_id_callback(&SslContext::id);
    CRYPTO_set_dynlock_create_callback(&SslContext::dynlockCreate);
    CRYPTO_set_dynlock_lock_callback(&SslContext::dynlock);
    CRYPTO_set_dynlock_destroy_callback(&SslContext::dynlockDestroy);

    // Create the Context. We only have one,
    // as we don't expect/support different servers in same process.
#if OPENSSL_VERSION_NUMBER >= 0x10100000L
    _ctx = SSL_CTX_new(TLS_method());
    SSL_CTX_set_min_proto_version(_ctx, TLS1_VERSION);
#else
    _ctx = SSL_CTX_new(SSLv23_method());
    SSL_CTX_set_options(_ctx, SSL_OP_NO_SSLv3);
#endif

    // SSL_CTX_set_default_passwd_cb(_ctx, &privateKeyPassphraseCallback);
    ERR_clear_error();
    SSL_CTX_set_options(_ctx, SSL_OP_ALL);

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

        SSL_CTX_set_verify(_ctx, SSL_VERIFY_NONE, nullptr /*&verifyServerCallback*/);
        SSL_CTX_set_cipher_list(_ctx, cipherList.c_str());
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
    SSL_CTX_free(_ctx);
    EVP_cleanup();
    ERR_free_strings();
    CRYPTO_set_locking_callback(0);
    CRYPTO_set_id_callback(0);

    CONF_modules_free();
}

unsigned long SslContext::id()
{
#ifdef __linux__
    return syscall(SYS_gettid);
#elif defined(__FreeBSD__)
    return pthread_getthreadid_np();
#else
#error Implement for your platform
#endif
}

CRYPTO_dynlock_value* SslContext::dynlockCreate(const char* /*file*/, int /*line*/)
{
    return new CRYPTO_dynlock_value;
}

void SslContext::dynlock(int mode, struct CRYPTO_dynlock_value* lock, const char* /*file*/, int /*line*/)
{
    if (mode & CRYPTO_LOCK)
    {
        lock->lock();
    }
    else
    {
        lock->unlock();
    }
}

void SslContext::dynlockDestroy(struct CRYPTO_dynlock_value* lock, const char* /*file*/, int /*line*/)
{
    delete lock;
}

void SslContext::initDH()
{
#ifndef OPENSSL_NO_DH
    // 2048-bit MODP Group with 256-bit prime order subgroup (RFC5114)

    static const unsigned char dh2048_p[] =
    {
        0x87,0xA8,0xE6,0x1D,0xB4,0xB6,0x66,0x3C,0xFF,0xBB,0xD1,0x9C,
        0x65,0x19,0x59,0x99,0x8C,0xEE,0xF6,0x08,0x66,0x0D,0xD0,0xF2,
        0x5D,0x2C,0xEE,0xD4,0x43,0x5E,0x3B,0x00,0xE0,0x0D,0xF8,0xF1,
        0xD6,0x19,0x57,0xD4,0xFA,0xF7,0xDF,0x45,0x61,0xB2,0xAA,0x30,
        0x16,0xC3,0xD9,0x11,0x34,0x09,0x6F,0xAA,0x3B,0xF4,0x29,0x6D,
        0x83,0x0E,0x9A,0x7C,0x20,0x9E,0x0C,0x64,0x97,0x51,0x7A,0xBD,
        0x5A,0x8A,0x9D,0x30,0x6B,0xCF,0x67,0xED,0x91,0xF9,0xE6,0x72,
        0x5B,0x47,0x58,0xC0,0x22,0xE0,0xB1,0xEF,0x42,0x75,0xBF,0x7B,
        0x6C,0x5B,0xFC,0x11,0xD4,0x5F,0x90,0x88,0xB9,0x41,0xF5,0x4E,
        0xB1,0xE5,0x9B,0xB8,0xBC,0x39,0xA0,0xBF,0x12,0x30,0x7F,0x5C,
        0x4F,0xDB,0x70,0xC5,0x81,0xB2,0x3F,0x76,0xB6,0x3A,0xCA,0xE1,
        0xCA,0xA6,0xB7,0x90,0x2D,0x52,0x52,0x67,0x35,0x48,0x8A,0x0E,
        0xF1,0x3C,0x6D,0x9A,0x51,0xBF,0xA4,0xAB,0x3A,0xD8,0x34,0x77,
        0x96,0x52,0x4D,0x8E,0xF6,0xA1,0x67,0xB5,0xA4,0x18,0x25,0xD9,
        0x67,0xE1,0x44,0xE5,0x14,0x05,0x64,0x25,0x1C,0xCA,0xCB,0x83,
        0xE6,0xB4,0x86,0xF6,0xB3,0xCA,0x3F,0x79,0x71,0x50,0x60,0x26,
        0xC0,0xB8,0x57,0xF6,0x89,0x96,0x28,0x56,0xDE,0xD4,0x01,0x0A,
        0xBD,0x0B,0xE6,0x21,0xC3,0xA3,0x96,0x0A,0x54,0xE7,0x10,0xC3,
        0x75,0xF2,0x63,0x75,0xD7,0x01,0x41,0x03,0xA4,0xB5,0x43,0x30,
        0xC1,0x98,0xAF,0x12,0x61,0x16,0xD2,0x27,0x6E,0x11,0x71,0x5F,
        0x69,0x38,0x77,0xFA,0xD7,0xEF,0x09,0xCA,0xDB,0x09,0x4A,0xE9,
        0x1E,0x1A,0x15,0x97,

    };

    static const unsigned char dh2048_g[] =
    {
        0x3F,0xB3,0x2C,0x9B,0x73,0x13,0x4D,0x0B,0x2E,0x77,0x50,0x66,
        0x60,0xED,0xBD,0x48,0x4C,0xA7,0xB1,0x8F,0x21,0xEF,0x20,0x54,
        0x07,0xF4,0x79,0x3A,0x1A,0x0B,0xA1,0x25,0x10,0xDB,0xC1,0x50,
        0x77,0xBE,0x46,0x3F,0xFF,0x4F,0xED,0x4A,0xAC,0x0B,0xB5,0x55,
        0xBE,0x3A,0x6C,0x1B,0x0C,0x6B,0x47,0xB1,0xBC,0x37,0x73,0xBF,
        0x7E,0x8C,0x6F,0x62,0x90,0x12,0x28,0xF8,0xC2,0x8C,0xBB,0x18,
        0xA5,0x5A,0xE3,0x13,0x41,0x00,0x0A,0x65,0x01,0x96,0xF9,0x31,
        0xC7,0x7A,0x57,0xF2,0xDD,0xF4,0x63,0xE5,0xE9,0xEC,0x14,0x4B,
        0x77,0x7D,0xE6,0x2A,0xAA,0xB8,0xA8,0x62,0x8A,0xC3,0x76,0xD2,
        0x82,0xD6,0xED,0x38,0x64,0xE6,0x79,0x82,0x42,0x8E,0xBC,0x83,
        0x1D,0x14,0x34,0x8F,0x6F,0x2F,0x91,0x93,0xB5,0x04,0x5A,0xF2,
        0x76,0x71,0x64,0xE1,0xDF,0xC9,0x67,0xC1,0xFB,0x3F,0x2E,0x55,
        0xA4,0xBD,0x1B,0xFF,0xE8,0x3B,0x9C,0x80,0xD0,0x52,0xB9,0x85,
        0xD1,0x82,0xEA,0x0A,0xDB,0x2A,0x3B,0x73,0x13,0xD3,0xFE,0x14,
        0xC8,0x48,0x4B,0x1E,0x05,0x25,0x88,0xB9,0xB7,0xD2,0xBB,0xD2,
        0xDF,0x01,0x61,0x99,0xEC,0xD0,0x6E,0x15,0x57,0xCD,0x09,0x15,
        0xB3,0x35,0x3B,0xBB,0x64,0xE0,0xEC,0x37,0x7F,0xD0,0x28,0x37,
        0x0D,0xF9,0x2B,0x52,0xC7,0x89,0x14,0x28,0xCD,0xC6,0x7E,0xB6,
        0x18,0x4B,0x52,0x3D,0x1D,0xB2,0x46,0xC3,0x2F,0x63,0x07,0x84,
        0x90,0xF0,0x0E,0xF8,0xD6,0x47,0xD1,0x48,0xD4,0x79,0x54,0x51,
        0x5E,0x23,0x27,0xCF,0xEF,0x98,0xC5,0x82,0x66,0x4B,0x4C,0x0F,
        0x6C,0xC4,0x16,0x59,
    };

    DH* dh = DH_new();
    if (!dh)
    {
        std::string msg = getLastErrorMsg();
        throw std::runtime_error("Error creating Diffie-Hellman parameters: " + msg);
    }

#if OPENSSL_VERSION_NUMBER >= 0x10100003L
    // OpenSSL v1.1.0 has public API changes
    // p, g and length of the Diffie-Hellman param can't be set directly anymore,
    // instead DH_set0_pqg and DH_set_length are used
    BIGNUM* p = BN_bin2bn(dh2048_p, sizeof(dh2048_p), nullptr);
    BIGNUM* g = BN_bin2bn(dh2048_g, sizeof(dh2048_g), nullptr);
    if ((DH_set0_pqg(dh, p, nullptr, g) == 0) || (DH_set_length(dh, 256) == 0))
#else
    dh->p = BN_bin2bn(dh2048_p, sizeof(dh2048_p), 0);
    dh->g = BN_bin2bn(dh2048_g, sizeof(dh2048_g), 0);
    dh->length = 256;
    if ((!dh->p) || (!dh->g))
#endif
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
#ifndef OPENSSL_NO_ECDH
#if OPENSSL_VERSION_NUMBER >= 0x10100003L
#if OPENSSL_VERSION_NUMBER >= 0x10200000L
    #define DEFAULT_TLS_GROUPS "X448:X25519:P-521:P-384:P-256:ffdhe2048:ffdhe3072:ffdhe4096:ffdhe6144:ffdhe8192"
#elif OPENSSL_VERSION_NUMBER < 0x10101000L
    #define SSL_CTX_set1_groups_list SSL_CTX_set1_curves_list
    #define DEFAULT_TLS_GROUPS "P-521:P-384:P-256"
#else
    #define DEFAULT_TLS_GROUPS "X448:X25519:P-521:P-384:P-256"
#endif
    if (SSL_CTX_set1_groups_list(_ctx, DEFAULT_TLS_GROUPS) == 0)
    {
        throw std::runtime_error("Cannot set ECDH groups: " DEFAULT_TLS_GROUPS);
    }
    SSL_CTX_set_options(_ctx, SSL_OP_SINGLE_ECDH_USE);
#elif OPENSSL_VERSION_NUMBER >= 0x0090800fL
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
