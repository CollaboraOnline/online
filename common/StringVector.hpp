/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <string>
#include <vector>

/**
 * Stores an offset and a length into the single underlying string of StringVector.
 */
struct StringToken
{
    size_t _index;
    size_t _length;

    StringToken() = default;

    StringToken(size_t index, size_t length)
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
    explicit StringVector();

    explicit StringVector(const std::string& string, const std::vector<StringToken>& tokens);

    /// Unlike std::vector, gives an empty string if index is unexpected.
    std::string operator[](size_t index) const;

    size_t size() const;

    bool empty() const;

    std::vector<StringToken>::const_iterator begin() const;

    std::vector<StringToken>::iterator begin();

    std::vector<StringToken>::const_iterator end() const;

    std::vector<StringToken>::iterator end();

    std::vector<StringToken>::iterator erase(std::vector<StringToken>::const_iterator it);

    void push_back(const std::string& string);

    /// Gets the underlying string of a single token.
    std::string getParam(const StringToken& token) const;

    /// Concats tokens starting from begin, using separator as separator.
    std::string cat(const std::string& separator, size_t begin) const;

    /// Compares the nth token with string.
    bool equals(size_t index, const char* string) const;

    /// Compares the nth token with the mth token from an other StringVector.
    bool equals(size_t index, const StringVector& other, size_t otherIndex);
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
