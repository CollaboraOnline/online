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

namespace net
{

/// Decomposes a URI into its components.
/// Returns true if parsing was successful.
inline bool parseUri(std::string uri, std::string& scheme, std::string& host, std::string& port,
                     std::string& pathAndQuery)
{
    const auto itScheme = uri.find("://");
    if (itScheme != uri.npos)
    {
        scheme = uri.substr(0, itScheme + 3); // Include the last slash.
        uri = uri.substr(scheme.size()); // Remove the scheme.
    }
    else
    {
        // No scheme.
        scheme.clear();
    }

    const auto itUrl = uri.find('/');
    if (itUrl != uri.npos)
    {
        pathAndQuery = uri.substr(itUrl); // Including the first slash.
        uri = uri.substr(0, itUrl);
    }
    else
    {
        pathAndQuery.clear();
    }

    const auto itPort = uri.find(':');
    if (itPort != uri.npos)
    {
        host = uri.substr(0, itPort);
        port = uri.substr(itPort + 1); // Skip the colon.
    }
    else
    {
        // No port, just hostname.
        host = std::move(uri);
        port.clear();
    }

    return !host.empty();
}

/// Decomposes a URI into its components.
/// Returns true if parsing was successful.
inline bool parseUri(std::string uri, std::string& scheme, std::string& host, std::string& port)
{
    std::string pathAndQuery;
    return parseUri(std::move(uri), scheme, host, port, pathAndQuery);
}

/// Return the locator given a URI.
inline std::string parseUrl(const std::string& uri)
{
    std::size_t itScheme = uri.find("://");
    if (itScheme != uri.npos)
    {
        itScheme += 3; // Skip it.
    }
    else
    {
        itScheme = 0;
    }

    const std::size_t itUrl = uri.find('/', itScheme);
    if (itUrl != uri.npos)
    {
        return uri.substr(itUrl); // Including the first slash.
    }

    return std::string();
}

} // namespace net

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
