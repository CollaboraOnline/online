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

#include <cstdlib>
#include <cstring>
#include <limits>
#include <string>

/// Numeric utility unit-tests.
class NumUtilWhiteBoxTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(NumUtilWhiteBoxTests);
    CPPUNIT_TEST(testI32FromString);
    CPPUNIT_TEST(testSafeAtoi);
    CPPUNIT_TEST_SUITE_END();

    void testI32FromString();
    void testSafeAtoi();
};

void NumUtilWhiteBoxTests::testI32FromString()
{
    constexpr std::string_view testname = __func__;

    // Basic positive numbers.
    {
        const auto [value, success] = NumUtil::i32FromString("0");
        LOK_ASSERT(success);
        LOK_ASSERT_EQUAL(static_cast<std::int32_t>(0), value);
    }
    {
        const auto [value, success] = NumUtil::i32FromString("42");
        LOK_ASSERT(success);
        LOK_ASSERT_EQUAL(static_cast<std::int32_t>(42), value);
    }
    {
        const auto [value, success] = NumUtil::i32FromString("12345");
        LOK_ASSERT(success);
        LOK_ASSERT_EQUAL(static_cast<std::int32_t>(12345), value);
    }
    {
        const auto [value, success] = NumUtil::i32FromString("12345,");
        LOK_ASSERT(success);
        LOK_ASSERT_EQUAL(static_cast<std::int32_t>(12345), value);
    }

    // Negative numbers.
    {
        const auto [value, success] = NumUtil::i32FromString("-1");
        LOK_ASSERT(success);
        LOK_ASSERT_EQUAL(static_cast<std::int32_t>(-1), value);
    }
    {
        const auto [value, success] = NumUtil::i32FromString("-999");
        LOK_ASSERT(success);
        LOK_ASSERT_EQUAL(static_cast<std::int32_t>(-999), value);
    }
    {
        const auto [value, success] = NumUtil::i32FromString("-999,");
        LOK_ASSERT(success);
        LOK_ASSERT_EQUAL(static_cast<std::int32_t>(-999), value);
    }

    // INT32_MAX boundary.
    {
        const auto [value, success] = NumUtil::i32FromString("2147483647");
        LOK_ASSERT(success);
        LOK_ASSERT_EQUAL(std::numeric_limits<std::int32_t>::max(), value);
    }

    // INT32_MIN boundary.
    {
        const auto [value, success] = NumUtil::i32FromString("-2147483648");
        LOK_ASSERT(success);
        LOK_ASSERT_EQUAL(std::numeric_limits<std::int32_t>::min(), value);
    }

    // Overflow returns failure.
    {
        const auto [value, success] = NumUtil::i32FromString("99999999999999");
        LOK_ASSERT(!success);
    }
    {
        const auto [value, success] = NumUtil::i32FromString("-99999999999999");
        LOK_ASSERT(!success);
    }

    // Empty and invalid strings.
    {
        const auto [value, success] = NumUtil::i32FromString("");
        LOK_ASSERT(!success);
    }
    {
        const auto [value, success] = NumUtil::i32FromString("abc");
        LOK_ASSERT(!success);
    }

    // Trailing non-numeric characters (strtol stops, still succeeds).
    {
        const auto [value, success] = NumUtil::i32FromString("42xy");
        LOK_ASSERT(success);
        LOK_ASSERT_EQUAL(static_cast<std::int32_t>(42), value);
    }

    // Default-value overload.
    LOK_ASSERT_EQUAL(static_cast<std::int32_t>(42), NumUtil::i32FromString("42", -1));
    LOK_ASSERT_EQUAL(static_cast<std::int32_t>(-1), NumUtil::i32FromString("", -1));
    LOK_ASSERT_EQUAL(static_cast<std::int32_t>(-1), NumUtil::i32FromString("abc", -1));
    LOK_ASSERT_EQUAL(static_cast<std::int32_t>(99), NumUtil::i32FromString("99999999999999", 99));
}

void NumUtilWhiteBoxTests::testSafeAtoi()
{
    constexpr std::string_view testname = __func__;

    // Helper to compare safe_atoi with std::atoi for non-overflow cases.
    // std::atoi has UB on overflow, so we only compare within int range.
    auto compareWithAtoi = [&](const char* str)
    {
        const int stdResult = std::atoi(str);
        const int safeResult = NumUtil::safe_atoi(str, std::strlen(str));
        LOK_ASSERT_EQUAL_CTX(stdResult, safeResult, std::string(str));
    };

    // Basic positive numbers.
    compareWithAtoi("0");
    compareWithAtoi("1");
    compareWithAtoi("7");
    compareWithAtoi("42");
    compareWithAtoi("123");
    compareWithAtoi("999");
    compareWithAtoi("12345");

    // Negative numbers.
    compareWithAtoi("-1");
    compareWithAtoi("-7");
    compareWithAtoi("-42");
    compareWithAtoi("-123");
    compareWithAtoi("-999");
    compareWithAtoi("-12345");

    // Plus sign prefix.
    compareWithAtoi("+7");
    compareWithAtoi("+42");
    compareWithAtoi("+0");

    // Leading whitespace.
    compareWithAtoi("  42");
    compareWithAtoi("\t123");
    compareWithAtoi("   -456");
    compareWithAtoi(" \t +789");

    // Leading zeros.
    compareWithAtoi("0042");
    compareWithAtoi("00123");
    compareWithAtoi("-00456");

    // Trailing non-numeric characters.
    compareWithAtoi("42xy");
    compareWithAtoi("123abc");
    compareWithAtoi("-456def");

    // Zero variants.
    compareWithAtoi("-0");
    compareWithAtoi("+0");
    compareWithAtoi("0000");

    // Single digit numbers.
    compareWithAtoi("1");
    compareWithAtoi("9");
    compareWithAtoi("-1");
    compareWithAtoi("-9");

    // INT_MAX boundary.
    compareWithAtoi("2147483647");

    // Empty and invalid strings (atoi returns 0).
    compareWithAtoi("");
    compareWithAtoi("abc");
    compareWithAtoi("   ");

    // Overflow: safe_atoi clamps to INT_MAX / -INT_MAX.
    LOK_ASSERT_EQUAL(std::numeric_limits<int>::max(), NumUtil::safe_atoi("9999999990", 10));
    LOK_ASSERT_EQUAL(-std::numeric_limits<int>::max(), NumUtil::safe_atoi("-9999999990", 11));
    LOK_ASSERT_EQUAL(std::numeric_limits<int>::max(),
                     NumUtil::safe_atoi("2147483648", 10)); // INT_MAX + 1.

    // Length-limiting (not null-terminated behavior).
    {
        std::string s("42");
        LOK_ASSERT_EQUAL(4, NumUtil::safe_atoi(s.data(), 1));
    }
    {
        std::string s("12345");
        LOK_ASSERT_EQUAL(123, NumUtil::safe_atoi(s.data(), 3));
    }

    // Embedded null (safe_atoi uses length, stops at non-digit).
    {
        std::string s("123");
        s[1] = '\0';
        LOK_ASSERT_EQUAL(1, NumUtil::safe_atoi(s.data(), s.size()));
    }

    // Null pointer.
    LOK_ASSERT_EQUAL(0, NumUtil::safe_atoi(nullptr, 0));

    // Zero length.
    LOK_ASSERT_EQUAL(0, NumUtil::safe_atoi("42", 0));
}

CPPUNIT_TEST_SUITE_REGISTRATION(NumUtilWhiteBoxTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
