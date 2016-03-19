/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Authentication and Authorization support.
#ifndef INCLUDED_AUTH_HPP
#define INCLUDED_AUTH_HPP

#include <cstdlib>
#include <string>

#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/URI.h>

#include "Util.hpp"

/// Base class of all Authentication/Authorization implementations.
class AuthBase
{
public:

    /// Called to acquire an access token.
    virtual bool getAccessToken() = 0;

    /// Used to verify the validity of an access token.
    virtual bool verify(const std::string& token) = 0;
};

class OAuth : public AuthBase
{
public:
    OAuth(const std::string& clientId,
          const std::string& clientSecret,
          const std::string& tokenEndPoint,
          const std::string& authVerifyUrl,
          const std::string& authorizationCode) :
        _clientId(clientId),
        _clientSecret(clientSecret),
        _tokenEndPoint(tokenEndPoint),
        _authVerifyUrl(authVerifyUrl),
        _authorizationCode(authorizationCode)
    {
    }

    //TODO: This MUST be done over TLS to protect the token.
    bool getAccessToken() override
    {
        std::string url = _tokenEndPoint
                        + "?client_id=" + _clientId
                        + "&client_secret=" + _clientSecret
                        + "&grant_type=authorization_code"
                        + "&code=" + _authorizationCode;
                        // + "&redirect_uri="

        Poco::URI uri(url);
        Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, url, Poco::Net::HTTPMessage::HTTP_1_1);
        Poco::Net::HTTPResponse response;
        session.sendRequest(request);
        std::istream& rs = session.receiveResponse(response);
        Log::info() << "Status: " <<  response.getStatus() << " " << response.getReason() << Log::end;
        std::string reply(std::istreambuf_iterator<char>(rs), {});
        Log::info("Response: " + reply);
        //TODO: Parse the token.

        return true;
    }

    bool verify(const std::string& token) override
    {
        const std::string url = _authVerifyUrl + token;
        Log::debug("Verifying authorization token from: " + url);
        Poco::URI uri(url);
        Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, url, Poco::Net::HTTPMessage::HTTP_1_1);
        Poco::Net::HTTPResponse response;
        session.sendRequest(request);
        std::istream& rs = session.receiveResponse(response);
        Log::info() << "Status: " <<  response.getStatus() << " " << response.getReason() << Log::end;
        std::string reply(std::istreambuf_iterator<char>(rs), {});
        Log::info("Response: " + reply);

        //TODO: Parse the response.
        /*
        // This is used for the demo site.
        const auto lastLogTime = std::strtoul(reply.c_str(), nullptr, 0);
        if (lastLogTime < 1)
        {
            //TODO: Redirect to login page.
            return;
        }
        */

        return true;
    }

private:
    const std::string _clientId;
    const std::string _clientSecret;
    const std::string _tokenEndPoint;
    const std::string _authVerifyUrl;
    const std::string _authorizationCode;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
