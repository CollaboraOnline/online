/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <chrono>
#include <config.h>

#include <errno.h>
#include <signal.h>
#include <sys/types.h>

#include <cstring>

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
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>
#include <cppunit/extensions/HelperMacros.h>

#include <Common.hpp>
#include <UserMessages.hpp>
#include <Util.hpp>
#include <Protocol.hpp>
#include <LOOLWebSocket.hpp>
#include <test.hpp>
#include <helpers.hpp>
#include <countloolkits.hpp>

using namespace helpers;

/// Tests the HTTP WebSocket API of loolwsd. The server has to be started manually before running this test.
class HTTPCrashTest : public CPPUNIT_NS::TestFixture
{
    const Poco::URI _uri;
    Poco::Net::HTTPResponse _response;
    SocketPoll _socketPoll;

    CPPUNIT_TEST_SUITE(HTTPCrashTest);

    CPPUNIT_TEST(testBarren);
    CPPUNIT_TEST(testCrashKit);
    CPPUNIT_TEST(testRecoverAfterKitCrash);
    CPPUNIT_TEST(testCrashForkit);

    CPPUNIT_TEST_SUITE_END();

    void testBarren();
    void testCrashKit();
    void testRecoverAfterKitCrash();
    void testCrashForkit();

    static
    void killLoKitProcesses();
    void killForkitProcess();

public:
    HTTPCrashTest()
        : _uri(helpers::getTestServerURI())
        , _socketPoll("HttpCrashPoll")
    {
#if ENABLE_SSL
        Poco::Net::initializeSSL();
        // Just accept the certificate anyway for testing purposes
        Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidCertHandler = new Poco::Net::AcceptCertificateHandler(false);
        Poco::Net::Context::Params sslParams;
        Poco::Net::Context::Ptr sslContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslParams);
        Poco::Net::SSLManager::instance().initializeClient(nullptr, invalidCertHandler, sslContext);
#endif
        _socketPoll.startThread();
    }

    ~HTTPCrashTest()
    {
        _socketPoll.joinThread();
#if ENABLE_SSL
        Poco::Net::uninitializeSSL();
#endif
    }

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

void HTTPCrashTest::testBarren()
{
#if 0 // FIXME why does this fail?
    // Kill all kit processes and try loading a document.
    const char* testname = "barren ";
    try
    {
        killLoKitProcesses();
        countLoolKitProcesses(0);

        TST_LOG("Loading after kill.");

        // Load a document and get its status.
        std::shared_ptr<http::WebSocketSession> socket
            = loadDocAndGetSession(_socketPoll, "hello.odt", _uri, testname);

        sendTextFrame(socket, "status", testname);
        assertResponseString(socket, "status:", testname);

        socket->asyncShutdown(_socketPoll);

        LOK_ASSERT_MESSAGE("Expected successful disconnection of the WebSocket",
                           socket->waitForDisconnection(std::chrono::seconds(5)));
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
#endif
}

void HTTPCrashTest::testCrashKit()
{
    const char* testname = "crashKit ";
    try
    {
        std::shared_ptr<http::WebSocketSession> socket
            = loadDocAndGetSession(_socketPoll, "empty.odt", _uri, testname);

        TST_LOG("Allowing time for kits to spawn and connect to wsd to get cleanly killed");
        std::this_thread::sleep_for(std::chrono::seconds(1));

        TST_LOG("Killing loolkit instances.");

        killLoKitProcesses();
        countLoolKitProcesses(0, std::chrono::seconds(1));

        TST_LOG("Reading the error code from the socket.");
        //FIXME: implement in WebSocketSession.
        // std::string message;
        // const int statusCode = getErrorCode(socket, message, testname);
        // LOK_ASSERT_EQUAL(static_cast<int>(Poco::Net::WebSocket::WS_ENDPOINT_GOING_AWAY), statusCode);

        // respond close frame
        TST_LOG("Shutting down socket.");
        socket->asyncShutdown(_socketPoll);

        LOK_ASSERT_MESSAGE("Expected successful disconnection of the WebSocket",
                           socket->waitForDisconnection(std::chrono::seconds(5)));
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
}

void HTTPCrashTest::testRecoverAfterKitCrash()
{
    const char* testname = "recoverAfterKitCrash ";
    try
    {
        std::shared_ptr<http::WebSocketSession> socket1
            = loadDocAndGetSession(_socketPoll, "empty.odt", _uri, testname);

        TST_LOG("Allowing time for kits to spawn and connect to wsd to get cleanly killed");
        std::this_thread::sleep_for(std::chrono::seconds(1));

        TST_LOG("Killing loolkit instances.");

        killLoKitProcesses();
        countLoolKitProcesses(0, std::chrono::seconds(1));

        // We expect the client connection to close.
        TST_LOG("Reconnect after kill.");

        std::shared_ptr<http::WebSocketSession> socket2 = loadDocAndGetSession(
            _socketPoll, "empty.odt", _uri, testname, /*isView=*/true, /*isAssert=*/false);
        if (!socket2)
        {
            // In case still starting up.
            sleep(2);
            socket2 = loadDocAndGetSession(_socketPoll, "empty.odt", _uri, testname);
        }

        sendTextFrame(socket2, "status", testname);
        assertResponseString(socket2, "status:", testname);

        socket2->asyncShutdown(_socketPoll);
        socket1->asyncShutdown(_socketPoll);

        LOK_ASSERT_MESSAGE("Expected successful disconnection of the WebSocket 2",
                           socket2->waitForDisconnection(std::chrono::seconds(5)));
        LOK_ASSERT_MESSAGE("Expected successful disconnection of the WebSocket 1",
                           socket1->waitForDisconnection(std::chrono::seconds(5)));
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
}

void HTTPCrashTest::testCrashForkit()
{
    const char* testname = "crashForkit ";
    try
    {
        std::shared_ptr<http::WebSocketSession> socket
            = loadDocAndGetSession(_socketPoll, "empty.odt", _uri, testname);

        TST_LOG("Killing forkit.");
        killForkitProcess();
        TST_LOG("Communicating after kill.");

        sendTextFrame(socket, "status", testname);
        assertResponseString(socket, "status:", testname);

        // respond close frame
        socket->asyncShutdown(_socketPoll);
        LOK_ASSERT_MESSAGE("Expected successful disconnection of the WebSocket",
                           socket->waitForDisconnection(std::chrono::seconds(5)));

        TST_LOG("Killing loolkit.");
        killLoKitProcesses();
        countLoolKitProcesses(0);
        TST_LOG("Communicating after kill.");
        socket = loadDocAndGetSession(_socketPoll, "empty.odt", _uri, testname);
        socket->asyncShutdown(_socketPoll);
        LOK_ASSERT_MESSAGE("Expected successful disconnection of the WebSocket",
                           socket->waitForDisconnection(std::chrono::seconds(5)));
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
}

static void killPids(const std::vector<int> &pids, const std::string& testname)
{
    TST_LOG("kill pids " << pids.size());
    // Now kill them
    for (int pid : pids)
    {
        TST_LOG_BEGIN("Killing " << pid);
        if (kill(pid, SIGKILL) == -1)
            TST_LOG_APPEND("kill(" << pid << ", SIGKILL) failed: " << Util::symbolicErrno(errno) << ": " << std::strerror(errno));
        TST_LOG_END;
    }
}

void HTTPCrashTest::killLoKitProcesses()
{
    killPids(getKitPids(), "killLoKitProcesses ");
    InitialLoolKitCount = 1; // non-intuitive but it will arrive soon.
}

void HTTPCrashTest::killForkitProcess()
{
    killPids(getForKitPids(), "killForkitProcess ");
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPCrashTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
