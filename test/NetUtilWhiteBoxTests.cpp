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

#include <net/Buffer.hpp>
#include <net/NetUtil.hpp>

#include <test/lokassert.hpp>

#include <cppunit/TestAssert.h>
#include <cppunit/extensions/HelperMacros.h>

/// Net-utility WhiteBox unit-tests.
class NetUtilWhiteBoxTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(NetUtilWhiteBoxTests);
    CPPUNIT_TEST(testBufferClass);
    CPPUNIT_TEST(testParseUri);
    CPPUNIT_TEST(testParseUriUrl);
    CPPUNIT_TEST(testParseUrl);
    CPPUNIT_TEST_SUITE_END();

    void testBufferClass();
    void testParseUri();
    void testParseUriUrl();
    void testParseUrl();
};

void NetUtilWhiteBoxTests::testBufferClass()
{
    constexpr auto testname = __func__;

    Buffer buf;
    LOK_ASSERT_EQUAL(0UL, buf.size());
    LOK_ASSERT_EQUAL(true, buf.empty());
    LOK_ASSERT(buf.getBlock() == nullptr);
    buf.eraseFirst(buf.size());
    LOK_ASSERT_EQUAL(0UL, buf.size());
    LOK_ASSERT_EQUAL(true, buf.empty());

    // Small data.
    const char data[] = "abcdefghijklmnop";
    buf.append(data, sizeof(data));

    LOK_ASSERT_EQUAL(static_cast<std::size_t>(sizeof(data)), buf.size());
    LOK_ASSERT_EQUAL(false, buf.empty());
    LOK_ASSERT(buf.getBlock() != nullptr);
    LOK_ASSERT_EQUAL(0, memcmp(buf.getBlock(), data, buf.size()));

    // Erase one char at a time.
    for (std::size_t i = buf.size(); i > 0; --i)
    {
        buf.eraseFirst(1);
        LOK_ASSERT_EQUAL(i - 1, buf.size());
        LOK_ASSERT_EQUAL(i == 1, buf.empty()); // Not empty until the last element.
        LOK_ASSERT_EQUAL(buf.getBlock() != nullptr, !buf.empty());
        if (!buf.empty())
            LOK_ASSERT_EQUAL(0, memcmp(buf.getBlock(), data + (sizeof(data) - i) + 1, buf.size()));
    }

    // Large data.
    constexpr std::size_t BlockSize = 512 * 1024; // We add twice this.
    constexpr std::size_t BlockCount = 10;
    for (std::size_t i = 0; i < BlockCount; ++i)
    {
        const auto prevSize = buf.size();

        const std::vector<char> dataLarge(2 * BlockSize, 'a' + i); // Block of a single char.
        buf.append(dataLarge.data(), dataLarge.size());
        LOK_ASSERT_EQUAL(prevSize + (2 * BlockSize), buf.size());

        // Remove half.
        buf.eraseFirst(BlockSize);
        LOK_ASSERT_EQUAL(prevSize + BlockSize, buf.size());
        LOK_ASSERT_EQUAL(0, memcmp(buf.getBlock() + prevSize, dataLarge.data(), BlockSize));
    }

    LOK_ASSERT_EQUAL(BlockSize * BlockCount, buf.size());
    LOK_ASSERT_EQUAL(false, buf.empty());

    // Remove each block of data and test.
    for (std::size_t i = BlockCount / 2; i < BlockCount; ++i) // We removed half above.
    {
        LOK_ASSERT_EQUAL(false, buf.empty());
        LOK_ASSERT_EQUAL(BlockSize * 2 * (BlockCount - i), buf.size());

        const std::vector<char> dataLarge(BlockSize * 2, 'a' + i); // Block of a single char.
        LOK_ASSERT_EQUAL(0, memcmp(buf.getBlock(), dataLarge.data(), BlockSize));

        buf.eraseFirst(BlockSize * 2);
    }

    LOK_ASSERT_EQUAL(0UL, buf.size());
    LOK_ASSERT_EQUAL(true, buf.empty());

    // Very large data.
    const std::vector<char> dataLarge(20 * BlockSize, 'x'); // Block of a single char.
    buf.append(dataLarge.data(), dataLarge.size());
    LOK_ASSERT_EQUAL(dataLarge.size(), buf.size());

    buf.append(data, sizeof(data)); // Add small data.
    LOK_ASSERT_EQUAL(dataLarge.size() + sizeof(data), buf.size());

    buf.eraseFirst(dataLarge.size()); // Remove large data.
    LOK_ASSERT_EQUAL(sizeof(data), buf.size());
    LOK_ASSERT_EQUAL(false, buf.empty());
    LOK_ASSERT_EQUAL(0, memcmp(buf.getBlock(), data, buf.size()));

    buf.eraseFirst(buf.size()); // Remove all.
    LOK_ASSERT_EQUAL(0UL, buf.size());
    LOK_ASSERT_EQUAL(true, buf.empty());
}

void NetUtilWhiteBoxTests::testParseUri()
{
    constexpr auto testname = __func__;

    std::string scheme = "***";
    std::string host = "***";
    std::string port = "***";

    LOK_ASSERT(!net::parseUri(std::string(), scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT(host.empty());
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("localhost", scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("localhost"), host);
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("127.0.0.1", scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("domain.com", scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("127.0.0.1:9999", scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT_EQUAL(std::string("9999"), port);

    LOK_ASSERT(net::parseUri("domain.com:88", scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);

    LOK_ASSERT(net::parseUri("http://domain.com", scheme, host, port));
    LOK_ASSERT_EQUAL(std::string("http://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("https://domain.com:88", scheme, host, port));
    LOK_ASSERT_EQUAL(std::string("https://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);

    LOK_ASSERT(net::parseUri("http://domain.com/path/to/file", scheme, host, port));
    LOK_ASSERT_EQUAL(std::string("http://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("https://domain.com:88/path/to/file", scheme, host, port));
    LOK_ASSERT_EQUAL(std::string("https://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);

    LOK_ASSERT(net::parseUri("wss://127.0.0.1:9999/", scheme, host, port));
    LOK_ASSERT_EQUAL(std::string("wss://"), scheme);
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT_EQUAL(std::string("9999"), port);
}

void NetUtilWhiteBoxTests::testParseUriUrl()
{
    constexpr auto testname = __func__;

    std::string scheme = "***";
    std::string host = "***";
    std::string port = "***";
    std::string pathAndQuery = "***";

    LOK_ASSERT(!net::parseUri(std::string(), scheme, host, port, pathAndQuery));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT(host.empty());
    LOK_ASSERT(port.empty());
    LOK_ASSERT(pathAndQuery.empty());

    LOK_ASSERT(net::parseUri("localhost", scheme, host, port, pathAndQuery));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("localhost"), host);
    LOK_ASSERT(port.empty());
    LOK_ASSERT(pathAndQuery.empty());

    LOK_ASSERT(net::parseUri("127.0.0.1", scheme, host, port, pathAndQuery));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT(port.empty());
    LOK_ASSERT(pathAndQuery.empty());

    LOK_ASSERT(net::parseUri("domain.com", scheme, host, port, pathAndQuery));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());
    LOK_ASSERT(pathAndQuery.empty());

    LOK_ASSERT(net::parseUri("127.0.0.1:9999", scheme, host, port, pathAndQuery));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT_EQUAL(std::string("9999"), port);
    LOK_ASSERT(pathAndQuery.empty());

    LOK_ASSERT(net::parseUri("domain.com:88", scheme, host, port, pathAndQuery));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);
    LOK_ASSERT(pathAndQuery.empty());

    LOK_ASSERT(net::parseUri("http://domain.com", scheme, host, port, pathAndQuery));
    LOK_ASSERT_EQUAL(std::string("http://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());
    LOK_ASSERT(pathAndQuery.empty());

    LOK_ASSERT(net::parseUri("https://domain.com:88", scheme, host, port, pathAndQuery));
    LOK_ASSERT_EQUAL(std::string("https://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);

    LOK_ASSERT(net::parseUri("http://domain.com/path/to/file", scheme, host, port, pathAndQuery));
    LOK_ASSERT_EQUAL(std::string("http://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());
    LOK_ASSERT_EQUAL(std::string("/path/to/file"), pathAndQuery);

    LOK_ASSERT(
        net::parseUri("https://domain.com:88/path/to/file", scheme, host, port, pathAndQuery));
    LOK_ASSERT_EQUAL(std::string("https://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);
    LOK_ASSERT_EQUAL(std::string("/path/to/file"), pathAndQuery);

    LOK_ASSERT(net::parseUri("wss://127.0.0.1:9999/", scheme, host, port, pathAndQuery));
    LOK_ASSERT_EQUAL(std::string("wss://"), scheme);
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT_EQUAL(std::string("9999"), port);
    LOK_ASSERT_EQUAL(std::string("/"), pathAndQuery);
}

void NetUtilWhiteBoxTests::testParseUrl()
{
    constexpr auto testname = __func__;

    LOK_ASSERT_EQUAL(std::string(), net::parseUrl(""));

    LOK_ASSERT_EQUAL(std::string(), net::parseUrl("https://sub.domain.com:80"));
    LOK_ASSERT_EQUAL(std::string("/"), net::parseUrl("https://sub.domain.com:80/"));

    LOK_ASSERT_EQUAL(std::string("/some/path"),
                     net::parseUrl("https://sub.domain.com:80/some/path"));
}

CPPUNIT_TEST_SUITE_REGISTRATION(NetUtilWhiteBoxTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
