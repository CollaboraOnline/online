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

/// Tests the HTTP GET API of loolwsd.
class HTTPServerTest : public CPPUNIT_NS::TestFixture
{
    static int _initialLoolKitCount;

    CPPUNIT_TEST_SUITE(HTTPServerTest);

    // This should be the first test:
    CPPUNIT_TEST(testCountHowManyLoolkits);

    CPPUNIT_TEST(testDiscovery);
    CPPUNIT_TEST(testLoleafletGet);
    CPPUNIT_TEST(testLoleafletPost);
    CPPUNIT_TEST(testScriptsAndLinksGet);
    CPPUNIT_TEST(testScriptsAndLinksPost);

    // This should be the last test:
    CPPUNIT_TEST(testNoExtraLoolKitsLeft);

    CPPUNIT_TEST_SUITE_END();

    void testCountHowManyLoolkits();

    void testDiscovery();
    void testLoleafletGet();
    void testLoleafletPost();
    void testScriptsAndLinksGet();
    void testScriptsAndLinksPost();

    void testNoExtraLoolKitsLeft();

#if ENABLE_SSL
public:
    HTTPServerTest()
    {
        Poco::Net::initializeSSL();
        // Just accept the certificate anyway for testing purposes
        Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidCertHandler = new Poco::Net::AcceptCertificateHandler(false);
        Poco::Net::Context::Params sslParams;
        Poco::Net::Context::Ptr sslContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslParams);
        Poco::Net::SSLManager::instance().initializeClient(0, invalidCertHandler, sslContext);
    }

    ~HTTPServerTest()
    {
        Poco::Net::uninitializeSSL();
    }
#endif
};

int HTTPServerTest::_initialLoolKitCount = 0;

void HTTPServerTest::testCountHowManyLoolkits()
{
    _initialLoolKitCount = countLoolKitProcesses(1);
    CPPUNIT_ASSERT(_initialLoolKitCount > 0);
}

void HTTPServerTest::testDiscovery()
{
#if ENABLE_SSL
    Poco::URI uri("https://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPSClientSession session(uri.getHost(), uri.getPort());
#else
    Poco::URI uri("http://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
#endif

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, "/hosting/discovery");
    session.sendRequest(request);

    Poco::Net::HTTPResponse response;
    session.receiveResponse(response);
    CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());
    CPPUNIT_ASSERT_EQUAL(std::string("text/xml"), response.getContentType());
}

void HTTPServerTest::testLoleafletGet()
{
#if ENABLE_SSL
    Poco::URI uri("https://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPSClientSession session(uri.getHost(), uri.getPort());
#else
    Poco::URI uri("http://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
#endif

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, "/loleaflet/dist/loleaflet.html?access_token=111111111");
    Poco::Net::HTMLForm param(request);
    session.sendRequest(request);

    Poco::Net::HTTPResponse response;
    std::istream& rs = session.receiveResponse(response);
    CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());
    CPPUNIT_ASSERT_EQUAL(std::string("text/html"), response.getContentType());

    std::string html;
    Poco::StreamCopier::copyToString(rs, html);

    CPPUNIT_ASSERT(html.find(param["access_token"]) != std::string::npos);
    CPPUNIT_ASSERT(html.find(uri.getHost()) != std::string::npos);
    CPPUNIT_ASSERT(html.find(std::string(LOOLWSD_VERSION)) != std::string::npos);
}

void HTTPServerTest::testLoleafletPost()
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

namespace {

void assertHTTPFilesExist(const Poco::URI& uri, Poco::RegularExpression& expr, const std::string& html, const std::string& mimetype = std::string())
{
    Poco::RegularExpression::MatchVec matches;
    bool found = false;

    for (int offset = 0; expr.match(html, offset, matches) > 0; offset = static_cast<int>(matches[0].offset + matches[0].length))
    {
        found = true;
	CPPUNIT_ASSERT_EQUAL(2, (int)matches.size());
	Poco::URI uriScript(html.substr(matches[1].offset, matches[1].length));
	if (uriScript.getHost().empty())
	{
	    std::string scriptString(uriScript.toString());

	    // ignore the branding bits, it's not an error when they are not
            // present
	    if (scriptString.find("/branding.") != std::string::npos)
		continue;

#if ENABLE_SSL
	    Poco::Net::HTTPSClientSession sessionScript(uri.getHost(), uri.getPort());
#else
	    Poco::Net::HTTPClientSession sessionScript(uri.getHost(), uri.getPort());
#endif

	    Poco::Net::HTTPRequest requestScript(Poco::Net::HTTPRequest::HTTP_GET, scriptString);
	    sessionScript.sendRequest(requestScript);

	    Poco::Net::HTTPResponse responseScript;
	    sessionScript.receiveResponse(responseScript);
	    CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, responseScript.getStatus());

	    if (!mimetype.empty())
		CPPUNIT_ASSERT_EQUAL(mimetype, responseScript.getContentType());
	}
    }

    CPPUNIT_ASSERT_MESSAGE("No match found", found);
}

}

void HTTPServerTest::testScriptsAndLinksGet()
{
#if ENABLE_SSL
    Poco::URI uri("https://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPSClientSession session(uri.getHost(), uri.getPort());
#else
    Poco::URI uri("http://127.0.0.1:" + std::to_string(DEFAULT_CLIENT_PORT_NUMBER));
    Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
#endif

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, "/loleaflet/dist/loleaflet.html");
    session.sendRequest(request);

    Poco::Net::HTTPResponse response;
    std::istream& rs = session.receiveResponse(response);
    CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());

    std::string html;
    Poco::StreamCopier::copyToString(rs, html);

    Poco::RegularExpression script("<script.*?src=\"(.*?)\"");
    assertHTTPFilesExist(uri, script, html, "application/javascript");

    Poco::RegularExpression link("<link.*?href=\"(.*?)\"");
    assertHTTPFilesExist(uri, link, html);
}

void HTTPServerTest::testScriptsAndLinksPost()
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

    std::string html;
    Poco::StreamCopier::copyToString(rs, html);

    Poco::RegularExpression script("<script.*?src=\"(.*?)\"");
    assertHTTPFilesExist(uri, script, html, "application/javascript");

    Poco::RegularExpression link("<link.*?href=\"(.*?)\"");
    assertHTTPFilesExist(uri, link, html);
}

void HTTPServerTest::testNoExtraLoolKitsLeft()
{
    const auto countNow = countLoolKitProcesses(_initialLoolKitCount);

    CPPUNIT_ASSERT_EQUAL(_initialLoolKitCount, countNow);
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPServerTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
