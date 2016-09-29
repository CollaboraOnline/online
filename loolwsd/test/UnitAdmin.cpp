/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <cassert>
#include <condition_variable>
#include <mutex>

#include "Common.hpp"
#include "Unit.hpp"
#include "Util.hpp"
#include "Log.hpp"

#include <Poco/StringTokenizer.h>
#include <Poco/Net/HTTPBasicCredentials.h>
#include <Poco/Net/HTTPCookie.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/NameValueCollection.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include "helpers.hpp"

#define UNIT_URI "/loolwsd/unit-admin"

using Poco::Net::HTTPBasicCredentials;
using Poco::Net::HTTPCookie;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Net::HTTPClientSession;
using Poco::StringTokenizer;

// Inside the WSD process
class UnitAdmin : public UnitWSD
{
private:
    unsigned _testCounter = 0;
    std::string _jwtCookie;
    bool _isTestRunning = false;
    const Poco::URI _uri;
    std::shared_ptr<Poco::Net::WebSocket> _adminWs;

    typedef TestResult (UnitAdmin::*AdminTest)(void);
    std::vector<AdminTest> _tests;

    std::shared_ptr<Poco::Net::WebSocket> _docWs1;
    std::shared_ptr<Poco::Net::WebSocket> _docWs2;
    std::shared_ptr<Poco::Net::WebSocket> _docWs3;
    int _docPid1;
    int _docPid2;
    int _docPid3;
    int _usersCount = 0;
    int _docsCount = 0;

    int  _messageTimeoutMilliSeconds = 5000;
    std::condition_variable _messageReceivedCV;
    std::mutex _messageReceivedMutex;
    std::string _messageReceived;

// Tests
private:
    TestResult testIncorrectPassword()
    {
        HTTPResponse response;
        std::string path(_uri.getPathAndQuery());
        HTTPRequest request(HTTPRequest::HTTP_GET, path);
        std::unique_ptr<HTTPClientSession> session(helpers::createSession(_uri));

        session->sendRequest(request);
        session->receiveResponse(response);
        TestResult res = TestResult::TEST_FAILED;
        if (response.getStatus() == HTTPResponse::HTTP_UNAUTHORIZED)
            res = TestResult::TEST_OK;

        Log::info(std::string("testIncorrectPassword: ") + (res == TestResult::TEST_OK ? "OK" : "FAIL"));
        return res;
    }

    TestResult testCorrectPassword()
    {
        HTTPResponse response;
        std::string path(_uri.getPathAndQuery());
        HTTPRequest request(HTTPRequest::HTTP_GET, path);
        std::unique_ptr<HTTPClientSession> session(helpers::createSession(_uri));
        HTTPBasicCredentials credentials("admin", "admin");
        credentials.authenticate(request);

        session->sendRequest(request);
        session->receiveResponse(response);
        std::vector<HTTPCookie> cookies;
        response.getCookies(cookies);

        // For now we only set one cookie
        assert(cookies.size() == 1);
        // and it is jwt=
        assert(cookies[0].getName() == "jwt");

        // Check cookie properties
        std::string cookiePath = cookies[0].getPath();
        bool secure = cookies[0].getSecure();
        bool httpOnly = cookies[0].getHttpOnly();
        std::string value = cookies[0].getValue();
        TestResult res = TestResult::TEST_FAILED;
        if (cookiePath.find_first_of("/lool/adminws/") == 0 &&
            secure &&
            httpOnly &&
            value != "")
        {
            // Set JWT cookie to be used for subsequent tests
            _jwtCookie = value;
            res = TestResult::TEST_OK;
        }

        Log::info(std::string("testCorrectPassword: ") + (res == TestResult::TEST_OK ? "OK" : "FAIL"));
        return res;
    }

    TestResult testWebSocketWithoutCookie()
    {
        // try connecting without cookie; should result in exception
        HTTPResponse response;
        HTTPRequest request(HTTPRequest::HTTP_GET, "/adminws/");
        std::unique_ptr<HTTPClientSession> session(helpers::createSession(_uri));
        bool authorized = true;
        try
        {
            _adminWs = std::make_shared<Poco::Net::WebSocket>(*session, request, response);
        }
        catch (const Poco::Net::WebSocketException& exc)
        {
            Log::info() << "Admin websocket: Not authorized " << Log::end;
            authorized = false;
        }

        // no cookie -> should result in not authorized exception
        TestResult res = TestResult::TEST_FAILED;
        if (!authorized)
            res = TestResult::TEST_OK;

        Log::info(std::string("testWebSocketWithoutCookie: ") + (res == TestResult::TEST_OK ? "OK" : "FAIL"));
        return res;
    }

    TestResult testWebSocketWithCookie()
    {
        HTTPResponse response;
        HTTPRequest request(HTTPRequest::HTTP_GET, "/lool/adminws/");
        std::unique_ptr<HTTPClientSession> session(helpers::createSession(_uri));

        // set cookie
        assert(_jwtCookie != "");
        HTTPCookie cookie("jwt", _jwtCookie);
        Poco::Net::NameValueCollection nvc;
        nvc.add("jwt", _jwtCookie);
        request.setCookies(nvc);

        bool authorized = true;
        try
        {
            _adminWs = std::make_shared<Poco::Net::WebSocket>(*session, request, response);
        }
        catch (const Poco::Net::WebSocketException& exc)
        {
            Log::info() << "Admin websocket: Not authorized " << Log::end;
            authorized = false;
        }

        TestResult res = TestResult::TEST_FAILED;
        if (authorized)
            res = TestResult::TEST_OK;

        Log::info(std::string("testWebSocketWithCookie: ") + (res == TestResult::TEST_OK ? "OK" : "FAIL"));
        return res;
    }

    TestResult testAddDocNotify()
    {
        // subscribe notification on admin websocket
        const std::string subscribeMessage = "subscribe adddoc";
        _adminWs->sendFrame(subscribeMessage.data(), subscribeMessage.size());


        std::string documentPath1, documentURL1;
        helpers::getDocumentPathAndURL("hello.odt", documentPath1, documentURL1);
        HTTPRequest request1(HTTPRequest::HTTP_GET, documentURL1);
        HTTPResponse response1;
        const Poco::URI docUri1(helpers::getTestServerURI());
        const std::string loadMessage1 = "load url=" + documentURL1;
        std::unique_ptr<HTTPClientSession> session1(helpers::createSession(docUri1));
        std::unique_ptr<HTTPClientSession> session2(helpers::createSession(docUri1));

        std::unique_lock<std::mutex> lock(_messageReceivedMutex);
        _messageReceived.clear();
        _docWs1 = std::make_shared<Poco::Net::WebSocket>(*session1, request1, response1);
        _docWs1->sendFrame(loadMessage1.data(), loadMessage1.size());
        if (_messageReceivedCV.wait_for(lock, std::chrono::milliseconds(_messageTimeoutMilliSeconds)) == std::cv_status::timeout)
        {
            Log::info("testAddDocNotify: Timed out waiting for admin console message");
            return TestResult::TEST_TIMED_OUT;
        }
        lock.unlock();

        {
            StringTokenizer tokens(_messageReceived, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            if (tokens.count() != 5 ||
                tokens[0] != "adddoc" ||
                tokens[2] != documentPath1.substr(documentPath1.find_last_of("/") + 1) )
            {
                Log::info("testAddDocNotify: Unrecognized message format");
                return TestResult::TEST_FAILED;
            }

            // store document pid
            _docPid1 = std::stoi(tokens[1]);
            _usersCount++;
        }
        _docsCount++;

        // Open another view of same document
        lock.lock(); // lock _messageReceivedMutex
        _messageReceived.clear();
        _docWs2 = std::make_shared<Poco::Net::WebSocket>(*session2, request1, response1);
        _docWs2->sendFrame(loadMessage1.data(), loadMessage1.size());
        if (_messageReceivedCV.wait_for(lock, std::chrono::milliseconds(_messageTimeoutMilliSeconds)) == std::cv_status::timeout)
        {
            Log::info("testAddDocNotify: Timed out waiting for admin console message");
            return TestResult::TEST_TIMED_OUT;
        }
        lock.unlock();

        {
            StringTokenizer tokens(_messageReceived, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            if (tokens.count() != 5 ||
                tokens[0] != "adddoc" ||
                tokens[2] != documentPath1.substr(documentPath1.find_last_of("/") + 1) )
            {
                Log::info("testAddDocNotify: Unrecognized message format");
                return TestResult::TEST_FAILED;
            }

            // store document pid
            _docPid2 = std::stoi(tokens[1]);
            _usersCount++;
        }

        // Open another document (different)
        std::string documentPath2, documentURL2;
        helpers::getDocumentPathAndURL("insert-delete.odp", documentPath2, documentURL2);
        HTTPRequest request2(HTTPRequest::HTTP_GET, documentURL2);
        HTTPResponse response2;
        const Poco::URI docUri2(helpers::getTestServerURI());
        const std::string loadMessage2 = "load url=" + documentURL2;
        std::unique_ptr<HTTPClientSession> session3(helpers::createSession(docUri1));

        lock.lock(); // lock _messageReceivedMutex
        _messageReceived.clear();
        _docWs3 = std::make_shared<Poco::Net::WebSocket>(*session3, request2, response2);
        _docWs3->sendFrame(loadMessage2.data(), loadMessage2.size());
        if (_messageReceivedCV.wait_for(lock, std::chrono::milliseconds(_messageTimeoutMilliSeconds)) == std::cv_status::timeout)
        {
            Log::info("testAddDocNotify: Timed out waiting for admin console message");
            return TestResult::TEST_TIMED_OUT;
        }
        lock.unlock();

        {
            StringTokenizer tokens(_messageReceived, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
            if (tokens.count() != 5 ||
                tokens[0] != "adddoc" ||
                tokens[2] != documentPath2.substr(documentPath2.find_last_of("/") + 1) )
            {
                Log::info("testAddDocNotify: Unrecognized message format");
                return TestResult::TEST_FAILED;
            }

            // store document pid
            _docPid3 = std::stoi(tokens[1]);
            _usersCount++;
        }
        _docsCount++;

        return TestResult::TEST_OK;
    }

    TestResult testUsersCount()
    {
        _messageReceived.clear();

        // We should have 3 users by now; lets verify
        const std::string queryMessage = "active_users_count";
        _adminWs->sendFrame(queryMessage.data(), queryMessage.size());

        std::unique_lock<std::mutex> lock(_messageReceivedMutex);
        if (_messageReceived.empty() &&
            _messageReceivedCV.wait_for(lock, std::chrono::milliseconds(_messageTimeoutMilliSeconds)) == std::cv_status::timeout)
        {
            Log::info("testAddDocNotify: Timed out waiting for admin console message");
            return TestResult::TEST_TIMED_OUT;
        }
        lock.unlock();

        StringTokenizer tokens(_messageReceived, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        if (tokens.count() != 2 ||
            tokens[0] != "active_users_count" ||
            std::stoi(tokens[1]) != _usersCount)
        {
            Log::info("testAddDocNotify: Unrecognized message format");
            return TestResult::TEST_FAILED;
        }

        return TestResult::TEST_OK;
    }

    TestResult testDocCount()
    {
        _messageReceived.clear();

        // We should have 2 total docs open by now; lets verify
        const std::string queryMessage = "active_docs_count";
        _adminWs->sendFrame(queryMessage.data(), queryMessage.size());

        std::unique_lock<std::mutex> lock(_messageReceivedMutex);
        if (_messageReceived.empty() &&
            _messageReceivedCV.wait_for(lock, std::chrono::milliseconds(_messageTimeoutMilliSeconds)) == std::cv_status::timeout)
        {
            Log::info("testAddDocNotify: Timed out waiting for admin console message");
            return TestResult::TEST_TIMED_OUT;
        }
        lock.unlock();

        StringTokenizer tokens(_messageReceived, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        if (tokens.count() != 2 ||
            tokens[0] != "active_docs_count" ||
            std::stoi(tokens[1]) != _docsCount)
        {
            Log::info("testAddDocNotify: Unrecognized message format");
            return TestResult::TEST_FAILED;
        }

        return TestResult::TEST_OK;
    }

    TestResult testRmDocNotify()
    {
        _messageReceived.clear();

        // subscribe to rmdoc notification on admin websocket
        const std::string subscribeMessage = "subscribe rmdoc";
        _adminWs->sendFrame(subscribeMessage.data(), subscribeMessage.size());

        _docWs1->close();
        std::unique_lock<std::mutex> lock(_messageReceivedMutex);
        if (_messageReceived.empty() &&
            _messageReceivedCV.wait_for(lock, std::chrono::milliseconds(_messageTimeoutMilliSeconds)) == std::cv_status::timeout)
        {
            Log::info("testRmDocNotify: Timed out waiting for admin console message");
            return TestResult::TEST_TIMED_OUT;
        }
        lock.unlock();

        StringTokenizer tokens(_messageReceived, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
        if (tokens.count() != 3 ||
            tokens[0] != "rmdoc" ||
            stoi(tokens[1]) != _docPid1)
        {
            Log::info("testRmDocNotify: Invalid message format");
            return TestResult::TEST_FAILED;
        }
        _usersCount--;

        return TestResult::TEST_OK;
    }

public:
    UnitAdmin()
        : _uri(helpers::getTestServerURI() + "/loleaflet/dist/admin/admin.html")
    {
        // Register tests here.
        _tests.push_back(&UnitAdmin::testIncorrectPassword);
        _tests.push_back(&UnitAdmin::testCorrectPassword);
        _tests.push_back(&UnitAdmin::testWebSocketWithoutCookie);
        _tests.push_back(&UnitAdmin::testWebSocketWithCookie);
        _tests.push_back(&UnitAdmin::testAddDocNotify);
        _tests.push_back(&UnitAdmin::testUsersCount);
        _tests.push_back(&UnitAdmin::testDocCount);
        // FIXME make this one reliable, and enable again _tests.push_back(&UnitAdmin::testRmDocNotify);
        _tests.push_back(&UnitAdmin::testUsersCount);
        _tests.push_back(&UnitAdmin::testDocCount);
    }

    // Runs tests sequentially in _tests
    virtual void invokeTest()
    {
        if (!_isTestRunning)
        {
            _isTestRunning = true;
            AdminTest test = _tests[_testCounter++];
            TestResult res = ((*this).*(test))();
            if (res != TestResult::TEST_OK)
            {
                exitTest(res);
                return;
            }

            // End this when all tests are finished
            if (_tests.size() == _testCounter)
                exitTest(TestResult::TEST_OK);

            _isTestRunning = false;
        }
    }

    virtual void onAdminNotifyMessage(const std::string& message)
    {
        std::unique_lock<std::mutex> lock(_messageReceivedMutex);
        _messageReceivedCV.notify_all();
        _messageReceived = message;
    }

    virtual void onAdminQueryMessage(const std::string& message)
    {
        std::unique_lock<std::mutex> lock(_messageReceivedMutex);
        _messageReceivedCV.notify_all();
        _messageReceived = message;
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitAdmin();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
