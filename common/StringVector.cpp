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

StringVector::StringVector(const std::vector<std::string>& vector) { _vector = vector; }

std::string StringVector::operator[](size_t index) const
{
    if (index >= _vector.size())
    {
        return std::string();
    }

    return _vector[index];
}

size_t StringVector::size() const { return _vector.size(); }

bool StringVector::empty() const { return _vector.empty(); }

std::vector<std::string>::const_iterator StringVector::begin() const { return _vector.begin(); }

std::vector<std::string>::iterator StringVector::begin() { return _vector.begin(); }

std::vector<std::string>::const_iterator StringVector::end() const { return _vector.end(); }

std::vector<std::string>::iterator StringVector::end() { return _vector.end(); }

std::vector<std::string>::iterator StringVector::erase(std::vector<std::string>::const_iterator it)
{
    return _vector.erase(it);
}

void StringVector::push_back(const std::string& string) { _vector.push_back(string); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
