/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <memory>
#include <ostream>
#include <set>
#include <string>

#include <Poco/Exception.h>
#include <Poco/RegularExpression.h>
#include <Poco/URI.h>
#include <test/lokassert.hpp>

#include <Png.hpp>
#include <Unit.hpp>
#include <helpers.hpp>

// Include config.h last, so the test server URI is still HTTP, even in SSL builds.
#include <config.h>

class LOOLWebSocket;

/// Test suite for bad document loading, etc.
class UnitBadDocLoad : public UnitWSD
{
    TestResult testBadDocLoadFail();
    TestResult testMaxDocuments();
    TestResult testMaxConnections();
    TestResult testMaxViews();

public:
    void invokeWSDTest() override;
};

UnitBase::TestResult UnitBadDocLoad::testBadDocLoadFail()
{
    // Load corrupted document and validate error.
    const char* testname = "docLoadFail ";
    try
    {
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("corrupted.odt", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::URI uri(helpers::getTestServerURI());
        Poco::Net::HTTPResponse httpResponse;
        std::shared_ptr<LOOLWebSocket> socket
            = helpers::connectLOKit(uri, request, httpResponse, testname);

        // Send a load request with incorrect password
        helpers::sendTextFrame(socket, "load url=" + documentURL, testname);

        const auto response = helpers::getResponseString(socket, "error:", testname);
        StringVector tokens(Util::tokenize(response, ' '));
        LOK_ASSERT_EQUAL(static_cast<size_t>(3), tokens.size());

        std::string errorCommand;
        std::string errorKind;
        LOOLProtocol::getTokenString(tokens[1], "cmd", errorCommand);
        LOOLProtocol::getTokenString(tokens[2], "kind", errorKind);
        LOK_ASSERT_EQUAL(std::string("load"), errorCommand);
        LOK_ASSERT_EQUAL(std::string("faileddocloading"), errorKind);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitBadDocLoad::testMaxDocuments()
{
    static_assert(MAX_DOCUMENTS >= 2, "MAX_DOCUMENTS must be at least 2");
    const char* testname = "maxDocuments ";

    if (MAX_DOCUMENTS > 20)
    {
        std::cerr << "Skipping " << testname << "test since MAX_DOCUMENTS (" << MAX_DOCUMENTS
                  << ") is too high to test. Set to a more sensible number, ideally a dozen or so."
                  << std::endl;
        return TestResult::Ok;
    }

    try
    {
        // Load a document.
        std::vector<std::shared_ptr<LOOLWebSocket>> docs;

        std::cerr << "Loading max number of documents: " << MAX_DOCUMENTS << std::endl;
        for (int it = 1; it <= MAX_DOCUMENTS; ++it)
        {
            Poco::URI uri(helpers::getTestServerURI());
            docs.emplace_back(helpers::loadDocAndGetSocket("empty.odt", uri, testname));
            std::cerr << "Loaded document #" << it << " of " << MAX_DOCUMENTS << std::endl;
        }

        std::cerr << "Loading one more document beyond the limit." << std::endl;

        // try to open MAX_DOCUMENTS + 1
        std::string docPath;
        std::string docURL;
        helpers::getDocumentPathAndURL("empty.odt", docPath, docURL, testname);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
        Poco::URI uri(helpers::getTestServerURI());
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(uri));
        Poco::Net::HTTPResponse httpResponse;
        auto socket = std::make_shared<LOOLWebSocket>(*session, request, httpResponse);

        // Send load request, which will fail.
        helpers::sendTextFrame(socket, "load url=" + docURL, testname);

        helpers::assertResponseString(socket, "error:", testname);

        std::string message;
        const int statusCode = helpers::getErrorCode(socket, message, testname);
        LOK_ASSERT_EQUAL(static_cast<int>(Poco::Net::WebSocket::WS_POLICY_VIOLATION),
                             statusCode);

        socket->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitBadDocLoad::testMaxConnections()
{
    static_assert(MAX_CONNECTIONS >= 3, "MAX_CONNECTIONS must be at least 3");
    const char* testname = "maxConnections ";

    if (MAX_CONNECTIONS > 40)
    {
        std::cerr << "Skipping " << testname << "test since MAX_CONNECTION (" << MAX_CONNECTIONS
                  << ") is too high to test. Set to a more sensible number, ideally a dozen or so."
                  << std::endl;
        return TestResult::Ok;
    }

    try
    {
        std::cerr << "Opening max number of connections: " << MAX_CONNECTIONS << std::endl;

        // Load a document.
        std::string docPath;
        std::string docURL;

        helpers::getDocumentPathAndURL("empty.odt", docPath, docURL, testname);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
        Poco::URI uri(helpers::getTestServerURI());
        std::shared_ptr<LOOLWebSocket> socket = helpers::loadDocAndGetSocket(uri, docURL, testname);
        std::cerr << "Opened connection #1 of " << MAX_CONNECTIONS << std::endl;

        std::vector<std::shared_ptr<LOOLWebSocket>> views;
        for (int it = 1; it < MAX_CONNECTIONS; ++it)
        {
            std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(uri));
            Poco::Net::HTTPResponse httpResponse;
            auto ws = std::make_shared<LOOLWebSocket>(*session, request, httpResponse);
            views.emplace_back(ws);
            std::cerr << "Opened connection #" << (it + 1) << " of " << MAX_CONNECTIONS
                      << std::endl;
        }

        std::cerr << "Opening one more connection beyond the limit." << std::endl;

        // try to connect MAX_CONNECTIONS + 1
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(uri));
        Poco::Net::HTTPResponse httpResponse;
        auto socketN = std::make_shared<LOOLWebSocket>(*session, request, httpResponse);

        // Send load request, which will fail.
        helpers::sendTextFrame(socketN, "load url=" + docURL, testname);

        std::string message;
        const int statusCode = helpers::getErrorCode(socketN, message, testname);
        LOK_ASSERT_EQUAL(static_cast<int>(Poco::Net::WebSocket::WS_POLICY_VIOLATION),
                             statusCode);

        socketN->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitBadDocLoad::testMaxViews()
{
    static_assert(MAX_CONNECTIONS >= 3, "MAX_CONNECTIONS must be at least 3");
    const char* testname = "maxViews ";

    if (MAX_CONNECTIONS > 40)
    {
        std::cerr << "Skipping " << testname << "test since MAX_CONNECTION (" << MAX_CONNECTIONS
                  << ") is too high to test. Set to a more sensible number, ideally a dozen or so."
                  << std::endl;
        return TestResult::Ok;
    }

    try
    {
        std::cerr << "Opening max number of views: " << MAX_CONNECTIONS << std::endl;

        // Load a document.
        std::string docPath;
        std::string docURL;

        helpers::getDocumentPathAndURL("empty.odt", docPath, docURL, testname);
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
        Poco::URI uri(helpers::getTestServerURI());
        std::shared_ptr<LOOLWebSocket> socket = helpers::loadDocAndGetSocket(uri, docURL, testname);
        std::cerr << "Opened view #1 of " << MAX_CONNECTIONS << std::endl;

        std::vector<std::shared_ptr<LOOLWebSocket>> views;
        for (int it = 1; it < MAX_CONNECTIONS; ++it)
        {
            views.emplace_back(helpers::loadDocAndGetSocket(uri, docURL, testname));
            std::cerr << "Opened view #" << (it + 1) << " of " << MAX_CONNECTIONS << std::endl;
        }

        std::cerr << "Opening one more connection beyond the limit." << std::endl;

        // try to connect MAX_CONNECTIONS + 1
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(uri));
        Poco::Net::HTTPResponse httpResponse;
        auto socketN = std::make_shared<LOOLWebSocket>(*session, request, httpResponse);

        // Send load request, which will fail.
        helpers::sendTextFrame(socketN, "load url=" + docURL, testname);

        std::string message;
        const int statusCode = helpers::getErrorCode(socketN, message, testname);
        LOK_ASSERT_EQUAL(static_cast<int>(Poco::Net::WebSocket::WS_POLICY_VIOLATION),
                             statusCode);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

void UnitBadDocLoad::invokeWSDTest()
{
    UnitBase::TestResult result = testBadDocLoadFail();
    if (result != TestResult::Ok)
        exitTest(result);

// FIXME: Disabled recently - breaking the tests - should
//        check for the warning popup instead.
#if 0
    result = testMaxDocuments();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testMaxConnections();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testMaxViews();
    if (result != TestResult::Ok)
        exitTest(result);
#endif

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitBadDocLoad(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
