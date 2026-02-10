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

} // namespace NumUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
