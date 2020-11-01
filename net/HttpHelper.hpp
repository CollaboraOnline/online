/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <memory>
#include <string>

namespace Poco
{
    namespace Net
    {
        class HTTPResponse;
    }
}

class StreamSocket;

namespace HttpHelper
{
/// Write headers and body for an error response.
void sendError(int errorCode, const std::shared_ptr<StreamSocket>& socket,
               const std::string& body = std::string(),
               const std::string& extraHeader = std::string());

/// Write headers and body for an error response. Afterwards, shutdown the socket.
void sendErrorAndShutdown(int errorCode, const std::shared_ptr<StreamSocket>& socket,
                          const std::string& body = std::string(),
                          const std::string& extraHeader = std::string());

/// Sends file as HTTP response and shutdown the socket.
void sendFileAndShutdown(const std::shared_ptr<StreamSocket>& socket, const std::string& path,
                         const std::string& mediaType,
                         Poco::Net::HTTPResponse* optResponse = nullptr, bool noCache = false,
                         bool deflate = false, const bool headerOnly = false);

} // namespace HttpHelper

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
