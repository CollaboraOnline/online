/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <string>
#include <memory>

#include <Poco/Net/HTTPRequest.h>

#include "WopiTestServer.hpp"

/**
 * This is a base class with a number of test cases which assert that the
 * unsaved changes in the opened document are discarded in case document
 * is changed in storage behind our back. We don't want to overwrite
 * the document which is in storage when the user asks us to
 * upload to storage, without giving the user the opportunity to decide.
 *
 * There are multiple scenarios to test.
 *
 * The way this works is as follows:
 * 1. Load a document.
 * 2. When we get 'status:' in onFilterSendMessage, we modify it.
 * 3. Simulate content-change in storage and attempt to save it.
 *  4a. Disconnect and the modified data must be discarded.
 *  4b. Save and, on getting the documentconflict error, discard.
 *  4c. Close and, on getting the documentconflict error, discard.
 *  4d. Save and, on getting the documentconflict error, overwrite.
 * 5. Load the document again and verify the expected contents.
 * 6. Move to the next test scenario.
 */

class WOPIUploadConflictCommon : public WopiTestServer
{
private:
    std::size_t _expectedCheckFileInfo;
    std::size_t _expectedGetFile;
    std::size_t _expectedPutRelative;
    std::size_t _expectedPutFile;

protected:
    STATES_ENUM(Phase, _phase, Load, WaitLoadStatus, WaitModifiedStatus, WaitDocClose);

    /// The different test scenarios. All but VerifyOverwrite modify the document.
    STATES_ENUM(Scenario, _scenario, Disconnect, SaveDiscard, CloseDiscard, SaveOverwrite,
                VerifyOverwrite);

    static constexpr auto OriginalDocContent = "Original contents";
    static constexpr auto ModifiedOriginalDocContent = "\ufeffaOriginal contents\n";
    static constexpr auto ConflictingDocContent = "Modified in-storage contents";

    std::size_t getExpectedCheckFileInfo() const { return _expectedCheckFileInfo; }
    void incExpectedCheckFileInfo()
    {
        ++_expectedCheckFileInfo;
        LOG_TST("Expecting " << _expectedCheckFileInfo << " CheckFileInfo requests.");
    }

    std::size_t getExpectedGetFile() const { return _expectedGetFile; }
    void incExpectedGetFile()
    {
        ++_expectedGetFile;
        LOG_TST("Expecting " << _expectedGetFile << " GetFile requests.");
    }

    std::size_t getExpectedPutRelative() const { return _expectedPutRelative; }
    void incExpectedPutRelative()
    {
        ++_expectedPutRelative;
        LOG_TST("Expecting " << _expectedPutRelative << " PutRelative requests.");
    }

    std::size_t getExpectedPutFile() const { return _expectedPutFile; }
    void incExpectedPutFile()
    {
        ++_expectedPutFile;
        LOG_TST("Expecting " << _expectedPutFile << " PutFile requests.");
    }

public:
    WOPIUploadConflictCommon(std::string testname, const std::string& fileContent)
        : WopiTestServer(std::move(testname), fileContent)
        , _expectedCheckFileInfo(0)
        , _expectedGetFile(0)
        , _expectedPutRelative(0)
        , _expectedPutFile(0)
        , _phase(Phase::Load)
        , _scenario(Scenario::Disconnect)
    {
        // We have multiple scenarios to cover.
        setTimeout(std::chrono::seconds(90));
    }

    void assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        // Note: the expected contents for each scenario
        // is the result of the *previous* phase!
        std::string expectedContents;
        switch (_scenario)
        {
            case Scenario::Disconnect:
                expectedContents = OriginalDocContent;
                break;
            case Scenario::SaveDiscard:
                expectedContents = ConflictingDocContent;
                break;
            case Scenario::CloseDiscard:
            case Scenario::SaveOverwrite:
                LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage",
                                         std::string(ConflictingDocContent), getFileContent());
                setFileContent(OriginalDocContent); // Reset to test overwriting.
                expectedContents = OriginalDocContent;
                break;
            case Scenario::VerifyOverwrite:
                expectedContents = ModifiedOriginalDocContent;
                break;
        }

        LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage", expectedContents,
                                 getFileContent());
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
                LOK_ASSERT_FAIL("Unexpectedly overwritting the document in storage");
                break;
            case Scenario::SaveOverwrite:
                LOK_ASSERT_EQUAL_MESSAGE("Unexpected contents in storage",
                                         std::string(ModifiedOriginalDocContent), getFileContent());
                LOG_TST("Closing the document to verify its contents after reloading");
                WSD_CMD("closedocument");
                break;
        }

        return nullptr;
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("Testing " << toString(_scenario) << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitLoadStatus);

        if (_scenario != Scenario::VerifyOverwrite)
        {
            LOG_TST("Modifying the document");
            TRANSITION_STATE(_phase, Phase::WaitModifiedStatus);

            // modify the currently opened document; type 'a'
            WSD_CMD("key type=input char=97 key=0");
            WSD_CMD("key type=up char=0 key=512");
        }
        else
        {
            LOG_TST("Closing the document to finish testing");
            TRANSITION_STATE_MSG(_phase, Phase::WaitDocClose, "Skipping modifications");
            WSD_CMD("closedocument");
        }

        return true;
    }

    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("Testing " << toString(_scenario) << ": [" << message << ']');
        LOK_ASSERT_STATE(_phase, Phase::WaitModifiedStatus);

        // Change the underlying document in storage.
        LOG_TST("Changing document contents in storage");
        setFileContent(ConflictingDocContent);

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

        LOK_ASSERT_MESSAGE("Expect only documentconflict errors",
                           message == "error: cmd=storage kind=documentconflict");

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
        // We expect this to happen only with the disonnection test,
        // because only in that case there is no user input.
        LOK_ASSERT_MESSAGE("Expected reason to be 'Unsaved data detected'",
                           Util::startsWith(reason, "Unsaved data detected"));
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitDocClose but was " + toString(_phase),
                           _phase == Phase::WaitDocClose);
        LOK_ASSERT_MESSAGE("Expected to be in Scenario::Disconnect but was " + toString(_scenario),
                           _scenario == Scenario::Disconnect);
    }

    // Wait for clean unloading.
    void onDocBrokerDestroy(const std::string& docKey) override
    {
        LOG_TST("Testing " << toString(_scenario) << " with dockey [" << docKey << "] closed.");
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        switch (_scenario)
        {
            case Scenario::Disconnect:
                TRANSITION_STATE(_scenario, Scenario::SaveDiscard);
                break;
            case Scenario::SaveDiscard:
                TRANSITION_STATE(_scenario, Scenario::CloseDiscard);
                break;
            case Scenario::CloseDiscard:
                TRANSITION_STATE(_scenario, Scenario::SaveOverwrite);
                break;
            case Scenario::SaveOverwrite:
                TRANSITION_STATE(_scenario, Scenario::VerifyOverwrite);
                break;
            case Scenario::VerifyOverwrite:
                passTest("Finished all test scenarios without issues");
                break;
        }

        TRANSITION_STATE(_phase, Phase::Load);
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                LOG_TST("Loading the document for " << toString(_scenario));

                TRANSITION_STATE(_phase, Phase::WaitLoadStatus);

                initWebsocket("/wopi/files/0?access_token=anything");
                WSD_CMD("load url=" + getWopiSrc());
            }
            break;
            case Phase::WaitLoadStatus:
            {
            }
            break;
            case Phase::WaitModifiedStatus:
            {
            }
            break;
            case Phase::WaitDocClose:
            {
            }
            break;
        }
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
