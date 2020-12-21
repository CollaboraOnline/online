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
#include <Poco/Util/LayeredConfiguration.h>

class UnitWOPIWatermark : public WopiTestServer
{
    enum class Phase
    {
        Load,
        TileRequest,
        Polling
    } _phase;

public:
    UnitWOPIWatermark()
        : WopiTestServer("UnitWOPIWatermark")
        , _phase(Phase::Load)
    {
    }

    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& /*message*/, std::shared_ptr<StreamSocket>& socket) override
    {
        Poco::URI uriReq(request.getURI());
        Poco::RegularExpression regInfo("/wopi/files/[0-9]");
        Poco::RegularExpression regContent("/wopi/files/[0-9]/contents");
        LOG_INF("Fake wopi host request: " << uriReq.toString());

        // CheckFileInfo
        if (request.getMethod() == "GET" && regInfo.match(uriReq.getPath()))
        {
            LOG_INF("Fake wopi host request, handling CheckFileInfo: " << uriReq.getPath());

            assertCheckFileInfoRequest(request);

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
            fileInfo->set("WatermarkText", "WatermarkTest");

            std::ostringstream jsonStream;
            fileInfo->stringify(jsonStream);
            std::string responseString = jsonStream.str();

            const std::string mimeType = "application/json; charset=utf-8";

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "Last-Modified: " << Util::getHttpTime(getFileLastModifiedTime()) << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: " << responseString.size() << "\r\n"
                "Content-Type: " << mimeType << "\r\n"
                "\r\n"
                << responseString;

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }
        // GetFile
        else if (request.getMethod() == "GET" && regContent.match(uriReq.getPath()))
        {
            LOG_INF("Fake wopi host request, handling GetFile: " << uriReq.getPath());

            assertGetFileRequest(request);

            const std::string mimeType = "text/plain; charset=utf-8";

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "Last-Modified: " << Util::getHttpTime(getFileLastModifiedTime()) << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: " << getFileContent().size() << "\r\n"
                "Content-Type: " << mimeType << "\r\n"
                "\r\n"
                << getFileContent();

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }

        return false;
    }

    void invokeTest() override
    {
        constexpr char testName[] = "UnitWOPIWatermark";

        switch (_phase)
        {
            case Phase::Load:
            {
                initWebsocket("/wopi/files/5?access_token=anything");

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "load url=" + getWopiSrc(), testName);
                SocketPoll::wakeupWorld();

                _phase = Phase::TileRequest;
                break;
            }
            case Phase::Polling:
            {
                exitTest(TestResult::Ok);
                break;
            }
            case Phase::TileRequest:
            {
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "tilecombine nviewid=0 part=0 width=256 height=256 tileposx=0,3840 tileposy=0,0 tilewidth=3840 tileheight=3840", testName);
                std::string tile = helpers::getResponseString(*getWs()->getLOOLWebSocket(), "tile:", testName);

                if(!tile.empty())
                {
                    StringVector tokens(Util::tokenize(tile, ' '));
                    std::string nviewid = tokens[1].substr(std::string("nviewid=").size());
                    if (!nviewid.empty() && nviewid != "0")
                    {
                        LOG_INF("Watermark is hashed into integer successfully nviewid=" << nviewid);
                        _phase = Phase::Polling;
                    }
                }
                break;
            }
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitWOPIWatermark();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
