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
    enum class Phase
    {
        Load,
        Redirected,
        Polling
    } _phase;

    const std::string params = "access_token=anything";
    static constexpr auto testname = "UnitWopiHttpRedirectLoop";

public:
    UnitWopiHttpRedirectLoop()
        : WopiTestServer(testname)
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
        static unsigned fileId = 1;

        LOG_INF("Fake wopi host request URI [" << uriReq.toString() << "]:\n");

        // CheckFileInfo - always returns redirect response
        if (request.getMethod() == "GET" && regInfo.match(uriReq.getPath()))
        {
            LOG_INF("Fake wopi host request, handling CheckFileInfo");

            assertCheckFileInfoRequest(request);

            std::string sExpectedMessage = "It is expected to stop requesting after " + std::to_string(RedirectionLimit) + " redirections";
            LOK_ASSERT_MESSAGE(sExpectedMessage, fileId <= RedirectionLimit + 1);

            LOK_ASSERT_MESSAGE("Expected to be in Phase::Load or Phase::Redirected", _phase == Phase::Load || _phase == Phase::Redirected);
            _phase = Phase::Redirected;

            if (fileId == RedirectionLimit + 1)
                _phase = Phase::Polling;

            std::ostringstream oss;
            oss << "HTTP/1.1 302 Found\r\n"
                "Location: " << helpers::getTestServerURI() << redirectUri << fileId << "?" << params << "\r\n"
                "\r\n";

            socket->send(oss.str());
            socket->shutdown();

            fileId++;

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
                SocketPoll::wakeupWorld();

                break;
            }
            case Phase::Redirected:
            {
                break;
            }
            case Phase::Polling:
            {
                exitTest(TestResult::Ok);
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWopiHttpRedirectLoop(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
