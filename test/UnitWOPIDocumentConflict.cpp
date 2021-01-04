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
#include <Poco/Timestamp.h>

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
        if (_docLoaded == DocLoaded::Doc2)
        {
            // On second doc load, we should have the document in storage which
            // was changed beneath us, not the one which we modified by pressing 'a'
            LOK_ASSERT_EQUAL_MESSAGE("File contents not modified in storage",
                                     std::string(ExpectedDocContent), getFileContent());
            if (getFileContent() != ExpectedDocContent)
                exitTest(TestResult::Failed);
            else
                exitTest(TestResult::Ok);
        }
    }

    bool onFilterSendMessage(const char* data, const size_t len, const WSOpCode /* code */,
                             const bool /* flush */, int& /*unitReturn*/) override
    {
        const std::string message(data, len);
        switch (_phase)
        {
            case Phase::WaitLoadStatus:
            {
                LOG_TST("onFilterSendMessage: Doc " << (_docLoaded == DocLoaded::Doc1 ? "1" : "2")
                                                  << "(WaitLoadStatus): [" << message << ']');
                if (_docLoaded == DocLoaded::Doc1 && Util::startsWith(message, "status:"))
                {
                    _phase = Phase::ModifyDoc;
                    LOG_TST("onFilterSendMessage: Switching to Phase::ModifyDoc");
                    SocketPoll::wakeupWorld();
                }
            }
            break;
            case Phase::WaitModifiedStatus:
            {
                LOG_TST("onFilterSendMessage: Doc " << (_docLoaded == DocLoaded::Doc1 ? "1" : "2")
                                                  << "(WaitModifiedStatus): [" << message << ']');
                if (_docLoaded == DocLoaded::Doc1
                    && message == "statechanged: .uno:ModifiedStatus=true")
                {
                    _phase = Phase::ChangeStorageDoc;
                    LOG_TST("onFilterSendMessage: Switching to Phase::ChangeStorageDoc");
                    SocketPoll::wakeupWorld();
                }
            }
            break;
            case Phase::WaitSaveResponse:
            {
                LOG_TST("onFilterSendMessage: Doc " << (_docLoaded == DocLoaded::Doc1 ? "1" : "2")
                                                  << "(WaitSaveResponse): [" << message << ']');
                if (message == "error: cmd=storage kind=documentconflict")
                {
                    _phase = Phase::WaitDocClose;
                    LOG_TST("onFilterSendMessage: Switching to Phase::WaitDocClose");

                    // we don't want to save current changes because doing so would
                    // overwrite the document which was changed underneath us
                    helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "closedocument",
                                           getTestname());
                }
            }
            break;
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

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "load url=" + getWopiSrc(),
                                       getTestname());
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
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=input char=97 key=0",
                                       getTestname());
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=up char=0 key=512",
                                       getTestname());
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
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "save", getTestname());
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
                _phase = Phase::Polling;

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
