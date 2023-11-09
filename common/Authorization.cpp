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

#include "Authorization.hpp"
#include "Log.hpp"
#include "StringVector.hpp"

#include <Poco/Net/HTTPRequest.h>
#include <Poco/URI.h>

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
            // Split based on \n's or \r's and trim, to avoid nonsense in the
            // headers
            StringVector tokens(StringVector::tokenizeAnyOf(_data, "\n\r"));
            for (auto it = tokens.begin(); it != tokens.end(); ++it)
            {
                std::string token = tokens.getParam(*it);

                std::size_t separator = token.find_first_of(':');
                if (separator != std::string::npos)
                {
                    std::size_t headerStart = token.find_first_not_of(' ', 0);
                    std::size_t headerEnd = token.find_last_not_of(' ', separator - 1);

                    std::size_t valueStart = token.find_first_not_of(' ', separator + 1);
                    std::size_t valueEnd = token.find_last_not_of(' ');

                    // set the header
                    if (headerStart != std::string::npos && headerEnd != std::string::npos &&
                            valueStart != std::string::npos && valueEnd != std::string::npos)
                    {
                        std::size_t headerLength = headerEnd - headerStart + 1;
                        std::size_t valueLength = valueEnd - valueStart + 1;

                        request.set(token.substr(headerStart, headerLength), token.substr(valueStart, valueLength));
                    }
                }
            }
            break;
        }
        default:
            LOG_ERR("No HTTP Authorization type detected. Assuming no authorization needed. "
                    "Specify access_token to set the Authorization Bearer header.");
            break;
    }
}

Authorization Authorization::create(const Poco::URI& uri)
{
    // prefer the access_token
    std::string decoded;
    for (const auto& param : uri.getQueryParameters())
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

Authorization Authorization::create(const std::string& uri) { return create(Poco::URI(uri)); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
