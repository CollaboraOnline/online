/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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
            //FIXME: we exit too soon without considering always_save_on_exit.
            setExpectedPutFile(/*SaveOnExit*/ 0);
        }
        else
        {
            // With always_save_on_exit=true and limit_store_failures=LimitStoreFailures,
            // we expect exactly two PutFile requests per document.
            setExpectedPutFile(LimitStoreFailures);
        }
    }

    void assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        assertGetFileCount();

        //FIXME: check that unloading modified documents trigger test failure.
        // LOK_ASSERT_EQUAL_MESSAGE("Expected modified document detection to have triggered", true,
        //                          _unloadingModifiedDocDetected);
        _unloadingModifiedDocDetected = false; // Reset.
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        assertPutFileCount();

        const std::string wopiTimestamp = request.get("X-COOL-WOPI-Timestamp", std::string());
        const bool force = wopiTimestamp.empty(); // Without a timestamp we force to always store.

        switch (_scenario)
        {
            case Scenario::Disconnect:
                // When we disconnect, we unload the document. So SaveOnExit kicks in.
                LOK_ASSERT_EQUAL_MESSAGE("Unexpected overwritting the document in storage",
                                         SaveOnExit, force);
                break;
            case Scenario::CloseDiscard:
            case Scenario::SaveDiscard:
                break;
            case Scenario::SaveOverwrite:
            case Scenario::VerifyOverwrite:
                if (getCountPutFile() < getExpectedPutFile())
                {
                    // These are regular saves.
                    LOK_ASSERT_EQUAL_MESSAGE("Unexpected overwritting the document in storage",
                                             false, force);
                }
                else
                {
                    // The last one is the always_save_on_exit, and has to be forced.
                    LOK_ASSERT_EQUAL_MESSAGE("Expected forced overwritting the document in storage",
                                             true, force);
                }
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
    STATE_ENUM(Phase, Load, WaitLoadStatus, ModifyAndClose, WaitPutFile, Done) _phase;

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
            return Util::make_unique<http::Response>(http::StatusLine(404));
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

        TRANSITION_STATE(_phase, Phase::ModifyAndClose);

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
                break;
            case Phase::ModifyAndClose:
            {
                TRANSITION_STATE(_phase, Phase::WaitPutFile);

                WSD_CMD("key type=input char=97 key=0");
                WSD_CMD("key type=up char=0 key=512");
                WSD_CMD("closedocument");
                break;
            }
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

    std::chrono::steady_clock::time_point _eventTime;

public:
    UnitWOPIReadOnly(Scenario scenario)
        : WopiTestServer("UnitWOPIReadOnly_" + toStringShort(scenario))
        , _phase(Phase::Load)
        , _scenario(scenario)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        WopiTestServer::configure(config);

        // Make it more likely to force uploading.
        config.setBool("per_document.always_save_on_exit", true);
    }

    void configCheckFileInfo(Poco::JSON::Object::Ptr fileInfo) override
    {
        LOG_TST("CheckFileInfo: making read-only");

        fileInfo->set("UserCanWrite", "false");
        fileInfo->set("UserCanNotWriteRelative", "true");

        if (_scenario == Scenario ::Edit)
        {
            // An extension that doesn't allow commenting. By omitting this,
            // we allow commenting and consider the document editable.
            fileInfo->set("BaseFileName", "doc.odt");
        }
        else if (_scenario == Scenario ::ViewWithComment)
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
                    TRANSITION_STATE(_phase, Phase::WaitDocClose);
                    _eventTime = std::chrono::steady_clock::now();
                    LOG_TST("Saving the document");
                    WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0");
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

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase* [6]
    {
        new UnitWOPIExpiredToken(), new UnitWOPIFailUpload(),
            new UnitWOPIReadOnly(UnitWOPIReadOnly::Scenario::ViewWithComment),
            new UnitWOPIReadOnly(UnitWOPIReadOnly::Scenario::Edit),
    };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
