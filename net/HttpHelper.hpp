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

} // namespace HttpHelper

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
