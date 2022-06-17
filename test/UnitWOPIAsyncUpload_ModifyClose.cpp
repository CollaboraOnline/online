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

/// Test Saving and Async uploading after modifying and immediately closing.
/// We modify the document and close immediately.
class UnitWOPIAsyncUpload_ModifyClose : public WopiTestServer
{
    enum class Phase
    {
        Load,
        WaitLoadStatus,
        ModifyAndClose,
        WaitPutFile,
        Polling
    } _phase;

public:
    UnitWOPIAsyncUpload_ModifyClose()
        : WopiTestServer("UnitWOPIAsyncUpload_ModifyClose")
        , _phase(Phase::Load)
    {
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        // Expect PutFile after closing, since the document is modified.
        if (_phase == Phase::WaitPutFile)
        {
            LOG_TST("assertPutFileRequest: First PutFile, which will fail");

            LOG_TST("WaitPutFile => Polling");
            _phase = Phase::Polling;

            // We requested the save.
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsAutosave"));

            if (request.get("X-COOL-WOPI-IsModifiedByUser") != "true")
            {
                // There is a race when closing the document right after modifying,
                // so the modified flag may not be set, but there should be no data
                // loss, as this test demonstrates.
                LOG_TST("WARNING: file is not marked as modified");
            }

            passTest("Document uploaded on closing as expected.");

            return Util::make_unique<http::Response>(http::StatusLine(200));
        }

        // This during closing the document.
        LOG_TST("assertPutFileRequest: Second PutFile, unexpected");

        failTest("PutFile multiple times.");

        return nullptr;
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitLoadStatus",
                           _phase == Phase::WaitLoadStatus);

        LOG_TST("onDocumentModified: Switching to Phase::WaitLoadStatus, SavingPhase::Modify");
        _phase = Phase::ModifyAndClose;

        SocketPoll::wakeupWorld();
        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                LOG_TST("Load => WaitLoadStatus");
                _phase = Phase::WaitLoadStatus;

                LOG_TST("Load: initWebsocket.");
                initWebsocket("/wopi/files/0?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
                break;
            }
            case Phase::WaitLoadStatus:
                break;
            case Phase::ModifyAndClose:
            {
                LOG_TST("ModifyAndClose => WaitPutFile");
                _phase = Phase::WaitPutFile;

                WSD_CMD("key type=input char=97 key=0");
                WSD_CMD("key type=up char=0 key=512");
                WSD_CMD("closedocument");
                break;
            }
            case Phase::WaitPutFile:
            case Phase::Polling:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPIAsyncUpload_ModifyClose(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
