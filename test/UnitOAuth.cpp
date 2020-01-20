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
#include <Poco/Net/OAuth20Credentials.h>
#include <Poco/Util/LayeredConfiguration.h>

using Poco::Net::OAuth20Credentials;

class UnitOAuth : public WopiTestServer
{
    enum class Phase
    {
        LoadToken,  // loading the document with Bearer token
        LoadHeader, // loading the document with Basic auth
        Polling     // just wait for the results
    } _phase;

    bool _finishedToken;
    bool _finishedHeader;

public:
    UnitOAuth() :
        _phase(Phase::LoadToken),
        _finishedToken(false),
        _finishedHeader(false)
    {
    }

    /// The actual assert of the authentication.
    void assertRequest(const Poco::Net::HTTPRequest& request, int fileIndex)
    {
        // check that the request contains the Authorization: header
        try {
            if (fileIndex == 0)
            {
                OAuth20Credentials creds(request);
                LOK_ASSERT_EQUAL(std::string("s3hn3ct0k3v"), creds.getBearerToken());
            }
            else
            {
                OAuth20Credentials creds(request, "Basic");
                LOK_ASSERT_EQUAL(std::string("basic=="), creds.getBearerToken());
            }
        }
        catch (const std::exception&)
        {
            // fail as fast as possible
            exit(1);
        }
    }

    void assertCheckFileInfoRequest(const Poco::Net::HTTPRequest& request) override
    {
        std::string path = Poco::URI(request.getURI()).getPath();
        assertRequest(request, (path == "/wopi/files/0")? 0: 1);
    }

    void assertGetFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        std::string path = Poco::URI(request.getURI()).getPath();
        if (path == "/wopi/files/0/contents")
        {
            assertRequest(request, 0);
            _finishedToken = true;
        }
        else
        {
            assertRequest(request, 1);
            _finishedHeader = true;
        }

        if (_finishedToken && _finishedHeader)
            exitTest(TestResult::Ok);
    }

    void invokeTest() override
    {
        constexpr char testName[] = "UnitOAuth";

        switch (_phase)
        {
            case Phase::LoadToken:
            case Phase::LoadHeader:
            {
                if (_phase == Phase::LoadToken)
                    initWebsocket("/wopi/files/0?access_token=s3hn3ct0k3v");
                else
                    initWebsocket("/wopi/files/1?access_header=Authorization: Basic basic==");

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "load url=" + getWopiSrc(), testName);
                SocketPoll::wakeupWorld();

                if (_phase == Phase::LoadToken)
                    _phase = Phase::LoadHeader;
                else
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
    return new UnitOAuth();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
