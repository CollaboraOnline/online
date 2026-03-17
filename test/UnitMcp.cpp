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
 * Integration test for MCP (Model Context Protocol) endpoint.
 */

#include <config.h>

#include <iostream>

#include <Common.hpp>
#include <Protocol.hpp>
#include <Unit.hpp>
#include <common/FileUtil.hpp>
#include <common/Util.hpp>
#include <common/base64.hpp>
#include <helpers.hpp>

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Array.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/StreamCopier.h>
#include <Poco/Util/LayeredConfiguration.h>

#include <fstream>

using namespace std::literals;

namespace
{

/// Parse a JSON string and return the root object.
Poco::JSON::Object::Ptr parseJson(const std::string& json)
{
    Poco::JSON::Parser parser;
    auto result = parser.parse(json);
    return result.extract<Poco::JSON::Object::Ptr>();
}

/// Send a JSON-RPC request to /cool/mcp and return the response body.
std::string sendMcpRequest(Poco::Net::HTTPClientSession& session, const std::string& jsonBody,
                           const std::string& apiKey = "test-mcp-key")
{
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/cool/mcp");
    request.setContentType("application/json");
    request.setContentLength(jsonBody.size());
    if (!apiKey.empty())
        request.set("Authorization", "Bearer " + apiKey);

    std::ostream& os = session.sendRequest(request);
    os << jsonBody;

    Poco::Net::HTTPResponse response;
    std::istream& rs = session.receiveResponse(response);
    std::string body;
    Poco::StreamCopier::copyToString(rs, body);
    return body;
}

/// Read a test file and return its contents as a base64-encoded string.
std::string readFileAsBase64(const std::string& path)
{
    std::ifstream ifs(path, std::ios::binary);
    std::string data((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
    return macaron::Base64::Encode(data);
}

} // anonymous namespace

// Inside the WSD process
class UnitMcp : public UnitWSD
{
    bool _workerStarted;
    std::thread _worker;

public:
    UnitMcp()
        : UnitWSD("UnitMcp")
        , _workerStarted(false)
    {
        setHasKitHooks();
        setTimeout(1h);
    }

    ~UnitMcp()
    {
        LOG_INF("Joining MCP test worker thread\n");
        _worker.join();
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);

        config.setBool("ssl.enable", true);
        config.setInt("per_document.limit_load_secs", 30);
        config.setBool("storage.filesystem[@allow]", false);

        // Enable MCP endpoint by setting an API key.
        config.setString("net.mcp.api_key", "test-mcp-key");
    }

    void invokeWSDTest() override
    {
        if (_workerStarted)
            return;
        _workerStarted = true;
        std::cerr << "Starting MCP test thread ...\n";
        _worker = std::thread([this] {
            std::cerr << "MCP test thread started\n";
            std::unique_ptr<Poco::Net::HTTPClientSession> session(
                helpers::createSession(Poco::URI(helpers::getTestServerURI())));
            session->setTimeout(Poco::Timespan(30, 0));

            // Test 1: initialize round-trip
            {
                std::string body =
                    R"({"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}}})";
                std::string response = sendMcpRequest(*session, body);
                TST_LOG("initialize response: " << response);

                auto obj = parseJson(response);
                if (obj->getValue<std::string>("jsonrpc") != "2.0" ||
                    obj->getValue<std::string>("id") != "1" || !obj->has("result"))
                {
                    TST_LOG("initialize: bad response structure");
                    exitTest(TestResult::Failed);
                    return;
                }

                auto result = obj->getObject("result");
                if (!result->has("protocolVersion") || !result->has("serverInfo") ||
                    !result->has("capabilities"))
                {
                    TST_LOG("initialize: missing result fields");
                    exitTest(TestResult::Failed);
                    return;
                }
                TST_LOG("initialize: OK");
            }

            // Test 2: tools/list round-trip
            {
                std::string body = R"({"jsonrpc":"2.0","id":"2","method":"tools/list"})";
                std::string response = sendMcpRequest(*session, body);
                TST_LOG("tools/list response: " << response);

                auto obj = parseJson(response);
                auto result = obj->getObject("result");
                if (!result || !result->has("tools"))
                {
                    TST_LOG("tools/list: missing tools");
                    exitTest(TestResult::Failed);
                    return;
                }

                auto tools = result->getArray("tools");
                if (tools->size() != 4)
                {
                    TST_LOG("tools/list: expected 4 tools, got " << tools->size());
                    exitTest(TestResult::Failed);
                    return;
                }
                TST_LOG("tools/list: OK");
            }

            // Test 3: error - unknown tool
            {
                std::string body =
                    R"({"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"nonexistent","arguments":{}}})";
                std::string response = sendMcpRequest(*session, body);
                TST_LOG("unknown tool response: " << response);

                auto obj = parseJson(response);
                if (!obj->has("error"))
                {
                    TST_LOG("unknown tool: expected error response");
                    exitTest(TestResult::Failed);
                    return;
                }
                TST_LOG("unknown tool error: OK");
            }

            // Test 4: error - missing data argument
            {
                std::string body =
                    R"({"jsonrpc":"2.0","id":"4","method":"tools/call","params":{"name":"convert_document","arguments":{"format":"pdf"}}})";
                std::string response = sendMcpRequest(*session, body);
                TST_LOG("missing data response: " << response);

                auto obj = parseJson(response);
                if (!obj->has("error"))
                {
                    TST_LOG("missing data: expected error response");
                    exitTest(TestResult::Failed);
                    return;
                }
                TST_LOG("missing data error: OK");
            }

            // Test 5: extract_document_structure with a real document
            {
                std::string testDocPath = std::string(TDOC) + "/hello.odt";
                std::string base64Doc = readFileAsBase64(testDocPath);

                std::string body =
                    R"({"jsonrpc":"2.0","id":"5","method":"tools/call","params":{"name":"extract_document_structure","arguments":{"data":")" +
                    base64Doc + R"(","filename":"hello.odt"}}})";
                std::string response = sendMcpRequest(*session, body);
                TST_LOG("extract_document_structure response length: " << response.size());

                auto obj = parseJson(response);
                if (obj->has("error"))
                {
                    TST_LOG("extract_document_structure: got error: "
                            << obj->getObject("error")->getValue<std::string>("message"));
                    exitTest(TestResult::Failed);
                    return;
                }

                if (obj->getValue<std::string>("id") != "5" || !obj->has("result"))
                {
                    TST_LOG("extract_document_structure: bad response structure");
                    exitTest(TestResult::Failed);
                    return;
                }

                auto result = obj->getObject("result");
                if (!result->has("content"))
                {
                    TST_LOG("extract_document_structure: missing content");
                    exitTest(TestResult::Failed);
                    return;
                }
                TST_LOG("extract_document_structure: OK");
            }

            // Test 6: convert_document ODT to PDF
            {
                std::string testDocPath = std::string(TDOC) + "/hello.odt";
                std::string base64Doc = readFileAsBase64(testDocPath);

                std::string body =
                    R"({"jsonrpc":"2.0","id":"6","method":"tools/call","params":{"name":"convert_document","arguments":{"data":")" +
                    base64Doc + R"(","filename":"hello.odt","format":"pdf"}}})";
                std::string response = sendMcpRequest(*session, body);
                TST_LOG("convert_document response length: " << response.size());

                auto obj = parseJson(response);
                if (obj->has("error"))
                {
                    TST_LOG("convert_document: got error: "
                            << obj->getObject("error")->getValue<std::string>("message"));
                    exitTest(TestResult::Failed);
                    return;
                }

                if (obj->getValue<std::string>("id") != "6" || !obj->has("result"))
                {
                    TST_LOG("convert_document: bad response structure");
                    exitTest(TestResult::Failed);
                    return;
                }

                auto result = obj->getObject("result");
                auto content = result->getArray("content");
                if (!content || content->size() == 0)
                {
                    TST_LOG("convert_document: missing content");
                    exitTest(TestResult::Failed);
                    return;
                }

                auto item = content->getObject(0);
                if (item->getValue<std::string>("type") != "resource")
                {
                    TST_LOG("convert_document: expected resource type");
                    exitTest(TestResult::Failed);
                    return;
                }

                auto resource = item->getObject("resource");
                if (!resource->has("blob") || !resource->has("mimeType"))
                {
                    TST_LOG("convert_document: missing blob or mimeType");
                    exitTest(TestResult::Failed);
                    return;
                }

                // Verify the blob is non-empty base64 data.
                std::string blob = resource->getValue<std::string>("blob");
                if (blob.empty())
                {
                    TST_LOG("convert_document: empty blob");
                    exitTest(TestResult::Failed);
                    return;
                }

                // Decode and check it starts with %PDF.
                std::string decoded;
                std::string err = macaron::Base64::Decode(blob, decoded);
                if (!err.empty() || decoded.substr(0, 4) != "%PDF")
                {
                    TST_LOG("convert_document: blob does not decode to PDF");
                    exitTest(TestResult::Failed);
                    return;
                }
                TST_LOG("convert_document: OK (PDF size: " << decoded.size() << " bytes)");
            }

            exitTest(TestResult::Ok);
        });
    }
};

// Inside the forkit & kit processes
class UnitKitMcp : public UnitKit
{
public:
    UnitKitMcp()
        : UnitKit("UnitKitMcp")
    {
        setTimeout(1h);
    }
};

UnitBase* unit_create_wsd(void) { return new UnitMcp(); }

UnitBase* unit_create_kit(void) { return new UnitKitMcp(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
