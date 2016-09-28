/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <vector>
#include <string>

#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/URI.h>

#include <cppunit/extensions/HelperMacros.h>

#include "Common.hpp"
#include "LOOLProtocol.hpp"
#include "helpers.hpp"

using namespace helpers;

class HTTPWSError : public CPPUNIT_NS::TestFixture
{
    const Poco::URI _uri;
    Poco::Net::HTTPResponse _response;

    CPPUNIT_TEST_SUITE(HTTPWSError);

    CPPUNIT_TEST(testMaxDocuments);
    CPPUNIT_TEST(testMaxConnections);

    CPPUNIT_TEST_SUITE_END();

    void testMaxDocuments();
    void testMaxConnections();

public:
    HTTPWSError()
        : _uri(helpers::getTestServerURI())
    {
#if ENABLE_SSL
        Poco::Net::initializeSSL();
        // Just accept the certificate anyway for testing purposes
        Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidCertHandler = new Poco::Net::AcceptCertificateHandler(false);
        Poco::Net::Context::Params sslParams;
        Poco::Net::Context::Ptr sslContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslParams);
        Poco::Net::SSLManager::instance().initializeClient(0, invalidCertHandler, sslContext);
#endif
    }

#if ENABLE_SSL
    ~HTTPWSError()
    {
        Poco::Net::uninitializeSSL();
    }
#endif

    void setUp()
    {
    }

    void tearDown()
    {
    }
};

void HTTPWSError::testMaxDocuments()
{
#if MAX_DOCUMENTS > 0
    try
    {
        // Load a document.
        std::string docPath;
        std::string docURL;
        std::string message;
        Poco::UInt16 statusCode;
        std::vector<std::shared_ptr<Poco::Net::WebSocket>> docs;

        for(int it = 1; it <= MAX_DOCUMENTS; it++)
        {
            getDocumentPathAndURL("empty.odt", docPath, docURL);
            Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
            docs.emplace_back(connectLOKit(_uri, request, _response));
        }

        // try to open MAX_DOCUMENTS + 1
        getDocumentPathAndURL("empty.odt", docPath, docURL);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));
        Poco::Net::WebSocket socket(*session, request, _response);
        statusCode = getErrorCode(socket, message);
        CPPUNIT_ASSERT_EQUAL(static_cast<Poco::UInt16>(Poco::Net::WebSocket::WS_ENDPOINT_GOING_AWAY), statusCode);
        CPPUNIT_ASSERT_MESSAGE("Wrong error message ", message.find("This development build") != std::string::npos);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
#endif
}

void HTTPWSError::testMaxConnections()
{
#if MAX_CONNECTIONS > 0
    try
    {
        // Load a document.
        std::string docPath;
        std::string docURL;
        std::string message;
        Poco::UInt16 statusCode;
        std::vector<std::shared_ptr<Poco::Net::WebSocket>> views;

        getDocumentPathAndURL("empty.odt", docPath, docURL);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
        auto socket = loadDocAndGetSocket(_uri, docURL, "testMaxConnections ");

        for(int it = 1; it < MAX_CONNECTIONS; it++)
        {
            std::cerr << it << std::endl;
            std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(_uri));
            auto ws = std::make_shared<Poco::Net::WebSocket>(*session, request, _response);
            views.emplace_back(ws);
        }

        // try to connect MAX_CONNECTIONS + 1
        std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(_uri));
        auto socketN = std::make_shared<Poco::Net::WebSocket>(*session, request, _response);
        statusCode = getErrorCode(*socketN, message);
        CPPUNIT_ASSERT_EQUAL(static_cast<Poco::UInt16>(Poco::Net::WebSocket::WS_ENDPOINT_GOING_AWAY), statusCode);
        CPPUNIT_ASSERT_MESSAGE("Wrong error message ", message.find("This development build") != std::string::npos);

    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
#endif
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPWSError);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
