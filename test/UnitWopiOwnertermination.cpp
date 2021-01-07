/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include "WopiTestServer.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"
#include "helpers.hpp"
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Util/LayeredConfiguration.h>

class UnitWopiOwnertermination : public WopiTestServer
{
    enum class Phase
    {
        Load,
        WaitLoadStatus,
        Polling
    } _phase;

    /// Return the name of the given Phase.
    static std::string toString(Phase phase)
    {
#define ENUM_CASE(X)                                                                               \
    case X:                                                                                        \
        return #X

        switch (phase)
        {
            ENUM_CASE(Phase::Load);
            ENUM_CASE(Phase::WaitLoadStatus);
            ENUM_CASE(Phase::Polling);
            default:
                return "Unknown";
        }
#undef ENUM_CASE
    }

public:
    UnitWopiOwnertermination()
        : WopiTestServer("UnitWOPIOwnerTermination")
        , _phase(Phase::Load)
    {
    }

    void assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        if (_phase == Phase::Polling)
        {
            // Document got saved, that's what we wanted
            passTest("Document saved on closing after modification.");
        }
        else
        {
            failTest("Saving in an unexpected phase: " + toString(_phase));
        }
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitLoadStatus but was " + toString(_phase),
                           _phase == Phase::WaitLoadStatus);

        // Modify the document.
        LOG_TST("onDocumentLoaded: Modifying");
        helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=input char=97 key=0",
                               getTestname());
        helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=up char=0 key=512",
                               getTestname());

        // And close. We expect the document to be marked as modified and saved.
        LOG_TST("onDocumentLoaded: Closing");
        helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "closedocument", getTestname());

        _phase = Phase::Polling;
        SocketPoll::wakeupWorld();
        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                initWebsocket("/wopi/files/0?access_token=anything");

                _phase = Phase::WaitLoadStatus;

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "load url=" + getWopiSrc(), getTestname());
                break;
            }
            case Phase::WaitLoadStatus:
            {
                // Wait for onDocumentLoaded.
                break;
            }
            case Phase::Polling:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitWopiOwnertermination();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
