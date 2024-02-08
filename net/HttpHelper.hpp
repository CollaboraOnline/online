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

#include "Util.hpp"
#include <memory>
#include <string>

#include <HttpRequest.hpp>

class StreamSocket;

namespace HttpHelper
{
/// Write headers and body for an error response.
void sendError(http::StatusCode errorCode, const std::shared_ptr<StreamSocket>& socket,
               const std::string& body = std::string(),
               const std::string& extraHeader = std::string());

/// Write headers and body for an error response. Afterwards, shutdown the socket.
void sendErrorAndShutdown(http::StatusCode errorCode, const std::shared_ptr<StreamSocket>& socket,
                          const std::string& body = std::string(),
                          const std::string& extraHeader = std::string());

/// Sends file as HTTP response and shutdown the socket.
void sendFileAndShutdown(const std::shared_ptr<StreamSocket>& socket, const std::string& path,
                         http::Response& response,
                         bool noCache = false, bool deflate = false, const bool headerOnly = false);

/// Verifies that the given WOPISrc is properly URI-encoded.
/// Warns if it isn't and, in debug builds, closes the socket (if given) and returns false.
/// The idea is to only warn in release builds, but to help developers in debug builds.
/// Returns false only in debug build.
inline bool verifyWOPISrc(const std::string& uri, const std::string& wopiSrc,
                          const std::shared_ptr<StreamSocket>& socket = {})
{
    // getQueryParameters(), which is used to extract wopiSrc, decodes the values.
    // Compare with the URI. WopiSrc is complex enough to require encoding.
    // But, if it matches, check if the WOPISrc actually needed encoding.
    if (uri.find(wopiSrc) != std::string::npos && Util::needsURIEncoding(wopiSrc))
    {
#if !ENABLE_DEBUG
        (void)socket;
        static bool warnedOnce = false;
        if (!warnedOnce)
        {
            LOG_WRN_S("WOPISrc validation error: unencoded WOPISrc ["
                      << wopiSrc << "] in URL [" << uri
                      << "]. WOPISrc must be URI-encoded. This is highly problematic with proxies, "
                         "load balancers, and when tunneling. Will not warn again");
            warnedOnce = true;
        }
#else
        // In debug mode, be assertive. Logs might go unnoticed.
        LOG_ERR_S("WOPISrc validation error: unencoded WOPISrc ["
                  << wopiSrc << "] in URL [" << uri
                  << "]. This is highly problematic with proxies, load balancers, and when "
                     "tunneling");
        if (socket)
        {
            sendErrorAndShutdown(http::StatusCode::BadRequest, socket,
                                 "WOPISrc must be URI-encoded");
        }

        return false;
#endif // ENABLE_DEBUG
    }

    return true;
}

} // namespace HttpHelper

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
