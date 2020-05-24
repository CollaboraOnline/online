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
#include <iostream>
#include <random>

#include <Common.hpp>
#include <Protocol.hpp>
#include <LOOLWebSocket.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <FileUtil.hpp>
#include <helpers.hpp>

#include <Poco/Timestamp.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/StringPartSource.h>
#include <Poco/Util/LayeredConfiguration.h>

// Inside the WSD process
class UnitConvert : public UnitWSD
{
    bool _workerStarted;
    std::thread _worker;

public:
    UnitConvert() :
        _workerStarted(false)
    {
        setHasKitHooks();
        setTimeout(3600 * 1000); /* one hour */
    }
    ~UnitConvert()
    {
        LOG_INF("Joining test worker thread\n");
        _worker.join();
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);

        config.setBool("ssl.enable", true);
        config.setInt("per_document.limit_load_secs", 1);
    }

    void invokeTest() override
    {
        if (_workerStarted)
            return;
        _workerStarted = true;
        std::cerr << "Starting thread ...\n";
        _worker = std::thread([this]{
                std::cerr << "Now started thread ...\n";
                std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(Poco::URI(helpers::getTestServerURI())));
                session->setTimeout(Poco::Timespan(10, 0)); // 10 seconds.

                Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, "/lool/convert-to/pdf");
                Poco::Net::HTMLForm form;
                form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
                form.set("format", "txt");
                form.addPart("data", new Poco::Net::StringPartSource("Hello World Content", "text/plain", "foo.txt"));
                form.prepareSubmit(request);
                form.write(session->sendRequest(request));

                Poco::Net::HTTPResponse response;
                try {
                    session->receiveResponse(response);
                } catch (Poco::Net::NoMessageException &) {
                    std::cerr << "No response as expected.\n";
                    exitTest(TestResult::Ok); // child should have timed out and been killed.
                    return;
                } // else
                std::cerr << "Failed to terminate the sleeping kit\n";
                exitTest(TestResult::Failed);
            });
    }
};

// Inside the forkit & kit processes
class UnitKitConvert : public UnitKit
{
public:
    UnitKitConvert()
    {
        setTimeout(3600 * 1000); /* one hour */
    }
    bool filterKitMessage(WebSocketHandler *, std::string &message) override
    {
        std::cerr << "kit message " << message << '\n';
        if (message.find("load") != std::string::npos)
        {
            std::cerr << "Load message received - starting to sleep\n";
            sleep(60);
        }
        return false;
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitConvert();
}

UnitBase *unit_create_kit(void)
{
    return new UnitKitConvert();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
