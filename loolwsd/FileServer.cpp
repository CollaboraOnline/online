/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <string>
#include <vector>

#include <Poco/Exception.h>
#include <Poco/FileStream.h>
#include <Poco/Net/HTTPCookie.h>
#include <Poco/Net/HTTPBasicCredentials.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPRequestHandler.h>
#include <Poco/Net/HTTPServer.h>
#include <Poco/Net/HTTPServerParams.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTTPServerResponse.h>
#include <Poco/Net/NameValueCollection.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/SecureServerSocket.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/RegularExpression.h>
#include <Poco/Runnable.h>
#include <Poco/StreamCopier.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>
#include <Poco/Util/ServerApplication.h>
#include <Poco/Util/Timer.h>

#include "Common.hpp"
#include "FileServer.hpp"
#include "LOOLWSD.hpp"

using Poco::FileInputStream;
using Poco::Net::HTMLForm;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Net::HTTPServerRequest;
using Poco::Net::HTTPServerResponse;
using Poco::Net::NameValueCollection;
using Poco::Net::HTTPBasicCredentials;
using Poco::StreamCopier;
using Poco::Util::Application;

bool FileServerRequestHandler::isAdminLoggedIn(HTTPServerRequest& request, HTTPServerResponse& response)
{
    const auto& config = Application::instance().config();
    const auto sslKeyPath = config.getString("ssl.key_file_path", "");

    NameValueCollection cookies;
    request.getCookies(cookies);
    try
    {
        const std::string jwtToken = cookies.get("jwt");
        Log::info("Verifying JWT token: " + jwtToken);
        JWTAuth authAgent(sslKeyPath, "admin", "admin", "admin");
        if (authAgent.verify(jwtToken))
        {
            Log::trace("JWT token is valid");
            return true;
        }

        Log::info("Invalid JWT token, let the administrator re-login");
    }
    catch (const Poco::Exception& exc)
    {
        Log::info("No existing JWT cookie found");
    }

    // If no cookie found, or is invalid, let admin re-login
    const auto user = config.getString("admin_console.username", "");
    const auto pass = config.getString("admin_console.password", "");
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
        JWTAuth authAgent(sslKeyPath, "admin", "admin", "admin");
        const std::string jwtToken = authAgent.getAccessToken();
        Poco::Net::HTTPCookie cookie("jwt", jwtToken);
        cookie.setPath("/loleaflet/dist/admin/");
        cookie.setSecure(true);
        response.addCookie(cookie);

        return true;
    }

    Log::info("Wrong admin credentials.");
    return false;
}

void FileServerRequestHandler::handleRequest(HTTPServerRequest& request, HTTPServerResponse& response)
{
    try
    {
        Poco::URI requestUri(request.getURI());
        Log::trace("Fileserver request: " + requestUri.toString());
        requestUri.normalize(); // avoid .'s and ..'s

        std::vector<std::string> requestSegments;
        requestUri.getPathSegments(requestSegments);
        if (requestSegments.size() < 1)
        {
            throw Poco::FileNotFoundException("Invalid URI request: [" + requestUri.toString() + "].");
        }

        const auto& config = Application::instance().config();
        const std::string loleafletHtml = config.getString("loleaflet_html", "loleaflet.html");
        const std::string endPoint = requestSegments[requestSegments.size() - 1];
        if (endPoint == loleafletHtml)
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

            const auto path = Poco::Path(LOOLWSD::FileServerRoot, getRequestPathname(request));
            const auto filepath = path.absolute().toString();
            if (filepath.find(LOOLWSD::FileServerRoot) != 0)
            {
                // Accessing unauthorized path.
                throw Poco::FileAccessDeniedException("Invalid or forbidden file path: [" + filepath + "].");
            }

            const std::size_t extPoint = endPoint.find_last_of('.');
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
            else if (fileType == "svg")
                mimeType = "image/svg+xml";
            else
                mimeType = "text/plain";

            response.setContentType(mimeType);
            response.sendFile(filepath, mimeType);
        }
    }
    catch (const Poco::Net::NotAuthenticatedException& exc)
    {
        Log::error("FileServerRequestHandler::NotAuthenticated: " + exc.displayText());
        response.set("WWW-Authenticate", "Basic realm=\"online\"");
        response.setStatusAndReason(HTTPResponse::HTTP_UNAUTHORIZED);
        response.setContentLength(0);
        response.send();
    }
    catch (const Poco::FileAccessDeniedException& exc)
    {
        Log::error("FileServerRequestHandler: " + exc.displayText());
        response.setStatusAndReason(HTTPResponse::HTTP_FORBIDDEN);
        response.setContentLength(0); // TODO return some 403 page?
        response.send();
    }
    catch (const Poco::FileNotFoundException& exc)
    {
        Log::error("FileServerRequestHandler: " + exc.displayText());
        response.setStatusAndReason(HTTPResponse::HTTP_NOT_FOUND);
        response.setContentLength(0); // TODO return some 404 page?
        response.send();
    }
}

std::string FileServerRequestHandler::getRequestPathname(const HTTPServerRequest& request)
{
    Poco::URI requestUri(request.getURI());
    // avoid .'s and ..'s
    requestUri.normalize();

    std::string path(requestUri.getPath());

    // convert version back to a real file name
    Poco::replaceInPlace(path, std::string("/loleaflet/" LOOLWSD_VERSION_HASH "/"), std::string("/loleaflet/dist/"));

    return path;
}

void FileServerRequestHandler::preprocessFile(HTTPServerRequest& request, HTTPServerResponse& response) throw(Poco::FileAccessDeniedException)
{
    HTMLForm form(request, request.stream());

    const auto host = ((LOOLWSD::isSSLEnabled() || LOOLWSD::isSSLTermination()) ? "wss://" : "ws://") + (LOOLWSD::ServerName.empty() ? request.getHost() : LOOLWSD::ServerName);
    const auto path = Poco::Path(LOOLWSD::FileServerRoot, getRequestPathname(request));
    Log::debug("Preprocessing file: " + path.toString());

    if (!Poco::File(path).exists())
    {
        Log::error("File [" + path.toString() + "] does not exist.");
        response.setStatusAndReason(HTTPResponse::HTTP_NOT_FOUND);
        response.setContentLength(0); // TODO return some 404 page?
        response.send();
        return;
    }

    std::string preprocess;
    FileInputStream file(path.toString());
    StreamCopier::copyToString(file, preprocess);
    file.close();

    const std::string& accessToken = form.get("access_token", "");
    const std::string& accessTokenTtl = form.get("access_token_ttl", "");

    // Escape bad characters in access token.
    // This is placed directly in javascript in loleaflet.html, we need to make sure
    // that no one can do anything nasty with their clever inputs.
    std::string escapedAccessToken;
    Poco::URI::encode(accessToken, "'", escapedAccessToken);

    Poco::replaceInPlace(preprocess, std::string("%ACCESS_TOKEN%"), escapedAccessToken);
    Poco::replaceInPlace(preprocess, std::string("%ACCESS_TOKEN_TTL%"), accessTokenTtl);
    Poco::replaceInPlace(preprocess, std::string("%HOST%"), host);
    Poco::replaceInPlace(preprocess, std::string("%VERSION%"), std::string(LOOLWSD_VERSION_HASH));

    response.setContentType("text/html");
    response.setContentLength(preprocess.length());
    response.setChunkedTransferEncoding(false);

    std::ostream& ostr = response.send();
    ostr << preprocess;
}

FileServer::FileServer()
{
    Log::info("FileServer ctor.");
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
