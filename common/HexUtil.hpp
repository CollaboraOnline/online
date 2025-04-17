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

#include <array>
#include <cassert>
#include <cstdint>
#include <sstream>
#include <string>
#include <string_view>
#include <vector>

namespace HexUtil
{

/// Convert unsigned char data to hex.
/// @buffer can be either std::vector<char> or std::string.
/// @offset the offset within the buffer to start from.
/// @length is the number of bytes to convert.
template <typename T>
inline std::string dataToHexString(const T& buffer, const std::size_t offset,
                                   const std::size_t length)
{
    char scratch[64];
    std::stringstream os;

    for (unsigned int i = 0; i < length; i++)
    {
        if ((offset + i) >= buffer.size())
            break;

        snprintf(scratch, sizeof(scratch), "%.2x", static_cast<unsigned char>(buffer[offset + i]));
        os << scratch;
    }

    return os.str();
}

/// Hex to unsigned char
template <typename T> bool dataFromHexString(const std::string_view hexString, T& data)
{
    if (hexString.length() % 2 != 0)
    {
        return false;
    }

    data.clear();
    std::stringstream stream;
    unsigned value;
    for (unsigned long offset = 0; offset < hexString.size(); offset += 2)
    {
        stream.clear();
        stream << std::hex << hexString.substr(offset, 2);
        stream >> value;
        data.push_back(static_cast<typename T::value_type>(value));
    }

    return true;
}

inline constexpr std::array<char, 2> hexFromByte(unsigned char byte)
{
    constexpr auto hex = "0123456789ABCDEF";
    return { hex[byte >> 4], hex[byte & 0xf] };
}

inline std::string bytesToHexString(const uint8_t* data, size_t size)
{
    std::string s;
    s.resize(size * 2); // Each byte is two hex digits.
    for (size_t i = 0; i < size; ++i)
    {
        const std::array<char, 2> hex = hexFromByte(data[i]);
        const size_t off = i * 2;
        s[off] = hex[0];
        s[off + 1] = hex[1];
    }

    return s;
}

inline std::string bytesToHexString(const char* data, size_t size)
{
    return bytesToHexString(reinterpret_cast<const uint8_t*>(data), size);
}

inline std::string bytesToHexString(const std::string_view str)
{
    return bytesToHexString(str.data(), str.size());
}

inline int hexDigitFromChar(char c)
{
    if (c >= '0' && c <= '9')
        return c - '0';
    else if (c >= 'a' && c <= 'f')
        return c - 'a' + 10;
    else if (c >= 'A' && c <= 'F')
        return c - 'A' + 10;
    else
        return -1;
}

inline std::string hexStringToBytes(const uint8_t* data, size_t size)
{
    assert(data && (size % 2 == 0) && "Invalid hex digits to convert.");

    std::string s;
    s.resize(size / 2); // Each pair of hex digits is a single byte.
    for (size_t i = 0; i < size; i += 2)
    {
        const int high = hexDigitFromChar(data[i]);
        assert(high >= 0 && high <= 16);
        const int low = hexDigitFromChar(data[i + 1]);
        assert(low >= 0 && low <= 16);
        const size_t off = i / 2;
        s[off] = ((high << 4) | low) & 0xff;
    }

    return s;
}

inline std::string hexStringToBytes(const char* data, size_t size)
{
    return hexStringToBytes(reinterpret_cast<const uint8_t*>(data), size);
}

inline std::string hexStringToBytes(const std::string_view str)
{
    return hexStringToBytes(str.data(), str.size());
}

/// Dump a line of data as hex.
/// @buffer can be either std::vector<char> or std::string.
/// @offset, the offset within the buffer to start from.
/// @width is the number of bytes to dump.
template <typename T>
inline std::string stringifyHexLine(const T& buffer, std::size_t offset,
                                    const std::size_t width = 32)
{
    std::string str;
    str.reserve(width * 4 + width / 8 + 3 + 1);

    for (unsigned int i = 0; i < width; i++)
    {
        if (i && (i % 8) == 0)
            str.push_back(' ');
        if ((offset + i) < buffer.size())
        {
            const std::array<char, 2> hex = hexFromByte(buffer[offset + i]);
            str.push_back(hex[0]);
            str.push_back(hex[1]);
            str.push_back(' ');
        }
        else
            str.append(3, ' ');
    }
    str.append(" | ");

    for (unsigned int i = 0; i < width; i++)
    {
        if ((offset + i) < buffer.size())
            str.push_back(::isprint(buffer[offset + i]) ? buffer[offset + i] : '.');
        else
            str.push_back(' '); // Leave blank if we are out of data.
    }

    return str;
}

/// Dump data as hex and chars to stream.
/// @buffer can be either std::vector<char> or std::string.
/// @legend is streamed into @os before the hex data once.
/// @prefix is streamed into @os for each line.
/// @skipDup, when true,  will avoid writing identical lines.
/// @width is the number of bytes to dump per line.
template <typename T>
inline void dumpHex(std::ostream& os, const T& buffer, const char* legend = "",
                    const char* prefix = "", bool skipDup = true, const unsigned int width = 32)
{
    unsigned int j;
    char scratch[64];
    int skip = 0;
    std::string lastLine;

    os << legend;
    for (j = 0; j < buffer.size() + width - 1; j += width)
    {
        snprintf(scratch, sizeof(scratch), "%s0x%.4x  ", prefix, j);
        os << scratch;

        std::string line = stringifyHexLine(buffer, j, width);
        if (skipDup && lastLine == line)
            skip++;
        else
        {
            if (skip > 0)
            {
                os << "... dup " << skip - 1 << "...";
                skip = 0;
            }
            else
                os << line;
        }
        lastLine.swap(line);

        os << '\n';
    }
    os.flush();
}

/// Dump data as hex and chars into a string.
/// Primarily used for logging.
template <typename T>
inline std::string dumpHex(const T& buffer, const char* legend = "", const char* prefix = "",
                           bool skipDup = true, const unsigned int width = 32)
{
    std::ostringstream oss;
    dumpHex(oss, buffer, legend, prefix, skipDup, width);
    return oss.str();
}

inline std::string dumpHex(const char* legend, const char* prefix,
                           const std::vector<char>::iterator& startIt,
                           const std::vector<char>::iterator& endIt, bool skipDup = true,
                           const unsigned int width = 32)
{
    std::ostringstream oss;
    std::vector<char> data(startIt, endIt);
    dumpHex(oss, data, legend, prefix, skipDup, width);
    return oss.str();
}

} // namespace HexUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
