/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/FilePartSource.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/InvalidCertificateHandler.h>
#include <Poco/Net/PrivateKeyPassphraseHandler.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>
#include <cppunit/extensions/HelperMacros.h>

#include <Common.hpp>
#include <Util.hpp>

#include "countloolkits.hpp"

/// Tests the HTTP POST API of loolwsd. The server has to be started manually before running this test.
class HTTPPostTest : public CPPUNIT_NS::TestFixture
{
    static int _initialLoolKitCount;

    CPPUNIT_TEST_SUITE(HTTPPostTest);

    // This should be the first test:
    CPPUNIT_TEST(testCountHowManyLoolkits);

    CPPUNIT_TEST(testLOleaflet);
    CPPUNIT_TEST(testParams);
    CPPUNIT_TEST(testConvertTo);

    // This should be the last test:
    CPPUNIT_TEST(testNoExtraLoolKitsLeft);

    CPPUNIT_TEST_SUITE_END();

    void testCountHowManyLoolkits();
    void testLOleaflet();
    void testParams();
    void testConvertTo();
    void testNoExtraLoolKitsLeft();

#if ENABLE_SSL
public:
    HTTPPostTest()
    {
        Poco::Net::initializeSSL();
        // Just accept the certificate anyway for testing purposes
        Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidCertHandler = new Poco::Net::AcceptCertificateHandler(false);
        Poco::Net::Context::Params sslParams;
        Poco::Net::Context::Ptr sslContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslParams);
        Poco::Net::SSLManager::instance().initializeClient(0, invalidCertHandler, sslContext);
    }

    ~HTTPPostTest()
    {
        Poco::Net::uninitializeSSL();
    }
#endif
};

int HTTPPostTest::_initialLoolKitCount = 0;

void HTTPPostTest::testCountHowManyLoolkits()
{
    _initialLoolKitCount = countLoolKitProcesses();
    CPPUNIT_ASSERT(_initialLoolKitCount > 0);
}

void HTTPPostTest::testLOleaflet()
{
#if ENABLE_SSL
    Poco::URI uri("https://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPSClientSession session(uri.getHost(), uri.getPort());
#else
    Poco::URI uri("http://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
#endif

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/loleaflet/dist/loleaflet.html");
    std::string body;
    request.setContentLength((int) body.length());
    session.sendRequest(request) << body;

    Poco::Net::HTTPResponse response;
    std::istream& rs = session.receiveResponse(response);
    CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());
    CPPUNIT_ASSERT_EQUAL(std::string("text/html"), response.getContentType());
}

void HTTPPostTest::testParams()
{
#if ENABLE_SSL
    Poco::URI uri("https://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPSClientSession session(uri.getHost(), uri.getPort());
#else
    Poco::URI uri("http://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
#endif

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/loleaflet/dist/loleaflet.html");
    Poco::Net::HTMLForm form;
    form.set("access_token", "2222222222");
    form.prepareSubmit(request);
    std::ostream& ostr = session.sendRequest(request);
    form.write(ostr);

    Poco::Net::HTTPResponse response;
    std::istream& rs = session.receiveResponse(response);
    CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());

    std::string html;
    Poco::StreamCopier::copyToString(rs, html);

    CPPUNIT_ASSERT(html.find(form["access_token"]) != std::string::npos);
    CPPUNIT_ASSERT(html.find(uri.getHost()) != std::string::npos);
    CPPUNIT_ASSERT(html.find(std::string(LOOLWSD_VERSION)) != std::string::npos);
}

void HTTPPostTest::testConvertTo()
{
    const auto srcPath = Util::getTempFilePath(TDOC, "hello.odt");

#if ENABLE_SSL
    Poco::URI uri("https://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPSClientSession session(uri.getHost(), uri.getPort());
#else
    Poco::URI uri("http://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
#endif

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/convert-to");
    Poco::Net::HTMLForm form;
    form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
    form.set("format", "txt");
    form.addPart("data", new Poco::Net::FilePartSource(srcPath));
    form.prepareSubmit(request);
    // If this results in a Poco::Net::ConnectionRefusedException, loolwsd is not running.
    form.write(session.sendRequest(request));

    Poco::Net::HTTPResponse response;
    std::stringstream actualStream;
    // receiveResponse() resulted in a Poco::Net::NoMessageException.
    std::istream& responseStream = session.receiveResponse(response);
    Poco::StreamCopier::copyStream(responseStream, actualStream);

    std::ifstream fileStream(TDOC "/hello.txt");
    std::stringstream expectedStream;
    expectedStream << fileStream.rdbuf();

    // Remove the temp files.
    Util::removeFile(srcPath);

    // In some cases the result is prefixed with (the UTF-8 encoding of) the Unicode BOM
    // (U+FEFF). Skip that.
    std::string actualString = actualStream.str();
    if (actualString.size() > 3 && actualString[0] == '\xEF' && actualString[1] == '\xBB' && actualString[2] == '\xBF')
        actualString = actualString.substr(3);
    CPPUNIT_ASSERT_EQUAL(expectedStream.str(), actualString);
}

void HTTPPostTest::testNoExtraLoolKitsLeft()
{
    int countNow = countLoolKitProcesses();

    CPPUNIT_ASSERT_EQUAL(_initialLoolKitCount, countNow);
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPPostTest);
//CPPUNIT_TEST_SUITE_NAMED_REGISTRATION(HTTPPostTest, "httpposttest");

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
