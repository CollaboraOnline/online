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
#include <memory>
#include <string>

#include <Poco/URI.h>
#include <Poco/Util/Application.h>

#include "Authorization.hpp"
#include "HttpRequest.hpp"

/// A Storage Manager is responsible for the settings
/// of Storage and the creation of http::Session and
/// related objects.
class StorageConnectionManager final
{
public:
    static std::shared_ptr<StorageConnectionManager> create()
    {
        static std::weak_ptr<StorageConnectionManager> instance;
        std::shared_ptr<StorageConnectionManager> sm = instance.lock();
        if (!sm)
        {
            sm = std::shared_ptr<StorageConnectionManager>(new StorageConnectionManager());
            instance = sm;
        }

        return sm;
    }

    /// Create an http::Session from a URI.
    /// The configured timeout (net.connection_timeout_secs) is used when 0 is given.
    static std::shared_ptr<http::Session>
    getHttpSession(const Poco::URI& uri,
                   std::chrono::seconds timeout = std::chrono::seconds::zero());

    /// Create an http::Request with the common headers.
    static http::Request createHttpRequest(const Poco::URI& uri, const Authorization& auth);

    static void initialize();

private:
    StorageConnectionManager() {}

    /// Sanitize a URI by removing authorization tokens.
    Poco::URI sanitizeUri(Poco::URI uri)
    {
        static const std::string access_token("access_token");

        Poco::URI::QueryParameters queryParams = uri.getQueryParameters();
        for (auto& param : queryParams)
        {
            // Sanitize more params as needed.
            if (param.first == access_token)
            {
                // If access_token exists, clear it. But don't add it if not provided.
                param.second.clear();
                uri.setQueryParameters(queryParams);
                break;
            }
        }

        return uri;
    }

    /// Saves new URI when resource was moved
    // void setUri(const Poco::URI& uri) { _uri = sanitizeUri(uri); }

    /// If true, use only the WOPI URL for whether to use SSL to talk to storage server
    static bool SSLAsScheme;
    /// If true, force SSL communication with storage server
    static bool SSLEnabled;
};
