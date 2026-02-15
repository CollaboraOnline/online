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

/*
 * Unit test for document conversion functionality.
 */

#include <config.h>

#include <iostream>

#include <Common.hpp>
#include <Protocol.hpp>
#include <Unit.hpp>
#include <common/Util.hpp>
#include <common/FileUtil.hpp>
#include <helpers.hpp>

#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/StringPartSource.h>
#include <Poco/Net/FilePartSource.h>
#include <Poco/Util/LayeredConfiguration.h>

using namespace std::literals;

// Inside the WSD process
class UnitConvert : public UnitWSD
{
    bool _workerStarted;
    std::thread _worker;

public:
    UnitConvert()
        : UnitWSD("UnitConvert")
        , _workerStarted(false)
    {
        setHasKitHooks();
        setTimeout(1h);
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
        config.setInt("per_document.limit_load_secs", 30);
        config.setBool("storage.filesystem[@allow]", false);
    }

    void sendConvertTo(std::unique_ptr<Poco::Net::HTTPClientSession>& session, const std::string& filename, bool isTemplate = false, bool isCompare = false)
    {
        std::string uri;
        if (isTemplate || isCompare)
        {
            uri = "/cool/convert-to";
        }
        else
        {
            uri = "/cool/convert-to/pdf";
        }
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_POST, uri);
        Poco::Net::HTMLForm form;
        form.setEncoding(Poco::Net::HTMLForm::ENCODING_MULTIPART);
        if (isTemplate)
        {
            form.set("format", "html");
            std::string dataPath = Poco::Path(TDOC, filename).toString();
            form.addPart("data", new Poco::Net::FilePartSource(dataPath));
            std::string templatePath = Poco::Path(TDOC, "template.docx").toString();
            form.addPart("template", new Poco::Net::FilePartSource(templatePath));
        }
        else if (isCompare)
        {
            form.set("format", "rtf");
            std::string dataPath = Poco::Path(TDOC, filename).toString();
            form.addPart("data", new Poco::Net::FilePartSource(dataPath));
            std::string comparePath = Poco::Path(TDOC, "old.docx").toString();
            form.addPart("compare", new Poco::Net::FilePartSource(comparePath));
        }
        else
        {
            form.set("format", "txt");
            form.addPart("data", new Poco::Net::StringPartSource("Hello World Content", "text/plain", filename));
        }
        form.prepareSubmit(request);
        form.write(session->sendRequest(request));
    }

    bool checkConvertTo(std::unique_ptr<Poco::Net::HTTPClientSession>& session, bool isTemplate = false, bool isCompare = false)
    {
        Poco::Net::HTTPResponse response;
        std::stringstream stringStream;
        try {
            std::istream& responseStream = session->receiveResponse(response);
            Poco::StreamCopier::copyStream(responseStream, stringStream);
        } catch (...) {
            return false;
        }

        bool ret = response.getStatus() == Poco::Net::HTTPResponse::HTTPStatus::HTTP_OK;
        if (!ret || !(isTemplate || isCompare))
        {
            if (!ret)
            {
                TST_LOG("checkConvertTo: bad status");
            }

            return ret;
        }

        std::string responseString = stringStream.str();
        if (isTemplate)
        {
            if (responseString.find("DOCTYPE html") == std::string::npos)
            {
                TST_LOG("checkConvertTo: output is not HTML");
                return false;
            }

            if (responseString.find("background: #156082") == std::string::npos)
            {
                TST_LOG("checkConvertTo: no template color in output");
                return false;
            }
        }
        else if (isCompare)
        {
            if (!responseString.starts_with("{\\rtf"))
            {
                TST_LOG("checkConvertTo: output is not RTF");
                return false;
            }

            if (responseString.find("\\deleted") == std::string::npos)
            {
                TST_LOG("checkConvertTo: no old content in output");
                return false;
            }
        }

        return true;
    }

    void invokeWSDTest() override
    {
        if (_workerStarted)
            return;
        _workerStarted = true;
        std::cerr << "Starting thread ...\n";
        _worker = std::thread([this]{
                std::cerr << "Now started thread ...\n";
                std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(Poco::URI(helpers::getTestServerURI())));
                session->setTimeout(Poco::Timespan(30, 0)); // 30 seconds.

                sendConvertTo(session, "foo.txt");
                if(!checkConvertTo(session))
                {
                    exitTest(TestResult::Failed);
                    return;
                }

                sendConvertTo(session, "test___á.txt");
                if(!checkConvertTo(session))
                {
                    exitTest(TestResult::Failed);
                    return;
                }

                // Given a markdown input + docx template:
                // When converting that to HTML:
                sendConvertTo(session, "test.md", /*isTemplate=*/true);
                // Then make sure the output has a color from the template:
                // Without the accompanying fix in place, this test would have failed with:
                // checkConvertTo: no template color in output
                if(!checkConvertTo(session, /*isTemplate=*/true))
                {
                    exitTest(TestResult::Failed);
                    return;
                }

                // Given a current docx + old docx:
                // When comparing those documents and saving the result as RTF:
                sendConvertTo(session, "new.docx", /*isTemplate=*/false, /*isCompare=*/true);
                // Then make sure the output has content from the old document, too:
                // Without the accompanying fix in place, this test would have failed with:
                // checkConvertTo: no old content in output
                if(!checkConvertTo(session, /*isTemplate=*/false, /*isCompare=*/true))
                {
                    exitTest(TestResult::Failed);
                    return;
                }

                exitTest(TestResult::Ok);
            });
    }
};

// Inside the forkit & kit processes
class UnitKitConvert : public UnitKit
{
public:
    UnitKitConvert()
        : UnitKit("UnitKitConvert")
    {
        setTimeout(1h);
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
