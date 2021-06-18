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
    enum class Phase
    {
        Load,
        Redirected,
    } _phase;

    const std::string params = "access_token=anything";
    static constexpr auto testname = "UnitWopiHttpRedirect";

public:
    UnitWopiHttpRedirect()
        : WopiTestServer(testname)
        , _phase(Phase::Load)
    {
    }

    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& request,
                                   Poco::MemoryInputStream& message,
                                   std::shared_ptr<StreamSocket>& socket) override
    {
        Poco::URI uriReq(request.getURI());
        Poco::RegularExpression regInfo("/wopi/files/1");
        Poco::RegularExpression regContents("/wopi/files/[0-9]/contents");
        std::string redirectUri = "/wopi/files/0";
        Poco::RegularExpression regRedirected(redirectUri);

        LOG_INF("Fake wopi host request URI [" << uriReq.toString() << "]:\n");

        // CheckFileInfo - returns redirect response
        if (request.getMethod() == "GET" && regInfo.match(uriReq.getPath()) && !regContents.match(uriReq.getPath()))
        {
            LOG_INF("Fake wopi host request, handling CheckFileInfo (1/2)");
            LOK_ASSERT_MESSAGE("Expected to be in Phase::Load", _phase == Phase::Load);

            assertCheckFileInfoRequest(request);

            std::ostringstream oss;
            oss << "HTTP/1.1 302 Found\r\n"
                "Location: " << helpers::getTestServerURI() << redirectUri << "?" << params << "\r\n"
                "\r\n";

            socket->send(oss.str());
            socket->shutdown();

            _phase = Phase::Redirected;

            return true;
        }
        // CheckFileInfo - for redirected URI
        else if (request.getMethod() == "GET" && regRedirected.match(uriReq.getPath()) && !regContents.match(uriReq.getPath()))
        {
            LOG_INF("Fake wopi host request, handling CheckFileInfo: (2/2)");
            LOK_ASSERT_MESSAGE("Expected to be in Phase::Redirected", _phase == Phase::Redirected);

            assertCheckFileInfoRequest(request);

            Poco::LocalDateTime now;
            const std::string fileName(uriReq.getPath() == "/wopi/files/3" ? "he%llo.txt" : "hello.txt");
            Poco::JSON::Object::Ptr fileInfo = new Poco::JSON::Object();
            fileInfo->set("BaseFileName", fileName);
            fileInfo->set("Size", _fileContent.size());
            fileInfo->set("Version", "1.0");
            fileInfo->set("OwnerId", "test");
            fileInfo->set("UserId", "test");
            fileInfo->set("UserFriendlyName", "test");
            fileInfo->set("UserCanWrite", "true");
            fileInfo->set("PostMessageOrigin", "localhost");
            fileInfo->set("LastModifiedTime", Util::getIso8601FracformatTime(_fileLastModifiedTime));
            fileInfo->set("EnableOwnerTermination", "true");

            std::ostringstream jsonStream;
            fileInfo->stringify(jsonStream);
            std::string responseString = jsonStream.str();

            const std::string mimeType = "application/json; charset=utf-8";

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "Last-Modified: " << Util::getHttpTime(_fileLastModifiedTime) << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: " << responseString.size() << "\r\n"
                "Content-Type: " << mimeType << "\r\n"
                "\r\n"
                << responseString;

            socket->send(oss.str());
            socket->shutdown();

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
                SocketPoll::wakeupWorld();

                break;
            }
            case Phase::Redirected:
            {
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWopiHttpRedirect(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
