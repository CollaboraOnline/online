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
#include <common/Clipboard.hpp>
#include <wsd/ClientSession.hpp>
#include <Poco/Timestamp.h>
#include <Poco/StringTokenizer.h>
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
public:
    UnitCopyPaste()
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
        Poco::URI clipURI(clipURIstr);

        HTTPResponse response;
        HTTPRequest request(HTTPRequest::HTTP_GET, clipURI.getPathAndQuery());
        std::unique_ptr<HTTPClientSession> session(helpers::createSession(clipURI));
        session->setTimeout(Poco::Timespan(10, 0)); // 10 seconds.
        session->sendRequest(request);
        std::istream& responseStream = session->receiveResponse(response);
        return std::string(std::istreambuf_iterator<char>(responseStream), {});
    }

    std::shared_ptr<ClipboardData> getClipboard(const std::string &clipURIstr)
    {
        std::cerr << "connect to " << clipURIstr << std::endl;
        Poco::URI clipURI(clipURIstr);

        HTTPResponse response;
        HTTPRequest request(HTTPRequest::HTTP_GET, clipURI.getPathAndQuery());
        std::unique_ptr<HTTPClientSession> session(helpers::createSession(clipURI));
        session->setTimeout(Poco::Timespan(10, 0)); // 10 seconds.
        session->sendRequest(request);
        std::istream& responseStream = session->receiveResponse(response);

        if (response.getStatus() != HTTPResponse::HTTP_OK)
        {
            std::cerr << "Error response for clipboard " << response.getReason();
            exitTest(TestResult::Failed);
            return std::shared_ptr<ClipboardData>();
        }

        CPPUNIT_ASSERT_EQUAL(std::string("application/octet-stream"), response.getContentType());

        auto clipboard = std::make_shared<ClipboardData>();
        clipboard->read(responseStream);
        clipboard->dumpState(std::cerr);

        return clipboard;
    }

    bool assertClipboard(const std::shared_ptr<ClipboardData> &clipboard,
                         const std::string &mimeType, const std::string &content)
    {
        bool failed = false;

        std::string value;
        if (!clipboard || !clipboard->findType(mimeType, value))
        {
            std::cerr << "missing clipboard or missing clipboard mime type '" << mimeType << "'\n";
            failed = true;
        }
        else if (value != content)
        {
            std::cerr << "clipboard content mismatch " << value.length() << " vs. " << content.length() << "\n";
            sleep (1); // output settle.
            Util::dumpHex(std::cerr, "\tclipboard:\n", "", value);
            Util::dumpHex(std::cerr, "\tshould be:\n", "", content);
            failed = true;
        }
        if (failed)
        {
            exitTest(TestResult::Failed);
            return false;
        }
        return true;
    }

    bool fetchClipboardAssert(const std::string &clipURI,
                              const std::string &mimeType,
                              const std::string &content)
    {
        std::shared_ptr<ClipboardData> clipboard;
        try {
            clipboard = getClipboard(clipURI);
        } catch (ParseError &err) {
            std::cerr << "parse error " << err.toString() << std::endl;
            exitTest(TestResult::Failed);
            return false;
        }

        if (!assertClipboard(clipboard, mimeType, content))
            return false;
        return true;
    }

    bool setClipboard(const std::string &clipURIstr, const std::string &rawData,
                      HTTPResponse::HTTPStatus expected)
    {
        std::cerr << "connect to " << clipURIstr << std::endl;
        Poco::URI clipURI(clipURIstr);

        std::unique_ptr<HTTPClientSession> session(helpers::createSession(clipURI));
        Poco::URI clipURIPoco(clipURI);
        HTTPRequest request(HTTPRequest::HTTP_POST, clipURIPoco.getPathAndQuery());
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
            std::cerr << "No response from setting clipboard.\n";
            exitTest(TestResult::Failed);
            return false;
        }

        if (response.getStatus() != expected)
        {
            std::cerr << "Error response for clipboard "<< response.getStatus() <<
                " != expected " << expected << "\n";
            exitTest(TestResult::Failed);
            return false;
        }

        return true;
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

        std::string clipURI = clientSession->getClipboardURI(false); // nominally thread unsafe

#if 0
        // In an empty cell
        helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
        helpers::sendTextFrame(socket, "uno .uno:Copy", testname);
        if (!fetchClipboardAssert(clipURI, "text/plain;charset=utf-8", ""))
            return;
#endif

        // Check existing content
        helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
        helpers::sendTextFrame(socket, "uno .uno:Copy", testname);
        std::string oneColumn = "2\n3\n5\n";
        if (!fetchClipboardAssert(clipURI, "text/plain;charset=utf-8", oneColumn))
            return;

        // Inject some content
        helpers::sendTextFrame(socket, "uno .uno:Deselect", testname);
        std::string text = "This is some content?&*/\\!!";
        helpers::sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\n" + text, testname);
        helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
        helpers::sendTextFrame(socket, "uno .uno:Copy", testname);

        std::string existing = "2\t\n3\t\n5\t";
        if (!fetchClipboardAssert(clipURI, "text/plain;charset=utf-8", existing + text + "\n"))
            return;

        // Now try pushing some new clipboard content ...
        std::string newcontent = "1234567890";
        std::stringstream clipData;
        clipData << "text/plain;charset=utf-8\n"
                 << std::hex << newcontent.length() << "\n"
                 << newcontent << "\n";

        helpers::sendTextFrame(socket, "uno .uno:Deselect", testname);
        if (!setClipboard(clipURI, clipData.str(), HTTPResponse::HTTP_OK))
            return;
        helpers::sendTextFrame(socket, "uno .uno:Paste", testname);

        if (!fetchClipboardAssert(clipURI, "text/plain;charset=utf-8", newcontent))
            return;

        // No how do we look in total ?
        helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
        helpers::sendTextFrame(socket, "uno .uno:Copy", testname);
        if (!fetchClipboardAssert(clipURI, "text/plain;charset=utf-8", existing + newcontent + "\n"))
            return;

        std::cerr << "Clipboard tests succeeded" << std::endl;
        exitTest(TestResult::Ok);
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitCopyPaste();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
