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

#include <test/lokassert.hpp>

#include <Util.hpp>

#include <cppunit/extensions/HelperMacros.h>

/// Util unit-tests.
class UtilTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(UtilTests);

    CPPUNIT_TEST(testStringifyHexLine);
    CPPUNIT_TEST(testHexify);
    CPPUNIT_TEST(testBytesToHex);

    CPPUNIT_TEST_SUITE_END();

    void testStringifyHexLine();
    void testHexify();
    void testBytesToHex();
};

void UtilTests::testStringifyHexLine()
{
    constexpr auto testname = __func__;

    std::string test("hello here\ntest");
    std::string result1("68 65 6C 6C 6F 20 68 65  72 65 0A 74 65 73 74"
                        "                                                       "
                        "| hello here.test                 ");
    std::string result2("68 65 72 65 0A 74  | here.t");
    LOK_ASSERT_EQUAL(result1, Util::stringifyHexLine(test, 0));
    LOK_ASSERT_EQUAL(result2, Util::stringifyHexLine(test, 6, 6));
}

void UtilTests::testHexify()
{
    constexpr auto testname = __func__;

    const std::string s1 = "some ascii text with !@#$%^&*()_+/-\\|";
    const auto hex = Util::dataToHexString(s1, 0, s1.size());
    std::string decoded;
    LOK_ASSERT(Util::dataFromHexString(hex, decoded));
    LOK_ASSERT_EQUAL(s1, decoded);

    for (std::size_t randStrLen = 1; randStrLen < 129; ++randStrLen)
    {
        const auto s2 = Util::rng::getBytes(randStrLen);
        LOK_ASSERT_EQUAL(randStrLen, s2.size());
        const auto hex2 = Util::dataToHexString(s2, 0, s2.size());
        LOK_ASSERT_EQUAL(randStrLen * 2, hex2.size());
        std::vector<char> decoded2;
        LOK_ASSERT(Util::dataFromHexString(hex2, decoded2));
        LOK_ASSERT_EQUAL(randStrLen, decoded2.size());
        LOK_ASSERT_EQUAL(Util::toString(s2), Util::toString(decoded2));
    }
}

void UtilTests::testBytesToHex()
{
    constexpr auto testname = __func__;

    {
        const std::string d("Some text");
        const std::string hex = Util::bytesToHexString(d);
        const std::string s = Util::hexStringToBytes(hex);
        LOK_ASSERT_EQUAL(d, s);
    }
}

CPPUNIT_TEST_SUITE_REGISTRATION(UtilTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
