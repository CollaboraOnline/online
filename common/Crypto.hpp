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

#pragma once

#if ENABLE_SUPPORT_KEY

#include <memory>

struct SupportKeyImpl;
namespace Poco {
    class DateTime;
}

class SupportKey {
    std::unique_ptr<SupportKeyImpl> _impl;

public:
    SupportKey(const std::string &key);
    virtual ~SupportKey();

    /// Check the key is validly signed.
    bool verify();

    /// How many days until key expires
    int validDaysRemaining();

    Poco::DateTime expiry() const;

    std::string data() const;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
