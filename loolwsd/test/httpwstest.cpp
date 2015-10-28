/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/URI.h>
#include <cppunit/extensions/HelperMacros.h>

#include <LOOLProtocol.hpp>
#include <LOOLWSD.hpp>

/// Tests the HTTP WebSocket API of loolwsd. The server has to be started manually before running this test.
class HTTPWSTest : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HTTPWSTest);
    CPPUNIT_TEST(testPaste);
    CPPUNIT_TEST_SUITE_END();

    void testPaste();

    void sendTextFrame(Poco::Net::WebSocket& socket, const std::string& string);
};

void HTTPWSTest::testPaste()
{
    // Load a document and make it empty.
    Poco::URI uri("http://127.0.0.1:" + std::to_string(LOOLWSD::DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/ws");
    Poco::Net::HTTPResponse response;
    Poco::Net::WebSocket socket(session, request, response);
    std::string documentPath = TDOC "/hello.odt";
    std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();
    sendTextFrame(socket, "load url=" + documentURL);
    sendTextFrame(socket, "uno .uno:SelectAll");
    sendTextFrame(socket, "uno .uno:Delete");

    // Paste some text into it.
    sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8 data=aaa bbb ccc");

    // Check if the document contains the pasted text.
    sendTextFrame(socket, "uno .uno:SelectAll");
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8");
    std::string selection;
    int flags;
    int n;
    do
    {
        char buffer[100000];
        n = socket.receiveFrame(buffer, sizeof(buffer), flags);
        if (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
        {
            std::string response = LOOLProtocol::getFirstLine(buffer, n);
            std::string prefix = "textselectioncontent: ";
            if (response.find(prefix) == 0)
            {
                selection = response.substr(prefix.length());
                break;
            }
        }
    }
    while (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    socket.shutdown();
    CPPUNIT_ASSERT_EQUAL(std::string("aaa bbb ccc"), selection);
}

void HTTPWSTest::sendTextFrame(Poco::Net::WebSocket& socket, const std::string& string)
{
    socket.sendFrame(string.data(), string.size());
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPWSTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
