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

#include <config.h>
#include <config_version.h>

#include "RegexUtil.hpp"

#include <regex>
#include <Poco/RegularExpression.h>

namespace RegexUtil
{
bool matchRegex(const std::set<std::string>& set, const std::string& subject)
{
    if (set.find(subject) != set.end())
    {
        return true;
    }

    // Not a perfect match, try regex.
    for (const std::string& value : set)
    {
        try
        {
            // Not performance critical to warrant caching.
            Poco::RegularExpression re(value, Poco::RegularExpression::RE_CASELESS);
            Poco::RegularExpression::Match reMatch;

            // Must be a full match.
            if (re.match(subject, reMatch) && reMatch.offset == 0 &&
                reMatch.length == subject.size())
            {
                return true;
            }
        }
        catch (const std::exception& exc)
        {
            // Nothing to do; skip.
        }
    }

    return false;
}

std::string getValue(const std::map<std::string, std::string>& map, const std::string& subject)
{
    if (const auto& it = map.find(subject); it != map.end())
    {
        return it->second;
    }

    // Not a perfect match, try regex.
    for (const auto& value : map)
    {
        try
        {
            // Not performance critical to warrant caching.
            Poco::RegularExpression re(value.first, Poco::RegularExpression::RE_CASELESS);
            Poco::RegularExpression::Match reMatch;

            // Must be a full match.
            if (re.match(subject, reMatch) && reMatch.offset == 0 &&
                reMatch.length == subject.size())
            {
                return value.second;
            }
        }
        catch (const std::exception& exc)
        {
            // Nothing to do; skip.
        }
    }

    return std::string();
}

std::string getValue(const std::set<std::string>& set, const std::string& subject)
{
    auto search = set.find(subject);
    if (search != set.end())
    {
        return *search;
    }

    // Not a perfect match, try regex.
    for (const auto& value : set)
    {
        try
        {
            // Not performance critical to warrant caching.
            Poco::RegularExpression re(value, Poco::RegularExpression::RE_CASELESS);
            Poco::RegularExpression::Match reMatch;

            // Must be a full match.
            if (re.match(subject, reMatch) && reMatch.offset == 0 &&
                reMatch.length == subject.size())
            {
                return value;
            }
        }
        catch (const std::exception& exc)
        {
            // Nothing to do; skip.
        }
    }

    return std::string();
}

bool isRegexValid(const std::string& regex)
{
    try
    {
        std::regex re(regex);
        return true;
    }
    catch (const std::regex_error& exc){}

    return false;
}

} // namespace RegexUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
