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
#include <wsd/SpecialBrokers.hpp>

#include <Poco/JSON/Array.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Path.h>
#include <Poco/URI.h>

#include <chrono>
#include <fstream>
#include <mutex>
#include <sstream>
#include <unordered_map>

extern std::map<std::string, std::shared_ptr<DocumentBroker>> DocBrokers;
extern std::mutex DocBrokersMutex;

namespace
{
/// Uploaded files: file_id -> path. Single-use; consumed on lookup.
/// The broker deletes the source file after conversion.
std::unordered_map<std::string, std::string> uploads;
std::mutex uploadsMutex;

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

/// Fetch a file from a URI and write it to a temp file. Returns the file path, or empty on error.
/// Supports http(s):// schemes only.
std::string fetchUriToTempFile(const std::string& uriStr)
{
    Poco::URI parsed(uriStr);
    const std::string& scheme = parsed.getScheme();

    std::string name = Poco::Path(parsed.getPath()).getFileName();
    if (name.empty())
        name = "incoming_file";

    if (scheme != "http" && scheme != "https")
    {
        LOG_ERR("MCP: unsupported URI scheme: " << scheme);
        return std::string();
    }

    auto httpSession = http::Session::create(uriStr);
    httpSession->setTimeout(std::chrono::seconds(30));

    http::Request httpRequest(parsed.getPathAndQuery());
    const std::shared_ptr<const http::Response> httpResponse =
        httpSession->syncRequest(httpRequest);

    if (!httpResponse->done() || httpResponse->state() != http::Response::State::Complete ||
        httpResponse->statusLine().statusCode() != http::StatusCode::OK)
    {
        LOG_ERR("MCP: HTTP fetch failed for URI: " << uriStr);
        return std::string();
    }

    constexpr std::size_t maxResponseSize = 100 * 1024 * 1024; // 100 MB
    const auto& responseBody = httpResponse->getBody();
    if (responseBody.size() > maxResponseSize)
    {
        LOG_ERR("MCP: HTTP response too large: " << responseBody.size() << " bytes");
        return std::string();
    }

    return writeToTempFile(responseBody, name);
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
    std::lock_guard<std::mutex> lock(uploadsMutex);
    std::string id = Util::rng::getHexString(16);
    uploads[id] = std::move(path);
    LOG_TRC("MCP: registered upload " << id);
    return id;
}

std::string McpHandler::lookupUpload(const std::string& fileId)
{
    std::lock_guard<std::mutex> lock(uploadsMutex);
    auto it = uploads.find(fileId);
    if (it == uploads.end())
        return std::string();
    std::string path = std::move(it->second);
    uploads.erase(it);
    return path;
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
        { { "data",
            makeParam("string", "Base64-encoded input file content. Provide this or 'uri'.") },
          { "uri",
            makeParam("string",
                      "URL of the input file (http:// or https://). Provide this or 'data'.") },
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
        "extract_link_targets",
        "Extract all link targets from a document. Returns a JSON object with "
        "categories: Headings, Bookmarks, Tables, Frames, Images, Sections, "
        "OLE objects, Drawing objects. Each entry maps a name to a target string "
        "(e.g. \"Table1\": \"Table1|table\"). These targets can be used to open the "
        "document at a specific position.",
        { { "data",
            makeParam("string", "Base64-encoded input file content. Provide this or 'uri'.") },
          { "uri",
            makeParam("string",
                      "URL of the input file (http:// or https://). Provide this or 'data'.") },
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
        "extract_document_structure",
        "Extract the structural outline of a document as JSON. "
        "For Writer: headings, sections, tables, frames, images, bookmarks, content controls. "
        "For Calc: sheet names. "
        "For Impress: slide names, object names per slide. "
        "Useful for understanding document layout before applying transformations.",
        { { "data",
            makeParam("string", "Base64-encoded input file content. Provide this or 'uri'.") },
          { "uri",
            makeParam("string",
                      "URL of the input file (http:// or https://). Provide this or 'data'.") },
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
            makeParam("string", "Base64-encoded input file content. Provide this or 'uri'.") },
          { "uri",
            makeParam("string",
                      "URL of the input file (http:// or https://). Provide this or 'data'.") },
          { "file_id",
            makeParam("string", "ID of a previously uploaded file (via POST /cool/mcp/upload). "
                                "Use for large files that exceed base64 parameter limits.") },
          { "filename",
            makeParam("string",
                      "Original filename with extension (e.g. 'presentation.odp'). "
                      "The extension determines the input format. Required when using 'data'.") },
          { "transform",
            makeParam(
                "string",
                R"(JSON transformation commands. The top-level object can contain "Transforms" and/or "UnoCommand" objects in any order.

--- Impress/ODP Presentations ---

For presentations, use {"Transforms": {"SlideCommands": [...]}} where SlideCommands is an array of operations applied in order. There is always a "current slide" (default: index 0) that most commands act on.

Navigation:
- {"JumpToSlide": N} - jump to 0-based slide index; use "last" for last slide
- {"JumpToSlideByName": "name"} - jump to named slide

Slide management (inserts after current slide and jumps to new slide):
- {"InsertMasterSlide": N} - insert slide based on master slide at index N
- {"InsertMasterSlideByName": "name"} - insert slide by master slide name
- {"DeleteSlide": N} - delete slide at index; use "" for current slide
- {"DuplicateSlide": N} - duplicate slide at index; use "" for current
- {"MoveSlide": N} - move current slide to position N
- {"MoveSlide.X": N} - move slide at index X to position N
- {"RenameSlide": "name"} - rename current slide (must be unique)

Layout (applied to current slide):
- {"ChangeLayoutByName": "name"} - set layout by name
- {"ChangeLayout": N} - set layout by numeric ID
Layout names: AUTOLAYOUT_TITLE (title+subtitle, id=0), AUTOLAYOUT_TITLE_CONTENT (title+content, id=1), AUTOLAYOUT_TITLE_2CONTENT (title+2 content, id=3), AUTOLAYOUT_TITLE_CONTENT_2CONTENT (id=12), AUTOLAYOUT_TITLE_CONTENT_OVER_CONTENT (id=14), AUTOLAYOUT_TITLE_2CONTENT_CONTENT (id=15), AUTOLAYOUT_TITLE_2CONTENT_OVER_CONTENT (id=16), AUTOLAYOUT_TITLE_4CONTENT (id=18), AUTOLAYOUT_TITLE_ONLY (title only, id=19), AUTOLAYOUT_NONE (blank, id=20), AUTOLAYOUT_ONLY_TEXT (centered text, id=32), AUTOLAYOUT_TITLE_6CONTENT (id=34), AUTOLAYOUT_VTITLE_VCONTENT (vertical, id=28), AUTOLAYOUT_VTITLE_VCONTENT_OVER_VCONTENT (id=27), AUTOLAYOUT_TITLE_VCONTENT (id=29), AUTOLAYOUT_TITLE_2VTEXT (id=30)

Text content:
- {"SetText.N": "text"} - set text of placeholder N on current slide (0=title, 1=first content, 2=second content, etc.). Use \n for paragraph breaks.

Object selection:
- {"MarkObject": N} - select object at index on current slide
- {"UnMarkObject": N} - deselect object at index

Rich text editing:
- {"EditTextObject.N": [...]} - edit text object N with sub-commands:
  - {"SelectText": []} - select all text; [para] selects paragraph; [para,startChar,endPara,endChar] selects range; [para,char] positions cursor
  - {"SelectParagraph": N} - select paragraph N
  - {"InsertText": "text"} - insert/replace text at selection
  - {"UnoCommand": "cmd"} - apply UNO command to selection

Tested UNO commands for text formatting:
Toggle: .uno:Bold, .uno:Italic, .uno:Underline, .uno:Strikeout, .uno:Shadowed, .uno:SuperScript, .uno:SubScript
Lists: .uno:DefaultBullet, .uno:DefaultNumbering (affect whole paragraphs)
Alignment: .uno:LeftPara, .uno:CenterPara, .uno:RightPara, .uno:JustifyPara
Color: .uno:Color {"Color.Color":{"type":"long","value":RGB_INT}}
Background: .uno:CharBackColor {"CharBackColor.Color":{"type":"long","value":RGB_INT}}

Top-level UNO commands (outside SlideCommands, works for all doc types):
{"UnoCommand": {"name": ".uno:CommandName", "arguments": {"ArgName": {"type": "string|long|boolean", "value": "..."}}}}
Example - enable change tracking:
{"UnoCommand": {"name": ".uno:TrackChanges", "arguments": {"TrackChanges": {"type": "boolean", "value": "true"}}}}

--- Writer/Calc Content Controls ---

For Writer/Calc, address content control items by selector:
{"Transforms": {"ContentControls.ByIndex.0": {"content": "new value"}}}
Selectors: ContentControls.ByIndex.N, ContentControls.ByTag.tagname, ContentControls.ByAlias.aliasname. Use extract_document_structure with filter="contentcontrol" first to discover available controls.

Example - create a 3-slide presentation from a blank ODP:
{"Transforms":{"SlideCommands":[{"ChangeLayoutByName":"AUTOLAYOUT_TITLE"},{"SetText.0":"Quarterly Report"},{"SetText.1":"Q1 2026"},{"InsertMasterSlide":0},{"ChangeLayoutByName":"AUTOLAYOUT_TITLE_CONTENT"},{"SetText.0":"Revenue"},{"SetText.1":"Revenue grew 15% year over year"},{"InsertMasterSlide":0},{"ChangeLayoutByName":"AUTOLAYOUT_TITLE_CONTENT"},{"SetText.0":"Next Steps"},{"SetText.1":"Focus on expansion into new markets"}]}})") },
          { "format",
            makeParam("string",
                      "Output format for the transformed document (e.g. 'odp', 'pptx', 'pdf'). "
                      "Defaults to the input file's format.") },
          { "lang",
            makeParam(
                "string",
                "BCP 47 language tag for locale-dependent formatting (e.g. 'en-US', 'de-DE')") } },
        { "transform" }));

    tools->add(makeTool("get_upload_info",
                        "Get the upload URL and credentials for uploading large files that exceed "
                        "base64 parameter limits. Returns the API key and upload path. The user "
                        "runs: curl -X POST -F 'file=@document.odt' -H 'Authorization: Bearer "
                        "<api_key>' <server_base_url>/cool/mcp/upload -- which returns a file_id "
                        "for use in the other tools via the 'file_id' parameter.",
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
                               SocketDisposition& disposition, const std::string& id)
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

    if (toolName == "get_upload_info")
    {
        std::string apiKey = ConfigUtil::getConfigValue<std::string>("net.mcp.api_key", "");
        Poco::JSON::Object::Ptr info = new Poco::JSON::Object;
        info->set("upload_path", "/cool/mcp/upload");
        info->set("api_key", apiKey);
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
    std::string uri = getString(arguments, "uri");
    std::string fileId = getString(arguments, "file_id");

    if (base64Data.empty() && uri.empty() && fileId.empty())
    {
        sendJsonRpcResponse(
            socket, McpResponseUtil::makeJsonRpcError(
                        requestId, -32602, "Invalid params: provide 'data', 'uri', or 'file_id'"));
        return true;
    }

    std::string filename = getString(arguments, "filename");
    std::string format = getString(arguments, "format");
    std::string options = getString(arguments, "options");
    std::string lang = getString(arguments, "lang");
    std::string filter = getString(arguments, "filter");

    if (!uri.empty() && filename.empty())
    {
        Poco::URI parsed(uri);
        filename = Poco::Path(parsed.getPath()).getFileName();
    }
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
    else if (!uri.empty())
        fromPath = fetchUriToTempFile(uri);
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
