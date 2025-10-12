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

#include "config.h"

#include "WopiTestServer.hpp"
#include "Unit.hpp"
#include "lokassert.hpp"

#include <Poco/Net/HTTPRequest.h>

using namespace std::literals;

/// This tests the rejection logic and messages that
/// happen when a document is connected to while
/// it is being unloaded.
/// Unfortunately, there is an inherent race here
/// in that we might have already unloaded by the
/// time we request loading via a different
/// connection. This race becomes more common the
/// faster we unload. Also, the test is poorly named.
class UnitWopiOwnertermination : public WopiTestServer
{
    STATE_ENUM(Phase, Start, Load, WaitLoadStatus, WaitModifiedStatus, WaitDocClose, Done) _phase;

    int _loadedIndex; ///< The connection index that is loaded now.

public:
    UnitWopiOwnertermination()
        : WopiTestServer("UnitWOPIOwnerTermination")
        , _phase(Phase::Start)
        , _loadedIndex(0)
    {
        setTimeout(1min);
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        // Load again, while we are still unloading.
        TRANSITION_STATE(_phase, Phase::Load);

        return nullptr;
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        TST_LOG("Loaded #" << (_loadedIndex + 1) << ": [" << message << ']');

        TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

        // Modify the document.
        TST_LOG("Modifying");
        WSD_CMD_BY_CONNECTION_INDEX(_loadedIndex, "key type=input char=97 key=0");
        WSD_CMD_BY_CONNECTION_INDEX(_loadedIndex, "key type=up char=0 key=512");

        return true;
    }

    /// The document is modified. Save, modify, and close it.
    bool onDocumentModified(const std::string& message) override
    {
        TST_LOG("Modified #" << (_loadedIndex + 1) << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        TRANSITION_STATE(_phase, Phase::WaitDocClose);

        TST_LOG("Closing");
        WSD_CMD_BY_CONNECTION_INDEX(_loadedIndex, "closedocument");

        return true;
    }

    bool onDocumentError(const std::string& message) override
    {
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        LOK_ASSERT_EQUAL_MESSAGE("Expect only documentunloading errors",
                                 std::string("error: cmd=load kind=docunloading"), message);

        TRANSITION_STATE(_phase, Phase::Done);

        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Start:
            {
                // First time loading, transition.
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                TST_LOG("Creating first connection");
                initWebsocket("/wopi/files/0?access_token=anything");

                TST_LOG("Loading through first connection");
                WSD_CMD_BY_CONNECTION_INDEX(0, "load url=" + getWopiSrc());

                break;
            }
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                ++_loadedIndex;

                TST_LOG("Creating connection #" << (_loadedIndex + 1));
                addWebSocket();
                TST_LOG("Loading through connection #" << (_loadedIndex + 1));
                WSD_CMD_BY_CONNECTION_INDEX(_loadedIndex, "load url=" + getWopiSrc());

                break;
            }
            case Phase::WaitLoadStatus:
            case Phase::WaitModifiedStatus:
            case Phase::WaitDocClose:
                break;
            case Phase::Done:
                passTest("Reload while unloading failed as expected");
                break;
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWopiOwnertermination(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
