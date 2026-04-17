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
 * Implementation of MCP JSON-RPC response utility functions.
 */

#include <config.h>

#include "McpResponseUtil.hpp"

#include <common/base64.hpp>

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Array.h>

#include <sstream>
#include <string>

namespace McpResponseUtil
{

std::string wrapJsonResult(const std::string& id, const std::string& jsonBody)
{
    Poco::JSON::Object::Ptr content = new Poco::JSON::Object;
    content->set("type", "text");
    content->set("text", jsonBody);

    Poco::JSON::Array::Ptr contentArray = new Poco::JSON::Array;
    contentArray->add(content);

    Poco::JSON::Object::Ptr result = new Poco::JSON::Object;
    result->set("content", contentArray);

    Poco::JSON::Object::Ptr response = new Poco::JSON::Object;
    response->set("jsonrpc", "2.0");
    response->set("id", id);
    response->set("result", result);

    std::ostringstream oss;
    response->stringify(oss);
    return oss.str();
}

std::string wrapBinaryResult(const std::string& id, const char* data, std::size_t size,
                             const std::string& mimeType)
{
    std::string encoded = macaron::Base64::Encode(std::string_view(data, size));

    Poco::JSON::Object::Ptr resource = new Poco::JSON::Object;
    // The uri is a data URI prefix for identification; actual data is in the blob field per MCP spec.
    resource->set("uri", "data:" + mimeType + ";base64,");
    resource->set("mimeType", mimeType);
    resource->set("blob", encoded);

    Poco::JSON::Object::Ptr content = new Poco::JSON::Object;
    content->set("type", "resource");
    content->set("resource", resource);

    Poco::JSON::Array::Ptr contentArray = new Poco::JSON::Array;
    contentArray->add(content);

    Poco::JSON::Object::Ptr result = new Poco::JSON::Object;
    result->set("content", contentArray);

    Poco::JSON::Object::Ptr response = new Poco::JSON::Object;
    response->set("jsonrpc", "2.0");
    response->set("id", id);
    response->set("result", result);

    std::ostringstream oss;
    response->stringify(oss);
    return oss.str();
}

std::string makeJsonRpcError(const std::string& id, int code, const std::string& message)
{
    Poco::JSON::Object::Ptr error = new Poco::JSON::Object;
    error->set("code", code);
    error->set("message", message);

    Poco::JSON::Object::Ptr response = new Poco::JSON::Object;
    response->set("jsonrpc", "2.0");
    response->set("id", id);
    response->set("error", error);

    std::ostringstream oss;
    response->stringify(oss);
    return oss.str();
}

std::string mimeTypeFromExtension(const std::string& ext)
{
    if (ext == "pdf")
        return "application/pdf";
    if (ext == "docx")
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext == "xlsx")
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (ext == "pptx")
        return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (ext == "odt")
        return "application/vnd.oasis.opendocument.text";
    if (ext == "ods")
        return "application/vnd.oasis.opendocument.spreadsheet";
    if (ext == "odp")
        return "application/vnd.oasis.opendocument.presentation";
    if (ext == "odg")
        return "application/vnd.oasis.opendocument.graphics";
    if (ext == "rtf")
        return "application/rtf";
    if (ext == "html")
        return "text/html";
    if (ext == "txt")
        return "text/plain";
    if (ext == "csv")
        return "text/csv";
    if (ext == "png")
        return "image/png";
    if (ext == "svg")
        return "image/svg+xml";
    return "application/octet-stream";
}

} // namespace McpResponseUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
