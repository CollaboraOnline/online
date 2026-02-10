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

#include <cstdint>
#include <limits>
#include <stdexcept>
#include <string_view>

/// Utilities for numeric conversions.
/// See test/NumUtilWhiteBoxTests.cpp for test cases.
namespace NumUtil
{

/// Convert a string to 32-bit signed int.
/// Drop-in replacement to std::stoi() that accepts string_view.
inline std::int32_t stoi(const std::string_view input)
{
    const char* str = input.data();
    char* endptr = nullptr;
    errno = 0;
    const auto value = std::strtol(str, &endptr, 10);

    if (endptr == str)
    {
        throw std::invalid_argument("stoi");
    }
    else if (errno == ERANGE || value < std::numeric_limits<std::int32_t>::min() ||
             value > std::numeric_limits<std::int32_t>::max())
    {
        throw std::out_of_range("stoi");
    }

    return value;
}

} // namespace NumUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
