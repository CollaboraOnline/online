/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

//#include "Exceptions.hpp"
#include "Log.hpp"
#include "Unit.hpp"
#include "helpers.hpp"
#include <Poco/JSON/Object.h>
#include <Poco/LocalDateTime.h>
#include <Poco/DateTimeFormat.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPServer.h>
#include <Poco/Net/HTTPRequestHandlerFactory.h>
#include <Poco/Net/HTTPRequestHandler.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTTPServerResponse.h>
#include <Poco/Net/HTTPServerParams.h>
#include <Poco/Net/ServerSocket.h>
#include <Poco/Net/OAuth20Credentials.h>

using Poco::DateTimeFormatter;
using Poco::DateTimeFormat;
using Poco::JSON::Object;
using Poco::Net::HTTPServer;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Net::HTTPRequestHandlerFactory;
using Poco::Net::HTTPRequestHandler;
using Poco::Net::HTTPServerRequest;
using Poco::Net::HTTPServerResponse;
using Poco::Net::HTTPServerParams;
using Poco::Net::OAuth20Credentials;
using Poco::Net::ServerSocket;

class WopiHostRequestHandler: public HTTPRequestHandler
{
public:
    void handleRequest(HTTPServerRequest& request, HTTPServerResponse& response)
    {
        Poco::URI uriReq(request.getURI());

        // The resource server MUST validate the access token
        // and ensure that it has not expired and that its scope
        // covers the requested resource.
        OAuth20Credentials creds(request);
        assert (creds.getBearerToken() == "s3hn3ct0k3v");

        // CheckFileInfo
        if (uriReq.getPath() == "/wopi/files/0")
        {
            Poco::LocalDateTime now;
            Object::Ptr fileInfo = new Object();
            fileInfo->set("BaseFileName", "empty.odt");
            fileInfo->set("Size", "1024");
            fileInfo->set("Version", "1.0");
            fileInfo->set("OwnerId", "test");
            fileInfo->set("UserId", "test");
            fileInfo->set("UserFriendlyName", "test");
            fileInfo->set("UserCanWrite", "true");
            fileInfo->set("PostMessageOrigin", "localhost");
            fileInfo->set("LastModifiedTime", DateTimeFormatter::format(now, DateTimeFormat::ISO8601_FORMAT));

            std::ostringstream oss;
            fileInfo->stringify(oss);
            response.setContentType("application/json; charset=utf-8");
            std::ostream& ostr = response.send();
            ostr << oss.str();
        }
        // GetFile
        else if (uriReq.getPath() == "/wopi/files/0/contents")
        {
            response.sendFile(Poco::Path(TDOC, "empty.odt").toString(), "application/vnd.oasis.opendocument.text");
            response.setStatusAndReason(HTTPResponse::HTTP_OK);
        }
    }

};

class WopiHostRequestHandlerFactory: public HTTPRequestHandlerFactory
{
public:
    HTTPRequestHandler* createRequestHandler(const HTTPServerRequest& /*request*/)
    {
        return new WopiHostRequestHandler();
    }
};


class UnitOAuth : public UnitWSD
{
public:
    UnitOAuth()
    {
    }

    virtual void configure(Poco::Util::LayeredConfiguration& /*config*/) override
    {
    }

    void invokeTest() override
    {
        HTTPResponse response;
        ServerSocket wopiSocket(0);
        HTTPServerParams* wopiParams = new HTTPServerParams();
        wopiParams->setKeepAlive(false);
        HTTPServer fakeWopiHost(new WopiHostRequestHandlerFactory, wopiSocket, wopiParams);
        fakeWopiHost.start();

        std::string WopiSrc;
        const std::string testName = "UnitOAuth ";

        // RFC 6749
        // 7. Accessing Protected Resources
        // The client accesses protected resources by presenting the access
        // token (access_token) to the resource server.
        Poco::URI wopiURL("http://localhost/wopi/files/0?access_token=s3hn3ct0k3v");
        wopiURL.setPort(wopiSocket.address().port());
        Poco::URI::encode(wopiURL.toString(), ":/?", WopiSrc);
        Poco::URI loolUri(helpers::getTestServerURI());
        HTTPRequest request(HTTPRequest::HTTP_GET, "lool/" + WopiSrc + "/ws");

        auto socket = helpers::connectLOKit(loolUri, request, response);
        helpers::sendTextFrame(socket, "load url=" + WopiSrc, testName);

        const auto status = helpers::assertResponseString(socket, "status:", testName);

        Poco::Thread::sleep(1000);
        fakeWopiHost.stop();

        exitTest(TestResult::Ok);
    }
};

UnitBase *unit_create_wsd(void)
{
    return new UnitOAuth();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
