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
 * 2. When we get 'status:' in onFilterSendWebSocketMessage, we modify it.
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
    STATE_ENUM(Phase, Load, WaitLoadStatus, WaitModifiedStatus, WaitDocClose) _phase;

    /// The different test scenarios. All but VerifyOverwrite modify the document.
    STATE_ENUM(Scenario, Disconnect, SaveDiscard, CloseDiscard, SaveOverwrite, VerifyOverwrite)
    _scenario;

    static constexpr auto OriginalDocContent = "Original contents";
    static constexpr auto ModifiedOriginalDocContent = "\ufeffaOriginal contents\n";
    static constexpr auto ConflictingDocContent = "Modified in-storage contents";

    std::size_t getExpectedCheckFileInfo() const { return _expectedCheckFileInfo; }
    void setExpectedCheckFileInfo(std::size_t value)
    {
        _expectedCheckFileInfo = value;
        LOG_TST("Expecting " << _expectedCheckFileInfo << " CheckFileInfo requests.");
    }

    std::size_t getExpectedGetFile() const { return _expectedGetFile; }
    void setExpectedGetFile(std::size_t value)
    {
        _expectedGetFile = value;
        LOG_TST("Expecting " << _expectedGetFile << " GetFile requests.");
    }

    std::size_t getExpectedPutRelative() const { return _expectedPutRelative; }
    void setExpectedPutRelative(std::size_t value)
    {
        _expectedPutRelative = value;
        LOG_TST("Expecting " << _expectedPutRelative << " PutRelative requests.");
    }

    std::size_t getExpectedPutFile() const { return _expectedPutFile; }
    void setExpectedPutFile(std::size_t value)
    {
        _expectedPutFile = value;
        LOG_TST("Expecting " << _expectedPutFile << " PutFile requests.");
    }

public:
    WOPIUploadConflictCommon(std::string name, const std::string& fileContent)
        : WopiTestServer(std::move(name), fileContent)
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

    void onDocBrokerCreate(const std::string&) override
    {
        LOG_TST("Testing " << toString(_scenario) << ": resetting the document in storage");
        setFileContent(OriginalDocContent); // Reset to test overwriting.

        resetCountCheckFileInfo();
        resetCountGetFile();
        setExpectedGetFile(1); // All the test GetFile once.

        resetCountPutFile();

        // We always load once per scenario.
        setExpectedCheckFileInfo(1);
        setExpectedGetFile(1);
        setExpectedPutRelative(0); // No renaming in these tests.

        if (_scenario == Scenario::VerifyOverwrite)
        {
            // By default, we don't upload when verifying (unless always_save_on_exit is set).
            setExpectedPutFile(0);
        }
        else if (_scenario == Scenario::Disconnect || _scenario == Scenario::SaveDiscard ||
                 _scenario == Scenario::CloseDiscard)
        {
            // When there is no client connected, there is no way
            // to decide how to resolve the conflict externally.
            // So we quarantine and let it be.
            // Similarly, when the client decides to discard changes.
            setExpectedPutFile(1);
        }
        else
        {
            // With conflicts, we typically do two PutFile requests.
            setExpectedPutFile(2);
        }
    }

    void assertGetFileCount()
    {
        if (getExpectedCheckFileInfo() < getCountCheckFileInfo())
        {
            LOK_ASSERT_EQUAL_MESSAGE("Too many CheckFileInfo requests", getExpectedCheckFileInfo(),
                                     getCountCheckFileInfo());
        }

        if (getExpectedGetFile() < getCountGetFile())
        {
            LOK_ASSERT_EQUAL_MESSAGE("Too many GetFile requests", getExpectedGetFile(),
                                     getCountGetFile());
        }
    }

    void assertPutFileCount()
    {
        LOG_TST("Testing " << toString(_scenario));
        LOK_ASSERT_STATE(_phase, Phase::WaitDocClose);

        if (getExpectedPutRelative() < getCountPutRelative())
        {
            LOK_ASSERT_EQUAL_MESSAGE("Too many PutRelative requests", getExpectedPutRelative(),
                                     getCountPutRelative());
        }

        if (getExpectedPutFile() < getCountPutFile())
        {
            //FIXME: unreliable in SaveOnExit, which sometimes does 2 PutFile requests.
            // LOK_ASSERT_EQUAL_MESSAGE("Too many PutFile requests", getExpectedPutFile(),
            //                          getCountPutFile());
        }
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

        LOK_ASSERT_EQUAL_MESSAGE("Expect only documentconflict errors",
                                 std::string("error: cmd=storage kind=documentconflict"), message);

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
        LOK_ASSERT_MESSAGE("Expected reason to be 'Data-loss detected'",
                           Util::startsWith(reason, "Data-loss detected"));
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

        LOK_ASSERT_EQUAL(getExpectedCheckFileInfo(), getCountCheckFileInfo());
        LOK_ASSERT_EQUAL(getExpectedGetFile(), getCountGetFile());
        LOK_ASSERT_EQUAL(getExpectedPutRelative(), getCountPutRelative());
        // LOK_ASSERT_EQUAL(getExpectedPutFile(), getCountPutFile()); //FIXME: unreliable for some tests.

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
