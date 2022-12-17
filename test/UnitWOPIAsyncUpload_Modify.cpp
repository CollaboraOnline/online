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
/// which fails. We then modify the document again
/// and save. We expect another upload attempt,
/// which will succeed.
/// Modify, Save, Upload fails.
/// Modify, Save, Upload fails, close -> Upload.
class UnitWOPIAsyncUpload_Modify : public WopiTestServer
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus, WaitUnmodifiedStatus, WaitDestroy)
    _phase;

public:
    UnitWOPIAsyncUpload_Modify()
        : WopiTestServer("UnitWOPIAsyncUpload_Modify")
        , _phase(Phase::Load)
    {
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        LOK_ASSERT_MESSAGE("Too many PutFile attempts", getCountPutFile() <= 3);

        // The document is modified.
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsModifiedByUser"));

        // Triggered manually or during closing, not auto-save.
        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsAutosave"));

        LOK_ASSERT_MESSAGE("Unexpected phase", _phase == Phase::WaitModifiedStatus ||
                                                   _phase == Phase::WaitUnmodifiedStatus);

        // We save twice. First right after loading, unmodified.
        if (getCountPutFile() == 1)
        {
            LOG_TST("First PutFile, which will fail");

            // Fail with error.
            LOG_TST("Simulate PutFile failure");
            return Util::make_unique<http::Response>(http::StatusLine(500));
        }

        if (getCountPutFile() == 2)
        {
            LOG_TST("Second PutFile, which will also fail");

            LOG_TST("Simulate PutFile failure (again)");
            return Util::make_unique<http::Response>(http::StatusLine(500));
        }

        if (getCountPutFile() == 3)
        {
            // This during closing the document.
            LOG_TST("Third PutFile, which will succeed");

            // The document should now unload.
            TRANSITION_STATE(_phase, Phase::WaitDestroy);

            // Success.
            return nullptr;
        }

        failTest("Unexpected Phase in PutFile: " + std::to_string(static_cast<int>(_phase)));
        return nullptr;
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);
        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        return true;
    }

    /// The document is modified. Save it.
    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        TRANSITION_STATE(_phase, Phase::WaitUnmodifiedStatus);
        WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0 "
                "extendedData=CustomFlag%3DCustom%20Value%3BAnotherFlag%3DAnotherValue");

        return true;
    }

    /// The document is unmodified. Modify again.
    bool onDocumentUnmodified(const std::string& message) override
    {
        LOG_TST("Got: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitUnmodifiedStatus);

        if (getCountPutFile() <= 1)
        {
            // Modify again.
            TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);
            WSD_CMD("key type=input char=97 key=0");
            WSD_CMD("key type=up char=0 key=512");
        }
        else
        {
            LOG_ASSERT(getCountPutFile() > 1);
            LOG_TST("More than one upload attempted, closing the document");
            WSD_CMD("closedocument");
        }

        return true;
    }

    // Wait for clean unloading.
    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Destroyed dockey [" << docKey << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitDestroy);

        passTest("Document uploaded on closing as expected.");
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
            case Phase::WaitModifiedStatus:
            case Phase::WaitUnmodifiedStatus:
            case Phase::WaitDestroy:
                break;
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPIAsyncUpload_Modify(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
