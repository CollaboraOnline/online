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
#include <test/helpers.hpp>
#include <test/lokassert.hpp>

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

    TestResult testInitialize(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string body =
                R"({"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}}})";
            std::string response = sendMcpRequest(session, body);
            TST_LOG("Response: " << response);

            auto obj = parseJson(response);
            LOK_ASSERT_EQUAL_STR("2.0", obj->getValue<std::string>("jsonrpc"));
            LOK_ASSERT_EQUAL_STR("1", obj->getValue<std::string>("id"));
            LOK_ASSERT(obj->has("result"));

            auto result = obj->getObject("result");
            LOK_ASSERT(result->has("protocolVersion"));
            LOK_ASSERT(result->has("serverInfo"));
            LOK_ASSERT(result->has("capabilities"));
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testToolsList(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string body = R"({"jsonrpc":"2.0","id":"2","method":"tools/list"})";
            std::string response = sendMcpRequest(session, body);
            TST_LOG("Response: " << response);

            auto obj = parseJson(response);
            auto result = obj->getObject("result");
            LOK_ASSERT(result != nullptr);
            LOK_ASSERT(result->has("tools"));

            auto tools = result->getArray("tools");
            LOK_ASSERT_EQUAL(static_cast<std::size_t>(4), tools->size());
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testUnknownTool(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string body =
                R"({"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"nonexistent","arguments":{}}})";
            std::string response = sendMcpRequest(session, body);
            TST_LOG("Response: " << response);

            auto obj = parseJson(response);
            LOK_ASSERT(obj->has("error"));
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testMissingData(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string body =
                R"({"jsonrpc":"2.0","id":"4","method":"tools/call","params":{"name":"convert_document","arguments":{"format":"pdf"}}})";
            std::string response = sendMcpRequest(session, body);
            TST_LOG("Response: " << response);

            auto obj = parseJson(response);
            LOK_ASSERT(obj->has("error"));
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testExtractDocumentStructure(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string testDocPath = std::string(TDOC) + "/hello.odt";
            std::string base64Doc = readFileAsBase64(testDocPath);

            std::string body =
                R"({"jsonrpc":"2.0","id":"5","method":"tools/call","params":{"name":"extract_document_structure","arguments":{"data":")" +
                base64Doc + R"(","filename":"hello.odt"}}})";
            std::string response = sendMcpRequest(session, body);
            TST_LOG("Response length: " << response.size());

            auto obj = parseJson(response);
            LOK_ASSERT_MESSAGE("expected result, got error", !obj->has("error"));
            LOK_ASSERT_EQUAL_STR("5", obj->getValue<std::string>("id"));
            LOK_ASSERT(obj->has("result"));

            auto result = obj->getObject("result");
            LOK_ASSERT(result->has("content"));
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testConvertDocument(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string testDocPath = std::string(TDOC) + "/hello.odt";
            std::string base64Doc = readFileAsBase64(testDocPath);

            std::string body =
                R"({"jsonrpc":"2.0","id":"6","method":"tools/call","params":{"name":"convert_document","arguments":{"data":")" +
                base64Doc + R"(","filename":"hello.odt","format":"pdf"}}})";
            std::string response = sendMcpRequest(session, body);
            TST_LOG("Response length: " << response.size());

            auto obj = parseJson(response);
            LOK_ASSERT_MESSAGE("expected result, got error", !obj->has("error"));
            LOK_ASSERT_EQUAL_STR("6", obj->getValue<std::string>("id"));
            LOK_ASSERT(obj->has("result"));

            auto result = obj->getObject("result");
            auto content = result->getArray("content");
            LOK_ASSERT(content != nullptr);
            LOK_ASSERT(content->size() > 0);

            auto item = content->getObject(0);
            LOK_ASSERT_EQUAL_STR("resource", item->getValue<std::string>("type"));

            auto resource = item->getObject("resource");
            LOK_ASSERT(resource->has("blob"));
            LOK_ASSERT(resource->has("mimeType"));

            std::string blob = resource->getValue<std::string>("blob");
            LOK_ASSERT(!blob.empty());

            // Decode and check it starts with %PDF.
            std::string decoded;
            std::string err = macaron::Base64::Decode(blob, decoded);
            LOK_ASSERT_MESSAGE("base64 decode failed", err.empty());
            LOK_ASSERT_EQUAL_STR("%PDF", decoded.substr(0, 4));
            TST_LOG("PDF size: " << decoded.size() << " bytes");
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

public:
    UnitMcp()
        : UnitWSD("UnitMcp")
        , _workerStarted(false)
    {
        setHasKitHooks();
        setTimeout(60s);
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
        _worker = std::thread(
            [this]
            {
                std::unique_ptr<Poco::Net::HTTPClientSession> session(
                    helpers::createSession(Poco::URI(helpers::getTestServerURI())));
                session->setTimeout(Poco::Timespan(30, 0));

                TestResult result;

                result = testInitialize(*session);
                if (result != TestResult::Ok) { exitTest(result); return; }

                result = testToolsList(*session);
                if (result != TestResult::Ok) { exitTest(result); return; }

                result = testUnknownTool(*session);
                if (result != TestResult::Ok) { exitTest(result); return; }

                result = testMissingData(*session);
                if (result != TestResult::Ok) { exitTest(result); return; }

                result = testExtractDocumentStructure(*session);
                if (result != TestResult::Ok) { exitTest(result); return; }

                result = testConvertDocument(*session);
                if (result != TestResult::Ok) { exitTest(result); return; }

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
        setTimeout(60s);
    }
};

UnitBase* unit_create_wsd(void) { return new UnitMcp(); }

UnitBase* unit_create_kit(void) { return new UnitKitMcp(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
