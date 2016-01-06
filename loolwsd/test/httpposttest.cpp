/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <Poco/Net/FilePartSource.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>
#include <cppunit/extensions/HelperMacros.h>

#include <Common.hpp>
#include <ChildProcessSession.hpp>

/// Tests the HTTP POST API of loolwsd. The server has to be started manually before running this test.
class HTTPPostTest : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(HTTPPostTest);
    CPPUNIT_TEST(testConvertTo);
    CPPUNIT_TEST_SUITE_END();

    void testConvertTo();
};

void HTTPPostTest::testConvertTo()
{
    Poco::URI uri("http://127.0.0.1:" + std::to_string(ClientPortNumber));
    Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/convert-to");
    Poco::Net::HTMLForm form;
    form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
    form.set("format", "txt");
    form.addPart("data", new Poco::Net::FilePartSource(TDOC "/hello.odt"));
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
    CPPUNIT_ASSERT_EQUAL(expectedStream.str(), actualStream.str());
}

CPPUNIT_TEST_SUITE_REGISTRATION(HTTPPostTest);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
