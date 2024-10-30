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

#include <chrono>
#include <functional>
#include <string>
#include <memory>
#include <vector>

// This file hosts network related common functionality
// and helper/utility functions and classes.
// HTTP-specific helpers are in HttpHelper.hpp.

class StreamSocket;
class ProtocolHandlerInterface;
struct addrinfo;
struct sockaddr;

namespace net
{

class DefaultValues
{
public:
    /// StreamSocket inactivity timeout in us (3600s default). Zero disables instrument.
    std::chrono::microseconds inactivityTimeout;
    /// WebSocketHandler average ping timeout in us (12s default). Zero disables instrument.
    std::chrono::microseconds wsPingAvgTimeout;
    /// WebSocketHandler ping interval in us (18s default), i.e. duration until next ping. Zero disables instrument.
    std::chrono::microseconds wsPingInterval;

    /// Maximum number of concurrent external TCP connections. Zero disables instrument.
    size_t maxExtConnections;
};
extern DefaultValues Defaults;

class HostEntry
{
    std::string _requestName;
    std::string _canonicalName;
    std::vector<std::string> _ipAddresses;
    std::shared_ptr<addrinfo> _ainfo;
    int _errno;
    int _eaino;

    void setEAI(int eaino);

    std::string makeIPAddress(const sockaddr* ai_addr);

public:
    HostEntry(const std::string& desc, const char* port);
    ~HostEntry();

    bool good() const { return _errno == 0 && _eaino == 0; }
    std::string errorMessage() const;

    const std::string& getCanonicalName() const { return  _canonicalName; }
    const std::vector<std::string>& getAddresses() const { return  _ipAddresses; }
    const addrinfo* getAddrInfo() const { return _ainfo.get(); }

    std::string resolveHostAddress() const;
    bool isLocalhost() const;
};

#if !MOBILEAPP

/// Resolves the IP of the given hostname. On failure, returns @targetHost.
std::string resolveHostAddress(const std::string& targetHost);

/// Returns true if @targetHost is on the same host.
bool isLocalhost(const std::string& targetHost);

/// Returns the canonical host name of the given IP address or host name.
std::string canonicalHostName(const std::string& addressToCheck);

/// Returns a vector containing the IPAddresses for the host.
std::vector<std::string> resolveAddresses(const std::string& addressToCheck);

#endif

/// Connect to an end-point at the given host and port and return StreamSocket.
std::shared_ptr<StreamSocket>
connect(const std::string& host, const std::string& port, const bool isSSL,
        const std::shared_ptr<ProtocolHandlerInterface>& protocolHandler);

typedef std::function<void(std::shared_ptr<StreamSocket>)> asyncConnectCB;

void
asyncConnect(const std::string& host, const std::string& port, const bool isSSL,
             const std::shared_ptr<ProtocolHandlerInterface>& protocolHandler,
             const asyncConnectCB& asyncCb);

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
