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

#include "UnitTimeoutBase.hpp"

/// Test suite class for WS Ping (native frame) timeout limit using a WS sessions.
class UnitTimeoutWSPing : public UnitTimeoutBase0
{
    TestResult testWSPing();

    void configure(net::Defaults& defaults) override
    {
        // defaults.WSPingTimeout = std::chrono::microseconds(2000000);
        // defaults.WSPingPeriod = std::chrono::microseconds(3000000);
        defaults.WSPingTimeout = std::chrono::microseconds(20);
        defaults.WSPingPeriod = std::chrono::microseconds(10000);
        // defaults.HTTPTimeout = std::chrono::microseconds(30000000);
        // defaults.MaxConnections = 9999;
        // defaults.MinBytesPerSec = 0.0;
        // defaults.SocketPollTimeout = std::chrono::microseconds(64000000);
    }

public:
    UnitTimeoutWSPing()
        : UnitTimeoutBase0("UnitTimeoutWSPing")
    {
    }

    void invokeWSDTest() override;
};

/// Attempt to test the native WebSocket control-frame ping/pong facility -> Timeout!
UnitBase::TestResult UnitTimeoutWSPing::testWSPing()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    // NOTE: Do not replace with wrappers. This has to be explicit.
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

void UnitTimeoutWSPing::invokeWSDTest()
{
    UnitBase::TestResult result;

    result = testWSPing();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitTimeoutWSPing(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
