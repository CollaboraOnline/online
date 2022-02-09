/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "WOPIUploadConflictCommon.hpp"

#include <string>
#include <memory>

#include <Poco/Net/HTTPRequest.h>

#include "Util.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"
#include "helpers.hpp"
#include "lokassert.hpp"

/// This test simulates a permanently-failing upload.
class UnitWOPIFailUpload : public WOPIUploadConflictCommon
{
    using WOPIUploadConflictCommon::Phase;
    using WOPIUploadConflictCommon::Scenario;

    using WOPIUploadConflictCommon::OriginalDocContent;

    bool _unloadingModifiedDocDetected;

public:
    UnitWOPIFailUpload()
        : WOPIUploadConflictCommon("UnitWOPIFailUpload", OriginalDocContent)
        , _unloadingModifiedDocDetected(true)
    {
        setTimeout(std::chrono::seconds(60));
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        WopiTestServer::configure(config);

        // Small value to shorten the test run time.
        config.setUInt("per_document.limit_store_failures", 2);
        config.setBool("per_document.always_save_on_exit", true);
    }

    void assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        //FIXME: check that unloading modified documents trigger test failure.
        // LOK_ASSERT_EQUAL_MESSAGE("Expected modified document detection to have triggered", true,
        //                          _unloadingModifiedDocDetected);
        _unloadingModifiedDocDetected = false;
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        switch (_scenario)
        {
            case Scenario::Disconnect:
            case Scenario::SaveDiscard:
            case Scenario::CloseDiscard:
            case Scenario::VerifyOverwrite:
                break;
            case Scenario::SaveOverwrite:
                WSD_CMD("closedocument");
                break;
        }

        // Internal Server Error.
        return Util::make_unique<http::Response>(http::StatusLine(500));
    }

    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("Testing " << toString(_scenario) << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        TRANSITION_STATE(_phase, Phase::WaitDocClose);

        switch (_scenario)
        {
            case Scenario::Disconnect:
                LOG_TST("Disconnecting");
                deleteSocketAt(0);
                break;
            case Scenario::SaveDiscard:
            case Scenario::SaveOverwrite:
                // Save the document; wsd should detect now that document has
                // been changed underneath it and send us:
                // "error: cmd=storage kind=documentconflict"
                LOG_TST("Saving the document");
                WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0");
                break;
            case Scenario::CloseDiscard:
                // Close the document; wsd should detect now that document has
                // been changed underneath it and send us:
                // "error: cmd=storage kind=documentconflict"
                LOG_TST("Closing the document");
                WSD_CMD("closedocument");
                break;
            case Scenario::VerifyOverwrite:
                LOK_ASSERT_FAIL("Unexpected modification in " + toString(_scenario));
                break;
        }

        return true;
    }

    bool onDocumentError(const std::string& message) override
    {
        LOG_TST("Testing " << toString(_scenario) << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        LOK_ASSERT_MESSAGE("Expect only savefailed errors",
                           message == "error: cmd=storage kind=savefailed");

        switch (_scenario)
        {
            case Scenario::Disconnect:
                LOK_ASSERT_FAIL("We can't possibly get anything after disconnecting");
                break;
            case Scenario::SaveDiscard:
            case Scenario::CloseDiscard:
                LOG_TST("Discarding own changes via closedocument");
                WSD_CMD("closedocument");
                break;
            case Scenario::SaveOverwrite:
                LOG_TST("Overwriting with own version via savetostorage");
                WSD_CMD("savetostorage force=1");
                break;
            case Scenario::VerifyOverwrite:
                LOK_ASSERT_FAIL("Unexpected error in " + toString(_scenario));
                break;
        }

        return true;
    }

    // Called when we have modified document data at exit.
    void fail(const std::string& reason) override
    {
        LOG_TST("Modified document being unloaded: " << reason);

        // We expect this to happen only with the disonnection test,
        // because only in that case there is no user input.
        LOK_ASSERT_MESSAGE("Expected reason to be 'Unsaved data detected'",
                           Util::startsWith(reason, "Unsaved data detected"));
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitDocClose but was " + toString(_phase),
                           _phase == Phase::WaitDocClose);
        _unloadingModifiedDocDetected = true;
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPIFailUpload(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
