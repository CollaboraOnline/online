/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "StringVector.hpp"

StringVector::StringVector() = default;

StringVector::StringVector(const std::string& string, const std::vector<StringToken>& tokens)
    : _string(string),
    _tokens(tokens)
{
}

std::string StringVector::operator[](size_t index) const
{
    if (index >= _tokens.size())
    {
        return std::string();
    }

    const StringToken& token = _tokens[index];
    return _string.substr(token._index, token._length);
}

size_t StringVector::size() const { return _tokens.size(); }

bool StringVector::empty() const { return _tokens.empty(); }

std::vector<StringToken>::const_iterator StringVector::begin() const { return _tokens.begin(); }

std::vector<StringToken>::iterator StringVector::begin() { return _tokens.begin(); }

std::vector<StringToken>::const_iterator StringVector::end() const { return _tokens.end(); }

std::vector<StringToken>::iterator StringVector::end() { return _tokens.end(); }

std::vector<StringToken>::iterator StringVector::erase(std::vector<StringToken>::const_iterator it)
{
    return _tokens.erase(it);
}

void StringVector::push_back(const std::string& string)
{
    StringToken token;
    token._index = _string.length();
    token._length = string.length();
    _tokens.push_back(token);
    _string += string;
}

std::string StringVector::getParam(const StringToken& token) const
{
    return _string.substr(token._index, token._length);
}

std::string StringVector::cat(const std::string& separator, size_t offset) const
{
    std::string ret;
    bool first = true;

    if (offset >= _tokens.size())
    {
        return ret;
    }

    for (auto it = _tokens.begin() + offset; it != _tokens.end(); ++it)
    {
        if (first)
        {
            first = false;
        }
        else
        {
            ret += separator;
        }

        ret += getParam(*it);
    }

    return ret;
}

bool StringVector::equals(size_t index, const char* string) const
{
    if (index >= _tokens.size())
    {
        return false;
    }

    const StringToken& token = _tokens[index];
    return _string.compare(token._index, token._length, string) == 0;
}

bool StringVector::equals(size_t index, const StringVector& other, size_t otherIndex)
{
    if (index >= _tokens.size())
    {
        return false;
    }

    if (otherIndex >= other._tokens.size())
    {
        return false;
    }

    const StringToken& token = _tokens[index];
    const StringToken& otherToken = other._tokens[otherIndex];
    int ret = _string.compare(token._index, token._length, other._string, otherToken._index,
                              otherToken._length);
    return ret == 0;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
