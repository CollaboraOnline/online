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
 * MCP (Model Context Protocol) handler implementation.
 * Exposes existing stateless batch APIs as MCP tools via JSON-RPC 2.0.
 */

#include <config.h>

#include "McpHandler.hpp"
#include "McpResponseUtil.hpp"

#include <ClientSession.hpp>
#include <COOLWSD.hpp>
#include <common/FileUtil.hpp>
#include <common/JailUtil.hpp>
#include <common/JsonUtil.hpp>
#include <common/Log.hpp>
#include <common/Util.hpp>
#include <common/base64.hpp>
#include <net/HttpHelper.hpp>
#include <wsd/DocumentBroker.hpp>
#include <wsd/DocumentToolDescriptions.hpp>
#include <wsd/SpecialBrokers.hpp>

#include <Poco/JSON/Array.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Path.h>
#include <Poco/URI.h>

#include <algorithm>
#include <chrono>
#include <fstream>
#include <mutex>
#include <sstream>
#include <unordered_map>

extern std::map<std::string, std::shared_ptr<DocumentBroker>> DocBrokers;
extern std::mutex DocBrokersMutex;

namespace
{
/// Uploaded files: file_id -> (path, expiry). Consumed on lookup, expired by
/// TTL, and evicted once the map is full. The broker deletes the source file
/// after a successful conversion; this map's sweep deletes the file when an
/// entry expires or is evicted without ever being claimed.
struct UploadEntry
{
    std::string path;
    std::chrono::steady_clock::time_point expiry;
};
std::unordered_map<std::string, UploadEntry> uploads;
std::mutex uploadsMutex;
constexpr std::chrono::minutes uploadTtl{ 10 };
constexpr std::size_t maxUploads = 256;

/// Pending upload tokens: token -> expiry time. Single-use; consumed on auth.
/// A token only authenticates a POST to /cool/mcp/upload.
std::unordered_map<std::string, std::chrono::steady_clock::time_point> uploadTokens;
std::mutex uploadTokensMutex;
constexpr std::chrono::seconds uploadTokenTtl{ 60 };

/// Drop expired token entries. Call with uploadTokensMutex held.
void sweepExpiredUploadTokens(std::chrono::steady_clock::time_point now)
{
    for (auto it = uploadTokens.begin(); it != uploadTokens.end();)
        it = (it->second <= now) ? uploadTokens.erase(it) : std::next(it);
}

/// Drop expired upload entries and delete their on-disk temp files.
/// Call with uploadsMutex held.
void sweepExpiredUploads(std::chrono::steady_clock::time_point now)
{
    for (auto it = uploads.begin(); it != uploads.end();)
    {
        if (it->second.expiry <= now)
        {
            LOG_TRC("MCP: expiring upload " << it->first);
            StatelessBatchBroker::removeFile(it->second.path);
            it = uploads.erase(it);
        }
        else
            ++it;
    }
}

/// Build a JSON Schema object describing an input parameter.
Poco::JSON::Object::Ptr makeParam(const std::string& type, const std::string& description)
{
    Poco::JSON::Object::Ptr obj = new Poco::JSON::Object;
    obj->set("type", type);
    obj->set("description", description);
    return obj;
}

/// Build a complete MCP tool definition.
Poco::JSON::Object::Ptr
makeTool(const std::string& name, const std::string& description,
         std::initializer_list<std::pair<std::string, Poco::JSON::Object::Ptr>> params,
         std::initializer_list<std::string> required)
{
    Poco::JSON::Object::Ptr properties = new Poco::JSON::Object;
    for (const auto& p : params)
        properties->set(p.first, p.second);

    Poco::JSON::Array::Ptr reqArr = new Poco::JSON::Array;
    for (const auto& r : required)
        reqArr->add(r);

    Poco::JSON::Object::Ptr inputSchema = new Poco::JSON::Object;
    inputSchema->set("type", "object");
    inputSchema->set("properties", properties);
    inputSchema->set("required", reqArr);

    Poco::JSON::Object::Ptr tool = new Poco::JSON::Object;
    tool->set("name", name);
    tool->set("description", description);
    tool->set("inputSchema", inputSchema);
    return tool;
}

/// Map an MCP tool name to the internal request type used by getConvertToBrokerImplementation.
std::string toolNameToRequestType(const std::string& toolName)
{
    if (toolName == "convert_document")
        return "convert-to";
    if (toolName == "extract_link_targets")
        return "extract-link-targets";
    if (toolName == "extract_document_structure")
        return "extract-document-structure";
    if (toolName == "transform_document_structure")
        return "transform-document-structure";
    return std::string();
}

/// Write raw data to a temp file in the incoming directory. Returns the file path, or empty on error.
std::string writeToTempFile(const std::string& data, const std::string& filename)
{
    std::string tempDir =
        FileUtil::createRandomTmpDir(COOLWSD::ChildRoot + JailUtil::CHILDROOT_TMP_INCOMING_PATH);
    if (tempDir.empty())
    {
        LOG_ERR("MCP: failed to create temp directory");
        return std::string();
    }

    std::string cleanName = Util::cleanupFilename(filename);
    if (cleanName.empty())
        cleanName = "incoming_file";

    Poco::Path tempPath = Poco::Path::forDirectory(tempDir + '/');
    tempPath.setFileName(Poco::Path(cleanName).getFileName());

    std::string filePath = tempPath.toString();
    std::ofstream ofs(filePath, std::ios::binary);
    if (!ofs.is_open())
    {
        LOG_ERR("MCP: failed to open temp file: " << filePath);
        return std::string();
    }
    ofs.write(data.data(), data.size());
    ofs.close();
    if (!ofs)
    {
        LOG_ERR("MCP: failed to write temp file: " << filePath);
        FileUtil::removeFile(filePath);
        return std::string();
    }

    LOG_TRC("MCP: wrote " << data.size() << " bytes to " << filePath);
    return filePath;
}

/// Decode base64 data and write it to a temp file. Returns the file path, or empty on error.
std::string decodeToTempFile(const std::string& base64Data, const std::string& filename)
{
    std::string decoded;
    std::string error = macaron::Base64::Decode(base64Data, decoded);
    if (!error.empty())
    {
        LOG_ERR("MCP: base64 decode failed: " << error);
        return std::string();
    }
    return writeToTempFile(decoded, filename);
}

/// Send a JSON-RPC response as HTTP and shutdown the socket.
void sendJsonRpcResponse(const std::shared_ptr<StreamSocket>& socket, const std::string& body)
{
    http::Response httpResponse(http::StatusCode::OK);
    httpResponse.setBody(body, "application/json");
    socket->sendAndShutdown(httpResponse);
}

/// Extract a string value from a JSON object, or return a default.
std::string getString(const Poco::JSON::Object::Ptr& obj, const std::string& key,
                      const std::string& def = std::string())
{
    if (obj && obj->has(key))
        return obj->getValue<std::string>(key);
    return def;
}

} // anonymous namespace

std::string McpHandler::registerUpload(std::string path)
{
    const auto now = std::chrono::steady_clock::now();
    std::lock_guard<std::mutex> lock(uploadsMutex);
    sweepExpiredUploads(now);

    // If still at capacity after the sweep, evict the entry with the earliest
    // expiry so a burst of uploads can't pin arbitrary disk/memory.
    if (uploads.size() >= maxUploads)
    {
        auto oldest = std::min_element(
            uploads.begin(), uploads.end(),
            [](const auto& a, const auto& b) { return a.second.expiry < b.second.expiry; });
        LOG_WRN("MCP: upload map full, evicting " << oldest->first);
        StatelessBatchBroker::removeFile(oldest->second.path);
        uploads.erase(oldest);
    }

    std::string id = Util::rng::getHexString(16);
    uploads[id] = UploadEntry{ std::move(path), now + uploadTtl };
    LOG_TRC("MCP: registered upload " << id);
    return id;
}

std::string McpHandler::lookupUpload(const std::string& fileId)
{
    const auto now = std::chrono::steady_clock::now();
    std::lock_guard<std::mutex> lock(uploadsMutex);
    sweepExpiredUploads(now);
    auto it = uploads.find(fileId);
    if (it == uploads.end())
        return std::string();
    std::string path = std::move(it->second.path);
    uploads.erase(it);
    return path;
}

std::string McpHandler::registerUploadToken()
{
    const auto now = std::chrono::steady_clock::now();
    std::lock_guard<std::mutex> lock(uploadTokensMutex);
    sweepExpiredUploadTokens(now);
    std::string token = Util::rng::getHexString(16);
    uploadTokens[token] = now + uploadTokenTtl;
    LOG_TRC("MCP: issued upload token " << token);
    return token;
}

bool McpHandler::consumeUploadToken(const std::string& token)
{
    const auto now = std::chrono::steady_clock::now();
    std::lock_guard<std::mutex> lock(uploadTokensMutex);
    sweepExpiredUploadTokens(now);
    auto it = uploadTokens.find(token);
    if (it == uploadTokens.end())
    {
        LOG_TRC("MCP: upload token miss");
        return false;
    }
    uploadTokens.erase(it);
    LOG_TRC("MCP: upload token consumed");
    return true;
}

std::string McpHandler::handleInitialize(const std::string& requestId)
{
    Poco::JSON::Object::Ptr serverInfo = new Poco::JSON::Object;
    serverInfo->set("name", "collabora-online");
    serverInfo->set("version", Util::getCoolVersion());

    Poco::JSON::Object::Ptr toolsCap = new Poco::JSON::Object;
    Poco::JSON::Object::Ptr uploadCap = new Poco::JSON::Object;
    uploadCap->set("endpoint", "/cool/mcp/upload");
    uploadCap->set("maxSize", 100 * 1024 * 1024);

    Poco::JSON::Object::Ptr capabilities = new Poco::JSON::Object;
    capabilities->set("tools", toolsCap);
    capabilities->set("x-fileUpload", uploadCap);

    Poco::JSON::Object::Ptr result = new Poco::JSON::Object;
    result->set("protocolVersion", "2025-03-26");
    result->set("serverInfo", serverInfo);
    result->set("capabilities", capabilities);

    Poco::JSON::Object::Ptr response = new Poco::JSON::Object;
    response->set("jsonrpc", "2.0");
    response->set("id", requestId);
    response->set("result", result);

    std::ostringstream oss;
    response->stringify(oss);
    return oss.str();
}

/// Build the JSON-RPC 2.0 response listing all available MCP tools.
/// Each entry describes a single tool (name, description, and JSON Schema
/// for its parameters) that can be invoked via the MCP interface.
std::string McpHandler::handleToolsList(const std::string& requestId)
{
    Poco::JSON::Array::Ptr tools = new Poco::JSON::Array;

    tools->add(makeTool(
        "convert_document", DocumentToolDescriptions::CONVERT_DOCUMENT_DESCRIPTION,
        { { "data",
            makeParam("string",
                      "Base64-encoded input file content. Provide this or 'file_id'.") },
          { "file_id",
            makeParam("string", "ID of a previously uploaded file (via POST /cool/mcp/upload). "
                                "Use for large files that exceed base64 parameter limits.") },
          { "filename",
            makeParam("string",
                      "Original filename with extension (e.g. 'report.odt'). "
                      "The extension determines the input format. Required when using 'data'.") },
          { "format", makeParam("string", "Target output format (e.g. 'pdf', 'docx', 'pptx', "
                                          "'html', 'txt', 'png', 'csv', 'svg')") },
          { "options",
            makeParam("string",
                      "Export filter options as JSON. "
                      "For PDF: {\"PageRange\":{\"type\":\"string\",\"value\":\"1,3-5\"}}, "
                      "{\"Watermark\":{\"type\":\"string\",\"value\":\"DRAFT\"}}, "
                      "{\"SelectPdfVersion\":{\"type\":\"long\",\"value\":2}} for PDF/A-2b, "
                      "{\"EncryptFile\":{\"type\":\"boolean\",\"value\":\"true\"},"
                      "\"DocumentOpenPassword\":{\"type\":\"string\",\"value\":\"secret\"}}. "
                      "For CSV: comma-separated filter codes (e.g. '44,34,76' for comma separator, "
                      "quote delimiter, UTF-8). "
                      "For spreadsheet-to-PDF: {\"SinglePageSheets\":{\"type\":\"boolean\","
                      "\"value\":\"true\"}} to fit each sheet on one page.") },
          { "lang",
            makeParam(
                "string",
                "BCP 47 language tag for locale-dependent formatting (e.g. 'en-US', 'de-DE')") } },
        { "format" }));

    tools->add(makeTool(
        "extract_link_targets", DocumentToolDescriptions::EXTRACT_LINK_TARGETS_DESCRIPTION,
        { { "data",
            makeParam("string",
                      "Base64-encoded input file content. Provide this or 'file_id'.") },
          { "file_id",
            makeParam("string", "ID of a previously uploaded file (via POST /cool/mcp/upload). "
                                "Use for large files that exceed base64 parameter limits.") },
          { "filename",
            makeParam("string",
                      "Original filename with extension (e.g. 'report.odt'). "
                      "The extension determines the input format. Required when using 'data'.") },
          { "lang",
            makeParam(
                "string",
                "BCP 47 language tag for locale-dependent formatting (e.g. 'en-US', 'de-DE')") } },
        {}));

    tools->add(makeTool(
        "extract_document_structure", DocumentToolDescriptions::EXTRACT_DOC_STRUCTURE_DESCRIPTION,
        { { "data",
            makeParam("string",
                      "Base64-encoded input file content. Provide this or 'file_id'.") },
          { "file_id",
            makeParam("string", "ID of a previously uploaded file (via POST /cool/mcp/upload). "
                                "Use for large files that exceed base64 parameter limits.") },
          { "filename",
            makeParam("string",
                      "Original filename with extension (e.g. 'report.odt'). "
                      "The extension determines the input format. Required when using 'data'.") },
          { "filter", makeParam("string", "Filter results to a specific structure type. "
                                          "For Impress: 'slides'. For Writer: 'contentcontrol'. "
                                          "Omit to get the full structure.") },
          { "lang",
            makeParam(
                "string",
                "BCP 47 language tag for locale-dependent formatting (e.g. 'en-US', 'de-DE')") } },
        {}));

    tools->add(makeTool(
        "transform_document_structure",
        "Transform a document's structure using a JSON command sequence and return "
        "the modified document. Supports Impress slide operations (insert, delete, "
        "duplicate, reorder, rename slides; change layouts; set text on placeholders; "
        "format text with UNO commands), Writer/Calc content control updates, and "
        "arbitrary UNO commands. Provide a base document (can be a blank ODP for "
        "creating presentations from scratch) and a transform JSON.",
        { { "data",
            makeParam("string",
                      "Base64-encoded input file content. Provide this or 'file_id'.") },
          { "file_id",
            makeParam("string", "ID of a previously uploaded file (via POST /cool/mcp/upload). "
                                "Use for large files that exceed base64 parameter limits.") },
          { "filename",
            makeParam("string",
                      "Original filename with extension (e.g. 'presentation.odp'). "
                      "The extension determines the input format. Required when using 'data'.") },
          { "transform",
            makeParam("string",
                      std::string(DocumentToolDescriptions::TRANSFORM_PARAM_PRE_IMAGE)
                          + DocumentToolDescriptions::TRANSFORM_PARAM_POST_IMAGE) },
          { "format",
            makeParam("string",
                      "Output format for the transformed document (e.g. 'odp', 'pptx', 'pdf'). "
                      "Defaults to the input file's format.") },
          { "lang",
            makeParam(
                "string",
                "BCP 47 language tag for locale-dependent formatting (e.g. 'en-US', 'de-DE')") } },
        { "transform" }));

    tools->add(makeTool(
        "prepare_upload",
        "Obtain a short-lived, single-use credential for uploading a file that is too "
        "large for the base64 'data' parameter. Returns an 'upload_url' (absolute), an "
        "'upload_token', and 'expires_in' (seconds). The MCP client should then upload "
        "the file itself by issuing a POST multipart/form-data request to 'upload_url' "
        "with header 'Authorization: Bearer <upload_token>' and a single 'file' form "
        "field containing the document. The response is a JSON object of the form "
        "{\"file_id\": \"...\"}; pass that 'file_id' to subsequent tool calls "
        "(convert_document, extract_link_targets, extract_document_structure, "
        "transform_document_structure) via their 'file_id' argument. The token is valid "
        "for 60 seconds and is consumed on use.",
        {}, {}));

    Poco::JSON::Object::Ptr result = new Poco::JSON::Object;
    result->set("tools", tools);

    Poco::JSON::Object::Ptr response = new Poco::JSON::Object;
    response->set("jsonrpc", "2.0");
    response->set("id", requestId);
    response->set("result", result);

    std::ostringstream oss;
    response->stringify(oss);
    return oss.str();
}

bool McpHandler::handleRequest(const std::string& body, const std::shared_ptr<StreamSocket>& socket,
                               SocketDisposition& disposition, const std::string& id,
                               const std::string& uploadUrl)
{
    Poco::JSON::Object::Ptr request;
    if (!JsonUtil::parseJSON(body, request) || !request)
    {
        sendJsonRpcResponse(socket,
                            McpResponseUtil::makeJsonRpcError("null", -32700, "Parse error"));
        return true;
    }

    // Validate JSON-RPC envelope.
    std::string jsonrpc = getString(request, "jsonrpc");
    if (jsonrpc != "2.0")
    {
        sendJsonRpcResponse(socket,
                            McpResponseUtil::makeJsonRpcError(
                                "null", -32600, "Invalid Request: missing or wrong jsonrpc field"));
        return true;
    }

    // JSON-RPC 2.0 allows id to be a string, number, or null.
    std::string requestId = "null";
    if (request->has("id"))
    {
        Poco::Dynamic::Var idVar = request->get("id");
        if (idVar.isString())
            requestId = idVar.convert<std::string>();
        else if (idVar.isNumeric())
            requestId = std::to_string(idVar.convert<int64_t>());
    }

    std::string method = getString(request, "method");

    if (method.empty())
    {
        sendJsonRpcResponse(socket, McpResponseUtil::makeJsonRpcError(
                                        requestId, -32600, "Invalid Request: missing method"));
        return true;
    }

    // Handle synchronous methods.
    if (method == "initialize")
    {
        sendJsonRpcResponse(socket, handleInitialize(requestId));
        return true;
    }

    if (method == "tools/list")
    {
        sendJsonRpcResponse(socket, handleToolsList(requestId));
        return true;
    }

    if (method == "notifications/initialized")
    {
        // Client notification after initialize - no response needed per MCP spec.
        http::Response httpResponse(http::StatusCode::NoContent);
        httpResponse.setContentLength(0);
        socket->sendAndShutdown(httpResponse);
        return true;
    }

    if (method != "tools/call")
    {
        sendJsonRpcResponse(socket, McpResponseUtil::makeJsonRpcError(
                                        requestId, -32601, "Method not found: " + method));
        return true;
    }

    // tools/call - extract tool name and arguments.
    Poco::JSON::Object::Ptr params;
    if (request->has("params"))
        params = request->getObject("params");

    if (!params || !params->has("name"))
    {
        sendJsonRpcResponse(socket, McpResponseUtil::makeJsonRpcError(
                                        requestId, -32602, "Invalid params: missing tool name"));
        return true;
    }

    std::string toolName = params->getValue<std::string>("name");

    if (toolName == "prepare_upload")
    {
        Poco::JSON::Object::Ptr info = new Poco::JSON::Object;
        info->set("upload_url", uploadUrl);
        info->set("upload_token", registerUploadToken());
        info->set("expires_in", static_cast<int>(uploadTokenTtl.count()));
        std::ostringstream oss;
        info->stringify(oss);
        sendJsonRpcResponse(socket, McpResponseUtil::wrapJsonResult(requestId, oss.str()));
        return true;
    }

    std::string requestType = toolNameToRequestType(toolName);
    if (requestType.empty())
    {
        sendJsonRpcResponse(socket, McpResponseUtil::makeJsonRpcError(requestId, -32602,
                                                                      "Unknown tool: " + toolName));
        return true;
    }

    Poco::JSON::Object::Ptr arguments;
    if (params->has("arguments"))
        arguments = params->getObject("arguments");

    std::string base64Data = getString(arguments, "data");
    std::string fileId = getString(arguments, "file_id");

    if (base64Data.empty() && fileId.empty())
    {
        sendJsonRpcResponse(socket,
                            McpResponseUtil::makeJsonRpcError(
                                requestId, -32602, "Invalid params: provide 'data' or 'file_id'"));
        return true;
    }

    std::string filename = getString(arguments, "filename");
    std::string format = getString(arguments, "format");
    std::string options = getString(arguments, "options");
    std::string lang = getString(arguments, "lang");
    std::string filter = getString(arguments, "filter");

    if (filename.empty())
        filename = "document";

    std::string transformJSON;
    if (arguments && arguments->has("transform"))
    {
        std::string transform = arguments->getValue<std::string>("transform");
        Poco::URI::encode(transform, "", transformJSON);
    }

    // convert_document requires a format.
    if (requestType == "convert-to" && format.empty())
    {
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError(
                        requestId, -32602, "Invalid params: convert_document requires format"));
        return true;
    }

    std::string fromPath;
    if (!fileId.empty())
    {
        fromPath = lookupUpload(fileId);
        if (fromPath.empty())
        {
            sendJsonRpcResponse(socket, McpResponseUtil::makeJsonRpcError(
                                            requestId, -32602, "Invalid or expired file_id"));
            return true;
        }
        if (filename == "document")
            filename = Poco::Path(fromPath).getFileName();
    }
    else
        fromPath = decodeToTempFile(base64Data, filename);

    if (fromPath.empty())
    {
        sendJsonRpcResponse(socket,
                            McpResponseUtil::makeJsonRpcError(
                                requestId, -32603, "Internal error: failed to obtain input file"));
        return true;
    }

    Poco::URI uriPublic = RequestDetails::sanitizeLocalPath(fromPath);
    const std::string docKey = RequestDetails::getDocKey(uriPublic);

    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);

    LOG_DBG("MCP: New DocumentBroker for docKey [" << docKey << "].");
    auto docBroker =
        getConvertToBrokerImplementation(requestType, fromPath, uriPublic, docKey, format, options,
                                         lang, /*target=*/std::string(), filter, transformJSON);
    if (!docBroker)
    {
        docBrokersLock.unlock();
        StatelessBatchBroker::removeFile(fromPath);
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError(requestId, -32603,
                                                      "Internal error: failed to create broker"));
        return true;
    }

    COOLWSD::cleanupDocBrokers();

    DocBrokers.emplace(docKey, docBroker);
    LOG_TRC("MCP: Have " << DocBrokers.size() << " DocBrokers after inserting [" << docKey << "].");

    // Set the MCP context on the broker before starting conversion.
    // startConversion will create the ClientSession and forward it.
    McpContext mcpCtx;
    mcpCtx.jsonRpcId = requestId;
    docBroker->setMcpContext(std::move(mcpCtx));

    AdditionalFilePocoUris emptyUris;
    if (!docBroker->startConversion(disposition, id, emptyUris))
    {
        LOG_WRN("MCP: Failed to create Client Session with id [" << id << "] on docKey [" << docKey
                                                                 << "].");
        StatelessBatchBroker::removeFile(fromPath);
        COOLWSD::cleanupDocBrokers();
        sendJsonRpcResponse(socket,
                            McpResponseUtil::makeJsonRpcError(
                                requestId, -32603, "Internal error: failed to start conversion"));
        return true;
    }

    // Response will come asynchronously through the broker/session response handlers.
    return false;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
