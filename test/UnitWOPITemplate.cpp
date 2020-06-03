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

class UnitWOPITemplate : public WopiTestServer
{
    enum class Phase
    {
        LoadTemplate,
        SaveDoc,
        CloseDoc,
        Polling
    } _phase;

public:
    UnitWOPITemplate() :
        _phase(Phase::LoadTemplate)
    {
    }

    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& /*message*/, std::shared_ptr<StreamSocket>& socket) override
    {
        Poco::URI uriReq(request.getURI());
        LOG_INF("Fake wopi host request: " << uriReq.toString() << " method " << request.getMethod());

        // CheckFileInfo
        if (request.getMethod() == "GET" && uriReq.getPath() == "/wopi/files/10")
        {
            LOG_INF("Fake wopi host request, handling CheckFileInfo: " << uriReq.getPath());

            Poco::LocalDateTime now;
            Poco::JSON::Object::Ptr fileInfo = new Poco::JSON::Object();
            fileInfo->set("BaseFileName", "test.odt");
            fileInfo->set("TemplateSource", std::string("http://127.0.0.1:") + std::to_string(ClientPortNumber) + "/test.ott"); // must be http, otherwise Neon in the core complains
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
            std::string responseString = jsonStream.str();

            const std::string mimeType = "application/json; charset=utf-8";

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "Last-Modified: " << Util::getHttpTime(getFileLastModifiedTime()) << "\r\n"
                << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                << "Content-Length: " << responseString.size() << "\r\n"
                << "Content-Type: " << mimeType << "\r\n"
                << "\r\n"
                << responseString;

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }
        else if ((request.getMethod() == "OPTIONS" || request.getMethod() == "HEAD" || request.getMethod() == "PROPFIND") && uriReq.getPath() == "/test.ott")
        {
            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "Allow: GET\r\n"
                << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                << "\r\n";

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }
        // Get the template
        else if (request.getMethod() == "GET" && uriReq.getPath() == "/test.ott")
        {
            LOG_INF("Fake wopi host request, handling template GetFile: " << uriReq.getPath());

            HttpHelper::sendFileAndShutdown(socket, TDOC "/test.ott", "");

            return true;
        }
        // Save template
        else if (request.getMethod() == "POST" && uriReq.getPath() == "/wopi/files/10/contents")
        {
            LOG_INF("Fake wopi host request, handling PutFile: " << uriReq.getPath());

            std::streamsize size = request.getContentLength();
            LOK_ASSERT( size > 0 );

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                << "\r\n"
                << "{\"LastModifiedTime\": \"" << Util::getHttpTime(getFileLastModifiedTime()) << "\" }";

            socket->send(oss.str());
            socket->shutdown();

            LOK_ASSERT_EQUAL(static_cast<int>(Phase::SaveDoc), static_cast<int>(_phase));
            _phase = Phase::CloseDoc;

            return true;
        }


        return false;
    }


    void invokeTest() override
    {
        constexpr char testName[] = "UnitWOPITemplate";

        switch (_phase)
        {
            case Phase::LoadTemplate:
            {
                initWebsocket("/wopi/files/10?access_token=anything");

                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "load url=" + getWopiSrc(), testName);
                SocketPoll::wakeupWorld();

                _phase = Phase::SaveDoc;
                break;
            }
            case Phase::CloseDoc:
            {
                helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), "closedocument", testName);
                _phase = Phase::Polling;
                break;
            }
            case Phase::Polling:
            {
                exitTest(TestResult::Ok);
                break;
            }
            case Phase::SaveDoc:
            {
                break;
            }
        }
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitWOPITemplate();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
