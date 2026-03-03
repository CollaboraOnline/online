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

// Test that a clipboard download timeout arriving after the document
// is closed doesn't crash. See: use weak_from_this() to detect if
// session ended before clipboard response.

#include <config.h>

#include <HttpRequest.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <WebSocketSession.hpp>
#include <helpers.hpp>
#include <lokassert.hpp>
#include <test.hpp>
#include <wsd/COOLWSD.hpp>
#include <wsd/ClientSession.hpp>

#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/StringPartSource.h>

using namespace std::literals;
using namespace Poco::Net;

// Inside the WSD process
class UnitClipboardClose : public UnitWSD
{
    STATE_ENUM(Phase, RunTest, WaitDocClose, Done) _phase;

    std::string _clipURI;
    bool _sessionGoneCalled = false;

public:
    UnitClipboardClose()
        : UnitWSD("UnitClipboardClose")
        , _phase(Phase::RunTest)
    {
        setTimeout(std::chrono::seconds(30));
    }

    /// Replace the clipboard download URL with a non-routable address
    /// so the HTTP request will hang rather than completing immediately.
    void filterClipboardDownloadURL(std::string& url) override
    {
        TST_LOG("Replacing clipboard download URL [" << url
                << "] with non-routable address");
        url = "http://10.255.255.1/cool/clipboard";
    }

    /// Set a short timeout so the callback fires quickly during
    /// the DocBroker's flush phase rather than waiting 30s.
    void onClipboardDownloadRequest(std::shared_ptr<http::Session>& httpSession) override
    {
        TST_LOG("Setting short timeout on clipboard download session");
        httpSession->setTimeout(std::chrono::seconds(2));
    }

    void onClipboardDownloadSessionGone() override
    {
        TST_LOG("Callback detected session was already destroyed");
        _sessionGoneCalled = true;
    }

    std::string getSessionClipboardURI(size_t session)
    {
        std::vector<std::shared_ptr<DocumentBroker>> brokers =
            COOLWSD::getBrokersTestOnly();
        assert(!brokers.empty());
        auto sessions = brokers[0]->getSessionsTestOnlyUnsafe();
        assert(sessions.size() > session);
        return sessions[session]->getClipboardURI(false);
    }

    bool setClipboard(const std::string& clipURIstr, const std::string& rawData,
                      HTTPResponse::HTTPStatus expected)
    {
        TST_LOG("setClipboard: connect to " << clipURIstr);
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
        try
        {
            session->receiveResponse(response);
        }
        catch (NoMessageException&)
        {
            TST_LOG("Error: No response from setting clipboard.");
            exitTest(TestResult::Failed);
            return false;
        }

        if (response.getStatus() != expected)
        {
            TST_LOG("Error: response for clipboard " << response.getStatus()
                    << " != expected " << expected);
            exitTest(TestResult::Failed);
            return false;
        }

        return true;
    }

    void onDocBrokerDestroy(const std::string& docKey) override
    {
        TST_LOG("DocBroker destroyed for [" << docKey << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);
        LOK_ASSERT_MESSAGE("Clipboard callback should have detected destroyed session",
                           _sessionGoneCalled);
        TRANSITION_STATE(_phase, Phase::Done);
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::RunTest:
            {
                std::string documentPath, documentURL;
                helpers::getDocumentPathAndURL("hello.odt", documentPath,
                                               documentURL, testname);

                std::shared_ptr<http::WebSocketSession> socket =
                    helpers::loadDocAndGetSession(
                        socketPoll(), Poco::URI(helpers::getTestServerURI()),
                        documentURL, testname);

                _clipURI = getSessionClipboardURI(0);

                // Post a JSON clipboard payload. The JSON triggers the
                // async HTTP download path in handleClipboardRequest.
                // The URL must contain /cool/clipboard in its path.
                // filterClipboardDownloadURL replaces it with a
                // non-routable address and onClipboardDownloadRequest
                // sets a short timeout so the callback fires quickly.
                const std::string jsonPayload =
                    "{\"url\": \"http://localhost/cool/clipboard\","
                    " \"commandName\": \".uno:Paste\"}";

                TST_LOG("Posting JSON clipboard to trigger async download");
                LOK_ASSERT(setClipboard(_clipURI, jsonPayload,
                                        HTTPResponse::HTTP_OK));

                TRANSITION_STATE(_phase, Phase::WaitDocClose);

                // Close the document while the async clipboard HTTP
                // request is still pending. This destroys the
                // ClientSession. The 2s timeout will fire during the
                // DocBroker's flush phase, invoking the finished
                // callback after the session is already gone.
                TST_LOG("Closing document while clipboard request pending");
                socket->asyncShutdown();
                LOK_ASSERT_MESSAGE(
                    "Expected successful disconnection of the WebSocket",
                    socket->waitForDisconnection(5s));
                break;
            }
            case Phase::WaitDocClose:
                break;
            case Phase::Done:
                passTest("Clipboard timeout after doc close didn't crash");
                break;
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitClipboardClose(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
