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
 * White-box unit tests for MCP response utilities.
 */

#include <config.h>

#include <test/lokassert.hpp>

#include <wsd/McpResponseUtil.hpp>

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Array.h>
#include <Poco/JSON/Parser.h>

#include <cppunit/extensions/HelperMacros.h>

#include <string>

namespace
{

/// Parse a JSON string and return the root object.
Poco::JSON::Object::Ptr parseJson(const std::string& json)
{
    Poco::JSON::Parser parser;
    auto result = parser.parse(json);
    return result.extract<Poco::JSON::Object::Ptr>();
}

} // anonymous namespace

/// McpResponseUtil unit tests.
class McpHandlerTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(McpHandlerTests);

    CPPUNIT_TEST(testMakeJsonRpcError);
    CPPUNIT_TEST(testMakeJsonRpcErrorCodes);
    CPPUNIT_TEST(testWrapJsonResult);
    CPPUNIT_TEST(testWrapJsonResultEmbedding);
    CPPUNIT_TEST(testWrapBinaryResult);
    CPPUNIT_TEST(testWrapBinaryResultMimeType);

    CPPUNIT_TEST_SUITE_END();

    void testMakeJsonRpcError();
    void testMakeJsonRpcErrorCodes();
    void testWrapJsonResult();
    void testWrapJsonResultEmbedding();
    void testWrapBinaryResult();
    void testWrapBinaryResultMimeType();
};

void McpHandlerTests::testMakeJsonRpcError()
{
    constexpr std::string_view testname = __func__;

    std::string response = McpResponseUtil::makeJsonRpcError("5", -32600, "Invalid Request");
    auto obj = parseJson(response);

    LOK_ASSERT_EQUAL_STR("2.0", obj->getValue<std::string>("jsonrpc"));
    LOK_ASSERT_EQUAL_STR("5", obj->getValue<std::string>("id"));

    auto error = obj->getObject("error");
    LOK_ASSERT(error != nullptr);
    LOK_ASSERT_EQUAL(-32600, error->getValue<int>("code"));
    LOK_ASSERT_EQUAL_STR("Invalid Request", error->getValue<std::string>("message"));
}

void McpHandlerTests::testMakeJsonRpcErrorCodes()
{
    constexpr std::string_view testname = __func__;

    // Parse error
    auto obj = parseJson(McpResponseUtil::makeJsonRpcError("1", -32700, "Parse error"));
    LOK_ASSERT_EQUAL(-32700, obj->getObject("error")->getValue<int>("code"));

    // Method not found
    obj = parseJson(McpResponseUtil::makeJsonRpcError("2", -32601, "Method not found"));
    LOK_ASSERT_EQUAL(-32601, obj->getObject("error")->getValue<int>("code"));

    // Invalid params
    obj = parseJson(McpResponseUtil::makeJsonRpcError("3", -32602, "Invalid params"));
    LOK_ASSERT_EQUAL(-32602, obj->getObject("error")->getValue<int>("code"));

    // Internal error
    obj = parseJson(McpResponseUtil::makeJsonRpcError("4", -32603, "Internal error"));
    LOK_ASSERT_EQUAL(-32603, obj->getObject("error")->getValue<int>("code"));
}

void McpHandlerTests::testWrapJsonResult()
{
    constexpr std::string_view testname = __func__;

    std::string jsonBody = "{\"headings\":[\"Chapter 1\",\"Chapter 2\"]}";
    std::string response = McpResponseUtil::wrapJsonResult("10", jsonBody);
    auto obj = parseJson(response);

    LOK_ASSERT_EQUAL_STR("2.0", obj->getValue<std::string>("jsonrpc"));
    LOK_ASSERT_EQUAL_STR("10", obj->getValue<std::string>("id"));

    auto result = obj->getObject("result");
    LOK_ASSERT(result != nullptr);

    auto content = result->getArray("content");
    LOK_ASSERT(content != nullptr);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), content->size());

    auto item = content->getObject(0);
    LOK_ASSERT_EQUAL_STR("text", item->getValue<std::string>("type"));
    LOK_ASSERT_EQUAL_STR(jsonBody, item->getValue<std::string>("text"));
}

void McpHandlerTests::testWrapJsonResultEmbedding()
{
    constexpr std::string_view testname = __func__;

    // Verify that special characters in JSON are preserved correctly.
    std::string jsonBody = "{\"key\":\"value with \\\"quotes\\\"\"}";
    std::string response = McpResponseUtil::wrapJsonResult("11", jsonBody);
    auto obj = parseJson(response);

    auto content = obj->getObject("result")->getArray("content");
    auto item = content->getObject(0);
    LOK_ASSERT_EQUAL_STR(jsonBody, item->getValue<std::string>("text"));
}

void McpHandlerTests::testWrapBinaryResult()
{
    constexpr std::string_view testname = __func__;

    const char data[] = "Hello PDF";
    std::string response =
        McpResponseUtil::wrapBinaryResult("20", data, sizeof(data) - 1, "application/pdf");
    auto obj = parseJson(response);

    LOK_ASSERT_EQUAL_STR("2.0", obj->getValue<std::string>("jsonrpc"));
    LOK_ASSERT_EQUAL_STR("20", obj->getValue<std::string>("id"));

    auto result = obj->getObject("result");
    LOK_ASSERT(result != nullptr);

    auto content = result->getArray("content");
    LOK_ASSERT(content != nullptr);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), content->size());

    auto item = content->getObject(0);
    LOK_ASSERT_EQUAL_STR("resource", item->getValue<std::string>("type"));

    auto resource = item->getObject("resource");
    LOK_ASSERT(resource != nullptr);
    LOK_ASSERT_EQUAL_STR("application/pdf", resource->getValue<std::string>("mimeType"));
    LOK_ASSERT(resource->has("blob"));

    // "Hello PDF" in base64 is "SGVsbG8gUERG"
    std::string blob = resource->getValue<std::string>("blob");
    LOK_ASSERT_EQUAL_STR("SGVsbG8gUERG", blob);
}

void McpHandlerTests::testWrapBinaryResultMimeType()
{
    constexpr std::string_view testname = __func__;

    const char data[] = "\x89PNG";
    std::string response =
        McpResponseUtil::wrapBinaryResult("30", data, sizeof(data) - 1, "image/png");
    auto obj = parseJson(response);

    auto resource =
        obj->getObject("result")->getArray("content")->getObject(0)->getObject("resource");
    LOK_ASSERT_EQUAL_STR("image/png", resource->getValue<std::string>("mimeType"));
    LOK_ASSERT_EQUAL_STR("data:image/png;base64,", resource->getValue<std::string>("uri"));
}

CPPUNIT_TEST_SUITE_REGISTRATION(McpHandlerTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
