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
#include <Poco/Net/FilePartSource.h>
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
            LOK_ASSERT_EQUAL(static_cast<std::size_t>(5), tools->size());
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

    TestResult testAuthWrongKey(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string jsonBody = R"({"jsonrpc":"2.0","id":"auth1","method":"initialize"})";
            Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/cool/mcp");
            request.setContentType("application/json");
            request.setContentLength(jsonBody.size());
            request.set("Authorization", "Bearer wrong-key");

            std::ostream& os = session.sendRequest(request);
            os << jsonBody;

            Poco::Net::HTTPResponse response;
            session.receiveResponse(response);
            LOK_ASSERT_EQUAL(static_cast<int>(Poco::Net::HTTPResponse::HTTP_UNAUTHORIZED),
                             static_cast<int>(response.getStatus()));
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testAuthMissingHeader(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string jsonBody = R"({"jsonrpc":"2.0","id":"auth2","method":"initialize"})";
            Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/cool/mcp");
            request.setContentType("application/json");
            request.setContentLength(jsonBody.size());
            // No Authorization header.

            std::ostream& os = session.sendRequest(request);
            os << jsonBody;

            Poco::Net::HTTPResponse response;
            session.receiveResponse(response);
            LOK_ASSERT_EQUAL(static_cast<int>(Poco::Net::HTTPResponse::HTTP_UNAUTHORIZED),
                             static_cast<int>(response.getStatus()));
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testNumericId(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            // JSON-RPC 2.0 allows numeric ids.
            std::string body =
                R"({"jsonrpc":"2.0","id":42,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}}})";
            std::string response = sendMcpRequest(session, body);
            TST_LOG("Response: " << response);

            auto obj = parseJson(response);
            LOK_ASSERT_MESSAGE("expected result for numeric id", obj->has("result"));
            LOK_ASSERT_EQUAL_STR("2.0", obj->getValue<std::string>("jsonrpc"));
            // Numeric id 42 is echoed back as the string "42".
            LOK_ASSERT_EQUAL_STR("42", obj->getValue<std::string>("id"));
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testExtractLinkTargets(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string testDocPath = std::string(TDOC) + "/hello.odt";
            std::string base64Doc = readFileAsBase64(testDocPath);

            std::string body =
                R"({"jsonrpc":"2.0","id":"link1","method":"tools/call","params":{"name":"extract_link_targets","arguments":{"data":")" +
                base64Doc + R"(","filename":"hello.odt"}}})";
            std::string response = sendMcpRequest(session, body);
            TST_LOG("Response length: " << response.size());

            auto obj = parseJson(response);
            LOK_ASSERT_MESSAGE("expected result, got error", !obj->has("error"));
            LOK_ASSERT_EQUAL_STR("link1", obj->getValue<std::string>("id"));
            LOK_ASSERT(obj->has("result"));

            auto result = obj->getObject("result");
            auto content = result->getArray("content");
            LOK_ASSERT(content != nullptr);
            LOK_ASSERT(content->size() > 0);

            auto item = content->getObject(0);
            LOK_ASSERT_EQUAL_STR("text", item->getValue<std::string>("type"));

            // The text field should be parseable JSON.
            std::string text = item->getValue<std::string>("text");
            Poco::JSON::Parser parser;
            parser.parse(text);
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testTransformDocumentStructure(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string testDocPath = std::string(TDOC) + "/empty.odp";
            std::string base64Doc = readFileAsBase64(testDocPath);

            // Simple transform: rename the first slide.
            std::string body =
                R"({"jsonrpc":"2.0","id":"xform1","method":"tools/call","params":{"name":"transform_document_structure","arguments":{"data":")" +
                base64Doc +
                R"(","filename":"empty.odp","transform":"{\"Transforms\":{\"SlideCommands\":[{\"RenameSlide\":\"TestSlide\"}]}}","format":"odp"}}})";
            std::string response = sendMcpRequest(session, body);
            TST_LOG("Response length: " << response.size());

            auto obj = parseJson(response);
            LOK_ASSERT_MESSAGE("expected result, got error", !obj->has("error"));
            LOK_ASSERT_EQUAL_STR("xform1", obj->getValue<std::string>("id"));
            LOK_ASSERT(obj->has("result"));

            auto result = obj->getObject("result");
            auto content = result->getArray("content");
            LOK_ASSERT(content != nullptr);
            LOK_ASSERT(content->size() > 0);

            auto item = content->getObject(0);
            LOK_ASSERT_EQUAL_STR("resource", item->getValue<std::string>("type"));

            auto resource = item->getObject("resource");
            LOK_ASSERT(resource->has("blob"));
            std::string blob = resource->getValue<std::string>("blob");
            LOK_ASSERT(!blob.empty());
            LOK_ASSERT_EQUAL_STR("application/vnd.oasis.opendocument.presentation",
                                 resource->getValue<std::string>("mimeType"));
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testUploadAndConvert(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            // Step 1: Upload a file via multipart POST to /cool/mcp/upload.
            std::string testDocPath = std::string(TDOC) + "/hello.odt";

            Poco::Net::HTMLForm form(Poco::Net::HTMLForm::ENCODING_MULTIPART);
            form.addPart("file",
                         new Poco::Net::FilePartSource(testDocPath, "application/octet-stream"));

            Poco::Net::HTTPRequest uploadRequest(Poco::Net::HTTPRequest::HTTP_POST,
                                                 "/cool/mcp/upload");
            uploadRequest.set("Authorization", "Bearer test-mcp-key");
            form.prepareSubmit(uploadRequest);

            std::ostream& os = session.sendRequest(uploadRequest);
            form.write(os);

            Poco::Net::HTTPResponse uploadResponse;
            std::istream& rs = session.receiveResponse(uploadResponse);
            std::string uploadBody;
            Poco::StreamCopier::copyToString(rs, uploadBody);
            TST_LOG("Upload response: " << uploadBody);

            LOK_ASSERT_EQUAL(static_cast<int>(Poco::Net::HTTPResponse::HTTP_OK),
                             static_cast<int>(uploadResponse.getStatus()));

            auto uploadObj = parseJson(uploadBody);
            LOK_ASSERT(uploadObj->has("file_id"));
            std::string fileId = uploadObj->getValue<std::string>("file_id");
            LOK_ASSERT(!fileId.empty());
            TST_LOG("Got file_id: " << fileId);
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }

        // Step 2: Reconnect (upload closes connection) and convert using file_id.
        try
        {
            std::unique_ptr<Poco::Net::HTTPClientSession> newSession(
                helpers::createSession(Poco::URI(helpers::getTestServerURI())));
            newSession->setTimeout(Poco::Timespan(30, 0));

            // Re-upload since we need a fresh session and file_id.
            std::string testDocPath = std::string(TDOC) + "/hello.odt";

            Poco::Net::HTMLForm form(Poco::Net::HTMLForm::ENCODING_MULTIPART);
            form.addPart("file",
                         new Poco::Net::FilePartSource(testDocPath, "application/octet-stream"));

            Poco::Net::HTTPRequest uploadRequest(Poco::Net::HTTPRequest::HTTP_POST,
                                                 "/cool/mcp/upload");
            uploadRequest.set("Authorization", "Bearer test-mcp-key");
            form.prepareSubmit(uploadRequest);

            std::ostream& os = newSession->sendRequest(uploadRequest);
            form.write(os);

            Poco::Net::HTTPResponse uploadResponse;
            std::istream& rs = newSession->receiveResponse(uploadResponse);
            std::string uploadBody;
            Poco::StreamCopier::copyToString(rs, uploadBody);

            auto uploadObj = parseJson(uploadBody);
            std::string fileId = uploadObj->getValue<std::string>("file_id");
            TST_LOG("Got file_id for convert: " << fileId);

            // Reconnect for the convert call.
            newSession = helpers::createSession(Poco::URI(helpers::getTestServerURI()));
            newSession->setTimeout(Poco::Timespan(30, 0));

            std::string body =
                R"({"jsonrpc":"2.0","id":"upload1","method":"tools/call","params":{"name":"convert_document","arguments":{"file_id":")" +
                fileId + R"(","format":"pdf"}}})";
            std::string response = sendMcpRequest(*newSession, body);
            TST_LOG("Convert response length: " << response.size());

            auto obj = parseJson(response);
            LOK_ASSERT_MESSAGE("expected result, got error", !obj->has("error"));
            LOK_ASSERT_EQUAL_STR("upload1", obj->getValue<std::string>("id"));

            auto result = obj->getObject("result");
            auto content = result->getArray("content");
            LOK_ASSERT(content != nullptr);
            LOK_ASSERT(content->size() > 0);

            auto item = content->getObject(0);
            LOK_ASSERT_EQUAL_STR("resource", item->getValue<std::string>("type"));

            auto resource = item->getObject("resource");
            LOK_ASSERT(resource->has("blob"));
            std::string blob = resource->getValue<std::string>("blob");
            LOK_ASSERT(!blob.empty());

            // Decode and check it starts with %PDF.
            std::string decoded;
            std::string err = macaron::Base64::Decode(blob, decoded);
            LOK_ASSERT_MESSAGE("base64 decode failed", err.empty());
            LOK_ASSERT_EQUAL_STR("%PDF", decoded.substr(0, 4));
            TST_LOG("Upload+convert PDF size: " << decoded.size() << " bytes");
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    /// POST hello.odt to /cool/mcp/upload with the given Bearer value on a fresh
    /// session. Returns the HTTP status code and populates outBody.
    static int postUpload(const std::string& bearer, std::string& outBody)
    {
        std::unique_ptr<Poco::Net::HTTPClientSession> s(
            helpers::createSession(Poco::URI(helpers::getTestServerURI())));
        s->setTimeout(Poco::Timespan(30, 0));

        std::string testDocPath = std::string(TDOC) + "/hello.odt";
        Poco::Net::HTMLForm form(Poco::Net::HTMLForm::ENCODING_MULTIPART);
        form.addPart("file",
                     new Poco::Net::FilePartSource(testDocPath, "application/octet-stream"));

        Poco::Net::HTTPRequest req(Poco::Net::HTTPRequest::HTTP_POST, "/cool/mcp/upload");
        req.set("Authorization", "Bearer " + bearer);
        form.prepareSubmit(req);

        std::ostream& os = s->sendRequest(req);
        form.write(os);

        Poco::Net::HTTPResponse response;
        std::istream& rs = s->receiveResponse(response);
        outBody.clear();
        Poco::StreamCopier::copyToString(rs, outBody);
        return static_cast<int>(response.getStatus());
    }

    TestResult testPrepareUpload(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string body =
                R"({"jsonrpc":"2.0","id":"prep1","method":"tools/call","params":{"name":"prepare_upload","arguments":{}}})";
            std::string response = sendMcpRequest(session, body);
            TST_LOG("Response: " << response);

            auto obj = parseJson(response);
            LOK_ASSERT_MESSAGE("expected result, got error", !obj->has("error"));

            auto content = obj->getObject("result")->getArray("content");
            auto item = content->getObject(0);
            LOK_ASSERT_EQUAL_STR("text", item->getValue<std::string>("type"));

            std::string text = item->getValue<std::string>("text");
            auto info = parseJson(text);

            LOK_ASSERT(info->has("upload_url"));
            const std::string uploadUrl = info->getValue<std::string>("upload_url");
            LOK_ASSERT_MESSAGE("upload_url must be absolute",
                               uploadUrl.compare(0, 7, "http://") == 0
                                   || uploadUrl.compare(0, 8, "https://") == 0);
            const std::string suffix = "/cool/mcp/upload";
            LOK_ASSERT_MESSAGE("upload_url must point at /cool/mcp/upload",
                               uploadUrl.size() >= suffix.size()
                                   && uploadUrl.compare(uploadUrl.size() - suffix.size(),
                                                        suffix.size(), suffix)
                                          == 0);
            LOK_ASSERT(info->has("upload_token"));
            LOK_ASSERT(!info->getValue<std::string>("upload_token").empty());
            LOK_ASSERT(info->has("expires_in"));
            LOK_ASSERT_MESSAGE("prepare_upload must not leak the master api_key",
                               !info->has("api_key"));
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testUploadWithToken(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string body =
                R"({"jsonrpc":"2.0","id":"prep2","method":"tools/call","params":{"name":"prepare_upload","arguments":{}}})";
            std::string response = sendMcpRequest(session, body);
            auto text = parseJson(response)
                            ->getObject("result")
                            ->getArray("content")
                            ->getObject(0)
                            ->getValue<std::string>("text");
            std::string token = parseJson(text)->getValue<std::string>("upload_token");

            std::string uploadBody;
            int status = postUpload(token, uploadBody);
            TST_LOG("Upload with token status=" << status << " body=" << uploadBody);
            LOK_ASSERT_EQUAL(static_cast<int>(Poco::Net::HTTPResponse::HTTP_OK), status);

            auto uploadObj = parseJson(uploadBody);
            LOK_ASSERT(uploadObj->has("file_id"));
            LOK_ASSERT(!uploadObj->getValue<std::string>("file_id").empty());
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testUploadTokenSingleUse(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string body =
                R"({"jsonrpc":"2.0","id":"prep3","method":"tools/call","params":{"name":"prepare_upload","arguments":{}}})";
            std::string response = sendMcpRequest(session, body);
            auto text = parseJson(response)
                            ->getObject("result")
                            ->getArray("content")
                            ->getObject(0)
                            ->getValue<std::string>("text");
            std::string token = parseJson(text)->getValue<std::string>("upload_token");

            std::string first;
            LOK_ASSERT_EQUAL(static_cast<int>(Poco::Net::HTTPResponse::HTTP_OK),
                             postUpload(token, first));

            std::string second;
            int status = postUpload(token, second);
            TST_LOG("Second upload status=" << status);
            LOK_ASSERT_EQUAL(static_cast<int>(Poco::Net::HTTPResponse::HTTP_UNAUTHORIZED), status);
        }
        catch (const Poco::Exception& exc)
        {
            LOK_ASSERT_FAIL(exc.displayText());
        }
        return TestResult::Ok;
    }

    TestResult testUploadTokenWrongEndpoint(Poco::Net::HTTPClientSession& session)
    {
        setTestname(__func__);
        TST_LOG("Starting test");
        try
        {
            std::string body =
                R"({"jsonrpc":"2.0","id":"prep4","method":"tools/call","params":{"name":"prepare_upload","arguments":{}}})";
            std::string response = sendMcpRequest(session, body);
            auto text = parseJson(response)
                            ->getObject("result")
                            ->getArray("content")
                            ->getObject(0)
                            ->getValue<std::string>("text");
            std::string token = parseJson(text)->getValue<std::string>("upload_token");

            // Use the upload token to authenticate a JSON-RPC call. Must be rejected.
            std::unique_ptr<Poco::Net::HTTPClientSession> s(
                helpers::createSession(Poco::URI(helpers::getTestServerURI())));
            s->setTimeout(Poco::Timespan(30, 0));

            std::string jsonBody = R"({"jsonrpc":"2.0","id":"rpc1","method":"initialize"})";
            Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/cool/mcp");
            request.setContentType("application/json");
            request.setContentLength(jsonBody.size());
            request.set("Authorization", "Bearer " + token);

            std::ostream& os = s->sendRequest(request);
            os << jsonBody;

            Poco::Net::HTTPResponse resp;
            s->receiveResponse(resp);
            TST_LOG("RPC-with-upload-token status=" << static_cast<int>(resp.getStatus()));
            LOK_ASSERT_EQUAL(static_cast<int>(Poco::Net::HTTPResponse::HTTP_UNAUTHORIZED),
                             static_cast<int>(resp.getStatus()));
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

                // Auth tests first (use separate sessions since rejected connections may close).
                result = testAuthWrongKey(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                // Reconnect after auth rejection.
                session = helpers::createSession(Poco::URI(helpers::getTestServerURI()));
                session->setTimeout(Poco::Timespan(30, 0));

                result = testAuthMissingHeader(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                // Reconnect after auth rejection.
                session = helpers::createSession(Poco::URI(helpers::getTestServerURI()));
                session->setTimeout(Poco::Timespan(30, 0));

                result = testInitialize(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                result = testToolsList(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                result = testUnknownTool(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                result = testMissingData(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                result = testNumericId(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                result = testExtractDocumentStructure(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                result = testConvertDocument(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                result = testExtractLinkTargets(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                result = testTransformDocumentStructure(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                // Reconnect for upload test (uses separate sessions internally).
                session = helpers::createSession(Poco::URI(helpers::getTestServerURI()));
                session->setTimeout(Poco::Timespan(30, 0));

                result = testUploadAndConvert(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                session = helpers::createSession(Poco::URI(helpers::getTestServerURI()));
                session->setTimeout(Poco::Timespan(30, 0));

                result = testPrepareUpload(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                result = testUploadWithToken(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                result = testUploadTokenSingleUse(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
                }

                result = testUploadTokenWrongEndpoint(*session);
                if (result != TestResult::Ok)
                {
                    exitTest(result);
                    return;
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
        setTimeout(60s);
    }
};

UnitBase* unit_create_wsd(void) { return new UnitMcp(); }

UnitBase* unit_create_kit(void) { return new UnitKitMcp(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
