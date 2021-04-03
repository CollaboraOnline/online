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

#include <Unit.hpp>
#include <helpers.hpp>

class LOOLWebSocket;

namespace
{
void getCursor(const std::string& message, int& cursorX, int& cursorY, int& cursorWidth,
               int& cursorHeight)
{
    Poco::JSON::Parser parser;
    const Poco::Dynamic::Var result = parser.parse(message);
    const auto& command = result.extract<Poco::JSON::Object::Ptr>();
    std::string text = command->get("commandName").toString();
    LOK_ASSERT_EQUAL(std::string(".uno:CellCursor"), text);
    text = command->get("commandValues").toString();
    LOK_ASSERT(!text.empty());
    StringVector position(Util::tokenize(text, ','));
    cursorX = std::stoi(position[0]);
    cursorY = std::stoi(position[1]);
    cursorWidth = std::stoi(position[2]);
    cursorHeight = std::stoi(position[3]);
    LOK_ASSERT(cursorX >= 0);
    LOK_ASSERT(cursorY >= 0);
    LOK_ASSERT(cursorWidth >= 0);
    LOK_ASSERT(cursorHeight >= 0);
}

void limitCursor(const std::function<void(const std::shared_ptr<LOOLWebSocket>& socket, int cursorX,
                                          int cursorY, int cursorWidth, int cursorHeight,
                                          int docWidth, int docHeight)>& keyhandler,
                 const std::function<void(int docWidth, int docHeight, int newWidth,
                                          int newHeight)>& checkhandler,
                 const std::string& testname)
{
    int docSheet = -1;
    int docSheets = 0;
    int docHeight = 0;
    int docWidth = 0;
    int docViewId = -1;
    int newSheet = -1;
    int newSheets = 0;
    int newHeight = 0;
    int newWidth = 0;
    int cursorX = 0;
    int cursorY = 0;
    int cursorWidth = 0;
    int cursorHeight = 0;

    std::string response;

    Poco::URI uri(helpers::getTestServerURI());
    std::shared_ptr<LOOLWebSocket> socket
        = helpers::loadDocAndGetSocket("empty.ods", uri, testname);

    // check document size
    helpers::sendTextFrame(socket, "status", testname);
    response = helpers::assertResponseString(socket, "status:", testname);
    helpers::parseDocSize(response.substr(7), "spreadsheet", docSheet, docSheets, docWidth,
                          docHeight, docViewId);

    // Send an arrow key to initialize the CellCursor, otherwise we get "EMPTY".
    helpers::sendTextFrame(socket, "key type=input char=0 key=1027", testname);

    std::string text;
    Poco::format(text,
                 "commandvalues "
                 "command=.uno:CellCursor?outputHeight=%d&outputWidth=%d&tileHeight=%d&tileWidth=%"
                 "d",
                 256, 256, 3840, 3840);
    helpers::sendTextFrame(socket, text, testname);
    const auto cursor = helpers::getResponseString(socket, "commandvalues:", testname);
    getCursor(cursor.substr(14), cursorX, cursorY, cursorWidth, cursorHeight);

    // move cursor
    keyhandler(socket, cursorX, cursorY, cursorWidth, cursorHeight, docWidth, docHeight);

    // filter messages, and expect to receive new document size
    response = helpers::assertResponseString(socket, "status:", testname);
    helpers::parseDocSize(response.substr(7), "spreadsheet", newSheet, newSheets, newWidth,
                          newHeight, docViewId);

    LOK_ASSERT_EQUAL(docSheets, newSheets);
    LOK_ASSERT_EQUAL(docSheet, newSheet);

    // check new document size
    checkhandler(docWidth, docHeight, newWidth, newHeight);
}
}

/// Test suite for cursor handling.
class UnitCursor : public UnitWSD
{
    TestResult testMaxColumn();
    TestResult testMaxRow();
    TestResult testInsertAnnotationWriter();
    TestResult testEditAnnotationWriter();
    TestResult testInsertAnnotationCalc();

public:
    void invokeWSDTest() override;
};

UnitBase::TestResult UnitCursor::testMaxColumn()
{
    try
    {
        limitCursor(
            // move cursor to last column
            [](const std::shared_ptr<LOOLWebSocket>& socket, int cursorX, int cursorY,
               int cursorWidth, int cursorHeight, int docWidth, int docHeight) {
                LOK_ASSERT(cursorX >= 0);
                LOK_ASSERT(cursorY >= 0);
                LOK_ASSERT(cursorWidth >= 0);
                LOK_ASSERT(cursorHeight >= 0);
                LOK_ASSERT(docWidth >= 0);
                LOK_ASSERT(docHeight >= 0);

                const std::string text = "key type=input char=0 key=1027";
                while (cursorX <= docWidth)
                {
                    helpers::sendTextFrame(socket, text);
                    cursorX += cursorWidth;
                }
            },
            // check new document width
            [](int docWidth, int docHeight, int newWidth, int newHeight) {
                LOK_ASSERT_EQUAL(docHeight, newHeight);
                LOK_ASSERT(newWidth > docWidth);
            },
            "maxColumn");
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitCursor::testMaxRow()
{
    try
    {
        limitCursor(
            // move cursor to last row
            [](const std::shared_ptr<LOOLWebSocket>& socket, int cursorX, int cursorY,
               int cursorWidth, int cursorHeight, int docWidth, int docHeight) {
                LOK_ASSERT(cursorX >= 0);
                LOK_ASSERT(cursorY >= 0);
                LOK_ASSERT(cursorWidth >= 0);
                LOK_ASSERT(cursorHeight >= 0);
                LOK_ASSERT(docWidth >= 0);
                LOK_ASSERT(docHeight >= 0);

                const std::string text = "key type=input char=0 key=1024";
                while (cursorY <= docHeight)
                {
                    helpers::sendTextFrame(socket, text);
                    cursorY += cursorHeight;
                }
            },
            // check new document height
            [](int docWidth, int docHeight, int newWidth, int newHeight) {
                LOK_ASSERT_EQUAL(docWidth, newWidth);
                LOK_ASSERT(newHeight > docHeight);
            },
            "maxRow");
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitCursor::testInsertAnnotationWriter()
{
    const char* testname = "insertAnnotationWriter ";

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    Poco::URI uri(helpers::getTestServerURI());
    std::shared_ptr<LOOLWebSocket> socket
        = helpers::loadDocAndGetSocket(uri, documentURL, testname);

    // Insert comment.
    helpers::sendTextFrame(socket, "uno .uno:InsertAnnotation", testname);
    helpers::assertResponseString(socket, "invalidatetiles:", testname);

    // Paste some text.
    helpers::sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\nxxx yyy zzzz",
                           testname);

    // Read it back.
    std::string res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(std::string("textselectioncontent: xxx yyy zzzz"), res);
    // Can we edit the comment?
    helpers::sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc",
                           testname);
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(std::string("textselectioncontent: aaa bbb ccc"), res);

    // Confirm that the text is in the comment and not doc body.
    // Click in the body.
    helpers::sendTextFrame(
        socket, "mouse type=buttondown x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    helpers::sendTextFrame(socket, "mouse type=buttonup x=1600 y=1600 count=1 buttons=1 modifier=0",
                           testname);
    // Read body text.
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(std::string("textselectioncontent: Hello world"), res);

    // Confirm that the comment is still intact.
    helpers::sendTextFrame(
        socket, "mouse type=buttondown x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    helpers::sendTextFrame(
        socket, "mouse type=buttonup x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(std::string("textselectioncontent: aaa bbb ccc"), res);

    // Can we still edit the comment?
    helpers::sendTextFrame(
        socket,
        "paste mimetype=text/plain;charset=utf-8\nand now for something completely different",
        testname);
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(
        std::string("textselectioncontent: and now for something completely different"), res);

    // Close and reopen the same document and test again.
    socket->shutdown();

    // Make sure the document is fully unloaded.
    // testNoExtraLoolKitsLeft();

    TST_LOG("Reloading ");
    socket = helpers::loadDocAndGetSocket(uri, documentURL, testname);

    // Confirm that the text is in the comment and not doc body.
    // Click in the body.
    helpers::sendTextFrame(
        socket, "mouse type=buttondown x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    helpers::sendTextFrame(socket, "mouse type=buttonup x=1600 y=1600 count=1 buttons=1 modifier=0",
                           testname);
    // Read body text.
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(std::string("textselectioncontent: Hello world"), res);

    // Confirm that the comment is still intact.
    helpers::sendTextFrame(
        socket, "mouse type=buttondown x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    helpers::sendTextFrame(
        socket, "mouse type=buttonup x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(
        std::string("textselectioncontent: and now for something completely different"), res);

    // Can we still edit the comment?
    helpers::sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\nblah blah xyz",
                           testname);
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(std::string("textselectioncontent: blah blah xyz"), res);
    return TestResult::Ok;
}

UnitBase::TestResult UnitCursor::testEditAnnotationWriter()
{
    const char* testname = "editAnnotationWriter ";

    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("with_comment.odt", documentPath, documentURL, testname);

    Poco::URI uri(helpers::getTestServerURI());
    std::shared_ptr<LOOLWebSocket> socket
        = helpers::loadDocAndGetSocket(uri, documentURL, testname);

    // Click in the body.
    helpers::sendTextFrame(
        socket, "mouse type=buttondown x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    helpers::sendTextFrame(socket, "mouse type=buttonup x=1600 y=1600 count=1 buttons=1 modifier=0",
                           testname);
    // Read body text.
    std::string res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(std::string("textselectioncontent: Hello world"), res);

    // Confirm that the comment is intact.
    helpers::sendTextFrame(
        socket, "mouse type=buttondown x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    helpers::sendTextFrame(
        socket, "mouse type=buttonup x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(std::string("textselectioncontent: blah blah xyz"), res);

    // Can we still edit the comment?
    helpers::sendTextFrame(
        socket,
        "paste mimetype=text/plain;charset=utf-8\nand now for something completely different",
        testname);
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(
        std::string("textselectioncontent: and now for something completely different"), res);

    // const int kitcount = getLoolKitProcessCount();

    // Close and reopen the same document and test again.
    TST_LOG("Closing connection after pasting.");
    socket->shutdown();

    TST_LOG("Reloading ");
    socket = helpers::loadDocAndGetSocket(uri, documentURL, testname);

    // Should have no new instances.
    // CPPUNIT_ASSERT_EQUAL(kitcount, countLoolKitProcesses(kitcount));

    // Confirm that the text is in the comment and not doc body.
    // Click in the body.
    helpers::sendTextFrame(
        socket, "mouse type=buttondown x=1600 y=1600 count=1 buttons=1 modifier=0", testname);
    helpers::sendTextFrame(socket, "mouse type=buttonup x=1600 y=1600 count=1 buttons=1 modifier=0",
                           testname);
    // Read body text.
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(std::string("textselectioncontent: Hello world"), res);

    // Confirm that the comment is still intact.
    helpers::sendTextFrame(
        socket, "mouse type=buttondown x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    helpers::sendTextFrame(
        socket, "mouse type=buttonup x=13855 y=1893 count=1 buttons=1 modifier=0", testname);
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(
        std::string("textselectioncontent: and now for something completely different"), res);

    // Can we still edit the comment?
    helpers::sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\nnew text different",
                           testname);
    res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(std::string("textselectioncontent: new text different"), res);
    return TestResult::Ok;
}

UnitBase::TestResult UnitCursor::testInsertAnnotationCalc()
{
    const char* testname = "insertAnnotationCalc ";
    Poco::URI uri(helpers::getTestServerURI());
    std::shared_ptr<LOOLWebSocket> socket
        = helpers::loadDocAndGetSocket("setclientpart.ods", uri, testname);

    // Insert comment.
    helpers::sendTextFrame(socket, "uno .uno:InsertAnnotation", testname);

    // Paste some text.
    helpers::sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\naaa bbb ccc",
                           testname);

    // Read it back.
    std::string res = helpers::getAllText(socket, testname);
    LOK_ASSERT_EQUAL(std::string("textselectioncontent: aaa bbb ccc"), res);
    return TestResult::Ok;
}

void UnitCursor::invokeWSDTest()
{
    UnitBase::TestResult result = testMaxColumn();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testMaxRow();
    if (result != TestResult::Ok)
        exitTest(result);

    // result = testInsertAnnotationWriter();
    // if (result != TestResult::Ok)
    //     exitTest(result);

    // result = testEditAnnotationWriter();
    // if (result != TestResult::Ok)
    //     exitTest(result);

    // FIXME result = testInsertAnnotationCalc();
    // if (result != TestResult::Ok)
    //     exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitCursor(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
