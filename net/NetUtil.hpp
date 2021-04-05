/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <string>
#include <memory>

// This file hosts network related common functionality
// and helper/utility functions and classes.
// HTTP-specific helpers are in HttpHeler.hpp.

class StreamSocket;
class ProtocolHandlerInterface;

namespace net
{
/// Connect to an end-point at the given host and port and return StreamSocket.
std::shared_ptr<StreamSocket>
connect(const std::string& host, const std::string& port, const bool isSSL,
        const std::shared_ptr<ProtocolHandlerInterface>& protocolHandler);

/// Connect to an end-point at the given @uri and return StreamSocket.
std::shared_ptr<StreamSocket>
connect(std::string uri, const std::shared_ptr<ProtocolHandlerInterface>& protocolHandler);

/// Decomposes a URI into its components.
/// Returns true if parsing was successful.
bool parseUri(std::string uri, std::string& scheme, std::string& host, std::string& port,
              std::string& url);

/// Decomposes a URI into its components.
/// Returns true if parsing was successful.
inline bool parseUri(std::string uri, std::string& scheme, std::string& host, std::string& port)
{
    std::string url;
    return parseUri(std::move(uri), scheme, host, port, url);
}

/// Return the locator given a URI.
inline std::string parseUrl(const std::string& uri)
{
    auto itScheme = uri.find("://");
    if (itScheme != uri.npos)
    {
        itScheme += 3; // Skip it.
    }
    else
    {
        itScheme = 0;
    }

    const auto itUrl = uri.find('/', itScheme);
    if (itUrl != uri.npos)
    {
        return uri.substr(itUrl); // Including the first foreslash.
    }

    return std::string();
}

} // namespace net