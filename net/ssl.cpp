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

std::atomic<int> SslContext::RefCount(0);
std::unique_ptr<SslContext> SslContext::Instance;

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
}

SslContext::~SslContext()
{
    EVP_cleanup();
    ERR_free_strings();
    CRYPTO_set_locking_callback(0);
    CRYPTO_set_id_callback(0);

    CONF_modules_free();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
