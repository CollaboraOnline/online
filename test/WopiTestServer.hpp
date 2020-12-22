/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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
#include <Poco/MemoryStream.h>
#include <Poco/RegularExpression.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/URI.h>
#include <Poco/Timestamp.h>
#include <Poco/Util/LayeredConfiguration.h>
#include <sstream>

class WopiTestServer : public UnitWSD
{
    enum class LOOLStatusCode
    {
        DocChanged = 1010
    };

private:
    /// The WOPISrc URL.
    std::string _wopiSrc;

    /// Websocket to communicate.
    std::unique_ptr<UnitWebSocket> _ws;

    /// Content of the file.
    std::string _fileContent;

    /// Last modified time of the file
    std::chrono::system_clock::time_point _fileLastModifiedTime;

protected:
    const std::string& getWopiSrc() const { return _wopiSrc; }

    const std::unique_ptr<UnitWebSocket>& getWs() const { return _ws; }

    const std::string& getFileContent() const { return _fileContent; }

    /// Sets the file content to a given value and update the last file modified time
    void setFileContent(const std::string& fileContent)
    {
        _fileContent = fileContent;
        _fileLastModifiedTime = std::chrono::system_clock::now();
    }

    const std::chrono::system_clock::time_point& getFileLastModifiedTime() const { return _fileLastModifiedTime; }

public:
    WopiTestServer(std::string testname, std::string fileContent = "Hello, world")
        : UnitWSD(std::move(testname))
        , _fileContent(std::move(fileContent))
    {
    }

    void initWebsocket(const std::string& wopiName)
    {
        Poco::URI wopiURL(helpers::getTestServerURI() + wopiName);

        _wopiSrc.clear();
        Poco::URI::encode(wopiURL.toString(), ":/?", _wopiSrc);

        LOG_TST("Connecting to the fake WOPI server: /lool/" << _wopiSrc << "/ws");

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

    virtual void assertRenameFileRequest(const Poco::Net::HTTPRequest& /*request*/)
    {
    }

    void configure(Poco::Util::LayeredConfiguration& config) override
    {
        UnitWSD::configure(config);
        // we're still internally confused as to https vs. http in places.
        config.setBool("storage.ssl.as_scheme", false);
    }

protected:
    /// Here we act as a WOPI server, so that we have a server that responds to
    /// the wopi requests without additional expensive setup.
    virtual bool handleHttpRequest(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& message, std::shared_ptr<StreamSocket>& socket) override
    {
        Poco::URI uriReq(request.getURI());
        Poco::RegularExpression regInfo("/wopi/files/[0-9]");
        Poco::RegularExpression regContent("/wopi/files/[0-9]/contents");

        {
            std::ostringstream oss;
            oss << "Fake wopi host request URI [" << uriReq.toString() << "]:\n";
            for (const auto& pair : request)
            {
                oss << '\t' << pair.first << ": " << pair.second << " / ";
            }

            LOG_TST(oss.str());
        }

        // CheckFileInfo
        if (request.getMethod() == "GET" && regInfo.match(uriReq.getPath()))
        {
            LOG_TST("Fake wopi host request, handling CheckFileInfo: " << uriReq.getPath());

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

            return true;
        }
        // GetFile
        else if (request.getMethod() == "GET" && regContent.match(uriReq.getPath()))
        {
            LOG_TST("Fake wopi host request, handling GetFile: " << uriReq.getPath());

            assertGetFileRequest(request);

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

            return true;
        }
        else if (request.getMethod() == "POST" && regInfo.match(uriReq.getPath()))
        {
            LOG_TST("Fake wopi host request, handling PutRelativeFile: " << uriReq.getPath());
            std::string wopiURL = helpers::getTestServerURI() + "/something wopi/files/1?access_token=anything&reuse_cookies=cook=well";
            std::string content;

            if(request.get("X-WOPI-Override") == std::string("PUT_RELATIVE"))
            {
                LOK_ASSERT_EQUAL(std::string("PUT_RELATIVE"), request.get("X-WOPI-Override"));
                assertPutRelativeFileRequest(request);
                content = "{ \"Name\":\"hello world%1.pdf\", \"Url\":\"" + wopiURL + "\" }";
            }
            else
            {
                // rename file; response should be the file name without the url and the extension
                LOK_ASSERT_EQUAL(std::string("RENAME_FILE"), request.get("X-WOPI-Override"));
                assertRenameFileRequest(request);
                content = "{ \"Name\":\"hello\", \"Url\":\"" + wopiURL + "\" }";
            }

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "Last-Modified: " << Util::getHttpTime(_fileLastModifiedTime) << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: " << content.size() << "\r\n"
                "Content-Type: application/json\r\n"
                "\r\n"
                << content;

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }
        else if (request.getMethod() == "POST" && regContent.match(uriReq.getPath()))
        {
            LOG_TST("Fake wopi host request, handling PutFile: " << uriReq.getPath());

            std::string wopiTimestamp = request.get("X-LOOL-WOPI-Timestamp");
            if (!wopiTimestamp.empty())
            {

                const std::string fileModifiedTime = Util::getIso8601FracformatTime(_fileLastModifiedTime);
                if (wopiTimestamp != fileModifiedTime)
                {
                    std::ostringstream oss;
                    oss << "HTTP/1.1 409 Conflict\r\n"
                        "User-Agent: " WOPI_AGENT_STRING "\r\n"
                        "\r\n"
                        "{\"LOOLStatusCode\":" << static_cast<int>(LOOLStatusCode::DocChanged) << '}';

                    socket->send(oss.str());
                    socket->shutdown();
                    return true;
                }
            }

            std::streamsize size = request.getContentLength();
            char buffer[size];
            message.read(buffer, size);
            setFileContent(std::string(buffer, size));

            assertPutFileRequest(request);

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "\r\n"
                "{\"LastModifiedTime\": \"" << Util::getIso8601FracformatTime(_fileLastModifiedTime) << "\" }";

            socket->send(oss.str());
            socket->shutdown();

            return true;
        }

        return false;
    }

};

/// Send a command message to WSD from a WopiTestServer.
#define WSD_CMD(MSG)                                                                               \
    do                                                                                             \
    {                                                                                              \
        LOG_TST(": Sending: " << MSG);                                                             \
        helpers::sendTextFrame(*getWs()->getLOOLWebSocket(), MSG, testname);                       \
    } while (false)

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
