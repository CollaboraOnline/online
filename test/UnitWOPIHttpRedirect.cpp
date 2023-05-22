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

#include <Poco/Net/HTTPRequest.h>

class UnitWopiHttpRedirect : public WopiTestServer
{
    STATE_ENUM(Phase, Load, Redirected, GetFile, Redirected2, Done) _phase;

    const std::string params = "access_token=anything";

public:
    UnitWopiHttpRedirect()
        : WopiTestServer("UnitWopiHttpRedirect")
        , _phase(Phase::Load)
    {
    }

    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& request,
                                   Poco::MemoryInputStream& message,
                                   std::shared_ptr<StreamSocket>& socket) override
    {
        Poco::URI uriReq(request.getURI());
        Poco::RegularExpression regInfo("/wopi/files/1");
        std::string redirectUri = "/wopi/files/0";
        Poco::RegularExpression regRedirected(redirectUri);
        Poco::RegularExpression regContents("/wopi/files/0/contents");
        std::string redirectUri2 = "/wopi/files/2/contents";
        Poco::RegularExpression regContentsRedirected(redirectUri2);

        LOG_INF("FakeWOPIHost: Request URI [" << uriReq.toString() << "]:\n");

        // CheckFileInfo - returns redirect response
        if (request.getMethod() == "GET" && regInfo.match(uriReq.getPath()))
        {
            LOG_INF("FakeWOPIHost: Handling CheckFileInfo (1/2)");

            assertCheckFileInfoRequest(request);

            LOK_ASSERT_MESSAGE("Expected to be in Phase::Load", _phase == Phase::Load);
            _phase = Phase::Redirected;

            http::Response httpResponse(http::StatusCode::Found);
            httpResponse.set("Location", helpers::getTestServerURI() + redirectUri + '?' + params);
            socket->sendAndShutdown(httpResponse);

            return true;
        }
        // CheckFileInfo - for redirected URI
        else if (request.getMethod() == "GET" && regRedirected.match(uriReq.getPath()) && !regContents.match(uriReq.getPath()))
        {
            LOG_INF("FakeWOPIHost: Handling CheckFileInfo: (2/2)");

            assertCheckFileInfoRequest(request);

            LOK_ASSERT_MESSAGE("Expected to be in Phase::Redirected or Phase::Done",
                               _phase == Phase::Redirected || _phase == Phase::Done);
            if (_phase == Phase::Redirected)
                TRANSITION_STATE(_phase, Phase::GetFile);

            Poco::LocalDateTime now;
            const std::string fileName(uriReq.getPath() == "/wopi/files/3" ? "he%llo.txt" : "hello.txt");
            Poco::JSON::Object::Ptr fileInfo = new Poco::JSON::Object();
            fileInfo->set("BaseFileName", fileName);
            fileInfo->set("Size", getFileContent().size());
            fileInfo->set("Version", "1.0");
            fileInfo->set("OwnerId", "test");
            fileInfo->set("UserId", "test");
            fileInfo->set("UserFriendlyName", "test");
            fileInfo->set("UserCanWrite", "true");
            fileInfo->set("PostMessageOrigin", "localhost");
            fileInfo->set("LastModifiedTime", Util::getIso8601FracformatTime(getFileLastModifiedTime()));
            fileInfo->set("EnableOwnerTermination", "true");

            std::ostringstream jsonStream;
            fileInfo->stringify(jsonStream);

            http::Response httpResponse(http::StatusCode::OK);
            httpResponse.set("Last-Modified", Util::getHttpTime(getFileLastModifiedTime()));
            httpResponse.setBody(jsonStream.str(), "application/json; charset=utf-8");
            socket->sendAndShutdown(httpResponse);

            return true;
        }
        // GetFile - first try
        else if (request.getMethod() == "GET" && regContents.match(uriReq.getPath()))
        {
            LOG_TST("FakeWOPIHost: Handling GetFile: " << uriReq.getPath());

            assertGetFileRequest(request);

            LOK_ASSERT_MESSAGE("Expected to be in Phase::GetFile", _phase == Phase::GetFile);
            TRANSITION_STATE(_phase, Phase::Redirected2);

            http::Response httpResponse(http::StatusCode::Found);
            httpResponse.set("Location", helpers::getTestServerURI() + redirectUri2 + '?' + params);
            socket->sendAndShutdown(httpResponse);

            return true;
        }
        // GetFile - redirected
        else if (request.getMethod() == "GET" && regContentsRedirected.match(uriReq.getPath()))
        {
            LOG_TST("FakeWOPIHost: Handling GetFile: " << uriReq.getPath());

            assertGetFileRequest(request);

            LOK_ASSERT_MESSAGE("Expected to be in Phase::Redirected2", _phase == Phase::Redirected2);
            TRANSITION_STATE(_phase, Phase::Done);

            http::Response httpResponse(http::StatusCode::OK);
            httpResponse.set("Last-Modified", Util::getHttpTime(getFileLastModifiedTime()));
            httpResponse.setBody(getFileContent(), "text/plain; charset=utf-8");
            socket->sendAndShutdown(httpResponse);

            exitTest(TestResult::Ok);

            return true;
        }

        return WopiTestServer::handleHttpRequest(request, message, socket);
    }

    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::Load:
            {
                initWebsocket("/wopi/files/1?" + params);

                WSD_CMD("load url=" + getWopiSrc());

                break;
            }
            case Phase::Redirected:
            case Phase::Redirected2:
            case Phase::GetFile:
            case Phase::Done:
            {
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWopiHttpRedirect(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
