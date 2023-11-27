/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Test various copy/paste pieces ...

#include <config.h>

#include "HttpRequest.hpp"
#include "lokassert.hpp"

#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <sstream>
#include <wsd/COOLWSD.hpp>
#include <common/Clipboard.hpp>
#include <wsd/ClientSession.hpp>
#include <net/WebSocketSession.hpp>

#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/StringPartSource.h>
#include <Poco/Util/LayeredConfiguration.h>

#include <test.hpp>

using namespace Poco::Net;

// Inside the WSD process
class UnitCopyPaste : public UnitWSD
{
    STATE_ENUM(Phase, RunTest, WaitDocClose, PostCloseTest, Done) _phase;

    std::string _clipURI;
    std::string _clipURI2;

public:
    UnitCopyPaste()
        : UnitWSD("UnitCopyPaste")
        , _phase(Phase::RunTest)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);
        // force HTTPS - to test harder
        config.setBool("ssl.enable", true);
    }

    std::string getRawClipboard(const std::string &clipURIstr)
    {
        auto httpSession = http::Session::create(clipURIstr);
        std::shared_ptr<const http::Response> httpResponse =
            httpSession->syncRequest(http::Request(Poco::URI(clipURIstr).getPathAndQuery()));
        return httpResponse->getBody();
    }

    std::shared_ptr<ClipboardData> getClipboard(const std::string& clipURIstr,
                                                http::StatusCode expected)
    {
        LOG_TST("getClipboard: connect to " << clipURIstr);
        Poco::URI clipURI(clipURIstr);

        auto httpSession = http::Session::create(clipURIstr);
        std::shared_ptr<const http::Response> httpResponse =
            httpSession->syncRequest(http::Request(Poco::URI(clipURIstr).getPathAndQuery()));

        LOG_TST("getClipboard: sent request: " << clipURI.getPathAndQuery());

        try {
            LOG_TST("getClipboard: HTTP get request returned: "
                    << httpResponse->statusLine().statusCode());

            if (httpResponse->statusLine().statusCode() != expected)
            {
                LOK_ASSERT_EQUAL_MESSAGE("clipboard status mismatches", expected,
                                         httpResponse->statusLine().statusCode());
                exitTest(TestResult::Failed);
                return std::shared_ptr<ClipboardData>();
            }

            LOK_ASSERT_EQUAL_MESSAGE("getClipboard: clipboard content-type mismatches expected",
                                     std::string("application/octet-stream"),
                                     httpResponse->header().getContentType());

            std::istringstream responseStream(httpResponse->getBody());
            auto clipboard = std::make_shared<ClipboardData>();
            clipboard->read(responseStream);
            std::ostringstream oss;
            clipboard->dumpState(oss);

            LOG_TST("getClipboard: got response. State:\n" << oss.str());
            return clipboard;
        } catch (Poco::Exception &e) {
            LOG_TST("Poco exception: " << e.message());
            exitTest(TestResult::Failed);
            return std::shared_ptr<ClipboardData>();
        }
    }

    bool assertClipboard(const std::shared_ptr<ClipboardData> &clipboard,
                         const std::string &mimeType, const std::string &content)
    {
        std::string value;

        // allow empty clipboards
        if (clipboard && mimeType.empty() && content.empty())
            return true;

        if (!clipboard || !clipboard->findType(mimeType, value))
        {
            LOG_TST("Error: missing clipboard or missing clipboard mime type '" << mimeType
                                                                                << '\'');
            LOK_ASSERT_FAIL("Missing clipboard mime type");
            exitTest(TestResult::Failed);
            return false;
        }
        else if (value != content)
        {
            LOG_TST("Error: clipboard content mismatch "
                    << value.length() << " bytes vs. " << content.length() << " bytes. Clipboard:\n"
                    << Util::dumpHex(value) << "Expected:\n"
                    << Util::dumpHex(content));
            LOK_ASSERT_EQUAL_MESSAGE("Clipboard content mismatch", content, value);
            exitTest(TestResult::Failed);
            return false;
        }

        return true;
    }

    bool fetchClipboardAssert(const std::string& clipURI, const std::string& mimeType,
                              const std::string& content,
                              http::StatusCode expected = http::StatusCode::OK)
    {
        try
        {
            std::shared_ptr<ClipboardData> clipboard = getClipboard(clipURI, expected);
            return assertClipboard(clipboard, mimeType, content);
        }
        catch (const ParseError& err)
        {
            LOG_TST("Error fetching clipboard: parse error: " << err.toString());
            exitTest(TestResult::Failed);
            return false;
        }
        catch (const std::exception& ex)
        {
            LOG_TST("Error fetching clipboard: " << ex.what());
            exitTest(TestResult::Failed);
            return false;
        }
        catch (...)
        {
            LOG_TST("Error fetching clipboard: unknown exception during read / parse");
            exitTest(TestResult::Failed);
            return false;
        }

        return true;
    }

    bool setClipboard(const std::string &clipURIstr, const std::string &rawData,
                      HTTPResponse::HTTPStatus expected)
    {
        LOG_TST("connect to " << clipURIstr);
        Poco::URI clipURI(clipURIstr);

        std::unique_ptr<HTTPClientSession> session(helpers::createSession(clipURI));
        HTTPRequest request(HTTPRequest::HTTP_POST, clipURI.getPathAndQuery());
        HTMLForm form;
        form.setEncoding(HTMLForm::ENCODING_MULTIPART);
        form.set("format", "txt");
        form.addPart("data", new StringPartSource(rawData, "application/octet-stream", "clipboard"));
        form.prepareSubmit(request);
        form.write(session->sendRequest(request));

        HTTPResponse response;
        std::stringstream actualStream;
        try {
            session->receiveResponse(response);
        } catch (NoMessageException &) {
            LOG_TST("Error: No response from setting clipboard.");
            exitTest(TestResult::Failed);
            return false;
        }

        if (response.getStatus() != expected)
        {
            LOG_TST("Error: response for clipboard " << response.getStatus() << " != expected "
                                                     << expected);
            exitTest(TestResult::Failed);
            return false;
        }

        return true;
    }

    std::string getSessionClipboardURI(size_t session)
    {
            std::shared_ptr<DocumentBroker> broker;
            std::shared_ptr<ClientSession> clientSession;

            std::vector<std::shared_ptr<DocumentBroker>> brokers = COOLWSD::getBrokersTestOnly();
            assert(brokers.size() > 0);
            broker = brokers[0];
            auto sessions = broker->getSessionsTestOnlyUnsafe();
            assert(sessions.size() > 0 && session < sessions.size());
            clientSession = sessions[session];

            std::string tag = clientSession->getClipboardURI(false); // nominally thread unsafe
            LOG_TST("Got tag '" << tag << "' for session " << session);
            return tag;
    }

    std::string buildClipboardText(const std::string &text)
    {
        std::stringstream clipData;
        clipData << "text/plain;charset=utf-8\n"
                 << std::hex << text.length() << '\n'
                 << text << '\n';
        return clipData.str();
    }

    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Destroyed dockey [" << docKey << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        TRANSITION_STATE(_phase, Phase::PostCloseTest);
    }

    void runTest()
    {
        // NOTE: This code has multiple race-conditions!
        // The main one is that the fetching of clipboard
        // data (via fetchClipboardAssert) is done via
        // independent HTTP GET requests that have nothing
        // whatever with the long-lived WebSocket that
        // processes all the client commands below.
        // This suffers a very interesting race, which is
        // that the getClipboard command may end up
        // anywhere within the Kit queue, even before the
        // other commands preceeding it in this test!
        // As an example: in the 'Inject content' case we
        // send .uno:Deselect, paste, .uno:SelectAll,
        // .uno:Copy (all through the WebSocket), and an
        // HTTP GET for the getClipboard. But, in DocBroker,
        // the WebSocket commands might be interleaved with
        // the getClipboard, such that the Kit might receive
        // .uno:Deselect, paste, .uno:SelectAll, getClipboard,
        // .uno:Copy! This has been observed in practice.
        //
        // There are other race-conditions, too.
        // For example, even if Kit gets these commands in
        // the correct order (i.e. getClipboard last, after
        // .uno:Copy), getClipboard is executed immediately
        // while all the .uno commands are queued for async
        // execution. This means that when getClipboard is
        // executed in Core, the .uno:Copy command might not
        // have yet been executed and, therefore, will not
        // contain the expected contents, failing the test.
        //
        // To combat these races, we drain the events coming
        // from Core before we read the clipboard through
        // getClipboard. This way we are reasonably in
        // control of the state. Notice that the client
        // code will suffer these races, if the getClipboard
        // HTTP GET is done "too soon" after a copy, but
        // that is unlikely in practice because the URL for
        // getClipboard is generated as a link to the user,
        // which is clicked to download the clipboard contents.

        // Load a doc with the cursor saved at a top row.
        // NOTE: This load a spreadsheet, not a writer doc!
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("empty.ods", documentPath, documentURL, testname);

        std::shared_ptr<http::WebSocketSession> socket = helpers::loadDocAndGetSession(
            socketPoll(), Poco::URI(helpers::getTestServerURI()), documentURL, testname);

        _clipURI = getSessionClipboardURI(0);

        LOG_TST("Fetch empty clipboard content after loading");
        if (!fetchClipboardAssert(_clipURI, "", ""))
            return;

        // Check existing content
        LOG_TST("Fetch pristine content from the document");
        helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
        helpers::sendAndDrain(socket, testname, "uno .uno:Copy", "statechanged:");
        const std::string oneColumn = "2\n3\n5\n";
        if (!fetchClipboardAssert(_clipURI, "text/plain;charset=utf-8", oneColumn))
            return;

        LOG_TST("Open second connection");
        std::shared_ptr<http::WebSocketSession> socket2 = helpers::loadDocAndGetSession(
            socketPoll(), Poco::URI(helpers::getTestServerURI()), documentURL, testname);
        _clipURI2 = getSessionClipboardURI(1);

        LOG_TST("Check no clipboard content on second view");
        if (!fetchClipboardAssert(_clipURI2, "", ""))
            return;

        LOG_TST("Inject content through first view");
        helpers::sendTextFrame(socket, "uno .uno:Deselect", testname);
        const std::string text = "This is some content?&*/\\!!";
        helpers::sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\n" + text, testname);
        helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
        helpers::sendAndDrain(socket, testname, "uno .uno:Copy", "statechanged:");

        const std::string existing = "2\t\n3\t\n5\t";
        if (!fetchClipboardAssert(_clipURI, "text/plain;charset=utf-8", existing + text + '\n'))
            return;

        LOG_TST("re-check no clipboard content");
        if (!fetchClipboardAssert(_clipURI2, "", ""))
            return;

        LOG_TST("Push new clipboard content");
        const std::string newcontent = "1234567890";
        helpers::sendAndWait(socket, testname, "uno .uno:Deselect", "statechanged:");
        if (!setClipboard(_clipURI, buildClipboardText(newcontent), HTTPResponse::HTTP_OK))
            return;
        helpers::sendAndWait(socket, testname, "uno .uno:Paste", "statechanged:");

        if (!fetchClipboardAssert(_clipURI, "text/plain;charset=utf-8", newcontent))
            return;

        LOG_TST("Check the result.");
        helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
        helpers::sendAndDrain(socket, testname, "uno .uno:Copy", "statechanged:");
        if (!fetchClipboardAssert(_clipURI, "text/plain;charset=utf-8",
                                  existing + newcontent + '\n'))
            return;

        LOG_TST("Setup clipboards:");
        if (!setClipboard(_clipURI2, buildClipboardText("kippers"), HTTPResponse::HTTP_OK))
            return;
        if (!setClipboard(_clipURI, buildClipboardText("herring"), HTTPResponse::HTTP_OK))
            return;
        LOG_TST("Fetch clipboards:");
        if (!fetchClipboardAssert(_clipURI2, "text/plain;charset=utf-8", "kippers"))
            return;
        if (!fetchClipboardAssert(_clipURI, "text/plain;charset=utf-8", "herring"))
            return;

        TRANSITION_STATE(_phase, Phase::WaitDocClose);

        LOG_TST("Close sockets:");
        socket2->asyncShutdown();
        socket->asyncShutdown();

        LOK_ASSERT_MESSAGE("Expected successful disconnection of the WebSocket 2",
                           socket2->waitForDisconnection(std::chrono::seconds(5)));
        LOK_ASSERT_MESSAGE("Expected successful disconnection of the WebSocket 0",
                           socket->waitForDisconnection(std::chrono::seconds(5)));
    }

    void postCloseTest()
    {
        sleep(1); // paranoia.

        LOG_TST("Fetch clipboards after shutdown:");
        LOK_ASSERT_MESSAGE("Failed to get Session #2 clipboard content 'kippers'",
                           fetchClipboardAssert(_clipURI2, "text/plain;charset=utf-8", "kippers"));
        LOK_ASSERT_MESSAGE("Failed to get Session #1 clipboard content 'herring'",
                           fetchClipboardAssert(_clipURI, "text/plain;charset=utf-8", "herring"));

        TRANSITION_STATE(_phase, Phase::Done);

        LOG_TST("Clipboard tests succeeded");
        passTest("Got clipboard contents after shutdown");
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::RunTest:
            {
                runTest();
                break;
            }
            case Phase::WaitDocClose:
                break;
            case Phase::PostCloseTest:
                postCloseTest();
                break;
            case Phase::Done:
                break;
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitCopyPaste();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
