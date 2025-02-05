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
#include <thread>

#include "UnitTimeoutBase.hpp"

/// Test suite class for inactivity across WS and Http.
class UnitTimeoutInactivity : public UnitTimeoutBase0
{
    TestResult testHttp(bool forceInactivityTO);
    TestResult testWS(bool forceInactivityTO);

    void configure(Poco::Util::LayeredConfiguration& /* config */) override
    {
        // net::Defaults.inactivityTimeout = std::chrono::seconds(3600);
        net::Defaults.inactivityTimeout = std::chrono::milliseconds(360);
        //
        // The following WSPing setup would cause ping/pong packages avoiding the inactivity TO
        //   net::Defaults.wsPingAvgTimeout = std::chrono::microseconds(25);
        //   net::Defaults.wsPingInterval = std::chrono::milliseconds(30);
    }

public:
    UnitTimeoutInactivity()
        : UnitTimeoutBase0("UnitTimeoutInactivity")
    {
    }

    void invokeWSDTest() override;
};

inline UnitBase::TestResult UnitTimeoutInactivity::testHttp(bool forceInactivityTO)
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname << ": forceInactivityTO " << forceInactivityTO);

    const std::string documentURL = "/favicon.ico";

    constexpr bool UseOwnPoller = true;
    constexpr bool PollerOnClientThread = true;
    std::shared_ptr<SocketPoll> socketPoller;
    std::shared_ptr<http::Session> session;

    try
    {
        if( UseOwnPoller )
        {
            socketPoller = std::make_shared<TerminatingPoll>(testname);
            if( PollerOnClientThread )
                socketPoller->runOnClientThread();
            else
                socketPoller->startThread();
        } else
            socketPoller = socketPoll();

        session = http::Session::create(helpers::getTestServerURI());
        {
            TST_LOG("Test Req1: " << testname << ": `" << documentURL << "`");
            http::Request request(documentURL, http::Request::VERB_GET);
            const std::shared_ptr<const http::Response> response =
                session->syncRequest(request, *socketPoller);
            TST_LOG("Response1: " << response->header().toString());
            TST_LOG("Response1 size: " << testname << ": `" << documentURL << "`: " << response->header().getContentLength());
            if( session->isConnected() ) {
                LOK_ASSERT_EQUAL(http::StatusCode::OK, response->statusCode());
                LOK_ASSERT(http::Header::ConnectionToken::None ==
                           response->header().getConnectionToken());
                LOK_ASSERT(0 < response->header().getContentLength());
            } else {
                // connection limit hit
                LOK_ASSERT_EQUAL(http::StatusCode::None, response->statusCode());
            }
        }
        if( session->isConnected() ) {
            if (forceInactivityTO) {
                std::this_thread::sleep_for( net::Defaults.inactivityTimeout * 2 );
            }
            TST_LOG("Test Req2: " << testname << ": `" << documentURL << "`");
            http::Request request(documentURL, http::Request::VERB_GET);
            const std::shared_ptr<const http::Response> response =
                session->syncRequest(request, *socketPoller);
            TST_LOG("Response2: " << response->header().toString());
            TST_LOG("Response2 size: " << testname << ": `" << documentURL << "`: " << response->header().getContentLength());
            if( session->isConnected() ) {
                LOK_ASSERT_EQUAL(http::StatusCode::OK, response->statusCode());
                LOK_ASSERT(http::Header::ConnectionToken::None ==
                           response->header().getConnectionToken());
                LOK_ASSERT(0 < response->header().getContentLength());
            } else {
                // inactivity limit hit
                LOK_ASSERT_EQUAL(http::StatusCode::None, response->statusCode());
            }
        }
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    size_t connected = 0;
    {
        TST_LOG("SessionA " << ": connected " << session->isConnected());
        if( session->isConnected() )
        {
            ++connected;
            session->asyncShutdown();
        }
        if( UseOwnPoller ) {
            if( PollerOnClientThread )
            {
                socketPoller->closeAllSockets();
            } else {
                socketPoller->joinThread();
            }
        }
    }
    TST_LOG("Test: X01 Connected: " << connected);
    if( forceInactivityTO )
    {
        LOK_ASSERT(0 == connected);
    } else {
        LOK_ASSERT(1 == connected);
    }

    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

UnitBase::TestResult UnitTimeoutInactivity::testWS(bool forceInactivityTO)
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname << ": forceInactivityTO " << forceInactivityTO);

    std::shared_ptr<http::WebSocketSession> session;

    try
    {
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

        // NOTE: Do not replace with wrappers. This has to be explicit.
        session = http::WebSocketSession::create(helpers::getTestServerURI());
        http::Request req(documentURL);
        session->asyncRequest(req, socketPoll());
        session->sendMessage("load url=" + documentURL);
        TST_LOG("Test: XX0 " << testname << ": connected " << session->isConnected());

        assertMessage(*session, "progress:", "find");
        assertMessage(*session, "progress:", "connect");
        assertMessage(*session, "progress:", "ready");
        TST_LOG("Test: XX1 " << testname << ": connected " << session->isConnected());
        LOK_ASSERT_EQUAL(true, session->isConnected());

        if (forceInactivityTO) {
            std::this_thread::sleep_for( net::Defaults.inactivityTimeout * 2 );
        }
        TST_LOG("Test: XX2 " << testname << ": connected " << session->isConnected());
        session->sendMessage("ping");
        TST_LOG("Test: XX3b " << testname << ": connected " << session->isConnected());
        assertMessage(*session, "", "pong");
        TST_LOG("Test: XX3c " << testname << ": connected " << session->isConnected());
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    size_t connected = 0;
    {
        TST_LOG("SessionA " << ": connected " << session->isConnected());
        if( session->isConnected() )
        {
            ++connected;
            session->asyncShutdown();
        }
    }
    TST_LOG("Test: X01 Connected: " << connected);
    if( forceInactivityTO )
    {
        LOK_ASSERT(0 == connected);
    } else {
        LOK_ASSERT(1 == connected);
    }

    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

void UnitTimeoutInactivity::invokeWSDTest()
{
    UnitBase::TestResult result;

    result = testHttp(/*forceInactivityTO=*/false);
    if (result != TestResult::Ok)
        exitTest(result);
    result = testHttp(/*forceInactivityTO=*/true);
    if (result != TestResult::Ok)
        exitTest(result);

    result = testWS(/*forceInactivityTO=*/false);
    if (result != TestResult::Ok)
        exitTest(result);
    result = testWS(/*forceInactivityTO=*/true);
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitTimeoutInactivity(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
