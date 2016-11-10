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
#include <Poco/URI.h>

#include <cppunit/extensions/HelperMacros.h>

#include "Common.hpp"
#include "LOOLProtocol.hpp"
#include <LOOLWebSocket.hpp>
#include "helpers.hpp"
#include "countloolkits.hpp"

using namespace helpers;

class HTTPWSError : public CPPUNIT_NS::TestFixture
{
    const Poco::URI _uri;
    Poco::Net::HTTPResponse _response;
    static int InitialLoolKitCount;

    CPPUNIT_TEST_SUITE(HTTPWSError);

    CPPUNIT_TEST(testMaxDocuments);
    CPPUNIT_TEST(testMaxConnections);

    CPPUNIT_TEST_SUITE_END();

    void testCountHowManyLoolkits();
    void testNoExtraLoolKitsLeft();
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
        testCountHowManyLoolkits();
    }

    void tearDown()
    {
        testNoExtraLoolKitsLeft();
    }
};

int HTTPWSError::InitialLoolKitCount = 1;

void HTTPWSError::testCountHowManyLoolkits()
{
    InitialLoolKitCount = countLoolKitProcesses(InitialLoolKitCount);
    CPPUNIT_ASSERT(InitialLoolKitCount > 0);
}

void HTTPWSError::testNoExtraLoolKitsLeft()
{
    const auto countNow = countLoolKitProcesses(InitialLoolKitCount);

    CPPUNIT_ASSERT_EQUAL(InitialLoolKitCount, countNow);
}

void HTTPWSError::testMaxDocuments()
{
#if MAX_DOCUMENTS > 0
    const auto testname = "maxDocuments ";
    try
    {
        // Load a document.
        std::vector<std::shared_ptr<LOOLWebSocket>> docs;

        std::cerr << "Loading max number of documents: " << MAX_DOCUMENTS << std::endl;
        for (int it = 1; it <= MAX_DOCUMENTS; ++it)
        {
            docs.emplace_back(loadDocAndGetSocket("empty.odt", _uri, testname));
            std::cerr << "Loaded document #" << it << " of " << MAX_DOCUMENTS << std::endl;
        }

        std::cerr << "Loading one more document beyond the limit." << std::endl;

        // try to open MAX_DOCUMENTS + 1
        std::string docPath;
        std::string docURL;
        getDocumentPathAndURL("empty.odt", docPath, docURL);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));
        LOOLWebSocket socket(*session, request, _response);

        // send loolclient, load and partpagerectangles
        sendTextFrame(socket, "loolclient ", testname);
        sendTextFrame(socket, "load ", testname);
        sendTextFrame(socket, "partpagerectangles ", testname);

        assertResponseString(socket, "error:", testname);

        std::string message;
        const auto statusCode = getErrorCode(socket, message);
        CPPUNIT_ASSERT_EQUAL(static_cast<int>(Poco::Net::WebSocket::WS_POLICY_VIOLATION), statusCode);

        socket.shutdown();
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
    const auto testname = "maxConnections ";
    try
    {
        std::cerr << "Opening max number of connections: " << MAX_CONNECTIONS << std::endl;

        // Load a document.
        std::string docPath;
        std::string docURL;

        getDocumentPathAndURL("empty.odt", docPath, docURL);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
        auto socket = loadDocAndGetSocket(_uri, docURL, testname);
        std::cerr << "Opened connect #1 of " << MAX_CONNECTIONS << std::endl;

        std::vector<std::shared_ptr<LOOLWebSocket>> views;
        for(int it = 1; it < MAX_CONNECTIONS; it++)
        {
            std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(_uri));
            auto ws = std::make_shared<LOOLWebSocket>(*session, request, _response);
            views.emplace_back(ws);
            std::cerr << "Opened connect #" << (it+1) << " of " << MAX_CONNECTIONS << std::endl;
        }

        std::cerr << "Opening one more connection beyond the limit." << std::endl;

        // try to connect MAX_CONNECTIONS + 1
        std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(_uri));
        LOOLWebSocket socketN(*session, request, _response);

        // send loolclient, load and partpagerectangles
        sendTextFrame(socketN, "loolclient ", testname);
        sendTextFrame(socketN, "load ", testname);
        sendTextFrame(socketN, "partpagerectangles ", testname);

        std::string message;
        const auto statusCode = getErrorCode(socketN, message);
        CPPUNIT_ASSERT_EQUAL(static_cast<int>(Poco::Net::WebSocket::WS_POLICY_VIOLATION), statusCode);

        socketN.shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
#endif
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPWSError);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
