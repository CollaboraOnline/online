/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

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

class LOOLWebSocket;

namespace
{
void getPartHashCodes(const std::string& testname, const std::string& response,
                      std::vector<std::string>& parts)
{
    std::string line;
    std::istringstream istr(response);
    std::getline(istr, line);

    TST_LOG("Reading parts from [" << response << "].");

    // Expected format is something like 'type= parts= current= width= height= viewid= [hiddenparts=]'.
    StringVector tokens(Util::tokenize(line, ' '));
#if defined CPPUNIT_ASSERT_GREATEREQUAL
    CPPUNIT_ASSERT_GREATEREQUAL(static_cast<size_t>(7), tokens.size());
#else
    LOK_ASSERT_MESSAGE("Expected at least 7 tokens.", static_cast<size_t>(7) <= tokens.size());
#endif

    const std::string type = tokens[0].substr(std::string("type=").size());
    LOK_ASSERT_MESSAGE("Expected presentation or spreadsheet type to read part names/codes.",
                           type == "presentation" || type == "spreadsheet");

    const int totalParts = std::stoi(tokens[1].substr(std::string("parts=").size()));
    TST_LOG("Status reports " << totalParts << " parts.");

    Poco::RegularExpression endLine("[^\n\r]+");
    Poco::RegularExpression number("^[0-9]+$");
    Poco::RegularExpression::MatchVec matches;
    int offset = 0;

    parts.clear();
    while (endLine.match(response, offset, matches) > 0)
    {
        LOK_ASSERT_EQUAL(1, (int)matches.size());
        const std::string str = response.substr(matches[0].offset, matches[0].length);
        if (number.match(str, 0))
        {
            parts.push_back(str);
        }

        offset = static_cast<int>(matches[0].offset + matches[0].length);
    }

    TST_LOG("Found " << parts.size() << " part names/codes.");

    // Validate that Core is internally consistent when emitting status messages.
    LOK_ASSERT_EQUAL(totalParts, (int)parts.size());
}
}

/// Test suite for insertion/deletion.
class UnitInsertDelete : public UnitWSD
{
    TestResult testInsertDelete();
    TestResult testPasteBlank();
    TestResult testGetTextSelection();
    TestResult testCursorPosition();

public:
    void invokeWSDTest() override;
};

UnitBase::TestResult UnitInsertDelete::testInsertDelete()
{
    const char* testname = "insertDelete ";
    try
    {
        std::vector<std::string> parts;
        std::string response;

        // Load a document
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("insert-delete.odp", documentPath, documentURL, testname);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::URI uri(helpers::getTestServerURI());
        Poco::Net::HTTPResponse httpResponse;
        std::shared_ptr<LOOLWebSocket> socket
            = helpers::connectLOKit(uri, request, httpResponse, testname);

        helpers::sendTextFrame(socket, "load url=" + documentURL);
        LOK_ASSERT_MESSAGE("cannot load the document " + documentURL,
                               helpers::isDocumentLoaded(socket, testname));

        // check total slides 1
        TST_LOG("Expecting 1 slide.");
        helpers::sendTextFrame(socket, "status");
        response = helpers::getResponseString(socket, "status:", testname);
        LOK_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
        getPartHashCodes(testname, response.substr(7), parts);
        LOK_ASSERT_EQUAL(1, (int)parts.size());

        const std::string slide1Hash = parts[0];

        // insert 10 slides
        TST_LOG("Inserting 10 slides.");
        for (size_t it = 1; it <= 10; it++)
        {
            helpers::sendTextFrame(socket, "uno .uno:InsertPage");
            response = helpers::getResponseString(socket, "status:", testname);
            LOK_ASSERT_MESSAGE("did not receive a status: message as expected",
                                   !response.empty());
            getPartHashCodes(testname, response.substr(7), parts);
            LOK_ASSERT_EQUAL(it + 1, parts.size());
        }

        LOK_ASSERT_MESSAGE("Hash code of slide #1 changed after inserting extra slides.",
                               parts[0] == slide1Hash);
        const std::vector<std::string> parts_after_insert(parts.begin(), parts.end());

        // delete 10 slides
        TST_LOG("Deleting 10 slides.");
        for (size_t it = 1; it <= 10; it++)
        {
            // Explicitly delete the nth slide.
            helpers::sendTextFrame(socket, "setclientpart part=" + std::to_string(it));
            helpers::sendTextFrame(socket, "uno .uno:DeletePage");
            response = helpers::getResponseString(socket, "status:", testname);
            LOK_ASSERT_MESSAGE("did not receive a status: message as expected",
                                   !response.empty());
            getPartHashCodes(testname, response.substr(7), parts);
            LOK_ASSERT_EQUAL(11 - it, parts.size());
        }

        LOK_ASSERT_MESSAGE("Hash code of slide #1 changed after deleting extra slides.",
                               parts[0] == slide1Hash);

        // undo delete slides
        TST_LOG("Undoing 10 slide deletes.");
        for (size_t it = 1; it <= 10; it++)
        {
            helpers::sendTextFrame(socket, "uno .uno:Undo");
            response = helpers::getResponseString(socket, "status:", testname);
            LOK_ASSERT_MESSAGE("did not receive a status: message as expected",
                                   !response.empty());
            getPartHashCodes(testname, response.substr(7), parts);
            LOK_ASSERT_EQUAL(it + 1, parts.size());
        }

        LOK_ASSERT_MESSAGE("Hash code of slide #1 changed after undoing slide delete.",
                               parts[0] == slide1Hash);
        const std::vector<std::string> parts_after_undo(parts.begin(), parts.end());
        LOK_ASSERT_MESSAGE("Hash codes changed between deleting and undo.",
                               parts_after_insert == parts_after_undo);

        // redo inserted slides
        TST_LOG("Redoing 10 slide deletes.");
        for (size_t it = 1; it <= 10; it++)
        {
            helpers::sendTextFrame(socket, "uno .uno:Redo");
            response = helpers::getResponseString(socket, "status:", testname);
            LOK_ASSERT_MESSAGE("did not receive a status: message as expected",
                                   !response.empty());
            getPartHashCodes(testname, response.substr(7), parts);
            LOK_ASSERT_EQUAL(11 - it, parts.size());
        }

        LOK_ASSERT_MESSAGE("Hash code of slide #1 changed after redoing slide delete.",
                               parts[0] == slide1Hash);

        // check total slides 1
        TST_LOG("Expecting 1 slide.");
        helpers::sendTextFrame(socket, "status");
        response = helpers::getResponseString(socket, "status:", testname);
        LOK_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
        getPartHashCodes(testname, response.substr(7), parts);
        LOK_ASSERT_EQUAL(1, (int)parts.size());
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitInsertDelete::testPasteBlank()
{
    const char* testname = "pasteBlank ";
    try
    {
        // Load a document and make it empty, then paste nothing into it.
        Poco::URI uri(helpers::getTestServerURI());
        std::shared_ptr<LOOLWebSocket> socket
            = helpers::loadDocAndGetSocket("hello.odt", uri, testname);

        helpers::deleteAll(socket, testname);

        // Paste nothing into it.
        helpers::sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\n", testname);

        // Check if the document contains the pasted text.
        const std::string selection = helpers::getAllText(socket, testname);
        LOK_ASSERT_EQUAL(std::string("textselectioncontent: "), selection);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitInsertDelete::testGetTextSelection()
{
    const char* testname = "getTextSelection ";
    try
    {
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

        Poco::URI uri(helpers::getTestServerURI());
        std::shared_ptr<LOOLWebSocket> socket
            = helpers::loadDocAndGetSocket(uri, documentURL, testname);
        std::shared_ptr<LOOLWebSocket> socket2
            = helpers::loadDocAndGetSocket(uri, documentURL, testname);

        static const std::string expected = "Hello world";
        const std::string selection = helpers::getAllText(socket, testname, expected);
        LOK_ASSERT_EQUAL("textselectioncontent: " + expected, selection);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitInsertDelete::testCursorPosition()
{
    try
    {
        const char* testname = "cursorPosition ";

        // Load a document.
        std::string docPath;
        std::string docURL;
        std::string response;

        helpers::getDocumentPathAndURL("Example.odt", docPath, docURL, testname);
        Poco::URI uri(helpers::getTestServerURI());
        std::shared_ptr<LOOLWebSocket> socket0
            = helpers::loadDocAndGetSocket(uri, docURL, testname);

        // receive cursor position
        response = helpers::getResponseString(socket0, "invalidatecursor:", testname);

        Poco::JSON::Parser parser0;
        const Poco::Dynamic::Var result0 = parser0.parse(response.substr(17));
        const auto& command0 = result0.extract<Poco::JSON::Object::Ptr>();
        LOK_ASSERT_MESSAGE("missing property rectangle", command0->has("rectangle"));

        StringVector cursorTokens(
            Util::tokenize(command0->get("rectangle").toString(), ','));
        LOK_ASSERT_EQUAL(static_cast<size_t>(4), cursorTokens.size());

        // Create second view
        std::shared_ptr<LOOLWebSocket> socket1
            = helpers::loadDocAndGetSocket(uri, docURL, testname);

        //receive view cursor position
        response = helpers::getResponseString(socket1, "invalidateviewcursor:", testname);

        Poco::JSON::Parser parser;
        const Poco::Dynamic::Var result = parser.parse(response.substr(21));
        const auto& command = result.extract<Poco::JSON::Object::Ptr>();
        LOK_ASSERT_MESSAGE("missing property rectangle", command->has("rectangle"));

        StringVector viewTokens(
            Util::tokenize(command->get("rectangle").toString(), ','));
        LOK_ASSERT_EQUAL(static_cast<size_t>(4), viewTokens.size());

        // check both cursor should be equal
        LOK_ASSERT_EQUAL(cursorTokens[0], viewTokens[0]);
        LOK_ASSERT_EQUAL(cursorTokens[1], viewTokens[1]);
        LOK_ASSERT_EQUAL(cursorTokens[2], viewTokens[2]);
        LOK_ASSERT_EQUAL(cursorTokens[3], viewTokens[3]);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

void UnitInsertDelete::invokeWSDTest()
{
    UnitBase::TestResult result = testInsertDelete();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testPasteBlank();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testGetTextSelection();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testCursorPosition();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitInsertDelete(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
