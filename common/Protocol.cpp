/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "Protocol.hpp"

#include <cassert>
#include <cstring>
#include <map>
#include <string>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

namespace COOLProtocol
{
    std::tuple<int, int, std::string> ParseVersion(const std::string& version)
    {
        int major = -1;
        int minor = -1;
        std::string patch;

        StringVector firstTokens(StringVector::tokenize(version, '.'));
        if (firstTokens.size() > 0)
        {
            major = std::stoi(firstTokens[0]);

            StringVector secondTokens;
            if (firstTokens.size() > 1)
            {
                secondTokens = StringVector::tokenize(firstTokens[1], '-');
            }
            if (secondTokens.size() > 0)
            {
                minor = std::stoi(secondTokens[0]);
            }

            if (secondTokens.size() > 1)
                patch = secondTokens[1];
        }
        return std::make_tuple(major, minor, patch);
    }

    bool getTokenInteger(const std::string& token, const std::string_view name, int& value)
    {
        if (token.size() > (name.size() + 1) &&
            token.compare(0, name.size(), name) == 0 &&
            token[name.size()] == '=')
        {
            const char* str = token.data() + name.size() + 1;
            char* endptr = nullptr;
            value = strtol(str, &endptr, 10);
            return (endptr > str);
        }

        return false;
    }

    bool getTokenUInt64(const std::string& token, const std::string_view name, uint64_t& value)
    {
        if (token.size() > (name.size() + 1) &&
            token.compare(0, name.size(), name) == 0 &&
            token[name.size()] == '=')
        {
            const char* str = token.data() + name.size() + 1;
            char* endptr = nullptr;
            value = strtoull(str, &endptr, 10);
            return (endptr > str);
        }

        return false;
    }

    bool getTokenUInt32(const std::string& token, const std::string_view name, uint32_t& value)
    {
        if (token.size() > (name.size() + 1) &&
            token.compare(0, name.size(), name) == 0 &&
            token[name.size()] == '=')
        {
            const char* str = token.data() + name.size() + 1;
            char* endptr = nullptr;
            value = strtoul(str, &endptr, 10);
            return (endptr > str);
        }

        return false;
    }

    bool getTokenString(const std::string& token, const std::string_view name, std::string& value)
    {
        if (token.size() >= (name.size() + 1) &&
            token.compare(0, name.size(), name) == 0 &&
            token[name.size()] == '=')
        {
            value = token.substr(name.size() + 1);
            return true;
        }

        return false;
    }

    bool getTokenKeyword(const std::string& token, const std::string_view name,
                         const std::map<std::string, int>& map, int& value)
    {
        std::string t;
        if (getTokenString(token, name, t))
        {
            if (t[0] == '\'' && t[t.size() - 1] == '\'')
            {
                t = t.substr(1, t.size() - 2);
            }

            const auto p = map.find(t);
            if (p != map.cend())
            {
                value = p->second;
                return true;
            }
        }

        return false;
    }

    bool getTokenInteger(const StringVector& tokens, const std::string_view name, int& value)
    {
        for (size_t i = 0; i < tokens.size(); i++)
        {
            if (getTokenInteger(tokens[i], name, value))
                return true;
        }
        return false;
    }

    bool getTokenKeyword(const StringVector& tokens, const std::string_view name, const std::map<std::string, int>& map, int& value)
    {
        for (size_t i = 0; i < tokens.size(); i++)
        {
            if (getTokenKeyword(tokens[i], name, map, value))
                return true;
        }
        return false;
    }

    bool getTokenStringFromMessage(const std::string& message, const std::string_view name, std::string& value)
    {
        if (message.size() > name.size() + 1)
        {
            size_t pos = message.find(name);
            while (pos != std::string::npos)
            {
                bool spaceBefore = pos == 0 || message[pos-1] == ' ';
                const size_t beg = pos + name.size();
                if (spaceBefore && message[beg] == '=')
                {
                    const size_t end = message.find_first_of(" \n", beg);
                    value = message.substr(beg + 1, end - beg - 1);
                    return true;
                }

                pos = message.find(name, pos + name.size());
            }
        }

        return false;
    }

    bool getTokenKeywordFromMessage(const std::string& message, const std::string_view name, const std::map<std::string, int>& map, int& value)
    {
        return getTokenKeyword(StringVector::tokenize(message), name, map, value);
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
