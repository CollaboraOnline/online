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

#include <config.h>

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Util/LayeredConfiguration.h>

class UnitWOPISaveAsWithEncodedFileName : public WopiTestServer
{
    STATE_ENUM(Phase, LoadAndSaveAs, Done)
    _phase;

public:
    UnitWOPISaveAsWithEncodedFileName()
        : WopiTestServer("UnitWOPISaveAsWithEncodedFileName")
        , _phase(Phase::LoadAndSaveAs)
    {
    }

    void assertPutRelativeFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        // spec says UTF-7...
        LOK_ASSERT_EQUAL(std::string("/path/to/hello+ACU-20world.pdf"), request.get("X-WOPI-SuggestedTarget"));

        // make sure it is a pdf - or at least that it is larger than what it
        // used to be
        LOK_ASSERT(std::stoul(request.get("X-WOPI-Size")) > getFileContent().size());
    }

    bool onFilterSendWebSocketMessage(const char* data, const std::size_t len,
                                      const WSOpCode /* code */, const bool /* flush */,
                                      int& /*unitReturn*/) override
    {
        const std::string message(data, len);

        if (message.find("saveas: url=") != std::string::npos &&
            message.find(helpers::getTestServerURI()) != std::string::npos &&
            message.find("filename=hello%20world%251.pdf") != std::string::npos)
        {
            // successfully exit the test if we also got the outgoing message
            // notifying about saving the file
            exitTest(TestResult::Ok);
        }

        return false;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::LoadAndSaveAs:
            {
                initWebsocket("/wopi/files/0?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());

                // file name we want to save as is = hello%20world.pdf -> it is not encoded! and in the end we must expect like this.
                // we would send it encoded like hello%2520world.pdf
                WSD_CMD("saveas url=wopi:///path/to/hello%2520world.pdf");

                TRANSITION_STATE(_phase, Phase::Done);
                break;
            }
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitWOPISaveAsWithEncodedFileName();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
