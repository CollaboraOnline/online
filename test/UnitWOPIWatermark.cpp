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
    STATE_ENUM(Phase, Load, TileRequest, Done)
    _phase;

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

            http::Response httpResponse(http::StatusLine(200));
            httpResponse.set("Last-Modified", Util::getHttpTime(getFileLastModifiedTime()));
            httpResponse.setBody(jsonStream.str(), "application/json; charset=utf-8");
            socket->sendAndShutdown(httpResponse);

            return true;
        }
        // GetFile
        else if (request.getMethod() == "GET" && regContent.match(uriReq.getPath()))
        {
            LOG_INF("Fake wopi host request, handling GetFile: " << uriReq.getPath());

            assertGetFileRequest(request);

            http::Response httpResponse(http::StatusLine(200));
            httpResponse.set("Last-Modified", Util::getHttpTime(getFileLastModifiedTime()));
            httpResponse.setBody(getFileContent(), "text/plain; charset=utf-8");
            socket->sendAndShutdown(httpResponse);

            return true;
        }

        return false;
    }

    void invokeWSDTest() override
    {
        constexpr char testName[] = "UnitWOPIWatermark";

        switch (_phase)
        {
            case Phase::Load:
            {
                TRANSITION_STATE(_phase, Phase::TileRequest);

                initWebsocket("/wopi/files/5?access_token=anything");

                WSD_CMD("load url=" + getWopiSrc());
                break;
            }
            case Phase::Done:
            {
                exitTest(TestResult::Ok);
                break;
            }
            case Phase::TileRequest:
            {
                WSD_CMD("tilecombine nviewid=0 part=0 width=256 height=256 tileposx=0,3840 "
                        "tileposy=0,0 tilewidth=3840 tileheight=3840");
                std::string tile =
                    helpers::getResponseString(getWs()->getWebSocket(), "tile:", testName);

                if(!tile.empty())
                {
                    StringVector tokens(StringVector::tokenize(tile, ' '));
                    std::string nviewid = tokens[1].substr(std::string("nviewid=").size());
                    if (!nviewid.empty() && nviewid != "0")
                    {
                        LOG_INF("Watermark is hashed into integer successfully nviewid=" << nviewid);
                        TRANSITION_STATE(_phase, Phase::Done);
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
