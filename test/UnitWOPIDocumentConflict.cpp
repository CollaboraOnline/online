/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include "WopiTestServer.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"
#include "helpers.hpp"

#include <Poco/Net/HTTPRequest.h>
#include <Poco/Timestamp.h>

/**
 * This test asserts that the unsaved changes in the opened document are
 * discarded in case document is changed in storage behind our back. We don't
 * want to overwrite the document which is in storage when the user asks us to
 * do so.
 */
class UnitWOPIDocumentConflict : public WopiTestServer
{
    enum class Phase
    {
        Load,
        ModifyAndChangeStorageDoc,
        LoadNewDocument,
        Polling
    } _phase;

    enum class DocLoaded
    {
	Doc1,
	Doc2
    } _docLoaded;

    const std::string _testName = "UnitWOPIDocumentConflict";

public:
    UnitWOPIDocumentConflict() :
        _phase(Phase::Load)
    {
    }

    void assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
	if (_docLoaded == DocLoaded::Doc2)
	{
	    // On second doc load, we should have the document in storage which
	    // was changed beneath us, not the one which we modified by pressing 'a'
	    if (getFileContent() != "Modified content in storage")
		exitTest(TestResult::Failed);
	    else
		exitTest(TestResult::Ok);
	}
    }

    bool filterSendMessage(const char* data, const size_t len, const WSOpCode /* code */, const bool /* flush */, int& /*unitReturn*/) override
    {
        std::string message(data, len);
        if (message == "error: cmd=storage kind=documentconflict")
        {
	    // we don't want to save current changes because doing so would
	    // overwrite the document which was changed underneath us
	    helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "closedocument", _testName);
	    _phase = Phase::LoadNewDocument;
        }

        return false;
    }

    void invokeTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                initWebsocket("/wopi/files/0?access_token=anything");
		_docLoaded = DocLoaded::Doc1;

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "load url=" + getWopiSrc(), _testName);

                _phase = Phase::ModifyAndChangeStorageDoc;
                break;
            }
            case Phase::ModifyAndChangeStorageDoc:
            {
		// modify the currently opened document; type 'a'
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=input char=97 key=0", _testName);
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=up char=0 key=512", _testName);
                SocketPoll::wakeupWorld();

		// ModifiedStatus=true is a bit slow; let's sleep and hope that
		// it is received before we wake up
		std::this_thread::sleep_for(std::chrono::microseconds(POLL_TIMEOUT_MICRO_S));

		// change the document underneath, in storage
		setFileContent("Modified content in storage");

		// save the document; wsd should detect now that document has
		// been changed underneath it and send us:
		// "error: cmd=storage kind=documentconflict"
		helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "save", _testName);

                _phase = Phase::Polling;

                break;
            }
	    case Phase::LoadNewDocument:
            {
		initWebsocket("/wopi/files/0?access_token=anything");
		_docLoaded = DocLoaded::Doc2;
                _phase = Phase::Polling;
                break;
            }
            case Phase::Polling:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitWOPIDocumentConflict();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
