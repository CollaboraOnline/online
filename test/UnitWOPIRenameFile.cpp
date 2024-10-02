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

#include "Util.hpp"
#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Util/LayeredConfiguration.h>

class UnitWOPIRenameFile : public WopiTestServer
{
    STATE_ENUM(Phase, Load, RenameFile, WaitRenameNotification, Done)
    _phase;

    static constexpr auto FilenameUtf8 = "Ḽơᶉëᶆ ȋṕšᶙṁ ḍỡḽǭᵳ ʂǐť";
    static constexpr auto FilenameUtf7 =
        "+HjwBoR2JAOsdhg +AgseVQFhHZkeQQ +Hg0e4R49Ae0dcw +AoIB0AFl-";

public:
    UnitWOPIRenameFile()
        : WopiTestServer("UnitWOPIRenameFile")
        , _phase(Phase::Load)
    {
    }

    void assertRenameFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        // spec says UTF-7...
        LOK_ASSERT_EQUAL(std::string(FilenameUtf7), request.get("X-WOPI-RequestedName"));
    }

    bool onFilterSendWebSocketMessage(const char* data, const std::size_t len,
                                      const WSOpCode /* code */, const bool /* flush */,
                                      int& /*unitReturn*/) override
    {
        const std::string message(data, len);

        const std::string expected("renamefile filename=" + Uri::encode(FilenameUtf8));

        LOG_TST("Got [" << message << "], expect: [" << expected << ']');
        if (message.find(expected) == 0)
        {
            LOK_ASSERT_STATE(_phase, Phase::WaitRenameNotification);

            // successfully exit the test if we also got the outgoing message
            // notifying about saving the file
            // Don't end the test here, as we'd trigger dead-lock check on
            // joining the socket poll thread, which is where we're called from.
            TRANSITION_STATE(_phase, Phase::Done);
        }

        return false;
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::RenameFile);

        TRANSITION_STATE(_phase, Phase::WaitRenameNotification);

        WSD_CMD("renamefile filename=" + Uri::encode(FilenameUtf8));

        return true;
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
                break;
            }
            case Phase::WaitRenameNotification:
            {
                // just wait for the results
                break;
            }
            case Phase::Done:
            {
                passTest("Got the expected renamefile command");
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
