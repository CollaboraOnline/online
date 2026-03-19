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
#include "DocumentToolDescriptions.hpp"
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
#include <wsd/SpecialBrokers.hpp>

#include <Poco/JSON/Array.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Path.h>
#include <Poco/URI.h>

#include <fstream>
#include <mutex>
#include <sstream>

extern std::map<std::string, std::shared_ptr<DocumentBroker>> DocBrokers;
extern std::mutex DocBrokersMutex;

namespace
{

/// Build a JSON Schema object describing an input parameter.
Poco::JSON::Object::Ptr makeParam(const std::string& type, const std::string& description)
{
    Poco::JSON::Object::Ptr obj = new Poco::JSON::Object;
    obj->set("type", type);
    obj->set("description", description);
    return obj;
}

/// Build a complete MCP tool definition.
Poco::JSON::Object::Ptr makeTool(const std::string& name, const std::string& description,
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

/// Create a broker for the given request type and parameters.
std::shared_ptr<ConvertToBroker>
createBroker(const std::string& requestType, const std::string& fromPath,
             const Poco::URI& uriPublic, const std::string& docKey,
             const std::string& format, const std::string& options,
             const std::string& lang, const std::string& filter,
             const std::string& transformJSON)
{
    if (requestType == "convert-to")
        return std::make_shared<ConvertToBroker>(fromPath, uriPublic, docKey, format, options, lang);
    if (requestType == "extract-link-targets")
        return std::make_shared<ExtractLinkTargetsBroker>(fromPath, uriPublic, docKey, lang);
    if (requestType == "extract-document-structure")
        return std::make_shared<ExtractDocumentStructureBroker>(fromPath, uriPublic, docKey, lang,
                                                                 filter);
    if (requestType == "transform-document-structure")
    {
        std::string fmt = format;
        if (fmt.empty())
            fmt = Poco::Path(fromPath).getExtension();
        return std::make_shared<TransformDocumentStructureBroker>(fromPath, uriPublic, docKey, fmt,
                                                                   lang, transformJSON);
    }
    return nullptr;
}

/// Write raw data to a temp file in the incoming directory. Returns the file path, or empty on error.
std::string writeToTempFile(const std::string& data, const std::string& filename)
{
    std::string tempDir = FileUtil::createRandomTmpDir(
        COOLWSD::ChildRoot + JailUtil::CHILDROOT_TMP_INCOMING_PATH);
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

/// Fetch a file from a URI and copy it to a temp file. Returns the file path, or empty on error.
/// Supports file:// and http(s):// schemes.
std::string fetchUriToTempFile(const std::string& uriStr)
{
    Poco::URI parsed(uriStr);
    const std::string& scheme = parsed.getScheme();

    // Derive filename from the last path component.
    std::string name = Poco::Path(parsed.getPath()).getFileName();
    if (name.empty())
        name = "incoming_file";

    if (scheme == "file")
    {
        const std::string& localPath = parsed.getPath();
        std::ifstream ifs(localPath, std::ios::binary);
        if (!ifs.is_open())
        {
            LOG_ERR("MCP: failed to open local file: " << localPath);
            return std::string();
        }
        std::string content((std::istreambuf_iterator<char>(ifs)),
                            std::istreambuf_iterator<char>());
        return writeToTempFile(content, name);
    }

    if (scheme == "http" || scheme == "https")
    {
        auto httpSession = http::Session::create(uriStr);
        httpSession->setTimeout(std::chrono::seconds(30));

        http::Request httpRequest(parsed.getPathAndQuery());
        const std::shared_ptr<const http::Response> httpResponse =
            httpSession->syncRequest(httpRequest);

        if (!httpResponse->done() ||
            httpResponse->state() != http::Response::State::Complete ||
            httpResponse->statusLine().statusCode() != http::StatusCode::OK)
        {
            LOG_ERR("MCP: HTTP fetch failed for URI: " << uriStr);
            return std::string();
        }

        return writeToTempFile(httpResponse->getBody(), name);
    }

    LOG_ERR("MCP: unsupported URI scheme: " << scheme);
    return std::string();
}

/// Send a JSON-RPC response as HTTP and shutdown the socket.
void sendJsonRpcResponse(const std::shared_ptr<StreamSocket>& socket, const std::string& body)
{
    http::Response httpResponse(http::StatusCode::OK);
    httpResponse.set("Content-Type", "application/json");
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

std::string McpHandler::handleInitialize(const std::string& requestId)
{
    Poco::JSON::Object::Ptr serverInfo = new Poco::JSON::Object;
    serverInfo->set("name", "collabora-online");
    serverInfo->set("version", Util::getCoolVersion());

    Poco::JSON::Object::Ptr toolsCap = new Poco::JSON::Object;
    Poco::JSON::Object::Ptr capabilities = new Poco::JSON::Object;
    capabilities->set("tools", toolsCap);

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
        "convert_document",
        "Convert a document to a different format. Returns the converted file as "
        "base64-encoded binary.\n\n"
        "Supported input formats - Writer: odt, docx, doc, rtf, txt, html, md, fodt, wpd, pages. "
        "Calc: ods, xlsx, xls, csv, fods, numbers. "
        "Impress: odp, pptx, ppt, fodp, key. "
        "Draw: odg, svg, vsdx, pub, png, pdf.\n\n"
        "Supported output formats - Writer: odt, docx, pdf, rtf, txt, html, png. "
        "Calc: ods, xlsx, csv, pdf, html, png. "
        "Impress: odp, pptx, pdf, html, svg, png. "
        "Draw: odg, pdf, svg, png.",
        {{"uri", makeParam("string",
            "URI of the input file (file:// or http://). Alternative to 'data' - provide one or the other.")},
         {"data", makeParam("string",
            "Base64-encoded input file content. Not needed when 'uri' is provided.")},
         {"filename", makeParam("string",
            "Original filename with extension (e.g. 'report.odt'). "
            "The extension determines the input format. Not needed when 'uri' is provided.")},
         {"format", makeParam("string",
            "Target output format (e.g. 'pdf', 'docx', 'pptx', 'html', 'txt', 'png', 'csv', 'svg')")},
         {"options", makeParam("string",
            "Export filter options as JSON. "
            "For PDF: {\"PageRange\":{\"type\":\"string\",\"value\":\"1,3-5\"}}, "
            "{\"Watermark\":{\"type\":\"string\",\"value\":\"DRAFT\"}}, "
            "{\"SelectPdfVersion\":{\"type\":\"long\",\"value\":2}} for PDF/A-2b, "
            "{\"EncryptFile\":{\"type\":\"boolean\",\"value\":\"true\"},"
            "\"DocumentOpenPassword\":{\"type\":\"string\",\"value\":\"secret\"}}. "
            "For CSV: comma-separated filter codes (e.g. '44,34,76' for comma separator, "
            "quote delimiter, UTF-8). "
            "For spreadsheet-to-PDF: {\"SinglePageSheets\":{\"type\":\"boolean\","
            "\"value\":\"true\"}} to fit each sheet on one page.")},
         {"lang", makeParam("string",
            "BCP 47 language tag for locale-dependent formatting (e.g. 'en-US', 'de-DE')")}},
        {"format"}));

    tools->add(makeTool(
        "extract_link_targets",
        DocumentToolDescriptions::EXTRACT_LINK_TARGETS_DESCRIPTION,
        {{"uri", makeParam("string",
            "URI of the input file (file:// or http://). Alternative to 'data' - provide one or the other.")},
         {"data", makeParam("string",
            "Base64-encoded input file content. Not needed when 'uri' is provided.")},
         {"filename", makeParam("string",
            "Original filename with extension (e.g. 'report.odt'). "
            "The extension determines the input format. Not needed when 'uri' is provided.")},
         {"lang", makeParam("string",
            "BCP 47 language tag for locale-dependent formatting (e.g. 'en-US', 'de-DE')")}},
        {}));

    tools->add(makeTool(
        "extract_document_structure",
        DocumentToolDescriptions::EXTRACT_DOC_STRUCTURE_DESCRIPTION,
        {{"uri", makeParam("string",
            "URI of the input file (file:// or http://). Alternative to 'data' - provide one or the other.")},
         {"data", makeParam("string",
            "Base64-encoded input file content. Not needed when 'uri' is provided.")},
         {"filename", makeParam("string",
            "Original filename with extension (e.g. 'report.odt'). "
            "The extension determines the input format. Not needed when 'uri' is provided.")},
         {"filter", makeParam("string",
            "Filter results to a specific structure type. "
            "For Impress: 'slides'. For Writer: 'contentcontrol'. "
            "Omit to get the full structure.")},
         {"lang", makeParam("string",
            "BCP 47 language tag for locale-dependent formatting (e.g. 'en-US', 'de-DE')")}},
        {}));

    tools->add(makeTool(
        "transform_document_structure",
        "Transform a document's structure using a JSON command sequence and return "
        "the modified document. Supports Impress slide operations (insert, delete, "
        "duplicate, reorder, rename slides; change layouts; set text on placeholders; "
        "format text with UNO commands), Writer/Calc content control updates, and "
        "arbitrary UNO commands. Provide a base document (can be a blank ODP for "
        "creating presentations from scratch) and a transform JSON.",
        {{"uri", makeParam("string",
            "URI of the input file (file:// or http://). Alternative to 'data' - provide one or the other.")},
         {"data", makeParam("string",
            "Base64-encoded input file content. Not needed when 'uri' is provided.")},
         {"filename", makeParam("string",
            "Original filename with extension (e.g. 'presentation.odp'). "
            "The extension determines the input format. Not needed when 'uri' is provided.")},
         {"transform", makeParam("string",
            DocumentToolDescriptions::TRANSFORM_PARAM_DESCRIPTION)},
         {"format", makeParam("string",
            "Output format for the transformed document (e.g. 'odp', 'pptx', 'pdf'). "
            "Defaults to the input file's format.")},
         {"lang", makeParam("string",
            "BCP 47 language tag for locale-dependent formatting (e.g. 'en-US', 'de-DE')")}},
        {"transform"}));

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

bool McpHandler::handleRequest(const std::string& body,
                               const std::shared_ptr<StreamSocket>& socket,
                               SocketDisposition& disposition,
                               const std::string& id)
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
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError("null", -32600, "Invalid Request: missing or wrong jsonrpc field"));
        return true;
    }

    std::string requestId = getString(request, "id", "null");
    std::string method = getString(request, "method");

    if (method.empty())
    {
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError(requestId, -32600, "Invalid Request: missing method"));
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
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError(requestId, -32601, "Method not found: " + method));
        return true;
    }

    // tools/call - extract tool name and arguments.
    Poco::JSON::Object::Ptr params;
    if (request->has("params"))
        params = request->getObject("params");

    if (!params || !params->has("name"))
    {
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError(requestId, -32602, "Invalid params: missing tool name"));
        return true;
    }

    std::string toolName = params->getValue<std::string>("name");
    std::string requestType = toolNameToRequestType(toolName);
    if (requestType.empty())
    {
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError(requestId, -32602, "Unknown tool: " + toolName));
        return true;
    }

    Poco::JSON::Object::Ptr arguments;
    if (params->has("arguments"))
        arguments = params->getObject("arguments");

    std::string base64Data = getString(arguments, "data");
    std::string uri = getString(arguments, "uri");

    if (base64Data.empty() && uri.empty())
    {
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError(requestId, -32602, "Invalid params: missing data or uri argument"));
        return true;
    }

    std::string filename = getString(arguments, "filename");
    std::string format = getString(arguments, "format");
    std::string options = getString(arguments, "options");
    std::string lang = getString(arguments, "lang");
    std::string filter = getString(arguments, "filter");

    // When uri is provided, derive filename from URI path if not explicitly given.
    if (!uri.empty() && filename.empty())
    {
        Poco::URI parsed(uri);
        filename = Poco::Path(parsed.getPath()).getFileName();
    }
    if (filename.empty())
        filename = "document";

    std::string transformJSON;
    if (arguments->has("transform"))
    {
        std::string transform = arguments->getValue<std::string>("transform");
        Poco::URI::encode(transform, "", transformJSON);
    }

    // convert_document requires a format.
    if (requestType == "convert-to" && format.empty())
    {
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError(requestId, -32602, "Invalid params: convert_document requires format"));
        return true;
    }

    // Get the input file - either from URI or base64 data.
    std::string fromPath;
    if (!uri.empty())
        fromPath = fetchUriToTempFile(uri);
    else
        fromPath = decodeToTempFile(base64Data, filename);

    if (fromPath.empty())
    {
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError(requestId, -32603, "Internal error: failed to obtain input file"));
        return true;
    }

    Poco::URI uriPublic = RequestDetails::sanitizeLocalPath(fromPath);
    const std::string docKey = RequestDetails::getDocKey(uriPublic);

    std::unique_lock<std::mutex> docBrokersLock(DocBrokersMutex);

    LOG_DBG("MCP: New DocumentBroker for docKey [" << docKey << "].");
    auto docBroker = createBroker(requestType, fromPath, uriPublic, docKey, format, options, lang,
                                  filter, transformJSON);
    if (!docBroker)
    {
        docBrokersLock.unlock();
        StatelessBatchBroker::removeFile(fromPath);
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError(requestId, -32603, "Internal error: failed to create broker"));
        return true;
    }

    COOLWSD::cleanupDocBrokers();

    DocBrokers.emplace(docKey, docBroker);
    LOG_TRC("MCP: Have " << DocBrokers.size() << " DocBrokers after inserting [" << docKey << "].");

    // Set the MCP context on the broker before starting conversion.
    // startConversion will create the ClientSession and forward it.
    auto mcpCtx = std::make_unique<McpContext>();
    mcpCtx->jsonRpcId = requestId;
    mcpCtx->toolName = toolName;
    docBroker->setMcpContext(std::move(mcpCtx));

    AdditionalFilePocoUris emptyUris;
    if (!docBroker->startConversion(disposition, id, emptyUris))
    {
        LOG_WRN("MCP: Failed to create Client Session with id [" << id << "] on docKey [" << docKey
                                                                  << "].");
        COOLWSD::cleanupDocBrokers();
    }

    // Response will come asynchronously through the broker/session response handlers.
    return false;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
