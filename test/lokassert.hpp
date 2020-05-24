/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <assert.h>

#include <cppunit/extensions/HelperMacros.h>

inline std::ostream& operator<<(std::ostream& os, const std::vector<char>& v)
{
    const size_t size = v.size();
    if (size <= 32)
        os << std::string(v.data(), size);
    else
        os << std::string(v.data(), 32) << "...";

    return os;
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
            std::cerr << "Assertion failure: " << (#condition) << std::endl;                       \
            LOK_ASSERT_IMPL(condition);                                                            \
            CPPUNIT_ASSERT(condition);                                                             \
        }                                                                                          \
    } while (false)

#define LOK_ASSERT_EQUAL(expected, actual)                                                         \
    do                                                                                             \
    {                                                                                              \
        if (!((expected) == (actual)))                                                             \
        {                                                                                          \
            std::cerr << "Assertion failure: Expected [" << (expected) << "] but got ["            \
                      << (actual) << ']' << std::endl;                                             \
            LOK_ASSERT_IMPL((expected) == (actual));                                               \
            CPPUNIT_ASSERT_EQUAL((expected), (actual));                                            \
        }                                                                                          \
    } while (false)

#define LOK_ASSERT_EQUAL_MESSAGE(message, expected, actual)                                        \
    do                                                                                             \
    {                                                                                              \
        if (!((expected) == (actual)))                                                             \
        {                                                                                          \
            std::cerr << "Assertion failure: " << (message) << ". Expected [" << (expected)        \
                      << "] but got [" << (actual) << "]: " << std::endl;                          \
            LOK_ASSERT_IMPL((expected) == (actual));                                               \
            CPPUNIT_ASSERT_EQUAL_MESSAGE((message), (expected), (actual));                         \
        }                                                                                          \
    } while (false)

#define LOK_ASSERT_MESSAGE(message, condition)                                                     \
    do                                                                                             \
    {                                                                                              \
        if (!(condition))                                                                          \
        {                                                                                          \
            std::cerr << "Assertion failure: " << (message) << ". Condition: " << (#condition)     \
                      << std::endl;                                                                \
            LOK_ASSERT_IMPL(condition);                                                            \
            CPPUNIT_ASSERT_MESSAGE((message), (condition));                                        \
        }                                                                                          \
    } while (false)

#define LOK_ASSERT_FAIL(message)                                                                   \
    do                                                                                             \
    {                                                                                              \
        std::cerr << "Forced failure: " << (message) << std::endl;                                 \
        LOK_ASSERT_IMPL(!"Forced failure");                                                               \
        CPPUNIT_FAIL((message));                                                                   \
    } while (false)
