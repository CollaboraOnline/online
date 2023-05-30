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

class UnitWOPISaveOnExit : public WOPIUploadConflictCommon
{
    using Base = WOPIUploadConflictCommon;

    using Base::Phase;
    using Base::Scenario;

    using Base::ConflictingDocContent;
    using Base::ModifiedOriginalDocContent;
    using Base::OriginalDocContent;

public:
    UnitWOPISaveOnExit()
        : Base("UnitWOPISaveOnExit", OriginalDocContent)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        Base::configure(config);

        // Small value to shorten the test run time.
        config.setUInt("per_document.limit_store_failures", 2);
        config.setBool("per_document.always_save_on_exit", true);
    }

    std::unique_ptr<http::Response>
    assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        assertGetFileCount();

        return nullptr; // Success.
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        assertPutFileCount();

        switch (_scenario)
        {
            case Scenario::Disconnect:
                LOG_TST("Clobbered in the disconnect scenario");
                break;
            case Scenario::SaveDiscard:
            case Scenario::CloseDiscard:
            case Scenario::VerifyOverwrite:
                break;
            case Scenario::SaveOverwrite:
                if (getCountPutFile() < 3)
                {
                    // The first two times the content should be the conflicting one.
                    LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage",
                                             std::string(ConflictingDocContent), getFileContent());
                }
                else
                {
                    // The second time will overwrite with the modified content.
                    LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage",
                                             std::string(ModifiedOriginalDocContent),
                                             getFileContent());
                }
                break;
        }

        return nullptr;
    }

    void onDocBrokerCreate(const std::string& docKey) override
    {
        Base::onDocBrokerCreate(docKey);

        if (_scenario == Scenario::SaveOverwrite)
        {
            // When overwriting, we will do so thrice.
            // Once to find out that we have a conflict and another
            // to force overwriting it. Finally, always_save_on_exit.
            setExpectedPutFile(3);
        }
        else
        {
            // With always_save_on_exit, we expect exactly one PutFile per document.
            setExpectedPutFile(1);
        }
    }

    void onDocumentUploaded(bool success) override
    {
        LOG_TST("Uploaded: " << (success ? "success" : "failure"));

        switch (_scenario)
        {
            case Scenario::Disconnect:
            case Scenario::SaveDiscard:
            case Scenario::CloseDiscard:
            case Scenario::VerifyOverwrite:
                break;
            case Scenario::SaveOverwrite:
                if (getCountPutFile() == 2)
                {
                    LOG_TST("Closing the document to verify its contents after reloading");
                    WSD_CMD("closedocument");
                }
                break;
        }
    }

    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Testing " << toString(_scenario) << " with dockey [" << docKey << "] closed.");
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        std::string expectedContents;
        switch (_scenario)
        {
            case Scenario::Disconnect:
            case Scenario::SaveDiscard:
            case Scenario::CloseDiscard:
                expectedContents = ConflictingDocContent;
                break;
            case Scenario::SaveOverwrite:
                expectedContents = ModifiedOriginalDocContent;
                break;
            case Scenario::VerifyOverwrite:
                expectedContents = OriginalDocContent;
                break;
        }

        LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage", expectedContents,
                                 getFileContent());

        Base::onDocBrokerDestroy(docKey);
    }
};

/// Test Async uploading with always_save_on_exit.
/// The test verifies the headers only.
/// Load, Save, Upload -> verify IsModifiedByUser=false.
class UnitSaveOnExitUnmodified : public WopiTestServer
{
    using Base = WopiTestServer;

    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitPutFile, WaitDestroy, Done)
    _phase;

public:
    UnitSaveOnExitUnmodified()
        : WopiTestServer("UnitSaveOnExitUnmodified")
        , _phase(Phase::Load)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        WopiTestServer::configure(config);

        // Make it more likely to force uploading.
        config.setBool("per_document.always_save_on_exit", true);
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        LOG_TST("Checking X-COOL-WOPI headers");

        // No modifications.
        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsModifiedByUser"));
        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-LOOL-WOPI-IsModifiedByUser"));

        // Closing, no auto-save expected.
        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsAutosave"));
        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-LOOL-WOPI-IsAutosave"));

        // Exiting, certainly.
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsExitSave"));
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-LOOL-WOPI-IsExitSave"));

        TRANSITION_STATE(_phase, Phase::WaitDestroy);
        return nullptr;
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::WaitPutFile);
        WSD_CMD("closedocument");

        return true;
    }

    void onDocumentUploaded(bool success) override
    {
        LOK_ASSERT_MESSAGE("Upload failed unexpectedly", success);
        LOK_ASSERT_STATE(_phase, Phase::WaitDestroy);
    }

    // Wait for clean unloading.
    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Destroyed dockey [" << docKey << "] closed");
        LOK_ASSERT_STATE(_phase, Phase::WaitDestroy);

        TRANSITION_STATE(_phase, Phase::Done);
        passTest("Document uploaded on closing as expected");

        Base::onDocBrokerDestroy(docKey);
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
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase* [3] { new UnitWOPISaveOnExit(), new UnitSaveOnExitUnmodified(), nullptr };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
