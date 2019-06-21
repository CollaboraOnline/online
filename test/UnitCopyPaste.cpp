/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Test various copy/paste pieces ...

#include <config.h>

#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <wsd/LOOLWSD.hpp>
#include <wsd/ClientSession.hpp>
#include <Poco/Timestamp.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/StringPartSource.h>
#include <Poco/Util/LayeredConfiguration.h>

#include <test.hpp>

// Inside the WSD process
class UnitCopyPaste : public UnitWSD
{
public:
    UnitCopyPaste()
    {
        setHasKitHooks();
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);
        // force HTTPS - to test harder
        config.setBool("ssl.enable", true);
    }

    void invokeTest() override
    {
        std::string testname = "copypaste";

        // Load a doc with the cursor saved at a top row.
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("empty.ods", documentPath, documentURL, testname);
        std::shared_ptr<LOOLWebSocket> socket =
            helpers::loadDocAndGetSocket(Poco::URI(helpers::getTestServerURI()), documentURL, testname);

        std::shared_ptr<DocumentBroker> broker;
        std::shared_ptr<ClientSession> clientSession;
        {
            std::vector<std::shared_ptr<DocumentBroker>> brokers = LOOLWSD::getBrokersTestOnly();
            assert(brokers.size() > 0);
            broker = brokers[0];
            auto sessions = broker->getSessionsTestOnlyUnsafe();
            assert(sessions.size() > 0);
            clientSession = sessions[0];
        }

        Poco::URI clipURI(clientSession->getClipboardURI()); // nominally thread unsafe

        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(clipURI));
        session->setTimeout(Poco::Timespan(10, 0)); // 10 seconds.

#if 0 // for paste...
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/lool/convert-to/pdf");
        Poco::Net::HTMLForm form;
        form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
        form.set("format", "txt");
        form.addPart("data", new Poco::Net::StringPartSource("Hello World Content", "text/plain", "foo.txt"));
        form.prepareSubmit(request);
        form.write(session->sendRequest(request));

        Poco::Net::HTTPResponse response;
        std::stringstream actualStream;
        try {
            session->receiveResponse(response);
        } catch (Poco::Net::NoMessageException &) {
            std::cerr << "No response as expected.\n";
            exitTest(TestResult::Ok); // child should have timed out and been killed.
            return;
        } // else
        std::cerr << "Failed to terminate the sleeping kit\n";
        exitTest(TestResult::Failed);
#endif
            exitTest(TestResult::Ok); // child should have timed out and been killed.
    }
};


// Inside the forkit & kit processes - if we need it.
class UnitKitCopyPaste : public UnitKit
{
public:
    UnitKitCopyPaste()
    {
    }

    void invokeForKitTest() override
    {
    }

    bool filterKitMessage(WebSocketHandler *, std::string &) override
    {
        return false;
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitCopyPaste();
}

UnitBase *unit_create_kit(void)
{
    return new UnitKitCopyPaste();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
