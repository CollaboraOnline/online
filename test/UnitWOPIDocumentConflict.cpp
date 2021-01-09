/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "Util.hpp"
#include "config.h"

#include "WopiTestServer.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"
#include "helpers.hpp"
#include "lokassert.hpp"

#include <Poco/Net/HTTPRequest.h>
#include <string>

/**
 * This test asserts that the unsaved changes in the opened document are
 * discarded in case document is changed in storage behind our back. We don't
 * want to overwrite the document which is in storage when the user asks us to
 * do so.
 *
 * The way this works is as follows:
 * 1. Load a document.
 * 2. When we get 'status:' in filterSendMessage, we modify it.
 * 3. Simulate content-change in storage and attempt to save it.
 * 4. Saving should fail with 'error:' in filterSendMessage.
 * 5. Load the document again and verify the storage-chagned contents.
 * 6. Finish when the second load is processed in assertGetFileRequest.
 */
class UnitWOPIDocumentConflict : public WopiTestServer
{
    enum class Phase
    {
        Load,
        WaitLoadStatus,
        ModifyDoc,
        WaitModifiedStatus,
        ChangeStorageDoc,
        WaitSaveResponse,
        WaitDocClose,
        LoadNewDocument,
        Polling
    } _phase;

    /// Return the name of the given Phase.
    static std::string toString(Phase phase)
    {
#define ENUM_CASE(X)                                                                               \
    case X:                                                                                        \
        return #X

        switch (phase)
        {
            ENUM_CASE(Phase::Load);
            ENUM_CASE(Phase::WaitLoadStatus);
            ENUM_CASE(Phase::ModifyDoc);
            ENUM_CASE(Phase::WaitModifiedStatus);
            ENUM_CASE(Phase::ChangeStorageDoc);
            ENUM_CASE(Phase::WaitSaveResponse);
            ENUM_CASE(Phase::WaitDocClose);
            ENUM_CASE(Phase::LoadNewDocument);
            ENUM_CASE(Phase::Polling);
            default:
                return "Unknown";
        }
#undef ENUM_CASE
    }

    enum class DocLoaded
    {
        Doc1,
        Doc2
    } _docLoaded;

    static constexpr auto ExpectedDocContent = "Modified content in storage";

public:
    UnitWOPIDocumentConflict()
        : WopiTestServer("UnitWOPIDocumentConflict")
        , _phase(Phase::Load)
    {
    }

    void assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        LOG_TST("assertGetFileRequest: Doc " << (_docLoaded == DocLoaded::Doc1 ? "1" : "2"));
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitLoadStatus but was " + toString(_phase),
                           _phase == Phase::WaitLoadStatus);

        if (_docLoaded == DocLoaded::Doc2)
        {
            // On second doc load, we should have the document in storage which
            // was changed beneath us, not the one which we modified by pressing 'a'
            LOK_ASSERT_EQUAL_MESSAGE("File contents not modified in storage",
                                     std::string(ExpectedDocContent), getFileContent());
            if (getFileContent() != ExpectedDocContent)
                failTest("The file is stale and not the one in storage.");
            else
                passTest("The file reloaded from the storage as expected.");
        }
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: Doc " << (_docLoaded == DocLoaded::Doc1 ? "1" : "2")
                                         << "(WaitLoadStatus): [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitLoadStatus but was " + toString(_phase),
                           _phase == Phase::WaitLoadStatus);

        if (_docLoaded == DocLoaded::Doc1)
        {
            _phase = Phase::ModifyDoc;
            LOG_TST("onDocumentLoaded: Switching to Phase::ModifyDoc");
            SocketPoll::wakeupWorld();
        }

        return true;
    }

    bool onDocumentModified(const std::string& message) override
    {
        LOG_TST("onDocumentModified: Doc " << (_docLoaded == DocLoaded::Doc1 ? "1" : "2")
                                           << "(WaitModifiedStatus): [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitModifiedStatus but was "
                               + toString(_phase),
                           _phase == Phase::WaitModifiedStatus);

        if (_docLoaded == DocLoaded::Doc1)
        {
            _phase = Phase::ChangeStorageDoc;
            LOG_TST("onDocumentModified: Switching to Phase::ChangeStorageDoc");
            SocketPoll::wakeupWorld();
        }

        return true;
    }

    bool onDocumentError(const std::string& message) override
    {
        LOG_TST("onDocumentError: Doc " << (_docLoaded == DocLoaded::Doc1 ? "1" : "2")
                                        << "(WaitSaveResponse): [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitSaveResponse but was " + toString(_phase),
                           _phase == Phase::WaitSaveResponse);

        _phase = Phase::WaitDocClose;
        LOG_TST("onDocumentError: Switching to Phase::WaitDocClose");

        // we don't want to save current changes because doing so would
        // overwrite the document which was changed underneath us
        WSD_CMD("closedocument");
        return true;
    }

    bool onFilterSendMessage(const char* data, const size_t len, const WSOpCode /* code */,
                             const bool /* flush */, int& /*unitReturn*/) override
    {
        const std::string message(data, len);
        switch (_phase)
        {
            case Phase::WaitDocClose:
            {
                LOG_TST("onFilterSendMessage: Doc " << (_docLoaded == DocLoaded::Doc1 ? "1" : "2")
                                                  << "(WaitDocClose): [" << message << ']');
                if (message == "exit")
                {
                    _phase = Phase::LoadNewDocument;
                    LOG_TST("onFilterSendMessage: Switching to Phase::LoadNewDocument");
                    SocketPoll::wakeupWorld();
                }
            }
            break;
            default:
            {
                // Nothing to do.
            }
            break;
        }

        return false;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                LOG_TST("Phase::Load");
                _docLoaded = DocLoaded::Doc1;
                _phase = Phase::WaitLoadStatus;

                initWebsocket("/wopi/files/0?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
            }
            break;
            case Phase::WaitLoadStatus:
            {
                // Nothing to do.
            }
            break;
            case Phase::ModifyDoc:
            {
                LOG_TST("Phase::ModifyAndChangeStorageDoc");
                _phase = Phase::WaitModifiedStatus;

                // modify the currently opened document; type 'a'
                WSD_CMD("key type=input char=97 key=0");
                WSD_CMD("key type=up char=0 key=512");
                SocketPoll::wakeupWorld();
            }
            break;
            case Phase::WaitModifiedStatus:
            {
                // Nothing to do.
            }
            break;
            case Phase::ChangeStorageDoc:
            {
                // Change the document underneath, in storage.
                LOG_TST("Phase::ChangeStorageDoc: changing contents in storage");
                _phase = Phase::WaitSaveResponse;

                setFileContent(ExpectedDocContent);

                // Save the document; wsd should detect now that document has
                // been changed underneath it and send us:
                // "error: cmd=storage kind=documentconflict"
                // When we get it (in filterSendMessage, above),
                // we will switch to Phase::LoadNewDocument.
                LOG_TST("Phase::ChangeStorageDoc: saving");
                WSD_CMD("save");
            }
            break;
            case Phase::WaitSaveResponse:
            case Phase::WaitDocClose:
            {
                // Nothing to do.
            }
            break;
            case Phase::LoadNewDocument:
            {
                // Now load the document again and, when we hit
                // assertGetFileRequest, verify that its contents
                // are the changed-in-storage (and not our modified).
                // Unfortunately we don't have a way to find out
                // if the previous document's DocBroker is gone
                // since sending 'exit' to the kit, so wait a bit.
                // We could add a call back after cleaning the
                // DocBroker, but a short wait will do for now.
                LOG_TST("Phase::LoadNewDocument: Reloading.");
                _docLoaded = DocLoaded::Doc2; // Update before loading!
                _phase = Phase::WaitLoadStatus;

                std::this_thread::sleep_for(std::chrono::seconds(1));
                initWebsocket("/wopi/files/0?access_token=anything");
            }
            break;
            case Phase::Polling:
            {
                LOG_TST("Phase::Polling");
                // just wait for the results
            }
            break;
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWOPIDocumentConflict(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
