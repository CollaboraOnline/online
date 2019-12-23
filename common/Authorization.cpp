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
            request.set("Authorization", "Bearer " + _data);
            break;
        case Type::Header:
        {
            // there might be more headers in here; like
            //   Authorization: Basic ....
            //   X-Something-Custom: Huh
            // Regular expression evaluates and finds "\n\r" and tokenizes accordingly
            std::vector<std::string> tokens(LOOLProtocol::tokenize(_data, std::regex(R"(\n\r)"), /*skipEmpty =*/ true));
            for (const auto& token : tokens)
            {
                size_t separator = token.find_first_of(':');
                if (separator != std::string::npos)
                {
                    size_t headerStart = token.find_first_not_of(' ', 0);
                    size_t headerEnd = token.find_last_not_of(' ', separator - 1);

                    size_t valueStart = token.find_first_not_of(' ', separator + 1);
                    size_t valueEnd = token.find_last_not_of(' ');

                    // set the header
                    if (headerStart != std::string::npos && headerEnd != std::string::npos &&
                            valueStart != std::string::npos && valueEnd != std::string::npos)
                    {
                        size_t headerLength = headerEnd - headerStart + 1;
                        size_t valueLength = valueEnd - valueStart + 1;

                        request.set(token.substr(headerStart, headerLength), token.substr(valueStart, valueLength));
                    }
                }
            }
            break;
        }
        default:
            // assert(false);
            throw BadRequestException("Invalid HTTP request type");
            break;
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
