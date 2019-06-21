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
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/StringPartSource.h>
#include <Poco/Util/LayeredConfiguration.h>

#include <test.hpp>

using namespace Poco::Net;

struct CopyPasteData
{
    std::vector<std::string> _mimeTypes;
    std::vector<std::string> _content;
    CopyPasteData()
    {
    }
    bool read(std::istream& inStream)
    {
        while (!inStream.eof())
        {
            std::string mime, hexLen, newline;
            std::getline(inStream, mime, '\n');
            std::getline(inStream, hexLen, '\n');
            std::cerr << "mime: '" << mime << "' - hexlen '" << hexLen << "'\n";
            uint64_t len = strtoll( hexLen.c_str(), nullptr, 16 );
            std::string content(len, ' ');
            inStream.read(&content[0], len);
            std::getline(inStream, newline, '\n');
            if (newline.length() > 0)
            {
                std::cerr << "trailing stream content expecting newline: '" << newline <<
                    "' - len " << hexLen << " == " << len << " read - " << content.length() << "\n";
                return false;
            }
            if (mime.length() > 0)
            {
                _mimeTypes.push_back(mime);
                _content.push_back(content);
            }
        }
        return true;
    }
    size_t size()
    {
        assert(_mimeTypes.size() == _content.size());
        return _mimeTypes.size();
    }
};

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

        std::string clipURIstr = clientSession->getClipboardURI(false); // nominally thread unsafe
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
            return;
        }

        CPPUNIT_ASSERT_EQUAL(std::string("application/octet-stream"), response.getContentType());
        CopyPasteData clipboard;
        CPPUNIT_ASSERT(clipboard.read(responseStream));
        CPPUNIT_ASSERT_EQUAL(std::string("application/octet-stream"), response.getContentType());
        std::cerr << "Clipboard with " << clipboard.size() << " entries\n";
        for (size_t i = 0; i < clipboard.size(); ++i)
            std::cerr << "\t[" << i << "] - size " << clipboard._content[i].size() <<
                " type: '" << clipboard._mimeTypes[i] << "'\n";

        std::cerr << "CopyPaste tests succeeded" << std::endl;
        exitTest(TestResult::Ok);
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitCopyPaste();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
