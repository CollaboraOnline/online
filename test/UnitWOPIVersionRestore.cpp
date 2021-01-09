/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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
#include "lokassert.hpp"

#include <Poco/Net/HTTPRequest.h>
#include <Poco/Timestamp.h>
#include <Poco/Util/LayeredConfiguration.h>


/*
 * 1) Modifies a current document
 * 2) Issue a version restore request
 * 3) Wait for the ack from wsd
 * 4) checks, after getting ack from wsd, if it saved our unsaved changes
 */
class UnitWOPIVersionRestore : public WopiTestServer
{
    enum class Phase
    {
        Load,
        WaitLoadStatus,
        WaitPutFile
    } _phase;

    bool _isDocumentSaved = false;

public:
    UnitWOPIVersionRestore()
        : WopiTestServer("UnitWOPIVersionRestore")
        , _phase(Phase::Load)
        , _isDocumentSaved(false)
    {
    }

    void assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        if (_phase == Phase::WaitPutFile)
        {
            LOG_TST("assertPutFileRequest: document saved.");
            _isDocumentSaved = true;
        }
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("onDocumentLoaded: [" << message << ']');
        LOK_ASSERT_MESSAGE("Expected to be in Phase::WaitLoadStatus",
                           _phase == Phase::WaitLoadStatus);

        LOG_TST("onDocumentModified: Switching to Phase::WaitPutFile and modifying document");
        _phase = Phase::WaitPutFile;

        // Modify the document.
        WSD_CMD("key type=input char=97 key=0");
        WSD_CMD("key type=up char=0 key=512");

        // tell wsd that we are about to restore
        WSD_CMD("versionrestore prerestore");

        SocketPoll::wakeupWorld();
        return true;
    }

    bool onFilterSendMessage(const char* data, const size_t len, const WSOpCode /* code */,
                             const bool /* flush */, int& /*unitReturn*/) override
    {
        std::string message(data, len);
        if (message == "close: versionrestore: prerestore_ack")
        {
            LOK_ASSERT_MESSAGE("Must be in Phase::WaitPutFile", _phase == Phase::WaitPutFile);
            LOK_ASSERT_MESSAGE("Must have already saved the file", _isDocumentSaved);

            if (_isDocumentSaved)
                passTest("Document saved on version restore as expected.");
            else
                failTest("Document failed to save on version restore.");
        }

        return false;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                _phase = Phase::WaitLoadStatus;

                LOG_TST("Load: initWebsocket.");
                initWebsocket("/wopi/files/0?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
                break;
            }
            case Phase::WaitLoadStatus:
            {
                break; // Nothing to do.
            }
            case Phase::WaitPutFile:
            {
                break; // Nothing to do.
            }
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitWOPIVersionRestore();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
