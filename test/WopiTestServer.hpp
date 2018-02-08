/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include "helpers.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "UnitHTTP.hpp"


#include <Poco/DateTimeFormat.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/JSON/Object.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/URI.h>
#include <Poco/Timestamp.h>

class WopiTestServer : public UnitWSD
{
protected:
    /// The WOPISrc URL.
    std::string _wopiSrc;

    /// Websocket to communicate.
    std::unique_ptr<UnitWebSocket> _ws;

    /// Content of the file.
    std::string _fileContent;

    /// Last modified time of the file
    Poco::Timestamp _fileLastModifiedTime;

public:
    WopiTestServer(std::string fileContent = "Hello, world")
        : UnitWSD()
        , _fileContent(fileContent)
    {
    }

    void initWebsocket(std::string wopiName)
    {
        Poco::URI wopiURL(helpers::getTestServerURI() + wopiName);

        _wopiSrc = "";
        Poco::URI::encode(wopiURL.toString(), ":/?", _wopiSrc);
        Poco::URI loolUri(helpers::getTestServerURI());

        LOG_INF("Connecting to the fake WOPI server: /lool/" << _wopiSrc << "/ws");

        _ws.reset(new UnitWebSocket("/lool/" + _wopiSrc + "/ws"));
        assert(_ws.get());
    }

    virtual void assertCheckFileInfoRequest(const Poco::Net::HTTPRequest& /*request*/)
    {
    }

    virtual void assertGetFileRequest(const Poco::Net::HTTPRequest& /*request*/)
    {
    }

    virtual void assertPutFileRequest(const Poco::Net::HTTPRequest& /*request*/)
    {
    }

    virtual void assertPutRelativeFileRequest(const Poco::Net::HTTPRequest& /*request*/)
    {
    }

protected:
    /// Here we act as a WOPI server, so that we have a server that responds to
    /// the wopi requests without additional expensive setup.
    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& request, std::shared_ptr<StreamSocket>& socket) override
    {
        Poco::URI uriReq(request.getURI());
        LOG_INF("Fake wopi host request: " << uriReq.toString());

        // CheckFileInfo
        if (request.getMethod() == "GET" && (uriReq.getPath() == "/wopi/files/0" || uriReq.getPath() == "/wopi/files/1"))
        {
            LOG_INF("Fake wopi host request, handling CheckFileInfo: " << uriReq.getPath());

            assertCheckFileInfoRequest(request);

            Poco::LocalDateTime now;
            Poco::JSON::Object::Ptr fileInfo = new Poco::JSON::Object();
            fileInfo->set("BaseFileName", "hello.txt");
            fileInfo->set("Size", _fileContent.size());
            fileInfo->set("Version", "1.0");
            fileInfo->set("OwnerId", "test");
            fileInfo->set("UserId", "test");
            fileInfo->set("UserFriendlyName", "test");
            fileInfo->set("UserCanWrite", "true");
            fileInfo->set("PostMessageOrigin", "localhost");
            fileInfo->set("LastModifiedTime", Poco::DateTimeFormatter::format(_fileLastModifiedTime, Poco::DateTimeFormat::ISO8601_FORMAT));
            fileInfo->set("EnableOwnerTermination", "true");

            std::ostringstream jsonStream;
            fileInfo->stringify(jsonStream);
            std::string responseString = jsonStream.str();

            const std::string mimeType = "application/json; charset=utf-8";

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "Last-Modified: " << Poco::DateTimeFormatter::format(_fileLastModifiedTime, Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
                << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                << "Content-Length: " << responseString.size() << "\r\n"
                << "Content-Type: " << mimeType << "\r\n"
                << "\r\n"
                << responseString;

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }
        // GetFile
        else if (request.getMethod() == "GET" && (uriReq.getPath() == "/wopi/files/0/contents" || uriReq.getPath() == "/wopi/files/1/contents"))
        {
            LOG_INF("Fake wopi host request, handling GetFile: " << uriReq.getPath());

            assertGetFileRequest(request);

            const std::string mimeType = "text/plain; charset=utf-8";

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "Last-Modified: " << Poco::DateTimeFormatter::format(_fileLastModifiedTime, Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
                << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                << "Content-Length: " << _fileContent.size() << "\r\n"
                << "Content-Type: " << mimeType << "\r\n"
                << "\r\n"
                << _fileContent;

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }
        else if (request.getMethod() == "POST" && (uriReq.getPath() == "/wopi/files/0" || uriReq.getPath() == "/wopi/files/1"))
        {
            LOG_INF("Fake wopi host request, handling PutRelativeFile: " << uriReq.getPath());

            CPPUNIT_ASSERT_EQUAL(std::string("PUT_RELATIVE"), request.get("X-WOPI-Override"));

            assertPutRelativeFileRequest(request);

            std::string wopiURL = helpers::getTestServerURI() + "/something wopi/files/1?access_token=anything";
            std::string content = "{ \"Name\":\"hello world.pdf\", \"Url\":\"" + wopiURL + "\" }";

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "Last-Modified: " << Poco::DateTimeFormatter::format(_fileLastModifiedTime, Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
                << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                << "Content-Length: " << content.size() << "\r\n"
                << "Content-Type: application/json\r\n"
                << "\r\n"
                << content;

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }
        else if (request.getMethod() == "POST" && (uriReq.getPath() == "/wopi/files/0/contents" || uriReq.getPath() == "/wopi/files/1/contents"))
        {
            LOG_INF("Fake wopi host request, handling PutFile: " << uriReq.getPath());

            assertPutFileRequest(request);

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                << "Last-Modified: " << Poco::DateTimeFormatter::format(_fileLastModifiedTime, Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
                << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                << "\r\n";

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }

        return false;
    }

};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
