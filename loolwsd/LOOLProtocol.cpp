/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <cassert>

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitEnums.h>

#include <Poco/StringTokenizer.h>

#include "LOOLProtocol.hpp"

using Poco::StringTokenizer;

namespace LOOLProtocol
{
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
            std::string type = token.substr(name.size() + 1);
            if (type == "'start'" ||
                type == "'buttondown'" ||
                type == "'input'")
            {
                value = 0;
            }
            else if (type == "'end'" ||
                     type == "'buttonup'" ||
                     type == "'up'")
            {
                value = 1;
            }
            else if (type == "'reset'" ||
                     type == "'move'")
            {
                value = 2;
            }
            else
            {
                return false ;
            }
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
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
