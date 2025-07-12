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

    CPPUNIT_TEST(testRequestParserValidComplete);
    CPPUNIT_TEST(testRequestParserValidIncomplete);
    CPPUNIT_TEST(testClipboardIsOwnFormat);

    CPPUNIT_TEST_SUITE_END();

    void testStatusLineParserValidComplete();
    void testStatusLineParserValidComplete_NoReason();
    void testStatusLineParserValidIncomplete();
    void testStatusLineSerialize();
    void testHeader();
    void testRequestParserValidComplete();
    void testRequestParserValidIncomplete();
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
