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

#include <net/HttpRequest.hpp>
#include <test/helpers.hpp>
#include <test/lokassert.hpp>

#include <memory>
#include <string>

/*
 * Tests that ServerSocket::accept gracefully handles exceptions thrown
 * during StreamSocket construction. The test overrides
 * simulateExternalSocketCtorException to throw on every Nth accepted
 * socket (N = ExternalStreamSocketCtorFailureInterval = 2). It then
 * makes a series of HTTP GET requests to /favicon.ico and verifies
 * that the injected failures cause connection drops on the expected
 * iterations while the remaining iterations succeed normally.
 */
class UnitStreamSocketCtorFailure1 : public UnitWSD
{
    STATE_ENUM(Phase, Run, Done) _phase;

    static constexpr size_t ExternalStreamSocketCtorFailureInterval = 2;
    std::atomic<size_t> _externalStreamSocketCount = 0;
    size_t _iteration = 1;
    static constexpr size_t IterMax = 2 * ExternalStreamSocketCtorFailureInterval + 1;

public:
    UnitStreamSocketCtorFailure1()
        : UnitWSD("UnitStreamSocketCtorFailure1")
        , _phase(Phase::Run)
    {
    }

    void invokeWSDTest() override;
    void simulateExternalSocketCtorException(std::shared_ptr<Socket>& socket) override;
};

void UnitStreamSocketCtorFailure1::simulateExternalSocketCtorException(std::shared_ptr<Socket>& socket)
{
    const size_t extStreamSocketCount = ++_externalStreamSocketCount;
    if (extStreamSocketCount % ExternalStreamSocketCtorFailureInterval == 0)
    {
        LOG_DBG("Injecting recoverable StreamSocket ctor exception "
                << extStreamSocketCount << "/" << ExternalStreamSocketCtorFailureInterval << ": "
                << socket.get());
        throw std::runtime_error("Test: StreamSocket exception: fd " + std::to_string(socket->getFD()));
    }
}

void UnitStreamSocketCtorFailure1::invokeWSDTest()
{
    switch (_phase)
    {
        case Phase::Run:
        {
            if (_iteration == 1)
            {
                TST_LOG("Starting Test: StreamSocketCtorFailureInterval "
                        << ExternalStreamSocketCtorFailureInterval);
            }

            if (_iteration > IterMax)
            {
                TRANSITION_STATE(_phase, Phase::Done);
                break;
            }

            const std::string documentURL = "/favicon.ico";
            constexpr bool UseOwnPoller = true;
            constexpr bool PollerOnClientThread = true;

            const bool expectFailure = 0 == _iteration % ExternalStreamSocketCtorFailureInterval;
            TST_LOG("Test[" << _iteration << "]: expectFailure " << expectFailure);

            std::shared_ptr<SocketPoll> socketPoller;
            if (UseOwnPoller)
            {
                socketPoller = std::make_shared<TerminatingPoll>(testname);
                if (PollerOnClientThread)
                    socketPoller->runOnClientThread();
                else
                    socketPoller->startThread();
            }
            else
            {
                socketPoller = socketPoll();
            }

            auto session = http::Session::create(helpers::getTestServerURI());
            bool connected00 = false;
            {
                TST_LOG("Test[" << _iteration << "] Req1: `" << documentURL << "`");
                http::Request request(documentURL, http::Request::VERB_GET);
                const std::shared_ptr<const http::Response> response =
                    session->syncRequest(request, *socketPoller);
                TST_LOG("Test[" << _iteration << "] Connected: " << session->isConnected());
                TST_LOG("Test[" << _iteration
                                << "] Response1: " << response->header().toString());
                TST_LOG("Test[" << _iteration << "] Response1 size: `" << documentURL
                                << "`: " << response->header().getContentLength());
                if (session->isConnected())
                {
                    connected00 = true;
                    LOK_ASSERT_EQUAL(http::StatusCode::OK, response->statusCode());
                    LOK_ASSERT(http::Header::ConnectionToken::None ==
                               response->header().getConnectionToken());
                    LOK_ASSERT(0 < response->header().getContentLength());
                }
                else
                {
                    // connection limit hit
                    LOK_ASSERT_EQUAL(http::StatusCode::None, response->statusCode());
                }
            }

            bool connected01 = false;
            {
                TST_LOG("Test[" << _iteration << "] SessionA: connected "
                                << session->isConnected());
                if (session->isConnected())
                {
                    connected01 = true;
                    session->asyncShutdown();
                }
                if (UseOwnPoller)
                {
                    if (PollerOnClientThread)
                    {
                        socketPoller->closeAllSockets();
                    }
                    else
                    {
                        socketPoller->joinThread();
                    }
                }
            }

            if (expectFailure)
            {
                LOK_ASSERT(false == connected00);
                LOK_ASSERT(false == connected01);
            }
            else
            {
                LOK_ASSERT(true == connected00);
                LOK_ASSERT(true == connected01);
            }

            ++_iteration;
            break;
        }
        case Phase::Done:
        {
            passTest("All HTTP iterations completed successfully");
            break;
        }
    }
}

UnitBase* unit_create_wsd(void) { return new UnitStreamSocketCtorFailure1(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
