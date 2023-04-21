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

class UnitWopiOwnertermination : public WopiTestServer
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitDocClose) _phase;

    static constexpr int RepeatCount = 2;

    int _loadCount;
    int _uploadCount;

public:
    UnitWopiOwnertermination()
        : WopiTestServer("UnitWOPIOwnerTermination")
        , _phase(Phase::Load)
        , _loadCount(0)
        , _uploadCount(0)
    {
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        ++_uploadCount;
        LOK_ASSERT_EQUAL_MESSAGE("Mismatching load and upload counts", _loadCount, _uploadCount);

        LOG_TST("Disconnecting #" << _loadCount);
        deleteSocketAt(0);

        // Load again, while we are still uploading.
        TRANSITION_STATE(_phase, Phase::Load);

        return nullptr;
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("Loaded: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::WaitDocClose);

        // Modify the document.
        LOG_TST("Modifying");
        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        // And close. We expect the document to be marked as modified and saved.
        LOG_TST("Closing");
        WSD_CMD("closedocument");

        return true;
    }

    bool onDocumentError(const std::string& message) override
    {
        LOK_ASSERT_EQUAL_MESSAGE("Mismatching load and upload counts", _loadCount,
                                 _uploadCount + 1);

        if (message != "error: cmd=internal kind=load")
        {
            LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

            LOK_ASSERT_EQUAL_MESSAGE("Expect only documentunloading errors",
                                     std::string("error: cmd=load kind=docunloading"), message);

            TRANSITION_STATE(_phase, Phase::WaitDocClose);
        }
        else
        {
            // We send out two errors when we fail to load.
            // This is the second one, which is 'cmd=internal kind=load'.
            LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);
        }

        return true;
    }

    // Wait for clean unloading.
    void onDocBrokerDestroy(const std::string&) override
    {
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        LOK_ASSERT_EQUAL_MESSAGE("Mismatching load and upload counts", _loadCount,
                                 _uploadCount + 1);

        passTest("Unloaded successfully.");
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                // First time loading, transition.
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                ++_loadCount;
                if (_loadCount == 1)
                {
                    LOG_TST("Creating first connection");
                    initWebsocket("/wopi/files/0?access_token=anything");
                }
                else
                {
                    LOG_TST("Creating connection #" << _loadCount);
                    addWebSocket();
                }

                WSD_CMD_BY_CONNECTION_INDEX(_loadCount - 1, "load url=" + getWopiSrc());

                break;
            }
            case Phase::WaitLoadStatus:
            case Phase::WaitDocClose:
                break;
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWopiOwnertermination(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
