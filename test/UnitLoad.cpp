/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <chrono>
#include <config.h>

#include <memory>
#include <ostream>
#include <set>
#include <string>
#include <thread>

#include <Poco/Exception.h>
#include <Poco/URI.h>
#include <Poco/Util/LayeredConfiguration.h>

#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <helpers.hpp>
#include <net/WebSocketSession.hpp>

class LOOLWebSocket;

namespace
{
void loadDoc(const std::string& documentURL, const std::string& testname)
{
    try
    {
        // Load a document and wait for the status.
        // Don't replace with helpers, so we catch status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::URI uri(helpers::getTestServerURI());
        Poco::Net::HTTPResponse response;
        std::shared_ptr<LOOLWebSocket> socket
            = helpers::connectLOKit(uri, request, response, testname);
        helpers::sendTextFrame(socket, "load url=" + documentURL, testname);

        helpers::assertResponseString(socket, "status:", testname);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
}
}

/// Test suite for loading.
class UnitLoad : public UnitWSD
{
    TestResult testConnectNoLoad();
    TestResult testLoadSimple();
    TestResult testBadLoad();
    TestResult testExcelLoad();
    TestResult testReload();
    TestResult testLoad();

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);

        config.setBool("ssl.enable", true);
    }

public:
    void invokeWSDTest() override;
};

UnitBase::TestResult UnitLoad::testConnectNoLoad()
{
    const char* testname1 = "connectNoLoad-1 ";
    const char* testname2 = "connectNoLoad-2 ";
    const char* testname3 = "connectNoLoad-3 ";

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, "connectNoLoad ");

    // Connect and disconnect without loading.
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
    TST_LOG_NAME(testname1, "Connecting first to disconnect without loading.");
    Poco::Net::HTTPResponse response;
    Poco::URI uri(helpers::getTestServerURI());
    std::shared_ptr<LOOLWebSocket> socket
        = helpers::connectLOKit(uri, request, response, testname1);
    LOK_ASSERT_MESSAGE("Failed to connect.", socket);
    TST_LOG_NAME(testname1, "Disconnecting first.");
    socket.reset();

    sleep(1); // paranoia.

    // Connect and load first view.
    TST_LOG_NAME(testname2, "Connecting second to load first view.");
    std::shared_ptr<LOOLWebSocket> socket1
        = helpers::connectLOKit(uri, request, response, testname2);
    LOK_ASSERT_MESSAGE("Failed to connect.", socket1);
    helpers::sendTextFrame(socket1, "load url=" + documentURL, testname2);
    LOK_ASSERT_MESSAGE("cannot load the document " + documentURL,
                           helpers::isDocumentLoaded(socket1, testname2));

    // Connect but don't load second view.
    TST_LOG_NAME(testname3, "Connecting third to disconnect without loading.");
    std::shared_ptr<LOOLWebSocket> socket2
        = helpers::connectLOKit(uri, request, response, testname3);
    LOK_ASSERT_MESSAGE("Failed to connect.", socket2);
    TST_LOG_NAME(testname3, "Disconnecting third.");
    socket2.reset();

    TST_LOG_NAME(testname2, "Getting status from first view.");
    helpers::sendTextFrame(socket1, "status", testname2);
    helpers::assertResponseString(socket1, "status:", testname2);

    TST_LOG_NAME(testname2, "Disconnecting second.");
    socket1.reset();
    return TestResult::Ok;
}

UnitBase::TestResult UnitLoad::testLoadSimple()
{
    const char* testname = "loadSimple ";

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);
    loadDoc(documentURL, "load ");
    return TestResult::Ok;
}

UnitBase::TestResult UnitLoad::testBadLoad()
{
    const char* testname = "badLoad ";
    try
    {
        // Load a document and get its status.
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::URI uri(helpers::getTestServerURI());
        Poco::Net::HTTPResponse response;
        std::shared_ptr<LOOLWebSocket> socket
            = helpers::connectLOKit(uri, request, response, testname);

        // Before loading request status.
        helpers::sendTextFrame(socket, "status");

        const auto line = helpers::assertResponseString(socket, "error:", testname);
        LOK_ASSERT_EQUAL(std::string("error: cmd=status kind=nodocloaded"), line);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitLoad::testExcelLoad()
{
    const char* testname = "excelLoad ";
    try
    {
        // Load a document and get status.
        Poco::URI uri(helpers::getTestServerURI());
        std::shared_ptr<LOOLWebSocket> socket
            = helpers::loadDocAndGetSocket("timeline.xlsx", uri, testname);

        helpers::sendTextFrame(socket, "status", testname);
        const auto status = helpers::assertResponseString(socket, "status:", testname);

        // Expected format is something like 'status: type=text parts=2 current=0 width=12808 height=1142 viewid=0\n...'.
        StringVector tokens(Util::tokenize(status, ' '));
        LOK_ASSERT_EQUAL(static_cast<size_t>(7), tokens.size());
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitLoad::testReload()
{
    const char* testname = "reload ";

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);
    for (int i = 0; i < 3; ++i)
    {
        TST_LOG("loading #" << (i + 1));
        loadDoc(documentURL, testname);
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitLoad::testLoad()
{
    const char* testname = "load ";

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    SocketPoll socketPoll("UnitLoadPoll");
    socketPoll.startThread();

    auto wsSession
        = http::WebSocketSession::create(socketPoll, helpers::getTestServerURI(), documentURL);

    TST_LOG("Loading " << documentURL);
    wsSession->sendMessage("load url=" + documentURL);

    std::vector<char> message = wsSession->waitForMessage("status:", std::chrono::seconds(50));
    LOK_ASSERT_MESSAGE("Failed to load the document", !message.empty());

    socketPoll.joinThread();
    return TestResult::Ok;
}

void UnitLoad::invokeWSDTest()
{
    // FIXME fails on Jenkins for some reason.
    UnitBase::TestResult result = testLoad();
    if (result != TestResult::Ok)
        exitTest(result);

#if 0
    result = testConnectNoLoad();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testLoadSimple();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testLoadSimple();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testExcelLoad();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testReload();
    if (result != TestResult::Ok)
        exitTest(result);
#endif

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitLoad(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
