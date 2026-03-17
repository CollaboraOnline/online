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

/*
 * Utility functions for building MCP (Model Context Protocol) JSON-RPC responses.
 */

#pragma once

#include <cstddef>
#include <string>

namespace McpResponseUtil
{

/// Build a JSON-RPC result that wraps a JSON string as MCP text content.
std::string wrapJsonResult(const std::string& id, const std::string& jsonBody);

/// Build a JSON-RPC result that wraps binary data as a base64-encoded MCP resource.
std::string wrapBinaryResult(const std::string& id, const char* data, std::size_t size,
                             const std::string& mimeType);

/// Build a JSON-RPC error response.
std::string makeJsonRpcError(const std::string& id, int code, const std::string& message);

/// Map a file extension to a MIME type for common document/image formats.
/// Returns "application/octet-stream" for unrecognized extensions.
std::string mimeTypeFromExtension(const std::string& ext);

} // namespace McpResponseUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
