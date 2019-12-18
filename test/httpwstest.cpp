/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <algorithm>
#include <vector>

#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/InvalidCertificateHandler.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/RegularExpression.h>
#include <Poco/URI.h>

#include <cppunit/extensions/HelperMacros.h>

#include <Common.hpp>
#include <Protocol.hpp>
#include <LOOLWebSocket.hpp>

#include <countloolkits.hpp>
#include <helpers.hpp>

using namespace helpers;

/// Tests the HTTP WebSocket API of loolwsd. The server has to be started manually before running this test.
class HTTPWSTest : public CPPUNIT_NS::TestFixture
{
    const Poco::URI _uri;
    Poco::Net::HTTPResponse _response;

    CPPUNIT_TEST_SUITE(HTTPWSTest);

    CPPUNIT_TEST(testCloseAfterClose);
    CPPUNIT_TEST(testSaveOnDisconnect);
    CPPUNIT_TEST(testSavePassiveOnDisconnect);
    CPPUNIT_TEST(testReloadWhileDisconnecting);
    CPPUNIT_TEST(testInactiveClient);
    CPPUNIT_TEST(testFontList);
    CPPUNIT_TEST(testGraphicInvalidate);
    CPPUNIT_TEST(testAlertAllUsers);
    CPPUNIT_TEST(testViewInfoMsg);
    CPPUNIT_TEST(testUndoConflict);

    CPPUNIT_TEST_SUITE_END();

    void testCloseAfterClose();
    void testSaveOnDisconnect();
    void testSavePassiveOnDisconnect();
    void testReloadWhileDisconnecting();
    void testInactiveClient();
    void testFontList();
    void testGraphicInvalidate();
    void testAlertAllUsers();
    void testViewInfoMsg();
    void testUndoConflict();

    std::string getFontList(const std::string& message);

public:
    HTTPWSTest()
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
    ~HTTPWSTest()
    {
        Poco::Net::uninitializeSSL();
    }
#endif

    void setUp()
    {
        resetTestStartTime();
        testCountHowManyLoolkits();
        resetTestStartTime();
    }

    void tearDown()
    {
        resetTestStartTime();
        testNoExtraLoolKitsLeft();
        resetTestStartTime();
    }
};

void HTTPWSTest::testCloseAfterClose()
{
    const char* testname = "closeAfterClose ";
    try
    {
        TST_LOG("Connecting and loading.");
        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket("hello.odt", _uri, testname);

        // send normal socket shutdown
        TST_LOG("Disconnecting.");
        socket->shutdown();

        // 5 seconds timeout
        socket->setReceiveTimeout(5000000);

        // receive close frame handshake
        int bytes;
        int flags;
        char buffer[READ_BUFFER_SIZE];
        do
        {
            bytes = socket->receiveFrame(buffer, sizeof(buffer), flags);
            TST_LOG("Received [" << std::string(buffer, bytes) << "], flags: "<< std::hex << flags << std::dec);
        }
        while (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);

        TST_LOG("Received " << bytes << " bytes, flags: "<< std::hex << flags << std::dec);

        try
        {
            // no more messages is received.
            bytes = socket->receiveFrame(buffer, sizeof(buffer), flags);
            TST_LOG("Received " << bytes << " bytes, flags: "<< std::hex << flags << std::dec);
            CPPUNIT_ASSERT_EQUAL(0, bytes);
            CPPUNIT_ASSERT_EQUAL(0, flags);
        }
        catch (const Poco::Exception& exc)
        {
            // This is not unexpected, since WSD will close the socket after
            // echoing back the shutdown status code. However, if it doesn't
            // we assert above that it doesn't send any more data.
            TST_LOG("Error: " << exc.displayText());

        }
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testSaveOnDisconnect()
{
    const char* testname = "saveOnDisconnect ";

    const std::string text = helpers::genRandomString(40);
    TST_LOG("Test string: [" << text << "].");

    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    int kitcount = -1;
    try
    {
        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

        std::shared_ptr<LOOLWebSocket> socket2 = loadDocAndGetSocket(_uri, documentURL, testname);
        sendTextFrame(socket2, "userinactive");

        deleteAll(socket, testname);
        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\n" + text, testname);

        TST_LOG("Validating what we sent before disconnecting.");

        // Check if the document contains the pasted text.
        const std::string selection = getAllText(socket, testname);
        CPPUNIT_ASSERT_EQUAL("textselectioncontent: " + text, selection);

        // Closing connection too fast might not flush buffers.
        // Often nothing more than the SelectAll reaches the server before
        // the socket is closed, when the doc is not even modified yet.
        getResponseMessage(socket, "statechanged", testname);

        kitcount = getLoolKitProcessCount();

        // Shutdown abruptly.
        TST_LOG("Closing connection after pasting.");
        socket->shutdown();
        socket2->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }

    // Allow time to save and destroy before we connect again.
    testNoExtraLoolKitsLeft();
    TST_LOG("Loading again.");
    try
    {
        // Load the same document and check that the last changes (pasted text) is saved.
        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

        // Should have no new instances.
        CPPUNIT_ASSERT_EQUAL(kitcount, countLoolKitProcesses(kitcount));

        // Check if the document contains the pasted text.
        const std::string selection = getAllText(socket, testname, text);
        CPPUNIT_ASSERT_EQUAL("textselectioncontent: " + text, selection);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testSavePassiveOnDisconnect()
{
    const char* testname = "savePassiveOnDisconnect ";

    const std::string text = helpers::genRandomString(40);
    TST_LOG("Test string: [" << text << "].");

    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    int kitcount = -1;
    try
    {
        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);
        getResponseMessage(socket, "textselection", testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        std::shared_ptr<LOOLWebSocket> socket2 = connectLOKit(_uri, request, _response, testname);

        deleteAll(socket, testname);

        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\n" + text, testname);
        getResponseMessage(socket, "textselection:", testname);

        // Check if the document contains the pasted text.
        const std::string selection = getAllText(socket, testname);
        CPPUNIT_ASSERT_EQUAL("textselectioncontent: " + text, selection);

        // Closing connection too fast might not flush buffers.
        // Often nothing more than the SelectAll reaches the server before
        // the socket is closed, when the doc is not even modified yet.
        getResponseMessage(socket, "statechanged", testname);

        kitcount = getLoolKitProcessCount();

        // Shutdown abruptly.
        TST_LOG("Closing connection after pasting.");
        socket->shutdown(); // Should trigger saving.
        socket2->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }

    // Allow time to save and destroy before we connect again.
    testNoExtraLoolKitsLeft();
    TST_LOG("Loading again.");
    try
    {
        // Load the same document and check that the last changes (pasted text) is saved.
        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);
        getResponseMessage(socket, "textselection", testname);

        // Should have no new instances.
        CPPUNIT_ASSERT_EQUAL(kitcount, countLoolKitProcesses(kitcount));

        // Check if the document contains the pasted text.
        const std::string selection = getAllText(socket, testname);
        CPPUNIT_ASSERT_EQUAL("textselectioncontent: " + text, selection);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testReloadWhileDisconnecting()
{
    const char* testname = "reloadWhileDisconnecting ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

        deleteAll(socket, testname);
        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc", testname);

        // Closing connection too fast might not flush buffers.
        // Often nothing more than the SelectAll reaches the server before
        // the socket is closed, when the doc is not even modified yet.
        getResponseMessage(socket, "statechanged", testname);

        const int kitcount = getLoolKitProcessCount();

        // Shutdown abruptly.
        TST_LOG("Closing connection after pasting.");
        socket->shutdown();

        // Load the same document and check that the last changes (pasted text) is saved.
        TST_LOG("Loading again.");
        socket = loadDocAndGetSocket(_uri, documentURL, testname);

        // Should have no new instances.
        CPPUNIT_ASSERT_EQUAL(kitcount, countLoolKitProcesses(kitcount));

        // Check if the document contains the pasted text.
        const std::string expected = "aaa bbb ccc";
        const std::string selection = getAllText(socket, testname, expected);
        CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: ") + expected, selection);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testInactiveClient()
{
    const char* testname = "inactiveClient ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

        std::shared_ptr<LOOLWebSocket> socket1 = loadDocAndGetSocket(_uri, documentURL, "inactiveClient-1 ");

        // Connect another and go inactive.
        TST_LOG_NAME("inactiveClient-2 ", "Connecting second client.");
        std::shared_ptr<LOOLWebSocket> socket2 = loadDocAndGetSocket(_uri, documentURL, "inactiveClient-2 ", true);
        sendTextFrame(socket2, "userinactive", "inactiveClient-2 ");

        // While second is inactive, make some changes.
        deleteAll(socket1, "inactiveClient-1 ");

        // Activate second.
        sendTextFrame(socket2, "useractive", "inactiveClient-2 ");
        SocketProcessor("Second ", socket2, [&](const std::string& msg)
                {
                    const auto token = LOOLProtocol::getFirstToken(msg);
                    // 'window:' is e.g. 'window: {"id":"4","action":"invalidate","rectangle":"0, 0,
                    // 0, 0"}', which is probably fine, given that other invalidations are also
                    // expected.
                    CPPUNIT_ASSERT_MESSAGE("unexpected message: " + msg,
                                            token == "cursorvisible:" ||
                                            token == "graphicselection:" ||
                                            token == "graphicviewselection:" ||
                                            token == "invalidatecursor:" ||
                                            token == "invalidatetiles:" ||
                                            token == "invalidateviewcursor:" ||
                                            token == "setpart:" ||
                                            token == "statechanged:" ||
                                            token == "textselection:" ||
                                            token == "textselectionend:" ||
                                            token == "textselectionstart:" ||
                                            token == "textviewselection:" ||
                                            token == "viewcursorvisible:" ||
                                            token == "viewinfo:" ||
                                            token == "editor:" ||
                                            token == "context:" ||
                                            token == "window:" ||
                                            token == "tableselected:");

                    // End when we get state changed.
                    return (token != "statechanged:");
                });

        TST_LOG("Second client finished.");
        socket1->shutdown();
        socket2->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

std::string HTTPWSTest::getFontList(const std::string& message)
{
    Poco::JSON::Parser parser;
    const Poco::Dynamic::Var result = parser.parse(message);
    const auto& command = result.extract<Poco::JSON::Object::Ptr>();
    std::string text = command->get("commandName").toString();
    CPPUNIT_ASSERT_EQUAL(std::string(".uno:CharFontName"), text);
    text = command->get("commandValues").toString();
    return text;
}

void HTTPWSTest::testFontList()
{
    const char* testname = "fontList ";
    try
    {
        // Load a document
        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket("setclientpart.odp", _uri, testname);

        sendTextFrame(socket, "commandvalues command=.uno:CharFontName", testname);
        const std::vector<char> response = getResponseMessage(socket, "commandvalues:", testname);
        CPPUNIT_ASSERT_MESSAGE("did not receive a commandvalues: message as expected", !response.empty());

        std::stringstream streamResponse;
        std::copy(response.begin() + std::string("commandvalues:").length() + 1, response.end(), std::ostream_iterator<char>(streamResponse));
        CPPUNIT_ASSERT(!getFontList(streamResponse.str()).empty());
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testGraphicInvalidate()
{
    const char* testname = "graphicInvalidate ";
    try
    {
        // Load a document.
        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket("shape.ods", _uri, testname);

        // Send click message
        sendTextFrame(socket, "mouse type=buttondown x=1035 y=400 count=1 buttons=1 modifier=0", testname);
        sendTextFrame(socket, "mouse type=buttonup x=1035 y=400 count=1 buttons=1 modifier=0", testname);
        getResponseString(socket, "graphicselection:", testname);

        // Drag & drop graphic
        sendTextFrame(socket, "mouse type=buttondown x=1035 y=400 count=1 buttons=1 modifier=0", testname);
        sendTextFrame(socket, "mouse type=move x=1035 y=450 count=1 buttons=1 modifier=0", testname);
        sendTextFrame(socket, "mouse type=buttonup x=1035 y=450 count=1 buttons=1 modifier=0", testname);

        const auto message = getResponseString(socket, "invalidatetiles:", testname);
        CPPUNIT_ASSERT_MESSAGE("Drag & Drop graphic invalidate all tiles", message.find("EMPTY") == std::string::npos);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testAlertAllUsers()
{
    // Load two documents, each in two sessions. Tell one session to fake a disk full
    // situation. Expect to get the corresponding error back in all sessions.
    static_assert(MAX_DOCUMENTS >= 2, "MAX_DOCUMENTS must be at least 2");
    const char* testname = "alertAllUsers ";
    try
    {
        std::shared_ptr<LOOLWebSocket> socket[4];

        socket[0] = loadDocAndGetSocket("hello.odt", _uri, testname);
        socket[1] = loadDocAndGetSocket("Example.odt", _uri, testname);

        // Simulate disk full.
        sendTextFrame(socket[0], "uno .uno:fakeDiskFull", testname);

        // Assert that both clients get the error.
        for (int i = 0; i < 2; i++)
        {
            const std::string response = assertResponseString(socket[i], "error:", testname);
            std::vector<std::string> tokens(LOOLProtocol::tokenize(response.substr(6), ' '));
            std::string cmd;
            LOOLProtocol::getTokenString(tokens, "cmd", cmd);
            CPPUNIT_ASSERT_EQUAL(std::string("internal"), cmd);
            std::string kind;
            LOOLProtocol::getTokenString(tokens, "kind", kind);
            CPPUNIT_ASSERT_EQUAL(std::string("diskfull"), kind);
        }
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testViewInfoMsg()
{
    // Load 2 documents, cross-check the viewid received by each of them in their status message
    // with the one sent in viewinfo message to itself as well as to other one

    const std::string testname = "testViewInfoMsg-";
    std::string docPath;
    std::string docURL;
    getDocumentPathAndURL("hello.odt", docPath, docURL, testname);

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
    std::shared_ptr<LOOLWebSocket> socket0 = connectLOKit(_uri, request, _response, testname);
    std::shared_ptr<LOOLWebSocket> socket1 = connectLOKit(_uri, request, _response, testname);

    std::string response;
    int part, parts, width, height;
    int viewid[2];

    try
    {
        // Load first view and remember the viewid
        sendTextFrame(socket0, "load url=" + docURL);
        response = getResponseString(socket0, "status:", testname + "0 ");
        parseDocSize(response.substr(7), "text", part, parts, width, height, viewid[0]);

        // Check if viewinfo message also mentions the same viewid
        response = getResponseString(socket0, "viewinfo: ", testname + "0 ");
        Poco::JSON::Parser parser0;
        Poco::JSON::Array::Ptr array = parser0.parse(response.substr(9)).extract<Poco::JSON::Array::Ptr>();
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), array->size());

        Poco::JSON::Object::Ptr viewInfoObj0 = array->getObject(0);
        int viewid0 = viewInfoObj0->get("id").convert<int>();
        CPPUNIT_ASSERT_EQUAL(viewid[0], viewid0);

        // Load second view and remember the viewid
        sendTextFrame(socket1, "load url=" + docURL);
        response = getResponseString(socket1, "status:", testname + "1 ");
        parseDocSize(response.substr(7), "text", part, parts, width, height, viewid[1]);

        // Check if viewinfo message in this view mentions
        // viewid of both first loaded view and this view
        response = getResponseString(socket1, "viewinfo: ", testname + "1 ");
        Poco::JSON::Parser parser1;
        array = parser1.parse(response.substr(9)).extract<Poco::JSON::Array::Ptr>();
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(2), array->size());

        viewInfoObj0 = array->getObject(0);
        Poco::JSON::Object::Ptr viewInfoObj1 = array->getObject(1);
        viewid0 = viewInfoObj0->get("id").convert<int>();
        int viewid1 = viewInfoObj1->get("id").convert<int>();

        if (viewid[0] == viewid0)
            CPPUNIT_ASSERT_EQUAL(viewid[1], viewid1);
        else if (viewid[0] == viewid1)
            CPPUNIT_ASSERT_EQUAL(viewid[1], viewid0);
        else
            CPPUNIT_FAIL("Inconsistent viewid in viewinfo and status messages");

        // Check if first view also got the same viewinfo message
        const auto response1 = getResponseString(socket0, "viewinfo: ", testname + "0 ");
        CPPUNIT_ASSERT_EQUAL(response, response1);
    }
    catch(const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testUndoConflict()
{
    const std::string testname = "testUndoConflict-";
    Poco::JSON::Parser parser;
    std::string docPath;
    std::string docURL;
    int conflict;

    getDocumentPathAndURL("empty.odt", docPath, docURL, testname);

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, docURL);
    std::shared_ptr<LOOLWebSocket> socket0 = connectLOKit(_uri, request, _response, testname);
    std::shared_ptr<LOOLWebSocket> socket1 = connectLOKit(_uri, request, _response, testname);

    std::string response;
    try
    {
        // Load first view
        sendTextFrame(socket0, "load url=" + docURL, testname + "0 ");
        response = getResponseString(socket0, "invalidatecursor:", testname + "0 ");

        // Load second view
        sendTextFrame(socket1, "load url=" + docURL, testname + "1 ");
        response = getResponseString(socket1, "invalidatecursor:", testname + "1 ");

        // edit first view
        sendChar(socket0, 'A', skNone, testname + "0 ");
        response = getResponseString(socket0, "invalidateviewcursor: ", testname + "0 ");
        response = getResponseString(socket0, "invalidateviewcursor: ", testname + "0 ");

        // edit second view
        sendChar(socket1, 'B', skNone, testname + "1 ");
        response = getResponseString(socket1, "invalidateviewcursor: ", testname + "1 ");
        response = getResponseString(socket1, "invalidateviewcursor: ", testname + "1 ");

        // try to undo first view
        sendTextFrame(socket0, "uno .uno:Undo", testname + "0 ");

        // undo conflict
        response = getResponseString(socket0, "unocommandresult:", testname + "0 ");
        Poco::JSON::Object::Ptr objJSON = parser.parse(response.substr(17)).extract<Poco::JSON::Object::Ptr>();
        CPPUNIT_ASSERT_EQUAL(std::string(".uno:Undo"), objJSON->get("commandName").toString());
        CPPUNIT_ASSERT_EQUAL(std::string("true"), objJSON->get("success").toString());
        CPPUNIT_ASSERT(objJSON->has("result"));
        const Poco::Dynamic::Var parsedResultJSON = objJSON->get("result");
        const auto& resultObj = parsedResultJSON.extract<Poco::JSON::Object::Ptr>();
        CPPUNIT_ASSERT_EQUAL(std::string("long"), resultObj->get("type").toString());
        CPPUNIT_ASSERT(Poco::strToInt(resultObj->get("value").toString(), conflict, 10));
        CPPUNIT_ASSERT(conflict > 0); /*UNDO_CONFLICT*/
    }
    catch(const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPWSTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
