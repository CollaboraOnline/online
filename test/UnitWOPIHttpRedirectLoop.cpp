/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "WopiTestServer.hpp"
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <wsd/Storage.hpp>

#include <Poco/Net/HTTPRequest.h>

class UnitWopiHttpRedirectLoop : public WopiTestServer
{
    STATE_ENUM(Phase, Load, Redirected) _phase;

    const std::string params = "access_token=anything";

public:
    UnitWopiHttpRedirectLoop()
        : WopiTestServer("UnitWopiHttpRedirectLoop")
        , _phase(Phase::Load)
    {
    }

    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& request,
                                   Poco::MemoryInputStream& /*message*/,
                                   std::shared_ptr<StreamSocket>& socket) override
    {
        Poco::URI uriReq(request.getURI());
        Poco::RegularExpression regInfo("/wopi/files/[0-9]+");
        std::string redirectUri = "/wopi/files/";
        static unsigned redirectionCount = 0;

        LOG_INF("FakeWOPIHost: Request URI [" << uriReq.toString() << "]:\n");

        // CheckFileInfo - always returns redirect response
        if (request.getMethod() == "GET" && regInfo.match(uriReq.getPath()))
        {
            LOG_INF("FakeWOPIHost: Handling CheckFileInfo");

            assertCheckFileInfoRequest(request);

            std::string sExpectedMessage = "It is expected to stop requesting after " + std::to_string(RedirectionLimit) + " redirections";
            LOK_ASSERT_MESSAGE(sExpectedMessage, redirectionCount <= RedirectionLimit);

            LOK_ASSERT_MESSAGE("Expected to be in Phase::Load or Phase::Redirected",
                               _phase == Phase::Load || _phase == Phase::Redirected);

            if (redirectionCount == RedirectionLimit)
            {
                exitTest(TestResult::Ok);
                return true;
            }

            TRANSITION_STATE(_phase, Phase::Redirected);

            std::ostringstream oss;
            oss << "HTTP/1.1 302 Found\r\n"
                "Location: " << helpers::getTestServerURI() << redirectUri << redirectionCount << "?" << params << "\r\n"
                "\r\n";

            socket->send(oss.str());
            socket->shutdown();

            redirectionCount++;

            return true;
        }

        return false;
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                initWebsocket("/wopi/files/0?" + params);

                WSD_CMD("load url=" + getWopiSrc());

                break;
            }
            case Phase::Redirected:
            {
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWopiHttpRedirectLoop(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
