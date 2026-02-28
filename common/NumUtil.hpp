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

#pragma once

#include <cctype>
#include <cstdint>
#include <cstdlib>
#include <limits>

/// Utilities for numeric conversions.
/// See test/NumUtilWhiteBoxTests.cpp for test cases.
namespace NumUtil
{

/**
* Similar to std::atoi() but does not require p to be null-terminated.
*
* Returns std::numeric_limits<int>::min/max() if the result would overflow.
*/
inline int safe_atoi(const char* p, int len)
{
    long ret{};
    if (!p || !len)
    {
        return ret;
    }

    int multiplier = 1;
    int offset = 0;
    while (isspace(p[offset]))
    {
        ++offset;
        if (offset >= len)
        {
            return ret;
        }
    }

    switch (p[offset])
    {
        case '-':
            multiplier = -1;
            ++offset;
            break;
        case '+':
            ++offset;
            break;
    }
    if (offset >= len)
    {
        return ret;
    }

    while (isdigit(p[offset]))
    {
        std::int64_t next = ret * 10 + (p[offset] - '0');
        if (next >= std::numeric_limits<int>::max())
            return multiplier * std::numeric_limits<int>::max();
        ret = next;
        ++offset;
        if (offset >= len)
        {
            return multiplier * ret;
        }
    }

    return multiplier * ret;
}

/// Convert a string to 32-bit signed int.
/// Returns the parsed value and a boolean indicating success or failure.
/// const auto [number, success] = NumUtil::i32FromString(portString);
inline std::pair<std::int32_t, bool> i32FromString(const std::string_view input)
{
    const char* str = input.data();
    char* endptr = nullptr;
    errno = 0;
    const auto value = std::strtol(str, &endptr, 10);
    return std::make_pair(value, endptr > str && errno != ERANGE);
}

/// Convert a string to 64-bit unsigned int. On failure, returns the default value.
/// Used where there is no interest in knowing whether the input was valid or not.
inline std::int32_t i32FromString(const std::string_view input, const std::int32_t def)
{
    const auto pair = i32FromString(input);
    return pair.second ? pair.first : def;
}

/// Convert a string to 64-bit unsigned int.
/// Returns the parsed value and a boolean indicating success or failure.
inline std::pair<std::uint64_t, bool> u64FromString(const std::string_view input)
{
    const char* str = input.data();
    char* endptr = nullptr;
    errno = 0;
    const auto value = std::strtoul(str, &endptr, 10);
    return std::make_pair(value, endptr > str && errno != ERANGE);
}

/// Convert a string to 64-bit unsigned int. On failure, returns the default value.
/// Used where there is no interest in knowing whether the input was valid or not.
inline std::uint64_t u64FromString(const std::string_view input, const std::uint64_t def)
{
    const auto pair = u64FromString(input);
    return pair.second ? pair.first : def;
}

} // namespace NumUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
