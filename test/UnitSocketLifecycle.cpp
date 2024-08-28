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

#include <Poco/DOM/DOMParser.h>
#include <Poco/DOM/Document.h>
#include <Poco/DOM/Node.h>
#include <Poco/DOM/NodeFilter.h>
#include <Poco/DOM/NodeIterator.h>
#include <Poco/SAX/InputSource.h>
#include <Poco/URI.h>
#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <UserMessages.hpp>
#include <Util.hpp>
#include <helpers.hpp>
#include <vector>

/// Test suite that uses a HTTP session (and not just a socket) directly.
class UnitSocketLifecycle : public UnitWSD
{
    TestResult testOneHTTPSession();
    TestResult testWebsockNativePingPong();
    TestResult testWebsockWSDChatPingPong();

public:
    UnitSocketLifecycle()
        : UnitWSD("UnitSocketLifecycle")
    {
    }

    void invokeWSDTest() override;
};

UnitBase::TestResult UnitSocketLifecycle::testOneHTTPSession()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    const std::string documentURL = "/favicon.ico";

    // Keep alive socket, avoid forced socket disconnect via dtor
    TerminatingPoll socketPoller(testname);
    socketPoller.runOnClientThread();

    const int sockCount = 1;
    // Reused http session, keep-alive
    std::vector<std::shared_ptr<http::Session>>
        sessions; //  = http::Session::create(helpers::getTestServerURI());

    try
    {
        for(int sockIdx = 0; sockIdx < sockCount; ++sockIdx) {
            sessions.push_back( http::Session::create(helpers::getTestServerURI()) );
            if (sockIdx > 0)
            {
                LOK_ASSERT_EQUAL(true, sessions[sockIdx]->isConnected());
            }
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
    for (std::shared_ptr<http::Session>& session : sessions)
    {
        LOK_ASSERT_EQUAL(true, session->isConnected());
    }
    TST_LOG("Test: XXX " << testname << " w/ " << sockCount << " connections, sleep...");
    std::this_thread::sleep_for(std::chrono::seconds(4));
    TST_LOG("Test: XXX " << testname << " w/ " << sockCount << " connections, done!");

    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

/// Attempt to test the native WebSocket control-frame ping/pong facility.
/// Not working yet due to wrong thread affinity error from sending socket (by client)
UnitBase::TestResult UnitSocketLifecycle::testWebsockNativePingPong()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    // NOTE: Do not replace with wrappers. This has to be explicit.
    std::shared_ptr<http::WebSocketSession> wsSession = http::WebSocketSession::create(helpers::getTestServerURI());
    http::Request req(documentURL);
    wsSession->asyncRequest(req, socketPoll());

    constexpr const bool loadDoc = true;
    if( loadDoc ) {
        wsSession->sendMessage("load url=" + documentURL);
    }

    auto assertMessage = [&wsSession, this](const std::string expectedPrefix, const std::string expectedId)
    {
        wsSession->poll(
            [&](const std::vector<char>& message) -> bool
            {
                const std::string msg(std::string(message.begin(), message.end()));
                TST_LOG("Got WS response: " << msg);
                if (!msg.starts_with("error:"))
                {
                    if( expectedPrefix == "progress:") {
                        LOK_ASSERT_EQUAL(COOLProtocol::matchPrefix(expectedPrefix, msg), true);
                        LOK_ASSERT(helpers::getProgressWithIdValue(msg, expectedId));
                        TST_LOG("Good WS response(0): " << msg);
                        return true;
                    } else if( msg.find(expectedId) != std::string::npos ) {
                        // simple match
                        TST_LOG("Good WS response(1): " << msg);
                        return true;
                    } else {
                        return false; // continue waiting for 'it'
                    }
                }
                else
                {
                    // check error message
                    LOK_ASSERT_EQUAL(std::string(SERVICE_UNAVAILABLE_INTERNAL_ERROR), msg);

                    // close frame message
                    //TODO: check that the socket is closed.
                    return true;
                }
            },
            std::chrono::seconds(10), testname);
    };

    if( loadDoc ) {
        assertMessage("progress:", "find");
        assertMessage("progress:", "connect");
        assertMessage("progress:", "ready");
    }

    /// THIS DOES NOT WORK!
    /// wsSession->sendPing(std::chrono::steady_clock::now());
    /// assertMessage("", "pong");

    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

/// Tests the WSD chat ping/pong facility, where client sends the ping.
/// See: https://github.com/CollaboraOnline/online/blob/master/wsd/protocol.txt/
UnitBase::TestResult UnitSocketLifecycle::testWebsockWSDChatPingPong()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    // NOTE: Do not replace with wrappers. This has to be explicit.
    std::shared_ptr<http::WebSocketSession> wsSession = http::WebSocketSession::create(helpers::getTestServerURI());
    http::Request req(documentURL);
    wsSession->asyncRequest(req, socketPoll());

    // wsd/ClientSession.cpp:709 sendTextFrameAndLogError("error: cmd=" + tokens[0] + " kind=nodocloaded");
    constexpr const bool loadDoc = true; // Required for WSD chat -> wsd/ClientSession.cpp:709, common/Session.hpp:160
    if( loadDoc ) {
        wsSession->sendMessage("load url=" + documentURL);
    }

    auto assertMessage = [&wsSession, this](const std::string expectedPrefix, const std::string expectedId)
    {
        wsSession->poll(
            [&](const std::vector<char>& message) -> bool
            {
                const std::string msg(std::string(message.begin(), message.end()));
                TST_LOG("Got WS response: " << msg);
                if (!msg.starts_with("error:"))
                {
                    if( expectedPrefix == "progress:") {
                        LOK_ASSERT_EQUAL(COOLProtocol::matchPrefix(expectedPrefix, msg), true);
                        LOK_ASSERT(helpers::getProgressWithIdValue(msg, expectedId));
                        TST_LOG("Good WS response(0): " << msg);
                        return true;
                    } else if( msg.find(expectedId) != std::string::npos ) {
                        // simple match
                        TST_LOG("Good WS response(1): " << msg);
                        return true;
                    } else {
                        return false; // continue waiting for 'it'
                    }
                }
                else
                {
                    // check error message
                    LOK_ASSERT_EQUAL(std::string(SERVICE_UNAVAILABLE_INTERNAL_ERROR), msg);

                    // close frame message
                    //TODO: check that the socket is closed.
                    return true;
                }
            },
            std::chrono::seconds(10), testname);
    };

    assertMessage("progress:", "find");
    assertMessage("progress:", "connect");
    assertMessage("progress:", "ready");

    wsSession->sendMessage("ping");
    assertMessage("", "pong");

    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

void UnitSocketLifecycle::invokeWSDTest()
{
    UnitBase::TestResult result;

    result = testOneHTTPSession();
    if (result != TestResult::Ok)
        exitTest(result);

    if( false ) {
        result = testWebsockNativePingPong();
        if (result != TestResult::Ok)
            exitTest(result);
    }

    result = testWebsockWSDChatPingPong();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitSocketLifecycle(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
