/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <memory>
#include <string>

#include <HttpRequest.hpp>
#include <Socket.hpp>

#include <Poco/Util/LayeredConfiguration.h>
#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <UserMessages.hpp>
#include <Util.hpp>
#include <helpers.hpp>
#include <vector>

#include "UnitTimeoutBase.hpp"

/// Test suite class for Socket max-duration timeout limit using HTTP and WS sessions.
class UnitTimeoutSocket : public UnitTimeoutBase0
{
    TestResult testHttp();
    TestResult testWSPing();
    TestResult testWSDChatPing();

    void configure(net::Defaults& defaults) override
    {
        // defaults.WSPingTimeout = std::chrono::microseconds(2000000);
        // defaults.WSPingPeriod = std::chrono::microseconds(3000000);
        // defaults.HTTPTimeout = std::chrono::microseconds(30000000);
        // defaults.HTTPTimeout = std::chrono::microseconds(1);
        // defaults.MaxConnections = 9999;
        // defaults.MinBytesPerSec = 0.0;
        defaults.MinBytesPerSec = 100000.0; // 100kBps
        // defaults.SocketPollTimeout = std::chrono::microseconds(64000000);
    }

public:
    UnitTimeoutSocket()
        : UnitTimeoutBase0("UnitTimeoutSocket")
    {
    }

    void invokeWSDTest() override;
};

UnitBase::TestResult UnitTimeoutSocket::testHttp()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    const std::string documentURL = "/favicon.ico";

    // Keep alive socket, avoid forced socket disconnect via dtor
    TerminatingPoll socketPoller(testname);
    socketPoller.runOnClientThread();

    const int sockCount = 4;
    // Reused http session, keep-alive
    std::vector<std::shared_ptr<http::Session>> sessions;

    try
    {
        for(int sockIdx = 0; sockIdx < sockCount; ++sockIdx) {
            sessions.push_back( http::Session::create(helpers::getTestServerURI()) );
            TST_LOG("Test: " << testname << "[" << sockIdx << "]: `" << documentURL << "`");
            http::Request request(documentURL, http::Request::VERB_GET);
            const std::shared_ptr<const http::Response> response =
                sessions[sockIdx]->syncRequest(request, socketPoller);
            TST_LOG("Response: " << response->header().toString());
            TST_LOG("Response size: " << testname << "[" << sockIdx << "]: `" << documentURL << "`: " << response->header().getContentLength());
            LOK_ASSERT_EQUAL(http::StatusCode::OK, response->statusCode());
            LOK_ASSERT_EQUAL(true, sessions[sockIdx]->isConnected());
            LOK_ASSERT(http::Header::ConnectionToken::None ==
                       response->header().getConnectionToken());
            LOK_ASSERT(0 < response->header().getContentLength());
        }
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    LOK_ASSERT_EQUAL(true, pollDisconnected(std::chrono::microseconds(1000000), sessions, &socketPoller));

    TST_LOG("Clearing Sessions: " << testname);
    sessions.clear();
    TST_LOG("Clearing Poller: " << testname);
    socketPoller.closeAllSockets();
    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

/// Test the native WebSocket control-frame ping/pong facility -> No Timeout!
UnitBase::TestResult UnitTimeoutSocket::testWSPing()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    std::shared_ptr<http::WebSocketSession> session = http::WebSocketSession::create(helpers::getTestServerURI());
    http::Request req(documentURL);
    session->asyncRequest(req, socketPoll());

    // wsd/ClientSession.cpp:709 sendTextFrameAndLogError("error: cmd=" + tokens[0] + " kind=nodocloaded");
    constexpr const bool loadDoc = true; // Required for WSD chat -> wsd/ClientSession.cpp:709, common/Session.hpp:160
    if( loadDoc ) {
        session->sendMessage("load url=" + documentURL);
    }

    LOK_ASSERT_EQUAL(true, session->isConnected());

    assertMessage(*session, "progress:", "find");
    assertMessage(*session, "progress:", "connect");
    assertMessage(*session, "progress:", "ready");

    LOK_ASSERT_EQUAL(true, pollDisconnected(std::chrono::microseconds(1000000), *session));

    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

/// Tests the WSD chat ping/pong facility, where client sends the ping.
/// See: https://github.com/CollaboraOnline/online/blob/master/wsd/protocol.txt/
UnitBase::TestResult UnitTimeoutSocket::testWSDChatPing()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    std::shared_ptr<http::WebSocketSession> session = http::WebSocketSession::create(helpers::getTestServerURI());
    http::Request req(documentURL);
    session->asyncRequest(req, socketPoll());

    // wsd/ClientSession.cpp:709 sendTextFrameAndLogError("error: cmd=" + tokens[0] + " kind=nodocloaded");
    constexpr const bool loadDoc = true; // Required for WSD chat -> wsd/ClientSession.cpp:709, common/Session.hpp:160
    if( loadDoc ) {
        session->sendMessage("load url=" + documentURL);
    }

    LOK_ASSERT_EQUAL(true, session->isConnected());

    assertMessage(*session, "progress:", "find");
    assertMessage(*session, "progress:", "connect");
    assertMessage(*session, "progress:", "ready");

    session->sendMessage("ping");
    assertMessage(*session, "", "pong");

    LOK_ASSERT_EQUAL(true, pollDisconnected(std::chrono::microseconds(1000000), *session));

    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

void UnitTimeoutSocket::invokeWSDTest()
{
    UnitBase::TestResult result = TestResult::Ok;

    result = testHttp();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testWSPing();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testWSDChatPing();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitTimeoutSocket(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
