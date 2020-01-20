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

class LOOLWebSocket;

/// Large paste testcase.
class UnitLargePaste : public UnitWSD
{
public:
    UnitLargePaste();

    void invokeTest() override;
};

UnitLargePaste::UnitLargePaste() {}

void UnitLargePaste::invokeTest()
{
    const char testname[] = "UnitLargePaste";

    // Load a document and make it empty, then paste some text into it.
    std::string documentPath;
    std::string documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket = helpers::loadDocAndGetSocket(
        Poco::URI(helpers::getTestServerURI()), documentURL, testname);

    helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
    helpers::sendTextFrame(socket, "uno .uno:Delete", testname);

    // Paste some text into it.
    std::ostringstream oss;
    for (int i = 0; i < 1000; ++i)
    {
        oss << Util::encodeId(Util::rng::getNext(), 6);
    }

    const std::string documentContents = oss.str();
    TST_LOG("Pasting " << documentContents.size() << " characters into document.");
    helpers::sendTextFrame(socket, "paste mimetype=text/html\n" + documentContents, testname);

    // Check if the server is still alive.
    // This resulted first in a hang, as response for the message never arrived, then a bit later in a Poco::TimeoutException.
    helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
    helpers::sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
    const auto selection = helpers::assertResponseString(socket, "textselectioncontent:", testname);
    LOK_ASSERT_EQUAL_MESSAGE("Pasted text was either corrupted or couldn't be read back",
                             "textselectioncontent: " + documentContents, selection);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitLargePaste(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
