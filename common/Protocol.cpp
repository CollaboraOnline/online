/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
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

#include <Poco/StringTokenizer.h>

using Poco::StringTokenizer;

namespace LOOLProtocol
{
    std::tuple<int, int, std::string> ParseVersion(const std::string& version)
    {
        int major = -1;
        int minor = -1;
        std::string patch;

        StringTokenizer firstTokens(version, ".", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        if (firstTokens.count() > 0)
        {
            major = std::stoi(firstTokens[0]);

            std::unique_ptr<StringTokenizer> secondTokens;
            if (firstTokens.count() > 1)
            {
                secondTokens.reset(new StringTokenizer(firstTokens[1], "-", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM));
            }
            if (secondTokens && secondTokens->count() > 0)
            {
                minor = std::stoi((*secondTokens)[0]);
            }

            if (secondTokens && secondTokens->count() > 1)
                patch = (*secondTokens)[1];
        }
        return std::make_tuple(major, minor, patch);
    }

    bool stringToInteger(const std::string& input, int& value)
    {
        try
        {
            value = std::stoi(input);
        }
        catch (std::invalid_argument&)
        {
            return false;
        }

        return true;
    }

    bool stringToUInt32(const std::string& input, uint32_t& value)
    {
        try
        {
            value = std::stoul(input);
        }
        catch (std::invalid_argument&)
        {
            return false;
        }

        return true;
    }

    bool stringToUInt64(const std::string& input, uint64_t& value)
    {
        try
        {
            value = std::stoull(input);
        }
        catch (std::invalid_argument&)
        {
            return false;
        }

        return true;
    }

    bool getTokenInteger(const std::string& token, const std::string& name, int& value)
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

    bool getTokenUInt64(const std::string& token, const std::string& name, uint64_t& value)
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

    bool getTokenUInt32(const std::string& token, const std::string& name, uint32_t& value)
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

    bool getTokenString(const std::string& token, const std::string& name, std::string& value)
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

    bool getTokenKeyword(const std::string& token, const std::string& name,
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

    bool getTokenInteger(const Poco::StringTokenizer& tokens, const std::string& name, int& value)
    {
        for (size_t i = 0; i < tokens.count(); i++)
        {
            if (getTokenInteger(tokens[i], name, value))
                return true;
        }
        return false;
    }

    bool getTokenString(const Poco::StringTokenizer& tokens, const std::string& name, std::string& value)
    {
        for (size_t i = 0; i < tokens.count(); i++)
        {
            if (getTokenString(tokens[i], name, value))
                return true;
        }
        return false;
    }

    bool getTokenKeyword(const Poco::StringTokenizer& tokens, const std::string& name, const std::map<std::string, int>& map, int& value)
    {
        for (size_t i = 0; i < tokens.count(); i++)
        {
            if (getTokenKeyword(tokens[i], name, map, value))
                return true;
        }
        return false;
    }

    bool getTokenInteger(const std::vector<std::string>& tokens, const std::string& name, int& value)
    {
        for (const auto& pair : tokens)
        {
            if (getTokenInteger(pair, name, value))
            {
                return true;
            }
        }

        return false;
    }

    bool getTokenStringFromMessage(const std::string& message, const std::string& name, std::string& value)
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

    bool getTokenKeywordFromMessage(const std::string& message, const std::string& name, const std::map<std::string, int>& map, int& value)
    {
        Poco::StringTokenizer tokens(message, " \n", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        return getTokenKeyword(tokens, name, map, value);
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
