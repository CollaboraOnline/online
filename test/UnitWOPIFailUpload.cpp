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

#include "WOPIUploadConflictCommon.hpp"

#include <chrono>
#include <string>
#include <memory>

#include <Poco/Net/HTTPRequest.h>

#include "Util.hpp"
#include "Log.hpp"
#include "UnitHTTP.hpp"
#include "helpers.hpp"
#include "lokassert.hpp"

/// This test simulates a permanently-failing upload.
class UnitWOPIFailUpload : public WOPIUploadConflictCommon
{
    using Base = WOPIUploadConflictCommon;

    using Base::Phase;
    using Base::Scenario;

    using Base::OriginalDocContent;

    bool _unloadingModifiedDocDetected;

    static constexpr std::size_t LimitStoreFailures = 2;
    static constexpr bool SaveOnExit = true;

public:
    UnitWOPIFailUpload()
        : Base("UnitWOPIFailUpload", OriginalDocContent)
        , _unloadingModifiedDocDetected(true)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        Base::configure(config);

        // Small value to shorten the test run time.
        config.setUInt("per_document.limit_store_failures", LimitStoreFailures);
        config.setBool("per_document.always_save_on_exit", SaveOnExit);
    }

    void onDocBrokerCreate(const std::string& docKey) override
    {
        Base::onDocBrokerCreate(docKey);

        if (_scenario == Scenario::VerifyOverwrite)
        {
            // By default, we don't upload when verifying (unless always_save_on_exit is set).
            setExpectedPutFile(SaveOnExit ? 2 : 0);
        }
        else
        {
            // With always_save_on_exit=true and limit_store_failures=LimitStoreFailures,
            // we expect exactly two PutFile requests per document.
            setExpectedPutFile(LimitStoreFailures);
        }
    }

    std::unique_ptr<http::Response>
    assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        assertGetFileCount();

        //FIXME: check that unloading modified documents trigger test failure.
        // LOK_ASSERT_EQUAL_MESSAGE("Expected modified document detection to have triggered", true,
        //                          _unloadingModifiedDocDetected);
        _unloadingModifiedDocDetected = false; // Reset.

        return nullptr; // Success.
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        assertPutFileCount();

        const std::string wopiTimestamp = request.get("X-COOL-WOPI-Timestamp", std::string());
        const bool force = wopiTimestamp.empty(); // Without a timestamp we force to always store.

        // We don't expect overwriting by forced uploading.
        LOK_ASSERT_EQUAL_MESSAGE("Unexpected overwritting the document in storage", false, force);

        // Internal Server Error.
        return std::make_unique<http::Response>(http::StatusCode::InternalServerError);
    }

    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("Testing " << toString(_scenario) << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        TRANSITION_STATE(_phase, Phase::WaitDocClose);

        switch (_scenario)
        {
            case Scenario::Disconnect:
                // Just disconnect.
                LOG_TST("Disconnecting");
                deleteSocketAt(0);
                break;
            case Scenario::SaveDiscard:
            case Scenario::SaveOverwrite:
                // Save the document.
                LOG_TST("Saving the document");
                WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0");
                break;
            case Scenario::CloseDiscard:
                // Close the document.
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

        LOK_ASSERT_EQUAL_MESSAGE("Expect only documentconflict errors",
                                 std::string("error: cmd=storage kind=savefailed"), message);

        // Close the document.
        LOG_TST("Closing the document");
        WSD_CMD("closedocument");

        return true;
    }

    // Called when we have modified document data at exit.
    bool onDataLoss(const std::string& reason) override
    {
        LOG_TST("Modified document being unloaded: " << reason);

        // We expect this to happen only with the disonnection test,
        // because only in that case there is no user input.
        LOK_ASSERT_MESSAGE("Expected reason to be 'Data-loss detected'",
                           Util::startsWith(reason, "Data-loss detected"));
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitDocClose but was " + toString(_phase),
                           _phase == Phase::WaitDocClose);
        _unloadingModifiedDocDetected = true;

        return failed();
    }

    // Wait for clean unloading.
    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Testing " << toString(_scenario) << " with dockey [" << docKey << "] closed.");
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        // Uploading fails and we can't have anything but the original.
        LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage", std::string(OriginalDocContent),
                                 getFileContent());

        Base::onDocBrokerDestroy(docKey);
    }
};

/// This test simulates an expired token when uploading.
class UnitWOPIExpiredToken : public WopiTestServer
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitPutFile, Done) _phase;

public:
    UnitWOPIExpiredToken()
        : WopiTestServer("UnitWOPIExpiredToken")
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

            TRANSITION_STATE(_phase, Phase::Done);

            // We requested the save.
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsAutosave"));

            LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsModifiedByUser"));

            // File unknown/User unauthorized.
            return std::make_unique<http::Response>(http::StatusCode::NotFound);
        }

        // This during closing the document.
        LOG_TST("assertPutFileRequest: Second PutFile, unexpected");

        LOK_ASSERT_FAIL("PutFile multiple times.");
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

    bool onDataLoss(const std::string& reason) override
    {
        LOG_TST("Modified document being unloaded: " << reason);

        // We expect this to happen, because there should be
        // no upload attempts with expired tockens. And we
        // only have one session.
        LOK_ASSERT_MESSAGE("Expected reason to be 'Data-loss detected'",
                           Util::startsWith(reason, "Data-loss detected"));
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitDocClose but was " + toString(_phase),
                           _phase == Phase::Done);

        passTest("Data-loss detected as expected");
        return failed();
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                LOG_TST("Load: initWebsocket.");
                initWebsocket("/wopi/files/" + getTestname() + "?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
                break;
            }
            case Phase::WaitLoadStatus:
            case Phase::WaitPutFile:
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

/// This test simulates a modified read-only document.
class UnitWOPIReadOnly : public WopiTestServer
{
public:
    STATE_ENUM(Scenario, Edit, ViewWithComment);

private:
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus, WaitDocClose, Done) _phase;

    const Scenario _scenario;
    const bool _disconnect;

    std::chrono::steady_clock::time_point _eventTime;

public:
    UnitWOPIReadOnly(Scenario scenario, bool disconnect)
        : WopiTestServer("UnitWOPIReadOnly_" + toStringShort(scenario) + (disconnect ? "_X" : ""))
        , _phase(Phase::Load)
        , _scenario(scenario)
        , _disconnect(disconnect)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        WopiTestServer::configure(config);

        // Make it more likely to force uploading.
        config.setBool("per_document.always_save_on_exit", true);
    }

    void configCheckFileInfo(const Poco::Net::HTTPRequest& /*request*/,
                             Poco::JSON::Object::Ptr& fileInfo) override
    {
        LOG_TST("CheckFileInfo: making read-only for " << name(_scenario));

        fileInfo->set("UserCanWrite", "false");
        fileInfo->set("UserCanNotWriteRelative", "true");

        if (_scenario == Scenario::Edit)
        {
            // An extension that doesn't allow commenting. By omitting this,
            // we allow commenting and consider the document editable.
            fileInfo->set("BaseFileName", "doc.odt");
        }
        else if (_scenario == Scenario::ViewWithComment)
        {
            // An extension that allows commenting.
            fileInfo->set("BaseFileName", "doc.pdf");
        }
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        // Unexpected on a read-only doc.
        failTest("PutFile on a read-only document");

        return nullptr;
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        // Update before transitioning, to avoid triggering immediately.
        _eventTime = std::chrono::steady_clock::now();
        TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        return true;
    }

    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("Modified: [" << message << ']');
        failTest("Modified read-only document");

        return failed();
    }

    bool onDataLoss(const std::string& reason) override
    {
        LOG_TST("Data-loss in " << name(_phase) << ": " << reason);

        // We expect this to happen, since we can't upload the document.
        LOK_ASSERT_MESSAGE("Expected reason to be 'Data-loss detected'",
                           Util::startsWith(reason, "Data-loss detected"));

        failTest("Data-loss detected");

        return failed();
    }

    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Destroyed dockey [" << docKey << ']');
        LOK_ASSERT_STATE(_phase, Phase::Done);

        passTest("No modification or unexpected PutFile on read-only doc");
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                LOG_TST("Load: initWebsocket.");
                initWebsocket("/wopi/files/" + getTestname() + "?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
                break;
            }
            case Phase::WaitLoadStatus:
                break;
            case Phase::WaitModifiedStatus:
            {
                // Wait for the modified status (and fail) in onDocumentModified.
                // Otherwise, save the document and wait for upload.
                const auto now = std::chrono::steady_clock::now();
                const auto elapsed =
                    std::chrono::duration_cast<std::chrono::milliseconds>(now - _eventTime);
                if (elapsed >= std::chrono::seconds(2))
                {
                    LOG_TST("No modified status on read-only document after waiting for "
                            << elapsed);
                    _eventTime = std::chrono::steady_clock::now();

                    if (_disconnect)
                    {
                        TRANSITION_STATE(_phase, Phase::Done);
                        deleteSocketAt(0);
                    }
                    else
                    {
                        TRANSITION_STATE(_phase, Phase::WaitDocClose);
                        LOG_TST("Saving the document");
                        WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0");
                    }
                }
            }
            break;
            case Phase::WaitDocClose:
            {
                // Wait for the upload post saving (and fail) in assertPutFileRequest.
                // Otherwise, close the document and wait for upload.
                const auto now = std::chrono::steady_clock::now();
                const auto elapsed =
                    std::chrono::duration_cast<std::chrono::milliseconds>(now - _eventTime);
                if (elapsed >= std::chrono::seconds(2))
                {
                    LOG_TST("No upload on read-only document after waiting for " << elapsed);
                    TRANSITION_STATE(_phase, Phase::Done);
                    WSD_CMD("closedocument");
                }
            }
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

/// Test Async uploading with simulated failing.
/// We modify the document, save, and attempt to upload,
/// which fails. We then modify the document again
/// and save. We expect another upload attempt,
/// which will succeed.
/// Modify, Save, Upload fails.
/// Modify, Save, Upload fails, close -> Upload.
class UnitFailUploadModified : public WopiTestServer
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus, WaitUnmodifiedStatus, WaitDestroy)
    _phase;

public:
    UnitFailUploadModified()
        : WopiTestServer("UnitFailUploadModified")
        , _phase(Phase::Load)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        WopiTestServer::configure(config);

        // We intentionally fail uploading twice, so need at least 3 tries.
        config.setUInt("per_document.limit_store_failures", 3);
        config.setBool("per_document.always_save_on_exit", false);
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        LOK_ASSERT_MESSAGE("Too many PutFile attempts", getCountPutFile() <= 3);

        // The document is modified.
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsModifiedByUser"));
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-LOOL-WOPI-IsModifiedByUser"));

        // Triggered manually or during closing, not auto-save.
        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsAutosave"));
        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-LOOL-WOPI-IsAutosave"));

        if (getCountPutFile() < 3)
        {
            // Certainly not exiting yet.
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsExitSave"));
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-LOOL-WOPI-IsExitSave"));
        }
        else
        {
            // Only on the last (third) attempt we exit.
            LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsExitSave"));
            LOK_ASSERT_EQUAL(std::string("true"), request.get("X-LOOL-WOPI-IsExitSave"));
        }

        LOK_ASSERT_MESSAGE("Unexpected phase", _phase == Phase::WaitModifiedStatus ||
                                                   _phase == Phase::WaitUnmodifiedStatus);

        // We save twice. First right after loading, unmodified.
        if (getCountPutFile() == 1)
        {
            LOG_TST("First PutFile, which will fail");

            // Fail with error.
            LOG_TST("Simulate PutFile failure");
            return std::make_unique<http::Response>(http::StatusCode::InternalServerError);
        }

        if (getCountPutFile() == 2)
        {
            LOG_TST("Second PutFile, which will also fail");

            LOG_TST("Simulate PutFile failure (again)");
            return std::make_unique<http::Response>(http::StatusCode::InternalServerError);
        }

        if (getCountPutFile() == 3)
        {
            // This is during closing the document.
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

/// Test Async uploading with simulated failing.
/// We modify the document, save, and attempt to upload,
/// which fails. We close the document and verify
/// that the document is uploaded upon closing.
/// Modify, Save, Upload fails, close -> Upload.
class UnitFailUploadClose : public WopiTestServer
{
    using Base = WopiTestServer;

    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus, WaitFirstPutFile, WaitSecondPutFile,
               Done)
    _phase;

public:
    UnitFailUploadClose()
        : WopiTestServer("UnitFailUploadClose")
        , _phase(Phase::Load)
    {
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsModifiedByUser"));
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-LOOL-WOPI-IsModifiedByUser"));

        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsAutosave"));
        LOK_ASSERT_EQUAL(std::string("false"), request.get("X-LOOL-WOPI-IsAutosave"));

        // We save twice. First right after loading, unmodified.
        if (_phase == Phase::WaitFirstPutFile)
        {
            LOG_TST("assertPutFileRequest: First PutFile, which will fail");

            // Certainly not exiting yet.
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-COOL-WOPI-IsExitSave"));
            LOK_ASSERT_EQUAL(std::string("false"), request.get("X-LOOL-WOPI-IsExitSave"));

            // Fail with error.
            LOG_TST("Returning 500 to simulate PutFile failure");
            return std::make_unique<http::Response>(http::StatusCode::InternalServerError);
        }

        // This during closing the document.
        LOG_TST("assertPutFileRequest: Second PutFile, which will succeed");
        LOK_ASSERT_STATE(_phase, Phase::WaitSecondPutFile);

        // Triggered while closing.
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-COOL-WOPI-IsExitSave"));
        LOK_ASSERT_EQUAL(std::string("true"), request.get("X-LOOL-WOPI-IsExitSave"));

        return nullptr;
    }

    /// The document is loaded.
    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        return true;
    }

    /// The document is modified. Save it.
    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("onDocumentModified: [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        TRANSITION_STATE(_phase, Phase::WaitFirstPutFile);

        WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0 "
                "extendedData=CustomFlag%3DCustom%20Value%3BAnotherFlag%3DAnotherValue");

        return true;
    }

    void onDocumentUploaded(bool success) override
    {
        LOG_TST("Uploaded: " << (success ? "success" : "failure"));

        if (_phase == Phase::WaitFirstPutFile)
        {
            TRANSITION_STATE(_phase, Phase::WaitSecondPutFile);

            WSD_CMD("closedocument");
        }
    }

    // Wait for clean unloading.
    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Destroyed dockey [" << docKey << "] closed.");
        LOK_ASSERT_STATE(_phase, Phase::WaitSecondPutFile);

        TRANSITION_STATE(_phase, Phase::Done);
        passTest("Document uploaded on closing as expected.");

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
            case Phase::WaitModifiedStatus:
            case Phase::WaitFirstPutFile:
            case Phase::WaitSecondPutFile:
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
    return new UnitBase* [9]
    {
        new UnitWOPIExpiredToken(), new UnitWOPIFailUpload(),
            new UnitWOPIReadOnly(UnitWOPIReadOnly::Scenario::ViewWithComment, /*disconnect=*/false),
            new UnitWOPIReadOnly(UnitWOPIReadOnly::Scenario::Edit, /*disconnect=*/false),
            new UnitWOPIReadOnly(UnitWOPIReadOnly::Scenario::ViewWithComment, /*disconnect=*/true),
            new UnitWOPIReadOnly(UnitWOPIReadOnly::Scenario::Edit, /*disconnect=*/true),
            new UnitFailUploadModified(), new UnitFailUploadClose(), nullptr
    };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
