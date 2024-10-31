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

/// Test suite class for injected StreamSocket ctor exceptions, handled by ServerSocket::accept
class UnitStreamSocketCtorFailure1 : public UnitTimeoutBase0
{
    TestResult testHttp();

public:
    UnitStreamSocketCtorFailure1()
        : UnitTimeoutBase0("UnitStreamSocketCtorFailure1")
    {
    }

    void invokeWSDTest() override;
    void simulateExternalSocketCtorException(std::shared_ptr<Socket>& socket) override;

private:
    static constexpr size_t ExternalStreamSocketCtorFailureInterval = 2;
    std::atomic<size_t> _externalStreamSocketCount = 0;
};

void UnitStreamSocketCtorFailure1::simulateExternalSocketCtorException(std::shared_ptr<Socket>& socket)
{
    const size_t extStreamSocketCount = ++_externalStreamSocketCount;
    if (extStreamSocketCount % ExternalStreamSocketCtorFailureInterval == 0)
    {
        LOG_DBG("Injecting recoverable StreamSocket ctor exception " << extStreamSocketCount
                << "/" << ExternalStreamSocketCtorFailureInterval << ": " << socket);
        throw std::runtime_error("Test: StreamSocket exception: fd " + std::to_string(socket->getFD()));
    }
}

inline UnitBase::TestResult UnitStreamSocketCtorFailure1::testHttp()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname
            << ": StreamSocketCtorFailureInterval "
            << ExternalStreamSocketCtorFailureInterval);

    const std::string documentURL = "/favicon.ico";

    constexpr bool UseOwnPoller = true;
    constexpr bool PollerOnClientThread = true;
    std::shared_ptr<SocketPoll> socketPoller;
    std::shared_ptr<http::Session> session;
    const size_t iter_max = 2*ExternalStreamSocketCtorFailureInterval+1;

    for(size_t iteration = 1; iteration <= iter_max; ++iteration)
    {
        const bool expectFailure = 0 == iteration % ExternalStreamSocketCtorFailureInterval;
        TST_LOG("Test[" << iteration << "]: expectFailure " << expectFailure);

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
        bool connected00 = false;
        {
            TST_LOG("Test[" << iteration << "] Req1: " << testname << ": `" << documentURL << "`");
            http::Request request(documentURL, http::Request::VERB_GET);
            const std::shared_ptr<const http::Response> response =
                session->syncRequest(request, *socketPoller);
            TST_LOG("Test[" << iteration << "] Connected: " << session->isConnected());
            TST_LOG("Test[" << iteration << "] Response1: " << response->header().toString());
            TST_LOG("Test[" << iteration << "] Response1 size: " << testname << ": `" << documentURL << "`: " << response->header().getContentLength());
            if( session->isConnected() ) {
                connected00 = true;
                LOK_ASSERT_EQUAL(http::StatusCode::OK, response->statusCode());
                LOK_ASSERT(http::Header::ConnectionToken::None ==
                           response->header().getConnectionToken());
                LOK_ASSERT(0 < response->header().getContentLength());
            } else {
                // connection limit hit
                LOK_ASSERT_EQUAL(http::StatusCode::None, response->statusCode());
            }
        }
        bool connected01 = false;
        {
            TST_LOG("Test[" << iteration << "] SessionA " << ": connected " << session->isConnected());
            if( session->isConnected() )
            {
                connected01 = true;
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
        if( expectFailure )
        {
            LOK_ASSERT(false == connected00);
            LOK_ASSERT(false == connected01);
        } else {
            LOK_ASSERT(true  == connected00);
            LOK_ASSERT(true  == connected01);
        }
    } // for iterations
    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

void UnitStreamSocketCtorFailure1::invokeWSDTest()
{
    UnitBase::TestResult result;

    result = testHttp();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitStreamSocketCtorFailure1(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
