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
class UnitSession : public UnitWSD
{
    TestResult testOneRound();

public:
    UnitSession()
        : UnitWSD("UnitSession")
    {
    }

    void invokeWSDTest() override;
};

UnitBase::TestResult UnitSession::testOneRound()
{
    setTestname(__func__);

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

    return TestResult::Ok;
}

void UnitSession::invokeWSDTest()
{
    UnitBase::TestResult result = testOneRound();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitSession(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
