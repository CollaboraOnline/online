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

#include "HttpRequest.hpp"
#include "Util.hpp"
#include "lokassert.hpp"

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <Poco/Net/HTTPRequest.h>

/// Test Saving and Async uploading after modifying and immediately closing.
/// We modify the document and close immediately.
class UnitWOPIAsyncUpload_ModifyClose : public WopiTestServer
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitPutFile, WaitDestroy) _phase;

public:
    UnitWOPIAsyncUpload_ModifyClose()
        : WopiTestServer("UnitWOPIAsyncUpload_ModifyClose")
        , _phase(Phase::Load)
    {
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        LOK_ASSERT_STATE(_phase, Phase::WaitPutFile);

        // Expect PutFile after closing, since the document is modified.
        if (_phase == Phase::WaitPutFile)
        {
            // The document is modified.
            LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsModifiedByUser"));
            LOK_ASSERT_EQUAL(std::string("true"), request.get("X-LOOL-WOPI-IsModifiedByUser"));

            // Triggered manually or during closing, not auto-save.
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsAutosave"));
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-LOOL-WOPI-IsAutosave"));

            TRANSITION_STATE(_phase, Phase::WaitDestroy);

            return std::make_unique<http::Response>(http::StatusCode::OK);
        }

        // This during closing the document.
        LOG_TST("assertPutFileRequest: unexpected");
        failTest("PutFile multiple times.");

        return nullptr;
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::WaitPutFile);

        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");
        WSD_CMD("closedocument");

        return true;
    }

    // Wait for clean unloading.
    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Destroyed dockey [" << docKey << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitDestroy);

        passTest("Document unloaded as expected.");
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                LOG_TST("Load: initWebsocket.");
                initWebsocket("/wopi/files/0?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
                break;
            }
            case Phase::WaitLoadStatus:
            case Phase::WaitPutFile:
            case Phase::WaitDestroy:
                break;
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPIAsyncUpload_ModifyClose(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
