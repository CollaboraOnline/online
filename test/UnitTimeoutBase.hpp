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

/// Base test suite class for timeout and connection limit using HTTP and WS sessions.
class UnitTimeoutBase0 : public UnitWSD
{
public:
    bool assertMessage(http::WebSocketSession &session, const std::string expectedPrefix, const std::string expectedId)
    {
        std::vector<char> res = session.poll(
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
                        const bool c = session.isConnected();
                        TST_LOG("Some WS response(2): " << msg << ", connected " << c);
                        return !c; // continue waiting for 'it' if still connected
                    }
                }
                else
                {
                    // check error message
                    LOK_ASSERT_EQUAL(std::string(SERVICE_UNAVAILABLE_INTERNAL_ERROR), msg);

                    // close frame message
                    return true;
                }
            },
            std::chrono::seconds(10), testname);
        return !res.empty();
    };

    template<typename SessionType>
    bool pollDisconnected(std::chrono::microseconds timeout, SessionType &session, SocketPoll *syncSocketPoller=nullptr)
    {
        std::chrono::steady_clock::time_point t0 = std::chrono::steady_clock::now();
        std::chrono::steady_clock::time_point t1 = t0;
        while( t1 - t0 < timeout && session.isConnected() )
        {
            if( nullptr != syncSocketPoller )
                syncSocketPoller->poll(std::chrono::microseconds(1000));
            t1 = std::chrono::steady_clock::now();
        }
        return !session.isConnected();
    }

    template<typename SessionType>
    bool pollDisconnected(std::chrono::microseconds timeout, std::vector<std::shared_ptr<SessionType>> &sessions, SocketPoll *syncSocketPoller=nullptr)
    {
        std::chrono::steady_clock::time_point t0 = std::chrono::steady_clock::now();
        std::chrono::steady_clock::time_point t1 = t0;
        while( 0<sessions.size() && t1 - t0 < timeout )
        {
            if( nullptr != syncSocketPoller )
                syncSocketPoller->poll(std::chrono::microseconds(1000));
            for (auto iter=sessions.begin(); iter != sessions.end(); )
            {
                std::shared_ptr<SessionType>& session = *iter;
                if( !session->isConnected() )
                    iter = sessions.erase(iter);
                else
                    ++iter;
            }
            t1 = std::chrono::steady_clock::now();
        }
        return sessions.empty();
    }

    UnitTimeoutBase0(const std::string& testname_)
        : UnitWSD(testname_)
    {
    }
};

/// Base test suite class for timeout and connection limit using HTTP and WS sessions.
class UnitTimeoutBase1 : public UnitTimeoutBase0
{
public:
    TestResult testHttp(const size_t connectionLimit, const size_t connectionsCount);
    TestResult testWSPing(const size_t connectionLimit, const size_t connectionsCount);
    TestResult testWSDChatPing(const size_t connectionLimit, const size_t connectionsCount);

    UnitTimeoutBase1(const std::string& testname_)
        : UnitTimeoutBase0(testname_)
    {
    }
};

inline UnitBase::TestResult UnitTimeoutBase1::testHttp(const size_t connectionLimit, const size_t connectionsCount)
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    const size_t MaxConnections = std::min(connectionsCount, connectionLimit);
    const std::string documentURL = "/favicon.ico";

    constexpr bool UseOwnPoller = true;
    constexpr bool PollerOnClientThread = true;
    std::vector<std::shared_ptr<TerminatingPoll>> socketPollers;
    std::vector<std::shared_ptr<http::Session>> sessions;

    try
    {
        for(size_t sockIdx = 0; sockIdx < connectionsCount; ++sockIdx) {
            std::shared_ptr<TerminatingPoll> socketPoller;
            if( UseOwnPoller )
            {
                socketPoller = std::make_shared<TerminatingPoll>(testname);
                if( PollerOnClientThread )
                {
                    socketPoller->runOnClientThread();
                } else {
                    socketPoller->startThread();
                }
                socketPollers.push_back(socketPoller);
            }

            std::shared_ptr<http::Session> session = http::Session::create(helpers::getTestServerURI());
            sessions.push_back( session );
            TST_LOG("Test: " << testname << "[" << sockIdx << "]: `" << documentURL << "`");
            http::Request request(documentURL, http::Request::VERB_GET);
            const std::shared_ptr<const http::Response> response =
                session->syncRequest(request, UseOwnPoller ? *socketPoller : *socketPoll());
            TST_LOG("Response: " << response->header().toString());
            TST_LOG("Response size: " << testname << "[" << sockIdx << "]: `" << documentURL << "`: " << response->header().getContentLength());
            if( session->isConnected() ) {
                LOK_ASSERT_EQUAL(http::StatusCode::OK, response->statusCode());
                LOK_ASSERT_EQUAL(true, session->isConnected());
                LOK_ASSERT(http::Header::ConnectionToken::None ==
                           response->header().getConnectionToken());
                LOK_ASSERT(0 < response->header().getContentLength());
            } else {
                // connection limit hit
                LOK_ASSERT_EQUAL(http::StatusCode::None, response->statusCode());
                LOK_ASSERT_EQUAL(false, session->isConnected());
            }
        }
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    size_t connected = 0;
    for(size_t sockIdx = 0; sockIdx < connectionsCount; ++sockIdx) {
        std::shared_ptr<http::Session> &session = sessions[sockIdx];
        TST_LOG("SessionA " << sockIdx << ": connected " << session->isConnected());
        if( session->isConnected() )
        {
            ++connected;
            session->asyncShutdown();
        }
        if( UseOwnPoller ) {
            std::shared_ptr<TerminatingPoll> socketPoller = socketPollers[sockIdx];
            if( PollerOnClientThread )
            {
                socketPoller->closeAllSockets();
            } else {
                socketPoller->joinThread();
            }
        }
    }
    TST_LOG("Test: X01 Connected: " << connected << " / " << connectionsCount << ", limit " << connectionLimit);
    // LOK_ASSERT_EQUAL(MaxConnections, connected);
    LOK_ASSERT(MaxConnections-1 <= connected && connected <= MaxConnections+1);

    TST_LOG("Clearing Sessions: " << testname);
    sessions.clear();
    TST_LOG("Clearing Poller: " << testname);
    socketPollers.clear();
    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

/// Test the native WebSocket control-frame ping/pong facility -> No Timeout!
inline UnitBase::TestResult UnitTimeoutBase1::testWSPing(const size_t connectionLimit, const size_t connectionsCount)
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    const size_t maxConnections = std::min(connectionsCount, connectionLimit);
    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    constexpr bool UseOwnPoller = true;
    constexpr bool PollerOnClientThread = false;
    std::vector<std::shared_ptr<TerminatingPoll>> socketPollers;
    std::vector<std::shared_ptr<http::WebSocketSession>> sessions;

    size_t connected0 = 0;
    for(size_t sockIdx = 0; sockIdx < connectionsCount; ++sockIdx) {
        std::shared_ptr<TerminatingPoll> socketPoller;
        if( UseOwnPoller )
        {
            socketPoller = std::make_shared<TerminatingPoll>(testname);
            if( PollerOnClientThread )
            {
                socketPoller->runOnClientThread();
            } else {
                socketPoller->startThread();
            }
            socketPollers.push_back(socketPoller);
        }

        std::shared_ptr<http::WebSocketSession> session = http::WebSocketSession::create(helpers::getTestServerURI());
        sessions.push_back( session );
        TST_LOG("Test: " << testname << "[" << sockIdx << "]: `" << documentURL << "`");
        http::Request req(documentURL);
        session->asyncRequest(req, UseOwnPoller ? socketPoller : socketPoll());
        session->sendMessage("load url=" + documentURL);

        TST_LOG("Test: XX0 " << testname << "[" << sockIdx << "]: connected " << session->isConnected());
        if( sockIdx < maxConnections ) {
            LOK_ASSERT_EQUAL(true, session->isConnected());

            assertMessage(*session, "progress:", "find");
            assertMessage(*session, "progress:", "connect");
            assertMessage(*session, "progress:", "ready");

            TST_LOG("Test: XX1 " << testname << "[" << sockIdx << "]: connected " << session->isConnected());
            LOK_ASSERT_EQUAL(true, session->isConnected());
            ++connected0;
        } else {
            // Perform actual communication attempt, required to fail (disconnect)
            TST_LOG("Test: XX2 " << testname << "[" << sockIdx << "]: connected " << session->isConnected());
            bool comRes=false;
            if( session->isConnected() )
            {
                comRes=assertMessage(*session, "progress:", "find");
                if( session->isConnected() )
                    ++connected0;
            }
            TST_LOG("Test: XX3 " << testname << "[" << sockIdx << "]: connected "
                    << session->isConnected() << "/" << connected0 << ", com " << comRes);
            LOK_ASSERT_EQUAL(false, comRes);
            LOK_ASSERT_EQUAL(false, session->isConnected());
        }
    }
    TST_LOG("Test: X01 Connected: " << connected0 << " / " << connectionsCount << ", limit " << connectionLimit);

    size_t connected = 0;
    for(size_t sockIdx = 0; sockIdx < connectionsCount; ++sockIdx) {
        std::shared_ptr<http::WebSocketSession> wsSession = sessions[sockIdx];
        TST_LOG("SessionA " << sockIdx << ": connected " << wsSession->isConnected());
        if( wsSession->isConnected() )
        {
            ++connected;
            // wsSession->asyncShutdown();
            wsSession->shutdownWS();
        }
        if( UseOwnPoller ) {
            std::shared_ptr<TerminatingPoll> socketPoller = socketPollers[sockIdx];
            if( PollerOnClientThread )
            {
                socketPoller->closeAllSockets();
            } else {
                socketPoller->joinThread();
            }
        }
    }
    // 5 x Limiter hits occurred!
    TST_LOG("Test: X02 Connected: " << connected << " / " << connectionsCount << ", limit " << connectionLimit);
    LOK_ASSERT(maxConnections-1 <= connected && connected <= maxConnections+1);

    TST_LOG("Clearing Sessions: " << testname);
    sessions.clear();
    TST_LOG("Clearing Poller: " << testname);
    socketPollers.clear();
    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

/// Tests the WSD chat ping/pong facility, where client sends the ping.
/// See: https://github.com/CollaboraOnline/online/blob/master/wsd/protocol.txt/
inline UnitBase::TestResult UnitTimeoutBase1::testWSDChatPing(const size_t connectionLimit, const size_t connectionsCount)
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    const size_t maxConnections = std::min(connectionsCount, connectionLimit);
    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    constexpr bool UseOwnPoller = true;
    constexpr bool PollerOnClientThread = false;
    std::vector<std::shared_ptr<TerminatingPoll>> socketPollers;
    std::vector<std::shared_ptr<http::WebSocketSession>> sessions;

    for(size_t sockIdx = 0; sockIdx < connectionsCount; ++sockIdx) {
        std::shared_ptr<TerminatingPoll> socketPoller;
        if( UseOwnPoller )
        {
            socketPoller = std::make_shared<TerminatingPoll>(testname);
            if( PollerOnClientThread )
            {
                socketPoller->runOnClientThread();
            } else {
                socketPoller->startThread();
            }
            socketPollers.push_back(socketPoller);
        }

        std::shared_ptr<http::WebSocketSession> session = http::WebSocketSession::create(helpers::getTestServerURI());
        sessions.push_back( session );
        TST_LOG("Test: " << testname << "[" << sockIdx << "]: `" << documentURL << "`");
        http::Request req(documentURL);
        session->asyncRequest(req, UseOwnPoller ? socketPoller : socketPoll());
        session->sendMessage("load url=" + documentURL);

        TST_LOG("Test: XX0 " << testname << "[" << sockIdx << "]: connected " << session->isConnected());
        if( sockIdx < maxConnections-1 ) {
            LOK_ASSERT_EQUAL(true, session->isConnected());

            assertMessage(*session, "progress:", "find");
            assertMessage(*session, "progress:", "connect");
            assertMessage(*session, "progress:", "ready");

            TST_LOG("Test: XX1 " << testname << "[" << sockIdx << "]: connected " << session->isConnected());
            // LOK_ASSERT_EQUAL(true, wsSession->isConnected());
        } else {
            TST_LOG("Test: XX2 " << testname << "[" << sockIdx << "]: connected " << session->isConnected());
            // LOK_ASSERT_EQUAL(false, wsSession->isConnected());
        }
    }
    for(size_t sockIdx = 0; sockIdx < connectionsCount; ++sockIdx) {
        std::shared_ptr<http::WebSocketSession> wsSession = sessions[sockIdx];
        TST_LOG("Test: XX3a " << testname << "[" << sockIdx << "]: connected " << wsSession->isConnected());
        if( wsSession->isConnected() )
        {
            wsSession->sendMessage("ping");
            TST_LOG("Test: XX3b " << testname << "[" << sockIdx << "]: connected " << wsSession->isConnected());
            assertMessage(*wsSession, "", "pong");
            TST_LOG("Test: XX3c " << testname << "[" << sockIdx << "]: connected " << wsSession->isConnected());
        }
    }

    size_t connected = 0;
    for(size_t sockIdx = 0; sockIdx < connectionsCount; ++sockIdx) {
        std::shared_ptr<http::WebSocketSession> wsSession = sessions[sockIdx];
        TST_LOG("SessionA " << sockIdx << ": connected " << wsSession->isConnected());
        if( wsSession->isConnected() )
        {
            ++connected;
            wsSession->shutdownWS();
        }
        if( UseOwnPoller ) {
            std::shared_ptr<TerminatingPoll> socketPoller = socketPollers[sockIdx];
            if( PollerOnClientThread )
            {
                socketPoller->closeAllSockets();
            } else {
                socketPoller->joinThread();
            }
        }
    }
    // 5 x Limiter hits occurred!
    TST_LOG("Test: X01 Connected: " << connected << " / " << connectionsCount << ", limit " << connectionLimit);
    LOK_ASSERT(maxConnections-1 <= connected && connected <= maxConnections+1);

    TST_LOG("Clearing Sessions: " << testname);
    sessions.clear();
    TST_LOG("Clearing Poller: " << testname);
    socketPollers.clear();
    TST_LOG("Ending Test: " << testname);
    return TestResult::Ok;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
