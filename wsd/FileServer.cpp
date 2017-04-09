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

#include <Poco/DateTime.h>
#include <Poco/DateTimeFormat.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/Exception.h>
#include <Poco/FileStream.h>
#include <Poco/Net/HTTPCookie.h>
#include <Poco/Net/HTTPBasicCredentials.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/NameValueCollection.h>
#include <Poco/Net/NetException.h>
#include <Poco/RegularExpression.h>
#include <Poco/Runnable.h>
#include <Poco/StreamCopier.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include "Auth.hpp"
#include "Common.hpp"
#include "FileServer.hpp"
#include "LOOLWSD.hpp"
#include "Log.hpp"

using Poco::FileInputStream;
using Poco::Net::HTMLForm;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Net::NameValueCollection;
using Poco::Net::HTTPBasicCredentials;
using Poco::StreamCopier;
using Poco::Util::Application;

bool FileServerRequestHandler::tryAdminLogin(const HTTPRequest& request,
                                             HTTPResponse &response)
{
    const auto& config = Application::instance().config();
    const auto sslKeyPath = config.getString("ssl.key_file_path", "");

    NameValueCollection cookies;
    request.getCookies(cookies);
    try
    {
        const std::string jwtToken = cookies.get("jwt");
        LOG_INF("Verifying JWT token: " << jwtToken);
        JWTAuth authAgent(sslKeyPath, "admin", "admin", "admin");
        if (authAgent.verify(jwtToken))
        {
            LOG_TRC("JWT token is valid");
            return true;
        }

        LOG_INF("Invalid JWT token, let the administrator re-login");
    }
    catch (const Poco::Exception& exc)
    {
        LOG_INF("No existing JWT cookie found");
    }

    // If no cookie found, or is invalid, let admin re-login
    const auto user = config.getString("admin_console.username", "");
    const auto pass = config.getString("admin_console.password", "");
    if (user.empty() || pass.empty())
    {
        LOG_ERR("Admin Console credentials missing. Denying access until set.");
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
        // bundlify appears to add an extra /dist -> dist/dist/admin
        cookie.setPath("/loleaflet/dist/");
        cookie.setSecure(LOOLWSD::isSSLEnabled() ||
                         LOOLWSD::isSSLTermination());
        response.addCookie(cookie);

        return true;
    }

    LOG_INF("Wrong admin credentials.");
    return false;
}

void FileServerRequestHandler::handleRequest(const HTTPRequest& request, Poco::MemoryInputStream& message,
                                             const std::shared_ptr<StreamSocket>& socket)
{
    try
    {
        bool noCache = false;
        Poco::Net::HTTPResponse response;
        const auto requestPathname = Poco::Path(getRequestPathname(request));
        const auto filePath = Poco::Path(LOOLWSD::FileServerRoot, requestPathname);
        const auto file = Poco::File(filePath);
        LOG_TRC("Fileserver request: " << requestPathname.toString() << ", " <<
                "Resolved file path: " << filePath.toString());

        if (!file.exists() ||
            requestPathname[0] != "loleaflet" ||
            requestPathname[1] != "dist")
        {
            throw Poco::FileNotFoundException("Invalid URI request: [" + filePath.toString() + "].");
        }

        const auto& config = Application::instance().config();
        const std::string loleafletHtml = config.getString("loleaflet_html", "loleaflet.html");
        if (filePath.getFileName() == loleafletHtml)
        {
            preprocessAndSendLoleafletHtml(request, message, socket);
            return;
        }

        if (request.getMethod() == HTTPRequest::HTTP_GET)
        {
            if (filePath.getFileName() == "admin.html" ||
                filePath.getFileName() == "adminSettings.html" ||
                filePath.getFileName() == "adminAnalytics.html")
            {
                noCache = true;

                if (!FileServerRequestHandler::tryAdminLogin(request, response))
                    throw Poco::Net::NotAuthenticatedException("Invalid admin login");

                // Ask UAs to block if they detect any XSS attempt
                response.add("X-XSS-Protection", "1; mode=block");
            }

            const std::string fileType = filePath.getExtension();
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

            auto it = request.find("If-None-Match");
            if (it != request.end())
            {
                // if ETags match avoid re-sending the file.
                if (!noCache && !it->second.compare("\"" LOOLWSD_VERSION_HASH "\""))
                {
                    // TESTME: harder ... - do we even want ETag support ?
                    std::ostringstream oss;
                    Poco::Timestamp nowTs;
                    Poco::DateTime now(nowTs);
                    Poco::DateTime later(now.utcTime(), int64_t(1000)*1000 * 60 * 60 * 24 * 128);
                    oss << "HTTP/1.1 304 Not Modified\r\n"
                        << "Date: " << Poco::DateTimeFormatter::format(
                            now, Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
                        << "Expires: " << Poco::DateTimeFormatter::format(
                            later, Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
                        << "User-Agent: LOOLWSD WOPI Agent\r\n"
                        << "Cache-Control: max-age=11059200\r\n"
                        << "\r\n";
                    socket->send(oss.str());
                    socket->shutdown();
                    return;
                }
            }

            bool deflate = request.hasToken("Accept-Encoding", "deflate");
            HttpHelper::sendFile(socket, filePath.toString(), mimeType, response, noCache, deflate);
        }
    }
    catch (const Poco::Net::NotAuthenticatedException& exc)
    {
        LOG_ERR("FileServerRequestHandler::NotAuthenticated: " << exc.displayText());

        // Unauthorized.
        std::ostringstream oss;
        oss << "HTTP/1.1 401\r\n"
            << "Date: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
            << "User-Agent: LOOLWSD WOPI Agent\r\n"
            << "Content-Length: 0\r\n"
            << "WWW-Authenticate: Basic realm=\"online\"\r\n"
            << "\r\n";
        socket->send(oss.str());
    }
    catch (const Poco::FileAccessDeniedException& exc)
    {
        LOG_ERR("FileServerRequestHandler: " << exc.displayText());

        // TODO return some 403 page?
        std::ostringstream oss;
        oss << "HTTP/1.1 403\r\n"
            << "Date: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
            << "User-Agent: LOOLWSD WOPI Agent\r\n"
            << "Content-Length: 0\r\n"
            << "\r\n";
        socket->send(oss.str());
    }
    catch (const Poco::FileNotFoundException& exc)
    {
        LOG_ERR("FileServerRequestHandler: " << exc.displayText());

        // 404 not found
        std::ostringstream oss;
        oss << "HTTP/1.1 404\r\n"
            << "Date: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
            << "User-Agent: LOOLWSD WOPI Agent\r\n"
            << "Content-Length: 0\r\n"
            << "\r\n";
        socket->send(oss.str());
    }
}

std::string FileServerRequestHandler::getRequestPathname(const HTTPRequest& request)
{
    Poco::URI requestUri(request.getURI());
    // avoid .'s and ..'s
    requestUri.normalize();

    std::string path(requestUri.getPath());

    // Remove first foreslash as the root ends in one.
    if (path[0] == '/')
        path = path.substr(1);

    // Convert version back to a real file name.
    Poco::replaceInPlace(path, std::string("loleaflet/" LOOLWSD_VERSION_HASH "/"), std::string("loleaflet/dist/"));

    return path;
}

void FileServerRequestHandler::preprocessAndSendLoleafletHtml(const HTTPRequest& request, Poco::MemoryInputStream& message, const std::shared_ptr<StreamSocket>& socket)
{
    const auto host = ((LOOLWSD::isSSLEnabled() || LOOLWSD::isSSLTermination()) ? "wss://" : "ws://") + (LOOLWSD::ServerName.empty() ? request.getHost() : LOOLWSD::ServerName);
    const auto params = Poco::URI(request.getURI()).getQueryParameters();
    std::string wopiDomain;
    for (const auto& param : params)
    {
        if (param.first == "WOPISrc")
        {
            std::string wopiHost;
            Poco::URI::decode(param.second, wopiHost);
            wopiDomain = Poco::URI(wopiHost).getScheme() + "://" + Poco::URI(wopiHost).getHost();
        }
    }
    const auto path = Poco::Path(LOOLWSD::FileServerRoot, getRequestPathname(request));
    LOG_DBG("Preprocessing file: " << path.toString());

    if (!Poco::File(path).exists())
    {
        LOG_ERR("File [" << path.toString() << "] does not exist.");

        // 404 not found
        std::ostringstream oss;
        oss << "HTTP/1.1 404\r\n"
            << "Date: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
            << "User-Agent: LOOLWSD WOPI Agent\r\n"
            << "Content-Length: 0\r\n"
            << "\r\n";
        socket->send(oss.str());
        return;
    }

    std::string preprocess;
    FileInputStream file(path.toString());
    StreamCopier::copyToString(file, preprocess);
    file.close();

    HTMLForm form(request, message);
    const std::string& accessToken = form.get("access_token", "");
    const std::string& accessTokenTtl = form.get("access_token_ttl", "");
    LOG_TRC("access_token=" << accessToken << ", access_token_ttl=" << accessTokenTtl);

    // Escape bad characters in access token.
    // This is placed directly in javascript in loleaflet.html, we need to make sure
    // that no one can do anything nasty with their clever inputs.
    std::string escapedAccessToken;
    Poco::URI::encode(accessToken, "'", escapedAccessToken);

    unsigned long tokenTtl = 0;
    if (accessToken != "")
    {
        if (accessTokenTtl != "")
        {
            try
            {
                tokenTtl = std::stoul(accessTokenTtl);
            }
            catch(const std::exception& exc)
            {
                LOG_ERR("access_token_ttl must be represented as the number of milliseconds since January 1, 1970 UTC, when the token will expire");
            }
        }
        else
        {
            LOG_WRN("WOPI host did not pass optional access_token_ttl");
        }
    }

    Poco::replaceInPlace(preprocess, std::string("%ACCESS_TOKEN%"), escapedAccessToken);
    Poco::replaceInPlace(preprocess, std::string("%ACCESS_TOKEN_TTL%"), std::to_string(tokenTtl));
    Poco::replaceInPlace(preprocess, std::string("%HOST%"), host);
    Poco::replaceInPlace(preprocess, std::string("%VERSION%"), std::string(LOOLWSD_VERSION_HASH));

    const auto& config = Application::instance().config();
    const auto loleafletLogging = config.getString("loleaflet_logging", "false");
    Poco::replaceInPlace(preprocess, std::string("%LOLEAFLET_LOGGING%"), loleafletLogging);

    const std::string mimeType = "text/html";

    std::ostringstream oss;
    oss << "HTTP/1.1 200 OK\r\n"
        << "Date: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
        << "Last-Modified: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
        << "User-Agent: LOOLWSD WOPI Agent\r\n"
        << "Cache-Control:max-age=11059200\r\n"
        << "ETag: \"" LOOLWSD_VERSION_HASH "\"\r\n"
        << "Content-Length: " << preprocess.size() << "\r\n"
        << "Content-Type: " << mimeType << "\r\n"
        << "X-Content-Type-Options: nosniff\r\n"
        << "X-XSS-Protection: 1; mode=block\r\n";

    if (!wopiDomain.empty())
    {
        oss << "X-Frame-Options: allow-from " << wopiDomain << "\r\n";
        oss << "Content-Security-Policy: frame-ancestors " << wopiDomain << "\r\n";
    }
    else
    {
        oss << "X-Frame-Options: deny\r\n";
    }

    oss << "\r\n"
        << preprocess;

    socket->send(oss.str());
    LOG_DBG("Sent file: " << path.toString() << ": " << preprocess);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
