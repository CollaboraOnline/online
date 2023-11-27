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

class UnitWOPIRenameFile : public WopiTestServer
{
    STATE_ENUM(Phase, Load, RenameFile, Done)
    _phase;

public:
    UnitWOPIRenameFile()
        : WopiTestServer("UnitWOPIRenameFile")
        , _phase(Phase::Load)
    {
    }

    void assertRenameFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        // spec says UTF-7...
        LOK_ASSERT_EQUAL(std::string("hello"), request.get("X-WOPI-RequestedName"));
    }

    bool onFilterSendWebSocketMessage(const char* data, const std::size_t len,
                                      const WSOpCode /* code */, const bool /* flush */,
                                      int& /*unitReturn*/) override
    {
        const std::string message(data, len);

        const std::string expected("renamefile: filename=hello");
        if (message.find(expected) == 0)
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
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::RenameFile);

                initWebsocket("/wopi/files/0?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
                break;
            }
            case Phase::RenameFile:
            {
                TRANSITION_STATE(_phase, Phase::Done);

                WSD_CMD("renamefile filename=hello");
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
    return new UnitWOPIRenameFile();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
