/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Util/LayeredConfiguration.h>

class UnitWOPIRenameFile : public WopiTestServer
{
    enum class Phase
    {
        Load,
        RenameFile,
        Polling
    } _phase;

public:
    UnitWOPIRenameFile() :
        _phase(Phase::Load)
    {
    }

    void assertRenameFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        // spec says UTF-7...
        LOK_ASSERT_EQUAL(std::string("hello"), request.get("X-WOPI-RequestedName"));
    }

    bool filterSendMessage(const char* data, const size_t len, const WSOpCode /* code */, const bool /* flush */, int& /*unitReturn*/) override
    {
        const std::string message(data, len);

        const std::string expected("renamefile: filename=hello");
        if (message.find(expected) == 0)
        {
            // successfully exit the test if we also got the outgoing message
            // notifying about saving the file
            exitTest(TestResult::Ok);
        }

        return false;
    }

    void invokeTest() override
    {
        constexpr char testName[] = "UnitWOPIRenameFile";

        switch (_phase)
        {
            case Phase::Load:
            {
                initWebsocket("/wopi/files/0?access_token=anything");

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "load url=" + getWopiSrc(), testName);
                _phase = Phase::RenameFile;
                break;
            }
            case Phase::RenameFile:
            {
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "renamefile filename=hello", testName);
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
    return new UnitWOPIRenameFile();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
