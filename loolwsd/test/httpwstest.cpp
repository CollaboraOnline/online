/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <regex>

#include <Poco/DirectoryIterator.h>
#include <Poco/Dynamic/Var.h>
#include <Poco/FileStream.h>
#include <Poco/JSON/JSON.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/InvalidCertificateHandler.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/PrivateKeyPassphraseHandler.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/Net/Socket.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Path.h>
#include <Poco/StreamCopier.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Thread.h>
#include <Poco/URI.h>
#include <cppunit/extensions/HelperMacros.h>

#include <Common.hpp>
#include <UserMessages.hpp>
#include <Util.hpp>
#include <LOOLProtocol.hpp>

#include "countloolkits.hpp"

/// Tests the HTTP WebSocket API of loolwsd. The server has to be started manually before running this test.
class HTTPWSTest : public CPPUNIT_NS::TestFixture
{
    const Poco::URI _uri;
    Poco::Net::HTTPResponse _response;
    static int _initialLoolKitCount;

    CPPUNIT_TEST_SUITE(HTTPWSTest);

    // This should be the first test:
    CPPUNIT_TEST(testCountHowManyLoolkits);

    CPPUNIT_TEST(testBadRequest);
    CPPUNIT_TEST(testHandShake);
    CPPUNIT_TEST(testCloseAfterClose);
    CPPUNIT_TEST(testLoad);
    CPPUNIT_TEST(testBadLoad);
    CPPUNIT_TEST(testReload);
    CPPUNIT_TEST(testSaveOnDisconnect);
    CPPUNIT_TEST(testReloadWhileDisconnecting);
    CPPUNIT_TEST(testExcelLoad);
    CPPUNIT_TEST(testPaste);
    CPPUNIT_TEST(testLargePaste);
    CPPUNIT_TEST(testRenderingOptions);
    CPPUNIT_TEST(testPasswordProtectedDocumentWithoutPassword);
    CPPUNIT_TEST(testPasswordProtectedDocumentWithWrongPassword);
    CPPUNIT_TEST(testPasswordProtectedDocumentWithCorrectPassword);
    CPPUNIT_TEST(testPasswordProtectedDocumentWithCorrectPasswordAgain);
    CPPUNIT_TEST(testInsertDelete);
#if ENABLE_DEBUG
    CPPUNIT_TEST(testSimultaneousTilesRenderedJustOnce);
#endif

    // This should be the last test:
    CPPUNIT_TEST(testNoExtraLoolKitsLeft);

    CPPUNIT_TEST_SUITE_END();

    void testCountHowManyLoolkits();
    void testBadRequest();
    void testHandShake();
    void testCloseAfterClose();
    void testLoad();
    void testBadLoad();
    void testReload();
    void testSaveOnDisconnect();
    void testReloadWhileDisconnecting();
    void testExcelLoad();
    void testPaste();
    void testLargePaste();
    void testRenderingOptions();
    void testPasswordProtectedDocumentWithoutPassword();
    void testPasswordProtectedDocumentWithWrongPassword();
    void testPasswordProtectedDocumentWithCorrectPassword();
    void testPasswordProtectedDocumentWithCorrectPasswordAgain();
    void testInsertDelete();
    void testSimultaneousTilesRenderedJustOnce();
    void testNoExtraLoolKitsLeft();

    void loadDoc(const std::string& documentURL);

    static
    void sendTextFrame(Poco::Net::WebSocket& socket, const std::string& string);

    static
    bool isDocumentLoaded(Poco::Net::WebSocket& socket);

    static
    void getResponseMessage(Poco::Net::WebSocket& socket,
                            const std::string& prefix,
                            std::string& response,
                            const bool isLine);

    std::shared_ptr<Poco::Net::WebSocket>
    connectLOKit(Poco::Net::HTTPRequest& request,
                 Poco::Net::HTTPResponse& response);

public:
    HTTPWSTest()
#if ENABLE_SSL
        : _uri("https://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER))
#else
        : _uri("http://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER))
#endif
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
    ~HTTPWSTest()
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

int HTTPWSTest::_initialLoolKitCount = 0;

void HTTPWSTest::testCountHowManyLoolkits()
{
    _initialLoolKitCount = countLoolKitProcesses();
    CPPUNIT_ASSERT(_initialLoolKitCount > 0);
}

void HTTPWSTest::testBadRequest()
{
    try
    {
        // Load a document and get its status.
        const std::string documentURL = "file:///fake.doc";

        Poco::Net::HTTPResponse response;
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
#if ENABLE_SSL
        Poco::Net::HTTPSClientSession session(_uri.getHost(), _uri.getPort());
#else
        Poco::Net::HTTPClientSession session(_uri.getHost(), _uri.getPort());
#endif
        // This should result in Bad Request, but results in:
        // WebSocket Exception: Missing Sec-WebSocket-Key in handshake request
        // So Service Unavailable is returned.

        request.set("Connection", "Upgrade");
        request.set("Upgrade", "websocket");
        request.set("Sec-WebSocket-Version", "13");
        request.set("Sec-WebSocket-Key", "");
        request.setChunkedTransferEncoding(false);
        session.setKeepAlive(true);
        session.sendRequest(request);
        session.receiveResponse(response);
        CPPUNIT_ASSERT(response.getStatus() == Poco::Net::HTTPResponse::HTTPResponse::HTTP_SERVICE_UNAVAILABLE);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testHandShake()
{
    try
    {
        int bytes;
        int flags;
        char buffer[1024];
        // Load a document and get its status.
        const std::string documentPath = Util::getTempFilePath(TDOC, "hello.odt");
        const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

        Poco::Net::HTTPResponse response;
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
#if ENABLE_SSL
        Poco::Net::HTTPSClientSession session(_uri.getHost(), _uri.getPort());
#else
        Poco::Net::HTTPClientSession session(_uri.getHost(), _uri.getPort());
#endif
        Poco::Net::WebSocket socket(session, request, response);

        const std::string prefixEdit = "editlock:";
        const char* fail = "error:";
        std::string payload("statusindicator: find");

        std::string receive;
        socket.setReceiveTimeout(0);
        bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
        CPPUNIT_ASSERT_EQUAL((int) payload.size(), bytes);
        CPPUNIT_ASSERT(payload.compare(0, payload.size(), buffer, 0, bytes) == 0);
        CPPUNIT_ASSERT(flags == Poco::Net::WebSocket::FRAME_TEXT);

        bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
        if (!std::strstr(buffer, fail))
        {
            // After document broker finish searching it sends editlok
            // it should be at end on handshake
            CPPUNIT_ASSERT(prefixEdit.compare(0, prefixEdit.size(), buffer, 0, prefixEdit.size()) == 0);
            CPPUNIT_ASSERT(flags == Poco::Net::WebSocket::FRAME_TEXT);

            payload = "statusindicator: connect";
            bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
            CPPUNIT_ASSERT_EQUAL((int) payload.size(), bytes);
            CPPUNIT_ASSERT(payload.compare(0, payload.size(), buffer, 0, bytes) == 0);
            CPPUNIT_ASSERT(flags == Poco::Net::WebSocket::FRAME_TEXT);

            bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
            if (!std::strstr(buffer, fail))
            {
                payload = "statusindicator: ready";
                CPPUNIT_ASSERT_EQUAL((int) payload.size(), bytes);
                CPPUNIT_ASSERT(payload.compare(0, payload.size(), buffer, 0, bytes) == 0);
                CPPUNIT_ASSERT(flags == Poco::Net::WebSocket::FRAME_TEXT);
            }
            else
            {
                // check error message
                CPPUNIT_ASSERT(std::strstr(buffer, SERVICE_UNAVALABLE_INTERNAL_ERROR) != nullptr);
                CPPUNIT_ASSERT(flags == Poco::Net::WebSocket::FRAME_TEXT);

                // close frame message
                bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
                CPPUNIT_ASSERT(std::strstr(buffer, SERVICE_UNAVALABLE_INTERNAL_ERROR) != nullptr);
                CPPUNIT_ASSERT((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) == Poco::Net::WebSocket::FRAME_OP_CLOSE);
            }
        }
        else
        {
            // check error message
            CPPUNIT_ASSERT(std::strstr(buffer, SERVICE_UNAVALABLE_INTERNAL_ERROR) != nullptr);
            CPPUNIT_ASSERT(flags == Poco::Net::WebSocket::FRAME_TEXT);

            // close frame message
            bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
            CPPUNIT_ASSERT(std::strstr(buffer, SERVICE_UNAVALABLE_INTERNAL_ERROR) != nullptr);
            CPPUNIT_ASSERT((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) == Poco::Net::WebSocket::FRAME_OP_CLOSE);
        }

        socket.shutdown();
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testCloseAfterClose()
{
    try
    {
        int bytes;
        int flags;
        char buffer[READ_BUFFER_SIZE];

        // Load a document and get its status.
        const std::string documentPath = Util::getTempFilePath(TDOC, "hello.odt");
        const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        sendTextFrame(socket, "status");
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        // send normal socket shutdown
        socket.shutdown();

        // 5 seconds timeout
        socket.setReceiveTimeout(5000000);

        // receive close frame handshake
        do
        {
            bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
        }
        while ((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);

        // no more messages is received.
        bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
        std::string received(buffer);
        std::cout << received << "received " << bytes << " flags "<< flags << std::endl;
        CPPUNIT_ASSERT_EQUAL(0, bytes);
        CPPUNIT_ASSERT_EQUAL(0, flags);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::loadDoc(const std::string& documentURL)
{
    try
    {
        // Load a document and get its status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        sendTextFrame(socket, "status");
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        std::string status;
        int flags;
        int n;
        do
        {
            char buffer[READ_BUFFER_SIZE];
            n = socket.receiveFrame(buffer, sizeof(buffer), flags);
            std::cout << "Got " << n << " bytes, flags: " << std::hex << flags << std::dec << std::endl;
            if (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
            {
                std::cout << "Received message: " << LOOLProtocol::getAbbreviatedMessage(buffer, n) << std::endl;
                const std::string line = LOOLProtocol::getFirstLine(buffer, n);
                const std::string prefix = "status: ";
                if (line.find(prefix) == 0)
                {
                    status = line.substr(prefix.length());
                    // Might be too strict, consider something flexible instread.
                    CPPUNIT_ASSERT_EQUAL(std::string("type=text parts=1 current=0 width=12808 height=16408"), status);
                    break;
                }
            }
        }
        while (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);

        socket.shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testLoad()
{
    const std::string documentPath = Util::getTempFilePath(TDOC, "hello.odt");
    const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();
    loadDoc(documentURL);
    Util::removeFile(documentPath);
}

void HTTPWSTest::testBadLoad()
{
    try
    {
        // Load a document and get its status.
        const std::string documentPath = Util::getTempFilePath(TDOC, "hello.odt");
        const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        // Before loading request status.
        sendTextFrame(socket, "status");

        int flags;
        int n;
        do
        {
            char buffer[READ_BUFFER_SIZE];
            n = socket.receiveFrame(buffer, sizeof(buffer), flags);
            std::cout << "Got " << n << " bytes, flags: " << std::hex << flags << std::dec << std::endl;
            if (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
            {
                std::cout << "Received message: " << LOOLProtocol::getAbbreviatedMessage(buffer, n) << std::endl;
                const std::string line = LOOLProtocol::getFirstLine(buffer, n);

                // For some reason the server claims a client has the 'edit lock' even if no
                // document has been successfully loaded
                if (LOOLProtocol::getFirstToken(buffer, n) == "editlock:" ||
                    LOOLProtocol::getFirstToken(buffer, n) == "statusindicator:")
                    continue;

                CPPUNIT_ASSERT_EQUAL(std::string("error: cmd=status kind=nodocloaded"), line);
                break;
            }
        }
        while (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);

        socket.shutdown();
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testReload()
{
    const std::string documentPath = Util::getTempFilePath(TDOC, "hello.odt");
    const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();
    for (auto i = 0; i < 3; ++i)
    {
        loadDoc(documentURL);
    }

    Util::removeFile(documentPath);
}

void HTTPWSTest::testSaveOnDisconnect()
{
    const std::string documentPath = Util::getTempFilePath(TDOC, "hello.odt");
    const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

    try
    {
        // Load a document and get its status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        sendTextFrame(socket, "uno .uno:SelectAll");
        sendTextFrame(socket, "uno .uno:Delete");
        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc");

        // Shutdown abruptly.
        socket.shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }

    // Allow time to save and destroy before we connect again.
    sleep(5);
    std::cout << "Loading again." << std::endl;
    try
    {
        // Load the same document and check that the last changes (pasted text) is saved.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        sendTextFrame(socket, "status");
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        // Check if the document contains the pasted text.
        sendTextFrame(socket, "uno .uno:SelectAll");
        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8");
        std::string selection;
        int flags;
        int n;
        do
        {
            char buffer[READ_BUFFER_SIZE];
            n = socket.receiveFrame(buffer, sizeof(buffer), flags);
            std::cout << "Got " << n << " bytes, flags: " << std::hex << flags << std::dec << '\n';
            if (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
            {
                std::cout << "Received message: " << LOOLProtocol::getAbbreviatedMessage(buffer, n) << '\n';
                const std::string line = LOOLProtocol::getFirstLine(buffer, n);
                const std::string prefix = "textselectioncontent: ";
                if (line.find(prefix) == 0)
                {
                    selection = line.substr(prefix.length());
                    break;
                }
            }
        }
        while (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
        socket.shutdown();
        Util::removeFile(documentPath);
        CPPUNIT_ASSERT_EQUAL(std::string("aaa bbb ccc"), selection);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testReloadWhileDisconnecting()
{
    const std::string documentPath = Util::getTempFilePath(TDOC, "hello.odt");
    const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

    int kitcount = -1;
    try
    {
        // Load a document and get its status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        sendTextFrame(socket, "uno .uno:SelectAll");
        sendTextFrame(socket, "uno .uno:Delete");
        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc");

        kitcount = countLoolKitProcesses();

        // Shutdown abruptly.
        socket.shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }

    std::cout << "Loading again." << std::endl;
    try
    {
        // Load the same document and check that the last changes (pasted text) is saved.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        sendTextFrame(socket, "status");
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        // Should have no new instances.
        CPPUNIT_ASSERT_EQUAL(kitcount, countLoolKitProcesses());

        // Check if the document contains the pasted text.
        sendTextFrame(socket, "uno .uno:SelectAll");
        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8");
        std::string selection;
        int flags;
        int n;
        do
        {
            char buffer[READ_BUFFER_SIZE];
            n = socket.receiveFrame(buffer, sizeof(buffer), flags);
            std::cout << "Got " << n << " bytes, flags: " << std::hex << flags << std::dec << '\n';
            if (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
            {
                std::cout << "Received message: " << LOOLProtocol::getAbbreviatedMessage(buffer, n) << '\n';
                const std::string line = LOOLProtocol::getFirstLine(buffer, n);
                if (line.find("editlock: ") == 0)
                {
                    // We must have the editlock, otherwise we aren't alone.
                    CPPUNIT_ASSERT_EQUAL(std::string("editlock: 1"), line);
                }

                const std::string prefix = "textselectioncontent: ";
                if (line.find(prefix) == 0)
                {
                    selection = line.substr(prefix.length());
                    break;
                }
            }
        }
        while (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
        socket.shutdown();
        Util::removeFile(documentPath);
        CPPUNIT_ASSERT_EQUAL(std::string("aaa bbb ccc"), selection);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testExcelLoad()
{
    try
    {
        // Load a document and make it empty.
        const std::string documentPath = Util::getTempFilePath(TDOC, "timeline.xlsx");
        const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        sendTextFrame(socket, "status");
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        std::string status;
        int flags;
        int n;
        do
        {
            char buffer[READ_BUFFER_SIZE];
            n = socket.receiveFrame(buffer, sizeof(buffer), flags);
            std::cout << "Got " << n << " bytes, flags: " << std::hex << flags << std::dec << '\n';
            if (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
            {
                std::cout << "Received message: " << LOOLProtocol::getAbbreviatedMessage(buffer, n) << '\n';
                const std::string line = LOOLProtocol::getFirstLine(buffer, n);
                std::string prefix = "status: ";
                if (line.find(prefix) == 0)
                {
                    status = line.substr(prefix.length());
                    break;
                }
            }
        }
        while (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
        socket.shutdown();
        Util::removeFile(documentPath);
        // Expected format is something like 'type=text parts=2 current=0 width=12808 height=1142'.
        Poco::StringTokenizer tokens(status, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(5), tokens.count());
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testPaste()
{
    try
    {
        // Load a document and make it empty, then paste some text into it.
        const std::string documentPath = Util::getTempFilePath(TDOC, "hello.odt");
        const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        sendTextFrame(socket, "status");
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        sendTextFrame(socket, "uno .uno:SelectAll");
        sendTextFrame(socket, "uno .uno:Delete");

        // Paste some text into it.
        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc");

        // Check if the document contains the pasted text.
        sendTextFrame(socket, "uno .uno:SelectAll");
        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8");
        std::string selection;
        int flags;
        int n;
        do
        {
            char buffer[READ_BUFFER_SIZE];
            n = socket.receiveFrame(buffer, sizeof(buffer), flags);
            std::cout << "Got " << n << " bytes, flags: " << std::hex << flags << std::dec << '\n';
            if (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
            {
                std::cout << "Received message: " << LOOLProtocol::getAbbreviatedMessage(buffer, n) << '\n';
                const std::string line = LOOLProtocol::getFirstLine(buffer, n);
                const std::string prefix = "textselectioncontent: ";
                if (line.find(prefix) == 0)
                {
                    selection = line.substr(prefix.length());
                    break;
                }
            }
        }
        while (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
        socket.shutdown();
        CPPUNIT_ASSERT_EQUAL(std::string("aaa bbb ccc"), selection);
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testLargePaste()
{
    try
    {
        // Load a document and make it empty.
        const std::string documentPath = Util::getTempFilePath(TDOC, "hello.odt");
        const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        sendTextFrame(socket, "status");
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        sendTextFrame(socket, "uno .uno:SelectAll");
        sendTextFrame(socket, "uno .uno:Delete");

        // Paste some text into it.
        std::ifstream documentStream(documentPath);
        std::string documentContents((std::istreambuf_iterator<char>(documentStream)), std::istreambuf_iterator<char>());
        sendTextFrame(socket, "paste mimetype=text/html\n" + documentContents);

        // Check if the server is still alive.
        // This resulted first in a hang, as respose for the message never arrived, then a bit later in a Poco::TimeoutException.
        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8");
        std::string selection;
        int flags;
        int n;
        do
        {
            char buffer[READ_BUFFER_SIZE];
            n = socket.receiveFrame(buffer, sizeof(buffer), flags);
            if (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
            {
                std::cout << "Received message length " << n << ": " << LOOLProtocol::getAbbreviatedMessage(buffer, n) << '\n';
                std::string line = LOOLProtocol::getFirstLine(buffer, n);
                std::string prefix = "textselectioncontent: ";
                if (line.find(prefix) == 0)
                    break;
            }
        }
        while (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
        socket.shutdown();
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testRenderingOptions()
{
    try
    {
        // Load a document and get its size.
        const std::string documentPath = Util::getTempFilePath(TDOC, "hide-whitespace.odt");
        const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();
        const std::string options = "{\"rendering\":{\".uno:HideWhitespace\":{\"type\":\"boolean\",\"value\":\"true\"}}}";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        sendTextFrame(socket, "load url=" + documentURL + " options=" + options);
        sendTextFrame(socket, "status");

        std::string status;
        int flags;
        int n;
        do
        {
            char buffer[READ_BUFFER_SIZE];
            n = socket.receiveFrame(buffer, sizeof(buffer), flags);
            std::cout << "Got " << n << " bytes, flags: " << std::hex << flags << std::dec << '\n';
            if (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
            {
                std::cout << "Received message: " << LOOLProtocol::getAbbreviatedMessage(buffer, n) << '\n';
                std::string line = LOOLProtocol::getFirstLine(buffer, n);
                std::string prefix = "status: ";
                if (line.find(prefix) == 0)
                {
                    status = line.substr(prefix.length());
                    break;
                }
            }
        }
        while (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
        socket.shutdown();
        Util::removeFile(documentPath);

        // Expected format is something like 'type=text parts=2 current=0 width=12808 height=1142'.
        Poco::StringTokenizer tokens(status, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(5), tokens.count());

        const std::string token = tokens[4];
        const std::string prefix = "height=";
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(0), token.find(prefix));
        const int height = std::stoi(token.substr(prefix.size()));
        // HideWhitespace was ignored, this was 32532, should be around 16706.
        CPPUNIT_ASSERT(height < 20000);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testPasswordProtectedDocumentWithoutPassword()
{
    try
    {
        const std::string documentPath = Util::getTempFilePath(TDOC, "password-protected.ods");
        const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        // Send a load request without password first
        sendTextFrame(socket, "load url=" + documentURL);
        std::string response;

        getResponseMessage(socket, "error:", response, true);
        CPPUNIT_ASSERT_MESSAGE("did not receive an error: message as expected", !response.empty());
        {
            Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
            CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(2), tokens.count());

            std::string errorCommand;
            std::string errorKind;
            LOOLProtocol::getTokenString(tokens[0], "cmd", errorCommand);
            LOOLProtocol::getTokenString(tokens[1], "kind", errorKind);
            CPPUNIT_ASSERT_EQUAL(std::string("load"), errorCommand);
            CPPUNIT_ASSERT_EQUAL(std::string("passwordrequired:to-view"), errorKind);
        }
        socket.shutdown();
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testPasswordProtectedDocumentWithWrongPassword()
{
    try
    {
        const std::string documentPath = Util::getTempFilePath(TDOC, "password-protected.ods");
        const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        // Send a load request with incorrect password
        sendTextFrame(socket, "load url=" + documentURL + " password=2");

        std::string response;
        getResponseMessage(socket, "error:", response, true);
        CPPUNIT_ASSERT_MESSAGE("did not receive an error: message as expected", !response.empty());
        {
            Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
            CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(2), tokens.count());

            std::string errorCommand;
            std::string errorKind;
            LOOLProtocol::getTokenString(tokens[0], "cmd", errorCommand);
            LOOLProtocol::getTokenString(tokens[1], "kind", errorKind);
            CPPUNIT_ASSERT_EQUAL(std::string("load"), errorCommand);
            CPPUNIT_ASSERT_EQUAL(std::string("wrongpassword"), errorKind);
        }
        socket.shutdown();
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testPasswordProtectedDocumentWithCorrectPassword()
{
    try
    {
        const std::string documentPath = Util::getTempFilePath(TDOC, "password-protected.ods");
        const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        // Send a load request with correct password
        sendTextFrame(socket, "load url=" + documentURL + " password=1");

        CPPUNIT_ASSERT_MESSAGE("cannot load the document with correct password " + documentURL, isDocumentLoaded(socket));
        socket.shutdown();
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testPasswordProtectedDocumentWithCorrectPasswordAgain()
{
    testPasswordProtectedDocumentWithCorrectPassword();
}

void HTTPWSTest::testInsertDelete()
{
    try
    {
        std::vector<std::string> parts;
        std::string response;

        // Load a document
        const std::string documentPath = Util::getTempFilePath(TDOC, "insert-delete.odp");
        const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        // check total slides 1
        getResponseMessage(socket, "status:", response, false);
        CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
        {
            Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
            CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(5), tokens.count());

            // Expected format is something like 'type= parts= current= width= height='.
            const std::string prefix = "parts=";
            const int totalParts = std::stoi(tokens[1].substr(prefix.size()));
            CPPUNIT_ASSERT_EQUAL(1, totalParts);

            std::regex endLine("[^\n\r]+");
            std::regex number("^[0-9]+$");
            std::smatch match;
            for (std::sregex_iterator it = std::sregex_iterator(response.begin(), response.end(), endLine);
                 it != std::sregex_iterator(); ++it)
            {
                if (std::regex_match((*it).str(), match, number))
                {
                    parts.push_back(match.str());
                }
            }
            CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
            parts.clear();
        }

        // insert 10 slides
        for (unsigned it = 1; it <= 10; it++)
        {
            sendTextFrame(socket, "uno .uno:InsertPage");
            getResponseMessage(socket, "status:", response, false);
            CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
            {
                Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
                const std::string prefix = "parts=";
                const int totalParts = std::stoi(tokens[1].substr(prefix.size()));

                std::regex endLine("[^\n\r]+");
                std::regex number("^[0-9]+$");
                std::smatch match;
                for (std::sregex_iterator it = std::sregex_iterator(response.begin(), response.end(), endLine);
                     it != std::sregex_iterator(); ++it)
                {
                    if (std::regex_match((*it).str(), match, number))
                    {
                        parts.push_back(match.str());
                    }
                }
                CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
                parts.clear();
            }
        }

        // delete 10 slides
        for (unsigned it = 1; it <= 10; it++)
        {
            sendTextFrame(socket, "uno .uno:DeletePage");
            getResponseMessage(socket, "status:", response, false);
            CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
            {
                Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
                const std::string prefix = "parts=";
                const int totalParts = std::stoi(tokens[1].substr(prefix.size()));

                std::regex endLine("[^\n\r]+");
                std::regex number("^[0-9]+$");
                std::smatch match;
                for (std::sregex_iterator it = std::sregex_iterator(response.begin(), response.end(), endLine);
                     it != std::sregex_iterator(); ++it)
                {
                    if (std::regex_match((*it).str(), match, number))
                    {
                        parts.push_back(match.str());
                    }
                }
                CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
                parts.clear();
            }
        }

        // undo delete slides
        for (unsigned it = 1; it <= 10; it++)
        {
            sendTextFrame(socket, "uno .uno:Undo");
            getResponseMessage(socket, "status:", response, false);
            CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
            {
                Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
                const std::string prefix = "parts=";
                const int totalParts = std::stoi(tokens[1].substr(prefix.size()));

                std::regex endLine("[^\n\r]+");
                std::regex number("^[0-9]+$");
                std::smatch match;
                for (std::sregex_iterator it = std::sregex_iterator(response.begin(), response.end(), endLine);
                     it != std::sregex_iterator(); ++it)
                {
                    if (std::regex_match((*it).str(), match, number))
                    {
                        parts.push_back(match.str());
                    }
                }
                CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
                parts.clear();
            }
        }

        // redo inserted slides
        for (unsigned it = 1; it <= 10; it++)
        {
            sendTextFrame(socket, "uno .uno:Redo");
            getResponseMessage(socket, "status:", response, false);
            CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
            {
                Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
                const std::string prefix = "parts=";
                const int totalParts = std::stoi(tokens[1].substr(prefix.size()));

                std::regex endLine("[^\n\r]+");
                std::regex number("^[0-9]+$");
                std::smatch match;
                for (std::sregex_iterator it = std::sregex_iterator(response.begin(), response.end(), endLine);
                     it != std::sregex_iterator(); ++it)
                {
                    if (std::regex_match((*it).str(), match, number))
                    {
                        parts.push_back(match.str());
                    }
                }
                CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
                parts.clear();
            }
        }

        // check total slides 1
        sendTextFrame(socket, "status");
        getResponseMessage(socket, "status:", response, false);
        CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
        {
            Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
            const std::string prefix = "parts=";
            const int totalParts = std::stoi(tokens[1].substr(prefix.size()));
            CPPUNIT_ASSERT_EQUAL(1, totalParts);

            std::regex endLine("[^\n\r]+");
            std::regex number("^[0-9]+$");
            std::smatch match;
            for (std::sregex_iterator it = std::sregex_iterator(response.begin(), response.end(), endLine);
                 it != std::sregex_iterator(); ++it)
            {
                if (std::regex_match((*it).str(), match, number))
                {
                    parts.push_back(match.str());
                }
            }
            CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
            parts.clear();
        }

        socket.shutdown();
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testSimultaneousTilesRenderedJustOnce()
{
    const std::string documentPath = Util::getTempFilePath(TDOC, "hello.odt");
    const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
    Poco::Net::WebSocket socket1 = *connectLOKit(request, _response);
    sendTextFrame(socket1, "load url=" + documentURL);

    Poco::Net::WebSocket socket2 = *connectLOKit(request, _response);
    sendTextFrame(socket2, "load url=" + documentURL);

    sendTextFrame(socket1, "tile part=42 width=400 height=400 tileposx=1000 tileposy=2000 tilewidth=3000 tileheight=3000");
    sendTextFrame(socket2, "tile part=42 width=400 height=400 tileposx=1000 tileposy=2000 tilewidth=3000 tileheight=3000");

    std::string response1;
    getResponseMessage(socket1, "tile:", response1, true);
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !response1.empty());

    std::string response2;
    getResponseMessage(socket2, "tile:", response2, true);
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !response2.empty());

    if (!response1.empty() && !response2.empty())
    {
        Poco::StringTokenizer tokens1(response1, " ");
        std::string renderId1;
        LOOLProtocol::getTokenString(tokens1, "renderid", renderId1);
        Poco::StringTokenizer tokens2(response2, " ");
        std::string renderId2;
        LOOLProtocol::getTokenString(tokens2, "renderid", renderId2);

        CPPUNIT_ASSERT(renderId1 == renderId2 ||
                       (renderId1 == "cached" && renderId2 != "cached") ||
                       (renderId1 != "cached" && renderId2 == "cached"));
    }

    socket1.shutdown();
    socket2.shutdown();
}

void HTTPWSTest::testNoExtraLoolKitsLeft()
{
    int countNow = countLoolKitProcesses();

    CPPUNIT_ASSERT_EQUAL(_initialLoolKitCount, countNow);
}

void HTTPWSTest::sendTextFrame(Poco::Net::WebSocket& socket, const std::string& string)
{
    socket.sendFrame(string.data(), string.size());
}

bool HTTPWSTest::isDocumentLoaded(Poco::Net::WebSocket& ws)
{
    bool isLoaded = false;
    try
    {
        int flags;
        int bytes;
        int retries = 30;
        const Poco::Timespan waitTime(1000000);

        ws.setReceiveTimeout(0);
        std::cout << "==> isDocumentLoaded\n";
        do
        {
            char buffer[READ_BUFFER_SIZE];

            if (ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                bytes = ws.receiveFrame(buffer, sizeof(buffer), flags);
                std::cout << "Got " << bytes << " bytes, flags: " << std::hex << flags << std::dec << '\n';
                if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    std::cout << "Received message: " << LOOLProtocol::getAbbreviatedMessage(buffer, bytes) << '\n';
                    const std::string line = LOOLProtocol::getFirstLine(buffer, bytes);
                    const std::string prefixIndicator = "statusindicatorfinish:";
                    const std::string prefixStatus = "status:";
                    if (line.find(prefixIndicator) == 0 || line.find(prefixStatus) == 0)
                    {
                        isLoaded = true;
                        break;
                    }
                }
                retries = 10;
            }
            else
            {
                std::cout << "Timeout\n";
                --retries;
            }
        }
        while (retries > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    }
    catch (const Poco::Net::WebSocketException& exc)
    {
        std::cout << exc.message();
    }

    return isLoaded;
}

void HTTPWSTest::getResponseMessage(Poco::Net::WebSocket& ws, const std::string& prefix, std::string& response, const bool isLine)
{
    try
    {
        int flags;
        int bytes;
        int retries = 20;
        const Poco::Timespan waitTime(1000000);

        response.clear();
        ws.setReceiveTimeout(0);
        std::cout << "==> getResponseMessage(" << prefix << ")\n";
        do
        {
            char buffer[READ_BUFFER_SIZE];

            if (ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                bytes = ws.receiveFrame(buffer, sizeof(buffer), flags);
                std::cout << "Got " << bytes << " bytes, flags: " << std::hex << flags << std::dec << '\n';
                if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    std::cout << "Received message: " << LOOLProtocol::getAbbreviatedMessage(buffer, bytes) << '\n';
                    const std::string message = isLine ?
                                                LOOLProtocol::getFirstLine(buffer, bytes) :
                                                std::string(buffer, bytes);

                    if (message.find(prefix) == 0)
                    {
                        response = message.substr(prefix.length());
                        break;
                    }
                }
                retries = 10;
            }
            else
            {
                std::cout << "Timeout\n";
                --retries;
            }
        }
        while (retries > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    }
    catch (const Poco::Net::WebSocketException& exc)
    {
        std::cout << exc.message();
    }
}

int countLoolKitProcesses()
{
    // Give polls in the lool processes time to time out etc
    Poco::Thread::sleep(POLL_TIMEOUT_MS*5);

    int result = 0;

    for (auto i = Poco::DirectoryIterator(std::string("/proc")); i != Poco::DirectoryIterator(); ++i)
    {
        try
        {
            Poco::Path procEntry = i.path();
            const std::string& fileName = procEntry.getFileName();
            int pid;
            std::size_t endPos = 0;
            try
            {
                pid = std::stoi(fileName, &endPos);
            }
            catch (const std::invalid_argument&)
            {
                pid = 0;
            }
            if (pid > 1 && endPos == fileName.length())
            {
                Poco::FileInputStream stat(procEntry.toString() + "/stat");
                std::string statString;
                Poco::StreamCopier::copyToString(stat, statString);
                Poco::StringTokenizer tokens(statString, " ");
                if (tokens.count() > 3 && tokens[1] == "(loolkit)")
                {
                    switch (tokens[2].c_str()[0])
                    {
                    case 'x':
                    case 'X': // Kinds of dead-ness.
                    case 'Z': // zombies
                        break; // ignore
                    default:
                        result++;
                        break;
                    }
                    // std::cout << "Process:" << pid << ", '" << tokens[1] << "'" << " state: " << tokens[2] << std::endl;
                }
            }
        }
        catch (const Poco::Exception&)
        {
        }
    }

    // std::cout << "Number of loolkit processes: " << result << std::endl;
    return result;
}

// Connecting to a Kit process is managed by document broker, that it does several
// jobs to establish the bridge connection between the Client and Kit process,
// The result, it is mostly time outs to get messages in the unit test and it could fail.
// connectLOKit ensures the websocket is connected to a kit process.

std::shared_ptr<Poco::Net::WebSocket>
HTTPWSTest::connectLOKit(Poco::Net::HTTPRequest& request,
                         Poco::Net::HTTPResponse& response)
{
    int flags;
    int received = 0;
    int retries = 3;
    bool ready = false;
    char buffer[READ_BUFFER_SIZE];
    const std::string success("ready");
    std::shared_ptr<Poco::Net::WebSocket> ws;

    do
    {
#if ENABLE_SSL
        Poco::Net::HTTPSClientSession session(_uri.getHost(), _uri.getPort());
#else
        Poco::Net::HTTPClientSession session(_uri.getHost(), _uri.getPort());
#endif
        ws = std::make_shared<Poco::Net::WebSocket>(session, request, response);

        do
        {
            try
            {
                received = ws->receiveFrame(buffer, sizeof(buffer), flags);
                if (received > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    const std::string message = LOOLProtocol::getFirstLine(buffer, received);
                    std::cerr << message << std::endl;
                    if (message.find(success) != std::string::npos)
                    {
                        ready = true;
                        break;
                    }
                }
            }
            catch (const Poco::TimeoutException& exc)
            {
                std::cout << exc.displayText();
            }
            catch(...)
            {
                throw;
            }
        }
        while (received > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    }
    while (retries-- && !ready);

    if (!ready)
        throw Poco::Net::WebSocketException("Failed to connect to lokit process", Poco::Net::WebSocket::WS_ENDPOINT_GOING_AWAY);

    return ws;
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPWSTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
