/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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
    STATE_ENUM(Phase,
               Start, // Initial phase
               LoadToken, // loading the document with Bearer token
               LoadHeader, // loading the document with Basic auth
               Done // just wait for the results
    )
    _phase;

    bool _checkFileInfoCalled;
    bool _getFileCalled;

public:
    UnitOAuth()
        : WopiTestServer("UnitOAuth")
        , _phase(Phase::Start)
        , _checkFileInfoCalled(false)
        , _getFileCalled(false)
    {
    }

    /// The actual assert of the authentication.
    void assertRequest(const Poco::Net::HTTPRequest& request)
    {
        // check that the request contains the Authorization: header
        try
        {
            if (_phase == Phase::LoadToken)
            {
                OAuth20Credentials creds(request);
                LOK_ASSERT_EQUAL(std::string("s3hn3ct0k3v"), creds.getBearerToken());
            }
            else if (_phase == Phase::LoadHeader)
            {
                OAuth20Credentials creds(request, "Basic");
                LOK_ASSERT_EQUAL(std::string("basic=="), creds.getBearerToken());
            }
            else
            {
                LOK_ASSERT_FAIL("Unexpected phase: " + toString(_phase));
            }
        }
        catch (const std::exception& ex)
        {
            // fail as fast as possible
            failTest(std::string("Exception: ") + ex.what());
        }
    }

    void assertCheckFileInfoRequest(const Poco::Net::HTTPRequest& request) override
    {
        _checkFileInfoCalled = true;
        assertRequest(request);
    }

    void assertGetFileRequest(const Poco::Net::HTTPRequest& request) override
    {
        _getFileCalled = true;
        assertRequest(request);
    }

    bool onDocumentLoaded(const std::string& message) override
    {
        LOG_TST("Doc (" << name(_phase) << "): [" << message << ']');

        LOK_ASSERT_EQUAL_MESSAGE("CheckFileInfo was not invoked", true, _checkFileInfoCalled);
        _checkFileInfoCalled = false;
        LOK_ASSERT_EQUAL_MESSAGE("GetFile was not invoked", true, _getFileCalled);
        _getFileCalled = false;

        // Close the document after loading.
        WSD_CMD("closedocument");
        switch (_phase)
        {
            case Phase::LoadToken:
                TRANSITION_STATE(_phase, Phase::LoadHeader);

                initWebsocket("/wopi/files/1?access_header=Authorization: Basic basic==");
                WSD_CMD("load url=" + getWopiSrc());
                break;
            case Phase::LoadHeader:
                TRANSITION_STATE(_phase, Phase::Done);
                passTest("Finished all cases successfully");
                break;
            default:
                LOK_ASSERT_FAIL("Unexpected phase: " + toString(_phase));
        }

        return true;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Start:
            {
                TRANSITION_STATE(_phase, Phase::LoadToken);
                initWebsocket("/wopi/files/0?access_token=s3hn3ct0k3v");

                WSD_CMD("load url=" + getWopiSrc());
            }
            break;
            case Phase::LoadToken:
            case Phase::LoadHeader:
            case Phase::Done:
            {
                // just wait for the results
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitOAuth(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
