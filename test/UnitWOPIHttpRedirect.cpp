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
        GetFile,
        Redirected2,
        Loaded
    } _phase;

    const std::string params = "access_token=anything";
    static constexpr auto testname = "UnitWopiHttpRedirect";

protected:
    void assertGetFileRequest(const Poco::Net::HTTPRequest&) override
    {
        exitTest(TestResult::Ok);
    }

public:
    UnitWopiHttpRedirect()
        : _phase(Phase::Load)
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

        LOG_INF("Fake wopi host request URI [" << uriReq.toString() << "]:\n");

        // CheckFileInfo - returns redirect response
        if (request.getMethod() == "GET" && regInfo.match(uriReq.getPath()))
        {
            LOG_INF("Fake wopi host request, handling CheckFileInfo (1/2)");

            assertCheckFileInfoRequest(request);

            LOK_ASSERT_MESSAGE("Expected to be in Phase::Load", _phase == Phase::Load);
            _phase = Phase::Redirected;

            std::ostringstream oss;
            oss << "HTTP/1.1 302 Found\r\n"
                "Location: " << helpers::getTestServerURI() << redirectUri << "?" << params << "\r\n"
                "\r\n";

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }
        // CheckFileInfo - for redirected URI
        else if (request.getMethod() == "GET" && regRedirected.match(uriReq.getPath()))
        {
            LOG_INF("Fake wopi host request, handling CheckFileInfo: (2/2)");

            assertCheckFileInfoRequest(request);

            LOK_ASSERT_MESSAGE("Expected to be in Phase::Redirected or Phase::Loaded", _phase == Phase::Redirected || _phase == Phase::Loaded);
            if (_phase == Phase::Redirected)
                _phase = Phase::GetFile;

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

            return true;
        }
        // GetFile - first try
        else if (request.getMethod() == "GET" && regContents.match(uriReq.getPath()))
        {
            LOG_TST("Fake wopi host request, handling GetFile: " << uriReq.getPath());

            assertGetFileRequest(request);

            LOK_ASSERT_MESSAGE("Expected to be in Phase::GetFile", _phase == Phase::GetFile);
            _phase = Phase::Redirected2;

            std::ostringstream oss;
            oss << "HTTP/1.1 302 Found\r\n"
                "Location: " << helpers::getTestServerURI() << redirectUri2 << "?" << params << "\r\n"
                "\r\n";

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }
        // GetFile - redirected
        else if (request.getMethod() == "GET" && regContentsRedirected.match(uriReq.getPath()))
        {
            LOG_TST("Fake wopi host request, handling GetFile: " << uriReq.getPath());

            assertGetFileRequest(request);

            LOK_ASSERT_MESSAGE("Expected to be in Phase::Redirected2", _phase == Phase::Redirected2);
            _phase = Phase::Loaded;

            const std::string mimeType = "text/plain; charset=utf-8";

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "Last-Modified: " << Util::getHttpTime(_fileLastModifiedTime) << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: " << _fileContent.size() << "\r\n"
                "Content-Type: " << mimeType << "\r\n"
                "\r\n"
                << _fileContent;

            socket->send(oss.str());
            socket->shutdown();

            exitTest(TestResult::Ok);

            return true;
        }

        return WopiTestServer::handleHttpRequest(request, message, socket);
    }

    void invokeTest() override
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
            case Phase::Redirected2:
            case Phase::GetFile:
            {
                break;
            }
            case Phase::Loaded:
            {
                exitTest(TestResult::Ok);
                break;
            }
        }
    }
};

UnitBase* unit_create_wsd(void) { return new UnitWopiHttpRedirect(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
