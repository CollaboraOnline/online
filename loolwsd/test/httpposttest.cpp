/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/FilePartSource.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/InvalidCertificateHandler.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>
#include <cppunit/extensions/HelperMacros.h>

#include <Common.hpp>
#include <Util.hpp>
#include <ChildProcessSession.hpp>

/// Tests the HTTP POST API of loolwsd. The server has to be started manually before running this test.
class HTTPPostTest : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HTTPPostTest);
    CPPUNIT_TEST(testConvertTo);
    CPPUNIT_TEST_SUITE_END();

    void testConvertTo();

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
};

void HTTPPostTest::testConvertTo()
{
    const auto srcPath = Util::getTempFilePath(TDOC, "hello.odt");

    Poco::URI uri("https://127.0.0.1:" + std::to_string(ClientPortNumber));
    Poco::Net::HTTPSClientSession session(uri.getHost(), uri.getPort());

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

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPPostTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
