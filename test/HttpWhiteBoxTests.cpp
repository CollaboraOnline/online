/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <string>
#include <test/lokassert.hpp>

#include <net/HttpRequest.hpp>

#include <chrono>
#include <fstream>

#include <cppunit/extensions/HelperMacros.h>

/// HTTP WhiteBox unit-tests.
class HttpWhiteBoxTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HttpWhiteBoxTests);

    CPPUNIT_TEST(testStatusLineParserValidComplete);
    CPPUNIT_TEST(testStatusLineParserValidIncomplete);
    CPPUNIT_TEST(testStatusLineSerialize);

    CPPUNIT_TEST(testHeader);

    CPPUNIT_TEST(testRequestParserValidComplete);
    CPPUNIT_TEST(testRequestParserValidIncomplete);

    CPPUNIT_TEST_SUITE_END();

    void testStatusLineParserValidComplete();
    void testStatusLineParserValidIncomplete();
    void testStatusLineSerialize();
    void testHeader();
    void testRequestParserValidComplete();
    void testRequestParserValidIncomplete();
};

void HttpWhiteBoxTests::testStatusLineParserValidComplete()
{
    const unsigned expVersionMajor = 1;
    const unsigned expVersionMinor = 1;
    const std::string expVersion
        = "HTTP/" + std::to_string(expVersionMajor) + '.' + std::to_string(expVersionMinor);
    const unsigned expStatusCode = 101;
    const std::string expReasonPhrase = "Something Something";
    const std::string data
        = expVersion + ' ' + std::to_string(expStatusCode) + ' ' + expReasonPhrase + "\r\n";

    http::StatusLine statusLine;

    int64_t len = data.size();
    LOK_ASSERT_EQUAL(http::FieldParseState::Valid, statusLine.parse(data.c_str(), len));
    LOK_ASSERT_EQUAL(expVersion, statusLine.httpVersion());
    LOK_ASSERT_EQUAL(expVersionMajor, statusLine.versionMajor());
    LOK_ASSERT_EQUAL(expVersionMinor, statusLine.versionMinor());
    LOK_ASSERT_EQUAL(expStatusCode, statusLine.statusCode());
    LOK_ASSERT_EQUAL(expReasonPhrase, statusLine.reasonPhrase());
}

void HttpWhiteBoxTests::testStatusLineParserValidIncomplete()
{
    const unsigned expVersionMajor = 1;
    const unsigned expVersionMinor = 1;
    const std::string expVersion
        = "HTTP/" + std::to_string(expVersionMajor) + '.' + std::to_string(expVersionMinor);
    const unsigned expStatusCode = 101;
    const std::string expReasonPhrase = "Something Something";
    const std::string data
        = expVersion + ' ' + std::to_string(expStatusCode) + ' ' + expReasonPhrase + "\r\n";

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
    LOK_ASSERT_EQUAL(expVersion, statusLine.httpVersion());
    LOK_ASSERT_EQUAL(expVersionMajor, statusLine.versionMajor());
    LOK_ASSERT_EQUAL(expVersionMinor, statusLine.versionMinor());
    LOK_ASSERT_EQUAL(expStatusCode, statusLine.statusCode());
    LOK_ASSERT_EQUAL(expReasonPhrase, statusLine.reasonPhrase());
}

void HttpWhiteBoxTests::testStatusLineSerialize()
{
    http::StatusLine statusLine(200);
    Buffer buf;
    statusLine.writeData(buf);
    const std::string out(buf.getBlock(), buf.getBlockSize());
    LOK_ASSERT_EQUAL(std::string("HTTP/1.1 200 OK\r\n"), out);
}

void HttpWhiteBoxTests::testHeader()
{
    http::Header header;

    const std::string data = "\r\na=\r\n\r\n";
    LOK_ASSERT_EQUAL(8L, header.parse(data.c_str(), data.size()));
}

void HttpWhiteBoxTests::testRequestParserValidComplete()
{
    const std::string expVerb = "GET";
    const std::string expUrl = "/path/to/data";
    const std::string expVersion = "HTTP/1.1";
    const std::string data = expVerb + ' ' + expUrl + ' ' + expVersion + "\r\n" + "EmptyKey:\r\n"
                             + "Host: localhost.com\r\n\r\n";

    http::Request req;

    LOK_ASSERT(req.readData(data.c_str(), data.size()) > 0);
    LOK_ASSERT_EQUAL(expVerb, req.getVerb());
    LOK_ASSERT_EQUAL(expUrl, req.getUrl());
    LOK_ASSERT_EQUAL(expVersion, req.getVersion());
    LOK_ASSERT_EQUAL(std::string(), req.get("emptykey"));
    LOK_ASSERT_EQUAL(std::string("localhost.com"), req.get("Host"));
}

void HttpWhiteBoxTests::testRequestParserValidIncomplete()
{
    const std::string expVerb = "GET";
    const std::string expUrl = "/long/path/to/data";
    const std::string expVersion = "HTTP/1.1";
    const std::string expHost = "localhost.com";
    const std::string data
        = expVerb + ' ' + expUrl + ' ' + expVersion + "\r\n" + "Host: " + expHost + "\r\n\r\n";

    http::Request req;

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

    LOK_ASSERT_EQUAL(expVerb, req.getVerb());
    LOK_ASSERT_EQUAL(expUrl, req.getUrl());
    LOK_ASSERT_EQUAL(expVersion, req.getVersion());
    LOK_ASSERT_EQUAL(expHost, req.header().get("Host"));
}

CPPUNIT_TEST_SUITE_REGISTRATION(HttpWhiteBoxTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
