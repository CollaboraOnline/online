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

#include <common/NumUtil.hpp>
#include <common/Util.hpp>

#include <test/lokassert.hpp>

#include <cppunit/TestAssert.h>
#include <cppunit/extensions/HelperMacros.h>

#include <cstdint>
#include <exception>
#include <limits>
#include <stdexcept>
#include <string>

/// Numeric utility unit-tests.
class NumUtilWhiteBoxTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(NumUtilWhiteBoxTests);
    CPPUNIT_TEST(testStoi);
    CPPUNIT_TEST_SUITE_END();

    void testStoi();

    void stoiCompare(std::int64_t num);
    void stoiTest(const std::string& str, std::int64_t num);
};

void NumUtilWhiteBoxTests::stoiTest(const std::string& str, std::int64_t num)
{
    constexpr std::string_view testname = __func__;

    bool unexpectedThrow = false;
    try
    {
        const auto value = std::stoi(str);
        unexpectedThrow = true; // std::stoi() didn't throw, so we shouldn't either.

        LOK_ASSERT_EQUAL(num, static_cast<std::int64_t>(value));
        LOK_ASSERT_EQUAL(num, static_cast<std::int64_t>(NumUtil::stoi(str)));
    }
    catch (const std::invalid_argument&)
    {
        if (unexpectedThrow)
        {
            LOK_ASSERT_FAIL("Unexpected to get invalid_argument exception");
        }

        try
        {
            LOK_ASSERT_EQUAL(num, static_cast<std::int64_t>(NumUtil::stoi(str)));
            LOK_ASSERT_FAIL("Expected invalid_argument exception to be thrown");
        }
        catch (const std::invalid_argument&)
        {
            LOK_ASSERT("Got invalid_argument exception as expected");
        }
    }
    catch (const std::out_of_range&)
    {
        if (unexpectedThrow)
        {
            LOK_ASSERT_FAIL("Unexpected to get out_of_range exception");
        }

        try
        {
            LOK_ASSERT_EQUAL(num, static_cast<std::int64_t>(NumUtil::stoi(str)));
            LOK_ASSERT_FAIL("Expected out_of_range exception to be thrown");
        }
        catch (const std::out_of_range&)
        {
            LOK_ASSERT("Got out_of_range exception as expected");
        }
    }
    catch (const std::exception&)
    {
        if (unexpectedThrow)
        {
            LOK_ASSERT_FAIL("Unexpected to get exception");
        }

        try
        {
            LOK_ASSERT_EQUAL(num, static_cast<std::int64_t>(NumUtil::stoi(str)));
            LOK_ASSERT_FAIL("Expected exception to be thrown");
        }
        catch (const std::exception&)
        {
            LOK_ASSERT("Got exception as expected");
        }
    }
}

void NumUtilWhiteBoxTests::stoiCompare(std::int64_t num)
{
    constexpr std::string_view testname = __func__;

    LOK_ASSERT_EQUAL(num, num);
    const auto str = std::to_string(num);
    LOK_ASSERT(!str.empty());

    stoiTest(str, num);
}

void NumUtilWhiteBoxTests::testStoi()
{
    constexpr std::string_view testname = __func__;

    try
    {
        stoiCompare(0);
        stoiCompare(1);
        stoiCompare(-1);
        stoiCompare(1L << 34);
        stoiCompare(-(1L << 34));
        for (int i = 0; i < 10000; ++i)
        {
            stoiCompare(Util::rng::getNext());
        }

        // Test empty string - should throw invalid_argument
        stoiTest("", 0);

        // Test whitespace only - should throw invalid_argument
        stoiTest("   ", 0);

        // Test non-numeric string - should throw invalid_argument
        stoiTest("abc", 0);

        // Test string starting with letters - should throw invalid_argument
        stoiTest("abc123", 0);

        // Test leading whitespace with valid number - should parse successfully
        LOK_ASSERT_EQUAL(123, NumUtil::stoi("  123"));
        LOK_ASSERT_EQUAL(456, NumUtil::stoi("\t456"));
        LOK_ASSERT_EQUAL(789, NumUtil::stoi("   \t  789"));

        // Test trailing non-numeric characters - should parse the numeric part
        LOK_ASSERT_EQUAL(123, NumUtil::stoi("123abc"));
        LOK_ASSERT_EQUAL(456, NumUtil::stoi("456xyz"));
        LOK_ASSERT_EQUAL(789, NumUtil::stoi("789   "));

        // Test plus sign prefix - should work
        LOK_ASSERT_EQUAL(123, NumUtil::stoi("+123"));
        LOK_ASSERT_EQUAL(0, NumUtil::stoi("+0"));

        // Test minus sign prefix - should work
        LOK_ASSERT_EQUAL(-123, NumUtil::stoi("-123"));
        LOK_ASSERT_EQUAL(0, NumUtil::stoi("-0"));

        // Test just a minus sign - should throw invalid_argument
        stoiTest("-", 0);

        // Test just a plus sign - should throw invalid_argument
        stoiTest("+", 0);

        // Test double signs - should throw invalid_argument
        stoiTest("--123", 0);

        // Test double signs + should throw invalid_argument
        stoiTest("++123", 0);

        // Test leading zeros - should work
        LOK_ASSERT_EQUAL(123, NumUtil::stoi("00123"));
        LOK_ASSERT_EQUAL(0, NumUtil::stoi("0000"));
        LOK_ASSERT_EQUAL(-123, NumUtil::stoi("-00123"));

        // Test INT32_MAX boundary
        LOK_ASSERT_EQUAL(std::numeric_limits<std::int32_t>::max(), NumUtil::stoi("2147483647"));

        // Test INT32_MIN boundary
        LOK_ASSERT_EQUAL(std::numeric_limits<std::int32_t>::min(), NumUtil::stoi("-2147483648"));

        // Test INT32_MAX + 1 - should throw out_of_range
        stoiTest("2147483648", 0);

        // Test INT32_MIN - 1 - should throw out_of_range
        stoiTest("-2147483649", 0);

        // Test very large positive number - should throw out_of_range
        stoiTest("9999999999999999999", 0);

        // Test very large negative number - should throw out_of_range
        stoiTest("-9999999999999999999", 0);

        // Test single zero
        LOK_ASSERT_EQUAL(0, NumUtil::stoi("0"));

        // Test negative zero
        LOK_ASSERT_EQUAL(0, NumUtil::stoi("-0"));

        // Test positive zero
        LOK_ASSERT_EQUAL(0, NumUtil::stoi("+0"));

        // Test single digit numbers
        LOK_ASSERT_EQUAL(1, NumUtil::stoi("1"));
        LOK_ASSERT_EQUAL(9, NumUtil::stoi("9"));
        LOK_ASSERT_EQUAL(-1, NumUtil::stoi("-1"));
        LOK_ASSERT_EQUAL(-9, NumUtil::stoi("-9"));

        // Test common values
        LOK_ASSERT_EQUAL(100, NumUtil::stoi("100"));
        LOK_ASSERT_EQUAL(1000, NumUtil::stoi("1000"));
        LOK_ASSERT_EQUAL(1000000, NumUtil::stoi("1000000"));
        LOK_ASSERT_EQUAL(-100, NumUtil::stoi("-100"));
        LOK_ASSERT_EQUAL(-1000, NumUtil::stoi("-1000"));
        LOK_ASSERT_EQUAL(-1000000, NumUtil::stoi("-1000000"));
    }
    catch (const std::exception& exc)
    {
        LOK_ASSERT_FAIL("Unexpected: " << exc.what());
    }
}

CPPUNIT_TEST_SUITE_REGISTRATION(NumUtilWhiteBoxTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
