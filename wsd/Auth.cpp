/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "Auth.hpp"

#include <cstdlib>
#include <string>

#include <Poco/Base64Decoder.h>
#include <Poco/Base64Encoder.h>
#include <Poco/Crypto/RSADigestEngine.h>
#include <Poco/Crypto/RSAKey.h>
#include <Poco/Dynamic/Var.h>
#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/LineEndingConverter.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/NetException.h>
#include <Poco/Timestamp.h>
#include <Poco/URI.h>

#include <Log.hpp>
#include <Util.hpp>
#include <Protocol.hpp>

using Poco::Base64Decoder;
using Poco::Base64Encoder;
using Poco::OutputLineEndingConverter;

std::unique_ptr<Poco::Crypto::RSAKey> JWTAuth::_key(
    new Poco::Crypto::RSAKey(Poco::Crypto::RSAKey(Poco::Crypto::RSAKey::KL_2048, Poco::Crypto::RSAKey::EXP_LARGE)));

// avoid obscure double frees on exit.
void JWTAuth::cleanup()
{
    _key.reset();
}

const std::string JWTAuth::getAccessToken()
{
    std::string encodedHeader = createHeader();
    std::string encodedPayload = createPayload();

    // trim '=' from end of encoded header
    encodedHeader.erase(std::find_if(encodedHeader.rbegin(), encodedHeader.rend(),
                                     [](char& ch)->bool {return ch != '='; }).base(), encodedHeader.end());
    // trim '=' from end of encoded payload
    encodedPayload.erase(std::find_if(encodedPayload.rbegin(), encodedPayload.rend(),
                                      [](char& ch)->bool { return ch != '='; }).base(), encodedPayload.end());
    LOG_INF("Encoded JWT header: " << encodedHeader);
    LOG_INF("Encoded JWT payload: " << encodedPayload);

    // Convert to a URL and filename safe variant:
    // Replace '+' with '-' && '/' with '_'
    std::replace(encodedHeader.begin(), encodedHeader.end(), '+', '-');
    std::replace(encodedHeader.begin(), encodedHeader.end(), '/', '_');

    std::replace(encodedPayload.begin(), encodedPayload.end(), '+', '-');
    std::replace(encodedPayload.begin(), encodedPayload.end(), '/', '_');

    const std::string encodedBody = encodedHeader + '.' +  encodedPayload;

    // sign the encoded body
    _digestEngine.update(encodedBody.c_str(), static_cast<unsigned>(encodedBody.length()));
    Poco::Crypto::DigestEngine::Digest digest = _digestEngine.signature();

    // The signature generated contains CRLF line endings.
    // Use a line ending converter to remove these CRLF
    std::ostringstream ostr;
    OutputLineEndingConverter lineEndingConv(ostr, "");
    Base64Encoder encoder(lineEndingConv);
    encoder << std::string(digest.begin(), digest.end());
    encoder.close();
    std::string encodedSig = ostr.str();

    // trim '=' from end of encoded signature
    encodedSig.erase(std::find_if(encodedSig.rbegin(), encodedSig.rend(),
                                  [](char& ch)->bool { return ch != '='; }).base(), encodedSig.end());

    // Be URL and filename safe
    std::replace(encodedSig.begin(), encodedSig.end(), '+', '-');
    std::replace(encodedSig.begin(), encodedSig.end(), '/', '_');

    LOG_INF("Sig generated is : " << encodedSig);

    const std::string jwtToken = encodedBody + '.' + encodedSig;
    LOG_INF("JWT token generated: " << jwtToken);

    return jwtToken;
}

bool JWTAuth::verify(const std::string& accessToken)
{
    StringVector tokens(LOOLProtocol::tokenize(accessToken, '.'));

    try
    {
        if (tokens.size() < 3)
        {
            LOG_INF("JWTAuth: verification failed; Not enough tokens");
            return false;
        }

        const std::string encodedBody = tokens[0] + '.' + tokens[1];
        _digestEngine.update(encodedBody.c_str(), static_cast<unsigned>(encodedBody.length()));
        Poco::Crypto::DigestEngine::Digest digest = _digestEngine.signature();

        std::ostringstream ostr;
        OutputLineEndingConverter lineEndingConv(ostr, "");
        Base64Encoder encoder(lineEndingConv);

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
            LOG_INF("JWTAuth: verification failed; Expected: " << encodedSig << ", Received: " << tokens[2]);
            if (!Util::isFuzzing())
            {
                return false;
            }
        }

        std::istringstream istr(tokens[1]);
        std::string decodedPayload;
        Base64Decoder decoder(istr);
        decoder >> decodedPayload;

        LOG_INF("JWTAuth:verify: decoded payload: " << decodedPayload);

        // Verify if the token is not already expired
        Poco::JSON::Parser parser;
        Poco::Dynamic::Var result = parser.parse(decodedPayload);
        Poco::JSON::Object::Ptr object = result.extract<Poco::JSON::Object::Ptr>();
        std::time_t decodedExptime = 0;
        object->get("exp").convert(decodedExptime);

        std::chrono::system_clock::time_point now = std::chrono::system_clock::now();
        std::time_t curtime = std::chrono::system_clock::to_time_t(now);
        if (curtime > decodedExptime)
        {
            LOG_INF("JWTAuth:verify: JWT expired; curtime:" << curtime << ", exp:" << decodedExptime);
            if (!Util::isFuzzing())
            {
                return false;
            }
        }
    }
    catch(Poco::Exception& exc)
    {
        LOG_WRN("JWTAuth:verify: Exception: " << exc.displayText());
        return false;
    }

    return true;
}

const std::string JWTAuth::createHeader()
{
    // TODO: Some sane code to represent JSON objects
    const std::string header = "{\"alg\":\"" + _alg + "\",\"typ\":\"" + _typ + "\"}";

    LOG_INF("JWT Header: " << header);
    std::ostringstream ostr;
    OutputLineEndingConverter lineEndingConv(ostr, "");
    Base64Encoder encoder(lineEndingConv);
    encoder << header;
    encoder.close();

    return ostr.str();
}

const std::string JWTAuth::createPayload()
{
    std::chrono::system_clock::time_point now = std::chrono::system_clock::now();
    std::time_t curtime = std::chrono::system_clock::to_time_t(now);
    const std::string exptime = std::to_string(curtime + 1800);

    // TODO: Some sane code to represent JSON objects
    const std::string payload = "{\"iss\":\"" + _iss + "\",\"sub\":\"" + _sub
                              + "\",\"aud\":\"" + _aud + "\",\"nme\":\"" + _name
                              + "\",\"exp\":\"" + exptime + "\"}";

    LOG_INF("JWT Payload: " << payload);
    std::ostringstream ostr;
    OutputLineEndingConverter lineEndingConv(ostr, "");
    Base64Encoder encoder(lineEndingConv);
    encoder << payload;
    encoder.close();

    return ostr.str();
}

//TODO: This MUST be done over TLS to protect the token.
const std::string OAuth::getAccessToken()
{
    const std::string url = _tokenEndPoint
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
    LOG_INF("Status: " <<  response.getStatus() << ' ' << response.getReason());

    const std::string reply(std::istreambuf_iterator<char>(rs), {});
    LOG_INF("Response: " << reply);
    //TODO: Parse the token.

    return std::string();
}

bool OAuth::verify(const std::string& token)
{
    const std::string url = _authVerifyUrl + token;
    LOG_DBG("Verifying authorization token from: " << url);
    Poco::URI uri(url);
    Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, url, Poco::Net::HTTPMessage::HTTP_1_1);
    Poco::Net::HTTPResponse response;
    session.sendRequest(request);

    std::istream& rs = session.receiveResponse(response);
    LOG_INF("Status: " <<  response.getStatus() << ' ' << response.getReason());

    const std::string reply(std::istreambuf_iterator<char>(rs), {});
    LOG_INF("Response: " << reply);

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

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
