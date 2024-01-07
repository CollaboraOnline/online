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

#include <string>
#include <memory>

#include <Poco/Net/HTTPRequest.h>

#include "lokassert.hpp"

class UnitWOPIDocumentConflict : public WOPIUploadConflictCommon
{
    using Base = WOPIUploadConflictCommon;

    using Base::Phase;
    using Base::Scenario;

    using Base::ConflictingDocContent;
    using Base::ModifiedOriginalDocContent;
    using Base::OriginalDocContent;

public:
    UnitWOPIDocumentConflict()
        : Base("UnitWOPIDocumentConflict", OriginalDocContent)
    {
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
            case Scenario::SaveDiscard:
            case Scenario::CloseDiscard:
            case Scenario::VerifyOverwrite:
                LOK_ASSERT_FAIL("Unexpectedly overwritting the document in storage");
                break;
            case Scenario::SaveOverwrite:
                LOG_TST("Closing the document to verify its contents after reloading");
                WSD_CMD("closedocument");
                break;
        }

        return nullptr;
    }

    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Testing " << toString(_scenario) << " with dockey [" << docKey << "] closed.");
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        std::string expectedContents;
        switch (_scenario)
        {
            case Scenario::Disconnect:
                expectedContents = ConflictingDocContent; //TODO: save-as in this case.
                break;
            case Scenario::SaveDiscard:
                expectedContents = ConflictingDocContent;
                break;
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

/// Simulate an upload timeout that precipitates a "conflict."
/// When the upload times out (i.e. takes longer than *we* expected),
/// there are really two outcomes: 1) the upload eventually was
/// successful (this case), and the document has been updated in storage,
/// or, 2) the upload fails (for whatever reason), and the
/// document is not updated in storage. Either way, since we timed out, we
/// never know the result. In case #1, the modified timestamp in
/// storage would have changed, and any subsequent upload will fail,
/// since the timestamp that we will send with subsequent uploads,
/// which represents the expected last-modify date/time, will be invalid.
/// This test simulates this particular scenario and verifies that
/// we are able to recover gracefully from it.
class UnitConflictAfterTimeoutSuccess : public WopiTestServer
{
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus, WaitUploaded, WaitDestroy)
    _phase;

    std::atomic_int _uploadAttemptCount;

    static constexpr int ConnectionTimeoutSeconds = 1;

public:
    UnitConflictAfterTimeoutSuccess()
        : WopiTestServer("UnitConflictAfterTimeoutSuccess")
        , _phase(Phase::Load)
        , _uploadAttemptCount(0)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        WopiTestServer::configure(config);

        // We intentionally fail uploading twice, so need at least 3 tries.
        config.setUInt("per_document.limit_store_failures", 3);
        config.setBool("per_document.always_save_on_exit", false);
        config.setUInt("net.connection_timeout_secs", ConnectionTimeoutSeconds); // Timeout quickly.
        config.setUInt("per_document.min_time_between_uploads_ms", 100); // Short retry interval.
    }

    std::unique_ptr<http::Response>
    assertPutFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        ++_uploadAttemptCount;
        LOG_TST("PutFile: " << _uploadAttemptCount << ", Phase: " << name(_phase));

        const std::string wopiTimestamp = request.get("X-COOL-WOPI-Timestamp", std::string());
        LOK_ASSERT_MESSAGE("Unexpected forced upload", !wopiTimestamp.empty());

        if (_uploadAttemptCount == 1)
        {
            // First attempt, timeout.
            LOG_TST("PutFile: sleeping");
            sleep(ConnectionTimeoutSeconds + 1);
        }

        // Success.
        LOG_TST("PutFile: returning success");
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

        TRANSITION_STATE(_phase, Phase::WaitUploaded);
        WSD_CMD("save dontTerminateEdit=0 dontSaveIfUnmodified=0");

        return true;
    }

    void onDocumentUploaded(bool success) override
    {
        LOG_TST("Uploaded: " << (success ? "success" : "failure"));
        LOK_ASSERT_STATE(_phase, Phase::WaitUploaded);
        LOK_ASSERT_EQUAL_MESSAGE("Expected the first upload to fail", _uploadAttemptCount == 1,
                                 !success);

        if (success)
        {
            // We are done!
            TRANSITION_STATE(_phase, Phase::WaitDestroy);

            WSD_CMD("closedocument");
        }
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
            case Phase::WaitUploaded:
            case Phase::WaitDestroy:
                break;
        }
    }
};

UnitBase** unit_create_wsd_multi(void)
{
    return new UnitBase*[3]{ new UnitWOPIDocumentConflict(), new UnitConflictAfterTimeoutSuccess(),
                             nullptr };
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
