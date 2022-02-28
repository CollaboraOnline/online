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

class COOLWebSocket;

class UnitRenderSearchResult : public UnitWSD
{
public:
    void invokeWSDTest() override;
};

void UnitRenderSearchResult::invokeWSDTest()
{
    const char testname[] = "UnitRenderSearchResult";

    try
    {
        std::string documentPath;
        std::string documentURL;
        helpers::getDocumentPathAndURL("RenderSearchResultTest.odt", documentPath, documentURL, testname);

        std::shared_ptr<COOLWebSocket> socket = helpers::loadDocAndGetSocket(Poco::URI(helpers::getTestServerURI()), documentURL, testname);

        helpers::sendTextFrame(socket, "rendersearchresult <indexing><paragraph node_type=\"writer\" index=\"19\"/></indexing>");
        std::vector<char> responseMessage = helpers::getResponseMessage(socket, "rendersearchresult:", testname);

       // LOK_ASSERT(responseMessage.size() >= 100);
       // LOK_ASSERT_EQUAL(responseMessage[1], 'P');
       // LOK_ASSERT_EQUAL(responseMessage[2], 'N');
       // LOK_ASSERT_EQUAL(responseMessage[3], 'G');
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitRenderSearchResult(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
