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
#include "Protocol.hpp"
#include <LOOLWebSocket.hpp>
#include "helpers.hpp"
#include "countloolkits.hpp"

using namespace helpers;

class HTTPWSError : public CPPUNIT_NS::TestFixture
{
    const Poco::URI _uri;
    Poco::Net::HTTPResponse _response;

    CPPUNIT_TEST_SUITE(HTTPWSError);

    CPPUNIT_TEST(testBadDocLoadFail);
    // FIXME CPPUNIT_TEST(testMaxDocuments);
    CPPUNIT_TEST(testMaxConnections);
    CPPUNIT_TEST(testMaxViews);

    CPPUNIT_TEST_SUITE_END();

    void testBadDocLoadFail();
    void testMaxDocuments();
    void testMaxConnections();
    void testMaxViews();

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
        Poco::Net::SSLManager::instance().initializeClient(nullptr, invalidCertHandler, sslContext);
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

void HTTPWSError::testBadDocLoadFail()
{
    // Load corrupted document and validate error.
    const auto testname = "docLoadFail ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("corrupted.odt", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        auto socket = connectLOKit(_uri, request, _response);

        // Send a load request with incorrect password
        sendTextFrame(socket, "load url=" + documentURL);

        const auto response = getResponseString(socket, "error:", testname);
        Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(3), tokens.count());

        std::string errorCommand;
        std::string errorKind;
        LOOLProtocol::getTokenString(tokens[1], "cmd", errorCommand);
        LOOLProtocol::getTokenString(tokens[2], "kind", errorKind);
        CPPUNIT_ASSERT_EQUAL(std::string("load"), errorCommand);
        CPPUNIT_ASSERT_EQUAL(std::string("faileddocloading"), errorKind);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSError::testMaxDocuments()
{
    static_assert(MAX_DOCUMENTS >= 2, "MAX_DOCUMENTS must be at least 2");
    const auto testname = "maxDocuments ";

    if (MAX_DOCUMENTS > 20)
    {
        std::cerr << "Skipping " << testname << "test since MAX_DOCUMENTS (" << MAX_DOCUMENTS
                  << ") is too high to test. Set to a more sensible number, ideally a dozen or so." << std::endl;
        return;
    }

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
        getDocumentPathAndURL("empty.odt", docPath, docURL, testname);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
        std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(_uri));
        auto socket = std::make_shared<LOOLWebSocket>(*session, request, _response);

        // Send load request, which will fail.
        sendTextFrame(socket, "load url=" + docURL, testname);

        assertResponseString(socket, "error:", testname);

        std::string message;
        const auto statusCode = getErrorCode(socket, message, testname);
        CPPUNIT_ASSERT_EQUAL(static_cast<int>(Poco::Net::WebSocket::WS_POLICY_VIOLATION), statusCode);

        socket->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSError::testMaxConnections()
{
    static_assert(MAX_CONNECTIONS >= 3, "MAX_CONNECTIONS must be at least 3");
    const auto testname = "maxConnections ";

    if (MAX_CONNECTIONS > 40)
    {
        std::cerr << "Skipping " << testname << "test since MAX_CONNECTION (" << MAX_CONNECTIONS
                  << ") is too high to test. Set to a more sensible number, ideally a dozen or so." << std::endl;
        return;
    }

    try
    {
        std::cerr << "Opening max number of connections: " << MAX_CONNECTIONS << std::endl;

        // Load a document.
        std::string docPath;
        std::string docURL;

        getDocumentPathAndURL("empty.odt", docPath, docURL, testname);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
        auto socket = loadDocAndGetSocket(_uri, docURL, testname);
        std::cerr << "Opened connection #1 of " << MAX_CONNECTIONS << std::endl;

        std::vector<std::shared_ptr<LOOLWebSocket>> views;
        for (int it = 1; it < MAX_CONNECTIONS; ++it)
        {
            std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(_uri));
            auto ws = std::make_shared<LOOLWebSocket>(*session, request, _response);
            views.emplace_back(ws);
            std::cerr << "Opened connection #" << (it+1) << " of " << MAX_CONNECTIONS << std::endl;
        }

        std::cerr << "Opening one more connection beyond the limit." << std::endl;

        // try to connect MAX_CONNECTIONS + 1
        std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(_uri));
        auto socketN = std::make_shared<LOOLWebSocket>(*session, request, _response);

        // Send load request, which will fail.
        sendTextFrame(socketN, "load url=" + docURL, testname);

        std::string message;
        const auto statusCode = getErrorCode(socketN, message, testname);
        CPPUNIT_ASSERT_EQUAL(static_cast<int>(Poco::Net::WebSocket::WS_POLICY_VIOLATION), statusCode);

        socketN->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSError::testMaxViews()
{
    static_assert(MAX_CONNECTIONS >= 3, "MAX_CONNECTIONS must be at least 3");
    const auto testname = "maxViews ";

    if (MAX_CONNECTIONS > 40)
    {
        std::cerr << "Skipping " << testname << "test since MAX_CONNECTION (" << MAX_CONNECTIONS
                  << ") is too high to test. Set to a more sensible number, ideally a dozen or so." << std::endl;
        return;
    }

    try
    {
        std::cerr << "Opening max number of views: " << MAX_CONNECTIONS << std::endl;

        // Load a document.
        std::string docPath;
        std::string docURL;

        getDocumentPathAndURL("empty.odt", docPath, docURL, testname);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
        auto socket = loadDocAndGetSocket(_uri, docURL, testname);
        std::cerr << "Opened view #1 of " << MAX_CONNECTIONS << std::endl;

        std::vector<std::shared_ptr<LOOLWebSocket>> views;
        for (int it = 1; it < MAX_CONNECTIONS; ++it)
        {
            views.emplace_back(loadDocAndGetSocket(_uri, docURL, testname));
            std::cerr << "Opened view #" << (it+1) << " of " << MAX_CONNECTIONS << std::endl;
        }

        std::cerr << "Opening one more connection beyond the limit." << std::endl;

        // try to connect MAX_CONNECTIONS + 1
        std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(_uri));
        auto socketN = std::make_shared<LOOLWebSocket>(*session, request, _response);

        // Send load request, which will fail.
        sendTextFrame(socketN, "load url=" + docURL, testname);

        std::string message;
        const auto statusCode = getErrorCode(socketN, message, testname);
        CPPUNIT_ASSERT_EQUAL(static_cast<int>(Poco::Net::WebSocket::WS_POLICY_VIOLATION), statusCode);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPWSError);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
