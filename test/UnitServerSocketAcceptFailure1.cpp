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

/// Test suite class for injected ServerSocket accept failures
class UnitServerSocketAcceptFailure1 : public UnitTimeoutBase0
{
    TestResult testHttp();

public:
    UnitServerSocketAcceptFailure1()
        : UnitTimeoutBase0("UnitServerSocketAcceptFailure1")
    {
    }

    void invokeWSDTest() override;
    bool simulateExternalAcceptError() override;

private:
    static constexpr size_t ExternalServerSocketAcceptSimpleErrorInterval = 2;
    static constexpr size_t ExternalServerSocketAcceptFatalErrorInterval =  5;
    std::atomic<size_t> _externalServerSocketAcceptCount = 0;
};

bool UnitServerSocketAcceptFailure1::simulateExternalAcceptError()
{
    const size_t acceptCount = ++_externalServerSocketAcceptCount;
    if (acceptCount % ExternalServerSocketAcceptSimpleErrorInterval == 0)
    {
        // recoverable error like EAGAIN
        LOG_DBG("Injecting recoverable accept failure: EAGAIN: " << acceptCount);
        return true;
    }
    else if (acceptCount % ExternalServerSocketAcceptFatalErrorInterval == 0)
    {
        // fatal error like EFAULT
        LOG_DBG("Injecting fatal accept failure: EAGAIN: " << acceptCount);
        throw std::runtime_error("Injecting fatal accept failure.");
    }
    else
        return false;
}

inline UnitBase::TestResult UnitServerSocketAcceptFailure1::testHttp()
{
    const size_t fatal_iter = ExternalServerSocketAcceptFatalErrorInterval - ExternalServerSocketAcceptSimpleErrorInterval;
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname
            << ": ServerSocketAcceptSimpleErrorInterval "
            << ExternalServerSocketAcceptSimpleErrorInterval
            << ", ServerSocketAcceptFatalErrorInterval "
            << ExternalServerSocketAcceptFatalErrorInterval
            << ", fatal_iter (client) " << fatal_iter);

    const std::string documentURL = "/favicon.ico";

    constexpr bool UseOwnPoller = true;
    constexpr bool PollerOnClientThread = true;
    std::shared_ptr<SocketPoll> socketPoller;
    std::shared_ptr<http::Session> session;

    for(size_t iteration = 1; iteration <= fatal_iter; ++iteration)
    {
        const bool expectFatalError = iteration == fatal_iter;
        TST_LOG("Test[" << iteration << "]: expectFatalError " << expectFatalError);

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
        if( expectFatalError )
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

void UnitServerSocketAcceptFailure1::invokeWSDTest()
{
    UnitBase::TestResult result;

    result = testHttp();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitServerSocketAcceptFailure1(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
