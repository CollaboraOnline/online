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
#include <unistd.h>
#include <sys/stat.h>
#include <dirent.h>
#include <zlib.h>

#include <Poco/DateTime.h>
#include <Poco/DateTimeFormat.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/Exception.h>
#include <Poco/FileStream.h>
#include <Poco/Net/HTTPCookie.h>
#include <Poco/Net/HTTPBasicCredentials.h>
#include <Poco/Net/HTTPResponse.h>
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

std::map<std::string, std::pair<std::string, std::string>> FileServerRequestHandler::FileHash;

bool FileServerRequestHandler::isAdminLoggedIn(const HTTPRequest& request,
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
        Poco::URI requestUri(request.getURI());
        LOG_TRC("Fileserver request: " << requestUri.toString());
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
            preprocessFile(request, message, socket);
            return;
        }

        if (request.getMethod() == HTTPRequest::HTTP_GET)
        {
            if (endPoint == "admin.html" ||
                endPoint == "adminSettings.html" ||
                endPoint == "adminAnalytics.html")
            {
                noCache = true;

                if (!FileServerRequestHandler::isAdminLoggedIn(request, response))
                    throw Poco::Net::NotAuthenticatedException("Invalid admin login");

                // Ask UAs to block if they detect any XSS attempt
                response.add("X-XSS-Protection", "1; mode=block");
                // No referrer-policy
                response.add("Referrer-Policy", "no-referrer");
            }

            const std::string relPath = getRequestPathname(request);
            // Is this a file we read at startup - if not; its not for serving.
            if (FileHash.find(relPath) == FileHash.end())
                throw Poco::FileAccessDeniedException("Invalid or forbidden file path: [" + relPath + "].");

            // Do we have an extension.
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
            else if (fileType == "png")
                mimeType = "image/png";
            else if (fileType == "svg")
                mimeType = "image/svg+xml";
            else
                mimeType = "text/plain";

            auto it = request.find("If-None-Match");
            if (it != request.end())
            {
                // if ETags match avoid re-sending the file.
                if (!noCache && it->second == "\"" LOOLWSD_VERSION_HASH "\"")
                {
                    // TESTME: harder ... - do we even want ETag support ?
                    std::ostringstream oss;
                    Poco::DateTime now;
                    Poco::DateTime later(now.utcTime(), int64_t(1000)*1000 * 60 * 60 * 24 * 128);
                    oss << "HTTP/1.1 304 Not Modified\r\n"
                        << "Date: " << Poco::DateTimeFormatter::format(
                            now, Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
                        << "Expires: " << Poco::DateTimeFormatter::format(
                            later, Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
                        << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
                        << "Cache-Control: max-age=11059200\r\n"
                        << "\r\n";
                    socket->send(oss.str());
                    socket->shutdown();
                    return;
                }
            }

            response.set("User-Agent", HTTP_AGENT_STRING);
            response.set("Date", Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT));

            bool gzip = request.hasToken("Accept-Encoding", "gzip");
            const std::string *content;
#ifdef ENABLE_DEBUG
            if (std::getenv("LOOL_SERVE_FROM_FS"))
            {
                // Useful to not serve from memory sometimes especially during loleaflet development
                // Avoids having to restart loolwsd everytime you make a change in loleaflet
                const auto filePath = Poco::Path(LOOLWSD::FileServerRoot, relPath).absolute().toString();
                HttpHelper::sendFile(socket, filePath, mimeType, response, noCache);
                return;
            }
#endif
            if (gzip)
            {
                response.set("Content-Encoding", "gzip");
                content = getCompressedFile(relPath);
            }
            else
                content = getUncompressedFile(relPath);

            if (!noCache)
            {
                // 60 * 60 * 24 * 128 (days) = 11059200
                response.set("Cache-Control", "max-age=11059200");
                response.set("ETag", "\"" LOOLWSD_VERSION_HASH "\"");
            }
            response.setContentType(mimeType);
            response.add("X-Content-Type-Options", "nosniff");

            std::ostringstream oss;
            response.write(oss);
            const std::string header = oss.str();
            LOG_TRC("#" << socket->getFD() << ": Sending " <<
                    (!gzip ? "un":"") << "compressed : file [" << relPath << "]: " << header);
            socket->send(header);
            socket->send(*content);
        }
    }
    catch (const Poco::Net::NotAuthenticatedException& exc)
    {
        LOG_ERR("FileServerRequestHandler::NotAuthenticated: " << exc.displayText());

        // Unauthorized.
        std::ostringstream oss;
        oss << "HTTP/1.1 401\r\n"
            << "Date: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
            << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
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
            << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
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
            << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
            << "Content-Length: 0\r\n"
            << "\r\n";
        socket->send(oss.str());
    }
}

void FileServerRequestHandler::readDirToHash(const std::string &basePath, const std::string &path)
{
    struct dirent *currentFile;
    struct stat fileStat;
    DIR *workingdir;

    LOG_TRC("Pre-reading directory: " << basePath + path << "\n");
    workingdir = opendir((basePath + path).c_str());

    while ((currentFile = readdir(workingdir)) != NULL)
    {
        if (currentFile->d_name[0] == '.')
            continue;

        std::string relPath = path + "/" + currentFile->d_name;
        stat ((basePath + relPath).c_str(), &fileStat);

        if (S_ISDIR(fileStat.st_mode))
            readDirToHash(basePath, relPath);

        else if (S_ISREG(fileStat.st_mode))
        {
            LOG_TRC("Reading file: '" << (basePath + relPath) << " as '" << relPath << "'\n");

            std::ifstream file(basePath + relPath, std::ios::binary);

            z_stream strm;
            strm.zalloc = Z_NULL;
            strm.zfree = Z_NULL;
            strm.opaque = Z_NULL;
            deflateInit2(&strm, Z_DEFAULT_COMPRESSION, Z_DEFLATED, 31, 8, Z_DEFAULT_STRATEGY);

            auto buf = std::unique_ptr<char[]>(new char[fileStat.st_size]);
            std::string compressedFile = "";
            std::string uncompressedFile = "";
            do {
                file.read(&buf[0], fileStat.st_size);
                const long unsigned int size = file.gcount();
                if (size == 0)
                    break;

                long unsigned int haveComp;
                long unsigned int compSize = compressBound(size);
                char *cbuf;
                cbuf = (char *)calloc(compSize, sizeof(char));

                strm.next_in = (unsigned char *)&buf[0];
                strm.avail_in = size;
                strm.avail_out = compSize;
                strm.next_out = (unsigned char *)&cbuf[0];

                deflate(&strm, Z_FINISH);

                haveComp = compSize - strm.avail_out;
                std::string partialcompFile(cbuf, haveComp);
                std::string partialuncompFile(buf.get(), size);
                compressedFile = compressedFile + partialcompFile;
                uncompressedFile = uncompressedFile + partialuncompFile;

            } while(true);

            std::pair<std::string, std::string> FilePair(uncompressedFile, compressedFile);
            FileHash.emplace(relPath, FilePair);
        }
    }
    closedir(workingdir);
}

void FileServerRequestHandler::initialize()
{
    static const std::vector<std::string> subdirs = { "/loleaflet/dist" };
    for(const auto& subdir: subdirs)
    {
        try {
            readDirToHash(LOOLWSD::FileServerRoot, subdir);
        } catch (...) {
            LOG_ERR("Failed to read from directory " << subdir);
        }
    }
}

const std::string *FileServerRequestHandler::getCompressedFile(const std::string &path)
{
    return &FileHash[path].second;
}

const std::string *FileServerRequestHandler::getUncompressedFile(const std::string &path)
{
    return &FileHash[path].first;
}

std::string FileServerRequestHandler::getRequestPathname(const HTTPRequest& request)
{
    Poco::URI requestUri(request.getURI());
    // avoid .'s and ..'s
    requestUri.normalize();

    std::string path(requestUri.getPath());

    // Convert version back to a real file name.
    Poco::replaceInPlace(path, std::string("/loleaflet/" LOOLWSD_VERSION_HASH "/"), std::string("/loleaflet/dist/"));

    return path;
}

void FileServerRequestHandler::preprocessFile(const HTTPRequest& request, Poco::MemoryInputStream& message, const std::shared_ptr<StreamSocket>& socket)
{
    const auto host = ((LOOLWSD::isSSLEnabled() || LOOLWSD::isSSLTermination()) ? "wss://" : "ws://") + (LOOLWSD::ServerName.empty() ? request.getHost() : LOOLWSD::ServerName);
    const auto params = Poco::URI(request.getURI()).getQueryParameters();

    // Is this a file we read at startup - if not; its not for serving.
    const std::string relPath = getRequestPathname(request);
    LOG_DBG("Preprocessing file: " << relPath);
    if (FileHash.find(relPath) == FileHash.end())
    {
        LOG_ERR("File [" << relPath << "] does not exist.");

        // 404 not found
        std::ostringstream oss;
        oss << "HTTP/1.1 404\r\n"
            << "Date: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
            << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
            << "Content-Length: 0\r\n"
            << "\r\n";
        socket->send(oss.str());
        return;
    }

    std::string preprocess = *getUncompressedFile(relPath);

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
    const auto outOfFocusTimeoutSecs= config.getString("per_view.out_of_focus_timeout_secs", "60");
    Poco::replaceInPlace(preprocess, std::string("%OUT_OF_FOCUS_TIMEOUT_SECS%"), outOfFocusTimeoutSecs);
    const auto idleTimeoutSecs= config.getString("per_view.idle_timeout_secs", "900");
    Poco::replaceInPlace(preprocess, std::string("%IDLE_TIMEOUT_SECS%"), idleTimeoutSecs);

    const std::string mimeType = "text/html";

    std::ostringstream oss;
    oss << "HTTP/1.1 200 OK\r\n"
        << "Date: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
        << "Last-Modified: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
        << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
        << "Cache-Control:max-age=11059200\r\n"
        << "ETag: \"" LOOLWSD_VERSION_HASH "\"\r\n"
        << "Content-Length: " << preprocess.size() << "\r\n"
        << "Content-Type: " << mimeType << "\r\n"
        << "X-Content-Type-Options: nosniff\r\n"
        << "X-XSS-Protection: 1; mode=block\r\n"
        << "Referrer-Policy: no-referrer\r\n";

    std::ostringstream cspOss;
    cspOss << "Content-Security-Policy: default-src 'none'; "
           << "frame-src 'self' blob:; "
           << "connect-src 'self' " << host << "; "
           << "script-src 'unsafe-inline' 'self'; "
           << "style-src 'self' 'unsafe-inline'; "
           << "font-src 'self' data:; "
           << "img-src 'self' data:; ";

    std::string frameAncestor;
    const auto it = request.find("Referer"); // Referer[sic]
    if (it != request.end())
    {
        frameAncestor = it->second;
        LOG_TRC("Picking frame ancestor from HTTP Referer header: " << frameAncestor);
    }
    else // Use WOPISrc value if Referer is absent
    {
        for (const auto& param : params)
        {
            if (param.first == "WOPISrc")
            {
                Poco::URI::decode(param.second, frameAncestor);
                LOG_TRC("Picking frame ancestor from WOPISrc: " << frameAncestor);
                break;
            }
        }
    }

    // Keep only the origin, reject everything else
    Poco::URI uriFrameAncestor(frameAncestor);
    if (!frameAncestor.empty() && !uriFrameAncestor.getScheme().empty() && !uriFrameAncestor.getHost().empty())
    {
        frameAncestor = uriFrameAncestor.getScheme() + "://" + uriFrameAncestor.getHost();
        LOG_TRC("Final frame ancestor: " << frameAncestor);

        // Replaced by frame-ancestors in CSP but some oldies don't know about that
        oss << "X-Frame-Options: allow-from " << frameAncestor << "\r\n";
        cspOss << "frame-ancestors " << frameAncestor;
    }
    else
    {
        LOG_TRC("Denied frame ancestor: " << frameAncestor);

        oss << "X-Frame-Options: deny\r\n";
    }

    cspOss << "\r\n";
    // Append CSP to response headers too
    oss << cspOss.str();

    // Setup HTTP Public key pinning
    if (LOOLWSD::isSSLEnabled() && config.getBool("ssl.hpkp[@enable]", false))
    {
        size_t i = 0;
        std::string pinPath = "ssl.hpkp.pins.pin[" + std::to_string(i) + "]";
        std::ostringstream hpkpOss;
        bool keysPinned = false;
        while (config.has(pinPath))
        {
            const auto pin = config.getString(pinPath, "");
            if (!pin.empty())
            {
                hpkpOss << "pin-sha256=\"" << pin << "\"; ";
                keysPinned = true;
            }
            pinPath = "ssl.hpkp.pins.pin[" + std::to_string(++i) + "]";
        }

        if (keysPinned && config.getBool("ssl.hpkp.max_age[@enable]", false))
        {
            int maxAge = 1000; // seconds
            try
            {
                maxAge = config.getInt("ssl.hpkp.max_age", maxAge);
            }
            catch (Poco::SyntaxException& exc)
            {
                LOG_WRN("Invalid value of HPKP's max-age directive found in config file. Defaulting to "
                        << maxAge);
            }
            hpkpOss << "max-age=" << maxAge << "; ";
        }

        if (keysPinned && config.getBool("ssl.hpkp.report_uri[@enable]", false))
        {
            const std::string reportUri = config.getString("ssl.hpkp.report_uri", "");
            if (!reportUri.empty())
            {
                hpkpOss << "report-uri=" << reportUri << "; ";
            }
        }

        if (!hpkpOss.str().empty())
        {
            if (config.getBool("ssl.hpkp[@report_only]", false))
            {
                // Only send validation failure reports to reportUri while still allowing UAs to
                // connect to the server
                oss << "Public-Key-Pins-Report-Only: " << hpkpOss.str() << "\r\n";
            }
            else
            {
                oss << "Public-Key-Pins: " << hpkpOss.str() << "\r\n";
            }
        }
    }

    oss << "\r\n"
        << preprocess;

    socket->send(oss.str());
    LOG_DBG("Sent file: " << relPath << ": " << preprocess);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
