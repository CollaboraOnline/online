/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <vector>
#include <ostream>

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

// When enabled, assertions that pass will be logged.
// configure with --enable-logging-test-assert
#if LOK_LOG_ASSERTIONS
#define LOK_TRACE(X)                                                                               \
    do                                                                                             \
    {                                                                                              \
        TST_LOG_NAME("unittest", X);                                                               \
    } while (false)
#else
#define LOK_TRACE(X)                                                                               \
    do                                                                                             \
    {                                                                                              \
    } while (false)
#endif

/// Assert the truth of a condition, with a custom message.
#define LOK_ASSERT_MESSAGE(message, condition)                                                     \
    do                                                                                             \
    {                                                                                              \
        auto&& cond##__LINE__ = !!(condition);                                                     \
        if (!cond##__LINE__)                                                                       \
        {                                                                                          \
            std::ostringstream oss##__LINE__;                                                      \
            oss##__LINE__ << message;                                                              \
            const auto msg##__LINE__ = oss##__LINE__.str();                                        \
            TST_LOG_NAME("unittest", "ERROR: Assertion failure: "                                  \
                                         << (msg##__LINE__.empty() ? "" : msg##__LINE__ + ". ")    \
                                         << "Condition: " << (#condition));                        \
            LOK_ASSERT_IMPL(cond##__LINE__);                                                       \
            CPPUNIT_ASSERT_MESSAGE((message), cond##__LINE__);                                     \
        }                                                                                          \
        else                                                                                       \
        {                                                                                          \
            LOK_TRACE("PASS: " << (#condition) << " [true]");                                      \
        }                                                                                          \
    } while (false)

/// Assert the truth of a condition.
#define LOK_ASSERT(condition) LOK_ASSERT_MESSAGE("", condition)

/// Assert the equality of two expressions. WARNING: Multiple evaluations!
/// Captures full expressions, but only meaningful when they have no side-effects when evaluated.
#define LOK_ASSERT_EQUAL_UNSAFE(expected, actual)                                                  \
    LOK_ASSERT_EQUAL_MESSAGE_UNSAFE("", expected, actual)

/// Assert the equality of two expressions with a custom message. WARNING: Multiple evaluations!
/// Captures full expressions, but only meaningful when they have no side-effects when evaluated.
#define LOK_ASSERT_EQUAL_MESSAGE_UNSAFE(message, expected, actual)                                 \
    do                                                                                             \
    {                                                                                              \
        if (!((expected) == (actual)))                                                             \
        {                                                                                          \
            std::ostringstream oss##__LINE__;                                                      \
            oss##__LINE__ << message;                                                              \
            const auto msg##__LINE__ = oss##__LINE__.str();                                        \
            TST_LOG_NAME("unittest", "ERROR: Assertion failure: "                                  \
                                         << (msg##__LINE__.empty() ? "" : msg##__LINE__ + ' ')     \
                                         << lokFormatAssertEq(expected, actual));                  \
            LOK_ASSERT_IMPL((expected) == (actual));                                               \
            CPPUNIT_ASSERT_EQUAL_MESSAGE(msg##__LINE__, (expected), (actual));                     \
        }                                                                                          \
    } while (false)

/// Assert the equality of two expressions, and a custom message, with guaranteed single evaluation.
#define LOK_ASSERT_EQUAL_MESSAGE(MSG, EXP, ACT)                                                    \
    do                                                                                             \
    {                                                                                              \
        auto&& exp##__LINE__ = EXP;                                                                \
        auto&& act##__LINE__ = ACT;                                                                \
        if (!(exp##__LINE__ == act##__LINE__))                                                     \
        {                                                                                          \
            LOK_ASSERT_EQUAL_MESSAGE_UNSAFE(MSG, exp##__LINE__, act##__LINE__);                    \
        }                                                                                          \
        else                                                                                       \
        {                                                                                          \
            LOK_TRACE("PASS: " << #EXP << " == " << #ACT << " == [" << act##__LINE__ << ']');      \
        }                                                                                          \
    } while (false)

/// Assert the equality of two expressions with guarantees of single evaluation.
#define LOK_ASSERT_EQUAL(EXP, ACT) LOK_ASSERT_EQUAL_MESSAGE((#EXP) << " != " << (#ACT), EXP, ACT)

/// Assert the equality of two expressions with guarantees of single evaluation.
#define LOK_ASSERT_EQUAL_STR(EXP, ACT)                                                             \
    LOK_ASSERT_EQUAL_MESSAGE((#EXP) << " != " << (#ACT), Util::toString(EXP), Util::toString(ACT))

#define LOK_ASSERT_FAIL(message)                                                                   \
    do                                                                                             \
    {                                                                                              \
        TST_LOG_NAME("unittest", "ERROR: Forced failure: " << (message));                          \
        LOK_ASSERT_IMPL(!"Forced failure: " #message);                                             \
        CPPUNIT_FAIL((message));                                                                   \
    } while (false)
