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

#include <string>
#include <utility>

/// Represents a URI/URL with helpers to manipulate it.
/// Intended to encapsulate, and then replace, Poco::URI.
class Uri
{
public:
    template <typename T>
    explicit Uri(T&& uri)
        : _uri(std::forward<T>(uri))
    {
    }

    /// Returns the URI as a string.
    const std::string& uri() const { return _uri; }

    /// URI-encode the given URI with the given reserved characters (that need encoding).
    static std::string encode(const std::string& uri, const std::string& reserved = ",/?:@&=+$#");

    /// URI-encode and return the URI with the given reserved characters (that need encoding).
    std::string encoded(const std::string& reserved = ",/?:@&=+$#") const
    {
        return encode(_uri, reserved);
    }

    /// URI-decode the given URI.
    static std::string decode(const std::string& uri);

    /// URI-decode and return the URI.
    std::string decoded() const { return decode(_uri); }

private:
    std::string _uri;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
