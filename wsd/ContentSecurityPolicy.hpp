/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include "Log.hpp"
#include "StringVector.hpp"
#include "Util.hpp"
#include <sstream>
#include <string>
#include <unordered_map>

/// Manages the HTTP Content-Security-Policy Header.
/// See https://www.w3.org/TR/CSP2/
class ContentSecurityPolicy
{
public:
    ContentSecurityPolicy() = default;

    ContentSecurityPolicy(const ContentSecurityPolicy& other)
        : _directives(other._directives)
    {
    }

    /// Given a CSP string, merge it with the existing values.
    void merge(const std::string& csp)
    {
        LOG_TRC("Merging CSP directives [" << csp << ']');
        StringVector tokens = StringVector::tokenize(csp, ';');
        for (std::size_t i = 0; i < tokens.size(); ++i)
        {
            const std::string token = Util::trimmed(tokens[i]);
            if (!token.empty())
            {
                LOG_TRC("Merging CSP directive [" << token << ']');
                const auto parts = Util::split(token);
                appendDirective(parts.first, parts.second);
            }
        }
    }

    /// Append the given value to a directive.
    /// @value must be space-delimited and cannot have semicolon.
    void appendDirective(std::string directive, std::string value)
    {
        LOG_ASSERT_MSG(value.find_first_of(';') == std::string::npos,
                       "Unexpected semicolon in CSP policy directive");

        Util::trim(directive);
        Util::trim(value);
        if (!directive.empty() && !value.empty())
        {
            LOG_TRC("Appending CSP directive [" << directive << "] = [" << value << ']');
            _directives[directive].append(' ' + value);
        }
    }

    /// Returns the value of the CSP header.
    std::string generate() const
    {
        std::ostringstream oss;
        for (const auto& pair : _directives)
        {
            oss << pair.first << ' ' << pair.second << "; ";
        }

        return oss.str();
    }

private:
    /// The policy directives.
    std::unordered_map<std::string, std::string> _directives;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
