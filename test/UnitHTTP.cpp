/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <cassert>

#include <helpers.hpp>
#include <Poco/Util/Application.h>
#include <Poco/Net/StringPartSource.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>

#include <Log.hpp>
#include <Util.hpp>
#include <Unit.hpp>

class UnitHTTP : public UnitWSD
{
public:
    UnitHTTP()
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);
        // force HTTPS - to test harder
        config.setBool("ssl.enable", true);
    }

    // FIXME: can hook with (UnitWSD::get().handleHttpRequest(request, message, socket)) ...
    void invokeTest() override
    {
        for (int i = 0; i < 3; ++i)
        {
            std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(Poco::URI(helpers::getTestServerURI())));

            std::string sent = "Hello world test\n";

            Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/lool/convert-to/txt");

            switch(i)
            {
            case 0:
                request.setExpectContinue(false);
                break;
            case 1:
                request.setExpectContinue(true);
                break;
            default:
                break;
            }
            Poco::Net::HTMLForm form;
            form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
            form.set("format", "txt");
            form.addPart("data", new Poco::Net::StringPartSource(sent, "text/plain", "foobaa.txt"));
            form.prepareSubmit(request);
            form.write(session->sendRequest(request));

            Poco::Net::HTTPResponse response;
            std::stringstream actualStream;
            std::istream& responseStream = session->receiveResponse(response);
            Poco::StreamCopier::copyStream(responseStream, actualStream);

            std::string responseStr = actualStream.str();
            responseStr.erase(0,3); // remove utf-8 bom.

            if (sent != responseStr)
            {
                std::cerr << "Test " << i << " failed - mismatching string '" << responseStr << " vs. '" << sent << "'\n";
                exitTest(TestResult::Failed);
                return;
            }
        }
        // Give those convertors time to save and cleanup.
        std::this_thread::sleep_for(std::chrono::milliseconds(1000));

        std::cerr << "All tests passed.\n";
        exitTest(TestResult::Ok);
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitHTTP();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
