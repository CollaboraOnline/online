/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "Authorization.hpp"

#include <cstdlib>
#include <cassert>

#include <Poco/StringTokenizer.h>

void Authorization::authorizeURI(Poco::URI& uri) const
{
    if (_type == Authorization::Type::Token)
    {
        static const std::string key("access_token");

        Poco::URI::QueryParameters queryParams = uri.getQueryParameters();
        for (auto& param: queryParams)
        {
            if (param.first == key)
            {
                param.second = _data;
                uri.setQueryParameters(queryParams);
                return;
            }
        }

        // it did not exist yet
        uri.addQueryParameter(key, _data);
    }
}

void Authorization::authorizeRequest(Poco::Net::HTTPRequest& request) const
{
    switch (_type)
    {
        case Type::Token:
            request.set("Authorization", "Bearer " + _data);
            break;
        case Type::Header:
        {
            // there might be more headers in here; like
            //   Authorization: Basic ....
            //   X-Something-Custom: Huh
            Poco::StringTokenizer tokens(_data, "\n\r", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
            for (const auto& token : tokens)
            {
                size_t i = token.find_first_of(':');
                if (i != std::string::npos)
                {
                    size_t separator = i;
                    for (++i; i < token.length() && token[i] == ' ';)
                        ++i;

                    // set the header
                    if (i < token.length())
                        request.set(token.substr(0, separator), token.substr(i));
                }
            }
            break;
        }
        default:
            assert(false);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
