/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <test/lokassert.hpp>

#include <net/HttpRequest.hpp>

#include <chrono>
#include <fstream>

#include <cppunit/extensions/HelperMacros.h>

/// HTTP WhiteBox unit-tests.
class HttpWhiteBoxTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HttpWhiteBoxTests);

    CPPUNIT_TEST(testRequestParserValidComplete);
    CPPUNIT_TEST(testRequestParserValidIncomplete);

    CPPUNIT_TEST_SUITE_END();

    void testRequestParserValidComplete();
    void testRequestParserValidIncomplete();
};

void HttpWhiteBoxTests::testRequestParserValidComplete()
{
    const std::string expVerb = "GET";
    const std::string expUrl = "/path/to/data";
    const std::string expVersion = "HTTP/1.1";
    const std::string data = expVerb + ' ' + expUrl + ' ' + expVersion + "\r\n";

    http::Request req;

    LOK_ASSERT(req.readData(data.c_str(), data.size()) > 0);
    LOK_ASSERT_EQUAL(expVerb, req.getVerb());
    LOK_ASSERT_EQUAL(expUrl, req.getUrl());
    LOK_ASSERT_EQUAL(expVersion, req.getVersion());
}

void HttpWhiteBoxTests::testRequestParserValidIncomplete()
{
    const std::string expVerb = "GET";
    const std::string expUrl = "/path/to/data";
    const std::string expVersion = "HTTP/1.1";
    const std::string data = expVerb + ' ' + expUrl + ' ' + expVersion + "\r\n";

    http::Request req;

    // Pass incomplete data to the reader.
    for (std::size_t i = 0; i < data.size(); ++i)
    {
        // Should return 0 to signify data is incomplete.
        LOK_ASSERT_EQUAL(0L, req.readData(data.c_str(), i));
    }

    // Now parse the whole thing.
    LOK_ASSERT(req.readData(data.c_str(), data.size()) > 0);
    LOK_ASSERT_EQUAL(expVerb, req.getVerb());
    LOK_ASSERT_EQUAL(expUrl, req.getUrl());
    LOK_ASSERT_EQUAL(expVersion, req.getVersion());
}

CPPUNIT_TEST_SUITE_REGISTRATION(HttpWhiteBoxTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
