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

    std::shared_ptr<ClipboardData> getClipboard(const std::string &clipURIstr,
                                                HTTPResponse::HTTPStatus expected)
    {
        std::cerr << "connect to " << clipURIstr << std::endl;
        Poco::URI clipURI(clipURIstr);

        HTTPResponse response;
        HTTPRequest request(HTTPRequest::HTTP_GET, clipURI.getPathAndQuery());
        std::unique_ptr<HTTPClientSession> session(helpers::createSession(clipURI));
        session->setTimeout(Poco::Timespan(10, 0)); // 10 seconds.
        session->sendRequest(request);
        std::cerr << "sent request.\n";

        try {
            std::istream& responseStream = session->receiveResponse(response);

            if (response.getStatus() != expected)
            {
                std::cerr << "Error: response for clipboard status mismatch " <<
                    response.getStatus() << " != " << expected << " reason: " << response.getReason();
                exitTest(TestResult::Failed);
                return std::shared_ptr<ClipboardData>();
            }

            if (response.getContentType() != "application/octet-stream")
            {
                std::cerr << "Error: mismatching content type for clipboard: " << response.getContentType() << '\n';
                exitTest(TestResult::Failed);
                return std::shared_ptr<ClipboardData>();
            }

            auto clipboard = std::make_shared<ClipboardData>();
            clipboard->read(responseStream);
            clipboard->dumpState(std::cerr);

            std::cerr << "got response\n";
            return clipboard;
        } catch (Poco::Exception &e) {
            std::cerr << "Poco exception: " << e.message() << '\n';
            exitTest(TestResult::Failed);
            return std::shared_ptr<ClipboardData>();
        }
    }

    bool assertClipboard(const std::shared_ptr<ClipboardData> &clipboard,
                         const std::string &mimeType, const std::string &content)
    {
        bool failed = false;

        std::string value;

        // allow empty clipboards
        if (clipboard && mimeType.empty() && content.empty())
            return true;

        if (!clipboard || !clipboard->findType(mimeType, value))
        {
            std::cerr << "Error: missing clipboard or missing clipboard mime type '" << mimeType << "'\n";
            failed = true;
        }
        else if (value != content)
        {
            std::cerr << "Error: clipboard content mismatch " << value.length() << " vs. " << content.length() << '\n';
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
                              const std::string &content,
                              HTTPResponse::HTTPStatus expected = HTTPResponse::HTTP_OK)
    {
        std::shared_ptr<ClipboardData> clipboard;
        try {
            clipboard = getClipboard(clipURI, expected);
        } catch (ParseError &err) {
            std::cerr << "Error: parse error " << err.toString() << std::endl;
            exitTest(TestResult::Failed);
            return false;
        } catch (...) {
            std::cerr << "Error: unknown exception during read / parse\n";
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
            std::cerr << "Error: No response from setting clipboard.\n";
            exitTest(TestResult::Failed);
            return false;
        }

        if (response.getStatus() != expected)
        {
            std::cerr << "Error: response for clipboard "<< response.getStatus() <<
                " != expected " << expected << '\n';
            exitTest(TestResult::Failed);
            return false;
        }

        return true;
    }

    std::string getSessionClipboardURI(size_t session)
    {
            std::shared_ptr<DocumentBroker> broker;
            std::shared_ptr<ClientSession> clientSession;

            std::vector<std::shared_ptr<DocumentBroker>> brokers = LOOLWSD::getBrokersTestOnly();
            assert(brokers.size() > 0);
            broker = brokers[0];
            auto sessions = broker->getSessionsTestOnlyUnsafe();
            assert(sessions.size() > 0 && session < sessions.size());
            clientSession = sessions[session];

            std::string tag = clientSession->getClipboardURI(false); // nominally thread unsafe
            std::cerr << "Got tag '" << tag << "' for session " << session << '\n';
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

    void invokeTest() override
    {
        std::string testname = "copypaste";

        try {

        // Load a doc with the cursor saved at a top row.
        std::string documentPath, documentURL;
        helpers::getDocumentPathAndURL("empty.ods", documentPath, documentURL, testname);
        std::shared_ptr<LOOLWebSocket> socket =
            helpers::loadDocAndGetSocket(Poco::URI(helpers::getTestServerURI()), documentURL, testname);

        std::string clipURI = getSessionClipboardURI(0);

        std::cerr << "Fetch empty clipboard content\n";
        if (!fetchClipboardAssert(clipURI, "", ""))
            return;

        // Check existing content
        std::cerr << "Fetch pristine content\n";
        helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
        helpers::sendTextFrame(socket, "uno .uno:Copy", testname);
        std::string oneColumn = "2\n3\n5\n";
        if (!fetchClipboardAssert(clipURI, "text/plain;charset=utf-8", oneColumn))
            return;

        std::cerr << "Open second connection\n";
        std::shared_ptr<LOOLWebSocket> socket2 =
            helpers::loadDocAndGetSocket(Poco::URI(helpers::getTestServerURI()), documentURL, testname);
        std::string clipURI2 = getSessionClipboardURI(1);

        std::cerr << "Check no clipboard content\n";
        if (!fetchClipboardAssert(clipURI2, "", ""))
            return;

        std::cerr << "Inject content\n";
        helpers::sendTextFrame(socket, "uno .uno:Deselect", testname);
        std::string text = "This is some content?&*/\\!!";
        helpers::sendTextFrame(socket, "paste mimetype=text/plain;charset=utf-8\n" + text, testname);
        helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
        helpers::sendTextFrame(socket, "uno .uno:Copy", testname);

        std::string existing = "2\t\n3\t\n5\t";
        if (!fetchClipboardAssert(clipURI, "text/plain;charset=utf-8", existing + text + '\n'))
            return;

        std::cerr << "re-check no clipboard content\n";
        if (!fetchClipboardAssert(clipURI2, "", ""))
            return;

        std::cerr << "Push new clipboard content\n";
        std::string newcontent = "1234567890";
        helpers::sendTextFrame(socket, "uno .uno:Deselect", testname);
        if (!setClipboard(clipURI, buildClipboardText(newcontent), HTTPResponse::HTTP_OK))
            return;
        helpers::sendTextFrame(socket, "uno .uno:Paste", testname);

        if (!fetchClipboardAssert(clipURI, "text/plain;charset=utf-8", newcontent))
            return;

        std::cerr << "Check the result.\n";
        helpers::sendTextFrame(socket, "uno .uno:SelectAll", testname);
        helpers::sendTextFrame(socket, "uno .uno:Copy", testname);
        if (!fetchClipboardAssert(clipURI, "text/plain;charset=utf-8", existing + newcontent + '\n'))
            return;

        std::cerr << "Setup clipboards:\n";
        if (!setClipboard(clipURI2, buildClipboardText("kippers"), HTTPResponse::HTTP_OK))
            return;
        if (!setClipboard(clipURI, buildClipboardText("herring"), HTTPResponse::HTTP_OK))
            return;
        std::cerr << "Fetch clipboards:\n";
        if (!fetchClipboardAssert(clipURI2, "text/plain;charset=utf-8", "kippers"))
            return;
        if (!fetchClipboardAssert(clipURI, "text/plain;charset=utf-8", "herring"))
            return;

        std::cerr << "Close sockets:\n";
        socket->shutdown();
        socket2->shutdown();

        sleep(1); // paranoia.

        std::cerr << "Fetch clipboards after shutdown:\n";
        if (!fetchClipboardAssert(clipURI2, "text/plain;charset=utf-8", "kippers"))
            return;
        if (!fetchClipboardAssert(clipURI, "text/plain;charset=utf-8", "herring"))
            return;

        std::cerr << "Clipboard tests succeeded" << std::endl;
        exitTest(TestResult::Ok);

        } catch (...) {
            std::cerr << "Error: exception failure during tests" << std::endl;
            exitTest(TestResult::Failed);
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitCopyPaste();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
