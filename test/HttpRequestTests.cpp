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

/// http::Request unit-tests.
class HttpRequestTests final : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HttpRequestTests);

    CPPUNIT_TEST(testSimpleGet);
    CPPUNIT_TEST(testSimpleGetSync);
    // CPPUNIT_TEST(test500GetStatuses); // Slow.
    CPPUNIT_TEST(testSimplePost);
    CPPUNIT_TEST(testTimeout);
    CPPUNIT_TEST(testOnFinished_Complete);
    CPPUNIT_TEST(testOnFinished_Timeout);

    CPPUNIT_TEST_SUITE_END();

    void testSimpleGet();
    void testSimpleGetSync();
    void test500GetStatuses();
    void testSimplePost();
    void testTimeout();
    void testOnFinished_Complete();
    void testOnFinished_Timeout();
};

static std::pair<std::shared_ptr<Poco::Net::HTTPResponse>, std::string>
pocoGet(const std::string& host, const std::string& url)
{
    Poco::Net::HTTPClientSession session(host, 80);
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, url,
                                   Poco::Net::HTTPMessage::HTTP_1_1);
    session.sendRequest(request);
    auto response = std::make_shared<Poco::Net::HTTPResponse>();
    std::istream& rs = session.receiveResponse(*response);
    // std::cout << response.getStatus() << ' ' << response.getReason() << std::endl;

    std::string responseString;
    if (response->hasContentLength() && response->getContentLength() > 0)
    {
        std::ostringstream outputStringStream;
        Poco::StreamCopier::copyStream(rs, outputStringStream);
        responseString = outputStringStream.str();
        // std::cout << responseString << std::endl << "-----" << std::endl;
    }

    return std::make_pair(response, responseString);
}

void HttpRequestTests::testSimpleGet()
{
    const char* Host = "example.com";
    const char* URL = "/";

    // Start the polling thread.
    SocketPoll pollThread("HttpSessionPoll");
    pollThread.startThread();

    http::Request httpRequest(URL);

    static constexpr http::Session::Protocol Protocols[]
        = { http::Session::Protocol::HttpUnencrypted, http::Session::Protocol::HttpSsl };
    for (const http::Session::Protocol protocol : Protocols)
    {
        if (protocol == http::Session::Protocol::HttpSsl)
        {
#ifdef ENABLE_SSL
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
        const auto pocoResponse = pocoGet(Host, URL);

        std::unique_lock<std::mutex> lock(mutex);
        cv.wait_for(lock, std::chrono::seconds(1));

        const std::shared_ptr<const http::Response> httpResponse = httpSession->response();

        LOK_ASSERT_EQUAL_MESSAGE("Timed out waiting for the onFinished handler", false, timedout);
        LOK_ASSERT(httpResponse->state() == http::Response::State::Complete);
        LOK_ASSERT(!httpResponse->statusLine().httpVersion().empty());
        LOK_ASSERT(!httpResponse->statusLine().reasonPhrase().empty());
        LOK_ASSERT(httpResponse->statusLine().statusCode() == 200);
        LOK_ASSERT(httpResponse->statusLine().statusCategory()
                   == http::StatusLine::StatusCodeClass::Successful);

        const std::string body = httpResponse->getBody();
        LOK_ASSERT(!body.empty());
        LOK_ASSERT_EQUAL(pocoResponse.second, body);
    }

    pollThread.joinThread();
}

void HttpRequestTests::testSimpleGetSync()
{
    const char* Host = "www.example.com";
    const char* URL = "/";

    const auto pocoResponse = pocoGet(Host, URL);

    http::Request httpRequest(URL);

    auto httpSession = http::Session::createHttp(Host);
    httpSession->setTimeout(std::chrono::seconds(1));
    LOK_ASSERT(httpSession->syncRequest(httpRequest));
    LOK_ASSERT(httpSession->syncRequest(httpRequest)); // Second request.

    const std::shared_ptr<const http::Response> httpResponse = httpSession->response();
    LOK_ASSERT(httpResponse->done());
    LOK_ASSERT(httpResponse->state() == http::Response::State::Complete);
    LOK_ASSERT(!httpResponse->statusLine().httpVersion().empty());
    LOK_ASSERT(!httpResponse->statusLine().reasonPhrase().empty());
    LOK_ASSERT(httpResponse->statusLine().statusCode() == 200);
    LOK_ASSERT(httpResponse->statusLine().statusCategory()
               == http::StatusLine::StatusCodeClass::Successful);

    const std::string body = httpResponse->getBody();
    LOK_ASSERT(!body.empty());
    LOK_ASSERT_EQUAL(pocoResponse.second, body);
}

static void compare(const Poco::Net::HTTPResponse& pocoResponse, const std::string& pocoBody,
                    const http::Response& httpResponse)
{
    LOK_ASSERT(httpResponse.state() == http::Response::State::Complete);
    LOK_ASSERT(!httpResponse.statusLine().httpVersion().empty());
    LOK_ASSERT(!httpResponse.statusLine().reasonPhrase().empty());

    LOK_ASSERT_EQUAL(pocoBody, httpResponse.getBody());

    LOK_ASSERT_EQUAL(static_cast<int>(pocoResponse.getStatus()),
                     httpResponse.statusLine().statusCode());
    LOK_ASSERT_EQUAL(pocoResponse.getReason(), httpResponse.statusLine().reasonPhrase());

    LOK_ASSERT_EQUAL(pocoResponse.hasContentLength(), httpResponse.header().hasContentLength());
    if (pocoResponse.hasContentLength())
        LOK_ASSERT_EQUAL(pocoResponse.getContentLength(), httpResponse.header().getContentLength());
}

void HttpRequestTests::test500GetStatuses()
{
    // Start the polling thread.
    SocketPoll pollThread("HttpSessionPoll");
    pollThread.startThread();

    const std::string host = "httpbin.org";

    http::Request httpRequest;

    auto httpSession = http::Session::createHttp(host);
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
    for (int statusCode = 100; statusCode < 600; ++statusCode)
    {
        const std::string url = "/status/" + std::to_string(statusCode);
        httpRequest.setUrl(url);

        timedout = true; // Assume we timed out until we prove otherwise.

        httpSession->asyncRequest(httpRequest, pollThread);

        std::unique_lock<std::mutex> lock(mutex);
        cv.wait_for(lock, std::chrono::seconds(1));

        const std::shared_ptr<const http::Response> httpResponse = httpSession->response();
        LOK_ASSERT(httpResponse->state() == http::Response::State::Complete);
        LOK_ASSERT(!httpResponse->statusLine().httpVersion().empty());
        LOK_ASSERT(!httpResponse->statusLine().reasonPhrase().empty());

        if (statusCode % 100 == 0)
            ++curStatusCodeClass;
        LOK_ASSERT(httpResponse->statusLine().statusCategory()
                   == statusCodeClasses[curStatusCodeClass]);

        LOK_ASSERT(httpResponse->statusLine().statusCode() == statusCode);

        if (httpResponse->statusLine().statusCategory()
            != http::StatusLine::StatusCodeClass::Informational)
        {
            const auto pocoResponse = pocoGet(host, url); // Get via Poco in parallel.
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
    SocketPoll pollThread("HttpSessionPoll");
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
    LOK_ASSERT(httpResponse->statusLine().statusCode() == 200);
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
