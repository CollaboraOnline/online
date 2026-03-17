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
 * MCP (Model Context Protocol) handler for JSON-RPC over HTTP.
 * Exposes existing stateless batch APIs as MCP tools.
 */

#pragma once

#include <Socket.hpp>

#include <memory>
#include <string>

class SocketDisposition;

/// Handles MCP JSON-RPC requests at the /cool/mcp endpoint.
class McpHandler
{
public:
    /// Handle a JSON-RPC request body. Returns true if the response was sent
    /// synchronously (initialize, tools/list, errors). Returns false if the
    /// request was dispatched to a broker and the response will come later.
    /// @p uploadUrl is the absolute URL of the /cool/mcp/upload endpoint,
    /// returned to clients by the prepare_upload tool.
    static bool handleRequest(const std::string& body,
                              const std::shared_ptr<StreamSocket>& socket,
                              SocketDisposition& disposition,
                              const std::string& id,
                              const std::string& uploadUrl);

    /// Build the JSON-RPC response for the "initialize" method.
    static std::string handleInitialize(const std::string& requestId);

    /// Build the JSON-RPC response for the "tools/list" method.
    static std::string handleToolsList(const std::string& requestId);

    /// Register an uploaded file and return a unique file ID.
    static std::string registerUpload(std::string path);

    /// Look up a previously uploaded file by ID. Returns the path, or empty if
    /// the ID is unknown or expired.
    static std::string lookupUpload(const std::string& fileId);

    /// Generate and store a single-use upload token valid for a short time.
    static std::string registerUploadToken();

    /// Consume an upload token. Returns true if the token was valid and is
    /// now burned. Returns false if the token is unknown or expired.
    static bool consumeUploadToken(const std::string& token);
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
