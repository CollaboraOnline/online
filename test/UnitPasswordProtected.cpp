/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <memory>
#include <string>

#include <Poco/URI.h>
#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <Util.hpp>
#include <helpers.hpp>

class LOOLWebSocket;

/// Password protected testcase.
class UnitPasswordProtected : public UnitWSD
{
    TestResult testPasswordProtectedDocumentWithoutPassword();
    TestResult testPasswordProtectedDocumentWithWrongPassword();
    TestResult testPasswordProtectedDocumentWithCorrectPassword();
    TestResult testPasswordProtectedDocumentWithCorrectPasswordAgain();
    TestResult testPasswordProtectedOOXMLDocument();
    TestResult testPasswordProtectedBinaryMSOfficeDocument();

public:
    void invokeWSDTest() override;
};

UnitBase::TestResult UnitPasswordProtected::testPasswordProtectedDocumentWithoutPassword()
{
    const char* testname = "testPasswordProtectedDocumentWithoutPassword";
    try
    {
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("password-protected.ods", documentPath, documentURL,
                                       testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::HTTPResponse httpResponse;
        std::shared_ptr<LOOLWebSocket> socket = helpers::connectLOKit(
            Poco::URI(helpers::getTestServerURI()), request, httpResponse, testname);

        // Send a load request without password first
        helpers::sendTextFrame(socket, "load url=" + documentURL);

        const auto response = helpers::getResponseString(socket, "error:", testname);
        StringVector tokens(Util::tokenize(response, ' '));
        LOK_ASSERT_EQUAL(static_cast<size_t>(3), tokens.size());

        std::string errorCommand;
        std::string errorKind;
        LOOLProtocol::getTokenString(tokens[1], "cmd", errorCommand);
        LOOLProtocol::getTokenString(tokens[2], "kind", errorKind);
        LOK_ASSERT_EQUAL(std::string("load"), errorCommand);
        LOK_ASSERT_EQUAL(std::string("passwordrequired:to-view"), errorKind);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }

    return TestResult::Ok;
}

UnitBase::TestResult UnitPasswordProtected::testPasswordProtectedDocumentWithWrongPassword()
{
    const char* testname = "testPasswordProtectedDocumentWithWrongPassword";
    try
    {
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("password-protected.ods", documentPath, documentURL,
                                       testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::HTTPResponse httpResponse;
        std::shared_ptr<LOOLWebSocket> socket = helpers::connectLOKit(
            Poco::URI(helpers::getTestServerURI()), request, httpResponse, testname);

        // Send a load request with incorrect password
        helpers::sendTextFrame(socket, "load url=" + documentURL + " password=2");

        const auto response = helpers::getResponseString(socket, "error:", testname);
        StringVector tokens(Util::tokenize(response, ' '));
        LOK_ASSERT_EQUAL(static_cast<size_t>(3), tokens.size());

        std::string errorCommand;
        std::string errorKind;
        LOOLProtocol::getTokenString(tokens[1], "cmd", errorCommand);
        LOOLProtocol::getTokenString(tokens[2], "kind", errorKind);
        LOK_ASSERT_EQUAL(std::string("load"), errorCommand);
        LOK_ASSERT_EQUAL(std::string("wrongpassword"), errorKind);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }

    return TestResult::Ok;
}

UnitBase::TestResult UnitPasswordProtected::testPasswordProtectedDocumentWithCorrectPassword()
{
    const char* testname = "testPasswordProtectedDocumentWithCorrectPassword";
    try
    {
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("password-protected.ods", documentPath, documentURL,
                                       testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::HTTPResponse response;
        std::shared_ptr<LOOLWebSocket> socket = helpers::connectLOKit(
            Poco::URI(helpers::getTestServerURI()), request, response, testname);

        // Send a load request with correct password
        helpers::sendTextFrame(socket, "load url=" + documentURL + " password=1");

        LOK_ASSERT_MESSAGE("cannot load the document with correct password " + documentURL,
                               helpers::isDocumentLoaded(socket, testname));
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }

    return TestResult::Ok;
}

UnitBase::TestResult UnitPasswordProtected::testPasswordProtectedDocumentWithCorrectPasswordAgain()
{
    return testPasswordProtectedDocumentWithCorrectPassword();
}

UnitBase::TestResult UnitPasswordProtected::testPasswordProtectedOOXMLDocument()
{
    const char* testname = "testPasswordProtectedOOXMLDocument";
    try
    {
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("password-protected.docx", documentPath, documentURL,
                                       testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::HTTPResponse response;
        std::shared_ptr<LOOLWebSocket> socket = helpers::connectLOKit(
            Poco::URI(helpers::getTestServerURI()), request, response, testname);

        // Send a load request with correct password
        helpers::sendTextFrame(socket, "load url=" + documentURL + " password=abc");

        LOK_ASSERT_MESSAGE("cannot load the document with correct password " + documentURL,
                               helpers::isDocumentLoaded(socket, testname));
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }

    return TestResult::Ok;
}

UnitBase::TestResult UnitPasswordProtected::testPasswordProtectedBinaryMSOfficeDocument()
{
    const char* testname = "testPasswordProtectedBinaryMSOfficeDocument";
    try
    {
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("password-protected.doc", documentPath, documentURL,
                                       testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::HTTPResponse response;
        std::shared_ptr<LOOLWebSocket> socket = helpers::connectLOKit(
            Poco::URI(helpers::getTestServerURI()), request, response, testname);

        // Send a load request with correct password
        helpers::sendTextFrame(socket, "load url=" + documentURL + " password=abc");

        LOK_ASSERT_MESSAGE("cannot load the document with correct password " + documentURL,
                               helpers::isDocumentLoaded(socket, testname));
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }

    return TestResult::Ok;
}

void UnitPasswordProtected::invokeWSDTest()
{
    UnitBase::TestResult result = testPasswordProtectedDocumentWithoutPassword();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testPasswordProtectedDocumentWithWrongPassword();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testPasswordProtectedDocumentWithCorrectPassword();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testPasswordProtectedDocumentWithCorrectPasswordAgain();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testPasswordProtectedOOXMLDocument();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testPasswordProtectedBinaryMSOfficeDocument();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitPasswordProtected(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
