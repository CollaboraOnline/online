/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>
#include <config_version.h>

#include <chrono>
#include <iomanip>
#include <string>
#include <vector>

#include <dirent.h>
#include <sys/stat.h>
#include <unistd.h>
#include <zlib.h>
#include <security/pam_appl.h>

#include <openssl/evp.h>

#include <Poco/DateTime.h>
#include <Poco/DateTimeFormat.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/Exception.h>
#include <Poco/FileStream.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPBasicCredentials.h>
#include <Poco/Net/HTTPCookie.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/NameValueCollection.h>
#include <Poco/Net/NetException.h>
#include <Poco/RegularExpression.h>
#include <Poco/Runnable.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>
#include <Poco/JSON/Object.h>
#include "Exceptions.hpp"

#include "Auth.hpp"
#include <Common.hpp>
#include <Crypto.hpp>
#include "FileServer.hpp"
#include "COOLWSD.hpp"
#include "FileUtil.hpp"
#include "RequestDetails.hpp"
#include "ServerURL.hpp"
#include <Log.hpp>
#include <Protocol.hpp>
#include <Util.hpp>
#include <common/ConfigUtil.hpp>
#include <common/LangUtil.hpp>
#if !MOBILEAPP
#include <net/HttpHelper.hpp>
#endif
#include <ContentSecurityPolicy.hpp>

using Poco::Net::HTMLForm;
using Poco::Net::HTTPBasicCredentials;
using Poco::Net::HTTPRequest;
using Poco::Net::HTTPResponse;
using Poco::Net::NameValueCollection;
using Poco::Util::Application;

std::map<std::string, std::pair<std::string, std::string>> FileServerRequestHandler::FileHash;

namespace {

int functionConversation(int /*num_msg*/, const struct pam_message** /*msg*/,
                         struct pam_response **reply, void *appdata_ptr)
{
    *reply = (struct pam_response *)malloc(sizeof(struct pam_response));
    (*reply)[0].resp = strdup(static_cast<char *>(appdata_ptr));
    (*reply)[0].resp_retcode = 0;

    return PAM_SUCCESS;
}

/// Use PAM to check for user / password.
bool isPamAuthOk(const std::string& userProvidedUsr, const std::string& userProvidedPwd)
{
    struct pam_conv localConversation { functionConversation, nullptr };
    pam_handle_t *localAuthHandle = NULL;
    int retval;

    localConversation.appdata_ptr = const_cast<char *>(userProvidedPwd.c_str());

    retval = pam_start("coolwsd", userProvidedUsr.c_str(), &localConversation, &localAuthHandle);

    if (retval != PAM_SUCCESS)
    {
        LOG_ERR("pam_start returned " << retval);
        return false;
    }

    retval = pam_authenticate(localAuthHandle, 0);

    if (retval != PAM_SUCCESS)
    {
       if (retval == PAM_AUTH_ERR)
       {
           LOG_ERR("PAM authentication failure for user \"" << userProvidedUsr << "\".");
       }
       else
       {
           LOG_ERR("pam_authenticate returned " << retval);
       }
       return false;
    }

    LOG_INF("PAM authentication success for user \"" << userProvidedUsr << "\".");

    retval = pam_end(localAuthHandle, retval);

    if (retval != PAM_SUCCESS)
    {
        LOG_ERR("pam_end returned " << retval);
    }

    return true;
}

/// Check for user / password set in coolwsd.xml.
bool isConfigAuthOk(const std::string& userProvidedUsr, const std::string& userProvidedPwd)
{
    const auto& config = Application::instance().config();
    const std::string& user = config.getString("admin_console.username", "");

    // Check for the username
    if (user.empty())
    {
        LOG_ERR("Admin Console username missing, admin console disabled.");
        return false;
    }
    else if (user != userProvidedUsr)
    {
        LOG_ERR("Admin Console wrong username.");
        return false;
    }

    const char useCoolconfig[] = " Use coolconfig to configure the admin password.";

    // do we have secure_password?
    if (config.has("admin_console.secure_password"))
    {
        const std::string securePass = config.getString("admin_console.secure_password", "");
        if (securePass.empty())
        {
            LOG_ERR("Admin Console secure password is empty, denying access." << useCoolconfig);
            return false;
        }

#if HAVE_PKCS5_PBKDF2_HMAC
        // Extract the salt from the config
        std::vector<unsigned char> saltData;
        StringVector tokens = StringVector::tokenize(securePass, '.');
        if (tokens.size() != 5 ||
            !tokens.equals(0, "pbkdf2") ||
            !tokens.equals(1, "sha512") ||
            !Util::dataFromHexString(tokens[3], saltData))
        {
            LOG_ERR("Incorrect format detected for secure_password in config file." << useCoolconfig);
            return false;
        }

        unsigned char userProvidedPwdHash[tokens[4].size() / 2];
        PKCS5_PBKDF2_HMAC(userProvidedPwd.c_str(), -1,
                          saltData.data(), saltData.size(),
                          std::stoi(tokens[2]),
                          EVP_sha512(),
                          sizeof userProvidedPwdHash, userProvidedPwdHash);

        std::stringstream stream;
        for (unsigned long j = 0; j < sizeof userProvidedPwdHash; ++j)
            stream << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(userProvidedPwdHash[j]);

        // now compare the hashed user-provided pwd against the stored hash
        return tokens.equals(4, stream.str());
#else
        const std::string pass = config.getString("admin_console.password", "");
        LOG_ERR("The config file has admin_console.secure_password setting, "
                << "but this application was compiled with old OpenSSL version, "
                << "and this setting cannot be used." << (!pass.empty()? " Falling back to plain text password.": ""));

        // careful, a fall-through!
#endif
    }

    const std::string pass = config.getString("admin_console.password", "");
    if (pass.empty())
    {
        LOG_ERR("Admin Console password is empty, denying access." << useCoolconfig);
        return false;
    }

    return pass == userProvidedPwd;
}

}

FileServerRequestHandler::FileServerRequestHandler(const std::string& root)
{
    // Read all files that we can serve into memory and compress them.
    // cool files
    try
    {
        readDirToHash(root, "/browser/dist");
    }
    catch (...)
    {
        LOG_ERR("Failed to read from directory " << root);
    }
}

FileServerRequestHandler::~FileServerRequestHandler()
{
    // Clean cached files.
    FileHash.clear();
}

bool FileServerRequestHandler::isAdminLoggedIn(const HTTPRequest& request,
                                               HTTPResponse &response)
{
    assert(COOLWSD::AdminEnabled);

    const auto& config = Application::instance().config();

    NameValueCollection cookies;
    request.getCookies(cookies);
    try
    {
        const std::string jwtToken = cookies.get("jwt");
        LOG_INF("Verifying JWT token: " << jwtToken);
        JWTAuth authAgent("admin", "admin", "admin");
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

    // If no cookie found, or is invalid, let the admin re-login
    HTTPBasicCredentials credentials(request);
    const std::string& userProvidedUsr = credentials.getUsername();
    const std::string& userProvidedPwd = credentials.getPassword();

    // Deny attempts to login without providing a username / pwd and fail right away
    // We don't even want to allow a password-less PAM module to be used here,
    // or anything.
    if (userProvidedUsr.empty() || userProvidedPwd.empty())
    {
        LOG_ERR("An attempt to log into Admin Console without username or password.");
        return false;
    }

    // Check if the user is allowed to use the admin console
    if (config.getBool("admin_console.enable_pam", false))
    {
        // use PAM - it needs the username too
        if (!isPamAuthOk(userProvidedUsr, userProvidedPwd))
            return false;
    }
    else
    {
        // use the hash or password in the config file
        if (!isConfigAuthOk(userProvidedUsr, userProvidedPwd))
            return false;
    }

    // authentication passed, generate and set the cookie
    JWTAuth authAgent("admin", "admin", "admin");
    const std::string jwtToken = authAgent.getAccessToken();

    Poco::Net::HTTPCookie cookie("jwt", jwtToken);
    // bundlify appears to add an extra /dist -> dist/dist/admin
    cookie.setPath(COOLWSD::ServiceRoot + "/browser/dist/");
    cookie.setSecure(COOLWSD::isSSLEnabled());
    response.addCookie(cookie);

    return true;
}

bool FileServerRequestHandler::isAdminLoggedIn(const HTTPRequest& request, http::Response& response)
{
    // For now, we reuse the exiting implementation, which uses Poco HTTPCookie.
    Poco::Net::HTTPResponse pocoResponse;
    if (isAdminLoggedIn(request, pocoResponse))
    {
        // Copy the headers, including the cookies.
        for (const auto& pair : pocoResponse)
        {
            response.set(pair.first, pair.second);
        }

        return true;
    }

    return false;
}

#if ENABLE_DEBUG
    // Represents basic file's attributes.
    // Used for localFile
    class LocalFileInfo
    {
        public:
            // Attributes of file
            std::string localPath;
            std::string fileName;
            std::string size;

            // Last modified time of the file
            std::chrono::system_clock::time_point fileLastModifiedTime;

            enum class COOLStatusCode
            {
                DocChanged = 1010  // Document changed externally in storage
            };

        std::string getLastModifiedTime()
        {
            return Util::getIso8601FracformatTime(fileLastModifiedTime);
        }

        LocalFileInfo() = delete;
        LocalFileInfo(const std::string &lPath, const std::string &fName)
        {
            fileName = fName;
            localPath = lPath;
            const FileUtil::Stat stat(localPath);
            size = std::to_string(stat.size());
            fileLastModifiedTime = stat.modifiedTimepoint();
        }
    private:
        // Internal tracking of known files: to store various data
        // on files - rather than writing it back to the file-system.
        static std::vector<std::shared_ptr<LocalFileInfo>> fileInfoVec;

    public:
        // Lookup a file in our file-list
        static std::shared_ptr<LocalFileInfo> getOrCreateFile(const std::string &lpath, const std::string &fname)
        {
            auto it = std::find_if(fileInfoVec.begin(), fileInfoVec.end(), [&lpath](const std::shared_ptr<LocalFileInfo> obj)
            {
                return obj->localPath == lpath;
            });

            if (it != fileInfoVec.end())
                return *it;

            auto fileInfo = std::make_shared<LocalFileInfo>(lpath, fname);
            fileInfoVec.emplace_back(fileInfo);
            return fileInfo;
        }
    };
    std::atomic<unsigned> lastLocalId;
    std::vector<std::shared_ptr<LocalFileInfo>> LocalFileInfo::fileInfoVec;

    //handles request starts with /wopi/files
    void handleWopiRequest(const HTTPRequest& request,
                           const RequestDetails &requestDetails,
                           Poco::MemoryInputStream& message,
                           const std::shared_ptr<StreamSocket>& socket)
    {
        Poco::URI requestUri(request.getURI());
        const Poco::Path path = requestUri.getPath();
        const std::string prefix = "/wopi/files";
        const std::string suffix = "/contents";
        std::string localPath;
        if (Util::endsWith(path.toString(), suffix))
        {
            localPath = path.toString().substr(prefix.length(), path.toString().length() - prefix.length() - suffix.length());
        }
        else
        {
            localPath = path.toString().substr(prefix.length());
        }

        if (!FileUtil::Stat(localPath).exists())
        {
            LOG_ERR("Local file URI [" << localPath << "] invalid or doesn't exist.");
            throw BadRequestException("Invalid URI: " + localPath);
        }

        if (request.getMethod() == "GET" && !Util::endsWith(path.toString(), suffix))
        {
            std::shared_ptr<LocalFileInfo> localFile =
                LocalFileInfo::getOrCreateFile(localPath, path.getFileName());

            std::string userId = std::to_string(lastLocalId++);
            std::string userNameString = "LocalUser#" + userId;
            Poco::JSON::Object::Ptr fileInfo = new Poco::JSON::Object();

            std::string postMessageOrigin;
            config::isSslEnabled() ? postMessageOrigin = "https://" : postMessageOrigin = "http://";
            postMessageOrigin += requestDetails.getHostUntrusted();

            fileInfo->set("BaseFileName", localFile->fileName);
            fileInfo->set("Size", localFile->size);
            fileInfo->set("Version", "1.0");
            fileInfo->set("OwnerId", "test");
            fileInfo->set("UserId", userId);
            fileInfo->set("UserFriendlyName", userNameString);
            fileInfo->set("UserCanWrite", "true");
            fileInfo->set("PostMessageOrigin", postMessageOrigin);
            fileInfo->set("LastModifiedTime", localFile->getLastModifiedTime());
            fileInfo->set("EnableOwnerTermination", "true");

            std::ostringstream jsonStream;
            fileInfo->stringify(jsonStream);

            http::Response httpResponse(http::StatusCode::OK);
            httpResponse.set("Last-Modified", Util::getHttpTime(localFile->fileLastModifiedTime));
            httpResponse.setBody(jsonStream.str(), "application/json; charset=utf-8");
            socket->send(httpResponse);

            return;
        }
        else if(request.getMethod() == "GET" && Util::endsWith(path.toString(), suffix))
        {
            std::shared_ptr<LocalFileInfo> localFile =
                LocalFileInfo::getOrCreateFile(localPath,path.getFileName());
            auto ss = std::ostringstream{};
            std::ifstream inputFile(localFile->localPath);
            ss << inputFile.rdbuf();

            http::Response httpResponse(http::StatusCode::OK);
            httpResponse.set("Last-Modified", Util::getHttpTime(localFile->fileLastModifiedTime));
            httpResponse.setBody(ss.str(), "text/plain; charset=utf-8");
            socket->send(httpResponse);
            return;
        }
        else if (request.getMethod() == "POST" && Util::endsWith(path.toString(), suffix))
        {
            std::shared_ptr<LocalFileInfo> localFile =
                LocalFileInfo::getOrCreateFile(localPath,path.getFileName());
            std::string wopiTimestamp = request.get("X-COOL-WOPI-Timestamp", std::string());
            if (wopiTimestamp.empty())
                wopiTimestamp = request.get("X-LOOL-WOPI-Timestamp", std::string());

            if (!wopiTimestamp.empty())
            {
                if (wopiTimestamp != localFile->getLastModifiedTime())
                {
                    http::Response httpResponse(http::StatusCode::Conflict);
                    httpResponse.setBody("{\"COOLStatusCode\":" +
                                             std::to_string(static_cast<int>(
                                                 LocalFileInfo::COOLStatusCode::DocChanged)) +
                                             ',' + "{\"LOOLStatusCode\":" +
                                             std::to_string(static_cast<int>(
                                                 LocalFileInfo::COOLStatusCode::DocChanged)) +
                                             '}',
                                         "application/json; charset=utf-8");
                    socket->send(httpResponse);
                    return;
                }
            }

            std::streamsize size = request.getContentLength();
            std::vector<char> buffer(size);
            message.read(buffer.data(), size);
            localFile->fileLastModifiedTime = std::chrono::system_clock::now();

            std::ofstream outfile;
            outfile.open(localFile->localPath, std::ofstream::binary);
            outfile.write(buffer.data(), size);
            outfile.close();

            const std::string body = "{\"LastModifiedTime\": \"" +
                localFile->getLastModifiedTime() + "\" }";
            http::Response httpResponse(http::StatusCode::OK);
            httpResponse.setBody(body, "application/json; charset=utf-8");
            socket->send(httpResponse);
            return;
        }
    }
#endif

void FileServerRequestHandler::handleRequest(const HTTPRequest& request,
                                             const RequestDetails &requestDetails,
                                             Poco::MemoryInputStream& message,
                                             const std::shared_ptr<StreamSocket>& socket)
{
    try
    {
        bool noCache = false;
#if ENABLE_DEBUG
        noCache = !COOLWSD::ForceCaching; // for cypress
#endif
        http::Response response(http::StatusCode::OK);

        const auto& config = Application::instance().config();

        // HSTS hardening. Disabled in debug builds.
#if !ENABLE_DEBUG
        if (COOLWSD::isSSLEnabled() || COOLWSD::isSSLTermination())
        {
            if (config.getBool("ssl.sts.enabled", false))
            {
                const auto maxAge = config.getInt("ssl.sts.max_age", 31536000); // Default 1 year.
                response.add("Strict-Transport-Security",
                             "max-age=" + std::to_string(maxAge) + "; includeSubDomains");
            }
        }
#endif

        Poco::URI requestUri(request.getURI());
        LOG_TRC("Fileserver request: " << requestUri.toString());
        requestUri.normalize(); // avoid .'s and ..'s

        if (requestUri.getPath().find("browser/" COOLWSD_VERSION_HASH "/") == std::string::npos)
        {
            LOG_WRN("Client - server version mismatch, disabling browser cache. "
                    "Expected: " COOLWSD_VERSION_HASH "; Actual URI path with version hash: "
                    << requestUri.getPath());
            noCache = true;
        }

        std::vector<std::string> requestSegments;
        requestUri.getPathSegments(requestSegments);
        if (requestSegments.size() < 1)
            throw Poco::FileNotFoundException("Invalid URI request: [" + requestUri.toString() + "].");

        const std::string relPath = getRequestPathname(request, requestDetails);
        const std::string endPoint = requestSegments[requestSegments.size() - 1];

        static std::string etagString = "\"" COOLWSD_VERSION_HASH +
            config.getString("ver_suffix", "") + "\"";

#if ENABLE_DEBUG
        if (Util::startsWith(relPath, std::string("/wopi/files"))) {
            handleWopiRequest(request, requestDetails, message, socket);
            return;
        }
#endif
        if (request.getMethod() == HTTPRequest::HTTP_POST && endPoint == "logging.html")
        {
            const std::string coolLogging = config.getString("browser_logging", "false");
            if (coolLogging != "false")
            {
                LOG_ERR(message.rdbuf());
                socket->send(response);
                return;
            }
        }

        // Is this a file we read at startup - if not; it's not for serving.
        if (FileHash.find(relPath) == FileHash.end() &&
            FileHash.find(relPath + ".br") == FileHash.end())
            throw Poco::FileNotFoundException("Invalid URI request: [" + requestUri.toString() + "].");

        if (endPoint == "welcome.html")
        {
            preprocessWelcomeFile(request, requestDetails, message, socket);
            return;
        }

        if (endPoint == "cool.html" ||
            endPoint == "help-localizations.json" ||
            endPoint == "localizations.json" ||
            endPoint == "locore-localizations.json" ||
            endPoint == "uno-localizations.json" ||
            endPoint == "uno-localizations-override.json")
        {
            preprocessFile(request, requestDetails, message, socket);
            return;
        }

        if (request.getMethod() == HTTPRequest::HTTP_GET)
        {
            if (endPoint == "admin.html" ||
                endPoint == "adminSettings.html" ||
                endPoint == "adminHistory.html" ||
                endPoint == "adminAnalytics.html" ||
                endPoint == "adminLog.html" ||
                endPoint == "adminClusterOverview.html")
            {
                preprocessAdminFile(request, requestDetails, socket);
                return;
            }

            if (endPoint == "admin-bundle.js" ||
                endPoint == "admin-localizations.js")
            {
                noCache = true;

                if (!COOLWSD::AdminEnabled)
                    throw Poco::FileAccessDeniedException("Admin console disabled");

                if (!FileServerRequestHandler::isAdminLoggedIn(request, response))
                    throw Poco::Net::NotAuthenticatedException("Invalid admin login");

                // Ask UAs to block if they detect any XSS attempt
                response.add("X-XSS-Protection", "1; mode=block");
                // No referrer-policy
                response.add("Referrer-Policy", "no-referrer");
            }

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
#if !MOBILEAPP
            else if (fileType == "wasm" &&
                     COOLWSD::WASMState != COOLWSD::WASMActivationState::Disabled)
                mimeType = "application/wasm";
#endif // !MOBILEAPP
            else
                mimeType = "text/plain";

            response.setContentType(mimeType);

            auto it = request.find("If-None-Match");
            if (it != request.end())
            {
                // if ETags match avoid re-sending the file.
                if (!noCache && it->second == etagString)
                {
                    // TESTME: harder ... - do we even want ETag support ?
                    std::ostringstream oss;
                    Poco::DateTime now;
                    Poco::DateTime later(now.utcTime(), int64_t(1000)*1000 * 60 * 60 * 24 * 128);
                    std::string extraHeaders =
                        "Expires: " + Poco::DateTimeFormatter::format(
                            later, Poco::DateTimeFormat::HTTP_FORMAT) + "\r\n" +
                        "Cache-Control: max-age=11059200\r\n";
                    HttpHelper::sendErrorAndShutdown(http::StatusCode::NotModified, socket,
                                                     std::string(), extraHeaders);
                    return;
                }
            }

            response.set("Server", HTTP_SERVER_STRING);
            response.set("Date", Util::getHttpTimeNow());

#if !MOBILEAPP
            if (COOLWSD::WASMState != COOLWSD::WASMActivationState::Disabled &&
                relPath.find("wasm") != std::string::npos)
            {
                response.add("Cross-Origin-Opener-Policy", "same-origin");
                response.add("Cross-Origin-Embedder-Policy", "require-corp");
                response.add("Cross-Origin-Resource-Policy", "cross-origin");
            }
#endif // !MOBILEAPP

            const bool brotli = request.hasToken("Accept-Encoding", "br");
#if ENABLE_DEBUG
            if (std::getenv("COOL_SERVE_FROM_FS"))
            {
                // Useful to not serve from memory sometimes especially during cool development
                // Avoids having to restart cool everytime you make a change in cool
                std::string filePath =
                    Poco::Path(COOLWSD::FileServerRoot, relPath).absolute().toString();
                if (brotli && FileUtil::Stat(filePath + ".br").exists())
                {
                    filePath += ".br";
                    response.set("Content-Encoding", "br");
                }

                HttpHelper::sendFileAndShutdown(socket, filePath, response, noCache);
                return;
            }
#endif

            bool compressed = false;
            const std::string* content;
            if (brotli && FileHash.find(relPath + ".br") != FileHash.end())
            {
                compressed = true;
                response.set("Content-Encoding", "br");
                content = getUncompressedFile(relPath + ".br");
            }
            else if (request.hasToken("Accept-Encoding", "gzip"))
            {
                compressed = true;
                response.set("Content-Encoding", "gzip");
                content = getCompressedFile(relPath);
            }
            else
                content = getUncompressedFile(relPath);

            if (!noCache)
            {
                // 60 * 60 * 24 * 128 (days) = 11059200
                response.set("Cache-Control", "max-age=11059200");
                response.set("ETag", etagString);
            }
            response.add("X-Content-Type-Options", "nosniff");

            LOG_TRC('#' << socket->getFD() << ": Sending " << (!compressed ? "un" : "")
                        << "compressed : file [" << relPath << "]: " << response.header());

            socket->send(response);
            socket->send(*content);
            // shutdown by caller
        }
    }
    catch (const Poco::Net::NotAuthenticatedException& exc)
    {
        LOG_ERR("FileServerRequestHandler::NotAuthenticated: " << exc.displayText());
        sendError(http::StatusCode::Unauthorized, request, socket, "", "",
                  "WWW-authenticate: Basic realm=\"online\"\r\n");
    }
    catch (const Poco::FileAccessDeniedException& exc)
    {
        LOG_ERR("FileServerRequestHandler: " << exc.displayText());
        sendError(http::StatusCode::Forbidden, request, socket, "403 - Access denied!",
                  "You are unable to access");
    }
    catch (const Poco::FileNotFoundException& exc)
    {
        LOG_ERR("FileServerRequestHandler: " << exc.displayText());
        sendError(http::StatusCode::NotFound, request, socket, "404 - file not found!",
                  "There seems to be a problem locating");
    }
    catch (Poco::SyntaxException& exc)
    {
        LOG_ERR("Incorrect config value: " << exc.displayText());
        sendError(http::StatusCode::InternalServerError, request, socket,
                  "500 - Internal Server Error!",
                  "Cannot process the request - " + exc.displayText());
    }
}

void FileServerRequestHandler::sendError(http::StatusCode errorCode,
                                         const Poco::Net::HTTPRequest& request,
                                         const std::shared_ptr<StreamSocket>& socket,
                                         const std::string& shortMessage,
                                         const std::string& longMessage,
                                         const std::string& extraHeader)
{
    std::string body;
    std::string headers = extraHeader;
    if (!shortMessage.empty())
    {
        const Poco::URI requestUri(request.getURI());
        const std::string pathSanitized =
            Util::encodeURIComponent(requestUri.getPath(), std::string());
        // Let's keep message as plain text to avoid complications.
        headers += "Content-Type: text/plain charset=UTF-8\r\n";
        body = "Error: " + shortMessage + '\n' +
            longMessage + ' ' + pathSanitized + '\n' +
            "Please contact your system administrator.";
    }
    HttpHelper::sendError(errorCode, socket, body, headers);
}

void FileServerRequestHandler::readDirToHash(const std::string &basePath, const std::string &path, const std::string &prefix)
{
    const std::string fullPath = basePath + path;
    LOG_DBG("Caching files in [" << fullPath << ']');

#if !MOBILEAPP
    if (COOLWSD::WASMState == COOLWSD::WASMActivationState::Disabled &&
        path.find("wasm") != std::string::npos)
    {
        LOG_INF("Skipping [" << fullPath << "] as WASM is disabled");
        return;
    }
#endif // !MOBILEAPP

    DIR* workingdir = opendir((fullPath).c_str());
    if (!workingdir)
    {
        LOG_SYS("Failed to open directory [" << fullPath << ']');
        return;
    }

    size_t fileCount = 0;
    std::string filesRead;
    filesRead.reserve(1024);

    struct dirent *currentFile;
    while ((currentFile = readdir(workingdir)) != nullptr)
    {
        if (currentFile->d_name[0] == '.')
            continue;

        const std::string relPath = path + '/' + currentFile->d_name;
        struct stat fileStat;
        if (stat ((basePath + relPath).c_str(), &fileStat) != 0)
        {
            LOG_ERR("Failed to stat " << relPath);
            continue;
        }

        if (S_ISDIR(fileStat.st_mode))
            readDirToHash(basePath, relPath);

        else if (S_ISREG(fileStat.st_mode) && Util::endsWith(relPath, ".br"))
        {
            // Only cache without compressing.
            fileCount++;
            filesRead.append(currentFile->d_name);
            filesRead += ' ';

            std::ifstream file(basePath + relPath, std::ios::binary);

            std::string uncompressedFile;
            uncompressedFile.resize(fileStat.st_size);
            long unsigned int pos = 0;
            do
            {
                file.read(&uncompressedFile[pos], fileStat.st_size);
                const long unsigned int size = file.gcount();
                if (size == 0)
                    break;

                pos += size;

            } while (true);

            FileHash.emplace(prefix + relPath,
                             std::make_pair(std::move(uncompressedFile), std::string()));
        }
        else if (S_ISREG(fileStat.st_mode))
        {
            z_stream strm;
            strm.zalloc = Z_NULL;
            strm.zfree = Z_NULL;
            strm.opaque = Z_NULL;
            const int initResult = deflateInit2(&strm, Z_DEFAULT_COMPRESSION, Z_DEFLATED, 31, 8, Z_DEFAULT_STRATEGY);
            if (initResult != Z_OK)
            {
                 LOG_ERR("Failed to deflateInit2, result: " << initResult);
                 continue;
            }

            fileCount++;
            filesRead.append(currentFile->d_name);
            filesRead += ' ';

            std::ifstream file(basePath + relPath, std::ios::binary);

            std::unique_ptr<char[]> buf = std::make_unique<char[]>(fileStat.st_size);
            std::string compressedFile;
            compressedFile.reserve(fileStat.st_size);
            std::string uncompressedFile;
            uncompressedFile.reserve(fileStat.st_size);
            do
            {
                file.read(&buf[0], fileStat.st_size);
                const long unsigned int size = file.gcount();
                if (size == 0)
                    break;

                const long unsigned int compSize = compressBound(size);
                char *cbuf = (char *)calloc(compSize, sizeof(char));

                strm.next_in = (unsigned char *)&buf[0];
                strm.avail_in = size;
                strm.avail_out = compSize;
                strm.next_out = (unsigned char *)&cbuf[0];
                strm.total_out = strm.total_in = 0;

                const int deflateResult = deflate(&strm, Z_FINISH);
                if (deflateResult != Z_OK && deflateResult != Z_STREAM_END)
                {
                    LOG_ERR("Failed to deflate, result: " << deflateResult);
                    free(cbuf);
                    break;
                }

                compressedFile.append(cbuf, compSize - strm.avail_out);
                free(cbuf);

                uncompressedFile.append(buf.get(), size);

            } while(true);

            FileHash.emplace(prefix + relPath, std::make_pair(std::move(uncompressedFile),
                                                              std::move(compressedFile)));
            deflateEnd(&strm);
        }
    }
    closedir(workingdir);

    if (fileCount > 0)
        LOG_TRC("Pre-read " << fileCount << " file(s) from directory: " << fullPath << ": "
                            << filesRead);
}

const std::string *FileServerRequestHandler::getCompressedFile(const std::string &path)
{
    return &FileHash[path].second;
}

const std::string *FileServerRequestHandler::getUncompressedFile(const std::string &path)
{
    return &FileHash[path].first;
}

std::string FileServerRequestHandler::getRequestPathname(const HTTPRequest& request,
                                                         const RequestDetails& requestDetails)
{
    Poco::URI requestUri(request.getURI());
    // avoid .'s and ..'s
    requestUri.normalize();

    std::string path(requestUri.getPath());

    Poco::RegularExpression gitHashRe("/([0-9a-f]+)/");
    std::string gitHash;
    if (gitHashRe.extract(path, gitHash))
    {
        // Convert version back to a real file name.
        Poco::replaceInPlace(path, std::string("/browser" + gitHash), std::string("/browser/dist/"));
    }

#if !MOBILEAPP
    bool isWasm = false;

    if (COOLWSD::WASMState == COOLWSD::WASMActivationState::Forced)
    {
        isWasm = (path.find("/browser/dist/wasm/") == std::string::npos);
    }
    else
    {
        const std::string wopiSrc = requestDetails.getLineModeKey(std::string());
        if (!wopiSrc.empty())
        {
            const auto it = COOLWSD::Uri2WasmModeMap.find(wopiSrc);
            if (it != COOLWSD::Uri2WasmModeMap.end())
            {
                const bool isRecent =
                    (std::chrono::steady_clock::now() - it->second) <= std::chrono::minutes(1);
                isWasm = (isRecent && path.find("/browser/dist/wasm/") == std::string::npos);

                // Clean up only after it expires, because we need it more than once.
                if (!isRecent)
                {
                    COOLWSD::Uri2WasmModeMap.erase(it);
                }
            }
        }
    }

    if (!isWasm)
    {
        std::vector<std::string> requestSegments;
        requestUri.getPathSegments(requestSegments);
        const std::string endPoint = requestSegments[requestSegments.size() - 1];
        if (endPoint == "online.js" || endPoint == "online.worker.js" ||
            endPoint == "online.wasm" || endPoint == "online.data" || endPoint == "soffice.data")
        {
            isWasm = true;
        }
        else if (endPoint == "online.wasm.debug.wasm" || endPoint == "soffice.data.js.metadata")
        {
            isWasm = true;
        }
    }

    if (isWasm)
    {
        Poco::replaceInPlace(path, std::string("/browser/dist/"),
                             std::string("/browser/dist/wasm/"));
    }
#endif // !MOBILEAPP

    return path;
}

constexpr char BRANDING[] = "branding";
#if ENABLE_SUPPORT_KEY
constexpr char BRANDING_UNSUPPORTED[] = "branding-unsupported";
#endif

static const std::string ACCESS_TOKEN = "%ACCESS_TOKEN%";
static const std::string ACCESS_TOKEN_TTL = "%ACCESS_TOKEN_TTL%";
static const std::string ACCESS_HEADER = "%ACCESS_HEADER%";
static const std::string UI_DEFAULTS = "%UI_DEFAULTS%";
static const std::string CSS_VARS = "<!--%CSS_VARIABLES%-->";
static const std::string POSTMESSAGE_ORIGIN = "%POSTMESSAGE_ORIGIN%";
static const std::string BRANDING_THEME = "%BRANDING_THEME%";

/// Per user request variables.
/// Holds access_token, css_variables, postmessage_origin, etc.
class UserRequestVars
{
    std::string extractVariable(const HTMLForm& form, const std::string& field,
                                const std::string& var)
    {
        std::string value = form.get(field, "");

        // Escape bad characters in access token.
        // These are placed directly in javascript in cool.html, we need to make sure
        // that no one can do anything nasty with their clever inputs.
        const std::string escaped = Util::encodeURIComponent(value, "'");
        _vars[var] = escaped;

        LOG_TRC("Field [" << field << "] for var [" << var << "] = [" << escaped << ']');

        return value;
    }

    /// Like extractVariable, but without encoding the content.
    std::string extractVariablePlain(const HTMLForm& form, const std::string& field,
                                     const std::string& var)
    {
        std::string value = form.get(field, "");

        _vars[var] = value;

        LOG_TRC("Field [" << field << "] for var [" << var << "] = [" << value << ']');

        return value;
    }

public:
    UserRequestVars(const HTTPRequest& /*request*/, const Poco::Net::HTMLForm& form)
    {
        // We need to pass certain parameters from the cool html GET URI
        // to the embedded document URI. Here we extract those params
        // from the GET URI and set them in the generated html (see cool.html.m4).

        const std::string accessToken = extractVariable(form, "access_token", ACCESS_TOKEN);
        const std::string accessTokenTtl =
            extractVariable(form, "access_token_ttl", ACCESS_TOKEN_TTL);

        unsigned long tokenTtl = 0;
        if (!accessToken.empty())
        {
            if (!accessTokenTtl.empty())
            {
                try
                {
                    tokenTtl = std::stoul(accessTokenTtl);
                }
                catch (const std::exception& exc)
                {
                    LOG_ERR(
                        "access_token_ttl ["
                        << accessTokenTtl
                        << "] must be represented as the number of milliseconds "
                           "since January 1, 1970 UTC, when the token will expire. Defaulting to "
                        << tokenTtl);
                }
            }
            else
            {
                LOG_INF("WOPI host did not pass optional access_token_ttl");
            }
        }

        _vars[ACCESS_TOKEN_TTL] = std::to_string(tokenTtl);
        LOG_TRC("Field ["
                << "access_token_ttl"
                << "] for var [" << ACCESS_TOKEN_TTL << "] = [" << tokenTtl << ']');

        extractVariable(form, "access_header", ACCESS_HEADER);

        extractVariable(form, "ui_defaults", UI_DEFAULTS);

        extractVariablePlain(form, "css_variables", CSS_VARS);

        extractVariable(form, "postmessage_origin", POSTMESSAGE_ORIGIN);

        extractVariable(form, "theme", BRANDING_THEME);
    }

    const std::string& operator[](const std::string& key) const
    {
        const auto it = _vars.find(key);
        return it != _vars.end() ? it->second : _blank;
    }

private:
    std::unordered_map<std::string, std::string> _vars;
    const std::string _blank;
};

void FileServerRequestHandler::preprocessFile(const HTTPRequest& request,
                                              const RequestDetails &requestDetails,
                                              Poco::MemoryInputStream& message,
                                              const std::shared_ptr<StreamSocket>& socket)
{
    const ServerURL cnxDetails(requestDetails);

    const Poco::URI::QueryParameters params = Poco::URI(request.getURI()).getQueryParameters();

    // Is this a file we read at startup - if not; it's not for serving.
    const std::string relPath = getRequestPathname(request, requestDetails);
    LOG_DBG("Preprocessing file: " << relPath);
    std::string preprocess = *getUncompressedFile(relPath);

    // We need to pass certain parameters from the cool html GET URI
    // to the embedded document URI. Here we extract those params
    // from the GET URI and set them in the generated html (see cool.html.m4).
    HTMLForm form(request, message);

    const UserRequestVars urv(request, form);

    std::string buyProduct;
    {
        std::lock_guard<std::mutex> lock(COOLWSD::RemoteConfigMutex);
        buyProduct = COOLWSD::BuyProductUrl;
    }
    if (buyProduct.empty())
        buyProduct = form.get("buy_product", "");
    LOG_TRC("buy_product=" << buyProduct);
    const std::string checkfileinfo_override = form.get("checkfileinfo_override", "");
    LOG_TRC("checkfileinfo_override=" << checkfileinfo_override);

    std::string socketProxy = "false";
    if (requestDetails.isProxy())
        socketProxy = "true";
    Poco::replaceInPlace(preprocess, std::string("%SOCKET_PROXY%"), socketProxy);

    const std::string responseRoot = cnxDetails.getResponseRoot();
    std::string userInterfaceMode;
    std::string userInterfaceTheme;
    std::string savedUIState = "true";
    const std::string& theme = urv[BRANDING_THEME];

    Poco::replaceInPlace(preprocess, ACCESS_TOKEN, urv[ACCESS_TOKEN]);
    Poco::replaceInPlace(preprocess, ACCESS_TOKEN_TTL, urv[ACCESS_TOKEN_TTL]);
    Poco::replaceInPlace(preprocess, ACCESS_HEADER, urv[ACCESS_HEADER]);
    Poco::replaceInPlace(preprocess, std::string("%HOST%"), cnxDetails.getWebSocketUrl());
    Poco::replaceInPlace(preprocess, std::string("%VERSION%"), std::string(COOLWSD_VERSION_HASH));
    Poco::replaceInPlace(preprocess, std::string("%COOLWSD_VERSION%"), std::string(COOLWSD_VERSION));
    Poco::replaceInPlace(preprocess, std::string("%SERVICE_ROOT%"), responseRoot);
    Poco::replaceInPlace(preprocess, UI_DEFAULTS,
                         uiDefaultsToJSON(urv[UI_DEFAULTS], userInterfaceMode, userInterfaceTheme, savedUIState));
    Poco::replaceInPlace(preprocess, std::string("%UI_THEME%"), userInterfaceTheme); // UI_THEME refers to light or dark theme
    Poco::replaceInPlace(preprocess, BRANDING_THEME, urv[BRANDING_THEME]);
    Poco::replaceInPlace(preprocess, std::string("%SAVED_UI_STATE%"), savedUIState);
    Poco::replaceInPlace(preprocess, POSTMESSAGE_ORIGIN, urv[POSTMESSAGE_ORIGIN]);
    Poco::replaceInPlace(preprocess, std::string("%CHECK_FILE_INFO_OVERRIDE%"),
                         checkFileInfoToJSON(checkfileinfo_override));

    const auto& config = Application::instance().config();

    std::string protocolDebug = stringifyBoolFromConfig(config, "logging.protocol", false);
    Poco::replaceInPlace(preprocess, std::string("%PROTOCOL_DEBUG%"), protocolDebug);

    static const std::string hexifyEmbeddedUrls =
        COOLWSD::getConfigValue<bool>("hexify_embedded_urls", false) ? "true" : "false";
    Poco::replaceInPlace(preprocess, std::string("%HEXIFY_URL%"), hexifyEmbeddedUrls);

    static const bool useIntegrationTheme =
        config.getBool("user_interface.use_integration_theme", true);
    const bool hasIntegrationTheme =
        !theme.empty() &&
        FileUtil::Stat(COOLWSD::FileServerRoot + "/browser/dist/" + theme).exists();
    const std::string themePreFix = hasIntegrationTheme && useIntegrationTheme ? theme + "/" : "";
    const std::string linkCSS("<link rel=\"stylesheet\" href=\"%s/browser/" COOLWSD_VERSION_HASH "/" + themePreFix + "%s.css\">");
    const std::string scriptJS("<script src=\"%s/browser/" COOLWSD_VERSION_HASH "/" + themePreFix + "%s.js\"></script>");

    std::string brandCSS(Poco::format(linkCSS, responseRoot, std::string(BRANDING)));
    std::string brandJS(Poco::format(scriptJS, responseRoot, std::string(BRANDING)));

#if ENABLE_SUPPORT_KEY
    const std::string keyString = config.getString("support_key", "");
    SupportKey key(keyString);
    if (!key.verify() || key.validDaysRemaining() <= 0)
    {
        brandCSS = Poco::format(linkCSS, responseRoot, std::string(BRANDING_UNSUPPORTED));
        brandJS = Poco::format(scriptJS, responseRoot, std::string(BRANDING_UNSUPPORTED));
    }
#endif

    Poco::replaceInPlace(preprocess, std::string("<!--%BRANDING_CSS%-->"), brandCSS);
    Poco::replaceInPlace(preprocess, std::string("<!--%BRANDING_JS%-->"), brandJS);
    Poco::replaceInPlace(preprocess, CSS_VARS, cssVarsToStyle(urv[CSS_VARS]));

    const auto coolLogging = stringifyBoolFromConfig(config, "browser_logging", false);
    Poco::replaceInPlace(preprocess, std::string("%BROWSER_LOGGING%"), coolLogging);
    const auto groupDownloadAs = stringifyBoolFromConfig(config, "per_view.group_download_as", true);
    Poco::replaceInPlace(preprocess, std::string("%GROUP_DOWNLOAD_AS%"), groupDownloadAs);
    const unsigned int outOfFocusTimeoutSecs = config.getUInt("per_view.out_of_focus_timeout_secs", 60);
    Poco::replaceInPlace(preprocess, std::string("%OUT_OF_FOCUS_TIMEOUT_SECS%"), std::to_string(outOfFocusTimeoutSecs));
    const unsigned int idleTimeoutSecs = config.getUInt("per_view.idle_timeout_secs", 900);
    Poco::replaceInPlace(preprocess, std::string("%IDLE_TIMEOUT_SECS%"), std::to_string(idleTimeoutSecs));

    #if ENABLE_WELCOME_MESSAGE
        std::string enableWelcomeMessage = "true";
        std::string autoShowWelcome = "true";
        if (config.getBool("home_mode.enable", false))
        {
            autoShowWelcome = stringifyBoolFromConfig(config, "welcome.enable", false);
        }
    #else // configurable
        std::string enableWelcomeMessage = stringifyBoolFromConfig(config, "welcome.enable", false);
        std::string autoShowWelcome = stringifyBoolFromConfig(config, "welcome.enable", false);
    #endif

    Poco::replaceInPlace(preprocess, std::string("%ENABLE_WELCOME_MSG%"), enableWelcomeMessage);
    Poco::replaceInPlace(preprocess, std::string("%AUTO_SHOW_WELCOME%"), autoShowWelcome);

    std::string enableAccessibility = stringifyBoolFromConfig(config, "accessibility.enable", false);
    Poco::replaceInPlace(preprocess, std::string("%ENABLE_ACCESSIBILITY%"), enableAccessibility);

    // the config value of 'notebookbar/tabbed' or 'classic/compact' overrides the UIMode
    // from the WOPI
    std::string userInterfaceModeConfig = config.getString("user_interface.mode", "default");
    if (userInterfaceModeConfig == "compact")
        userInterfaceModeConfig = "classic";

    if (userInterfaceModeConfig == "tabbed")
        userInterfaceModeConfig = "notebookbar";

    if (userInterfaceModeConfig == "classic" || userInterfaceModeConfig == "notebookbar" || userInterfaceMode.empty())
        userInterfaceMode = userInterfaceModeConfig;

    // default to the notebookbar if the value is "default" or whatever
    // nonsensical
    if (enableAccessibility == "true" || (userInterfaceMode != "classic" && userInterfaceMode != "notebookbar"))
        userInterfaceMode = "notebookbar";

    Poco::replaceInPlace(preprocess, std::string("%USER_INTERFACE_MODE%"), userInterfaceMode);

    std::string uiRtlSettings;
    if (LangUtil::isRtlLanguage(requestDetails.getParam("lang")))
        uiRtlSettings = " dir=\"rtl\" ";
    Poco::replaceInPlace(preprocess, std::string("%UI_RTL_SETTINGS%"), uiRtlSettings);

    const std::string useIntegrationThemeString = useIntegrationTheme && hasIntegrationTheme ? "true" : "false";
    Poco::replaceInPlace(preprocess, std::string("%USE_INTEGRATION_THEME%"), useIntegrationThemeString);

    std::string enableMacrosExecution = stringifyBoolFromConfig(config, "security.enable_macros_execution", false);
    Poco::replaceInPlace(preprocess, std::string("%ENABLE_MACROS_EXECUTION%"), enableMacrosExecution);


    if (!config.getBool("feedback.show", true) && config.getBool("home_mode.enable", false))
    {
        Poco::replaceInPlace(preprocess, std::string("%AUTO_SHOW_FEEDBACK%"), (std::string)"false");
    }
    else
    {
        Poco::replaceInPlace(preprocess, std::string("%AUTO_SHOW_FEEDBACK%"), (std::string)"true");
    }


    Poco::replaceInPlace(preprocess, std::string("%FEEDBACK_URL%"), std::string(FEEDBACK_URL));
    Poco::replaceInPlace(preprocess, std::string("%WELCOME_URL%"), std::string(WELCOME_URL));

    const std::string escapedBuyProduct = Util::encodeURIComponent(buyProduct, "'");
    Poco::replaceInPlace(preprocess, std::string("%BUYPRODUCT_URL%"), escapedBuyProduct);

    Poco::replaceInPlace(preprocess, std::string("%DEEPL_ENABLED%"), (config.getBool("deepl.enabled", false) ? std::string("true"): std::string("false")));
    Poco::replaceInPlace(preprocess, std::string("%ZOTERO_ENABLED%"), (config.getBool("zotero.enable", true) ? std::string("true"): std::string("false")));
    Poco::replaceInPlace(preprocess, std::string("%WASM_ENABLED%"), (COOLWSD::getConfigValue<bool>("wasm.enable", false) ? std::string("true"): std::string("false")));
    Poco::URI indirectionURI(config.getString("indirection_endpoint.url", ""));
    Poco::replaceInPlace(preprocess, std::string("%INDIRECTION_URL%"), indirectionURI.toString());

    const std::string mimeType = "text/html";

    // Document signing: if endpoint URL is configured, whitelist that for
    // iframe purposes.
    ContentSecurityPolicy csp;
    csp.appendDirective("default-src", "'none'");
    csp.appendDirective("frame-src", "'self'");
    csp.appendDirective("frame-src", WELCOME_URL);
    csp.appendDirective("frame-src", FEEDBACK_URL);
    csp.appendDirective("frame-src", buyProduct);
    csp.appendDirective("frame-src", "blob:"); // Equivalent to unsafe-eval!
    csp.appendDirective("connect-src", "'self'");
    csp.appendDirective("connect-src", "https://www.zotero.org");
    csp.appendDirective("connect-src", "https://api.zotero.org");
    csp.appendDirective("connect-src", cnxDetails.getWebSocketUrl());
    csp.appendDirective("connect-src", cnxDetails.getWebServerUrl());
    csp.appendDirective("connect-src", indirectionURI.getAuthority());
    csp.appendDirective("script-src", "'self'");
    csp.appendDirective("script-src", "'unsafe-inline'");
    csp.appendDirective("style-src", "'self'");
    csp.appendDirective("style-src", "'unsafe-inline'");
    csp.appendDirective("font-src", "'self'");
    csp.appendDirective("font-src", "data:"); // Equivalent to unsafe-inline!
    csp.appendDirective("object-src", "'self'");
    csp.appendDirective("object-src", "blob:"); // Equivalent to unsafe-eval!
    csp.appendDirective("media-src", "'self'");
    csp.appendDirective("media-src", cnxDetails.getWebServerUrl());
    csp.appendDirective("img-src", "'self'");
    csp.appendDirective("img-src", "data:"); // Equivalent to unsafe-inline!
    csp.appendDirective("img-src", "https://www.collaboraoffice.com/");

    // Frame ancestors: Allow coolwsd host, wopi host and anything configured.
    const std::string configFrameAncestor = config.getString("net.frame_ancestors", "");
    if (!configFrameAncestor.empty())
    {
        static bool warned = false;
        if (!warned)
        {
            warned = true;
            LOG_WRN("The config entry net.frame_ancestors is obsolete and will be removed in the "
                    "future. Please add 'frame-ancestors "
                    << configFrameAncestor << ";' in the net.content_security_policy config");
        }
    }

    std::string frameAncestors = configFrameAncestor;
    Poco::URI uriHost(cnxDetails.getWebSocketUrl());
    if (uriHost.getHost() != configFrameAncestor)
        frameAncestors += ' ' + uriHost.getHost() + ":*";

    for (const auto& param : params)
    {
        if (param.first == "WOPISrc")
        {
            const Poco::URI uriWopiFrameAncestor(Util::decodeURIComponent(param.second));
            // Remove parameters from URL
            const std::string& wopiFrameAncestor = uriWopiFrameAncestor.getHost();
            if (wopiFrameAncestor != uriHost.getHost() && wopiFrameAncestor != configFrameAncestor)
            {
                frameAncestors += ' ' + wopiFrameAncestor + ":*";
                LOG_TRC("Picking frame ancestor from WOPISrc: " << wopiFrameAncestor);
            }
            break;
        }
    }

    if (!frameAncestors.empty())
    {
        LOG_TRC("Allowed frame ancestors: " << frameAncestors);
        // X-Frame-Options supports only one ancestor, ignore that
        //(it's deprecated anyway and CSP works in all major browsers)
        // frame ancestors are also allowed for img-src in order to load the views avatars
        csp.appendDirective("img-src", frameAncestors);
        csp.appendDirective("frame-ancestors", frameAncestors);
        const std::string escapedFrameAncestors = Util::encodeURIComponent(frameAncestors, "'");
        Poco::replaceInPlace(preprocess, std::string("%FRAME_ANCESTORS%"), escapedFrameAncestors);
    }
    else
    {
        LOG_TRC("Denied all frame ancestors");
    }

    std::ostringstream oss;
    oss << "HTTP/1.1 200 OK\r\n"
        "Date: " << Util::getHttpTimeNow() << "\r\n"
        "Last-Modified: " << Util::getHttpTimeNow() << "\r\n"
        "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
        "Cache-Control:max-age=11059200\r\n"
        "ETag: \"" COOLWSD_VERSION_HASH "\"\r\n"
        "Content-Length: " << preprocess.size() << "\r\n"
        "Content-Type: " << mimeType << "\r\n"
        "X-Content-Type-Options: nosniff\r\n"
        "X-XSS-Protection: 1; mode=block\r\n"
        "Referrer-Policy: no-referrer\r\n";

#if !MOBILEAPP
    // if we have richdocuments with:
    // addHeader('Cross-Origin-Opener-Policy', 'same-origin');
    // addHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    // then we seem to have to have this to avoid
    // NS_ERROR_DOM_CORP_FAILED.
    //
    // We expect richdocuments to require these headers if our
    // capabilities shows hasWASMSupport
    if (COOLWSD::WASMState != COOLWSD::WASMActivationState::Disabled)
    {
        oss << "Cross-Origin-Opener-Policy: same-origin\r\n";
        oss << "Cross-Origin-Embedder-Policy: require-corp\r\n";
        oss << "Cross-Origin-Resource-Policy: cross-origin\r\n";
    }

    const bool wasm = (relPath.find("wasm") != std::string::npos);
    if (wasm)
    {
        LOG_ASSERT(COOLWSD::WASMState != COOLWSD::WASMActivationState::Disabled);
        csp.appendDirective("script-src", "'unsafe-eval'");
    }
#endif // !MOBILEAPP

    csp.merge(config.getString("net.content_security_policy", ""));

    // Append CSP to response headers too
    oss << "Content-Security-Policy: " << csp.generate() << "\r\n";

    // Setup HTTP Public key pinning
    if ((COOLWSD::isSSLEnabled() || COOLWSD::isSSLTermination()) && config.getBool("ssl.hpkp[@enable]", false))
    {
        size_t i = 0;
        std::string pinPath = "ssl.hpkp.pins.pin[" + std::to_string(i) + ']';
        std::ostringstream hpkpOss;
        bool keysPinned = false;
        while (config.has(pinPath))
        {
            const std::string pin = config.getString(pinPath, "");
            if (!pin.empty())
            {
                hpkpOss << "pin-sha256=\"" << pin << "\"; ";
                keysPinned = true;
            }
            pinPath = "ssl.hpkp.pins.pin[" + std::to_string(++i) + ']';
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
                LOG_ERR("Invalid value of HPKP's max-age directive found in config file. Defaulting to "
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
    LOG_TRC("Sent file: " << relPath << ": " << preprocess);
}


void FileServerRequestHandler::preprocessWelcomeFile(const HTTPRequest& request,
                                                     const RequestDetails& requestDetails,
                                                     Poco::MemoryInputStream& message,
                                                     const std::shared_ptr<StreamSocket>& socket)
{
    const std::string relPath = getRequestPathname(request, requestDetails);
    LOG_DBG("Preprocessing file: " << relPath);
    std::string templateWelcome = *getUncompressedFile(relPath);

    HTMLForm form(request, message);
    std::string uiTheme = form.get("ui_theme", "");
    uiTheme = (uiTheme == "dark") ? "dark" : "light";
    Poco::replaceInPlace(templateWelcome, std::string("%UI_THEME%"), uiTheme);

    http::Response httpResponse(http::StatusCode::OK);

    // Ask UAs to block if they detect any XSS attempt
    httpResponse.add("X-XSS-Protection", "1; mode=block");
    // No referrer-policy
    httpResponse.add("Referrer-Policy", "no-referrer");
    httpResponse.add("X-Content-Type-Options", "nosniff");
    httpResponse.set("Server", HTTP_SERVER_STRING);
    httpResponse.set("Date", Util::getHttpTimeNow());

    httpResponse.setBody(std::move(templateWelcome));
    socket->send(httpResponse);

    LOG_TRC("Sent file: " << relPath);
}

void FileServerRequestHandler::preprocessAdminFile(const HTTPRequest& request,
                                                   const RequestDetails &requestDetails,
                                                   const std::shared_ptr<StreamSocket>& socket)
{
    Poco::Net::HTTPResponse response;

    if (!COOLWSD::AdminEnabled)
        throw Poco::FileAccessDeniedException("Admin console disabled");

    if (!FileServerRequestHandler::isAdminLoggedIn(request, response))
        throw Poco::Net::NotAuthenticatedException("Invalid admin login");

    const ServerURL cnxDetails(requestDetails);
    const std::string responseRoot = cnxDetails.getResponseRoot();

    static const std::string scriptJS("<script src=\"%s/browser/" COOLWSD_VERSION_HASH "/%s.js\"></script>");
    static const std::string footerPage("<footer class=\"footer has-text-centered\"><strong>Key:</strong> %s &nbsp;&nbsp;<strong>Expiry Date:</strong> %s</footer>");

    const std::string relPath = getRequestPathname(request, requestDetails);
    LOG_DBG("Preprocessing file: " << relPath);
    std::string adminFile = *getUncompressedFile(relPath);
    const std::string templatePath =
        Poco::Path(relPath).setFileName("admintemplate.html").toString();
    std::string templateFile = *getUncompressedFile(templatePath);

    std::string jwtToken;
    Poco::Net::NameValueCollection reqCookies;
    std::vector<Poco::Net::HTTPCookie> resCookies;

    response.getCookies(resCookies);
    for (size_t it = 0; it < resCookies.size(); ++it)
    {
        if (resCookies[it].getName() == "jwt")
        {
            jwtToken = resCookies[it].getValue();
            // when response contains the jwt we can determine that admin console is
            // accessed for the first time by a specific client
            bool showLog =
                COOLWSD::getConfigValue<bool>("admin_console.logging.admin_login", true);
            if (showLog)
            {
                LOG_ANY("Admin logged in with source IPAddress [" << socket->clientAddress()
                                                                  << ']');
            }
            break;
        }
    }

    if (jwtToken.empty())
    {
        request.getCookies(reqCookies);
        if (reqCookies.has("jwt"))
        {
            jwtToken = reqCookies.get("jwt");
        }
    }

    const std::string escapedJwtToken = Util::encodeURIComponent(jwtToken, "'");
    Poco::replaceInPlace(templateFile, std::string("%JWT_TOKEN%"), escapedJwtToken);
    if (relPath == "/browser/dist/admin/adminClusterOverview.html") {
        Poco::replaceInPlace(templateFile, std::string("<!--%BODY%-->"), adminFile);
        Poco::replaceInPlace(templateFile, std::string("%ROUTE_TOKEN%"), COOLWSD::RouteToken);
    } else {
        std::string bodyPath = Poco::Path(relPath).setFileName("adminBody.html").toString();
        std::string bodyFile = *getUncompressedFile(bodyPath);
        Poco::replaceInPlace(templateFile, std::string("<!--%BODY%-->"), bodyFile);
        Poco::replaceInPlace(templateFile, std::string("<!--%MAIN_CONTENT%-->"), adminFile);  // Now template has the main content..
    }

    std::string brandJS(Poco::format(scriptJS, responseRoot, std::string(BRANDING)));
    std::string brandFooter;

#if ENABLE_SUPPORT_KEY
    const auto& config = Application::instance().config();
    const std::string keyString = config.getString("support_key", "");
    SupportKey key(keyString);

    if (!key.verify() || key.validDaysRemaining() <= 0)
    {
        brandJS = Poco::format(scriptJS, std::string(BRANDING_UNSUPPORTED));
        brandFooter = Poco::format(footerPage, key.data(), Poco::DateTimeFormatter::format(key.expiry(), Poco::DateTimeFormat::RFC822_FORMAT));
    }
#endif

    Poco::replaceInPlace(templateFile, std::string("<!--%BRANDING_JS%-->"), brandJS);
    Poco::replaceInPlace(templateFile, std::string("<!--%FOOTER%-->"), brandFooter);
    Poco::replaceInPlace(templateFile, std::string("%VERSION%"), std::string(COOLWSD_VERSION_HASH));
    Poco::replaceInPlace(templateFile, std::string("%SERVICE_ROOT%"), responseRoot);

    // Ask UAs to block if they detect any XSS attempt
    response.add("X-XSS-Protection", "1; mode=block");
    // No referrer-policy
    response.add("Referrer-Policy", "no-referrer");
    response.add("X-Content-Type-Options", "nosniff");
    response.set("Server", HTTP_SERVER_STRING);
    response.set("Date", Util::getHttpTimeNow());

    response.setContentType("text/html");
    response.setChunkedTransferEncoding(false);

    std::ostringstream oss;
    response.write(oss);
    oss << templateFile;
    socket->send(oss.str());
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
