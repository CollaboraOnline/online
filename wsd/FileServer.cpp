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

#include "FileServer.hpp"

#include "Auth.hpp"
#include "COOLWSD.hpp"
#include "Exceptions.hpp"
#include "FileUtil.hpp"
#include "HttpRequest.hpp"
#include "RequestDetails.hpp"
#include "ServerURL.hpp"
#include <Common.hpp>
#include <Crypto.hpp>
#include <Log.hpp>
#include <Protocol.hpp>
#include <Util.hpp>
#include <JsonUtil.hpp>
#include <common/ConfigUtil.hpp>
#include <common/LangUtil.hpp>
#if !MOBILEAPP
#include <net/HttpHelper.hpp>
#endif
#include <ContentSecurityPolicy.hpp>

#include <Poco/DateTime.h>
#include <Poco/DateTimeFormat.h>
#include <Poco/DateTimeFormatter.h>
#include <Poco/Exception.h>
#include <Poco/FileStream.h>
#include <Poco/MemoryStream.h>
#include <Poco/Net/HTMLForm.h>
#include <Poco/Net/HTTPBasicCredentials.h>
#include <Poco/Net/HTTPCookie.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/NameValueCollection.h>
#include <Poco/Net/NetException.h>
#include <Poco/RegularExpression.h>
#include <Poco/Runnable.h>
#include <Poco/SHA1Engine.h>
#include <Poco/StreamCopier.h>
#include <Poco/URI.h>
#include <Poco/Util/LayeredConfiguration.h>

#include <chrono>
#include <iomanip>
#include <string>
#include <vector>

#include <dirent.h>
#include <sys/stat.h>
#include <unistd.h>
#include <zlib.h>
#include <security/pam_appl.h>

#include <wasm/base64.hpp>

#include <openssl/evp.h>

using Poco::Net::HTMLForm;
using Poco::Net::HTTPRequest;
using Poco::Net::NameValueCollection;
using Poco::Util::Application;

std::map<std::string, std::pair<std::string, std::string>> FileServerRequestHandler::FileHash;

// We have files that are at least 2.5 MB already.
// WASM files are in the order of 30 MB, however,
constexpr auto MaxFileSizeToCacheInBytes = 50 * 1024 * 1024;

namespace
{

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

std::string stringifyBoolFromConfig(const Poco::Util::LayeredConfiguration& config,
                                    const std::string& propertyName, bool defaultValue)
{
    return config.getBool(propertyName, defaultValue) ? "true" : "false";
}

} // namespace

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

bool FileServerRequestHandler::isAdminLoggedIn(const Poco::Net::HTTPRequest& request,
                                               std::string& jwtToken)
{
    assert(COOLWSD::AdminEnabled);

    try
    {
        NameValueCollection cookies;
        request.getCookies(cookies);
        jwtToken = cookies.get("jwt");
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

    return false;
}

bool FileServerRequestHandler::authenticateAdmin(const Poco::Net::HTTPBasicCredentials& credentials,
                                                 http::Response& response, std::string& jwtToken)
{
    assert(COOLWSD::AdminEnabled);

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
    if (COOLWSD::getConfigValue<bool>("admin_console.enable_pam", false))
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
    jwtToken = authAgent.getAccessToken();

    Poco::Net::HTTPCookie cookie("jwt", jwtToken);
    // bundlify appears to add an extra /dist -> dist/dist/admin
    cookie.setPath(COOLWSD::ServiceRoot + "/browser/dist/");
    cookie.setSecure(COOLWSD::isSSLEnabled());
    response.header().addCookie(cookie.toString());

    return true;
}

bool FileServerRequestHandler::isAdminLoggedIn(const HTTPRequest& request, http::Response& response)
{
    std::string jwtToken;
    return isAdminLoggedIn(request, jwtToken) ||
           authenticateAdmin(Poco::Net::HTTPBasicCredentials(request), response, jwtToken);
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
        if (path.toString().ends_with(suffix))
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

        if (request.getMethod() == "GET" && !path.toString().ends_with(suffix))
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
            fileInfo->set("UserCanWrite", (requestDetails.getParam("permission") != "readonly") ? "true": "false");
            fileInfo->set("PostMessageOrigin", postMessageOrigin);
            fileInfo->set("LastModifiedTime", localFile->getLastModifiedTime());
            fileInfo->set("EnableOwnerTermination", "true");

            std::ostringstream jsonStream;
            fileInfo->stringify(jsonStream);

            http::Response httpResponse(http::StatusCode::OK);
            FileServerRequestHandler::hstsHeaders(httpResponse);
            httpResponse.set("Last-Modified", Util::getHttpTime(localFile->fileLastModifiedTime));
            httpResponse.setBody(jsonStream.str(), "application/json; charset=utf-8");
            socket->send(httpResponse);

            return;
        }
        else if(request.getMethod() == "GET" && path.toString().ends_with(suffix))
        {
            std::shared_ptr<LocalFileInfo> localFile =
                LocalFileInfo::getOrCreateFile(localPath,path.getFileName());
            auto ss = std::ostringstream{};
            std::ifstream inputFile(localFile->localPath);
            ss << inputFile.rdbuf();

            http::Response httpResponse(http::StatusCode::OK);
            FileServerRequestHandler::hstsHeaders(httpResponse);
            httpResponse.set("Last-Modified", Util::getHttpTime(localFile->fileLastModifiedTime));
            httpResponse.setBody(ss.str(), "text/plain; charset=utf-8");
            socket->send(httpResponse);
            return;
        }
        else if (request.getMethod() == "POST" && path.toString().ends_with(suffix))
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
            FileServerRequestHandler::hstsHeaders(httpResponse);
            httpResponse.setBody(body, "application/json; charset=utf-8");
            socket->send(httpResponse);
            return;
        }
    }
#endif

void FileServerRequestHandler::handleRequest(const HTTPRequest& request,
                                             const RequestDetails& requestDetails,
                                             Poco::MemoryInputStream& message,
                                             const std::shared_ptr<StreamSocket>& socket,
                                             ResourceAccessDetails& accessDetails)
{
    try
    {
        bool noCache = false;
#if ENABLE_DEBUG
        noCache = !COOLWSD::ForceCaching; // for cypress
#endif
        http::Response response(http::StatusCode::OK);
        if( requestDetails.closeConnection() )
            response.header().setConnectionToken(http::Header::ConnectionToken::Close);
        hstsHeaders(response);

        const auto& config = Application::instance().config();

        Poco::URI requestUri(request.getURI());
        LOG_TRC("Fileserver request: " << requestUri.toString());
        requestUri.normalize(); // avoid .'s and ..'s

        if (requestUri.getPath().find("browser/" COOLWSD_VERSION_HASH "/") == std::string::npos &&
            requestUri.getPath().find("admin/") == std::string::npos)
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
        if (relPath.starts_with("/wopi/files")) {
            handleWopiRequest(request, requestDetails, message, socket);
            return;
        }
#endif
        if (request.getMethod() == HTTPRequest::HTTP_POST && endPoint == "logging.html")
        {
            const std::string coolLogging = config.getString("browser_logging", "false");
            if (coolLogging != "false")
            {
                std::string token;
                Poco::SHA1Engine engine;

                engine.update(COOLWSD::LogToken);
                std::getline(message, token, ' ');

                if (Poco::DigestEngine::digestToHex(engine.digest()) == token)
                {
                    LOG_ERR(message.rdbuf());

                    http::Response httpResponse(http::StatusCode::OK);
                    FileServerRequestHandler::hstsHeaders(httpResponse);
                    socket->send(httpResponse);
                    return;
                }
            }
        }

        // Is this a file we read at startup - if not; it's not for serving.
        if (FileHash.find(relPath) == FileHash.end() &&
            FileHash.find(relPath + ".br") == FileHash.end())
        {
            throw Poco::FileNotFoundException("Invalid URI request (hash): [" +
                                              requestUri.toString() + "].");
        }

        if (endPoint == "welcome.html")
        {
            preprocessWelcomeFile(request, response, requestDetails, message, socket);
            return;
        }

        if (endPoint == "cool.html" ||
            endPoint == "help-localizations.json" ||
            endPoint == "localizations.json" ||
            endPoint == "locore-localizations.json" ||
            endPoint == "uno-localizations.json" ||
            endPoint == "uno-localizations-override.json")
        {
            accessDetails = preprocessFile(request, response, requestDetails, message, socket);
            return;
        }

        if (request.getMethod() == HTTPRequest::HTTP_GET)
        {
            if (endPoint == "admin.html" || endPoint == "adminSettings.html" ||
                endPoint == "adminHistory.html" || endPoint == "adminAnalytics.html" ||
                endPoint == "adminLog.html" || endPoint == "adminClusterOverview.html" ||
                endPoint == "adminClusterOverviewAbout.html")
            {
                preprocessAdminFile(request, response, requestDetails, socket);
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

            response.setContentType(std::move(mimeType));

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

                HttpHelper::sendFile(socket, filePath, response, noCache);
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

            response.add("Content-Length", std::to_string(content->size()));

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
        const std::string pathSanitized = Uri::encode(requestUri.getPath(), std::string());
        // Let's keep message as plain text to avoid complications.
        headers += "Content-Type: text/plain charset=UTF-8\r\n";
        body = "Error: " + shortMessage + '\n' +
            longMessage + ' ' + pathSanitized + '\n' +
            "Please contact your system administrator.";
    }
    HttpHelper::sendErrorAndShutdown(errorCode, socket, body, headers);
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

        else if (S_ISREG(fileStat.st_mode) && relPath.ends_with(".br"))
        {
            // Only cache without compressing.
            fileCount++;
            filesRead.append(currentFile->d_name);
            filesRead += ' ';

            std::string uncompressedFile;
            const ssize_t size =
                FileUtil::readFile(basePath + relPath, uncompressedFile, MaxFileSizeToCacheInBytes);
            assert(size < MaxFileSizeToCacheInBytes && "MaxFileSizeToCacheInBytes is too small for "
                                                       "static-file serving; please increase it");
            if (size <= 0)
            {
                assert(uncompressedFile.empty() &&
                       "Unexpected data in uncompressedFile after failed read");
                if (size < 0)
                {
                    LOG_ERR("Failed to read file [" << basePath + relPath
                                                    << "] or is too large to cache and serve");
                }
            }

            FileHash.emplace(prefix + relPath,
                             std::make_pair(std::move(uncompressedFile), std::string()));
        }
        else if (S_ISREG(fileStat.st_mode))
        {
            std::string uncompressedFile;
            const ssize_t size =
                FileUtil::readFile(basePath + relPath, uncompressedFile, MaxFileSizeToCacheInBytes);
            assert(size < MaxFileSizeToCacheInBytes && "MaxFileSizeToCacheInBytes is too small for "
                                                       "static-file serving; please increase it");
            if (size <= 0)
            {
                assert(uncompressedFile.empty() &&
                       "Unexpected data in uncompressedFile after failed read");
                if (size < 0)
                {
                    LOG_ERR("Failed to read file [" << basePath + relPath
                                                    << "] or is too large to cache and serve");
                }

                // Always add the entry, even if the contents are empty.
                FileHash.emplace(prefix + relPath,
                                 std::make_pair(std::move(uncompressedFile), std::string()));
                continue;
            }

            z_stream strm;
            strm.zalloc = Z_NULL;
            strm.zfree = Z_NULL;
            strm.opaque = Z_NULL;
            const int initResult = deflateInit2(&strm, Z_DEFAULT_COMPRESSION, Z_DEFLATED, 31, 8, Z_DEFAULT_STRATEGY);
            if (initResult != Z_OK)
            {
                LOG_ERR("Failed to deflateInit2 for file [" << basePath + relPath
                                                            << "], result: " << initResult);
                // Add the uncompressed version; it's better to serve uncompressed than nothing at all.
                FileHash.emplace(prefix + relPath,
                                 std::make_pair(std::move(uncompressedFile), std::string()));
                continue;
            }

            fileCount++;
            filesRead.append(currentFile->d_name);
            filesRead += ' ';

            // Compress.
            assert(size > 0 && "No data to compress");
            assert(!uncompressedFile.empty() && "Unexpected empty uncompressedFile");
            std::string compressedFile;
            const long unsigned int compSize = compressBound(size);
            compressedFile.resize(compSize);
            strm.next_in = (unsigned char*)&uncompressedFile[0];
            strm.avail_in = size;
            strm.avail_out = compSize;
            strm.next_out = (unsigned char*)&compressedFile[0];
            strm.total_out = strm.total_in = 0;

            const int deflateResult = deflate(&strm, Z_FINISH);
            if (deflateResult != Z_OK && deflateResult != Z_STREAM_END)
            {
                LOG_ERR("Failed to deflate [" << basePath + relPath
                                              << "], result: " << deflateResult);
                compressedFile.clear(); // Can't trust the compressed data, if any.
            }
            else
            {
                compressedFile.resize(compSize - strm.avail_out);
            }

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
    // If a compressed version is not available, return the original uncompressed data.
    const auto& pair = FileHash[path];
    return pair.second.empty() ? &pair.first : &pair.second;
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

#if ENABLE_DEBUG
    if (COOLWSD::WASMState == COOLWSD::WASMActivationState::Forced)
    {
        isWasm = (path.find("/browser/dist/wasm/") == std::string::npos);
    }
    else
#endif
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

/*
  Spinning wheel

<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
   <circle transform='rotate(0)' transform-origin='center' fill='none' stroke='#FF156D' stroke-width='15' stroke-linecap='round' stroke-dasharray='230 1000' stroke-dashoffset='0' cx='100' cy='100' r='70'>
     <animateTransform
         attributeName='transform'
         type='rotate'
         from='0'
         to='360'
         dur='2'
         repeatCount='indefinite'>
      </animateTransform>
   </circle>
</svg>

<meta name="previewImg" content="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyMDAgMjAwJz4KICAgPGNpcmNsZSB0cmFuc2Zvcm09J3JvdGF0ZSgwKScgdHJhbnNmb3JtLW9yaWdpbj0nY2VudGVyJyBmaWxsPSdub25lJyBzdHJva2U9JyNGRjE1NkQnIHN0cm9rZS13aWR0aD0nMTUnIHN0cm9rZS1saW5lY2FwPSdyb3VuZCcgc3Ryb2tlLWRhc2hhcnJheT0nMjMwIDEwMDAnIHN0cm9rZS1kYXNob2Zmc2V0PScwJyBjeD0nMTAwJyBjeT0nMTAwJyByPSc3MCc+CiAgICAgPGFuaW1hdGVUcmFuc2Zvcm0KICAgICAgICAgYXR0cmlidXRlTmFtZT0ndHJhbnNmb3JtJwogICAgICAgICB0eXBlPSdyb3RhdGUnCiAgICAgICAgIGZyb209JzAnCiAgICAgICAgIHRvPSczNjAnCiAgICAgICAgIGR1cj0nMicKICAgICAgICAgcmVwZWF0Q291bnQ9J2luZGVmaW5pdGUnPgogICAgICA8L2FuaW1hdGVUcmFuc2Zvcm0+CiAgIDwvY2lyY2xlPgo8L3N2Zz4=">

 Smile
<?xml version="1.0" encoding="iso-8859-1"?>
<svg fill="#FF156D" height="800px" width="800px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 330 330" xml:space="preserve">
<g id="XMLID_92_">
  <path id="XMLID_93_" d="M165,0C74.019,0,0,74.019,0,165s74.019,165,165,165s165-74.019,165-165S255.981,0,165,0z M165,300
  c-74.439,0-135-60.561-135-135S90.561,30,165,30s135,60.561,135,135S239.439,300,165,300z"/>
    <path id="XMLID_104_" d="M205.306,205.305c-22.226,22.224-58.386,22.225-80.611,0.001c-5.857-5.858-15.355-5.858-21.213,0
    c-5.858,5.858-5.858,15.355,0,21.213c16.963,16.963,39.236,25.441,61.519,25.441c22.276,0,44.56-8.482,61.519-25.441
    c5.858-5.857,5.858-15.355,0-21.213C220.661,199.447,211.163,199.448,205.306,205.305z"/>
    <path id="XMLID_105_" d="M115.14,147.14c3.73-3.72,5.86-8.88,5.86-14.14c0-5.26-2.13-10.42-5.86-14.14
    c-3.72-3.72-8.88-5.86-14.14-5.86c-5.271,0-10.42,2.14-14.141,5.86C83.13,122.58,81,127.74,81,133c0,5.26,2.13,10.42,5.859,14.14C90.58,150.87,95.74,153,101,153S111.42,150.87,115.14,147.14z"/>
    <path id="XMLID_106_" d="M229,113c-5.26,0-10.42,2.14-14.141,5.86C211.14,122.58,209,127.73,209,133c0,5.27,2.14,10.42,5.859,14.14
    C218.58,150.87,223.74,153,229,153s10.42-2.13,14.14-5.86c3.72-3.72,5.86-8.87,5.86-14.14c0-5.26-2.141-10.42-5.86-14.14
    C239.42,115.14,234.26,113,229,113z"/>
</g>
</svg>

<meta name="previewSmile" content="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iaXNvLTg4NTktMSI/Pgo8c3ZnIGZpbGw9IiNGRjE1NkQiIGhlaWdodD0iODAwcHgiIHdpZHRoPSI4MDBweCIgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgdmlld0JveD0iMCAwIDMzMCAzMzAiIHhtbDpzcGFjZT0icHJlc2VydmUiPgo8ZyBpZD0iWE1MSURfOTJfIj4KICA8cGF0aCBpZD0iWE1MSURfOTNfIiBkPSJNMTY1LDBDNzQuMDE5LDAsMCw3NC4wMTksMCwxNjVzNzQuMDE5LDE2NSwxNjUsMTY1czE2NS03NC4wMTksMTY1LTE2NVMyNTUuOTgxLDAsMTY1LDB6IE0xNjUsMzAwCiAgYy03NC40MzksMC0xMzUtNjAuNTYxLTEzNS0xMzVTOTAuNTYxLDMwLDE2NSwzMHMxMzUsNjAuNTYxLDEzNSwxMzVTMjM5LjQzOSwzMDAsMTY1LDMwMHoiLz4KICAgIDxwYXRoIGlkPSJYTUxJRF8xMDRfIiBkPSJNMjA1LjMwNiwyMDUuMzA1Yy0yMi4yMjYsMjIuMjI0LTU4LjM4NiwyMi4yMjUtODAuNjExLDAuMDAxYy01Ljg1Ny01Ljg1OC0xNS4zNTUtNS44NTgtMjEuMjEzLDAKICAgIGMtNS44NTgsNS44NTgtNS44NTgsMTUuMzU1LDAsMjEuMjEzYzE2Ljk2MywxNi45NjMsMzkuMjM2LDI1LjQ0MSw2MS41MTksMjUuNDQxYzIyLjI3NiwwLDQ0LjU2LTguNDgyLDYxLjUxOS0yNS40NDEKICAgIGM1Ljg1OC01Ljg1Nyw1Ljg1OC0xNS4zNTUsMC0yMS4yMTNDMjIwLjY2MSwxOTkuNDQ3LDIxMS4xNjMsMTk5LjQ0OCwyMDUuMzA2LDIwNS4zMDV6Ii8+CiAgICA8cGF0aCBpZD0iWE1MSURfMTA1XyIgZD0iTTExNS4xNCwxNDcuMTRjMy43My0zLjcyLDUuODYtOC44OCw1Ljg2LTE0LjE0YzAtNS4yNi0yLjEzLTEwLjQyLTUuODYtMTQuMTQKICAgIGMtMy43Mi0zLjcyLTguODgtNS44Ni0xNC4xNC01Ljg2Yy01LjI3MSwwLTEwLjQyLDIuMTQtMTQuMTQxLDUuODZDODMuMTMsMTIyLjU4LDgxLDEyNy43NCw4MSwxMzNjMCw1LjI2LDIuMTMsMTAuNDIsNS44NTksMTQuMTRDOTAuNTgsMTUwLjg3LDk1Ljc0LDE1MywxMDEsMTUzUzExMS40MiwxNTAuODcsMTE1LjE0LDE0Ny4xNHoiLz4KICAgIDxwYXRoIGlkPSJYTUxJRF8xMDZfIiBkPSJNMjI5LDExM2MtNS4yNiwwLTEwLjQyLDIuMTQtMTQuMTQxLDUuODZDMjExLjE0LDEyMi41OCwyMDksMTI3LjczLDIwOSwxMzNjMCw1LjI3LDIuMTQsMTAuNDIsNS44NTksMTQuMTQKICAgIEMyMTguNTgsMTUwLjg3LDIyMy43NCwxNTMsMjI5LDE1M3MxMC40Mi0yLjEzLDE0LjE0LTUuODZjMy43Mi0zLjcyLDUuODYtOC44Nyw1Ljg2LTE0LjE0YzAtNS4yNi0yLjE0MS0xMC40Mi01Ljg2LTE0LjE0CiAgICBDMjM5LjQyLDExNS4xNCwyMzQuMjYsMTEzLDIyOSwxMTN6Ii8+CjwvZz4KPC9zdmc+">

*/

constexpr std::string_view BRANDING = "branding";
constexpr std::string_view SUPPORT_KEY_BRANDING_UNSUPPORTED = "branding-unsupported";

static const std::string ACCESS_TOKEN = "%ACCESS_TOKEN%";
static const std::string ACCESS_TOKEN_TTL = "%ACCESS_TOKEN_TTL%";
static const std::string ACCESS_HEADER = "%ACCESS_HEADER%";
static const std::string UI_DEFAULTS = "%UI_DEFAULTS%";
static const std::string CSS_VARS = "<!--%CSS_VARIABLES%-->";
static const std::string POSTMESSAGE_ORIGIN = "%POSTMESSAGE_ORIGIN%";
static const std::string BRANDING_THEME = "%BRANDING_THEME%";
static const std::string CHECK_FILE_INFO_OVERRIDE = "%CHECK_FILE_INFO_OVERRIDE%";
static const std::string BUYPRODUCT_URL = "%BUYPRODUCT_URL%";
static const std::string PERMISSION = "%PERMISSION%";

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
        const std::string escaped = Uri::encode(value, "'");
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

        extractVariable(form, "checkfileinfo_override", CHECK_FILE_INFO_OVERRIDE);

        extractVariable(form, "buy_product", BUYPRODUCT_URL);

        extractVariable(form, "permission", PERMISSION);

        std::string buyProduct;
        {
            std::lock_guard<std::mutex> lock(COOLWSD::RemoteConfigMutex);
            buyProduct = COOLWSD::BuyProductUrl;
        }

        if (buyProduct.empty())
        {
            buyProduct = form.get("buy_product", "");
        }

        const std::string escapedBuyProduct = Uri::encode(buyProduct, "'");
        _vars[BUYPRODUCT_URL] = escapedBuyProduct;

        LOG_TRC("Field [buy_product] for var [" << BUYPRODUCT_URL << "] = [" << escapedBuyProduct
                                                << ']');
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

namespace
{
std::string boolToString(const bool value)
{
    return value ? std::string("true"): std::string("false");
}
}

FileServerRequestHandler::ResourceAccessDetails FileServerRequestHandler::preprocessFile(
    const HTTPRequest& request, http::Response& httpResponse, const RequestDetails& requestDetails,
    Poco::MemoryInputStream& message, const std::shared_ptr<StreamSocket>& socket)
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
    LOG_TRC("buy_product=" << buyProduct << " host_session_id=" << form.get("host_session_id", ""));

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
    Poco::replaceInPlace(preprocess, std::string("%VERSION%"), Util::getCoolVersionHash());
    Poco::replaceInPlace(preprocess, std::string("%COOLWSD_VERSION%"), Util::getCoolVersion());
    Poco::replaceInPlace(preprocess, std::string("%SERVICE_ROOT%"), responseRoot);
    Poco::replaceInPlace(preprocess, UI_DEFAULTS, macaron::Base64::Encode(
                         uiDefaultsToJSON(urv[UI_DEFAULTS], userInterfaceMode, userInterfaceTheme, savedUIState)));
    Poco::replaceInPlace(preprocess, std::string("%UI_THEME%"), userInterfaceTheme); // UI_THEME refers to light or dark theme
    Poco::replaceInPlace(preprocess, BRANDING_THEME, urv[BRANDING_THEME]);
    Poco::replaceInPlace(preprocess, std::string("%SAVED_UI_STATE%"), savedUIState);
    Poco::replaceInPlace(preprocess, POSTMESSAGE_ORIGIN, urv[POSTMESSAGE_ORIGIN]);
    Poco::replaceInPlace(preprocess, CHECK_FILE_INFO_OVERRIDE,
                         checkFileInfoToJSON(urv[CHECK_FILE_INFO_OVERRIDE]));
    Poco::replaceInPlace(preprocess, std::string("%WOPI_HOST_ID%"), form.get("host_session_id", ""));

    const auto& config = Application::instance().config();

    std::string protocolDebug = stringifyBoolFromConfig(config, "logging.protocol", false);
    Poco::replaceInPlace(preprocess, std::string("%PROTOCOL_DEBUG%"), protocolDebug);

    bool enableDebug = false;
#if ENABLE_DEBUG
    enableDebug = true;
#endif
    std::string enableDebugStr = stringifyBoolFromConfig(config, "logging.protocol", enableDebug);
    Poco::replaceInPlace(preprocess, std::string("%ENABLE_DEBUG%"), enableDebugStr);

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

    if (config::isSupportKeyEnabled())
    {
        const std::string keyString = config.getString("support_key", "");
        SupportKey key(keyString);
        if (!key.verify() || key.validDaysRemaining() <= 0)
        {
            brandCSS = Poco::format(linkCSS, responseRoot, std::string(SUPPORT_KEY_BRANDING_UNSUPPORTED));
            brandJS = Poco::format(scriptJS, responseRoot, std::string(SUPPORT_KEY_BRANDING_UNSUPPORTED));
        }
    }

    Poco::replaceInPlace(preprocess, std::string("<!--%BRANDING_CSS%-->"), brandCSS);
    Poco::replaceInPlace(preprocess, std::string("<!--%BRANDING_JS%-->"), brandJS);
    Poco::replaceInPlace(preprocess, CSS_VARS, cssVarsToStyle(urv[CSS_VARS]));

    if (config.getBool("browser_logging", false))
    {
        Poco::SHA1Engine engine;
        engine.update(COOLWSD::LogToken);
        Poco::replaceInPlace(preprocess, std::string("%BROWSER_LOGGING%"),
                             Poco::DigestEngine::digestToHex(engine.digest()));
    }
    else
        Poco::replaceInPlace(preprocess, std::string("%BROWSER_LOGGING%"), std::string());

    const unsigned int outOfFocusTimeoutSecs = config.getUInt("per_view.out_of_focus_timeout_secs", 300);
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
        userInterfaceMode = std::move(userInterfaceModeConfig);

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

    bool allowUpdateNotification = config.getBool("allow_update_popup", true);
    Poco::replaceInPlace(preprocess, std::string("%ENABLE_UPDATE_NOTIFICATION%"), boolToString(allowUpdateNotification));

    Poco::replaceInPlace(preprocess, std::string("%FEEDBACK_URL%"), std::string(FEEDBACK_URL));
    Poco::replaceInPlace(preprocess, std::string("%WELCOME_URL%"), std::string(WELCOME_URL));

    Poco::replaceInPlace(preprocess, BUYPRODUCT_URL, urv[BUYPRODUCT_URL]);

    Poco::replaceInPlace(preprocess, std::string("%DEEPL_ENABLED%"), boolToString(config.getBool("deepl.enabled", false)));
    Poco::replaceInPlace(preprocess, std::string("%ZOTERO_ENABLED%"), boolToString(config.getBool("zotero.enable", true)));
    Poco::replaceInPlace(preprocess, std::string("%WASM_ENABLED%"), boolToString(COOLWSD::getConfigValue<bool>("wasm.enable", false)));
    Poco::URI indirectionURI(config.getString("indirection_endpoint.url", ""));
    Poco::replaceInPlace(preprocess, std::string("%INDIRECTION_URL%"), indirectionURI.toString());

    bool geoLocationSetup = config.getBool("indirection_endpoint.geolocation_setup.enable", false);
    if (geoLocationSetup)
        Poco::replaceInPlace(preprocess, std::string("%GEOLOCATION_SETUP%"),
                             boolToString(geoLocationSetup));

    const std::string mimeType = "text/html";

    // Document signing: if endpoint URL is configured, whitelist that for
    // iframe purposes.
    ContentSecurityPolicy csp;
    csp.appendDirective("default-src", "'none'");
    csp.appendDirective("frame-src", "'self'");
    csp.appendDirectiveUrl("frame-src", WELCOME_URL);
    csp.appendDirectiveUrl("frame-src", FEEDBACK_URL);
    csp.appendDirectiveUrl("frame-src", Uri::decode(urv[BUYPRODUCT_URL]));
    csp.appendDirective("frame-src", "blob:"); // Equivalent to unsafe-eval!
    csp.appendDirective("connect-src", "'self'");
    csp.appendDirectiveUrl("connect-src", "https://www.zotero.org");
    csp.appendDirectiveUrl("connect-src", "https://api.zotero.org");
    csp.appendDirectiveUrl("connect-src", cnxDetails.getWebSocketUrl());
    csp.appendDirectiveUrl("connect-src", cnxDetails.getWebServerUrl());
    csp.appendDirectiveUrl("connect-src", indirectionURI.getAuthority());
    csp.appendDirective("script-src", "'self'");
    csp.appendDirective("script-src", "'unsafe-eval'");
    csp.appendDirective("style-src", "'self'");
    csp.appendDirective("font-src", "'self'");
    csp.appendDirective("object-src", "'self'");
    csp.appendDirective("media-src", "'self'");
    csp.appendDirectiveUrl("media-src", cnxDetails.getWebServerUrl());
    csp.appendDirective("img-src", "'self'");
    csp.appendDirective("img-src", "data:"); // Equivalent to unsafe-inline!
    csp.appendDirectiveUrl("img-src", "https://www.collaboraoffice.com/");

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

    std::string wopiSrc;
    for (const auto& param : params)
    {
        if (param.first == "WOPISrc")
        {
            if (!HttpHelper::verifyWOPISrc(request.getURI(), param.second, socket))
            {
                httpResponse.header().setConnectionToken(http::Header::ConnectionToken::Close);
                return ResourceAccessDetails();
            }

            const Poco::URI uriWopiFrameAncestor(Uri::decode(param.second));
            wopiSrc = uriWopiFrameAncestor.toString();

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
        const std::string escapedFrameAncestors = Uri::encode(frameAncestors, "'");
        Poco::replaceInPlace(preprocess, std::string("%FRAME_ANCESTORS%"), escapedFrameAncestors);
    }
    else
    {
        LOG_TRC("Denied all frame ancestors");
    }

    httpResponse.set("Last-Modified", Util::getHttpTimeNow());
    httpResponse.set("Cache-Control", "max-age=11059200");
    httpResponse.set("ETag", COOLWSD_VERSION_HASH);

    httpResponse.add("X-Content-Type-Options", "nosniff");
    httpResponse.add("X-XSS-Protection", "1; mode=block");
    httpResponse.add("Referrer-Policy", "no-referrer");

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
        httpResponse.add("Cross-Origin-Opener-Policy", "same-origin");
        httpResponse.add("Cross-Origin-Embedder-Policy", "require-corp");
        httpResponse.add("Cross-Origin-Resource-Policy", "cross-origin");
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
    httpResponse.add("Content-Security-Policy", csp.generate());

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
                httpResponse.add("Public-Key-Pins-Report-Only", hpkpOss.str());
            }
            else
            {
                httpResponse.add("Public-Key-Pins", hpkpOss.str());
            }
        }
    }

    httpResponse.setBody(preprocess, mimeType);

    socket->send(httpResponse);
    LOG_TRC("Sent file: " << relPath << ": " << preprocess);

    return ResourceAccessDetails(std::move(wopiSrc), urv[ACCESS_TOKEN], urv[PERMISSION]);
}

void FileServerRequestHandler::preprocessWelcomeFile(const HTTPRequest& request,
                                                     http::Response& httpResponse,
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

    // Ask UAs to block if they detect any XSS attempt
    httpResponse.add("X-XSS-Protection", "1; mode=block");
    // No referrer-policy
    httpResponse.add("Referrer-Policy", "no-referrer");
    httpResponse.add("X-Content-Type-Options", "nosniff");

    httpResponse.setBody(std::move(templateWelcome));
    socket->send(httpResponse);

    LOG_TRC("Sent file: " << relPath);
}

void FileServerRequestHandler::preprocessAdminFile(const HTTPRequest& request,
                                                   http::Response& response,
                                                   const RequestDetails& requestDetails,
                                                   const std::shared_ptr<StreamSocket>& socket)
{
    if (!COOLWSD::AdminEnabled)
        throw Poco::FileAccessDeniedException("Admin console disabled");

    std::string jwtToken;
    if (!isAdminLoggedIn(request, jwtToken))
    {
        // Not logged in, so let's log in now.
        if (!authenticateAdmin(Poco::Net::HTTPBasicCredentials(request), response, jwtToken))
        {
            throw Poco::Net::NotAuthenticatedException("Invalid admin login");
        }

        // New login, log.
        static bool showLog =
            COOLWSD::getConfigValue<bool>("admin_console.logging.admin_login", true);
        if (showLog)
        {
            LOG_ANY("Admin logged in with source IPAddress [" << socket->clientAddress() << ']');
        }
    }

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

    const std::string escapedJwtToken = Uri::encode(jwtToken, "'");
    Poco::replaceInPlace(templateFile, std::string("%JWT_TOKEN%"), escapedJwtToken);
    if (relPath == "/browser/dist/admin/adminClusterOverview.html" ||
        relPath == "/browser/dist/admin/adminClusterOverviewAbout.html")
    {
        std::string bodyPath = Poco::Path(relPath).setFileName("adminClusterBody.html").toString();
        std::string bodyFile = *getUncompressedFile(bodyPath);
        Poco::replaceInPlace(templateFile, std::string("<!--%BODY%-->"), bodyFile);
        Poco::replaceInPlace(templateFile, std::string("<!--%MAIN_CONTENT%-->"), adminFile);
        Poco::replaceInPlace(templateFile, std::string("%ROUTE_TOKEN%"), COOLWSD::RouteToken);
    }
    else
    {
        std::string bodyPath = Poco::Path(relPath).setFileName("adminBody.html").toString();
        std::string bodyFile = *getUncompressedFile(bodyPath);
        Poco::replaceInPlace(templateFile, std::string("<!--%BODY%-->"), bodyFile);
        Poco::replaceInPlace(templateFile, std::string("<!--%MAIN_CONTENT%-->"),
                             adminFile); // Now template has the main content..
    }

    std::string brandJS(Poco::format(scriptJS, responseRoot, std::string(BRANDING)));
    std::string brandFooter;

    if (config::isSupportKeyEnabled())
    {
        const auto& config = Application::instance().config();
        const std::string keyString = config.getString("support_key", "");
        SupportKey key(keyString);

        if (!key.verify() || key.validDaysRemaining() <= 0)
        {
            brandJS = Poco::format(scriptJS, std::string(SUPPORT_KEY_BRANDING_UNSUPPORTED));
            brandFooter = Poco::format(footerPage, key.data(), Poco::DateTimeFormatter::format(key.expiry(), Poco::DateTimeFormat::RFC822_FORMAT));
        }
    }

    Poco::replaceInPlace(templateFile, std::string("<!--%BRANDING_JS%-->"), brandJS);
    Poco::replaceInPlace(templateFile, std::string("<!--%FOOTER%-->"), brandFooter);
    Poco::replaceInPlace(templateFile, std::string("%VERSION%"), std::string(COOLWSD_VERSION_HASH));
    Poco::replaceInPlace(templateFile, std::string("%SERVICE_ROOT%"), responseRoot);

    // Ask UAs to block if they detect any XSS attempt
    response.add("X-XSS-Protection", "1; mode=block");
    // No referrer-policy
    response.add("Referrer-Policy", "no-referrer");
    response.add("X-Content-Type-Options", "nosniff");
    response.set("Server", http::getServerString());
    response.set("Date", Util::getHttpTimeNow());

    response.setBody(std::move(templateFile));
    socket->send(response);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
