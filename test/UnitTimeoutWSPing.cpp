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
#include <Poco/Util/LayeredConfiguration.h>
#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <UserMessages.hpp>
#include <Util.hpp>
#include <helpers.hpp>
#include <vector>

/// Test suite that uses a HTTP session (and not just a socket) directly.
class UnitTimeoutWSPing : public UnitWSD
{
    TestResult testWSPingTimeout();

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);

        config.setInt("net.ws.ping.timeout",    20); // WebSocketHandler ping timeout in us (2s). Zero disables metric.
        config.setInt("net.ws.ping.period",  10000); // WebSocketHandler ping period in us (3s), i.e. duration until next ping.
    }

public:
    UnitTimeoutWSPing()
        : UnitWSD("UnitTimeoutWSPing")
    {
    }

    void invokeWSDTest() override;
};

/// Attempt to test the native WebSocket control-frame ping/pong facility -> Timeout!
UnitBase::TestResult UnitTimeoutWSPing::testWSPingTimeout()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    const int sockCount = 1;

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
    LOK_ASSERT_EQUAL(true, wsSession->isConnected());

    assertMessage("progress:", "find");
    assertMessage("progress:", "connect");
    assertMessage("progress:", "ready");

    TST_LOG("Test: XXX " << testname << " w/ " << sockCount << " connections, sleep...");
    std::this_thread::sleep_for(std::chrono::seconds(2));
    TST_LOG("Test: XXX " << testname << " w/ " << sockCount << " connections, sleep done!");

    LOK_ASSERT_EQUAL(false, wsSession->isConnected());

    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

void UnitTimeoutWSPing::invokeWSDTest()
{
    UnitBase::TestResult result;

    result = testWSPingTimeout();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitTimeoutWSPing(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
