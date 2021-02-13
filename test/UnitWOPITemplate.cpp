/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <Poco/Net/HTTPRequest.h>

#include <WopiTestServer.hpp>
#include <Log.hpp>
#include <Unit.hpp>
#include <UnitHTTP.hpp>
#include <helpers.hpp>
#include <net/HttpHelper.hpp>

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
    UnitWOPITemplate()
        : WopiTestServer("UnitWOPITemplate")
        , _phase(Phase::LoadTemplate)
    {
    }

    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& /*message*/, std::shared_ptr<StreamSocket>& socket) override
    {
        const Poco::URI uriReq(request.getURI());
        LOG_TST("Fake wopi host " << request.getMethod() << " request: " << uriReq.toString());

        // CheckFileInfo
        if (request.getMethod() == "GET" && uriReq.getPath() == "/wopi/files/10")
        {
            LOG_TST("Fake wopi host request, handling CheckFileInfo: " << uriReq.getPath());

            Poco::LocalDateTime now;
            Poco::JSON::Object::Ptr fileInfo = new Poco::JSON::Object();
            fileInfo->set("BaseFileName", "test.odt");
            fileInfo->set("TemplateSource", helpers::getTestServerURI() + "/test.ott");
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
            LOG_TST("Fake wopi host request, handling template GetFile: " << uriReq.getPath());

            HttpHelper::sendFileAndShutdown(socket, TDOC "/test.ott", "");

            return true;
        }
        // Save template
        else if (request.getMethod() == "POST" && uriReq.getPath() == "/wopi/files/10/contents")
        {
            LOG_TST("Fake wopi host request, handling PutFile: " << uriReq.getPath());

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


    void invokeWSDTest() override
    {
        switch (_phase)
        {
            case Phase::LoadTemplate:
            {
                _phase = Phase::SaveDoc;

                initWebsocket("/wopi/files/10?access_token=anything");
                WSD_CMD("load url=" + getWopiSrc());

                SocketPoll::wakeupWorld();
                break;
            }
            case Phase::CloseDoc:
            {
                _phase = Phase::Polling;
                WSD_CMD("closedocument");
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
