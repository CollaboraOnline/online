/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <algorithm>
#include <condition_variable>
#include <mutex>
#include <thread>
#include <regex>

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

#include "helpers.hpp"
#include "countloolkits.hpp"

using namespace helpers;

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
    CPPUNIT_TEST(testEditLock);
    CPPUNIT_TEST(testClientPartImpress);
    CPPUNIT_TEST(testClientPartCalc);
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
    void testClientPartImpress();
    void testClientPartCalc();
    void testSimultaneousTilesRenderedJustOnce();
    void testNoExtraLoolKitsLeft();
    void testEditLock();

    void loadDoc(const std::string& documentURL);

    void checkTiles(Poco::Net::WebSocket& socket,
                    const std::string& type);

    void requestTiles(Poco::Net::WebSocket& socket,
                      const int part,
                      const int docWidth,
                      const int docHeight);

    void getTileMessage(Poco::Net::WebSocket& ws,
                        std::string& tile);

    void getPartHashCodes(const std::string response,
                          std::vector<std::string>& parts);

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
        testNoExtraLoolKitsLeft();
    }
};

int HTTPWSTest::_initialLoolKitCount = 0;

void HTTPWSTest::testCountHowManyLoolkits()
{
    _initialLoolKitCount = getLoolKitProcessCount();
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
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL);

        Poco::Net::HTTPResponse response;
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
#if ENABLE_SSL
        Poco::Net::HTTPSClientSession session(_uri.getHost(), _uri.getPort());
#else
        Poco::Net::HTTPClientSession session(_uri.getHost(), _uri.getPort());
#endif
        Poco::Net::WebSocket socket(session, request, response);

        const char* fail = "error:";
        std::string payload("statusindicator: find");

        std::string receive;
        socket.setReceiveTimeout(0);
        bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
        CPPUNIT_ASSERT_EQUAL(std::string(payload), std::string(buffer, bytes));
        CPPUNIT_ASSERT(flags == Poco::Net::WebSocket::FRAME_TEXT);

        bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
        if (!std::strstr(buffer, fail))
        {
            payload = "statusindicator: connect";
            CPPUNIT_ASSERT_EQUAL(payload, std::string(buffer, bytes));
            CPPUNIT_ASSERT(flags == Poco::Net::WebSocket::FRAME_TEXT);

            bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
            if (!std::strstr(buffer, fail))
            {
                payload = "statusindicator: ready";
                CPPUNIT_ASSERT_EQUAL(payload, std::string(buffer, bytes));
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
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

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
        std::cout << "Received " << bytes << " bytes, flags: "<< std::hex << flags << std::dec << std::endl;
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
        auto socket = loadDocAndGetSocket(_uri, documentURL);

        SocketProcessor("", socket, [&](const std::string& msg)
                {
                    const std::string prefix = "status: ";
                    if (msg.find(prefix) == 0)
                    {
                        const auto status = msg.substr(prefix.length());
                        // Might be too strict, consider something flexible instread.
                        CPPUNIT_ASSERT_EQUAL(std::string("type=text parts=1 current=0 width=12808 height=16408"), status);
                    }
                    else if (msg.find("editlock") == 0)
                    {
                        // First session always gets the lock.
                        CPPUNIT_ASSERT_EQUAL(std::string("editlock: 1"), msg);
                        return false;
                    }

                    return true;
                });

        socket->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testLoad()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL);
    loadDoc(documentURL);
    Util::removeFile(documentPath);
}

void HTTPWSTest::testBadLoad()
{
    try
    {
        // Load a document and get its status.
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

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
    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL);
    for (auto i = 0; i < 3; ++i)
    {
        loadDoc(documentURL);
    }

    Util::removeFile(documentPath);
}

void HTTPWSTest::testSaveOnDisconnect()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL);

    try
    {
        // Load a document and get its status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        sendTextFrame(socket, "uno .uno:SelectAll");
        sendTextFrame(socket, "uno .uno:Delete");
        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc");

        std::cerr << "Closing connection after pasting." << std::endl;

        // Shutdown abruptly.
        socket.shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }

    // Allow time to save and destroy before we connect again.
    sleep(5);
    std::cerr << "Loading again." << std::endl;
    try
    {
        // Load the same document and check that the last changes (pasted text) is saved.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

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
    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL);

    int kitcount = -1;
    try
    {
        // Load a document and get its status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        sendTextFrame(socket, "uno .uno:SelectAll");
        sendTextFrame(socket, "uno .uno:Delete");
        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc");

        kitcount = getLoolKitProcessCount();

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
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        sendTextFrame(socket, "status");
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        // Should have no new instances.
        CPPUNIT_ASSERT_EQUAL(kitcount, getLoolKitProcessCount());

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
        std::string documentPath, documentURL;
        getDocumentPathAndURL("timeline.xlsx", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

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
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

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
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

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
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hide-whitespace.odt", documentPath, documentURL);

        const std::string options = "{\"rendering\":{\".uno:HideWhitespace\":{\"type\":\"boolean\",\"value\":\"true\"}}}";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

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
        std::string documentPath, documentURL;
        getDocumentPathAndURL("password-protected.ods", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

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
        std::string documentPath, documentURL;
        getDocumentPathAndURL("password-protected.ods", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

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
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

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
        std::string documentPath, documentURL;
        getDocumentPathAndURL("insert-delete.odp", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

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
            getPartHashCodes(response, parts);
            CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
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

                getPartHashCodes(response, parts);
                CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
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

                getPartHashCodes(response, parts);
                CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
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

                getPartHashCodes(response, parts);
                CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
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

                getPartHashCodes(response, parts);
                CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
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

            getPartHashCodes(response, parts);
            CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
        }

        socket.shutdown();
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testClientPartImpress()
{
    try
    {
        // Load a document
        std::string documentPath, documentURL;
        getDocumentPathAndURL("setclientpart.odp", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        checkTiles(socket, "presentation");

        socket.shutdown();
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testClientPartCalc()
{
    try
    {
        // Load a document
        std::string documentPath, documentURL;
        getDocumentPathAndURL("setclientpart.ods", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        checkTiles(socket, "spreadsheet");

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
    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL);

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
    Poco::Net::WebSocket socket1 = *connectLOKit(_uri, request, _response);
    sendTextFrame(socket1, "load url=" + documentURL);

    Poco::Net::WebSocket socket2 = *connectLOKit(_uri, request, _response);
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

void HTTPWSTest::testEditLock()
{
    const std::string documentPath = Util::getTempFilePath(TDOC, "hello.odt");
    const std::string documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

    std::mutex mutex;
    std::condition_variable cv;
    volatile bool second_client_died = false;

    // The first client loads the document and checks that it has the lock.
    // It then waits until the lock is taken away.
    std::thread first_client([&]()
        {
            try
            {
                std::cerr << "First client loading." << std::endl;
                auto socket = loadDocAndGetSocket(_uri, documentURL);
                std::string editlock1;
                SocketProcessor("First", socket, [&](const std::string& msg)
                        {
                            if (msg.find("editlock") == 0)
                            {
                                if (editlock1.empty())
                                {
                                    std::cerr << "First client has the lock." << std::endl;
                                    CPPUNIT_ASSERT_EQUAL(std::string("editlock: 1"), msg);
                                    editlock1 = msg;

                                    // Initial condition met, connect second client.
                                    std::cerr << "Starting second client." << std::endl;
                                    cv.notify_one();
                                }
                                else if (editlock1 == "editlock: 1")
                                {
                                    if (second_client_died)
                                    {
                                        // We had lost the lock to the second client,
                                        // but we should get it back once they die.
                                        std::cerr << "First client is given the lock." << std::endl;
                                        CPPUNIT_ASSERT_EQUAL(std::string("editlock: 1"), msg);
                                        return false; // Done!
                                    }
                                    else
                                    {
                                        // Normal broadcast when the second client joins.
                                        std::cerr << "First client still has the lock." << std::endl;
                                    }
                                }
                                else
                                {
                                    // Another client took the lock.
                                    std::cerr << "First client lost the lock." << std::endl;
                                    CPPUNIT_ASSERT_EQUAL(std::string("editlock: 0"), msg);
                                }
                            }

                            return true;
                        });

                std::cerr << "First client out." << std::endl;
                socket->shutdown();
            }
            catch (const Poco::Exception& exc)
            {
                CPPUNIT_FAIL(exc.displayText());
            }
        });

    std::unique_lock<std::mutex> lock(mutex);
    cv.wait(lock);

    // The second client loads the document and checks that it has no lock.
    // It then takes the lock and breaks when it gets it.
    try
    {
        std::cerr << "Second client loading." << std::endl;
        auto socket = loadDocAndGetSocket(_uri, documentURL);
        std::string editlock1;
        SocketProcessor("Second", socket, [&](const std::string& msg)
                {
                    if (msg.find("editlock") == 0)
                    {
                        if (editlock1.empty())
                        {
                            // We shouldn't have it.
                            std::cerr << "Second client doesn't have the lock." << std::endl;
                            CPPUNIT_ASSERT_EQUAL(std::string("editlock: 0"), msg);
                            editlock1 = msg;

                            // But we will take it.
                            std::cerr << "Second client taking lock." << std::endl;
                            sendTextFrame(*socket, "takeedit");
                        }
                        else
                        {
                            // Now it should be ours.
                            std::cerr << "Second client took the lock." << std::endl;
                            CPPUNIT_ASSERT_EQUAL(std::string("editlock: 1"), msg);
                            return false;
                        }
                    }

                    return true;
                });

        std::cerr << "Second client out." << std::endl;
        socket->shutdown();
        second_client_died = true;

        first_client.join();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testNoExtraLoolKitsLeft()
{
    const auto countNow = countLoolKitProcesses(_initialLoolKitCount);

    CPPUNIT_ASSERT_EQUAL(_initialLoolKitCount, countNow);
}

void HTTPWSTest::checkTiles(Poco::Net::WebSocket& socket, const std::string& docType)
{
    const std::string current = "current=";
    const std::string height = "height=";
    const std::string parts = "parts=";
    const std::string type = "type=";
    const std::string width = "width=";

    int currentPart = -1;
    int totalParts = 0;
    int docHeight = 0;
    int docWidth = 0;

    std::string response;
    std::string text;

    // check total slides 10
    getResponseMessage(socket, "status:", response, false);
    CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
    {
        std::cout << "status: " << response << std::endl;
        Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(5), tokens.count());

        // Expected format is something like 'type= parts= current= width= height='.
        text = tokens[0].substr(type.size());
        totalParts = std::stoi(tokens[1].substr(parts.size()));
        currentPart = std::stoi(tokens[2].substr(current.size()));
        docWidth = std::stoi(tokens[3].substr(width.size()));
        docHeight = std::stoi(tokens[4].substr(height.size()));
        CPPUNIT_ASSERT_EQUAL(docType, text);
        CPPUNIT_ASSERT_EQUAL(10, totalParts);
        CPPUNIT_ASSERT(currentPart > -1);
        CPPUNIT_ASSERT(docWidth > 0);
        CPPUNIT_ASSERT(docHeight > 0);
    }

    if (docType == "presentation")
    {
        // first full invalidation
        getResponseMessage(socket, "invalidatetiles:", response, true);
        CPPUNIT_ASSERT_MESSAGE("did not receive a invalidatetiles: message as expected", !response.empty());
        {
            Poco::StringTokenizer tokens(response, ":", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
            CPPUNIT_ASSERT_EQUAL(std::string("EMPTY"), tokens[0]);
        }

        // request tiles
        requestTiles(socket, currentPart, docWidth, docHeight);
    }

    // random setclientpart
    std::srand(std::time(0));
    std::vector<int> vParts = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9};
    std::random_shuffle (vParts.begin(), vParts.end());
    for (auto it : vParts)
    {
        if (currentPart != it)
        {
            // change part
            text = Poco::format("setclientpart part=%d", it);
            std::cout << text << std::endl;
            sendTextFrame(socket, text);

            // get full invalidation
            getResponseMessage(socket, "invalidatetiles:", response, true);
            CPPUNIT_ASSERT_MESSAGE("did not receive a invalidatetiles: message as expected", !response.empty());
            {
                Poco::StringTokenizer tokens(response, ":", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
                CPPUNIT_ASSERT_EQUAL(std::string("EMPTY"), tokens[0]);
            }
            requestTiles(socket, it, docWidth, docHeight);
        }
        currentPart = it;
    }
}

void HTTPWSTest::requestTiles(Poco::Net::WebSocket& socket, const int part, const int docWidth, const int docHeight)
{
    // twips
    const int tileSize = 3840;
    // pixel
    const int pixTileSize = 256;

    int rows;
    int cols;
    int tileX;
    int tileY;
    int tileWidth;
    int tileHeight;

    std::string text;
    std::string tile;

    rows = docHeight / tileSize;
    cols = docWidth / tileSize;

    // Note: this code tests tile requests in the wrong way.

    // This code does NOT match what was the idea how the LOOL protocol should/could be used. The
    // intent was never that the protocol would need to be, or should be, used in a strict
    // request/reply fashion. If a client needs n tiles, it should just send the requests, one after
    // another. There is no need to do n roundtrips. A client should all the time be reading
    // incoming messages, and handle incoming tiles as appropriate. There should be no expectation
    // that tiles arrive at the client in the same order that they were requested.

    // But, whatever.

    for (int itRow = 0; itRow < rows; ++itRow)
    {
        for (int itCol = 0; itCol < cols; ++itCol)
        {
            tileWidth = tileSize;
            tileHeight = tileSize;
            tileX = tileSize * itCol;
            tileY = tileSize * itRow;
            text = Poco::format("tile part=%d width=%d height=%d tileposx=%d tileposy=%d tilewidth=%d tileheight=%d",
                    part, pixTileSize, pixTileSize, tileX, tileY, tileWidth, tileHeight);

            sendTextFrame(socket, text);
            getTileMessage(socket, tile);
            // expected tile: part= width= height= tileposx= tileposy= tilewidth= tileheight=
            Poco::StringTokenizer tokens(tile, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
            CPPUNIT_ASSERT_EQUAL(std::string("tile:"), tokens[0]);
            CPPUNIT_ASSERT_EQUAL(part, std::stoi(tokens[1].substr(std::string("part=").size())));
            CPPUNIT_ASSERT_EQUAL(pixTileSize, std::stoi(tokens[2].substr(std::string("width=").size())));
            CPPUNIT_ASSERT_EQUAL(pixTileSize, std::stoi(tokens[3].substr(std::string("height=").size())));
            CPPUNIT_ASSERT_EQUAL(tileX, std::stoi(tokens[4].substr(std::string("tileposx=").size())));
            CPPUNIT_ASSERT_EQUAL(tileY, std::stoi(tokens[5].substr(std::string("tileposy=").size())));
            CPPUNIT_ASSERT_EQUAL(tileWidth, std::stoi(tokens[6].substr(std::string("tileWidth=").size())));
            CPPUNIT_ASSERT_EQUAL(tileHeight, std::stoi(tokens[7].substr(std::string("tileHeight=").size())));
        }
    }
}

void HTTPWSTest::getTileMessage(Poco::Net::WebSocket& ws, std::string& tile)
{
    int flags;
    int bytes;
    int size = 0;
    int retries = 10;
    const Poco::Timespan waitTime(1000000);

    ws.setReceiveTimeout(0);
    std::cout << "==> getTileMessage\n";
    tile.clear();
    do
    {
        std::vector<char> payload(READ_BUFFER_SIZE * 100);
        if (retries > 0 && ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
        {
            bytes = ws.receiveFrame(payload.data(), payload.capacity(), flags);
            payload.resize(bytes > 0 ? bytes : 0);
            std::cout << "Got " << bytes << " bytes, flags: " << std::bitset<8>(flags) << '\n';
            if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
            {
                tile = LOOLProtocol::getFirstLine(payload.data(), bytes);
                std::cout << "message: " << tile << '\n';
                Poco::StringTokenizer tokens(tile, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
                if (tokens.count() == 2 &&
                    tokens[0] == "nextmessage:" &&
                    LOOLProtocol::getTokenInteger(tokens[1], "size", size) &&
                    size > 0)
                {
                    payload.resize(size);
                    bytes = ws.receiveFrame(payload.data(), size, flags);
                    tile = LOOLProtocol::getFirstLine(payload.data(), bytes);
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

void HTTPWSTest::getPartHashCodes(const std::string response,
                                  std::vector<std::string>& parts)
{
    Poco::RegularExpression endLine("[^\n\r]+");
    Poco::RegularExpression number("^[0-9]+$");
    Poco::RegularExpression::MatchVec matches;
    int offset = 0;

    parts.clear();
    while (endLine.match(response, offset, matches) > 0)
    {
        CPPUNIT_ASSERT_EQUAL(1, (int)matches.size());
        const auto str = response.substr(matches[0].offset, matches[0].length);
        if (number.match(str, 0) > 0)
        {
            parts.push_back(str);
        }
        offset = static_cast<int>(matches[0].offset + matches[0].length);
    }
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPWSTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
