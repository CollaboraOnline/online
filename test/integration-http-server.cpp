/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/FilePartSource.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/InvalidCertificateHandler.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/RegularExpression.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>

#include <cppunit/extensions/HelperMacros.h>

#include <Common.hpp>
#include <common/FileUtil.hpp>

#include <countloolkits.hpp>
#include <helpers.hpp>

/// Tests the HTTP GET API of loolwsd.
class HTTPServerTest : public CPPUNIT_NS::TestFixture
{
    const Poco::URI _uri;

    CPPUNIT_TEST_SUITE(HTTPServerTest);

    CPPUNIT_TEST(testLoleafletGet);
    CPPUNIT_TEST(testLoleafletPost);
    CPPUNIT_TEST(testScriptsAndLinksGet);
    CPPUNIT_TEST(testScriptsAndLinksPost);
    CPPUNIT_TEST(testConvertTo);
    CPPUNIT_TEST(testConvertTo2);
    CPPUNIT_TEST(testConvertToWithForwardedClientIP);

    CPPUNIT_TEST_SUITE_END();

    void testLoleafletGet();
    void testLoleafletPost();
    void testScriptsAndLinksGet();
    void testScriptsAndLinksPost();
    void testConvertTo();
    void testConvertTo2();
    void testConvertToWithForwardedClientIP();

public:
    HTTPServerTest()
        : _uri(helpers::getTestServerURI())
    {
#if ENABLE_SSL
        Poco::Net::initializeSSL();
        // Just accept the certificate anyway for testing purposes
        Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidCertHandler = new Poco::Net::AcceptCertificateHandler(false);
        Poco::Net::Context::Params sslParams;
        Poco::Net::Context::Ptr sslContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslParams);
        Poco::Net::SSLManager::instance().initializeClient(nullptr, invalidCertHandler, sslContext);
#endif
    }

    ~HTTPServerTest()
    {
#if ENABLE_SSL
        Poco::Net::uninitializeSSL();
#endif
    }

    void setUp()
    {
        helpers::resetTestStartTime();
        testCountHowManyLoolkits();
        helpers::resetTestStartTime();
    }

    void tearDown()
    {
        helpers::resetTestStartTime();
        testNoExtraLoolKitsLeft();
        helpers::resetTestStartTime();
    }

    // A server URI which was not added to loolwsd.xml as post_allow IP or a wopi storage host
    Poco::URI getNotAllowedTestServerURI()
    {
        static std::string serverURI(
#if ENABLE_SSL
            "https://165.227.162.232:9980"
#else
            "http://165.227.162.232:9980"
#endif
            );

        return Poco::URI(serverURI);
    }
};


void HTTPServerTest::testLoleafletGet()
{
    std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, "/loleaflet/dist/loleaflet.html?access_token=111111111");
    Poco::Net::HTMLForm param(request);
    session->sendRequest(request);

    Poco::Net::HTTPResponse response;
    std::istream& rs = session->receiveResponse(response);
    LOK_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());
    LOK_ASSERT_EQUAL(std::string("text/html"), response.getContentType());

    std::string html;
    Poco::StreamCopier::copyToString(rs, html);

    LOK_ASSERT(html.find(param["access_token"]) != std::string::npos);
    LOK_ASSERT(html.find(_uri.getHost()) != std::string::npos);
    LOK_ASSERT(html.find(std::string(LOOLWSD_VERSION_HASH)) != std::string::npos);
}

void HTTPServerTest::testLoleafletPost()
{
    std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/loleaflet/dist/loleaflet.html");
    Poco::Net::HTMLForm form;
    form.set("access_token", "2222222222");
    form.prepareSubmit(request);
    std::ostream& ostr = session->sendRequest(request);
    form.write(ostr);

    Poco::Net::HTTPResponse response;
    std::istream& rs = session->receiveResponse(response);
    LOK_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());

    std::string html;
    Poco::StreamCopier::copyToString(rs, html);

    LOK_ASSERT(html.find(form["access_token"]) != std::string::npos);
    LOK_ASSERT(html.find(_uri.getHost()) != std::string::npos);
}

namespace
{

void assertHTTPFilesExist(const Poco::URI& uri, Poco::RegularExpression& expr, const std::string& html, const std::string& mimetype = std::string())
{
    Poco::RegularExpression::MatchVec matches;
    bool found = false;

    for (int offset = 0; expr.match(html, offset, matches) > 0; offset = static_cast<int>(matches[0].offset + matches[0].length))
    {
        found = true;
        LOK_ASSERT_EQUAL(2, (int)matches.size());
        Poco::URI uriScript(html.substr(matches[1].offset, matches[1].length));
        if (uriScript.getHost().empty())
        {
            std::string scriptString(uriScript.toString());

            // ignore the branding bits, it's not an error when they aren't present.
            if (scriptString.find("/branding.") != std::string::npos)
                continue;

            std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(uri));

            Poco::Net::HTTPRequest requestScript(Poco::Net::HTTPRequest::HTTP_GET, scriptString);
            session->sendRequest(requestScript);

            Poco::Net::HTTPResponse responseScript;
            session->receiveResponse(responseScript);
            LOK_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, responseScript.getStatus());

            if (!mimetype.empty())
            LOK_ASSERT_EQUAL(mimetype, responseScript.getContentType());
        }
    }

    LOK_ASSERT_MESSAGE("No match found", found);
}

}

void HTTPServerTest::testScriptsAndLinksGet()
{
    std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, "/loleaflet/dist/loleaflet.html");
    session->sendRequest(request);

    Poco::Net::HTTPResponse response;
    std::istream& rs = session->receiveResponse(response);
    LOK_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());

    std::string html;
    Poco::StreamCopier::copyToString(rs, html);

    Poco::RegularExpression script("<script.*?src=\"(.*?)\"");
    assertHTTPFilesExist(_uri, script, html, "application/javascript");

    Poco::RegularExpression link("<link.*?href=\"(.*?)\"");
    assertHTTPFilesExist(_uri, link, html);
}

void HTTPServerTest::testScriptsAndLinksPost()
{
    std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/loleaflet/dist/loleaflet.html");
    std::string body;
    request.setContentLength((int) body.length());
    session->sendRequest(request) << body;

    Poco::Net::HTTPResponse response;
    std::istream& rs = session->receiveResponse(response);
    LOK_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());

    std::string html;
    Poco::StreamCopier::copyToString(rs, html);

    Poco::RegularExpression script("<script.*?src=\"(.*?)\"");
    assertHTTPFilesExist(_uri, script, html, "application/javascript");

    Poco::RegularExpression link("<link.*?href=\"(.*?)\"");
    assertHTTPFilesExist(_uri, link, html);
}

void HTTPServerTest::testConvertTo()
{
    const char *testname = "testConvertTo";
    const std::string srcPath = FileUtil::getTempFilePath(TDOC, "hello.odt", "convertTo_");
    std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));
    session->setTimeout(Poco::Timespan(5, 0)); // 5 seconds.

    TST_LOG("Convert-to odt -> txt");

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/lool/convert-to");
    Poco::Net::HTMLForm form;
    form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
    form.set("format", "txt");
    form.addPart("data", new Poco::Net::FilePartSource(srcPath));
    form.prepareSubmit(request);
    try
    {
        form.write(session->sendRequest(request));
    }
    catch (const std::exception& ex)
    {
        // In case the server is still starting up.
        sleep(5);
        form.write(session->sendRequest(request));
    }

    Poco::Net::HTTPResponse response;
    std::stringstream actualStream;
    std::istream& responseStream = session->receiveResponse(response);
    Poco::StreamCopier::copyStream(responseStream, actualStream);

    std::ifstream fileStream(TDOC "/hello.txt");
    std::stringstream expectedStream;
    expectedStream << fileStream.rdbuf();

    // Remove the temp files.
    FileUtil::removeFile(srcPath);

    // In some cases the result is prefixed with (the UTF-8 encoding of) the Unicode BOM
    // (U+FEFF). Skip that.
    std::string actualString = actualStream.str();
    if (actualString.size() > 3 && actualString[0] == '\xEF' && actualString[1] == '\xBB' && actualString[2] == '\xBF')
        actualString = actualString.substr(3);
    LOK_ASSERT_EQUAL(expectedStream.str(), actualString);
}

void HTTPServerTest::testConvertTo2()
{
    const char *testname = "testConvertTo2";
    const std::string srcPath = FileUtil::getTempFilePath(TDOC, "convert-to.xlsx", "convertTo_");
    std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));
    session->setTimeout(Poco::Timespan(10, 0)); // 10 seconds.

    TST_LOG("Convert-to #2 xlsx -> png");

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/lool/convert-to");
    Poco::Net::HTMLForm form;
    form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
    form.set("format", "png");
    form.addPart("data", new Poco::Net::FilePartSource(srcPath));
    form.prepareSubmit(request);
    try
    {
        form.write(session->sendRequest(request));
    }
    catch (const std::exception& ex)
    {
        // In case the server is still starting up.
        sleep(5);
        form.write(session->sendRequest(request));
    }

    Poco::Net::HTTPResponse response;
    std::stringstream actualStream;
    std::istream& responseStream = session->receiveResponse(response);
    Poco::StreamCopier::copyStream(responseStream, actualStream);

    // Remove the temp files.
    FileUtil::removeFile(srcPath);

    std::string actualString = actualStream.str();
    LOK_ASSERT(actualString.size() >= 100);
//  LOK_ASSERT_EQUAL(actualString[0], 0x89);
    LOK_ASSERT_EQUAL(actualString[1], 'P');
    LOK_ASSERT_EQUAL(actualString[2], 'N');
    LOK_ASSERT_EQUAL(actualString[3], 'G');
}

void HTTPServerTest::testConvertToWithForwardedClientIP()
{
    const std::string testname = "convertToWithForwardedClientIP-";
    constexpr int TimeoutSeconds = 10; // Sometimes dns resolving is slow.

    // Test a forwarded IP which is not allowed to use convert-to feature
    try
    {
        TST_LOG("Converting from a disallowed IP.");

        const std::string srcPath = FileUtil::getTempFilePath(TDOC, "hello.odt", testname + "disallowed");
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));
        session->setTimeout(Poco::Timespan(TimeoutSeconds, 0));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/lool/convert-to");
        LOK_ASSERT(!request.has("X-Forwarded-For"));
        request.add("X-Forwarded-For", getNotAllowedTestServerURI().getHost() + ", " + _uri.getHost());
        Poco::Net::HTMLForm form;
        form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
        form.set("format", "txt");
        form.addPart("data", new Poco::Net::FilePartSource(srcPath));
        form.prepareSubmit(request);
        try
        {
            form.write(session->sendRequest(request));
        }
        catch (const std::exception& ex)
        {
            // In case the server is still starting up.
            sleep(2);
            form.write(session->sendRequest(request));
        }

        Poco::Net::HTTPResponse response;
        std::stringstream actualStream;
        std::istream& responseStream = session->receiveResponse(response);
        Poco::StreamCopier::copyStream(responseStream, actualStream);

        // Remove the temp files.
        FileUtil::removeFile(srcPath);

        std::string actualString = actualStream.str();
        LOK_ASSERT(actualString.empty()); // <- we did not get the converted file
    }
    catch(const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText() + ": " + (exc.nested() ? exc.nested()->displayText() : ""));
    }

    // Test a forwarded IP which is allowed to use convert-to feature
    try
    {
        TST_LOG("Converting from an allowed IP.");

        const std::string srcPath = FileUtil::getTempFilePath(TDOC, "hello.odt", testname + "allowed");
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));
        session->setTimeout(Poco::Timespan(TimeoutSeconds, 0));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/lool/convert-to");
        LOK_ASSERT(!request.has("X-Forwarded-For"));
        request.add("X-Forwarded-For", _uri.getHost() + ", " + _uri.getHost());
        Poco::Net::HTMLForm form;
        form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
        form.set("format", "txt");
        form.addPart("data", new Poco::Net::FilePartSource(srcPath));
        form.prepareSubmit(request);
        form.write(session->sendRequest(request));

        Poco::Net::HTTPResponse response;
        std::stringstream actualStream;
        std::istream& responseStream = session->receiveResponse(response);
        Poco::StreamCopier::copyStream(responseStream, actualStream);

        std::ifstream fileStream(TDOC "/hello.txt");
        std::stringstream expectedStream;
        expectedStream << fileStream.rdbuf();

        // Remove the temp files.
        FileUtil::removeFile(srcPath);

        // In some cases the result is prefixed with (the UTF-8 encoding of) the Unicode BOM
        // (U+FEFF). Skip that.
        std::string actualString = actualStream.str();
        if (actualString.size() > 3 && actualString[0] == '\xEF' && actualString[1] == '\xBB' && actualString[2] == '\xBF')
            actualString = actualString.substr(3);
        LOK_ASSERT_EQUAL(expectedStream.str(), actualString); // <- we got the converted file
    }
    catch(const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText() + ": " + (exc.nested() ? exc.nested()->displayText() : ""));
    }

    // Test a forwarded header with three IPs, one is not allowed -> request is denied.
    try
    {
        TST_LOG("Converting from multiple IPs, on disallowed.");

        const std::string srcPath = FileUtil::getTempFilePath(TDOC, "hello.odt", testname + "disallowed-multi");
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(_uri));
        session->setTimeout(Poco::Timespan(TimeoutSeconds, 0));

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/lool/convert-to");
        LOK_ASSERT(!request.has("X-Forwarded-For"));
        request.add("X-Forwarded-For", _uri.getHost() + ", "
                                       + getNotAllowedTestServerURI().getHost() + ", "
                                       + _uri.getHost());
        Poco::Net::HTMLForm form;
        form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
        form.set("format", "txt");
        form.addPart("data", new Poco::Net::FilePartSource(srcPath));
        form.prepareSubmit(request);
        form.write(session->sendRequest(request));

        Poco::Net::HTTPResponse response;
        std::stringstream actualStream;
        std::istream& responseStream = session->receiveResponse(response);
        Poco::StreamCopier::copyStream(responseStream, actualStream);

        // Remove the temp files.
        FileUtil::removeFile(srcPath);

        std::string actualString = actualStream.str();
        LOK_ASSERT(actualString.empty()); // <- we did not get the converted file
    }
    catch(const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText() + ": " + (exc.nested() ? exc.nested()->displayText() : ""));
    }
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPServerTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
