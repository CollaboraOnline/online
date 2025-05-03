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

#include <map>
#include <set>
#include <string>

namespace RegexUtil
{

/// Return true if the subject matches in given set. It uses regex
/// Mainly used to match WOPI hosts patterns
bool matchRegex(const std::set<std::string>& set, const std::string& subject);

/// Return value from key:value pair if the subject matches in given map. It uses regex
/// Mainly used to match WOPI hosts patterns
std::string getValue(const std::map<std::string, std::string>& map, const std::string& subject);

std::string getValue(const std::set<std::string>& set, const std::string& subject);

/// Given one or more patterns to allow, and one or more to deny,
/// the match member will return true if, and only if, the subject
/// matches the allowed list, but not the deny.
/// By default, everything is denied.
class RegexListMatcher final
{
public:
    RegexListMatcher()
        : _allowByDefault(false)
    {
    }

    explicit RegexListMatcher(const bool allowByDefault)
        : _allowByDefault(allowByDefault)
    {
    }

    void allow(const std::string& pattern) { _allowed.insert(pattern); }
    void deny(const std::string& pattern)
    {
        _allowed.erase(pattern);
        _denied.insert(pattern);
    }

    void clear()
    {
        _allowed.clear();
        _denied.clear();
    }

    bool match(const std::string& subject) const
    {
        return (_allowByDefault || matchRegex(_allowed, subject)) && !matchRegex(_denied, subject);
    }

    /// Whether a match exist in either _allowed or _denied.
    bool matchExist(const std::string& subject) const
    {
        return (matchRegex(_allowed, subject) || matchRegex(_denied, subject));
    }

    bool empty() const { return _allowed.empty() && _denied.empty(); }

private:
    std::set<std::string> _allowed;
    std::set<std::string> _denied;
    const bool _allowByDefault;
};

} // namespace RegexUtil

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
