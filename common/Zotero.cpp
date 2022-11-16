/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "Zotero.hpp"
#include <sstream>
#include <net/HttpRequest.hpp>

#include <Poco/JSON/Object.h>
#include <Poco/JSON/Parser.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>

#if !MOBILEAPP
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/Net/KeyConsoleHandler.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#endif

namespace Zotero
{
std::string ZoteroConfig::APIKey;
std::string ZoteroConfig::UserId;

#if !MOBILEAPP
std::unique_ptr<Poco::Net::HTTPClientSession> lcl_initializeSSLSession(Poco::URI& uriObject)
{
    Poco::Net::initializeSSL();
    Poco::Net::Context::Params sslClientParams;
    sslClientParams.verificationMode = Poco::Net::Context::VERIFY_NONE;
    Poco::SharedPtr<Poco::Net::PrivateKeyPassphraseHandler> consoleClientHandler =
        new Poco::Net::KeyConsoleHandler(false);
    Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidClientCertHandler =
        new Poco::Net::AcceptCertificateHandler(false);
    Poco::Net::Context::Ptr sslClientContext =
        new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslClientParams);
    Poco::Net::SSLManager::instance().initializeClient(consoleClientHandler,
                                                       invalidClientCertHandler, sslClientContext);

    return Util::make_unique<Poco::Net::HTTPSClientSession>(
            uriObject.getHost(), uriObject.getPort(),
            Poco::Net::SSLManager::instance().defaultClientContext());
}

std::string lcl_handleRequestResponse(std::unique_ptr<Poco::Net::HTTPClientSession> session, Poco::Net::HTTPRequest& request)
{
    session->sendRequest(request);

    Poco::Net::HTTPResponse response;
    std::istream& responseStream = session->receiveResponse(response);

    std::ostringstream outputStringStream;
    Poco::StreamCopier::copyStream(responseStream, outputStringStream);
    std::string responseString = outputStringStream.str();

    return responseString;
}
#endif

std::string ZoteroConfig::fetchItemsList()
{
#if !MOBILEAPP
    Poco::URI uriObject(APIURL + "/users/" + UserId + "/items/top");
    uriObject.addQueryParameter("include", "data,citation,bib");
    // using default style for now until style is stored in document
    // uriObject.addQueryParameter("style", documentCitationStyle);

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, uriObject.getPathAndQuery(),
                                   Poco::Net::HTTPMessage::HTTP_1_1);
    request.set("Zotero-API-Key", APIKey);

    std::string responseString = lcl_handleRequestResponse(lcl_initializeSSLSession(uriObject), request);

    return responseString;
#else
    return "";
#endif
}

std::string ZoteroConfig::fetchUserId(const std::string& key)
{
#if !MOBILEAPP
    if (key.empty())
        return "";

    Poco::URI uriObject(APIURL + "/keys/" + key);

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, uriObject.getPathAndQuery(),
                                   Poco::Net::HTTPMessage::HTTP_1_1);

    std::string responseString = lcl_handleRequestResponse(lcl_initializeSSLSession(uriObject), request);

    Poco::JSON::Parser parser;
    Poco::Dynamic::Var result = parser.parse(responseString);
    Poco::JSON::Object::Ptr pObject = result.extract<Poco::JSON::Object::Ptr>();

    std::string userId = std::to_string(pObject->getValue<int>("userID"));

    return userId;
#else
    return "";
#endif
}

} // namespace Zotero

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
