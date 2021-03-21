/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <chrono>
#include <condition_variable>
#include <config.h>

#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/StreamCopier.h>

#include <mutex>
#include <string>
#include <test/lokassert.hpp>

#if ENABLE_SSL
#include "Ssl.hpp"
#include <net/SslSocket.hpp>
#endif
#include <net/HttpRequest.hpp>
#include <FileUtil.hpp>
#include <Util.hpp>
#include <helpers.hpp>

/// http::Request unit-tests.
/// FIXME: use loopback and avoid depending on external services.
/// Currently we need to rely on external services to validate
/// the implementation.
class HttpRequestTests final : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HttpRequestTests);

    CPPUNIT_TEST(testInvalidURI);
    CPPUNIT_TEST(testSimpleGet);
    CPPUNIT_TEST(testSimpleGetSync);
    // CPPUNIT_TEST(test500GetStatuses); // Slow.
    // CPPUNIT_TEST(testSimplePost);
    CPPUNIT_TEST(testTimeout);
    CPPUNIT_TEST(testOnFinished_Complete);
    CPPUNIT_TEST(testOnFinished_Timeout);

    CPPUNIT_TEST_SUITE_END();

    void testInvalidURI();
    void testSimpleGet();
    void testSimpleGetSync();
    void test500GetStatuses();
    void testSimplePost();
    void testTimeout();
    void testOnFinished_Complete();
    void testOnFinished_Timeout();
};

void HttpRequestTests::testInvalidURI()
{
    const char* Host = "";
    const char* URL = "/";

    http::Request httpRequest(URL);

    auto httpSession = http::Session::createHttp(Host);
    httpSession->setTimeout(std::chrono::seconds(1));
    LOK_ASSERT(httpSession->syncRequest(httpRequest) == false);

    const std::shared_ptr<const http::Response> httpResponse = httpSession->response();
    LOK_ASSERT(httpResponse->done() == false);
    LOK_ASSERT(httpResponse->state() != http::Response::State::Complete);
    LOK_ASSERT(httpResponse->statusLine().statusCode() != Poco::Net::HTTPResponse::HTTP_OK);
    LOK_ASSERT_EQUAL(0U, httpResponse->statusLine().statusCode());
    LOK_ASSERT(httpResponse->statusLine().statusCategory()
               == http::StatusLine::StatusCodeClass::Invalid);
    LOK_ASSERT(httpResponse->getBody().empty());
}

void HttpRequestTests::testSimpleGet()
{
    const char* Host = "example.com";
    const char* URL = "/";

    // Start the polling thread.
    SocketPoll pollThread("HttpAsyncReqPoll");
    pollThread.startThread();

    http::Request httpRequest(URL);

    static constexpr http::Session::Protocol Protocols[]
        = { http::Session::Protocol::HttpUnencrypted, http::Session::Protocol::HttpSsl };
    for (const http::Session::Protocol protocol : Protocols)
    {
        if (protocol == http::Session::Protocol::HttpSsl)
        {
#if ENABLE_SSL
            if (!SslContext::isInitialized())
#endif
                continue; // Skip SSL, it's not enabled.
        }

        auto httpSession = http::Session::create(Host, protocol);

        std::condition_variable cv;
        std::mutex mutex;
        bool timedout = true;
        httpSession->setFinishedHandler([&](const std::shared_ptr<http::Session>&) {
            std::lock_guard<std::mutex> lock(mutex);
            timedout = false;
            cv.notify_all();
        });

        httpSession->asyncRequest(httpRequest, pollThread);

        // Use Poco to get the same URL in parallel.
        const bool secure = (protocol == http::Session::Protocol::HttpSsl);
        const int port = (protocol == http::Session::Protocol::HttpSsl ? 443 : 80);
        const auto pocoResponse = helpers::pocoGet(secure, Host, port, URL);

        std::unique_lock<std::mutex> lock(mutex);
        cv.wait_for(lock, std::chrono::seconds(1));

        const std::shared_ptr<const http::Response> httpResponse = httpSession->response();

        LOK_ASSERT_EQUAL_MESSAGE("Timed out waiting for the onFinished handler", false, timedout);
        LOK_ASSERT(httpResponse->state() == http::Response::State::Complete);
        LOK_ASSERT(!httpResponse->statusLine().httpVersion().empty());
        LOK_ASSERT(!httpResponse->statusLine().reasonPhrase().empty());
        LOK_ASSERT_EQUAL(200U, httpResponse->statusLine().statusCode());
        LOK_ASSERT(httpResponse->statusLine().statusCategory()
                   == http::StatusLine::StatusCodeClass::Successful);

        LOK_ASSERT_EQUAL(pocoResponse.second, httpResponse->getBody());
    }

    pollThread.joinThread();
}

void HttpRequestTests::testSimpleGetSync()
{
    const std::string Host = "http://www.example.com";
    const char* URL = "/";

    const auto pocoResponse = helpers::pocoGet(Poco::URI(Host + URL));

    http::Request httpRequest(URL);

    auto httpSession = http::Session::create(Host);
    httpSession->setTimeout(std::chrono::seconds(1));
    LOK_ASSERT(httpSession->syncRequest(httpRequest));
    LOK_ASSERT(httpSession->syncRequest(httpRequest)); // Second request.

    const std::shared_ptr<const http::Response> httpResponse = httpSession->response();
    LOK_ASSERT(httpResponse->done());
    LOK_ASSERT(httpResponse->state() == http::Response::State::Complete);
    LOK_ASSERT(!httpResponse->statusLine().httpVersion().empty());
    LOK_ASSERT(!httpResponse->statusLine().reasonPhrase().empty());
    LOK_ASSERT_EQUAL(200U, httpResponse->statusLine().statusCode());
    LOK_ASSERT(httpResponse->statusLine().statusCategory()
               == http::StatusLine::StatusCodeClass::Successful);
    LOK_ASSERT_EQUAL(std::string("HTTP/1.1"), httpResponse->statusLine().httpVersion());
    LOK_ASSERT_EQUAL(std::string("OK"), httpResponse->statusLine().reasonPhrase());

    LOK_ASSERT_EQUAL(pocoResponse.second, httpResponse->getBody());
}

static void compare(const Poco::Net::HTTPResponse& pocoResponse, const std::string& pocoBody,
                    const http::Response& httpResponse)
{
    LOK_ASSERT_EQUAL_MESSAGE("Response state", httpResponse.state(),
                             http::Response::State::Complete);
    LOK_ASSERT(!httpResponse.statusLine().httpVersion().empty());
    LOK_ASSERT(!httpResponse.statusLine().reasonPhrase().empty());

    LOK_ASSERT_EQUAL_MESSAGE("Body", pocoBody, httpResponse.getBody());

    LOK_ASSERT_EQUAL_MESSAGE("Status Code", static_cast<unsigned>(pocoResponse.getStatus()),
                             httpResponse.statusLine().statusCode());
    LOK_ASSERT_EQUAL_MESSAGE("Reason Phrase", pocoResponse.getReason(),
                             httpResponse.statusLine().reasonPhrase());

    LOK_ASSERT_EQUAL_MESSAGE("hasContentLength", pocoResponse.hasContentLength(),
                             httpResponse.header().hasContentLength());
    if (pocoResponse.hasContentLength())
        LOK_ASSERT_EQUAL_MESSAGE("ContentLength", pocoResponse.getContentLength(),
                                 httpResponse.header().getContentLength());
}

/// This test requests specific *reponse* codes from
/// the server to test the handling of all possible
/// response status codes.
/// It exercises a few hundred requests/responses.
void HttpRequestTests::test500GetStatuses()
{
    constexpr auto Host = "httpbin.org";
    constexpr bool secure = false;
    constexpr int port = 80;

    // Start the polling thread.
    SocketPoll pollThread("HttpAsyncReqPoll");
    pollThread.startThread();

    auto httpSession = http::Session::createHttp(Host);
    httpSession->setTimeout(std::chrono::seconds(1));

    std::condition_variable cv;
    std::mutex mutex;
    bool timedout = true;
    httpSession->setFinishedHandler([&](const std::shared_ptr<http::Session>&) {
        std::lock_guard<std::mutex> lock(mutex);
        timedout = false;
        cv.notify_all();
    });

    http::StatusLine::StatusCodeClass statusCodeClasses[]
        = { http::StatusLine::StatusCodeClass::Informational,
            http::StatusLine::StatusCodeClass::Successful,
            http::StatusLine::StatusCodeClass::Redirection,
            http::StatusLine::StatusCodeClass::Client_Error,
            http::StatusLine::StatusCodeClass::Server_Error };
    int curStatusCodeClass = -1;
    for (unsigned statusCode = 100; statusCode < 512; ++statusCode)
    {
        const std::string url = "/status/" + std::to_string(statusCode);

        http::Request httpRequest;
        httpRequest.setUrl(url);

        timedout = true; // Assume we timed out until we prove otherwise.

        httpSession->asyncRequest(httpRequest, pollThread);

        // Get via Poco in parallel.
        std::pair<std::shared_ptr<Poco::Net::HTTPResponse>, std::string> pocoResponse;
        if (statusCode > 100)
            pocoResponse = helpers::pocoGet(secure, Host, port, url);

        const std::shared_ptr<const http::Response> httpResponse = httpSession->response();

        std::unique_lock<std::mutex> lock(mutex);
        cv.wait_for(lock, std::chrono::seconds(1), [&]() { return httpResponse->done(); });

        LOK_ASSERT_EQUAL(http::Response::State::Complete, httpResponse->state());
        LOK_ASSERT(!httpResponse->statusLine().httpVersion().empty());
        LOK_ASSERT(!httpResponse->statusLine().reasonPhrase().empty());

        if (statusCode % 100 == 0)
            ++curStatusCodeClass;
        LOK_ASSERT(httpResponse->statusLine().statusCategory()
                   == statusCodeClasses[curStatusCodeClass]);

        LOK_ASSERT_EQUAL(statusCode, httpResponse->statusLine().statusCode());

        // Poco throws exception "No message received" for 1xx Status Codes.
        if (statusCode > 100)
        {
            compare(*pocoResponse.first, pocoResponse.second, *httpResponse);
        }
    }

    pollThread.joinThread();
}

void HttpRequestTests::testSimplePost()
{
    const std::string Host = "httpbin.org";
    const char* URL = "/post";

    // Start the polling thread.
    SocketPoll pollThread("HttpAsyncReqPoll");
    pollThread.startThread();

    http::Request httpRequest(URL, http::Request::VERB_POST);

    // Write the test data to file.
    const char data[] = "abcd-qwerty!!!";
    const std::string path = Poco::Path::temp() + "/test_http_post";
    std::ofstream ofs(path, std::ios::binary);
    ofs.write(data, sizeof(data) - 1); // Don't write the terminating null.
    ofs.close();

    httpRequest.setBodyFile(path);

    auto httpSession = http::Session::createHttp(Host);
    httpSession->setTimeout(std::chrono::seconds(1));

    std::condition_variable cv;
    std::mutex mutex;
    bool timedout = true;
    httpSession->setFinishedHandler([&](const std::shared_ptr<http::Session>&) {
        std::lock_guard<std::mutex> lock(mutex);
        timedout = false;
        cv.notify_all();
    });

    httpSession->asyncRequest(httpRequest, pollThread);

    std::unique_lock<std::mutex> lock(mutex);
    cv.wait_for(lock, std::chrono::seconds(1));

    const std::shared_ptr<const http::Response> httpResponse = httpSession->response();
    LOK_ASSERT(httpResponse->state() == http::Response::State::Complete);
    LOK_ASSERT(!httpResponse->statusLine().httpVersion().empty());
    LOK_ASSERT(!httpResponse->statusLine().reasonPhrase().empty());
    LOK_ASSERT_EQUAL(200U, httpResponse->statusLine().statusCode());
    LOK_ASSERT(httpResponse->statusLine().statusCategory()
               == http::StatusLine::StatusCodeClass::Successful);

    const std::string body = httpResponse->getBody();
    LOK_ASSERT(!body.empty());
    std::cerr << "[" << body << "]\n";
    LOK_ASSERT(body.find(data) != std::string::npos);

    pollThread.joinThread();
}

void HttpRequestTests::testTimeout()
{
    const char* Host = "www.example.com";
    const char* URL = "/";

    http::Request httpRequest(URL);

    auto httpSession = http::Session::createHttp(Host);

    httpSession->setTimeout(std::chrono::milliseconds(1)); // Very short interval.

    LOK_ASSERT(!httpSession->syncRequest(httpRequest)); // Must fail to complete.

    const std::shared_ptr<const http::Response> httpResponse = httpSession->response();
    LOK_ASSERT(httpResponse->done());
    LOK_ASSERT(httpResponse->state() == http::Response::State::Timeout);
}

void HttpRequestTests::testOnFinished_Complete()
{
    const char* Host = "www.example.com";
    const char* URL = "/";

    http::Request httpRequest(URL);

    auto httpSession = http::Session::createHttp(Host);

    bool completed = false;
    httpSession->setFinishedHandler([&](const std::shared_ptr<http::Session>& session) {
        LOK_ASSERT(session->response()->done());
        LOK_ASSERT(session->response()->state() == http::Response::State::Complete);
        completed = true;
        return true;
    });

    LOK_ASSERT(httpSession->syncRequest(httpRequest));

    const std::shared_ptr<const http::Response> httpResponse = httpSession->response();
    LOK_ASSERT(completed);
    LOK_ASSERT(httpResponse->done());
    LOK_ASSERT(httpResponse->state() == http::Response::State::Complete);
}

void HttpRequestTests::testOnFinished_Timeout()
{
    const char* Host = "www.example.com";
    const char* URL = "/";

    http::Request httpRequest(URL);

    auto httpSession = http::Session::createHttp(Host);

    httpSession->setTimeout(std::chrono::milliseconds(1)); // Very short interval.

    bool completed = false;
    httpSession->setFinishedHandler([&](const std::shared_ptr<http::Session>& session) {
        LOK_ASSERT(session->response()->done());
        LOK_ASSERT(session->response()->state() == http::Response::State::Timeout);
        completed = true;
        return true;
    });

    LOK_ASSERT(!httpSession->syncRequest(httpRequest));

    const std::shared_ptr<const http::Response> httpResponse = httpSession->response();
    LOK_ASSERT(completed);
    LOK_ASSERT(httpResponse->done());
    LOK_ASSERT(httpResponse->state() == http::Response::State::Timeout);
}

CPPUNIT_TEST_SUITE_REGISTRATION(HttpRequestTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
