/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_FILE_SERVER_HPP
#define INCLUDED_FILE_SERVER_HPP

#include <string>
#include <vector>

#include <Poco/Net/NetException.h>

#include <Poco/Net/HTTPCookie.h>
#include <Poco/Net/HTTPBasicCredentials.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPRequestHandler.h>
#include <Poco/Net/HTTPServer.h>
#include <Poco/Net/HTTPServerParams.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTTPServerResponse.h>
#include <Poco/Net/SecureServerSocket.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Runnable.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>
#include <Poco/Util/ServerApplication.h>
#include <Poco/Util/Timer.h>

#include "Common.hpp"

using Poco::Net::HTTPRequest;
using Poco::Net::HTTPRequestHandler;
using Poco::Net::HTTPRequestHandlerFactory;
using Poco::Net::HTTPResponse;
using Poco::Net::HTTPServerParams;
using Poco::Net::HTTPServerRequest;
using Poco::Net::HTTPServerResponse;
using Poco::Net::SecureServerSocket;
using Poco::Net::HTTPBasicCredentials;
using Poco::Util::Application;

class FileServerRequestHandler: public HTTPRequestHandler
{
public:
    void handleRequest(HTTPServerRequest& request, HTTPServerResponse& response) override
    {
        try
        {
            Poco::URI requestUri(request.getURI());
            std::vector<std::string> requestSegments;
            requestUri.getPathSegments(requestSegments);

            // FIXME: We might want to package all dist files from leaflet to some other dir (?)
            const std::string loleafletPath = Poco::Path(Application::instance().commandPath()).parent().parent().toString() + "loleaflet";
            const std::string endPoint = requestSegments[requestSegments.size() - 1];

            if (request.getMethod() == HTTPRequest::HTTP_GET)
            {
                // FIXME: Some nice way to ask for credentials for protected files
                if (endPoint == "admin.html" ||
                    endPoint == "adminSettings.html" ||
                    endPoint == "adminAnalytics.html")
                {
                    HTTPBasicCredentials credentials(request);
                    // TODO: Read username and password from config file
                    if (credentials.getUsername() == "admin"
                        && credentials.getPassword() == "admin")
                    {
                        const std::string htmlMimeType = "text/html";
                        // generate and set the cookie
                        const std::string keyPath = Poco::Path(Application::instance().commandPath()).parent().toString() + SSL_KEY_FILE;
                        JWTAuth authAgent(keyPath, "admin", "admin", "admin");
                        const std::string jwtToken = authAgent.getAccessToken();
                        Poco::Net::HTTPCookie cookie("jwt", jwtToken);
                        response.addCookie(cookie);
                        response.setContentType(htmlMimeType);
                        response.sendFile(loleafletPath + "/debug/document/" + endPoint, htmlMimeType);
                    }
                    else
                    {
                        Log::info("Wrong admin credentials.");
                        throw Poco::Net::NotAuthenticatedException("Wrong credentials.");
                    }
                }
                else if (requestSegments.size() > 1 && requestSegments[0] == "dist")
                {
                    const std::string filePath = requestUri.getPath();
                    const std::size_t extPoint = endPoint.find_last_of(".");
                    if (extPoint == std::string::npos)
                        return;

                    const std::string fileType = endPoint.substr(extPoint + 1);
                    std::string mimeType;
                    if (fileType == "js")
                        mimeType = "application/javascript";
                    else if (fileType == "css")
                        mimeType = "text/css";
                    else
                        mimeType = "text/plain";

                    response.setContentType(mimeType);
                    response.sendFile(loleafletPath + request.getURI(), mimeType);
                }
                else
                {
                    throw Poco::FileNotFoundException("");
                }
            }
        }
        catch (Poco::Net::NotAuthenticatedException& exc)
        {
            Log::info ("FileServerRequestHandler::NotAuthenticated");
            response.set("WWW-Authenticate", "Basic realm=\"online\"");
            response.setStatus(HTTPResponse::HTTP_UNAUTHORIZED);
            response.setContentLength(0);
            response.send();
        }
        catch (Poco::FileNotFoundException& exc)
        {
            Log::info("FileServerRequestHandler:: File " + request.getURI() + " not found.");
            response.setStatus(HTTPResponse::HTTP_NOT_FOUND);
            response.setContentLength(0);
            response.send();
        }
    }
};

class FileServer
{
public:
    FileServer()
    {
        Log::info("File server ctor.");
    }

    ~FileServer()
    {
        Log::info("File Server dtor.");
    }

    FileServerRequestHandler* createRequestHandler()
    {
        return new FileServerRequestHandler();
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
