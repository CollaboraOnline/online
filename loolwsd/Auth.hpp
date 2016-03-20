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

#include <Poco/Base64Encoder.h>
#include <Poco/Base64Decoder.h>
#include <Poco/Crypto/RSADigestEngine.h>
#include <Poco/Crypto/RSAKey.h>
#include <Poco/DigestEngine.h>
#include <Poco/JSON/Object.h>
#include <Poco/LineEndingConverter.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Timestamp.h>
#include <Poco/URI.h>

#include "Util.hpp"

/// Base class of all Authentication/Authorization implementations.
class AuthBase
{
public:

    /// Called to acquire an access token.
    virtual const std::string getAccessToken() = 0;

    /// Used to verify the validity of an access token.
    virtual bool verify(const std::string& token) = 0;
};

class JWTAuth: public AuthBase
{
public:
    JWTAuth(const std::string keyPath, const std::string name, const std::string sub, const std::string aud)
        : _name(name),
          _sub(sub),
          _aud(aud),
          _key(Poco::Crypto::RSAKey("", keyPath)),
          _digestEngine(_key, "SHA256")
    {    }

    const std::string getAccessToken()
    {
        std::string encodedHeader = createHeader();
        std::string encodedPayload = createPayload();

        // trim '=' from end of encoded header
        encodedHeader.erase(std::find_if(encodedHeader.rbegin(), encodedHeader.rend(),
                                         [](char& ch)->bool {return ch != '='; }).base(), encodedHeader.end());
        // trim '=' from end of encoded payload
        encodedPayload.erase(std::find_if(encodedPayload.rbegin(), encodedPayload.rend(),
                                          [](char& ch)->bool { return ch != '='; }).base(), encodedPayload.end());
        Log::info("Encoded JWT header: " + encodedHeader);
        Log::info("Encoded JWT payload: " + encodedPayload);

        // Convert to a URL and filename safe variant:
        // Replace '+' with '-' && '/' with '_'
        std::replace(encodedHeader.begin(), encodedHeader.end(), '+','-');
        std::replace(encodedHeader.begin(), encodedHeader.end(), '/','_');

        std::replace(encodedPayload.begin(), encodedPayload.end(), '+','-');
        std::replace(encodedPayload.begin(), encodedPayload.end(), '/','_');

        std::string encodedBody = encodedHeader  + "." +  encodedPayload;

        // sign the encoded body
        _digestEngine.update(encodedBody.c_str(), static_cast<unsigned>(encodedBody.length()));
        Poco::Crypto::DigestEngine::Digest digest = _digestEngine.signature();

        // The signature generated contains CRLF line endings.
        // Use a line ending converter to remove these CRLF
        std::ostringstream ostr;
        Poco::OutputLineEndingConverter lineEndingConv(ostr, "");
        Poco::Base64Encoder encoder(lineEndingConv);
        encoder << std::string(digest.begin(), digest.end());
        encoder.close();
        std::string encodedSig = ostr.str();

        // trim '=' from end of encoded signature
        encodedSig.erase(std::find_if(encodedSig.rbegin(), encodedSig.rend(),
                                      [](char& ch)->bool { return ch != '='; }).base(), encodedSig.end());

        // Be URL and filename safe
        std::replace(encodedSig.begin(), encodedSig.end(), '+','-');
        std::replace(encodedSig.begin(), encodedSig.end(), '/','_');

        Log::info("Sig generated is : " + encodedSig);

        const std::string jwtToken = encodedBody + "." + encodedSig;
        Log::info("JWT token generated: " + jwtToken);

        return jwtToken;
    }

    bool verify(const std::string& accessToken)
    {
        Poco::StringTokenizer tokens(accessToken, ".", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);

        std::string encodedBody = tokens[0] + "." + tokens[1];
        _digestEngine.update(encodedBody.c_str(), static_cast<unsigned>(encodedBody.length()));
        Poco::Crypto::DigestEngine::Digest digest = _digestEngine.signature();

        std::ostringstream ostr;
        Poco::OutputLineEndingConverter lineEndingConv(ostr, "");
        Poco::Base64Encoder encoder(lineEndingConv);

        encoder << std::string(digest.begin(), digest.end());
        encoder.close();
        std::string encodedSig = ostr.str();

        // trim '=' from end of encoded signature.
        encodedSig.erase(std::find_if(encodedSig.rbegin(), encodedSig.rend(),
                                      [](char& ch)->bool { return ch != '='; }).base(), encodedSig.end());

        // Make the encoded sig URL and filename safe
        std::replace(encodedSig.begin(), encodedSig.end(), '+', '-');
        std::replace(encodedSig.begin(), encodedSig.end(), '/', '_');

        if (encodedSig != tokens[2])
        {
            Log::info("JWTAuth::Token verification failed; Expected: " + encodedSig + ", Received: " + tokens[2]);
            return false;
        }

        // TODO: Check for expiry etc.

        return true;
    }

private:
    const std::string createHeader()
    {
        // TODO: Some sane code to represent JSON objects
        std::string header = "{\"alg\":\""+_alg+"\",\"typ\":\""+_typ+"\"}";

        Log::info("JWT Header: " + header);
        std::ostringstream ostr;
        Poco::OutputLineEndingConverter lineEndingConv(ostr, "");
        Poco::Base64Encoder encoder(lineEndingConv);
        encoder << header;
        encoder.close();

        return ostr.str();
    }

    const std::string createPayload()
    {
        std::time_t curtime = Poco::Timestamp().epochTime();
        std::string exptime = std::to_string(curtime + 3600);

        // TODO: Some sane code to represent JSON objects
        std::string payload = "{\"iss\":\""+_iss+"\",\"sub\":\""+_sub+"\",\"aud\":\""+_aud+"\",\"nme\":\""+_name+"\",\"exp\":\""+exptime+"\"}";

        Log::info("JWT Payload: " + payload);
        std::ostringstream ostr;
        Poco::OutputLineEndingConverter lineEndingConv(ostr, "");
        Poco::Base64Encoder encoder(lineEndingConv);
        encoder << payload;
        encoder.close();

        return ostr.str();
    }

private:
    const std::string _alg = "RS256";
    const std::string _typ = "JWT";

    const std::string _iss = "lool";
    const std::string _name;
    const std::string _sub;
    const std::string _aud;

    const Poco::Crypto::RSAKey _key;
    Poco::Crypto::RSADigestEngine _digestEngine;
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
    const std::string getAccessToken() override
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

        return std::string();
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
