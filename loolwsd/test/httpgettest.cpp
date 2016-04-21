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

    CPPUNIT_TEST_SUITE_END();

    void testDiscovery();

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
    CPPUNIT_ASSERT_EQUAL(std::string("text/xml"), response.getContentType());
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPGetTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
