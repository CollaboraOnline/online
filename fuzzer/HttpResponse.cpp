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

#include "config.h"

#include <net/HttpRequest.hpp>
#include <fuzzer/Common.hpp>

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size)
{
    static bool initialized = fuzzer::DoInitialization();
    (void)initialized;

    for (size_t i = 0; i < size; ++i)
    {
        http::Response response;
        response.readData(reinterpret_cast<const char*>(data), i);
    }
    return 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
