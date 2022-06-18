/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "ConfigUtil.hpp"
#include <HttpTestServer.hpp>

#include <Poco/URI.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/InvalidCertificateHandler.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/StreamCopier.h>

#include <chrono>
#include <condition_variable>
#include <mutex>
#include <string>
#include <test/lokassert.hpp>

#if ENABLE_SSL
#include "Ssl.hpp"
#include <net/SslSocket.hpp>
#endif
#include <net/ServerSocket.hpp>
#include <net/DelaySocket.hpp>
#include <net/HttpRequest.hpp>
#include <FileUtil.hpp>
#include <Util.hpp>
#include <helpers.hpp>

/// When enabled, in addition to the loopback
/// server, an external server will be used
/// to check for regressions.
// #define ENABLE_EXTERNAL_REGRESSION_CHECK

/// http::Request unit-tests.
class HttpRequestTests final : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HttpRequestTests);

    CPPUNIT_TEST(testSslHostname);
    CPPUNIT_TEST(testInvalidURI);
    CPPUNIT_TEST(testBadResponse);
    CPPUNIT_TEST(testGoodResponse);
    CPPUNIT_TEST(testSimpleGet);
    CPPUNIT_TEST(testSimpleGetSync);
    CPPUNIT_TEST(testChunkedGetSync);
    CPPUNIT_TEST(test500GetStatuses); // Slow.
#ifdef ENABLE_EXTERNAL_REGRESSION_CHECK
    CPPUNIT_TEST(testChunkedGetSync_External);
    CPPUNIT_TEST(testSimplePost_External);
#endif
    CPPUNIT_TEST(testTimeout);
    CPPUNIT_TEST(testOnFinished_Complete);
    CPPUNIT_TEST(testOnFinished_Timeout);

    CPPUNIT_TEST_SUITE_END();

    void testSslHostname();
    void testInvalidURI();
    void testBadResponse();
    void testGoodResponse();
    void testSimpleGet();
    void testSimpleGetSync();
    void testChunkedGetSync();
    void test500GetStatuses();
    void testChunkedGetSync_External();
    void testSimplePost_External();
    void testTimeout();
    void testOnFinished_Complete();
    void testOnFinished_Timeout();

    static constexpr std::chrono::seconds DefTimeoutSeconds{ 5 };

    std::string _localUri;
    SocketPoll _pollServerThread;
    std::shared_ptr<ServerSocket> _socket;
    int _port;

    static const int SimulatedLatencyMs = 0;

public:
    HttpRequestTests()
        : _pollServerThread("HttpServerPoll")
        , _port(0)
    {
#if ENABLE_SSL
        Poco::Net::initializeSSL();
        // Just accept the certificate anyway for testing purposes
        Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidCertHandler
            = new Poco::Net::AcceptCertificateHandler(false);
        Poco::Net::Context::Params sslParams;
        Poco::Net::Context::Ptr sslContext
            = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslParams);
        Poco::Net::SSLManager::instance().initializeClient(nullptr, invalidCertHandler, sslContext);
#endif
    }

    ~HttpRequestTests()
    {
#if ENABLE_SSL
        Poco::Net::uninitializeSSL();
#endif
    }

    class ServerSocketFactory final : public SocketFactory
    {
        std::shared_ptr<Socket> create(const int physicalFd) override
        {
            int fd = physicalFd;

#if !MOBILEAPP
            if (HttpRequestTests::SimulatedLatencyMs > 0)
                fd = Delay::create(HttpRequestTests::SimulatedLatencyMs, physicalFd);
#endif
#if ENABLE_SSL
            if (helpers::haveSsl())
                return StreamSocket::create<SslStreamSocket>(
                    std::string(), fd, false, std::make_shared<ServerRequestHandler>());
            else
                return StreamSocket::create<StreamSocket>(std::string(), fd, false,
                                                          std::make_shared<ServerRequestHandler>());
#else
            return StreamSocket::create<StreamSocket>(std::string(), fd, false,
                                                      std::make_shared<ServerRequestHandler>());
#endif
        }
    };

    void setUp()
    {
        LOG_INF("HttpRequestTests::setUp");
        std::shared_ptr<SocketFactory> factory = std::make_shared<ServerSocketFactory>();
        _port = 9990;
        for (int i = 0; i < 40; ++i, ++_port)
        {
            // Try listening on this port.
            LOG_INF("HttpRequestTests::setUp: creating socket to listen on port " << _port);
            _socket = ServerSocket::create(ServerSocket::Type::Local, _port, Socket::Type::IPv4,
                                           _pollServerThread, factory);
            if (_socket)
                break;
        }

        if (helpers::haveSsl())
            _localUri = "https://127.0.0.1:" + std::to_string(_port);
        else
            _localUri = "http://127.0.0.1:" + std::to_string(_port);

        _pollServerThread.startThread();
        _pollServerThread.insertNewSocket(_socket);
    }

    void tearDown()
    {
        LOG_INF("HttpRequestTests::tearDown");
        _pollServerThread.stop();
        _socket.reset();
    }
};

constexpr std::chrono::seconds HttpRequestTests::DefTimeoutSeconds;

void HttpRequestTests::testSslHostname()
{
#if ENABLE_SSL
    constexpr auto testname = __func__;

    if (helpers::haveSsl())
    {
        const std::string host = "localhost";
        std::shared_ptr<SslStreamSocket> socket = StreamSocket::create<SslStreamSocket>(
            host, _port, false, std::make_shared<ServerRequestHandler>());
        LOK_ASSERT_EQUAL(host, socket->getSslServername());
    }
#endif
}

void HttpRequestTests::testInvalidURI()
{
    constexpr auto testname = __func__;

    try
    {
        // Cannot create from a blank URI.
        http::Session::createHttp(std::string());
        LOK_ASSERT_FAIL("Exception expected from http::Session::createHttp for invalid URI");
    }
    catch (const std::exception& ex)
    {
        // Pass.
    }
}

void HttpRequestTests::testBadResponse()
{
    constexpr auto testname = __func__;

    const std::string URL = "/inject/" + Util::bytesToHexString("\0\0xa", 2);

    http::Request httpRequest(URL);

    auto httpSession = http::Session::create(_localUri);
    if (httpSession)
    {
        httpSession->setTimeout(std::chrono::seconds(1));
        const std::shared_ptr<const http::Response> httpResponse =
            httpSession->syncRequest(httpRequest);

        LOK_ASSERT(httpResponse->done());
        LOK_ASSERT(httpResponse->state() == http::Response::State::Timeout);
    }
}

void HttpRequestTests::testGoodResponse()
{
    constexpr auto testname = __func__;

    // Inject the following response:
    // HTTP/1.1 200 OK
    // Date: Wed, 02 Jun 2021 02:30:52 GMT
    // Content-Type: text/html; charset=utf-8
    // Content-Length: 0
    const std::string URL =
        "/inject/"
        "485454502F312E3120323030204F4B0D0A446174653A205765642C203032204A756E20323032312030323A3330"
        "3A353220474D540D0A436F6E74656E742D547970653A20746578742F68746D6C3B20636861727365743D757466"
        "2D380D0A436F6E74656E742D4C656E6774683A20300D0A0D0A";

    http::Request httpRequest(URL);

    auto httpSession = http::Session::create(_localUri);
    if (httpSession)
    {
        httpSession->setTimeout(std::chrono::seconds(1));
        const std::shared_ptr<const http::Response> httpResponse =
            httpSession->syncRequest(httpRequest);

        LOK_ASSERT(httpResponse->done());
        LOK_ASSERT(httpResponse->state() == http::Response::State::Complete);
        LOK_ASSERT(!httpResponse->statusLine().httpVersion().empty());
        LOK_ASSERT(!httpResponse->statusLine().reasonPhrase().empty());
        LOK_ASSERT_EQUAL(200U, httpResponse->statusLine().statusCode());
        LOK_ASSERT(httpResponse->statusLine().statusCategory() ==
                   http::StatusLine::StatusCodeClass::Successful);
        LOK_ASSERT_EQUAL(std::string("HTTP/1.1"), httpResponse->statusLine().httpVersion());
        LOK_ASSERT_EQUAL(std::string("OK"), httpResponse->statusLine().reasonPhrase());
        LOK_ASSERT_EQUAL(std::string("text/html; charset=utf-8"),
                         httpResponse->header().getContentType());
        LOK_ASSERT_EQUAL(std::string("Wed, 02 Jun 2021 02:30:52 GMT"),
                         httpResponse->header().get("Date"));

        LOK_ASSERT_EQUAL(std::string(), httpResponse->getBody());
    }
}

void HttpRequestTests::testSimpleGet()
{
    constexpr auto testname = __func__;

    constexpr auto URL = "/";

    // Start the polling thread.
    SocketPoll pollThread("HttpAsyncReqPoll");
    pollThread.startThread();

    http::Request httpRequest(URL);

    //TODO: test with both SSL and Unencrypted.
    static constexpr http::Session::Protocol Protocols[]
        = { http::Session::Protocol::HttpUnencrypted, http::Session::Protocol::HttpSsl };
    for (const http::Session::Protocol protocol : Protocols)
    {
#if ENABLE_SSL
        if (protocol != http::Session::Protocol::HttpSsl)
#else
        if (protocol != http::Session::Protocol::HttpUnencrypted)
#endif
        {
            continue; // Skip, unsupported.
        }

        auto httpSession = http::Session::create(_localUri);
        httpSession->setTimeout(DefTimeoutSeconds);

        std::condition_variable cv;
        std::mutex mutex;
        bool timedout = true;
        httpSession->setFinishedHandler([&](const std::shared_ptr<http::Session>&) {
            std::lock_guard<std::mutex> lock(mutex);
            timedout = false;
            cv.notify_all();
        });

        std::unique_lock<std::mutex> lock(mutex);

        LOK_ASSERT(httpSession->asyncRequest(httpRequest, pollThread));

        // Use Poco to get the same URL in parallel.
        const auto pocoResponse = helpers::pocoGetRetry(Poco::URI(_localUri + URL));

        cv.wait_for(lock, DefTimeoutSeconds);

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
    constexpr auto testname = "simpleGetSync";

    const auto data = Util::rng::getHardRandomHexString(Util::rng::getNext() % 1024);
    const auto body = std::string(data.data(), data.size());
    const std::string URL = "/echo/" + body;
    TST_LOG("Requesting URI: [" << URL << ']');

    const auto pocoResponse = helpers::pocoGet(Poco::URI(_localUri + URL));

    http::Request httpRequest(URL);

    auto httpSession = http::Session::create(_localUri);
    httpSession->setTimeout(std::chrono::seconds(1));

    for (int i = 0; i < 5; ++i)
    {
        TST_LOG("Request #" << i);
        const std::shared_ptr<const http::Response> httpResponse
            = httpSession->syncRequest(httpRequest);
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
        LOK_ASSERT_EQUAL(body, httpResponse->getBody());
    }
}

void HttpRequestTests::testChunkedGetSync()
{
    constexpr auto testname = "chunkedGetSync";

    const auto data = Util::rng::getHardRandomHexString(Util::rng::getNext() % 1024);
    const auto body = std::string(data.data(), data.size());
    const std::string URL = "/echo/chunked/" + body;
    TST_LOG("Requesting URI: [" << URL << ']');

    const auto pocoResponse = helpers::pocoGet(Poco::URI(_localUri + URL));

    http::Request httpRequest(URL);

    auto httpSession = http::Session::create(_localUri);
    httpSession->setTimeout(DefTimeoutSeconds);

    for (int i = 0; i < 5; ++i)
    {
        TST_LOG("Request #" << i);
        const std::shared_ptr<const http::Response> httpResponse
            = httpSession->syncRequest(httpRequest);
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
        LOK_ASSERT_EQUAL(body, httpResponse->getBody());
    }
}

void HttpRequestTests::testChunkedGetSync_External()
{
    constexpr auto testname = "chunkedGetSync_External";

    const std::string hostname = "http://anglesharp.azurewebsites.net";
    const std::string URL = "/Chunked";
    TST_LOG("Requesting URI: [" << hostname << URL << ']');

    const auto pocoResponse = helpers::pocoGet(Poco::URI(hostname + URL));

    http::Request httpRequest(URL);

    auto httpSession = http::Session::create(hostname);
    httpSession->setTimeout(DefTimeoutSeconds);

    for (int i = 0; i < 5; ++i)
    {
        TST_LOG("Request #" << i);
        const std::shared_ptr<const http::Response> httpResponse
            = httpSession->syncRequest(httpRequest);
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
}


/// Compare the response from Poco with ours.
/// @checkReasonPhrase controls whether we compare the Reason Phrase too or not.
/// This is useful for when a status code is recognized by one and not the other.
/// @checkBody controls whether we compare the body content or not.
/// This is useful when we don't care about the content of the body, just that
/// there is some content at all or not.
static void compare(const Poco::Net::HTTPResponse& pocoResponse, const std::string& pocoBody,
                    const http::Response& httpResponse, bool checkReasonPhrase, bool checkBody,
                    const std::string& testname)
{
    LOK_ASSERT_EQUAL_MESSAGE("Response state", httpResponse.state(),
                             http::Response::State::Complete);
    LOK_ASSERT(!httpResponse.statusLine().httpVersion().empty());
    LOK_ASSERT(!httpResponse.statusLine().reasonPhrase().empty());

    if (checkBody)
        LOK_ASSERT_EQUAL_MESSAGE("Body", pocoBody, httpResponse.getBody());
    else
        LOK_ASSERT_EQUAL_MESSAGE("Body empty?", pocoBody.empty(), httpResponse.getBody().empty());

    LOK_ASSERT_EQUAL_MESSAGE("Status Code", static_cast<unsigned>(pocoResponse.getStatus()),
                             httpResponse.statusLine().statusCode());
    if (checkReasonPhrase)
        LOK_ASSERT_EQUAL_MESSAGE("Reason Phrase", Util::toLower(pocoResponse.getReason()),
                                 Util::toLower(httpResponse.statusLine().reasonPhrase()));
    else
        LOK_ASSERT_EQUAL_MESSAGE("Reason Phrase empty?", pocoResponse.getReason().empty(),
                                 httpResponse.statusLine().reasonPhrase().empty());

    LOK_ASSERT_EQUAL_MESSAGE("hasContentLength", pocoResponse.hasContentLength(),
                             httpResponse.header().hasContentLength());
    if (checkBody && pocoResponse.hasContentLength())
        LOK_ASSERT_EQUAL_MESSAGE("ContentLength", pocoResponse.getContentLength(),
                                 httpResponse.header().getContentLength());
}

/// This test requests specific *reponse* codes from
/// the server to test the handling of all possible
/// response status codes.
/// It exercises a few hundred requests/responses.
void HttpRequestTests::test500GetStatuses()
{
    constexpr auto testname = "test500GetStatuses ";

    // Start the polling thread.
    SocketPoll pollThread("HttpAsyncReqPoll");
    pollThread.startThread();

    auto httpSession = http::Session::create(_localUri);
    httpSession->setTimeout(DefTimeoutSeconds);

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

        TST_LOG("Requesting Status Code [" << statusCode << "]: " << url);

        std::unique_lock<std::mutex> lock(mutex);
        timedout = true; // Assume we timed out until we prove otherwise.

        LOK_ASSERT(httpSession->asyncRequest(httpRequest, pollThread));

        // Get via Poco in parallel.
        std::pair<std::shared_ptr<Poco::Net::HTTPResponse>, std::string> pocoResponse;
        if (statusCode > 100)
            pocoResponse = helpers::pocoGetRetry(Poco::URI(_localUri + url));
#ifdef ENABLE_EXTERNAL_REGRESSION_CHECK
        std::pair<std::shared_ptr<Poco::Net::HTTPResponse>, std::string> pocoResponseExt;
        if (statusCode > 100)
            pocoResponseExt = helpers::pocoGet(false, "httpbin.org", 80, url);
#endif

        const std::shared_ptr<const http::Response> httpResponse = httpSession->response();

        cv.wait_for(lock, DefTimeoutSeconds, [&]() { return httpResponse->done(); });

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
            compare(*pocoResponse.first, pocoResponse.second, *httpResponse, true, true, testname);

#ifdef ENABLE_EXTERNAL_REGRESSION_CHECK
            // These Status Codes are not recognized by httpbin.org,
            // so we get "unknown" and must skip comparing them.
            const bool checkReasonPhrase
                = (statusCode != 103 && statusCode != 208 && statusCode != 413 && statusCode != 414
                   && statusCode != 416 && statusCode != 421 && statusCode != 425
                   && statusCode != 440 && statusCode != 508 && statusCode != 511);
            const bool checkBody = (statusCode != 402 && statusCode != 418);
            compare(*pocoResponseExt.first, pocoResponseExt.second, *httpResponse,
                    checkReasonPhrase, checkBody, testname);
#endif
        }
    }

    pollThread.joinThread();
}

void HttpRequestTests::testSimplePost_External()
{
    constexpr auto testname = __func__;

    const std::string Host = "httpbin.org";
    const char* URL = "/post";

    // Start the polling thread.
    SocketPoll pollThread("HttpAsyncReqPoll");
    pollThread.startThread();

    http::Request httpRequest(URL, http::Request::VERB_POST);

    // Write the test data to file.
    const char data[] = "abcd-qwerty!!!";
    const std::string path = FileUtil::getSysTempDirectoryPath() + "/test_http_post";
    std::ofstream ofs(path, std::ios::binary);
    ofs.write(data, sizeof(data) - 1); // Don't write the terminating null.
    ofs.close();

    httpRequest.setBodyFile(path);

    auto httpSession = http::Session::createHttpSsl(Host);
    httpSession->setTimeout(DefTimeoutSeconds);

    std::condition_variable cv;
    std::mutex mutex;
    bool timedout = true;
    httpSession->setFinishedHandler([&](const std::shared_ptr<http::Session>&) {
        std::lock_guard<std::mutex> lock(mutex);
        timedout = false;
        cv.notify_all();
    });

    std::unique_lock<std::mutex> lock(mutex);

    LOK_ASSERT(httpSession->asyncRequest(httpRequest, pollThread));

    cv.wait_for(lock, DefTimeoutSeconds);

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
    constexpr auto testname = __func__;

    const char* URL = "/timeout";

    http::Request httpRequest(URL);

    auto httpSession = http::Session::create(_localUri);

    httpSession->setTimeout(std::chrono::milliseconds(1)); // Very short interval.

    const std::shared_ptr<const http::Response> httpResponse
        = httpSession->syncRequest(httpRequest);
    LOK_ASSERT(httpResponse->done());
    LOK_ASSERT(httpResponse->state() == http::Response::State::Timeout);
}

void HttpRequestTests::testOnFinished_Complete()
{
    constexpr auto testname = __func__;

    const char* URL = "/";

    http::Request httpRequest(URL);

    auto httpSession = http::Session::create(_localUri);

    bool completed = false;
    httpSession->setFinishedHandler([&](const std::shared_ptr<http::Session>& session) {
        LOK_ASSERT(session->response()->done());
        LOK_ASSERT(session->response()->state() == http::Response::State::Complete);
        completed = true;
        return true;
    });

    const std::shared_ptr<const http::Response> httpResponse
        = httpSession->syncRequest(httpRequest);
    LOK_ASSERT(completed);
    LOK_ASSERT(httpResponse->done());
    LOK_ASSERT(httpResponse->state() == http::Response::State::Complete);
}

void HttpRequestTests::testOnFinished_Timeout()
{
    constexpr auto testname = __func__;

    const char* URL = "/timeout";

    http::Request httpRequest(URL);

    auto httpSession = http::Session::create(_localUri);

    httpSession->setTimeout(std::chrono::milliseconds(1)); // Very short interval.

    bool completed = false;
    httpSession->setFinishedHandler([&](const std::shared_ptr<http::Session>& session) {
        LOK_ASSERT(session->response()->done());
        LOK_ASSERT(session->response()->state() == http::Response::State::Timeout);
        completed = true;
        return true;
    });

    const std::shared_ptr<const http::Response> httpResponse
        = httpSession->syncRequest(httpRequest);
    LOK_ASSERT(completed);
    LOK_ASSERT(httpResponse->done());
    LOK_ASSERT(httpResponse->state() == http::Response::State::Timeout);
}

CPPUNIT_TEST_SUITE_REGISTRATION(HttpRequestTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
