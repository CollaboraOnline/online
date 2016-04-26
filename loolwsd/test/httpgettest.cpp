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

/// Tests the HTTP GET API of loolwsd.
class HTTPGetTest : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HTTPGetTest);

    CPPUNIT_TEST(testDiscovery);
    CPPUNIT_TEST(testLOleaflet);
    CPPUNIT_TEST(testParams);
    CPPUNIT_TEST(testScripts);
    CPPUNIT_TEST(testLinks);

    CPPUNIT_TEST_SUITE_END();

    void testDiscovery();
    void testLOleaflet();
    void testParams();
    void testScripts();
    void testLinks();

#if ENABLE_SSL
public:
    HTTPGetTest()
    {
        Poco::Net::initializeSSL();
        // Just accept the certificate anyway for testing purposes
        Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidCertHandler = new Poco::Net::AcceptCertificateHandler(false);
        Poco::Net::Context::Params sslParams;
        Poco::Net::Context::Ptr sslContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslParams);
        Poco::Net::SSLManager::instance().initializeClient(0, invalidCertHandler, sslContext);
    }

    ~HTTPGetTest()
    {
        Poco::Net::uninitializeSSL();
    }
#endif
};

void HTTPGetTest::testDiscovery()
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

void HTTPGetTest::testLOleaflet()
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
    session.receiveResponse(response);
    CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, response.getStatus());
    CPPUNIT_ASSERT_EQUAL(std::string("text/html"), response.getContentType());
}

void HTTPGetTest::testParams()
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

    std::string html;
    Poco::StreamCopier::copyToString(rs, html);

    CPPUNIT_ASSERT(html.find(param["access_token"]) != std::string::npos);
    CPPUNIT_ASSERT(html.find(uri.getHost()) != std::string::npos);
    CPPUNIT_ASSERT(html.find(std::string(LOOLWSD_VERSION)) != std::string::npos);
}

void HTTPGetTest::testScripts()
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
    Poco::RegularExpression::MatchVec matches;
    int offset = 0;

    while (script.match(html, offset, matches) > 0)
    {
        CPPUNIT_ASSERT_EQUAL(2, (int)matches.size());
        Poco::URI uriScript(html.substr(matches[1].offset, matches[1].length));
        if (uriScript.getHost().empty())
        {
#if ENABLE_SSL
            Poco::Net::HTTPSClientSession sessionScript(uri.getHost(), uri.getPort());
#else
            Poco::Net::HTTPClientSession sessionScript(uri.getHost(), uri.getPort());
#endif
            std::cout << "checking... " << uriScript.toString();
            Poco::Net::HTTPRequest requestScript(Poco::Net::HTTPRequest::HTTP_GET, uriScript.toString());
            sessionScript.sendRequest(requestScript);

            Poco::Net::HTTPResponse responseScript;
            sessionScript.receiveResponse(responseScript);
            CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, responseScript.getStatus());
            CPPUNIT_ASSERT_EQUAL(std::string("application/javascript"), responseScript.getContentType());
            std::cout << " OK" << std::endl;
        }
        else
        {
            std::cout << "skip " << uriScript.toString() << std::endl;
        }
        offset = static_cast<int>(matches[0].offset + matches[0].length);
    }
}

void HTTPGetTest::testLinks()
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

    Poco::RegularExpression link("<link.*?href=\"(.*?)\"");
    Poco::RegularExpression::MatchVec matches;
    int offset = 0;

    while (link.match(html, offset, matches) > 0)
    {
        CPPUNIT_ASSERT_EQUAL(2, (int)matches.size());
        Poco::URI uriLink(html.substr(matches[1].offset, matches[1].length));
        if (uriLink.getHost().empty())
        {
#if ENABLE_SSL
            Poco::Net::HTTPSClientSession sessionLink(uri.getHost(), uri.getPort());
#else
            Poco::Net::HTTPClientSession sessionLink(uri.getHost(), uri.getPort());
#endif
            std::cout << "checking... " << uriLink.toString();
            Poco::Net::HTTPRequest requestLink(Poco::Net::HTTPRequest::HTTP_GET, uriLink.toString());
            sessionLink.sendRequest(requestLink);

            Poco::Net::HTTPResponse responseLink;
            sessionLink.receiveResponse(responseLink);
            CPPUNIT_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK, responseLink.getStatus());
            std::cout << " OK" << std::endl;
        }
        else
        {
            std::cout << "skip " << uriLink.toString() << std::endl;
        }
        offset = static_cast<int>(matches[0].offset + matches[0].length);
    }
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPGetTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
