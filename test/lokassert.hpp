/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <vector>
#include <ostream>
inline std::ostream& operator<<(std::ostream& os, const std::vector<char>& v);

#include "testlog.hpp"
#include <assert.h>
#include <cppunit/extensions/HelperMacros.h>

inline std::ostream& operator<<(std::ostream& os, const std::vector<char>& v)
{
    const std::size_t size = v.size();
    if (size <= 32)
        os << std::string(v.data(), size);
    else
        os << std::string(v.data(), 32) << "...";

    return os;
}

template <typename T, typename U>
inline std::string lokFormatAssertEq(const T& expected, const U& actual)
{
    std::ostringstream oss;
    oss << "Expected [" << (expected) << "] but got [" << (actual) << ']';
    return oss.str();
}

template <>
std::string inline lokFormatAssertEq(const std::string& expected, const std::string& actual)
{
    std::ostringstream oss;
    oss << '\n';
    oss << "Expected: [" << expected << "]\n";
    oss << "Actual:   [" << actual << "]\n";
    oss << "          [";

    const auto minSize = std::min(expected.size(), actual.size());
    for (std::size_t i = 0; i < minSize; ++i)
    {
        oss << (expected[i] == actual[i] ? ' ' : '^');
    }

    const auto maxSize = std::max(expected.size(), actual.size());
    for (std::size_t i = minSize; i < maxSize; ++i)
    {
        oss << '^';
    }

    oss << "]\n";

    return oss.str();
}

#ifdef LOK_ABORT_ON_ASSERTION
#define LOK_ASSERT_IMPL(X) assert(X);
#else
#define LOK_ASSERT_IMPL(X)
#endif //LOK_ABORT_ON_ASSERTION

#define LOK_ASSERT(condition)                                                                      \
    do                                                                                             \
    {                                                                                              \
        if (!(condition))                                                                          \
        {                                                                                          \
            TST_LOG_NAME("unittest", "ERROR: Assertion failure: " << (#condition));                \
            LOK_ASSERT_IMPL(condition);                                                            \
            CPPUNIT_ASSERT(condition);                                                             \
        }                                                                                          \
    } while (false)

#define LOK_ASSERT_EQUAL(expected, actual)                                                         \
    do                                                                                             \
    {                                                                                              \
        if (!((expected) == (actual)))                                                             \
        {                                                                                          \
            TST_LOG_NAME("unittest",                                                               \
                         "ERROR: Assertion failure: " << lokFormatAssertEq(expected, actual));     \
            LOK_ASSERT_IMPL((expected) == (actual));                                               \
            CPPUNIT_ASSERT_EQUAL((expected), (actual));                                            \
        }                                                                                          \
    } while (false)

#define LOK_ASSERT_EQUAL_MESSAGE(message, expected, actual)                                        \
    do                                                                                             \
    {                                                                                              \
        if (!((expected) == (actual)))                                                             \
        {                                                                                          \
            std::ostringstream oss##__LINE__;                                                      \
            oss##__LINE__ << message;                                                              \
            const auto msg##__LINE__ = oss##__LINE__.str();                                        \
            TST_LOG_NAME("unittest", "ERROR: Assertion failure: "                                  \
                                         << msg##__LINE__ << ". Expected [" << (expected)          \
                                         << "] but got [" << (actual) << "]: ");                   \
            LOK_ASSERT_IMPL((expected) == (actual));                                               \
            CPPUNIT_ASSERT_EQUAL_MESSAGE(msg##__LINE__, (expected), (actual));                     \
        }                                                                                          \
    } while (false)

#define LOK_ASSERT_MESSAGE(message, condition)                                                     \
    do                                                                                             \
    {                                                                                              \
        if (!(condition))                                                                          \
        {                                                                                          \
            TST_LOG_NAME("unittest", "ERROR: Assertion failure: " << (message) << ". Condition: "  \
                                                                  << (#condition));                \
            LOK_ASSERT_IMPL(condition);                                                            \
            CPPUNIT_ASSERT_MESSAGE((message), (condition));                                        \
        }                                                                                          \
    } while (false)

#define LOK_ASSERT_FAIL(message)                                                                   \
    do                                                                                             \
    {                                                                                              \
        TST_LOG_NAME("unittest", "ERROR: Forced failure: " << (message));                          \
        LOK_ASSERT_IMPL(!"Forced failure");                                                        \
        CPPUNIT_FAIL((message));                                                                   \
    } while (false)
