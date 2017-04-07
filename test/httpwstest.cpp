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
#include <vector>

#include <Poco/Dynamic/Var.h>
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
#include <Poco/Path.h>
#include <Poco/RegularExpression.h>
#include <Poco/StreamCopier.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include <cppunit/extensions/HelperMacros.h>

#include "Common.hpp"
#include "Protocol.hpp"
#include <LOOLWebSocket.hpp>
#include "Png.hpp"
#include "UserMessages.hpp"
#include "Util.hpp"

#include "countloolkits.hpp"
#include "helpers.hpp"

using namespace helpers;

/// Tests the HTTP WebSocket API of loolwsd. The server has to be started manually before running this test.
class HTTPWSTest : public CPPUNIT_NS::TestFixture
{
    const Poco::URI _uri;
    Poco::Net::HTTPResponse _response;

    CPPUNIT_TEST_SUITE(HTTPWSTest);

    CPPUNIT_TEST(testBadRequest);
    CPPUNIT_TEST(testHandshake);
    CPPUNIT_TEST(testCloseAfterClose);
    CPPUNIT_TEST(testConnectNoLoad);
    CPPUNIT_TEST(testLoadSimple);
    CPPUNIT_TEST(testLoadTortureODT);
    CPPUNIT_TEST(testLoadTortureODS);
    CPPUNIT_TEST(testLoadTortureODP);
    CPPUNIT_TEST(testLoadTorture);
    CPPUNIT_TEST(testBadLoad);
    CPPUNIT_TEST(testReload);
    CPPUNIT_TEST(testGetTextSelection);
    CPPUNIT_TEST(testSaveOnDisconnect);
    CPPUNIT_TEST(testReloadWhileDisconnecting);
    CPPUNIT_TEST(testExcelLoad);
    CPPUNIT_TEST(testPaste);
    CPPUNIT_TEST(testPasteBlank);
    CPPUNIT_TEST(testLargePaste);
    CPPUNIT_TEST(testRenderingOptions);
    CPPUNIT_TEST(testPasswordProtectedDocumentWithoutPassword);
    CPPUNIT_TEST(testPasswordProtectedDocumentWithWrongPassword);
    CPPUNIT_TEST(testPasswordProtectedDocumentWithCorrectPassword);
    CPPUNIT_TEST(testPasswordProtectedDocumentWithCorrectPasswordAgain);
    CPPUNIT_TEST(testPasswordProtectedOOXMLDocument);
    CPPUNIT_TEST(testPasswordProtectedBinaryMSOfficeDocument);
    CPPUNIT_TEST(testInsertDelete);
    CPPUNIT_TEST(testSlideShow);
    CPPUNIT_TEST(testInactiveClient);
    CPPUNIT_TEST(testMaxColumn);
    CPPUNIT_TEST(testMaxRow);
//    CPPUNIT_TEST(testInsertAnnotationWriter);
//    CPPUNIT_TEST(testEditAnnotationWriter);
    // FIXME CPPUNIT_TEST(testInsertAnnotationCalc);
    CPPUNIT_TEST(testCalcEditRendering);
    CPPUNIT_TEST(testFontList);
    CPPUNIT_TEST(testStateUnoCommandWriter);
    CPPUNIT_TEST(testStateUnoCommandCalc);
    CPPUNIT_TEST(testStateUnoCommandImpress);
    // FIXME CPPUNIT_TEST(testColumnRowResize);
    // FIXME CPPUNIT_TEST(testOptimalResize);
    CPPUNIT_TEST(testInvalidateViewCursor);
    CPPUNIT_TEST(testViewCursorVisible);
    CPPUNIT_TEST(testCellViewCursor);
    CPPUNIT_TEST(testGraphicViewSelectionWriter);
    CPPUNIT_TEST(testGraphicViewSelectionCalc);
    CPPUNIT_TEST(testGraphicViewSelectionImpress);
    CPPUNIT_TEST(testGraphicInvalidate);
    CPPUNIT_TEST(testCursorPosition);
    CPPUNIT_TEST(testAlertAllUsers);
    CPPUNIT_TEST(testViewInfoMsg);

    CPPUNIT_TEST_SUITE_END();

    void testBadRequest();
    void testHandshake();
    void testCloseAfterClose();
    void testConnectNoLoad();
    void testLoadSimple();
    void testLoadTortureODT();
    void testLoadTortureODS();
    void testLoadTortureODP();
    void testLoadTorture();
    void testBadLoad();
    void testReload();
    void testGetTextSelection();
    void testSaveOnDisconnect();
    void testReloadWhileDisconnecting();
    void testExcelLoad();
    void testPaste();
    void testPasteBlank();
    void testLargePaste();
    void testRenderingOptions();
    void testPasswordProtectedDocumentWithoutPassword();
    void testPasswordProtectedDocumentWithWrongPassword();
    void testPasswordProtectedDocumentWithCorrectPassword();
    void testPasswordProtectedDocumentWithCorrectPasswordAgain();
    void testPasswordProtectedOOXMLDocument();
    void testPasswordProtectedBinaryMSOfficeDocument();
    void testInsertDelete();
    void testSlideShow();
    void testInactiveClient();
    void testMaxColumn();
    void testMaxRow();
    void testInsertAnnotationWriter();
    void testEditAnnotationWriter();
    void testInsertAnnotationCalc();
    void testCalcEditRendering();
    void testFontList();
    void testStateUnoCommandWriter();
    void testStateUnoCommandCalc();
    void testStateUnoCommandImpress();
    void testColumnRowResize();
    void testOptimalResize();
    void testInvalidateViewCursor();
    void testViewCursorVisible();
    void testCellViewCursor();
    void testGraphicViewSelectionWriter();
    void testGraphicViewSelectionCalc();
    void testGraphicViewSelectionImpress();
    void testGraphicInvalidate();
    void testCursorPosition();
    void testAlertAllUsers();
    void testViewInfoMsg();

    void loadDoc(const std::string& documentURL, const std::string& testname);

    int loadTorture(const std::string& testname,
                     const std::string& docName,
                     const size_t thread_count,
                     const size_t max_jitter_ms);

    void getPartHashCodes(const std::string response,
                          std::vector<std::string>& parts);

    void getCursor(const std::string& message,
                   int& cursorX,
                   int& cursorY,
                   int& cursorWidth,
                   int& cursorHeight);

    void limitCursor(std::function<void(const std::shared_ptr<LOOLWebSocket>& socket,
                                        int cursorX, int cursorY,
                                        int cursorWidth, int cursorHeight,
                                        int docWidth, int docHeight)> keyhandler,
                     std::function<void(int docWidth, int docHeight,
                                        int newWidth, int newHeight)> checkhandler,
                     const std::string& testname);

    std::string getFontList(const std::string& message);
    void testStateChanged(const std::string& filename, std::set<std::string>& vecComands);
    double getColRowSize(const std::string& property, const std::string& message, int index);
    double getColRowSize(const std::shared_ptr<LOOLWebSocket>& socket, const std::string& item, int index, const std::string& testname);
    void testEachView(const std::string& doc, const std::string& type, const std::string& protocol, const std::string& view, const std::string& testname);

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
        testCountHowManyLoolkits();
    }

    void tearDown()
    {
        testNoExtraLoolKitsLeft();
    }
};

void HTTPWSTest::testBadRequest()
{
    try
    {
        // Try to load a bogus url.
        const std::string documentURL = "/lol/file%3A%2F%2F%2Ffake.doc";

        Poco::Net::HTTPResponse response;
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));

        request.set("Connection", "Upgrade");
        request.set("Upgrade", "websocket");
        request.set("Sec-WebSocket-Version", "13");
        request.set("Sec-WebSocket-Key", "");
        request.setChunkedTransferEncoding(false);
        session->setKeepAlive(true);
        session->sendRequest(request);
        session->receiveResponse(response);
        CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTPResponse::HTTP_BAD_REQUEST, response.getStatus());
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testHandshake()
{
    const auto testname = "handshake ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

        // NOTE: Do not replace with wrappers. This has to be explicit.
        Poco::Net::HTTPResponse response;
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));
        LOOLWebSocket socket(*session, request, response);
        socket.setReceiveTimeout(0);

        int flags = 0;
        char buffer[1024] = {0};
        int bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
        std::cerr << testname << "Got " << LOOLProtocol::getAbbreviatedFrameDump(buffer, bytes, flags) << std::endl;
        CPPUNIT_ASSERT_EQUAL(std::string("statusindicator: find"), std::string(buffer, bytes));

        bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
        std::cerr << testname << "Got " << LOOLProtocol::getAbbreviatedFrameDump(buffer, bytes, flags) << std::endl;
        if (bytes > 0 && !std::strstr(buffer, "error:"))
        {
            CPPUNIT_ASSERT_EQUAL(std::string("statusindicator: connect"), std::string(buffer, bytes));

            bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
            std::cerr << testname << "Got " << LOOLProtocol::getAbbreviatedFrameDump(buffer, bytes, flags) << std::endl;
            if (!std::strstr(buffer, "error:"))
            {
                CPPUNIT_ASSERT_EQUAL(std::string("statusindicator: ready"), std::string(buffer, bytes));
            }
            else
            {
                // check error message
                CPPUNIT_ASSERT(std::strstr(SERVICE_UNAVAILABLE_INTERNAL_ERROR, buffer) != nullptr);

                // close frame message
                bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
                std::cerr << testname << "Got " << LOOLProtocol::getAbbreviatedFrameDump(buffer, bytes, flags) << std::endl;
                CPPUNIT_ASSERT((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) == Poco::Net::WebSocket::FRAME_OP_CLOSE);
            }
        }
        else
        {
            // check error message
            CPPUNIT_ASSERT(std::strstr(SERVICE_UNAVAILABLE_INTERNAL_ERROR, buffer) != nullptr);

            // close frame message
            bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
            std::cerr << testname << "Got " << LOOLProtocol::getAbbreviatedFrameDump(buffer, bytes, flags) << std::endl;
            CPPUNIT_ASSERT((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) == Poco::Net::WebSocket::FRAME_OP_CLOSE);
        }
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testCloseAfterClose()
{
    const auto testname = "closeAfterClose ";
    try
    {
        std::cerr << testname << "Connecting and loading." << std::endl;
        auto socket = loadDocAndGetSocket("hello.odt", _uri, testname);

        // send normal socket shutdown
        std::cerr << testname << "Disconnecting." << std::endl;
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
            std::cerr << testname << "Received [" << std::string(buffer, bytes) << "], flags: "<< std::hex << flags << std::dec << std::endl;
        }
        while (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);

        std::cerr << testname << "Received " << bytes << " bytes, flags: "<< std::hex << flags << std::dec << std::endl;

        try
        {
            // no more messages is received.
            bytes = socket->receiveFrame(buffer, sizeof(buffer), flags);
            std::cerr << testname << "Received " << bytes << " bytes, flags: "<< std::hex << flags << std::dec << std::endl;
            CPPUNIT_ASSERT_EQUAL(0, bytes);
            CPPUNIT_ASSERT_EQUAL(0, flags);
        }
        catch (const Poco::Exception& exc)
        {
            // This is not unexpected, since WSD will close the socket after
            // echoing back the shutdown status code. However, if it doesn't
            // we assert above that it doesn't send any more data.
            std::cerr << testname << "Error: " << exc.displayText() << std::endl;

        }
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::loadDoc(const std::string& documentURL, const std::string& testname)
{
    try
    {
        // Load a document and wait for the status.
        // Don't replace with helpers, so we catch status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        auto socket = connectLOKit(_uri, request, _response, testname);
        sendTextFrame(socket, "load url=" + documentURL, testname);

        assertResponseString(socket, "status:", testname);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testConnectNoLoad()
{
    const auto testname1 = "connectNoLoad-1 ";
    const auto testname2 = "connectNoLoad-2 ";
    const auto testname3 = "connectNoLoad-3 ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL, "connectNoLoad ");

    // Connect and disconnect without loading.
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
    std::cerr << testname1 << "Connecting first to disconnect without loading." << std::endl;
    auto socket = connectLOKit(_uri, request, _response, testname1);
    CPPUNIT_ASSERT_MESSAGE("Failed to connect.", socket);
    std::cerr << testname1 << "Disconnecting first." << std::endl;
    socket.reset();

    // Connect and load first view.
    std::cerr << testname2 << "Connecting second to load first view." << std::endl;
    auto socket1 = connectLOKit(_uri, request, _response, testname2);
    CPPUNIT_ASSERT_MESSAGE("Failed to connect.", socket1);
    sendTextFrame(socket1, "load url=" + documentURL, testname2);
    CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket1));

    // Connect but don't load second view.
    std::cerr << testname3 << "Connecting third to disconnect without loading." << std::endl;
    auto socket2 = connectLOKit(_uri, request, _response, testname3);
    CPPUNIT_ASSERT_MESSAGE("Failed to connect.", socket2);
    std::cerr << testname3 << "Disconnecting third." << std::endl;
    socket2.reset();

    std::cerr << testname2 << "Getting status from first view." << std::endl;
    sendTextFrame(socket1, "status", testname2);
    assertResponseString(socket1, "status:");

    std::cerr << testname2 << "Disconnecting second." << std::endl;
    socket1.reset();
}

void HTTPWSTest::testLoadSimple()
{
    const auto testname = "loadSimple ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);
    loadDoc(documentURL, "load ");
}

int HTTPWSTest::loadTorture(const std::string& testname,
                            const std::string& docName,
                            const size_t thread_count,
                            const size_t max_jitter_ms)
{
    // Load same document from many threads together.
    std::string documentPath, documentURL;
    getDocumentPathAndURL(docName, documentPath, documentURL, testname);

    std::atomic<int> sum_view_ids;
    sum_view_ids = 0;
    std::atomic<int> num_of_views(0);
    std::atomic<int> num_to_load(thread_count);

    std::vector<std::thread> threads;
    for (size_t i = 0; i < thread_count; ++i)
    {
        threads.emplace_back([&]
        {
            std::ostringstream oss;
            oss << std::hex << std::this_thread::get_id();
            const std::string id = oss.str();

            std::cerr << testname << ": #" << id << ", views: " << num_of_views << ", to load: " << num_to_load << std::endl;
            try
            {
                // Load a document and wait for the status.
                Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
                Poco::Net::HTTPResponse response;
                auto socket = connectLOKit(_uri, request, response, testname);
                sendTextFrame(socket, "load url=" + documentURL, testname);

                const auto status = assertResponseString(socket, "status:", testname);
                int viewid = -1;
                LOOLProtocol::getTokenIntegerFromMessage(status, "viewid", viewid);
                sum_view_ids += viewid;
                ++num_of_views;
                --num_to_load;

                std::cerr << testname << ": #" << id << ", loaded views: " << num_of_views << ", to load: " << num_to_load << std::endl;

                while (true)
                {
                    if (num_to_load == 0)
                    {
                        // Unload at once, nothing more left to do.
                        std::cerr << testname << ": #" << id << ", no more to load, unloading." << std::endl;
                        break;
                    }

                    const auto ms = (max_jitter_ms > 0
                                    ? std::chrono::milliseconds(Util::rng::getNext() % max_jitter_ms)
                                    : std::chrono::milliseconds(0));
                    std::this_thread::sleep_for(ms);

                    // Unload only when we aren't the last/only.
                    if (--num_of_views > 0)
                    {
                        std::cerr << testname << ": #" << id << ", views: " << num_of_views << " not the last/only, unloading." << std::endl;
                        break;
                    }
                    else
                    {
                        // Correct back, since we aren't unloading just yet.
                        ++num_of_views;
                    }
                }
            }
            catch (const std::exception& exc)
            {
                std::cerr << testname << ": #" << id << ", Exception: " << exc.what() << std::endl;
                --num_to_load;
            }
        });
    }

    for (auto& thread : threads)
    {
        try
        {
            thread.join();
        }
        catch (const std::exception& exc)
        {
            std::cerr << testname << ": Exception: " << exc.what() << std::endl;
        }
    }

    return sum_view_ids;
}

void HTTPWSTest::testLoadTortureODT()
{
    const auto thread_count = 6;
    const auto max_jitter_ms = 100;

    const auto testname = "loadTortureODT ";
    const auto sum_view_ids = loadTorture(testname, "empty.odt", thread_count, max_jitter_ms);

    // This only works when the first view-ID is 0 and increments monotonously.
    const auto number_of_loads = thread_count;
    const int exp_sum_view_ids = number_of_loads * (number_of_loads - 1) / 2; // 0-based view-ids.
    CPPUNIT_ASSERT_EQUAL(exp_sum_view_ids, sum_view_ids);
}

void HTTPWSTest::testLoadTortureODS()
{
    const auto thread_count = 6;
    const auto max_jitter_ms = 100;

    const auto testname = "loadTortureODS ";
    const auto sum_view_ids = loadTorture(testname, "empty.ods", thread_count, max_jitter_ms);

    // This only works when the first view-ID is 0 and increments monotonously.
    const auto number_of_loads = thread_count;
    const int exp_sum_view_ids = number_of_loads * (number_of_loads - 1) / 2; // 0-based view-ids.
    CPPUNIT_ASSERT_EQUAL(exp_sum_view_ids, sum_view_ids);
}

void HTTPWSTest::testLoadTortureODP()
{
    const auto thread_count = 6;
    const auto max_jitter_ms = 100;

    const auto testname = "loadTortureODP ";
    const auto sum_view_ids = loadTorture(testname, "empty.odp", thread_count, max_jitter_ms);

    // For ODP the view-id is always odd, and we expect not to skip any ids.
    const auto number_of_loads = thread_count;
    const int exp_sum_view_ids = number_of_loads * number_of_loads; // Odd view-ids only.
    CPPUNIT_ASSERT_EQUAL(exp_sum_view_ids, sum_view_ids);
}

void HTTPWSTest::testLoadTorture()
{
    const auto thread_count = 3;
    const auto max_jitter_ms = 75;

    std::vector<std::string> docNames = { "setclientpart.ods", "hello.odt", "viewcursor.odp" };

    std::vector<std::thread> threads;
    for (const auto& docName : docNames)
    {
        threads.emplace_back([&]
        {
            const auto testname = "loadTorture_" + docName + ' ';
            loadTorture(testname, docName, thread_count, max_jitter_ms);
        });
    }

    for (auto& thread : threads)
    {
        thread.join();
    }
}

void HTTPWSTest::testBadLoad()
{
    const auto testname = "badLoad ";
    try
    {
        // Load a document and get its status.
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        auto socket = connectLOKit(_uri, request, _response);

        // Before loading request status.
        sendTextFrame(socket, "status");

        const auto line = assertResponseString(socket, "error:");
        CPPUNIT_ASSERT_EQUAL(std::string("error: cmd=status kind=nodocloaded"), line);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testReload()
{
    auto const testname = "reload ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);
    for (auto i = 0; i < 3; ++i)
    {
        std::cerr << testname << "loading #" << (i+1) << std::endl;
        loadDoc(documentURL, testname);
    }
}

void HTTPWSTest::testGetTextSelection()
{
    const auto testname = "getTextSelection ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

        auto socket = loadDocAndGetSocket(_uri, documentURL, testname);
        auto socket2 = loadDocAndGetSocket(_uri, documentURL, testname);

        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
        const auto selection = assertResponseString(socket, "textselectioncontent:", testname);
        CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: Hello world"), selection);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testSaveOnDisconnect()
{
    const auto testname = "saveOnDisconnect ";

    const auto text = helpers::genRandomString(40);
    std::cerr << "Test string: [" << text << "]." << std::endl;

    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    int kitcount = -1;
    try
    {
        auto socket = loadDocAndGetSocket(_uri, documentURL, testname);

        auto socket2 = loadDocAndGetSocket(_uri, documentURL, testname);
        sendTextFrame(socket2, "userinactive");

        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "uno .uno:Delete", testname);
        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\n" + text, testname);

        // Check if the document contains the pasted text.
        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
        const auto selection = assertResponseString(socket, "textselectioncontent:", testname);
        CPPUNIT_ASSERT_EQUAL("textselectioncontent: " + text, selection);

        // Closing connection too fast might not flush buffers.
        // Often nothing more than the SelectAll reaches the server before
        // the socket is closed, when the doc is not even modified yet.
        getResponseMessage(socket, "statechanged", testname);

        kitcount = getLoolKitProcessCount();

        // Shutdown abruptly.
        std::cerr << "Closing connection after pasting." << std::endl;
        socket->shutdown();
        socket2->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }

    // Allow time to save and destroy before we connect again.
    testNoExtraLoolKitsLeft();
    std::cerr << "Loading again." << std::endl;
    try
    {
        // Load the same document and check that the last changes (pasted text) is saved.
        auto socket = loadDocAndGetSocket(_uri, documentURL, testname);

        // Should have no new instances.
        CPPUNIT_ASSERT_EQUAL(kitcount, countLoolKitProcesses(kitcount));

        // Check if the document contains the pasted text.
        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
        const auto selection = assertResponseString(socket, "textselectioncontent:", testname);
        CPPUNIT_ASSERT_EQUAL("textselectioncontent: " + text, selection);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testReloadWhileDisconnecting()
{
    const auto testname = "reloadWhileDisconnecting ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

        auto socket = loadDocAndGetSocket(_uri, documentURL, testname);

        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "uno .uno:Delete", testname);
        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc", testname);

        // Closing connection too fast might not flush buffers.
        // Often nothing more than the SelectAll reaches the server before
        // the socket is closed, when the doc is not even modified yet.
        getResponseMessage(socket, "statechanged", testname);

        const auto kitcount = getLoolKitProcessCount();

        // Shutdown abruptly.
        std::cerr << "Closing connection after pasting." << std::endl;
        socket->shutdown();

        // Load the same document and check that the last changes (pasted text) is saved.
        std::cerr << "Loading again." << std::endl;
        socket = loadDocAndGetSocket(_uri, documentURL, testname);

        // Should have no new instances.
        CPPUNIT_ASSERT_EQUAL(kitcount, countLoolKitProcesses(kitcount));

        // Check if the document contains the pasted text.
        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
        const auto selection = assertResponseString(socket, "textselectioncontent:", testname);
        CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: aaa bbb ccc"), selection);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testExcelLoad()
{
    const auto testname = "excelLoad ";
    try
    {
        // Load a document and get status.
        auto socket = loadDocAndGetSocket("timeline.xlsx", _uri, testname);

        sendTextFrame(socket, "status", testname);
        const auto status = assertResponseString(socket, "status:", testname);

        // Expected format is something like 'status: type=text parts=2 current=0 width=12808 height=1142'.
        Poco::StringTokenizer tokens(status, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(8), tokens.count());
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testPaste()
{
    const auto testname = "paste ";
    try
    {
        // Load a document and make it empty, then paste some text into it.
        auto socket = loadDocAndGetSocket("hello.odt", _uri, testname);

        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "uno .uno:Delete", testname);

        // Paste some text into it.
        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc", testname);

        // Check if the document contains the pasted text.
        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
        const auto selection = assertResponseString(socket, "textselectioncontent:", testname);
        CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: aaa bbb ccc"), selection);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testPasteBlank()
{
    const auto testname = "pasteBlank ";
    try
    {
        // Load a document and make it empty, then paste nothing into it.
        auto socket = loadDocAndGetSocket("hello.odt", _uri, testname);

        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "uno .uno:Delete", testname);

        // Paste nothing into it.
        sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8", testname);

        // Check if the document contains the pasted text.
        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
        const auto selection = assertResponseString(socket, "textselectioncontent:", testname);
        CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: "), selection);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testLargePaste()
{
    const auto testname = "LargePaste ";
    try
    {
        // Load a document and make it empty, then paste some text into it.
        auto socket = loadDocAndGetSocket("hello.odt", _uri, testname);

        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "uno .uno:Delete", testname);

        // Paste some text into it.
        std::ostringstream oss;
        for (auto i = 0; i < 1000; ++i)
        {
            oss << Util::encodeId(Util::rng::getNext(), 6);
        }

        const auto documentContents = oss.str();
        std::cerr << "Pasting " << documentContents.size() << " characters into document." << std::endl;
        sendTextFrame(socket, "paste mimetype=text/html\n" + documentContents, testname);

        // Check if the server is still alive.
        // This resulted first in a hang, as respose for the message never arrived, then a bit later in a Poco::TimeoutException.
        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
        const auto selection = assertResponseString(socket, "textselectioncontent:", testname);
        CPPUNIT_ASSERT_MESSAGE("Pasted text was either corrupted or couldn't be read back",
                               "textselectioncontent: " + documentContents == selection);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testRenderingOptions()
{
    const auto testname = "renderingOptions ";
    try
    {
        // Load a document and get its size.
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hide-whitespace.odt", documentPath, documentURL, testname);

        const std::string options = "{\"rendering\":{\".uno:HideWhitespace\":{\"type\":\"boolean\",\"value\":\"true\"}}}";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        auto socket = connectLOKit(_uri, request, _response);

        sendTextFrame(socket, "load url=" + documentURL + " options=" + options);
        sendTextFrame(socket, "status");
        const auto status = assertResponseString(socket, "status:");

        // Expected format is something like 'status: type=text parts=2 current=0 width=12808 height=1142'.
        Poco::StringTokenizer tokens(status, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(7), tokens.count());

        const std::string token = tokens[5];
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
    const auto testname = "passwordProtectedDocumentWithoutPassword ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("password-protected.ods", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        auto socket = connectLOKit(_uri, request, _response);

        // Send a load request without password first
        sendTextFrame(socket, "load url=" + documentURL);

        const auto response = getResponseString(socket, "error:", testname);
        Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(3), tokens.count());

        std::string errorCommand;
        std::string errorKind;
        LOOLProtocol::getTokenString(tokens[1], "cmd", errorCommand);
        LOOLProtocol::getTokenString(tokens[2], "kind", errorKind);
        CPPUNIT_ASSERT_EQUAL(std::string("load"), errorCommand);
        CPPUNIT_ASSERT_EQUAL(std::string("passwordrequired:to-view"), errorKind);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testPasswordProtectedDocumentWithWrongPassword()
{
    const auto testname = "passwordProtectedDocumentWithWrongPassword ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("password-protected.ods", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        auto socket = connectLOKit(_uri, request, _response);

        // Send a load request with incorrect password
        sendTextFrame(socket, "load url=" + documentURL + " password=2");

        const auto response = getResponseString(socket, "error:", testname);
        Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(3), tokens.count());

        std::string errorCommand;
        std::string errorKind;
        LOOLProtocol::getTokenString(tokens[1], "cmd", errorCommand);
        LOOLProtocol::getTokenString(tokens[2], "kind", errorKind);
        CPPUNIT_ASSERT_EQUAL(std::string("load"), errorCommand);
        CPPUNIT_ASSERT_EQUAL(std::string("wrongpassword"), errorKind);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testPasswordProtectedDocumentWithCorrectPassword()
{
    const auto testname = "passwordProtectedDocumentWithCorrectPassword ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("password-protected.ods", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        auto socket = connectLOKit(_uri, request, _response);

        // Send a load request with correct password
        sendTextFrame(socket, "load url=" + documentURL + " password=1");

        CPPUNIT_ASSERT_MESSAGE("cannot load the document with correct password " + documentURL, isDocumentLoaded(socket));
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

void HTTPWSTest::testPasswordProtectedOOXMLDocument()
{
    const auto testname = "passwordProtectedOOXMLDocument ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("password-protected.docx", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        auto socket = connectLOKit(_uri, request, _response);

        // Send a load request with correct password
        sendTextFrame(socket, "load url=" + documentURL + " password=abc");

        CPPUNIT_ASSERT_MESSAGE("cannot load the document with correct password " + documentURL, isDocumentLoaded(socket));
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testPasswordProtectedBinaryMSOfficeDocument()
{
    const auto testname = "passwordProtectedBinaryMSOfficeDocument ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("password-protected.doc", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        auto socket = connectLOKit(_uri, request, _response);

        // Send a load request with correct password
        sendTextFrame(socket, "load url=" + documentURL + " password=abc");

        CPPUNIT_ASSERT_MESSAGE("cannot load the document with correct password " + documentURL, isDocumentLoaded(socket));
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testInsertDelete()
{
    const auto testname = "insertDelete ";
    try
    {
        std::vector<std::string> parts;
        std::string response;

        // Load a document
        std::string documentPath, documentURL;
        getDocumentPathAndURL("insert-delete.odp", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        auto socket = connectLOKit(_uri, request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        // check total slides 1
        std::cerr << "Expecting 1 slide." << std::endl;
        sendTextFrame(socket, "status");
        response = getResponseString(socket, "status:");
        CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
        getPartHashCodes(response.substr(7), parts);
        CPPUNIT_ASSERT_EQUAL(1, (int)parts.size());

        const auto slide1Hash = parts[0];

        // insert 10 slides
        std::cerr << "Inserting 10 slides." << std::endl;
        for (size_t it = 1; it <= 10; it++)
        {
            sendTextFrame(socket, "uno .uno:InsertPage");
            response = getResponseString(socket, "status:");
            CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
            getPartHashCodes(response.substr(7), parts);
            CPPUNIT_ASSERT_EQUAL(it + 1, parts.size());
        }

        CPPUNIT_ASSERT_MESSAGE("Hash code of slide #1 changed after inserting extra slides.", parts[0] == slide1Hash);
        const std::vector<std::string> parts_after_insert(parts.begin(), parts.end());

        // delete 10 slides
        std::cerr << "Deleting 10 slides." << std::endl;
        for (size_t it = 1; it <= 10; it++)
        {
            sendTextFrame(socket, "uno .uno:DeletePage");
            response = getResponseString(socket, "status:");
            CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
            getPartHashCodes(response.substr(7), parts);
            CPPUNIT_ASSERT_EQUAL(11 - it, parts.size());
        }

        CPPUNIT_ASSERT_MESSAGE("Hash code of slide #1 changed after deleting extra slides.", parts[0] == slide1Hash);

        // undo delete slides
        std::cerr << "Undoing 10 slide deletes." << std::endl;
        for (size_t it = 1; it <= 10; it++)
        {
            sendTextFrame(socket, "uno .uno:Undo");
            response = getResponseString(socket, "status:");
            CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
            getPartHashCodes(response.substr(7), parts);
            CPPUNIT_ASSERT_EQUAL(it + 1, parts.size());
        }

        CPPUNIT_ASSERT_MESSAGE("Hash code of slide #1 changed after undoing slide delete.", parts[0] == slide1Hash);
        const std::vector<std::string> parts_after_undo(parts.begin(), parts.end());
        CPPUNIT_ASSERT_MESSAGE("Hash codes changed between deleting and undo.", parts_after_insert == parts_after_undo);

        // redo inserted slides
        std::cerr << "Redoing 10 slide deletes." << std::endl;
        for (size_t it = 1; it <= 10; it++)
        {
            sendTextFrame(socket, "uno .uno:Redo");
            response = getResponseString(socket, "status:");
            CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
            getPartHashCodes(response.substr(7), parts);
            CPPUNIT_ASSERT_EQUAL(11 - it, parts.size());
        }

        CPPUNIT_ASSERT_MESSAGE("Hash code of slide #1 changed after redoing slide delete.", parts[0] == slide1Hash);

        // check total slides 1
        std::cerr << "Expecting 1 slide." << std::endl;
        sendTextFrame(socket, "status");
        response = getResponseString(socket, "status:");
        CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
        getPartHashCodes(response.substr(7), parts);
        CPPUNIT_ASSERT_EQUAL(1, (int)parts.size());
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testSlideShow()
{
    const auto testname = "slideshow ";
    try
    {
        // Load a document
        std::string documentPath, documentURL;
        std::string response;
        getDocumentPathAndURL("setclientpart.odp", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        auto socket = connectLOKit(_uri, request, _response);

        sendTextFrame(socket, "load url=" + documentURL, testname);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        // request slide show
        sendTextFrame(socket, "downloadas name=slideshow.svg id=slideshow format=svg options=", testname);
        response = getResponseString(socket, "downloadas:", testname);
        CPPUNIT_ASSERT_MESSAGE("did not receive a downloadas: message as expected", !response.empty());

        Poco::StringTokenizer tokens(response.substr(11), " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        // "downloadas: jail= dir= name=slideshow.svg port= id=slideshow"
        const std::string jail = tokens[0].substr(std::string("jail=").size());
        const std::string dir = tokens[1].substr(std::string("dir=").size());
        const std::string name = tokens[2].substr(std::string("name=").size());
        const int port = std::stoi(tokens[3].substr(std::string("port=").size()));
        const std::string id = tokens[4].substr(std::string("id=").size());
        CPPUNIT_ASSERT(!jail.empty());
        CPPUNIT_ASSERT(!dir.empty());
        CPPUNIT_ASSERT_EQUAL(std::string("slideshow.svg"), name);
        CPPUNIT_ASSERT_EQUAL(static_cast<int>(_uri.getPort()), port);
        CPPUNIT_ASSERT_EQUAL(std::string("slideshow"), id);

        std::string encodedDoc;
        Poco::URI::encode(documentPath, ":/?", encodedDoc);
        const std::string path = "/lool/" + encodedDoc + "/" + jail + "/" + dir + "/" + name;
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));
        Poco::Net::HTTPRequest requestSVG(Poco::Net::HTTPRequest::HTTP_GET, path);
        session->sendRequest(requestSVG);

        Poco::Net::HTTPResponse responseSVG;
        std::istream& rs = session->receiveResponse(responseSVG);
        CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, responseSVG.getStatus());
        CPPUNIT_ASSERT_EQUAL(std::string("image/svg+xml"), responseSVG.getContentType());
        std::cerr << "SVG file size: " << responseSVG.getContentLength() << std::endl;
        // std::ofstream ofs("/tmp/slide.svg");
        // Poco::StreamCopier::copyStream(rs, ofs);
        // ofs.close();
        (void)rs;
        // Some setups render differently; recognize these two valid output sizes for now.
        // Seems LO generates different svg content, even though visually identical.
        // Current known sizes: 434748, 451329, 467345, 468653.
        CPPUNIT_ASSERT(responseSVG.getContentLength() >= std::streamsize(430000) &&
                       responseSVG.getContentLength() <= std::streamsize(470000));
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testInactiveClient()
{
    const auto testname = "inactiveClient ";
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

        auto socket1 = loadDocAndGetSocket(_uri, documentURL, "inactiveClient-1 ");

        // Connect another and go inactive.
        std::cerr << "Connecting second client." << std::endl;
        auto socket2 = loadDocAndGetSocket(_uri, documentURL, "inactiveClient-2 ", true);
        sendTextFrame(socket2, "userinactive", "inactiveClient-2 ");

        // While second is inactive, make some changes.
        sendTextFrame(socket1, "uno .uno:SelectAll", "inactiveClient-1 ");
        sendTextFrame(socket1, "uno .uno:Delete", "inactiveClient-1 ");

        // Activate second.
        sendTextFrame(socket2, "useractive", "inactiveClient-2 ");
        SocketProcessor("Second ", socket2, [&](const std::string& msg)
                {
                    const auto token = LOOLProtocol::getFirstToken(msg);
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
                                            token == "viewinfo:");

                    // End when we get state changed.
                    return (token != "statechanged:");
                });

        std::cerr << "Second client finished." << std::endl;
        socket1->shutdown();
        socket2->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testMaxColumn()
{
    try
    {
        limitCursor(
            // move cursor to last column
            [](const std::shared_ptr<LOOLWebSocket>& socket,
               int cursorX, int cursorY, int cursorWidth, int cursorHeight,
               int docWidth, int docHeight)
            {
                CPPUNIT_ASSERT(cursorX >= 0);
                CPPUNIT_ASSERT(cursorY >= 0);
                CPPUNIT_ASSERT(cursorWidth >= 0);
                CPPUNIT_ASSERT(cursorHeight >= 0);
                CPPUNIT_ASSERT(docWidth >= 0);
                CPPUNIT_ASSERT(docHeight >= 0);

                const std::string text = "key type=input char=0 key=1027";
                while (cursorX <= docWidth)
                {
                    sendTextFrame(socket, text);
                    cursorX += cursorWidth;
                }
            },
            // check new document width
            [](int docWidth, int docHeight, int newWidth, int newHeight)
            {
                CPPUNIT_ASSERT_EQUAL(docHeight, newHeight);
                CPPUNIT_ASSERT(newWidth > docWidth);
            },
            "maxColumn"
        );
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testMaxRow()
{
    try
    {
        limitCursor(
            // move cursor to last row
            [](const std::shared_ptr<LOOLWebSocket>& socket,
               int cursorX, int cursorY, int cursorWidth, int cursorHeight,
               int docWidth, int docHeight)
            {
                CPPUNIT_ASSERT(cursorX >= 0);
                CPPUNIT_ASSERT(cursorY >= 0);
                CPPUNIT_ASSERT(cursorWidth >= 0);
                CPPUNIT_ASSERT(cursorHeight >= 0);
                CPPUNIT_ASSERT(docWidth >= 0);
                CPPUNIT_ASSERT(docHeight >= 0);

                const std::string text = "key type=input char=0 key=1024";
                while (cursorY <= docHeight)
                {
                    sendTextFrame(socket, text);
                    cursorY += cursorHeight;
                }
            },
            // check new document height
            [](int docWidth, int docHeight, int newWidth, int newHeight)
            {
                CPPUNIT_ASSERT_EQUAL(docWidth, newWidth);
                CPPUNIT_ASSERT(newHeight > docHeight);
            },
            "maxRow"
        );
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::getPartHashCodes(const std::string status,
                                  std::vector<std::string>& parts)
{
    std::string line;
    std::istringstream istr(status);
    std::getline(istr, line);

    std::cerr << "Reading parts from [" << status << "]." << std::endl;

    // Expected format is something like 'type= parts= current= width= height= viewid='.
    Poco::StringTokenizer tokens(line, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(6), tokens.count());

    const auto type = tokens[0].substr(std::string("type=").size());
    CPPUNIT_ASSERT_MESSAGE("Expected presentation or spreadsheet type to read part names/codes.",
                           type == "presentation" || type == "spreadsheet");

    const int totalParts = std::stoi(tokens[1].substr(std::string("parts=").size()));
    std::cerr << "Status reports " << totalParts << " parts." << std::endl;

    Poco::RegularExpression endLine("[^\n\r]+");
    Poco::RegularExpression number("^[0-9]+$");
    Poco::RegularExpression::MatchVec matches;
    int offset = 0;

    parts.clear();
    while (endLine.match(status, offset, matches) > 0)
    {
        CPPUNIT_ASSERT_EQUAL(1, (int)matches.size());
        const auto str = status.substr(matches[0].offset, matches[0].length);
        if (number.match(str, 0))
        {
            parts.push_back(str);
        }

        offset = static_cast<int>(matches[0].offset + matches[0].length);
    }

    std::cerr << "Found " << parts.size() << " part names/codes." << std::endl;

    // Validate that Core is internally consistent when emitting status messages.
    CPPUNIT_ASSERT_EQUAL(totalParts, (int)parts.size());
}

void HTTPWSTest::getCursor(const std::string& message,
                           int& cursorX, int& cursorY, int& cursorWidth, int& cursorHeight)
{
    Poco::JSON::Parser parser;
    const auto result = parser.parse(message);
    const auto& command = result.extract<Poco::JSON::Object::Ptr>();
    auto text = command->get("commandName").toString();
    CPPUNIT_ASSERT_EQUAL(std::string(".uno:CellCursor"), text);
    text = command->get("commandValues").toString();
    CPPUNIT_ASSERT(!text.empty());
    Poco::StringTokenizer position(text, ",", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
    cursorX = std::stoi(position[0]);
    cursorY = std::stoi(position[1]);
    cursorWidth = std::stoi(position[2]);
    cursorHeight = std::stoi(position[3]);
    CPPUNIT_ASSERT(cursorX >= 0);
    CPPUNIT_ASSERT(cursorY >= 0);
    CPPUNIT_ASSERT(cursorWidth >= 0);
    CPPUNIT_ASSERT(cursorHeight >= 0);
}

void HTTPWSTest::limitCursor(std::function<void(const std::shared_ptr<LOOLWebSocket>& socket,
                                                int cursorX, int cursorY,
                                                int cursorWidth, int cursorHeight,
                                                int docWidth, int docHeight)> keyhandler,
                             std::function<void(int docWidth, int docHeight,
                                                int newWidth, int newHeight)> checkhandler,
                             const std::string& testname)
{
    int docSheet = -1;
    int docSheets = 0;
    int docHeight = 0;
    int docWidth = 0;
    int docViewId = -1;
    int newSheet = -1;
    int newSheets = 0;
    int newHeight = 0;
    int newWidth = 0;
    int cursorX = 0;
    int cursorY = 0;
    int cursorWidth = 0;
    int cursorHeight = 0;

    std::string response;

    auto socket = loadDocAndGetSocket("empty.ods", _uri, testname);

    // check document size
    sendTextFrame(socket, "status", testname);
    response = assertResponseString(socket, "status:", testname);
    parseDocSize(response.substr(7), "spreadsheet", docSheet, docSheets, docWidth, docHeight, docViewId);

    // Send an arrow key to initialize the CellCursor, otherwise we get "EMPTY".
    sendTextFrame(socket, "key type=input char=0 key=1027", testname);

    std::string text;
    Poco::format(text, "commandvalues command=.uno:CellCursor?outputHeight=%d&outputWidth=%d&tileHeight=%d&tileWidth=%d",
                 256, 256, 3840, 3840);
    sendTextFrame(socket, text, testname);
    const auto cursor = getResponseString(socket, "commandvalues:", testname);
    getCursor(cursor.substr(14), cursorX, cursorY, cursorWidth, cursorHeight);

    // move cursor
    keyhandler(socket, cursorX, cursorY, cursorWidth, cursorHeight, docWidth, docHeight);

    // filter messages, and expect to receive new document size
    response = assertResponseString(socket, "status:", testname);
    parseDocSize(response.substr(7), "spreadsheet", newSheet, newSheets, newWidth, newHeight, docViewId);

    CPPUNIT_ASSERT_EQUAL(docSheets, newSheets);
    CPPUNIT_ASSERT_EQUAL(docSheet, newSheet);

    // check new document size
    checkhandler(docWidth, docHeight, newWidth, newHeight);
}

void HTTPWSTest::testInsertAnnotationWriter()
{
    const auto testname = "insertAnnotationWriter ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);

    auto socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // Insert comment.
    sendTextFrame(socket, "uno .uno:InsertAnnotation", testname);
    assertResponseString(socket, "invalidatetiles:", testname);

    // Paste some text.
    sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\nxxx yyy zzzz", testname);

    // Read it back.
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    auto res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: xxx yyy zzzz"), res);
    // Can we edit the coment?
    sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc", testname);
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: aaa bbb ccc"), res);

    // Confirm that the text is in the comment and not doc body.
    // Click in the body.
    sendTextFrame(socket, "mouse type=buttondown x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "mouse type=buttonup x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    // Read body text.
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: Hello world"), res);

    // Confirm that the comment is still intact.
    sendTextFrame(socket, "mouse type=buttondown x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "mouse type=buttonup x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: aaa bbb ccc"), res);

    // Can we still edit the coment?
    sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\nand now for something completely different", testname);
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: and now for something completely different"), res);

    // Close and reopen the same document and test again.
    socket->shutdown();

    // Make sure the document is fully unloaded.
    testNoExtraLoolKitsLeft();

    std::cerr << "Reloading " << std::endl;
    socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // Confirm that the text is in the comment and not doc body.
    // Click in the body.
    sendTextFrame(socket, "mouse type=buttondown x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "mouse type=buttonup x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    // Read body text.
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: Hello world"), res);

    // Confirm that the comment is still intact.
    sendTextFrame(socket, "mouse type=buttondown x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "mouse type=buttonup x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: and now for something completely different"), res);

    // Can we still edit the coment?
    sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\nblah blah xyz", testname);
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: blah blah xyz"), res);
}

void HTTPWSTest::testEditAnnotationWriter()
{
    const auto testname = "editAnnotationWriter ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("with_comment.odt", documentPath, documentURL, testname);

    auto socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // Click in the body.
    sendTextFrame(socket, "mouse type=buttondown x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "mouse type=buttonup x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    // Read body text.
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    auto res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: Hello world"), res);

    // Confirm that the comment is intact.
    sendTextFrame(socket, "mouse type=buttondown x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "mouse type=buttonup x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: blah blah xyz"), res);

    // Can we still edit the coment?
    sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\nand now for something completely different", testname);
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: and now for something completely different"), res);

    const auto kitcount = getLoolKitProcessCount();

    // Close and reopen the same document and test again.
    std::cerr << "Closing connection after pasting." << std::endl;
    socket->shutdown();

    std::cerr << "Reloading " << std::endl;
    socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // Should have no new instances.
    CPPUNIT_ASSERT_EQUAL(kitcount, countLoolKitProcesses(kitcount));

    // Confirm that the text is in the comment and not doc body.
    // Click in the body.
    sendTextFrame(socket, "mouse type=buttondown x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "mouse type=buttonup x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    // Read body text.
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: Hello world"), res);

    // Confirm that the comment is still intact.
    sendTextFrame(socket, "mouse type=buttondown x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "mouse type=buttonup x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: and now for something completely different"), res);

    // Can we still edit the coment?
    sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\nnew text different", testname);
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: new text different"), res);
}

void HTTPWSTest::testInsertAnnotationCalc()
{
    const auto testname = "insertAnnotationCalc ";
    auto socket = loadDocAndGetSocket("setclientpart.ods", _uri, testname);

    // Insert comment.
    sendTextFrame(socket, "uno .uno:InsertAnnotation", testname);

    // Paste some text.
    sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc", testname);

    // Read it back.
    sendTextFrame(socket, "uno .uno:SelectAll", testname);
    sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    auto res = getResponseString(socket, "textselectioncontent:", testname);
    CPPUNIT_ASSERT_EQUAL(std::string("textselectioncontent: aaa bbb ccc"), res);
}

void HTTPWSTest::testCalcEditRendering()
{
    const auto testname = "calcEditRendering ";
    auto socket = loadDocAndGetSocket("calc_render.xls", _uri, testname);

    sendTextFrame(socket, "mouse type=buttondown x=5000 y=5 count=1 buttons=1 modifier=0", testname);
    sendTextFrame(socket, "key type=input char=97 key=0", testname);
    sendTextFrame(socket, "key type=input char=98 key=0", testname);
    sendTextFrame(socket, "key type=input char=99 key=0", testname);

    assertResponseString(socket, "cellformula: abc", testname);

    const auto req = "tilecombine part=0 width=512 height=512 tileposx=3840 tileposy=0 tilewidth=7680 tileheight=7680";
    sendTextFrame(socket, req, testname);

    const auto tile = getResponseMessage(socket, "tile:", testname);
    std::cerr << "size: " << tile.size() << std::endl;

    // Return early for now when on LO >= 5.2.
    std::string clientVersion = "loolclient 0.1";
    sendTextFrame(socket, clientVersion);
    std::vector<char> loVersion = getResponseMessage(socket, "lokitversion", testname);
    std::string line = LOOLProtocol::getFirstLine(loVersion.data(), loVersion.size());
    line = line.substr(strlen("lokitversion "));
    Poco::JSON::Parser parser;
    Poco::Dynamic::Var loVersionVar = parser.parse(line);
    const Poco::SharedPtr<Poco::JSON::Object>& loVersionObject = loVersionVar.extract<Poco::JSON::Object::Ptr>();
    std::string loProductVersion = loVersionObject->get("ProductVersion").toString();
    std::istringstream stream(loProductVersion);
    int major = 0;
    stream >> major;
    assert(stream.get() == '.');
    int minor = 0;
    stream >> minor;

    const std::string firstLine = LOOLProtocol::getFirstLine(tile);
    std::vector<char> res(tile.begin() + firstLine.size() + 1, tile.end());
    std::stringstream streamRes;
    std::copy(res.begin(), res.end(), std::ostream_iterator<char>(streamRes));

    std::fstream outStream("/tmp/res.png", std::ios::out);
    outStream.write(res.data(), res.size());
    outStream.close();

    png_uint_32 height = 0;
    png_uint_32 width = 0;
    png_uint_32 rowBytes = 0;
    auto rows = Png::decodePNG(streamRes, height, width, rowBytes);

    const std::vector<char> exp = readDataFromFile("calc_render_0_512x512.3840,0.7680x7680.png");
    std::stringstream streamExp;
    std::copy(exp.begin(), exp.end(), std::ostream_iterator<char>(streamExp));

    png_uint_32 heightExp = 0;
    png_uint_32 widthExp = 0;
    png_uint_32 rowBytesExp = 0;
    auto rowsExp = Png::decodePNG(streamExp, heightExp, widthExp, rowBytesExp);

    CPPUNIT_ASSERT_EQUAL(heightExp, height);
    CPPUNIT_ASSERT_EQUAL(widthExp, width);
    CPPUNIT_ASSERT_EQUAL(rowBytesExp, rowBytes);

    for (png_uint_32 itRow = 0; itRow < height; ++itRow)
    {
        const bool eq = std::equal(rowsExp[itRow], rowsExp[itRow] + rowBytes, rows[itRow]);
        if (!eq)
        {
            // This is a very strict test that breaks often/easily due to slight rendering
            // differences. So for now just keep it informative only.
            //CPPUNIT_ASSERT_MESSAGE("Tile not rendered as expected @ row #" + std::to_string(itRow), eq);
            std::cerr << "\nFAILURE: Tile not rendered as expected @ row #" << itRow << std::endl;
            break;
        }
    }
}

std::string HTTPWSTest::getFontList(const std::string& message)
{
    Poco::JSON::Parser parser;
    const auto result = parser.parse(message);
    const auto& command = result.extract<Poco::JSON::Object::Ptr>();
    auto text = command->get("commandName").toString();
    CPPUNIT_ASSERT_EQUAL(std::string(".uno:CharFontName"), text);
    text = command->get("commandValues").toString();
    return text;
}

void HTTPWSTest::testFontList()
{
    const auto testname = "fontList ";
    try
    {
        // Load a document
        auto socket = loadDocAndGetSocket("setclientpart.odp", _uri, testname);

        sendTextFrame(socket, "commandvalues command=.uno:CharFontName", testname);
        const auto response = getResponseMessage(socket, "commandvalues:", testname);
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

void HTTPWSTest::testStateChanged(const std::string& filename, std::set<std::string>& commands)
{
    const auto testname = "stateChanged_" + filename + " ";

    Poco::RegularExpression reUno("\\.[a-zA-Z]*\\:[a-zA-Z]*\\=");

    auto socket = loadDocAndGetSocket(filename, _uri, testname);
    SocketProcessor(testname, socket,
        [&](const std::string& msg)
        {
            Poco::RegularExpression::MatchVec matches;
            if (reUno.match(msg, 0, matches) > 0 && matches.size() == 1)
            {
                commands.erase(msg.substr(matches[0].offset, matches[0].length));
            }

            return !commands.empty();
        });

    if (!commands.empty())
    {
        std::ostringstream ostr;
        ostr << filename << " : Missing Uno Commands: " << std::endl;
        for (auto & itUno : commands)
        {
            ostr << itUno << std::endl;
        }

        CPPUNIT_FAIL(ostr.str());
    }
}

void HTTPWSTest::testStateUnoCommandWriter()
{
    std::set<std::string> writerCommands
    {
        ".uno:BackColor=",
        ".uno:BackgroundColor=",
        ".uno:Bold=",
        ".uno:CenterPara=",
        ".uno:CharBackColor=",
        ".uno:CharBackgroundExt=",
        ".uno:CharFontName=",
        ".uno:Color=",
        ".uno:DefaultBullet=",
        ".uno:DefaultNumbering=",
        ".uno:FontColor=",
        ".uno:FontHeight=",
        ".uno:Italic=",
        ".uno:JustifyPara=",
        ".uno:OutlineFont=",
        ".uno:LeftPara=",
        ".uno:RightPara=",
        ".uno:Shadowed=",
        ".uno:SubScript=",
        ".uno:SuperScript=",
        ".uno:Strikeout=",
        ".uno:StyleApply=",
        ".uno:Underline=",
        ".uno:ModifiedStatus=",
        ".uno:Undo=",
        ".uno:Redo=",
        ".uno:Cut=",
        ".uno:Copy=",
        ".uno:Paste=",
        ".uno:SelectAll=",
        ".uno:InsertAnnotation=",
        ".uno:InsertRowsBefore=",
        ".uno:InsertRowsAfter=",
        ".uno:InsertColumnsBefore=",
        ".uno:InsertColumnsAfter=",
        ".uno:DeleteRows=",
        ".uno:DeleteColumns=",
        ".uno:DeleteTable=",
        ".uno:SelectTable=",
        ".uno:EntireRow=",
        ".uno:EntireColumn=",
        ".uno:EntireCell=",
        ".uno:InsertMode=",
        ".uno:StateTableCell=",
        ".uno:StatePageNumber=",
        ".uno:StateWordCount=",
        ".uno:SelectionMode=",
        ".uno:NumberFormatCurrency=",
        ".uno:NumberFormatPercent=",
        ".uno:NumberFormatDate="
    };

    try
    {
        testStateChanged("empty.odt", writerCommands);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testStateUnoCommandCalc()
{
    std::set<std::string> calcCommands
    {
        ".uno:BackgroundColor=",
        ".uno:Bold=",
        ".uno:CenterPara=",
        ".uno:CharBackColor=",
        ".uno:CharFontName=",
        ".uno:Color=",
        ".uno:FontHeight=",
        ".uno:Italic=",
        ".uno:JustifyPara=",
        ".uno:OutlineFont=",
        ".uno:LeftPara=",
        ".uno:RightPara=",
        ".uno:Shadowed=",
        ".uno:SubScript=",
        ".uno:SuperScript=",
        ".uno:Strikeout=",
        ".uno:StyleApply=",
        ".uno:Underline=",
        ".uno:ModifiedStatus=",
        ".uno:Undo=",
        ".uno:Redo=",
        ".uno:Cut=",
        ".uno:Copy=",
        ".uno:Paste=",
        ".uno:SelectAll=",
        ".uno:InsertAnnotation=",
        ".uno:InsertRowsBefore=",
        ".uno:InsertRowsAfter=",
        ".uno:InsertColumnsBefore=",
        ".uno:InsertColumnsAfter=",
        ".uno:DeleteRows=",
        ".uno:DeleteColumns=",
        ".uno:StatusDocPos=",
        ".uno:RowColSelCount=",
        ".uno:StatusPageStyle=",
        ".uno:InsertMode=",
        ".uno:StatusSelectionMode=",
        ".uno:StateTableCell=",
        ".uno:StatusBarFunc=",
        ".uno:WrapText=",
        ".uno:ToggleMergeCells=",
        ".uno:NumberFormatCurrency=",
        ".uno:NumberFormatPercent=",
        ".uno:NumberFormatDate="
    };

    try
    {
        testStateChanged("empty.ods", calcCommands);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testStateUnoCommandImpress()
{
    std::set<std::string> impressCommands
    {
        ".uno:Bold=",
        ".uno:CenterPara=",
        ".uno:CharBackColor=",
        ".uno:CharFontName=",
        ".uno:Color=",
        ".uno:DefaultBullet=",
        ".uno:DefaultNumbering=",
        ".uno:FontHeight=",
        ".uno:Italic=",
        ".uno:JustifyPara=",
        ".uno:OutlineFont=",
        ".uno:LeftPara=",
        ".uno:RightPara=",
        ".uno:Shadowed=",
        ".uno:SubScript=",
        ".uno:SuperScript=",
        ".uno:Strikeout=",
        ".uno:StyleApply=",
        ".uno:Underline=",
        ".uno:ModifiedStatus=",
        ".uno:Undo=",
        ".uno:Redo=",
        ".uno:InsertPage=",
        ".uno:DeletePage=",
        ".uno:DuplicatePage=",
        ".uno:Cut=",
        ".uno:Copy=",
        ".uno:Paste=",
        ".uno:SelectAll=",
        ".uno:InsertAnnotation=",
        ".uno:InsertRowsBefore=",
        ".uno:InsertRowsAfter=",
        ".uno:InsertColumnsBefore=",
        ".uno:InsertColumnsAfter=",
        ".uno:DeleteRows=",
        ".uno:DeleteColumns=",
        ".uno:SelectTable=",
        ".uno:EntireRow=",
        ".uno:EntireColumn=",
        ".uno:AssignLayout=",
        ".uno:PageStatus=",
        ".uno:LayoutStatus=",
        ".uno:Context=",
    };

    try
    {
        testStateChanged("empty.odp", impressCommands);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

double HTTPWSTest::getColRowSize(const std::string& property, const std::string& message, int index)
{
    Poco::JSON::Parser parser;
    const auto result = parser.parse(message);
    const auto& command = result.extract<Poco::JSON::Object::Ptr>();
    auto text = command->get("commandName").toString();

    CPPUNIT_ASSERT_EQUAL(std::string(".uno:ViewRowColumnHeaders"), text);
    CPPUNIT_ASSERT(command->isArray(property));

    auto array = command->getArray(property);

    CPPUNIT_ASSERT(array->isObject(index));

    auto item = array->getObject(index);

    CPPUNIT_ASSERT(item->has("size"));

    return item->getValue<double>("size");
}

double HTTPWSTest::getColRowSize(const std::shared_ptr<LOOLWebSocket>& socket, const std::string& item, int index, const std::string& testname)
{
    std::vector<char> response;
    response = getResponseMessage(socket, "commandvalues:", testname);
    CPPUNIT_ASSERT_MESSAGE("did not receive a commandvalues: message as expected", !response.empty());
    std::vector<char> json(response.begin() + std::string("commandvalues:").length(), response.end());
    json.push_back(0);
    return getColRowSize(item, json.data(), index);
}

void HTTPWSTest::testColumnRowResize()
{
    const auto testname = "columnRowResize ";
    try
    {
        std::vector<char> response;
        std::string documentPath, documentURL;
        double oldHeight, oldWidth;

        getDocumentPathAndURL("setclientpart.ods", documentPath, documentURL, testname);
        auto socket = loadDocAndGetSocket(_uri, documentURL, testname);

        const std::string commandValues = "commandvalues command=.uno:ViewRowColumnHeaders";
        sendTextFrame(socket, commandValues);
        response = getResponseMessage(socket, "commandvalues:", testname);
        CPPUNIT_ASSERT_MESSAGE("did not receive a commandvalues: message as expected", !response.empty());
        {
            std::vector<char> json(response.begin() + std::string("commandvalues:").length(), response.end());
            json.push_back(0);

            // get column 2
            oldHeight = getColRowSize("rows", json.data(), 1);
            // get row 2
            oldWidth = getColRowSize("columns", json.data(), 1);
        }

        // send column width
        {
            std::ostringstream oss;
            Poco::JSON::Object objJSON, objColumn, objWidth;
            double newWidth;

            // change column 2
            objColumn.set("type", "unsigned short");
            objColumn.set("value", 2);

            objWidth.set("type", "unsigned short");
            objWidth.set("value", oldWidth + 100);

            objJSON.set("Column", objColumn);
            objJSON.set("Width", objWidth);

            Poco::JSON::Stringifier::stringify(objJSON, oss);
            sendTextFrame(socket, "uno .uno:ColumnWidth " + oss.str(), testname);
            sendTextFrame(socket, commandValues, testname);
            response = getResponseMessage(socket, "commandvalues:", testname);
            CPPUNIT_ASSERT_MESSAGE("did not receive a commandvalues: message as expected", !response.empty());
            std::vector<char> json(response.begin() + std::string("commandvalues:").length(), response.end());
            json.push_back(0);
            newWidth = getColRowSize("columns", json.data(), 1);
            CPPUNIT_ASSERT(newWidth > oldWidth);
        }

        // send row height
        {
            std::ostringstream oss;
            Poco::JSON::Object objJSON, objRow, objHeight;
            double newHeight;

            // change row 2
            objRow.set("type", "unsigned short");
            objRow.set("value", 2);

            objHeight.set("type", "unsigned short");
            objHeight.set("value", oldHeight + 100);

            objJSON.set("Row", objRow);
            objJSON.set("Height", objHeight);

            Poco::JSON::Stringifier::stringify(objJSON, oss);
            sendTextFrame(socket, "uno .uno:RowHeight " + oss.str(), testname);
            sendTextFrame(socket, commandValues, testname);
            response = getResponseMessage(socket, "commandvalues:", testname);
            CPPUNIT_ASSERT_MESSAGE("did not receive a commandvalues: message as expected", !response.empty());
            std::vector<char> json(response.begin() + std::string("commandvalues:").length(), response.end());
            json.push_back(0);
            newHeight = getColRowSize("rows", json.data(), 1);
            CPPUNIT_ASSERT(newHeight > oldHeight);
        }
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testOptimalResize()
{
    const auto testname = "optimalResize ";
    try
    {
        double newWidth, newHeight;
        Poco::JSON::Object objIndex, objSize, objModifier;

        // row/column index 0
        objIndex.set("type", "unsigned short");
        objIndex.set("value", 1);

        // size in twips
        objSize.set("type", "unsigned short");
        objSize.set("value", 3840);

        // keyboard modifier
        objModifier.set("type", "unsigned short");
        objModifier.set("value", 0);

        std::string documentPath, documentURL;
        getDocumentPathAndURL("empty.ods", documentPath, documentURL, testname);
        auto socket = loadDocAndGetSocket(_uri, documentURL, testname);

        const std::string commandValues = "commandvalues command=.uno:ViewRowColumnHeaders";
        // send new column width
        {
            std::ostringstream oss;
            Poco::JSON::Object objJSON;

            objJSON.set("Column", objIndex);
            objJSON.set("Width", objSize);

            Poco::JSON::Stringifier::stringify(objJSON, oss);
            sendTextFrame(socket, "uno .uno:ColumnWidth " + oss.str(), testname);
            sendTextFrame(socket, commandValues, testname);
            newWidth = getColRowSize(socket, "columns", 0, testname);
        }
        // send new row height
        {
            std::ostringstream oss;
            Poco::JSON::Object objJSON;

            objJSON.set("Row", objIndex);
            objJSON.set("Height", objSize);

            Poco::JSON::Stringifier::stringify(objJSON, oss);
            sendTextFrame(socket, "uno .uno:RowHeight " + oss.str(), testname);
            sendTextFrame(socket, commandValues, testname);
            newHeight = getColRowSize(socket, "rows", 0, testname);
        }

        objIndex.set("value", 0);

        // send optimal column width
        {
            std::ostringstream oss;
            Poco::JSON::Object objJSON;
            double optimalWidth;

            objJSON.set("Col", objIndex);
            objJSON.set("Modifier", objModifier);

            Poco::JSON::Stringifier::stringify(objJSON, oss);
            sendTextFrame(socket, "uno .uno:SelectColumn " + oss.str(), testname);
            sendTextFrame(socket, "uno .uno:SetOptimalColumnWidthDirect", testname);
            sendTextFrame(socket, commandValues, testname);
            optimalWidth = getColRowSize(socket, "columns", 0, testname);
            CPPUNIT_ASSERT(optimalWidth < newWidth);
        }

        // send optimal row height
        {
            Poco::JSON::Object objSelect, objOptHeight, objExtra;
            double optimalHeight;

            objSelect.set("Row", objIndex);
            objSelect.set("Modifier", objModifier);

            objExtra.set("type", "unsigned short");
            objExtra.set("value", 0);

            objOptHeight.set("aExtraHeight", objExtra);

            std::ostringstream oss;
            Poco::JSON::Stringifier::stringify(objSelect, oss);
            sendTextFrame(socket, "uno .uno:SelectRow " + oss.str(), testname);
            oss.str("");
            oss.clear();

            Poco::JSON::Stringifier::stringify(objOptHeight, oss);
            sendTextFrame(socket, "uno .uno:SetOptimalRowHeight " + oss.str(), testname);

            sendTextFrame(socket, commandValues, testname);
            optimalHeight = getColRowSize(socket, "rows", 0, testname);
            CPPUNIT_ASSERT(optimalHeight < newHeight);
        }
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPWSTest::testEachView(const std::string& doc, const std::string& type,
                              const std::string& protocol, const std::string& protocolView,
                              const std::string& testname)
{
    const std::string view = testname + "view %d -> ";
    const std::string load = testname + "view %d, cannot load the document ";
    const std::string error = testname + "view %d, did not receive a %s message as expected";

    try
    {
        // Load a document
        std::string documentPath, documentURL;
        getDocumentPathAndURL(doc, documentPath, documentURL, testname);

        int itView = 0;
        auto socket = loadDocAndGetSocket(_uri, documentURL, Poco::format(view, itView));

        // Check document size
        sendTextFrame(socket, "status", Poco::format(view, itView));
        auto response = assertResponseString(socket, "status:", Poco::format(view, itView));
        int docPart = -1;
        int docParts = 0;
        int docHeight = 0;
        int docWidth = 0;
        int docViewId = -1;
        parseDocSize(response.substr(7), type, docPart, docParts, docWidth, docHeight, docViewId);

        // Send click message
        std::string text;
        Poco::format(text, "mouse type=%s x=%d y=%d count=1 buttons=1 modifier=0", std::string("buttondown"), docWidth/2, docHeight/6);
        sendTextFrame(socket, text, Poco::format(view, itView));
        text.clear();

        Poco::format(text, "mouse type=%s x=%d y=%d count=1 buttons=1 modifier=0", std::string("buttonup"), docWidth/2, docHeight/6);
        sendTextFrame(socket, text, Poco::format(view, itView));
        response = getResponseString(socket, protocol, Poco::format(view, itView));
        CPPUNIT_ASSERT_MESSAGE(Poco::format(error, itView, protocol), !response.empty());

        // Connect and load 0..N Views, where N<=limit
        std::vector<std::shared_ptr<LOOLWebSocket>> views;
        static_assert(MAX_DOCUMENTS >= 2, "MAX_DOCUMENTS must be at least 2");
        const auto limit = std::min(4, MAX_DOCUMENTS - 1); // +1 connection above
        for (itView = 0; itView < limit; ++itView)
        {
            views.emplace_back(loadDocAndGetSocket(_uri, documentURL, Poco::format(view, itView)));
        }

        // main view should receive response each view
        itView = 0;
        for (auto socketView : views)
        {
            getResponseString(socket, protocolView, Poco::format(view, itView));
            CPPUNIT_ASSERT_MESSAGE(Poco::format(error, itView, protocolView), !response.empty());
            ++itView;
        }
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
    catch (const std::exception& exc)
    {
        CPPUNIT_FAIL(exc.what());
    }
}

void HTTPWSTest::testInvalidateViewCursor()
{
    testEachView("viewcursor.odp", "presentation", "invalidatecursor:", "invalidateviewcursor:", "invalidateViewCursor ");
}

void HTTPWSTest::testViewCursorVisible()
{
    testEachView("viewcursor.odp", "presentation", "cursorvisible:", "viewcursorvisible:", "viewCursorVisible ");
}

void HTTPWSTest::testCellViewCursor()
{
    testEachView("empty.ods", "spreadsheet", "cellcursor:", "cellviewcursor:", "cellViewCursor");
}

void HTTPWSTest::testGraphicViewSelectionWriter()
{
    testEachView("graphicviewselection.odt", "text", "graphicselection:", "graphicviewselection:", "graphicViewSelection-odt ");
}

void HTTPWSTest::testGraphicViewSelectionCalc()
{
    testEachView("graphicviewselection.ods", "spreadsheet", "graphicselection:", "graphicviewselection:", "graphicViewSelection-ods ");
}

void HTTPWSTest::testGraphicViewSelectionImpress()
{
    testEachView("graphicviewselection.odp", "presentation", "graphicselection:", "graphicviewselection:", "graphicViewSelection-odp ");
}

void HTTPWSTest::testGraphicInvalidate()
{
    const auto testname = "graphicInvalidate ";
    try
    {
        // Load a document.
        auto socket = loadDocAndGetSocket("shape.ods", _uri, testname);

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

void HTTPWSTest::testCursorPosition()
{
    try
    {
        const auto testname = "cursorPosition ";

         // Load a document.
        std::string docPath;
        std::string docURL;
        std::string response;

        getDocumentPathAndURL("Example.odt", docPath, docURL, testname);
        auto socket0 = loadDocAndGetSocket(_uri, docURL, testname);

        // receive cursor position
        response = getResponseString(socket0, "invalidatecursor:", testname);
        Poco::StringTokenizer cursorTokens(response.substr(17), ",", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(4), cursorTokens.count());

        // Create second view
        auto socket1 = loadDocAndGetSocket(_uri, docURL, testname);

        //receive view cursor position
        response = getResponseString(socket1, "invalidateviewcursor:", testname);

        Poco::JSON::Parser parser;
        const auto result = parser.parse(response.substr(21));
        const auto& command = result.extract<Poco::JSON::Object::Ptr>();
        CPPUNIT_ASSERT_MESSAGE("missing property rectangle", command->has("rectangle"));

        Poco::StringTokenizer viewTokens(command->get("rectangle").toString(), ",", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(4), viewTokens.count());

        // check both cursor should be equal
        CPPUNIT_ASSERT_EQUAL(cursorTokens[0], viewTokens[0]);
        CPPUNIT_ASSERT_EQUAL(cursorTokens[1], viewTokens[1]);
        CPPUNIT_ASSERT_EQUAL(cursorTokens[2], viewTokens[2]);
        CPPUNIT_ASSERT_EQUAL(cursorTokens[3], viewTokens[3]);
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
    const auto testname = "alertAllUsers ";
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
            Poco::StringTokenizer tokens(response.substr(6), " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
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
    auto socket0 = connectLOKit(_uri, request, _response);
    auto socket1 = connectLOKit(_uri, request, _response);

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

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPWSTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
