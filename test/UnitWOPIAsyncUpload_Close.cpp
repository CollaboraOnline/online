/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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
#include <Poco/Util/LayeredConfiguration.h>

/// Test Async uploading with simulated failing.
/// We modify the document, save, and attempt to upload,
/// which fails. We close the document and verify
/// that the document is uploaded upon closing.
/// Modify, Save, Upload fails, close -> Upload.
class UnitWOPIAsyncUpload_Close : public WopiTestServer
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, Modify, WaitModifiedStatus, WaitFirstPutFile, Close,
               WaitSecondPutFile, Polling)
    _phase;

public:
    UnitWOPIAsyncUpload_Close()
        : WopiTestServer("UnitWOPIAsyncUpload_Close")
        , _phase(Phase::Load)
    {
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        // We save twice. First right after loading, unmodified.
        if (_phase == Phase::WaitFirstPutFile)
        {
            LOG_TST("assertPutFileRequest: First PutFile, which will fail");

            TRANSITION_STATE(_phase, Phase::Close);

            LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsModifiedByUser"));

            // We requested the save.
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsAutosave"));

            // Fail with error.
            return Util::make_unique<http::Response>(http::StatusLine(404));
        }

        // This during closing the document.
        LOG_TST("assertPutFileRequest: Second PutFile, which will succeed");
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitSecondPutFile",
                           _phase == Phase::WaitSecondPutFile);

        // the document is modified
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsModifiedByUser"));

        // Triggered while closing.
        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsAutosave"));

        passTest("Document uploaded on closing as expected.");

        return nullptr;
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitLoadStatus",
                           _phase == Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::Modify);

        return true;
    }

    /// The document is modified. Save it.
    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("onDocumentModified: Doc (WaitModifiedStatus): [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitModifiedStatus",
                           _phase == Phase::WaitModifiedStatus);
        TRANSITION_STATE(_phase, Phase::WaitFirstPutFile);

        WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0 "
                "extendedData=CustomFlag%3DCustom%20Value%3BAnotherFlag%3DAnotherValue");

        return true;
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
                break;
            case Phase::Modify:
            {
                TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

                WSD_CMD("key type=input char=97 key=0");
                WSD_CMD("key type=up char=0 key=512");
                break;
            }
            case Phase::WaitModifiedStatus:
                break;
            case Phase::WaitFirstPutFile:
                break;
            case Phase::Close:
            {
                TRANSITION_STATE(_phase, Phase::WaitSecondPutFile);

                WSD_CMD("closedocument");
                break;
            }
            case Phase::WaitSecondPutFile:
                break;
            case Phase::Polling:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPIAsyncUpload_Close(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
