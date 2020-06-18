/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <memory>
#include <string>

#include <Poco/URI.h>
#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <Util.hpp>
#include <helpers.hpp>

// Include config.h last, so the test server URI is still HTTP, even in SSL builds.
#include <config.h>

class LOOLWebSocket;

namespace
{
void testEachView(const std::string& doc, const std::string& type, const std::string& protocol,
                  const std::string& protocolView, const std::string& testname)
{
    const std::string view = testname + "view %d -> ";
    const std::string error = testname + "view %d, did not receive a %s message as expected";

    try
    {
        // Load a document
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL(doc, documentPath, documentURL, testname);

        int itView = 0;
        std::shared_ptr<LOOLWebSocket> socket = helpers::loadDocAndGetSocket(
            Poco::URI(helpers::getTestServerURI()), documentURL, Poco::format(view, itView));

        // Check document size
        helpers::sendTextFrame(socket, "status", Poco::format(view, itView));
        auto response
            = helpers::assertResponseString(socket, "status:", Poco::format(view, itView));
        int docPart = -1;
        int docParts = 0;
        int docHeight = 0;
        int docWidth = 0;
        int docViewId = -1;
        helpers::parseDocSize(response.substr(7), type, docPart, docParts, docWidth, docHeight,
                              docViewId);

        // Send click message
        std::string text;
        Poco::format(text, "mouse type=%s x=%d y=%d count=1 buttons=1 modifier=0",
                     std::string("buttondown"), docWidth / 2, docHeight / 6);
        helpers::sendTextFrame(socket, text, Poco::format(view, itView));
        text.clear();

        Poco::format(text, "mouse type=%s x=%d y=%d count=1 buttons=1 modifier=0",
                     std::string("buttonup"), docWidth / 2, docHeight / 6);
        helpers::sendTextFrame(socket, text, Poco::format(view, itView));
        // Double of the default.
        size_t timeoutMs = 20000;
        response = helpers::getResponseString(socket, protocol, Poco::format(view, itView), timeoutMs);
        LOK_ASSERT_MESSAGE(Poco::format(error, itView, protocol), !response.empty());

        // Connect and load 0..N Views, where N<=limit
        std::vector<std::shared_ptr<LOOLWebSocket>> views;
        static_assert(MAX_DOCUMENTS >= 2, "MAX_DOCUMENTS must be at least 2");
        const int limit = std::min(4, MAX_DOCUMENTS - 1); // +1 connection above
        for (itView = 0; itView < limit; ++itView)
        {
            views.emplace_back(helpers::loadDocAndGetSocket(
                Poco::URI(helpers::getTestServerURI()), documentURL, Poco::format(view, itView)));
        }

        // main view should receive response each view
        if (protocolView == "invalidateviewcursor:" || protocolView == "viewcursorvisible:"
            || protocolView == "cellviewcursor:" || protocolView == "graphicviewselection:")
        {
            return;
        }
        itView = 0;
        for (const auto& socketView : views)
        {
            response = helpers::getResponseString(socket, protocolView, Poco::format(view, itView), timeoutMs);
            LOK_ASSERT_MESSAGE(Poco::format(error, itView, protocolView), !response.empty());
            ++itView;
            (void)socketView;
        }
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    catch (const std::exception& exc)
    {
        LOK_ASSERT_FAIL(exc.what());
    }
}
}

/// Test suite that asserts a state for each view.
class UnitEachView : public UnitWSD
{
    TestResult testInvalidateViewCursor();
    TestResult testViewCursorVisible();
    TestResult testCellViewCursor();
    TestResult testGraphicViewSelectionWriter();
    TestResult testGraphicViewSelectionCalc();
    TestResult testGraphicViewSelectionImpress();

public:
    UnitEachView();
    void invokeTest() override;
};

UnitBase::TestResult UnitEachView::testInvalidateViewCursor()
{
    testEachView("viewcursor.odp", "presentation",
                 "invalidatecursor:", "invalidateviewcursor:", "invalidateViewCursor ");
    return TestResult::Ok;
}

UnitBase::TestResult UnitEachView::testViewCursorVisible()
{
    testEachView("viewcursor.odp", "presentation",
                 "cursorvisible:", "viewcursorvisible:", "viewCursorVisible ");
    return TestResult::Ok;
}

UnitBase::TestResult UnitEachView::testCellViewCursor()
{
    testEachView("empty.ods", "spreadsheet", "cellcursor:", "cellviewcursor:", "cellViewCursor");
    return TestResult::Ok;
}

UnitBase::TestResult UnitEachView::testGraphicViewSelectionWriter()
{
    testEachView("graphicviewselection.odt", "text",
                 "graphicselection:", "graphicviewselection:", "graphicViewSelection-odt ");
    return TestResult::Ok;
}

UnitBase::TestResult UnitEachView::testGraphicViewSelectionCalc()
{
    testEachView("graphicviewselection.ods", "spreadsheet",
                 "graphicselection:", "graphicviewselection:", "graphicViewSelection-ods ");
    return TestResult::Ok;
}

UnitBase::TestResult UnitEachView::testGraphicViewSelectionImpress()
{
    testEachView("graphicviewselection.odp", "presentation",
                 "graphicselection:", "graphicviewselection:", "graphicViewSelection-odp ");
    return TestResult::Ok;
}

UnitEachView::UnitEachView()
{
    // 8 times larger then the default.
    setTimeout(240 * 1000);
}

void UnitEachView::invokeTest()
{
    UnitBase::TestResult result = testInvalidateViewCursor();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testViewCursorVisible();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testCellViewCursor();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testGraphicViewSelectionWriter();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testGraphicViewSelectionCalc();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testGraphicViewSelectionImpress();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitEachView(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
