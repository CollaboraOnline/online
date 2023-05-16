/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <memory>
#include <string>

#include <Poco/DOM/DOMParser.h>
#include <Poco/DOM/Document.h>
#include <Poco/DOM/Node.h>
#include <Poco/DOM/NodeFilter.h>
#include <Poco/DOM/NodeIterator.h>
#include <Poco/SAX/InputSource.h>
#include <Poco/URI.h>
#include <test/lokassert.hpp>

#include <Unit.hpp>
#include <UserMessages.hpp>
#include <Util.hpp>
#include <helpers.hpp>

namespace
{
int findInDOM(Poco::XML::Document* doc, const char* string, bool checkName,
              unsigned long nodeFilter = Poco::XML::NodeFilter::SHOW_ALL)
{
    int count = 0;
    Poco::XML::NodeIterator itCode(doc, nodeFilter);
    while (Poco::XML::Node* pNode = itCode.nextNode())
    {
        if (checkName)
        {
            if (pNode->nodeName() == string)
                count++;
        }
        else
        {
            if (pNode->getNodeValue().find(string) != std::string::npos)
                count++;
        }
    }
    return count;
}
}

/// Test suite that uses a HTTP session (and not just a socket) directly.
class UnitSession : public UnitWSD
{
    TestResult testBadRequest();
    TestResult testHandshake();
    TestResult testSlideShow();

public:
    UnitSession()
        : UnitWSD("UnitSession")
    {
    }

    void invokeWSDTest() override;
};

UnitBase::TestResult UnitSession::testBadRequest()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);
    try
    {
        // Try to load a bogus url.
        const std::string documentURL = "/lol/file%3A%2F%2F%2Ffake.doc";

        Poco::Net::HTTPResponse response;
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        std::unique_ptr<Poco::Net::HTTPClientSession> session(
            helpers::createSession(Poco::URI(helpers::getTestServerURI())));

        request.set("Connection", "Upgrade");
        request.set("Upgrade", "websocket");
        request.set("Sec-WebSocket-Version", "13");
        request.set("Sec-WebSocket-Key", "");
        request.setChunkedTransferEncoding(false);
        session->setKeepAlive(true);
        session->sendRequest(request);
        session->receiveResponse(response);
        LOK_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTPResponse::HTTP_BAD_REQUEST,
                             response.getStatus());
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

UnitBase::TestResult UnitSession::testHandshake()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);

    std::shared_ptr<SocketPoll> socketPoll = std::make_shared<SocketPoll>(testname);
    std::string documentPath, documentURL;
    helpers::getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    socketPoll->startThread();

    // NOTE: Do not replace with wrappers. This has to be explicit.
    auto wsSession = http::WebSocketSession::create(helpers::getTestServerURI());
    http::Request req(documentURL);
    wsSession->asyncRequest(req, socketPoll);

    wsSession->sendMessage("load url=" + documentURL);

    auto assertMessage = [&wsSession, this](const std::string expectedStr)
    {
        wsSession->poll(
            [&](const std::vector<char>& message)
            {
                const std::string msg = Util::toString(message);
                if (!Util::startsWith(msg, "error:"))
                {
                    LOK_ASSERT_EQUAL(expectedStr, msg);
                }
                else
                {
                    // check error message
                    LOK_ASSERT_EQUAL(std::string(SERVICE_UNAVAILABLE_INTERNAL_ERROR), msg);

                    // close frame message
                    //TODO: check that the socket is closed.
                }

                return true;
            },
            std::chrono::seconds(10), testname);
    };

    assertMessage("statusindicator: find");
    assertMessage("statusindicator: connect");
    assertMessage("statusindicator: ready");

    socketPoll->joinThread();
    return TestResult::Ok;
}

UnitBase::TestResult UnitSession::testSlideShow()
{
    setTestname(__func__);
    TST_LOG("Starting Test: " << testname);
    try
    {
        // Load a document
        std::string documentPath, documentURL;
        std::string response;
        helpers::getDocumentPathAndURL("setclientpart.odp", documentPath, documentURL, testname);

        std::shared_ptr<SocketPoll> socketPoll = std::make_shared<SocketPoll>(testname);
        socketPoll->startThread();

        std::shared_ptr<http::WebSocketSession> socket = helpers::loadDocAndGetSession(
            socketPoll, Poco::URI(helpers::getTestServerURI()), documentURL, testname);

        // request slide show
        helpers::sendTextFrame(
            socket, "downloadas name=slideshow.svg id=slideshow format=svg options=", testname);
        response = helpers::getResponseString(socket, "downloadas:", testname);
        LOK_ASSERT_MESSAGE("did not receive a downloadas: message as expected",
                               !response.empty());

        StringVector tokens(StringVector::tokenize(response.substr(11), ' '));
        // "downloadas: downloadId= port= id=slideshow"
        const std::string downloadId = tokens[0].substr(std::string("downloadId=").size());
        const int port = std::stoi(tokens[1].substr(std::string("port=").size()));
        const std::string id = tokens[2].substr(std::string("id=").size());
        LOK_ASSERT(!downloadId.empty());
        LOK_ASSERT_EQUAL(static_cast<int>(Poco::URI(helpers::getTestServerURI()).getPort()),
                             port);
        LOK_ASSERT_EQUAL(std::string("slideshow"), id);

        std::string encodedDoc;
        Poco::URI::encode(documentPath, ":/?", encodedDoc);
        const std::string ignoredSuffix = "%3FWOPISRC=madness"; // cf. iPhone.
        const std::string path = "/cool/" + encodedDoc + "/download/" + downloadId + '/' + ignoredSuffix;
        std::unique_ptr<Poco::Net::HTTPClientSession> session(
            helpers::createSession(Poco::URI(helpers::getTestServerURI())));
        Poco::Net::HTTPRequest requestSVG(Poco::Net::HTTPRequest::HTTP_GET, path);
        TST_LOG("Requesting SVG from " << path);
        session->sendRequest(requestSVG);

        Poco::Net::HTTPResponse responseSVG;
        std::istream& rs = session->receiveResponse(responseSVG);
        LOK_ASSERT_EQUAL(Poco::Net::HTTPResponse::HTTP_OK /* 200 */, responseSVG.getStatus());
        LOK_ASSERT_EQUAL(std::string("image/svg+xml"), responseSVG.getContentType());
        TST_LOG("SVG file size: " << responseSVG.getContentLength());

        //        std::ofstream ofs("/tmp/slide.svg");
        //        Poco::StreamCopier::copyStream(rs, ofs);
        //        ofs.close();

        // Asserting on the size of the stream is really unhelpful;
        // lets checkout the contents instead ...
        Poco::XML::DOMParser parser;
        Poco::XML::InputSource svgSrc(rs);
        Poco::AutoPtr<Poco::XML::Document> doc = parser.parse(&svgSrc);

        // Do we have our automation / scripting
        LOK_ASSERT(
            findInDOM(doc, "jessyinkstart", false, Poco::XML::NodeFilter::SHOW_CDATA_SECTION));
        LOK_ASSERT(
            findInDOM(doc, "jessyinkend", false, Poco::XML::NodeFilter::SHOW_CDATA_SECTION));
        LOK_ASSERT(
            findInDOM(doc, "libreofficestart", false, Poco::XML::NodeFilter::SHOW_CDATA_SECTION));
        LOK_ASSERT(
            findInDOM(doc, "libreofficeend", false, Poco::XML::NodeFilter::SHOW_CDATA_SECTION));

        // Do we have plausible content ?
        int countText = findInDOM(doc, "text", true, Poco::XML::NodeFilter::SHOW_ELEMENT);
        LOK_ASSERT_EQUAL(countText, 93);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }
    return TestResult::Ok;
}

void UnitSession::invokeWSDTest()
{
    UnitBase::TestResult result = testBadRequest();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testHandshake();
    if (result != TestResult::Ok)
        exitTest(result);

    result = testSlideShow();
    if (result != TestResult::Ok)
        exitTest(result);

    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitSession(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
