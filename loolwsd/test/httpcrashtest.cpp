/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

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

/// Tests the HTTP WebSocket API of loolwsd. The server has to be started manually before running this test.
class HTTPCrashTest : public CPPUNIT_NS::TestFixture
{
    const Poco::URI _uri;
    Poco::Net::HTTPResponse _response;

    CPPUNIT_TEST_SUITE(HTTPCrashTest);

    CPPUNIT_TEST(testCrashKit);

    CPPUNIT_TEST_SUITE_END();

    void testCrashKit();

    static
    void sendTextFrame(Poco::Net::WebSocket& socket, const std::string& string);

    static
    bool isDocumentLoaded(Poco::Net::WebSocket& socket);

    std::shared_ptr<Poco::Net::WebSocket>
    connectLOKit(Poco::Net::HTTPRequest& request,
                 Poco::Net::HTTPResponse& response);

public:
    HTTPCrashTest()
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
    ~HTTPCrashTest()
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

void HTTPCrashTest::testCrashKit()
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

        // simulate crash all lokit process
        for (auto it = Poco::DirectoryIterator(std::string("/proc")); it != Poco::DirectoryIterator(); ++it)
        {
            try
            {
                Poco::Path procEntry = it.path();
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
                    const std::string killLOKit = "kill -9 " + std::to_string(pid);
                    Poco::FileInputStream stat(procEntry.toString() + "/stat");
                    std::string statString;
                    Poco::StreamCopier::copyToString(stat, statString);
                    Poco::StringTokenizer tokens(statString, " ");
                    if (tokens.count() > 3 && tokens[1] == "(loolkit)")
                    {
                        const auto res = std::system(killLOKit.c_str());
                        if (res != 0)
                        {
                            std::cerr << "exit " + std::to_string(res) + " from " + killLOKit << std::endl;
                        }
                    }
                }
            }
            catch (const Poco::Exception&)
            {
            }
        }

        // 5 seconds timeout
        socket.setReceiveTimeout(5000000);

        // receive close frame handshake
        do
        {
            bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
        }
        while ((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);

        // respond close frame
        socket.shutdown();
        // no more messages is received.
        bytes = socket.receiveFrame(buffer, sizeof(buffer), flags);
        std::string received(buffer);
        CPPUNIT_ASSERT_EQUAL(0, bytes);
        CPPUNIT_ASSERT_EQUAL(0, flags);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void HTTPCrashTest::sendTextFrame(Poco::Net::WebSocket& socket, const std::string& string)
{
    socket.sendFrame(string.data(), string.size());
}

bool HTTPCrashTest::isDocumentLoaded(Poco::Net::WebSocket& ws)
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

// Connecting to a Kit process is managed by document broker, that it does several
// jobs to establish the bridge connection between the Client and Kit process,
// The result, it is mostly time outs to get messages in the unit test and it could fail.
// connectLOKit ensures the websocket is connected to a kit process.

std::shared_ptr<Poco::Net::WebSocket>
HTTPCrashTest::connectLOKit(Poco::Net::HTTPRequest& request,
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

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPCrashTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
