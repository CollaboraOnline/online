/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <cassert>
#include <cstring>
#include <map>
#include <string>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include <Poco/StringTokenizer.h>

#include "LOOLProtocol.hpp"

using Poco::StringTokenizer;

namespace LOOLProtocol
{
    std::tuple<signed, signed, std::string> ParseVersion(const std::string& version)
    {
        signed major = -1;
        signed minor = -1;
        std::string patch;

        StringTokenizer firstTokens(version, ".", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        if (firstTokens.count() > 0)
        {
            major = std::stoi(firstTokens[0]);

            StringTokenizer secondTokens(firstTokens[1], "-", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            minor = std::stoi(secondTokens[0]);

            if (secondTokens.count() > 1)
                patch = secondTokens[1];
        }

        return std::make_tuple(major, minor, patch);
    }

    bool getTokenInteger(const std::string& token, const std::string& name, int& value)
    {
        size_t nextIdx;
        try
        {
            if (token.size() < name.size() + 2 ||
                token.substr(0, name.size()) != name ||
                token[name.size()] != '=' ||
                (value = std::stoi(token.substr(name.size() + 1), &nextIdx), false) ||
                nextIdx != token.size() - name.size() - 1)
            {
                throw std::invalid_argument("bah");
            }
        }
        catch (std::invalid_argument&)
        {
            return false;
        }

        return true;
    }

    bool getTokenString(const std::string& token, const std::string& name, std::string& value)
    {
        try
        {
            if (token.size() < name.size() + 2 ||
                token.substr(0, name.size()) != name ||
                token[name.size()] != '=')
            {
                throw std::invalid_argument("bah");
            }
        }
        catch (std::invalid_argument&)
        {
            return false;
        }
        value = token.substr(name.size() + 1);
        return true;
    }

    bool getTokenKeyword(const std::string& token, const std::string& name, const std::map<std::string, int>& map, int& value)
    {
        if (token.size() < name.size() + 2 ||
            token.substr(0, name.size()) != name ||
            token[name.size()] != '=')
            return false;

        std::string t = token.substr(name.size()+1);
        if (t[0] == '\'' && t[t.size()-1] == '\'')
            t = t.substr(1, t.size()-2);

        auto p = map.find(t);
        if (p == map.cend())
            return false;

        value = p->second;
        return true;
    }

    bool parseStatus(const std::string& message, LibreOfficeKitDocumentType& type, int& nParts, int& currentPart, int& width, int& height)
    {
        StringTokenizer tokens(message, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

        assert(tokens.count() == 6);
        assert(tokens[0] == "status:");

        std::string typeString;
        if (!getTokenString(tokens[1], "type", typeString))
            return false;

        if (typeString == "text")
            type = LOK_DOCTYPE_TEXT;
        else if (typeString == "spreadsheet")
            type = LOK_DOCTYPE_SPREADSHEET;
        else if (typeString == "presentation")
            type = LOK_DOCTYPE_PRESENTATION;
        else if (typeString == "drawing")
            type = LOK_DOCTYPE_PRESENTATION;
        else if (typeString == "other")
            type = LOK_DOCTYPE_OTHER;
        else
            return false;

        if (!getTokenInteger(tokens[2], "parts", nParts) ||
            !getTokenInteger(tokens[3], "current", currentPart) ||
            !getTokenInteger(tokens[4], "width", width) ||
            !getTokenInteger(tokens[5], "height", height))
            return false;

        return true;
    }

    std::string getFirstLine(const char *message, int length)
    {
        const char *endOfLine = static_cast<const char *>(std::memchr(message, '\n', length));
        if (endOfLine == nullptr)
            return std::string(message, length);
        else
            return std::string(message, endOfLine-message);
    }

    std::string getAbbreviatedMessage(const char *message, int length)
    {
        std::string result = "'" + getFirstLine(message, length) + "'";
        if (result.size() < static_cast<std::string::size_type>(length))
            result += "...";
        return result;
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
