/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <memory>
#include <ostream>
#include <set>
#include <string>

#include <Poco/Exception.h>
#include <Poco/RegularExpression.h>
#include <Poco/URI.h>
#include <test/lokassert.hpp>

#include <Png.hpp>
#include <Unit.hpp>
#include <helpers.hpp>

// Include config.h last, so the test server URI is still HTTP, even in SSL builds.
#include <config.h>

class LOOLWebSocket;

namespace
{
std::string getFontList(const std::string& message)
{
    Poco::JSON::Parser parser;
    const Poco::Dynamic::Var result = parser.parse(message);
    const auto& command = result.extract<Poco::JSON::Object::Ptr>();
    std::string text = command->get("commandName").toString();
    LOK_ASSERT_EQUAL(std::string(".uno:CharFontName"), text);
    text = command->get("commandValues").toString();
    return text;
}
}

/// Test suite for closing, etc.
class UnitClose : public UnitWSD
{
    TestResult testCloseAfterClose();
    TestResult testFontList();
    TestResult testGraphicInvalidate();
    TestResult testAlertAllUsers();

public:
    UnitClose();
    void invokeWSDTest() override;
};

UnitBase::TestResult UnitClose::testCloseAfterClose()
{
    const char* testname = "closeAfterClose ";
    try
    {
        TST_LOG("Connecting and loading.");
        Poco::URI uri(helpers::getTestServerURI());
        std::shared_ptr<LOOLWebSocket> socket
            = helpers::loadDocAndGetSocket("hello.odt", uri, testname);

        // send normal socket shutdown
        TST_LOG("Disconnecting.");
        socket->shutdown();

        // 5 seconds timeout
        socket->setReceiveTimeout(5000000);

        // receive close frame handshake
        int bytes;
        int flags;
        char buffer[READ_BUFFER_SIZE];
        do
        {
            bytes = socket->receiveFrame(buffer, sizeof(buffer), flags);
            TST_LOG("Received [" << std::string(buffer, bytes) << "], flags: " << std::hex << flags
                                 << std::dec);
        } while (bytes > 0
                 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK)
                        != Poco::Net::WebSocket::FRAME_OP_CLOSE);

        TST_LOG("Received " << bytes << " bytes, flags: " << std::hex << flags << std::dec);

        try
        {
            // no more messages is received.
            bytes = socket->receiveFrame(buffer, sizeof(buffer), flags);
            TST_LOG("Received " << bytes << " bytes, flags: " << std::hex << flags << std::dec);
            LOK_ASSERT_EQUAL(0, bytes);
            LOK_ASSERT_EQUAL(0, flags);
        }
        catch (const Poco::Exception& exc)
        {
            // This is not unexpected, since WSD will close the socket after
            // echoing back the shutdown status code. However, if it doesn't
            // we assert above that it doesn't send any more data.
            TST_LOG("Error: " << exc.displayText());
        }
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitClose::testFontList()
{
    const char* testname = "fontList ";
    try
    {
        // Load a document
        Poco::URI uri(helpers::getTestServerURI());
        std::shared_ptr<LOOLWebSocket> socket
            = helpers::loadDocAndGetSocket("setclientpart.odp", uri, testname);

        helpers::sendTextFrame(socket, "commandvalues command=.uno:CharFontName", testname);
        const std::vector<char> response
            = helpers::getResponseMessage(socket, "commandvalues:", testname);
        LOK_ASSERT_MESSAGE("did not receive a commandvalues: message as expected",
                               !response.empty());

        std::stringstream streamResponse;
        std::copy(response.begin() + std::string("commandvalues:").length() + 1, response.end(),
                  std::ostream_iterator<char>(streamResponse));
        LOK_ASSERT(!getFontList(streamResponse.str()).empty());
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitClose::testGraphicInvalidate()
{
    const char* testname = "graphicInvalidate ";
    try
    {
        // Load a document.
        Poco::URI uri(helpers::getTestServerURI());
        std::shared_ptr<LOOLWebSocket> socket
            = helpers::loadDocAndGetSocket("shape.ods", uri, testname);

        // Send click message
        helpers::sendTextFrame(
            socket, "mouse type=buttondown x=1035 y=400 count=1 buttons=1 modifier=0", testname);
        helpers::sendTextFrame(
            socket, "mouse type=buttonup x=1035 y=400 count=1 buttons=1 modifier=0", testname);
        helpers::getResponseString(socket, "graphicselection:", testname);

        // Drag & drop graphic
        helpers::sendTextFrame(
            socket, "mouse type=buttondown x=1035 y=400 count=1 buttons=1 modifier=0", testname);
        helpers::sendTextFrame(socket, "mouse type=move x=1035 y=450 count=1 buttons=1 modifier=0",
                               testname);
        helpers::sendTextFrame(
            socket, "mouse type=buttonup x=1035 y=450 count=1 buttons=1 modifier=0", testname);

        const auto message = helpers::getResponseString(socket, "invalidatetiles:", testname);
        LOK_ASSERT_MESSAGE("Drag & Drop graphic invalidate all tiles",
                               message.find("EMPTY") == std::string::npos);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitClose::testAlertAllUsers()
{
    // Load two documents, each in two sessions. Tell one session to fake a disk full
    // situation. Expect to get the corresponding error back in all sessions.
    static_assert(MAX_DOCUMENTS >= 2, "MAX_DOCUMENTS must be at least 2");
    const char* testname = "alertAllUsers ";
    try
    {
        std::shared_ptr<LOOLWebSocket> socket[4];

        Poco::URI uri(helpers::getTestServerURI());
        socket[0] = helpers::loadDocAndGetSocket("hello.odt", uri, testname);
        socket[1] = helpers::loadDocAndGetSocket("Example.odt", uri, testname);

        // Simulate disk full.
        helpers::sendTextFrame(socket[0], "uno .uno:fakeDiskFull", testname);

        // Assert that both clients get the error.
        for (int i = 0; i < 2; i++)
        {
            const std::string response
                = helpers::assertResponseString(socket[i], "error:", testname);
            StringVector tokens(Util::tokenize(response.substr(6), ' '));
            std::string cmd;
            LOOLProtocol::getTokenString(tokens, "cmd", cmd);
            LOK_ASSERT_EQUAL(std::string("internal"), cmd);
            std::string kind;
            LOOLProtocol::getTokenString(tokens, "kind", kind);
            LOK_ASSERT_EQUAL(std::string("diskfull"), kind);
        }
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitClose::UnitClose()
{
    int timeout_minutes = 2;
    setTimeout(timeout_minutes * 60 * 1000);
}

void UnitClose::invokeWSDTest()
{
    UnitBase::TestResult result = testCloseAfterClose();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testFontList();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testGraphicInvalidate();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testAlertAllUsers();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitClose(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
