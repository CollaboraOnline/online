/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "WopiTestServer.hpp"
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>

#include <Poco/Net/HTTPRequest.h>

class UnitWopiHttpHeaders : public WopiTestServer
{
    STATE_ENUM(Phase, Load, Done)
    _phase;

protected:
    virtual std::unique_ptr<http::Response>
    assertCheckFileInfoRequest(const Poco::Net::HTTPRequest& request) override
    {
        assertHeaders(request);

        return nullptr; // Success.
    }

    std::unique_ptr<http::Response>
    assertGetFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        assertHeaders(request);
        exitTest(TestResult::Ok); //TODO: Remove when we add put/rename cases.

        return nullptr; // Success.
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        assertHeaders(request);
        exitTest(TestResult::Ok);
        return nullptr;
    }

    void assertPutRelativeFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        assertHeaders(request);
        exitTest(TestResult::Ok);
    }

    void assertRenameFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        assertHeaders(request);
        exitTest(TestResult::Ok);
    }

    void assertHeaders(const Poco::Net::HTTPRequest& request) const
    {
        static const std::map<std::string, std::string> Headers{
            { "Authorization", "Bearer xyz123abc456vwc789z" },
            { "X-Requested-With", "XMLHttpRequest" },
        };

        for (const auto& pair : Headers)
        {
            LOK_ASSERT_MESSAGE("Request must have [" + pair.first + ']', request.has(pair.first));
            LOK_ASSERT_EQUAL(pair.second, request[pair.first]);
        }
    }

public:
    UnitWopiHttpHeaders()
        : WopiTestServer("UnitWOPIHttpHeaders")
        , _phase(Phase::Load)
    {
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::Done);

                // Technically, having an empty line in the header
                // is invalid (it signifies the end of headers), but
                // this is to illustrate that we are able to overcome
                // such issues and generate valid headers.
                const std::string params
                    = "access_header=Authorization%3A%2520Bearer%"
                      "2520xyz123abc456vwc789z%250D%250A%250D%250AX-Requested-With%"
                      "3A%2520XMLHttpRequest&reuse_cookies=language%3Den-us%3AK%3DGS1&permission="
                      "edit";

                initWebsocket("/wopi/files/0?" + params);

                WSD_CMD("load url=" + getWopiSrc());

                break;
            }
            case Phase::Done:
            {
                // Just wait for the results.
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWopiHttpHeaders(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
