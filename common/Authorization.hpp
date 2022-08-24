/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// WOPI Authorization

#pragma once

#include <string>
#include <vector>

namespace Poco
{
namespace Net
{
class HTTPRequest;
}

class URI;

} // namespace Poco

/// Class to keep the authorization data, which can be either access_token or access_header.
class Authorization
{
public:
    enum class Type
    {
        None,
        Token,
        Header
    };

private:
    Type _type;
    std::string _data;

public:
    Authorization()
        : _type(Type::None)
    {
    }

    Authorization(Type type, const std::string& data)
        : _type(type)
        , _data(data)
    {
    }

    /// Create an Authorization instance from the URI query parameters.
    /// Expects access_token (preferred) or access_header.
    static Authorization create(const Poco::URI& uri);
    static Authorization create(const std::string& uri);

    void resetAccessToken(std::string accessToken)
    {
        _type = Type::Token;
        _data = std::move(accessToken);
    }

    /// Set the access_token parameter to the given URI.
    void authorizeURI(Poco::URI& uri) const;

    /// Set the Authorization: header in request.
    void authorizeRequest(Poco::Net::HTTPRequest& request) const;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
