/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_FILESERVER_HPP
#define INCLUDED_FILESERVER_HPP

#include <string>
#include <vector>

#include <Poco/Net/NetException.h>

#include <Poco/Net/HTTPCookie.h>
#include <Poco/Net/HTTPBasicCredentials.h>
#include <Poco/Net/HTMLForm.h>
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
#include <Poco/FileStream.h>
#include <Poco/StreamCopier.h>
#include <Poco/Util/ServerApplication.h>
#include <Poco/Util/Timer.h>

#include "Common.hpp"
#include "LOOLWSD.hpp"

using Poco::Net::HTMLForm;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPRequestHandler;
using Poco::Net::HTTPRequestHandlerFactory;
using Poco::Net::HTTPResponse;
using Poco::Net::HTTPServerParams;
using Poco::Net::HTTPServerRequest;
using Poco::Net::HTTPServerResponse;
using Poco::Net::SecureServerSocket;
using Poco::Net::HTTPBasicCredentials;
using Poco::FileInputStream;
using Poco::StreamCopier;
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

        const auto user = Application::instance().config().getString("admin_console_username", "");
        const auto pass = Application::instance().config().getString("admin_console_password", "");
        if (user.empty() || pass.empty())
        {
            Log::error("Admin Console credentials missing. Denying access until set.");
            return false;
        }

        HTTPBasicCredentials credentials(request);
        if (credentials.getUsername() == user &&
            credentials.getPassword() == pass)
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

    void preprocessFile(HTTPServerRequest& request, HTTPServerResponse& response)
    {
        HTMLForm form(request, request.stream());

        std::string preprocess;
        const auto host = (LOOLWSD::SSLEnabled? "wss://": "ws://") + request.getHost();

        Poco::URI requestUri(request.getURI());
        requestUri.normalize(); // avoid .'s and ..'s
        const auto path = Poco::Path(LOOLWSD::FileServerRoot, requestUri.getPath());

        const auto wopi = form.has("WOPISrc") ?
                          form.get("WOPISrc") + "?access_token=" + form.get("access_token","") : "";

        Log::debug("Preprocessing file: " + path.toString());

        FileInputStream file(path.toString());
        StreamCopier::copyToString(file, preprocess);
        file.close();

        Poco::replaceInPlace(preprocess, std::string("WOPISRC"), wopi);
        Poco::replaceInPlace(preprocess, std::string("HOST"), form.get("host", host));
        Poco::replaceInPlace(preprocess, std::string("FILEPATH"), form.get("file_path", ""));
        Poco::replaceInPlace(preprocess, std::string("TITLE"), form.get("title", ""));
        Poco::replaceInPlace(preprocess, std::string("PERMISSION"), form.get("permission", ""));
        Poco::replaceInPlace(preprocess, std::string("TIMESTAMP"), form.get("timestamp", ""));
        Poco::replaceInPlace(preprocess, std::string("CLOSEBUTTON"), form.get("closebutton", ""));

        response.setContentType("text/html");
        response.setContentLength(preprocess.length());
        response.setChunkedTransferEncoding(false);

        std::ostream& ostr = response.send();
        ostr << preprocess;
    }

    void handleRequest(HTTPServerRequest& request, HTTPServerResponse& response) override
    {
        try
        {
            Poco::URI requestUri(request.getURI());
            requestUri.normalize(); // avoid .'s and ..'s

            std::vector<std::string> requestSegments;
            requestUri.getPathSegments(requestSegments);
            if (requestSegments.size() < 1)
            {
                throw Poco::FileNotFoundException("Invalid file.");
            }

            const std::string endPoint = requestSegments[requestSegments.size() - 1];
            if (endPoint == "loleaflet.html")
            {
                preprocessFile(request, response);
                return;
            }

            if (request.getMethod() == HTTPRequest::HTTP_GET)
            {
                if (endPoint == "admin.html" ||
                    endPoint == "adminSettings.html" ||
                    endPoint == "adminAnalytics.html")
                {
                    if (!FileServerRequestHandler::isAdminLoggedIn(request, response))
                        throw Poco::Net::NotAuthenticatedException("Invalid admin login");
                }

                const auto path = Poco::Path(LOOLWSD::FileServerRoot, requestUri.getPath());
                const auto filepath = path.absolute().toString();
                if (filepath.find(LOOLWSD::FileServerRoot) != 0)
                {
                    // Accessing unauthorized path.
                    throw Poco::FileNotFoundException("Invalid file path.");
                }

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
                response.sendFile(filepath, mimeType);
            }
        }
        catch (Poco::Net::NotAuthenticatedException& exc)
        {
            Log::error("FileServerRequestHandler::NotAuthenticated");
            response.set("WWW-Authenticate", "Basic realm=\"online\"");
            response.setStatus(HTTPResponse::HTTP_UNAUTHORIZED);
            response.setContentLength(0);
            response.send();
        }
        catch (Poco::FileNotFoundException& exc)
        {
            Log::error("FileServerRequestHandler:: File [" + request.getURI() + "] not found.");
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
