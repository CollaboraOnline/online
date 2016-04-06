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
#include "LOOLWSD.hpp"

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
    /// Evaluate if the cookie exists, and if not, ask for the credentials.
    static bool isAdminLoggedIn(HTTPServerRequest& request, HTTPServerResponse& response)
    {
        if (request.find("Cookie") != request.end())
        {
            // FIXME: Handle other cookie params like '; httponly; secure'
            const std::size_t pos = request["Cookie"].find_first_of("=");
            if (pos == std::string::npos)
                throw Poco::Net::NotAuthenticatedException("Missing JWT");

            const std::string jwtToken = request["Cookie"].substr(pos + 1);
            Log::info("Verifying JWT token: " + jwtToken);
            // TODO: Read key from configuration file
            const std::string keyPath = "/etc/loolwsd/" + std::string(SSL_KEY_FILE);
            JWTAuth authAgent(keyPath, "admin", "admin", "admin");
            if (authAgent.verify(jwtToken))
            {
                Log::trace("JWT token is valid");
                return true;
            }

            Log::info("Invalid JWT token, let the administrator re-login");
        }

        HTTPBasicCredentials credentials(request);

        // TODO: Read username and password from config file
        if (credentials.getUsername() == "admin"
                && credentials.getPassword() == "admin")
        {
            const std::string htmlMimeType = "text/html";
            // generate and set the cookie
            // TODO: Read key from configuration file
            const std::string keyPath = "/etc/loolwsd/" + std::string(SSL_KEY_FILE);
            JWTAuth authAgent(keyPath, "admin", "admin", "admin");
            const std::string jwtToken = authAgent.getAccessToken();
            Poco::Net::HTTPCookie cookie("jwt", jwtToken);
            cookie.setPath("/adminws/");
            cookie.setSecure(true);
            cookie.setHttpOnly(true);
            response.addCookie(cookie);

            return true;
        }

        Log::info("Wrong admin credentials.");
        return false;
    }

    void handleRequest(HTTPServerRequest& request, HTTPServerResponse& response) override
    {
        try
        {
            Poco::URI requestUri(request.getURI());
            std::vector<std::string> requestSegments;
            requestUri.getPathSegments(requestSegments);

            // TODO: We might want to package all files from leaflet to some other dir and restrict
            // file serving to it (?)
            const std::string endPoint = requestSegments[requestSegments.size() - 1];

            if (request.getMethod() == HTTPRequest::HTTP_GET)
            {
                if (endPoint == "admin.html" ||
                    endPoint == "adminSettings.html" ||
                    endPoint == "adminAnalytics.html")
                {
                    if (!FileServerRequestHandler::isAdminLoggedIn(request, response))
                        throw Poco::Net::NotAuthenticatedException("Invalid admin login");
                }

                const std::string filePath = requestUri.getPath();
                const std::size_t extPoint = endPoint.find_last_of(".");
                if (extPoint == std::string::npos)
                    throw Poco::FileNotFoundException("Invalid file.");

                const std::string fileType = endPoint.substr(extPoint + 1);
                std::string mimeType;
                if (fileType == "js")
                    mimeType = "application/javascript";
                else if (fileType == "css")
                    mimeType = "text/css";
                else if (fileType == "html")
                    mimeType = "text/html";
                else
                    mimeType = "text/plain";

                response.setContentType(mimeType);
                response.sendFile(LOOLWSD::FileServerRoot + requestUri.getPath(), mimeType);
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
