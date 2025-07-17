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

#include <config.h>

#include <string>

#include <common/Clipboard.hpp>
#include <net/HttpRequest.hpp>

#include <test/lokassert.hpp>

#include <cppunit/extensions/HelperMacros.h>

/// HTTP WhiteBox unit-tests.
class HttpWhiteBoxTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HttpWhiteBoxTests);

    CPPUNIT_TEST(testStatusLineParserValidComplete);
    CPPUNIT_TEST(testStatusLineParserValidComplete_NoReason);
    CPPUNIT_TEST(testStatusLineParserValidIncomplete);
    CPPUNIT_TEST(testStatusLineSerialize);

    CPPUNIT_TEST(testHeader);
    CPPUNIT_TEST(testCookies);

    CPPUNIT_TEST(testRequestParserValidComplete);
    CPPUNIT_TEST(testRequestParserValidIncomplete);
    CPPUNIT_TEST(testRequestParserValidPostComplete);
    CPPUNIT_TEST(testRequestParserValidPostIncomplete);
    CPPUNIT_TEST(testClipboardIsOwnFormat);

    CPPUNIT_TEST_SUITE_END();

    void testStatusLineParserValidComplete();
    void testStatusLineParserValidComplete_NoReason();
    void testStatusLineParserValidIncomplete();
    void testStatusLineSerialize();
    void testHeader();
    void testCookies();
    void testRequestParserValidComplete();
    void testRequestParserValidIncomplete();
    void testRequestParserValidPostComplete();
    void testRequestParserValidPostIncomplete();
    void testClipboardIsOwnFormat();
};

void HttpWhiteBoxTests::testStatusLineParserValidComplete()
{
    constexpr std::string_view testname = __func__;

    const unsigned expVersionMajor = 1;
    const unsigned expVersionMinor = 1;
    const std::string expVersion
        = "HTTP/" + std::to_string(expVersionMajor) + '.' + std::to_string(expVersionMinor);
    const http::StatusCode expStatusCode = http::StatusCode::SwitchingProtocols;
    const std::string expReasonPhrase = "Something Something";

    std::ostringstream oss;
    oss << expVersion << ' ' << static_cast<unsigned>(expStatusCode) << ' ' << expReasonPhrase
        << "\r\n";
    const std::string data = oss.str();

    http::StatusLine statusLine;

    int64_t len = data.size();
    LOK_ASSERT_EQUAL(http::FieldParseState::Valid, statusLine.parse(data.c_str(), len));
    LOK_ASSERT_EQUAL_STR(expVersion, statusLine.httpVersion());
    LOK_ASSERT_EQUAL(expVersionMajor, statusLine.versionMajor());
    LOK_ASSERT_EQUAL(expVersionMinor, statusLine.versionMinor());
    LOK_ASSERT_EQUAL(expStatusCode, statusLine.statusCode());
    LOK_ASSERT_EQUAL_STR(expReasonPhrase, statusLine.reasonPhrase());
}

void HttpWhiteBoxTests::testStatusLineParserValidComplete_NoReason()
{
    constexpr std::string_view testname = __func__;

    const unsigned expVersionMajor = 1;
    const unsigned expVersionMinor = 1;
    const std::string expVersion
        = "HTTP/" + std::to_string(expVersionMajor) + '.' + std::to_string(expVersionMinor);
    const http::StatusCode expStatusCode = http::StatusCode::SwitchingProtocols;
    const std::string expReasonPhrase;

    std::ostringstream oss;
    oss << expVersion << ' ' << static_cast<unsigned>(expStatusCode) << ' ' << expReasonPhrase
        << "\r\n";
    const std::string data = oss.str();

    http::StatusLine statusLine;

    int64_t len = data.size();
    LOK_ASSERT_EQUAL(http::FieldParseState::Valid, statusLine.parse(data.c_str(), len));
    LOK_ASSERT_EQUAL_STR(expVersion, statusLine.httpVersion());
    LOK_ASSERT_EQUAL(expVersionMajor, statusLine.versionMajor());
    LOK_ASSERT_EQUAL(expVersionMinor, statusLine.versionMinor());
    LOK_ASSERT_EQUAL(expStatusCode, statusLine.statusCode());
    LOK_ASSERT_EQUAL_STR(expReasonPhrase, statusLine.reasonPhrase());
}

void HttpWhiteBoxTests::testStatusLineParserValidIncomplete()
{
    constexpr std::string_view testname = __func__;

    const unsigned expVersionMajor = 1;
    const unsigned expVersionMinor = 1;
    const std::string expVersion
        = "HTTP/" + std::to_string(expVersionMajor) + '.' + std::to_string(expVersionMinor);
    const http::StatusCode expStatusCode = http::StatusCode::SwitchingProtocols;
    const std::string expReasonPhrase = "Something Something";

    std::ostringstream oss;
    oss << expVersion << ' ' << static_cast<unsigned>(expStatusCode) << ' ' << expReasonPhrase
        << "\r\n";
    const std::string data = oss.str();

    http::StatusLine statusLine;

    // Pass incomplete data to the reader.
    for (std::size_t i = 0; i < data.size(); ++i)
    {
        // Should return 0 to signify data is incomplete.
        int64_t len = i;
        LOK_ASSERT_EQUAL_MESSAGE("i = " + std::to_string(i), http::FieldParseState::Incomplete,
                                 statusLine.parse(data.c_str(), len));
    }

    int64_t len = data.size();
    LOK_ASSERT_EQUAL(http::FieldParseState::Valid, statusLine.parse(data.c_str(), len));
    LOK_ASSERT_EQUAL_STR(expVersion, statusLine.httpVersion());
    LOK_ASSERT_EQUAL(expVersionMajor, statusLine.versionMajor());
    LOK_ASSERT_EQUAL(expVersionMinor, statusLine.versionMinor());
    LOK_ASSERT_EQUAL(expStatusCode, statusLine.statusCode());
    LOK_ASSERT_EQUAL_STR(expReasonPhrase, statusLine.reasonPhrase());
}

void HttpWhiteBoxTests::testStatusLineSerialize()
{
    constexpr std::string_view testname = __func__;

    http::StatusLine statusLine(200);
    Buffer buf;
    statusLine.writeData(buf);
    const std::string out(buf.getBlock(), buf.getBlockSize());
    LOK_ASSERT_EQUAL_STR("HTTP/1.1 200 OK\r\n", out);
}

void HttpWhiteBoxTests::testHeader()
{
    constexpr std::string_view testname = __func__;

    http::Header header;

    const std::string data = "\r\na=\r\n\r\n";
    LOK_ASSERT_EQUAL(8L, header.parse(data.c_str(), data.size()));
    LOK_ASSERT_EQUAL(0UL, header.size());
}

void HttpWhiteBoxTests::testCookies()
{
    constexpr std::string_view testname = __func__;

    http::Header header;

    header.addCookie("Expire=Now");
    header.addCookie("Why=Question;When=Not");

    for (const auto& cookie : header.getCookies())
    {
        if (cookie.first == "Expire")
        {
            LOK_ASSERT_EQUAL_STR("Now", cookie.second);
        }
        else if (cookie.first == "Why")
        {
            LOK_ASSERT_EQUAL_STR("Question", cookie.second);
        }
        else if (cookie.first == "When")
        {
            LOK_ASSERT_EQUAL_STR("Not", cookie.second);
        }
    }
}

void HttpWhiteBoxTests::testRequestParserValidComplete()
{
    constexpr std::string_view testname = __func__;

    const std::string expVerb = "GET";
    const std::string expUrl = "/path/to/data";
    const std::string expVersion = "HTTP/1.1";
    const std::string data = expVerb + ' ' + expUrl + ' ' + expVersion + "\r\n" + "EmptyKey:\r\n"
                             + "Host: localhost.com\r\n\r\n";

    http::RequestParser req;

    LOK_ASSERT(req.readData(data.c_str(), data.size()) > 0);
    LOK_ASSERT_EQUAL_STR(expVerb, req.getVerb());
    LOK_ASSERT_EQUAL_STR(expUrl, req.getUrl());
    LOK_ASSERT_EQUAL_STR(expVersion, req.getVersion());
    LOK_ASSERT_EQUAL_STR(std::string(), req.get("emptykey"));
    LOK_ASSERT_EQUAL_STR("localhost.com", req.get("Host"));
    LOK_ASSERT_EQUAL(2UL, req.header().size());
}

void HttpWhiteBoxTests::testRequestParserValidIncomplete()
{
    constexpr std::string_view testname = __func__;

    const std::string expVerb = "GET";
    const std::string expUrl = "/long/path/to/data";
    const std::string expVersion = "HTTP/1.1";
    const std::string expHost = "localhost.com";
    const std::string data
        = expVerb + ' ' + expUrl + ' ' + expVersion + "\r\n" + "Host: " + expHost + "\r\n\r\n";

    http::RequestParser req;

    // Pass incomplete data to the reader.
    for (std::size_t i = 0; i < 33; ++i)
    {
        // Should return 0 to signify that data is incomplete.
        LOK_ASSERT_EQUAL_MESSAGE("i = " << i << " of " << data.size() - 1, 0L,
                                 req.readData(data.c_str(), i));
    }

    // Offset of the end of first line.
    const int64_t off = 33;

    // Parse the first line.
    LOK_ASSERT_EQUAL_MESSAGE("Parsing the first line failed.", off,
                             req.readData(data.c_str(), off));
    LOK_ASSERT_EQUAL(http::Request::Stage::Header, req.stage());

    // Skip the first line and parse the header.
    for (std::size_t i = off; i < data.size(); ++i)
    {
        // Should return 0 to signify that data is incomplete.
        LOK_ASSERT_EQUAL_MESSAGE("i = " << i << " of " << data.size() - 1, 0L,
                                 req.readData(data.c_str() + off, i - off));
    }

    // Parse the header.
    LOK_ASSERT_EQUAL_MESSAGE("Parsing the header failed.",
                             static_cast<int64_t>(expHost.size() + 10),
                             req.readData(data.c_str() + off, data.size() - off));

    LOK_ASSERT_EQUAL_STR(expVerb, req.getVerb());
    LOK_ASSERT_EQUAL_STR(expUrl, req.getUrl());
    LOK_ASSERT_EQUAL_STR(expVersion, req.getVersion());
    LOK_ASSERT_EQUAL_STR(expHost, req.get("Host"));
    LOK_ASSERT_EQUAL(1UL, req.header().size());
}

void HttpWhiteBoxTests::testRequestParserValidPostComplete()
{
    constexpr std::string_view testname = __func__;

    const std::string expVerb = "POST";
    const std::string expUrl = "/path/to/data";
    const std::string expVersion = "HTTP/1.1";
    constexpr std::string_view payload =
        "Some random string of data that has no particular purpose other "
        "than being a test payload.";

    std::ostringstream oss;
    oss << expVerb << ' ' << expUrl << ' ' << expVersion << "\r\n"
        << "EmptyKey:\r\n"
        << "Content-Length: " << payload.size() << "\r\n"
        << "Host: localhost.com\r\n\r\n"
        << payload;
    const std::string data = oss.str();

    http::RequestParser req;

    LOK_ASSERT(req.readData(data.c_str(), data.size()) > 0);
    LOK_ASSERT_EQUAL_STR(expVerb, req.getVerb());
    LOK_ASSERT_EQUAL_STR(expUrl, req.getUrl());
    LOK_ASSERT_EQUAL_STR(expVersion, req.getVersion());
    LOK_ASSERT_EQUAL_STR(std::string(), req.get("emptykey"));
    LOK_ASSERT_EQUAL_STR("localhost.com", req.get("Host"));
    LOK_ASSERT_EQUAL_STR(std::to_string(payload.size()), req.get("Content-Length"));
    LOK_ASSERT_EQUAL(3UL, req.header().size());
    LOK_ASSERT_EQUAL_STR(payload, req.getBody());
}

void HttpWhiteBoxTests::testRequestParserValidPostIncomplete()
{
    constexpr std::string_view testname = __func__;

    const std::string expVerb = "POST";
    const std::string expUrl = "/path/to/data";
    const std::string expVersion = "HTTP/1.1";
    constexpr std::string_view payload =
        "Some random string of data that has no particular purpose other "
        "than being a test payload.";

    std::ostringstream oss;
    oss << expVerb << ' ' << expUrl << ' ' << expVersion << "\r\n"
        << "EmptyKey:\r\n"
        << "Content-Length: " << payload.size() << "\r\n"
        << "Host: localhost.com\r\n\r\n"
        << payload;
    std::string data = oss.str();

    http::RequestParser req;

    // Pass incomplete data to the reader.
    const int64_t lenRequestLine = 29;
    for (std::size_t i = 0; i < lenRequestLine; ++i)
    {
        // Should return 0 to signify that data is incomplete.
        LOK_ASSERT_EQUAL(http::Request::Stage::RequestLine, req.stage());
        LOK_ASSERT_EQUAL_MESSAGE("i = " << i << " of " << data.size() - 1, 0L,
                                 req.readData(data.c_str(), i));
    }

    // Parse the request-line.
    LOK_ASSERT_EQUAL_MESSAGE("Parsing the request-line failed.", lenRequestLine,
                             req.readData(data.c_str(), lenRequestLine));
    LOK_ASSERT_EQUAL(http::Request::Stage::Header, req.stage());
    LOK_ASSERT_EQUAL_STR(expVerb, req.getVerb());
    LOK_ASSERT_EQUAL_STR(expUrl, req.getUrl());
    LOK_ASSERT_EQUAL_STR(expVersion, req.getVersion());

    // Continue by parsing the header. Simulate erasing read data (lenRequestLine).
    data = data.substr(lenRequestLine);

    // Pass incomplete data to the reader.
    const int64_t lenHeader = 54;
    for (std::size_t i = 0; i < lenHeader; ++i)
    {
        // Should return 0 to signify that data is incomplete.
        LOK_ASSERT_EQUAL(http::Request::Stage::Header, req.stage());
        LOK_ASSERT_EQUAL_MESSAGE("i = " << i << " of " << data.size() - 1, 0L,
                                 req.readData(data.c_str(), i));
    }

    // Parse the header.
    LOK_ASSERT_EQUAL_MESSAGE("Parsing the header failed.", lenHeader,
                             req.readData(data.c_str(), lenHeader));
    LOK_ASSERT_EQUAL(http::Request::Stage::Body, req.stage());

    LOK_ASSERT_EQUAL(std::string(), req.get("emptykey"));
    LOK_ASSERT_EQUAL_STR("localhost.com", req.get("Host"));
    LOK_ASSERT_EQUAL_STR(payload.size(), req.get("Content-Length"));
    LOK_ASSERT_EQUAL(3UL, req.header().size());

    // Continue by parsing the data. Simulate erasing read data (lenHeader).
    data = data.substr(lenHeader);
    for (int64_t i = 0; static_cast<uint64_t>(i) < data.size(); ++i)
    {
        // Should return the number of characters consumed.
        LOK_ASSERT_EQUAL(http::Request::Stage::Body, req.stage());
        LOK_ASSERT_EQUAL_MESSAGE("i = " << i << " of " << data.size() - 1, i,
                                 req.readData(data.c_str(), i));
        data = data.substr(i);
    }

    // Parse the data.
    LOK_ASSERT_EQUAL_MESSAGE("Parsing the data failed.", static_cast<int64_t>(data.size()),
                             req.readData(data.c_str(), data.size()));
    LOK_ASSERT_EQUAL(http::Request::Stage::Finished, req.stage());
    LOK_ASSERT_EQUAL_STR(payload, req.getBody());
}

void HttpWhiteBoxTests::testClipboardIsOwnFormat()
{
    constexpr std::string_view testname = __func__;
    {
        std::string body = R"x(application/x-openoffice-embed-source-xml;windows_formatname="Star Embed Source (XML)"
1def
PK)x";
        std::istringstream stream(body);

        LOK_ASSERT_EQUAL(ClipboardData::isOwnFormat(stream), true);
    }
    {
        std::string body = R"(<!DOCTYPE html>
<html>
<head>)";
        std::istringstream stream(body);

        // This is expected to fail: format is mimetype-length-bytes tuples and here the second line
        // is not a hex size.
        LOK_ASSERT_EQUAL(ClipboardData::isOwnFormat(stream), false);
    }
}

CPPUNIT_TEST_SUITE_REGISTRATION(HttpWhiteBoxTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
