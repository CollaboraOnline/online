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
        Modify,
        VersionRestoreRequest,
        VersionRestoreAck,
        Polling
    } _phase;

    bool _isDocumentSaved = false;

public:
    UnitWOPIVersionRestore() :
        _phase(Phase::Load)
    {
    }

    void assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/) override
    {
        if (_phase == Phase::Polling)
        {
            _isDocumentSaved = true;
        }
    }

    bool filterSendMessage(const char* data, const size_t len, const WSOpCode /* code */, const bool /* flush */, int& /*unitReturn*/) override
    {
        std::string message(data, len);
        if (message == "close: versionrestore: prerestore_ack")
        {
            _phase = Phase::VersionRestoreAck;
        }

        return false;
    }

    void invokeTest() override
    {
        constexpr char testName[] = "UnitWOPIVersionRestore";

        LOG_TRC("invokeTest " << (int)_phase);
        switch (_phase)
        {
            case Phase::Load:
            {
                initWebsocket("/wopi/files/0?access_token=anything");

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "load url=" + getWopiSrc(), testName);

                _phase = Phase::Modify;
                break;
            }
            case Phase::Modify:
            {
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=input char=97 key=0", testName);
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "key type=up char=0 key=512", testName);

                _phase = Phase::VersionRestoreRequest;
                SocketPoll::wakeupWorld();
                break;
            }
	        case Phase::VersionRestoreRequest:
            {
                // tell wsd that we are about to restore
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "versionrestore prerestore", testName);
                _phase = Phase::Polling;
                break;
            }
	        case Phase::VersionRestoreAck:
            {
                if (_isDocumentSaved)
                    exitTest(TestResult::Ok);

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
    return new UnitWOPIVersionRestore();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
