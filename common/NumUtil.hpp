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
#include <cerrno>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <string_view>
#include <type_traits>

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

/// Convert from a string into an integer, like strto* family,
/// supporting std::string_view arguments.
/// The number must be base-10 and can start with
/// either '+' or '-' as well as optional whitespace.
/// The result is coerced into the return type.
/// This is typically called while parsing.
/// @offset is the position at which to start parsing
/// and will hold the position at which parsing terminated.
/// As a bonus, this is 2-3x faster than glibc across all lengths.
template <typename T>
T parseStrTo(const std::string_view str, std::size_t& orig_offset)
    requires std::is_integral_v<T>
{
    const char* s = str.data();
    const std::size_t len = str.size();
    std::size_t offset = orig_offset;
    if (offset >= len)
    {
        return T{};
    }

    T c = s[offset] - '0';
    bool neg = false;
    if (static_cast<std::uint_fast64_t>(c) >= 10)
    {
        // Skip whitespace.
        while (offset < len && (s[offset] == ' ' || s[offset] == '\t'))
            offset++;

        if (offset >= len)
            return T{};

        c = s[offset++];
        neg = (c == '-');
        if (neg || c == '+')
        {
            if (offset >= len)
                return T{};

            c = s[offset++];
        }

        c -= '0';
        if (static_cast<std::uint_fast64_t>(c) >= 10)
            return T{};
    }
    else
    {
        ++offset;
        if (len == 1)
        {
            orig_offset = 1;
            return c;
        }
    }

    T res = c;

    // Up to 9 total digits (1 already parsed + 8 remaining). Can't overflow any 32+ bit type.
    // Use an unrolled switch to avoid per-digit overflow checks and loop overhead.
    const std::size_t remaining =
        std::min<std::size_t>(len - offset, std::numeric_limits<T>::digits10 - 1);
#define CASE(X)                                                                                    \
    case X:                                                                                        \
        c = s[offset] - '0';                                                                       \
        if (static_cast<std::uint_fast64_t>(c) >= 10)                                              \
            break;                                                                                 \
        res = 10 * res + c;                                                                        \
        ++offset;                                                                                  \
        [[fallthrough]]

    do
    {
        switch (remaining)
        {
            CASE(8);
            CASE(7);
            CASE(6);
            CASE(5);
            CASE(4);
            CASE(3);
            CASE(2);
            CASE(1);
            case 0:
                if (offset >= len)
                {
                    orig_offset = offset;
                    return static_cast<T>(neg ? -res : res);
                }
                break;
        }
    } while (false);
#undef CASE

    if (offset < len)
    {
        if constexpr (std::numeric_limits<T>::digits10 > 10)
        {
            // Unchecked loop for digits that can't overflow (up to digits10 total).
            const auto fast_lim =
                std::min<std::size_t>(len, offset + std::numeric_limits<T>::digits10 - 1);
            for (; offset < fast_lim;)
            {
                c = s[offset] - '0';
                if (static_cast<std::uint_fast64_t>(c) >= 10)
                    break;

                ++offset;
                res = 10 * res + c;
            }
        }

        // Overflow-checked loop for remaining digits beyond digits10.
        constexpr auto cutoff = std::numeric_limits<T>::max() / 10;
        const auto cutlim =
            (neg ? -(std::numeric_limits<T>::min() % 10) : std::numeric_limits<T>::max() % 10);

        do
        {
            c = s[offset] - '0';
            if (static_cast<std::uint_fast64_t>(c) >= 10)
                break;

            ++offset; // Skip the consumed character.
            if (res > cutoff || (res == cutoff && c > cutlim))
            {
                // Overflow.
                errno = ERANGE;
                while (offset < len && static_cast<std::uint_fast64_t>(s[offset]) >= 10)
                    offset++; // Eat all the digits.
                orig_offset = offset;
                return neg ? std::numeric_limits<T>::min() : std::numeric_limits<T>::max();
            }

            res = 10 * res + c;
        } while (offset < len);
    }

    orig_offset = offset;
    return static_cast<T>(neg ? -res : res);
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

/// Convert from a string into an integer like strto* family.
/// The number must be base-10 and can start with
/// either '+' or '-'.
/// The result is coerced into the return type.
/// This is typically called while parsing.
template <typename T> T strto(const std::string_view str)
{
    std::size_t offset = 0;
    return parseStrTo<T>(str, offset);
}

/// Convert from a string into a 32-bit int, like std::strtol.
/// The result is coerced into the return type.
inline std::int32_t strtoint32(const std::string_view str)
{
    std::size_t offset = 0;
    return parseStrTo<std::int32_t>(str, offset);
}

/// Convert from a string into a 32-bit int, like std::strtol.
/// The result is coerced into the return type.
/// Supports arbitrary starting offset and returns the first unparsed offset.
inline std::int32_t parseStrToInt32(const std::string_view str, std::size_t& offset)
{
    return parseStrTo<std::int32_t>(str, offset);
}

/// Convert from a string into an unsigned 32-bit int, like std::strtoul.
/// The result is coerced into the return type.
inline std::uint32_t strtouint32(const std::string_view str)
{
    std::size_t offset = 0;
    return parseStrTo<std::uint32_t>(str, offset);
}

/// Convert from a string into an unsigned 32-bit int, like std::strtoul.
/// The result is coerced into the return type.
/// Supports arbitrary starting offset and returns the first unparsed offset.
inline std::uint32_t parseStrToUint32(const std::string_view str, std::size_t& offset)
{
    return parseStrTo<std::uint32_t>(str, offset);
}

/// Convert from a string into a 64-bit int, like std::strtoll.
/// The result is coerced into the return type.
inline std::int64_t strtoint64(const std::string_view str)
{
    std::size_t offset = 0;
    return parseStrTo<std::int64_t>(str, offset);
}

/// Convert from a string into a 64-bit int, like std::strtoll.
/// The result is coerced into the return type.
/// Supports arbitrary starting offset and returns the first unparsed offset.
inline std::int64_t parseStrToInt64(const std::string_view str, std::size_t& offset)
{
    return parseStrTo<std::int64_t>(str, offset);
}

/// Convert from a string into an unsigned 64-bit int, like std::strtoull.
/// The result is coerced into the return type.
inline std::uint64_t strtouint64(const std::string_view str)
{
    std::size_t offset = 0;
    return parseStrTo<std::uint64_t>(str, offset);
}

/// Convert from a string into an unsigned 64-bit int, like std::strtoull.
/// The result is coerced into the return type.
/// Supports arbitrary starting offset and returns the first unparsed offset.
inline std::uint64_t praseStrToUint64(const std::string_view str, std::size_t& offset)
{
    return parseStrTo<std::uint64_t>(str, offset);
}

} // namespace NumUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
