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
#include "Protocol.hpp"
#include "Log.hpp"
#include <Exceptions.hpp>

#include <cstdlib>
#include <cassert>
#include <regex>

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
            Util::setHttpHeaders(request, "Authorization: Bearer " + _data);
            assert(request.has("Authorization") && "HTTPRequest missing Authorization header");
            break;
        case Type::Header:
            // there might be more headers in here; like
            //   Authorization: Basic ....
            //   X-Something-Custom: Huh
            Util::setHttpHeaders(request, _data);
            break;
        default:
            // assert(false);
            throw BadRequestException("Invalid HTTP request type");
            break;
    }
}

Authorization Authorization::create(const Poco::URI::QueryParameters& queryParams)
{
    // prefer the access_token
    std::string decoded;
    for (const auto& param : queryParams)
    {
        if (param.first == "access_token")
        {
            Poco::URI::decode(param.second, decoded);
            return Authorization(Authorization::Type::Token, decoded);
        }

        if (param.first == "access_header")
            Poco::URI::decode(param.second, decoded);
    }

    if (!decoded.empty())
        return Authorization(Authorization::Type::Header, decoded);

    return Authorization();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
