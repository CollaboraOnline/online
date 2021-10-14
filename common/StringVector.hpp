/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <string>
#include <utility>
#include <vector>

/**
 * Stores an offset and a length into the single underlying string of StringVector.
 */
struct StringToken
{
    std::size_t _index;
    std::size_t _length;

    StringToken() = default;

    StringToken(std::size_t index, std::size_t length)
        : _index(index),
        _length(length)
    {
    }
};

/**
 * Safe wrapper around an std::vector<std::string>. Gives you an empty string if you would read past
 * the ends of the vector.
 */
class StringVector
{
    /// All tokens are substrings of this string.
    std::string _string;
    std::vector<StringToken> _tokens;

public:
    explicit StringVector() = default;

    explicit StringVector(std::string string, std::vector<StringToken> tokens)
        : _string(std::move(string))
        , _tokens(std::move(tokens))
    {
    }

    /// Unlike std::vector, gives an empty string if index is unexpected.
    std::string operator[](std::size_t index) const
    {
        if (index >= _tokens.size())
        {
            return std::string();
        }

        const StringToken& token = _tokens[index];
        return _string.substr(token._index, token._length);
    }

    std::size_t size() const { return _tokens.size(); }

    bool empty() const { return _tokens.empty(); }

    std::vector<StringToken>::const_iterator begin() const { return _tokens.begin(); }

    std::vector<StringToken>::iterator begin() { return _tokens.begin(); }

    std::vector<StringToken>::const_iterator end() const { return _tokens.end(); }

    std::vector<StringToken>::iterator end() { return _tokens.end(); }

    std::vector<StringToken>::iterator erase(std::vector<StringToken>::const_iterator it)
    {
        return _tokens.erase(it);
    }

    void push_back(const std::string& string)
    {
        _tokens.emplace_back(_string.size(), string.size());
        _string += string;
    }

    /// Gets the underlying string of a single token.
    std::string getParam(const StringToken& token) const
    {
        return _string.substr(token._index, token._length);
    }

    /// Concats tokens starting from begin, using separator as separator.
    template <typename T> inline std::string cat(const T& separator, std::size_t offset) const
    {
        std::string ret;

        if (offset >= _tokens.size())
        {
            return ret;
        }

        ret.reserve(_string.size() * 2);
        auto it = _tokens.begin() + offset;
        ret = getParam(*it);
        for (++it; it != _tokens.end(); ++it)
        {
            // Avoid temporary strings, append separately.
            ret += separator;
            ret += getParam(*it);
        }

        return ret;
    }

    /// Compares the nth token with string.
    bool equals(std::size_t index, const char* string) const
    {
        if (index >= _tokens.size())
        {
            return false;
        }

        const StringToken& token = _tokens[index];
        return _string.compare(token._index, token._length, string) == 0;
    }

    /// Compares the nth token with string.
    template <std::size_t N>
    bool equals(std::size_t index, const char (&string)[N]) const
    {
        if (index >= _tokens.size())
        {
            return false;
        }

        const StringToken& token = _tokens[index];
        return _string.compare(token._index, token._length, string, N) == 0;
    }

    // Checks if the token text at index starts with the given string
    template <std::size_t N>
    bool startsWith(std::size_t index, const char (&string)[N]) const
    {
        if (index >= _tokens.size())
        {
            return false;
        }

        const StringToken& token = _tokens[index];
        const auto len = N - 1; // we don't want to compare the '\0'
        return token._length >= len && _string.compare(token._index, len, string) == 0;
    }

    // Checks if the token text starts with the given string
    template <std::size_t N>
    bool startsWith(const StringToken& token, const char (&string)[N]) const
    {
        if (token._index >= _tokens.size())
        {
            return false;
        }

        const auto len = N - 1; // we don't want to compare the '\0'
        return token._length >= len && _string.compare(token._index, len, string) == 0;
    }

    /// Compares the nth token with the mth token from another StringVector.
    bool equals(std::size_t index, const StringVector& other, std::size_t otherIndex);

    bool getUInt32(std::size_t index, const std::string& key, uint32_t& value) const;
    bool getNameIntegerPair(std::size_t index, std::string& name, int& value) const;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
