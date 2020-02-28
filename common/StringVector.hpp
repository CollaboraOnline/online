/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_STRINGVECTOR_HPP
#define INCLUDED_STRINGVECTOR_HPP

#include <string>
#include <vector>

/**
 * Safe wrapper around an std::vector<std::string>. Gives you an empty string if you would read past
 * the ends of the vector.
 */
class StringVector
{
    std::vector<std::string> _vector;

public:
    explicit StringVector();

    explicit StringVector(const std::vector<std::string>& vector);

    /// Unlike std::vector, gives an empty string if index is unexpected.
    std::string operator[](size_t index) const;

    size_t size() const;

    bool empty() const;

    std::vector<std::string>::const_iterator begin() const;

    std::vector<std::string>::iterator begin();

    std::vector<std::string>::const_iterator end() const;

    std::vector<std::string>::iterator end();

    std::vector<std::string>::iterator erase(std::vector<std::string>::const_iterator it);

    void push_back(const std::string& string);
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
