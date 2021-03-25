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

/// Rendering options testcase.
class UnitRenderingOptions : public UnitWSD
{
public:
    void invokeWSDTest() override;
};

void UnitRenderingOptions::invokeWSDTest()
{
    const char testname[] = "UnitRenderingOptions";

    try
    {
        // Load a document and make it empty, then paste some text into it.
        std::string documentPath;
        std::string documentURL;
        helpers::getDocumentPathAndURL("hide-whitespace.odt", documentPath, documentURL, testname);

        const std::string options
            = "{\"rendering\":{\".uno:HideWhitespace\":{\"type\":\"boolean\",\"value\":\"true\"}}}";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::HTTPResponse response;
        std::shared_ptr<LOOLWebSocket> socket = helpers::connectLOKit(
            Poco::URI(helpers::getTestServerURI()), request, response, testname);

        helpers::sendTextFrame(socket, "load url=" + documentURL + " options=" + options);
        helpers::sendTextFrame(socket, "status");
        const auto status = helpers::assertResponseString(socket, "status:", testname);

        // Expected format is something like 'status: type=text parts=2 current=0 width=12808 height=1142'.

        StringVector tokens(Util::tokenize(status, ' '));
        LOK_ASSERT_EQUAL(static_cast<size_t>(7), tokens.size());

        const std::string token = tokens[5];
        const std::string prefix = "height=";
        LOK_ASSERT_EQUAL(static_cast<size_t>(0), token.find(prefix));
        const int height = std::stoi(token.substr(prefix.size()));
        // HideWhitespace was ignored, this was 32532, should be around 16706.
        LOK_ASSERT(height < 20000);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitRenderingOptions(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
