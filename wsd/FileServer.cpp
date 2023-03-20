/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>
#include <config_version.h>

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
#include "ServerURL.hpp"
#include <Log.hpp>
#include <Protocol.hpp>
#include <Util.hpp>
#include <common/ConfigUtil.hpp>
#include <common/LangUtil.hpp>
#if !MOBILEAPP
#include <net/HttpHelper.hpp>
#endif
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
    if (config.getBool("admin_console.enable_pam", "false"))
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
    cookie.setSecure(COOLWSD::isSSLEnabled() ||
                     COOLWSD::isSSLTermination());
    response.addCookie(cookie);

    return true;
}

#if ENABLE_DEBUG
    // Represents basic file's attributes.
    // Used for localFile
    class LocalFileInfo
    {
        public:

            // Everytime we get new request of CheckFileInfo
            // we create a LocalFileInfo object of the new file and add
            // it to static vector so that we can use/update the file info
            // when we get GetFile and PutFile request
            static std::vector<LocalFileInfo> fileInfoVec;

            // Attributes of file
            std::string fileName;
            std::string localPath;
            std::string size;

            // Last modified time of the file
            std::chrono::system_clock::time_point fileLastModifiedTime;


            enum class COOLStatusCode
            {
                DocChanged = 1010  // Document changed externally in storage
            };

        LocalFileInfo(){};

        LocalFileInfo(std::string lpath, std::string fName)
        {
            fileName = fName;
            localPath = lpath;
            const FileUtil::Stat stat(localPath);
            size = std::to_string(stat.size());
            fileLastModifiedTime = stat.modifiedTimepoint();
        }

        //Returns index if object with attribute localPath found in
        //the vector else returns -1
        static int getIndex(std::string lpath)
        {
            auto it = std::find_if(fileInfoVec.begin(), fileInfoVec.end(), [&lpath](const LocalFileInfo& obj)
            {
                return obj.localPath == lpath;
            });

            if (it != fileInfoVec.end())
            {
                int index = std::distance(fileInfoVec.begin(), it);
                return index;
            }
            else
            {
                return -1;
            }
        }
    };
    std::atomic<unsigned> lastLocalId;
    std::vector<LocalFileInfo> LocalFileInfo::fileInfoVec;

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
            LocalFileInfo localFile;
            if (!LocalFileInfo::fileInfoVec.empty())
            {
                int index = LocalFileInfo::getIndex(localPath);
                if (index == -1)
                {
                    LocalFileInfo fileInfo(localPath, path.getFileName());
                    LocalFileInfo::fileInfoVec.emplace_back(fileInfo);
                    localFile = fileInfo;
                }
                 else
                {
                    localFile = LocalFileInfo::fileInfoVec[index];
                }
            }
            else
            {
                LocalFileInfo fileInfo(localPath, path.getFileName());
                LocalFileInfo::fileInfoVec.emplace_back(fileInfo);
                localFile = fileInfo;
            }
            std::string userId = std::to_string(lastLocalId++);
            std::string userNameString = "LocalUser#" + userId;
            Poco::JSON::Object::Ptr fileInfo = new Poco::JSON::Object();

            std::string postMessageOrigin;
            config::isSslEnabled() ? postMessageOrigin = "https://" : postMessageOrigin = "http://";
            postMessageOrigin += requestDetails.getHostUntrusted();

            fileInfo->set("BaseFileName", localFile.fileName);
            fileInfo->set("Size", localFile.size);
            fileInfo->set("Version", "1.0");
            fileInfo->set("OwnerId", "test");
            fileInfo->set("UserId", userId);
            fileInfo->set("UserFriendlyName", userNameString);
            fileInfo->set("UserCanWrite", "true");
            fileInfo->set("PostMessageOrigin", postMessageOrigin);
            fileInfo->set("LastModifiedTime", Util::getIso8601FracformatTime(localFile.fileLastModifiedTime));
            fileInfo->set("EnableOwnerTermination", "true");

            std::ostringstream jsonStream;
            fileInfo->stringify(jsonStream);
            std::string responseString = jsonStream.str();

            const std::string mimeType = "application/json; charset=utf-8";

            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "Last-Modified: " << Util::getHttpTime(localFile.fileLastModifiedTime) << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: " << responseString.size() << "\r\n"
                "Content-Type: " << mimeType << "\r\n"
                "\r\n"
                << responseString;

            socket->send(oss.str());
            return;
        }
        else if(request.getMethod() == "GET" && Util::endsWith(path.toString(), suffix))
        {
            LocalFileInfo localFile = LocalFileInfo::fileInfoVec[LocalFileInfo::getIndex(localPath)];
            auto ss = std::ostringstream{};
            std::ifstream inputFile(localFile.localPath);
            ss << inputFile.rdbuf();
            const std::string content = ss.str();
            const std::string mimeType = "text/plain; charset=utf-8";
            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "Last-Modified: " << Util::getHttpTime(localFile.fileLastModifiedTime) << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: " << localFile.size << "\r\n"
                "Content-Type: " << mimeType << "\r\n"
                "\r\n"
                << content;

            socket->send(oss.str());
            return;
        }
        else if (request.getMethod() == "POST" && Util::endsWith(path.toString(), suffix))
        {
            int i = LocalFileInfo::getIndex(localPath);
            std::string wopiTimestamp = request.get("X-COOL-WOPI-Timestamp", std::string());
            if (wopiTimestamp.empty())
            {
                wopiTimestamp = request.get("X-LOOL-WOPI-Timestamp", std::string());
            }
            if (!wopiTimestamp.empty())
            {
                const std::string fileModifiedTime = Util::getIso8601FracformatTime(LocalFileInfo::fileInfoVec[i].fileLastModifiedTime);
                if (wopiTimestamp != fileModifiedTime)
                {
                    http::Response httpResponse(http::StatusCode::Conflict);
                    httpResponse.setBody(
                        "{\"COOLStatusCode\":" +
                        std::to_string(static_cast<int>(LocalFileInfo::COOLStatusCode::DocChanged)) + ',' +
                        "{\"LOOLStatusCode\":" +
                        std::to_string(static_cast<int>(LocalFileInfo::COOLStatusCode::DocChanged)) + '}');
                    socket->send(httpResponse);
                    return;
                }
            }

            std::streamsize size = request.getContentLength();
            std::vector<char> buffer(size);
            message.read(buffer.data(), size);
            LocalFileInfo::fileInfoVec[i].fileLastModifiedTime = std::chrono::system_clock::now();

            std::ofstream outfile;
            outfile.open(LocalFileInfo::fileInfoVec[i].localPath, std::ofstream::binary);
            outfile.write(buffer.data(), size);
            outfile.close();

            const std::string body = "{\"LastModifiedTime\": \"" +
                                        Util::getIso8601FracformatTime(LocalFileInfo::fileInfoVec[i].fileLastModifiedTime) +
                                        "\" }";
            http::Response httpResponse(http::StatusCode::OK);
            httpResponse.setBody(body);
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
        Poco::Net::HTTPResponse response;

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

        const std::string relPath = getRequestPathname(request);
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

                std::ostringstream oss;
                response.write(oss);
                socket->send(oss.str());
                return;
            }
        }

        // Is this a file we read at startup - if not; it's not for serving.
        if (FileHash.find(relPath) == FileHash.end())
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
                endPoint == "adminLog.html")
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
            else
                mimeType = "text/plain";

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
                    HttpHelper::sendErrorAndShutdown(304, socket, std::string(), extraHeaders);
                    return;
                }
            }

            response.set("Server", HTTP_SERVER_STRING);
            response.set("Date", Util::getHttpTimeNow());

            bool gzip = request.hasToken("Accept-Encoding", "gzip");
            const std::string *content;
#if ENABLE_DEBUG
            if (std::getenv("COOL_SERVE_FROM_FS"))
            {
                // Useful to not serve from memory sometimes especially during cool development
                // Avoids having to restart cool everytime you make a change in cool
                const std::string filePath = Poco::Path(COOLWSD::FileServerRoot, relPath).absolute().toString();
                HttpHelper::sendFileAndShutdown(socket, filePath, mimeType, &response, noCache);
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
                response.set("ETag", etagString);
            }
            response.setContentType(mimeType);
            response.add("X-Content-Type-Options", "nosniff");

            std::ostringstream oss;
            response.write(oss);
            const std::string header = oss.str();
            LOG_TRC('#' << socket->getFD() << ": Sending " <<
                    (!gzip ? "un":"") << "compressed : file [" << relPath << "]: " << header);
            socket->send(header);
            socket->send(*content);
            // shutdown by caller
        }
    }
    catch (const Poco::Net::NotAuthenticatedException& exc)
    {
        LOG_ERR("FileServerRequestHandler::NotAuthenticated: " << exc.displayText());
        sendError(401, request, socket, "", "", "WWW-authenticate: Basic realm=\"online\"\r\n");
    }
    catch (const Poco::FileAccessDeniedException& exc)
    {
        LOG_ERR("FileServerRequestHandler: " << exc.displayText());
        sendError(403, request, socket, "403 - Access denied!",
                  "You are unable to access");
    }
    catch (const Poco::FileNotFoundException& exc)
    {
        LOG_ERR("FileServerRequestHandler: " << exc.displayText());
        sendError(404, request, socket, "404 - file not found!",
                  "There seems to be a problem locating");
    }
    catch (Poco::SyntaxException& exc)
    {
        LOG_ERR("Incorrect config value: " << exc.displayText());
        sendError(500, request, socket, "500 - Internal Server Error!",
                  "Cannot process the request - " + exc.displayText());
    }
}

void FileServerRequestHandler::sendError(int errorCode, const Poco::Net::HTTPRequest& request,
                                         const std::shared_ptr<StreamSocket>& socket,
                                         const std::string& shortMessage, const std::string& longMessage,
                                         const std::string& extraHeader)
{
    std::string body;
    std::string headers = extraHeader;
    if (!shortMessage.empty())
    {
        Poco::URI requestUri(request.getURI());
        std::string pathSanitized;
        Poco::URI::encode(requestUri.getPath(), "", pathSanitized);
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
    LOG_DBG("Caching files in [" << basePath + path << ']');

    DIR* workingdir = opendir((basePath + path).c_str());
    if (!workingdir)
    {
        LOG_SYS("Failed to open directory [" << basePath + path << ']');
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
        stat ((basePath + relPath).c_str(), &fileStat);

        if (S_ISDIR(fileStat.st_mode))
            readDirToHash(basePath, relPath);

        else if (S_ISREG(fileStat.st_mode))
        {
            fileCount++;
            filesRead.append(currentFile->d_name);
            filesRead += ' ';

            std::ifstream file(basePath + relPath, std::ios::binary);

            z_stream strm;
            strm.zalloc = Z_NULL;
            strm.zfree = Z_NULL;
            strm.opaque = Z_NULL;
            deflateInit2(&strm, Z_DEFAULT_COMPRESSION, Z_DEFLATED, 31, 8, Z_DEFAULT_STRATEGY);

            std::unique_ptr<char[]> buf(new char[fileStat.st_size]);
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

                deflate(&strm, Z_FINISH);

                const long unsigned int haveComp = compSize - strm.avail_out;
                std::string partialcompFile(cbuf, haveComp);
                std::string partialuncompFile(buf.get(), size);
                compressedFile += partialcompFile;
                uncompressedFile += partialuncompFile;
                free(cbuf);

            } while(true);

            FileHash.emplace(prefix + relPath, std::make_pair(uncompressedFile, compressedFile));
            deflateEnd(&strm);
        }
    }
    closedir(workingdir);

    if (fileCount > 0)
        LOG_TRC("Pre-read " << fileCount << " file(s) from directory: " << basePath << path << ": " << filesRead);
}

void FileServerRequestHandler::initialize()
{
    // cool files
    try {
        readDirToHash(COOLWSD::FileServerRoot, "/browser/dist");
    } catch (...) {
        LOG_ERR("Failed to read from directory " << COOLWSD::FileServerRoot);
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
    Poco::RegularExpression gitHashRe("/([0-9a-f]+)/");
    std::string gitHash;
    if (gitHashRe.extract(path, gitHash))
    {
        // Convert version back to a real file name.
        Poco::replaceInPlace(path, std::string("/browser" + gitHash), std::string("/browser/dist/"));
    }

    return path;
}

constexpr char BRANDING[] = "branding";
#if ENABLE_SUPPORT_KEY
constexpr char BRANDING_UNSUPPORTED[] = "branding-unsupported";
#endif

void FileServerRequestHandler::preprocessFile(const HTTPRequest& request,
                                              const RequestDetails &requestDetails,
                                              Poco::MemoryInputStream& message,
                                              const std::shared_ptr<StreamSocket>& socket)
{
    ServerURL cnxDetails(requestDetails);

    const Poco::URI::QueryParameters params = Poco::URI(request.getURI()).getQueryParameters();

    // Is this a file we read at startup - if not; it's not for serving.
    const std::string relPath = getRequestPathname(request);
    LOG_DBG("Preprocessing file: " << relPath);
    std::string preprocess = *getUncompressedFile(relPath);

    // We need to pass certain parameters from the cool html GET URI
    // to the embedded document URI. Here we extract those params
    // from the GET URI and set them in the generated html (see cool.html.m4).
    HTMLForm form(request, message);
    const std::string accessToken = form.get("access_token", "");
    const std::string accessTokenTtl = form.get("access_token_ttl", "");
    LOG_TRC("access_token=" << accessToken << ", access_token_ttl=" << accessTokenTtl);
    const std::string accessHeader = form.get("access_header", "");
    LOG_TRC("access_header=" << accessHeader);
    const std::string uiDefaults = form.get("ui_defaults", "");
    LOG_TRC("ui_defaults=" << uiDefaults);
    const std::string cssVars = form.get("css_variables", "");
    LOG_TRC("css_variables=" << cssVars);
    std::string buyProduct;
    {
        std::lock_guard<std::mutex> lock(COOLWSD::RemoteConfigMutex);
        buyProduct = COOLWSD::BuyProductUrl;
    }
    if (buyProduct.empty())
        buyProduct = form.get("buy_product", "");
    LOG_TRC("buy_product=" << buyProduct);
    const std::string postMessageOrigin = form.get("postmessage_origin", "");
    LOG_TRC("postmessage_origin" << postMessageOrigin);
    const std::string theme = form.get("theme", "");
    LOG_TRC("theme=" << theme);
    const std::string checkfileinfo_override = form.get("checkfileinfo_override", "");
    LOG_TRC("checkfileinfo_override=" << checkfileinfo_override);

    // Escape bad characters in access token.
    // This is placed directly in javascript in cool.html, we need to make sure
    // that no one can do anything nasty with their clever inputs.
    std::string escapedAccessToken, escapedAccessHeader, escapedPostmessageOrigin;
    Poco::URI::encode(accessToken, "'", escapedAccessToken);
    Poco::URI::encode(accessHeader, "'", escapedAccessHeader);
    Poco::URI::encode(postMessageOrigin, "'", escapedPostmessageOrigin);

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
                LOG_ERR("access_token_ttl must be represented as the number of milliseconds since January 1, 1970 UTC, when the token will expire");
            }
        }
        else
        {
            LOG_INF("WOPI host did not pass optional access_token_ttl");
        }
    }

    std::string socketProxy = "false";
    if (requestDetails.isProxy())
        socketProxy = "true";
    Poco::replaceInPlace(preprocess, std::string("%SOCKET_PROXY%"), socketProxy);

    std::string responseRoot = cnxDetails.getResponseRoot();
    std::string userInterfaceMode;

    Poco::replaceInPlace(preprocess, std::string("%ACCESS_TOKEN%"), escapedAccessToken);
    Poco::replaceInPlace(preprocess, std::string("%ACCESS_TOKEN_TTL%"), std::to_string(tokenTtl));
    Poco::replaceInPlace(preprocess, std::string("%ACCESS_HEADER%"), escapedAccessHeader);
    Poco::replaceInPlace(preprocess, std::string("%HOST%"), cnxDetails.getWebSocketUrl());
    Poco::replaceInPlace(preprocess, std::string("%VERSION%"), std::string(COOLWSD_VERSION_HASH));
    Poco::replaceInPlace(preprocess, std::string("%COOLWSD_VERSION%"), std::string(COOLWSD_VERSION));
    Poco::replaceInPlace(preprocess, std::string("%SERVICE_ROOT%"), responseRoot);
    Poco::replaceInPlace(preprocess, std::string("%UI_DEFAULTS%"), uiDefaultsToJSON(uiDefaults, userInterfaceMode));
    Poco::replaceInPlace(preprocess, std::string("%POSTMESSAGE_ORIGIN%"), escapedPostmessageOrigin);
    Poco::replaceInPlace(preprocess, std::string("%CHECK_FILE_INFO_OVERRIDE%"),
                         checkFileInfoToJSON(checkfileinfo_override));

    const auto& config = Application::instance().config();

    std::string protocolDebug = stringifyBoolFromConfig(config, "logging.protocol", false);
    Poco::replaceInPlace(preprocess, std::string("%PROTOCOL_DEBUG%"), protocolDebug);

    static const std::string hexifyEmbeddedUrls =
        COOLWSD::getConfigValue<bool>("hexify_embedded_urls", false) ? "true" : "false";
    Poco::replaceInPlace(preprocess, std::string("%HEXIFY_URL%"), hexifyEmbeddedUrls);


    bool useIntegrationTheme = config.getBool("user_interface.use_integration_theme", true);
    bool hasIntegrationTheme = (theme != "") && FileUtil::Stat(COOLWSD::FileServerRoot + "/browser/dist/" + theme).exists();
    std::string escapedTheme;
    Poco::URI::encode(theme, "'", escapedTheme);
    const std::string themePreFix = hasIntegrationTheme && useIntegrationTheme ? escapedTheme + "/" : "";
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
    Poco::replaceInPlace(preprocess, std::string("<!--%CSS_VARIABLES%-->"), cssVarsToStyle(cssVars));

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
    if (userInterfaceMode != "classic" && userInterfaceMode != "notebookbar")
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

    std::string escapedBuyProduct;
    Poco::URI::encode(buyProduct, "'", escapedBuyProduct);
    Poco::replaceInPlace(preprocess, std::string("%BUYPRODUCT_URL%"), escapedBuyProduct);

    Poco::replaceInPlace(preprocess, std::string("%DEEPL_ENABLED%"), (config.getBool("deepl.enabled", false) ? std::string("true"): std::string("false")));
    Poco::replaceInPlace(preprocess, std::string("%ZOTERO_ENABLED%"), (config.getBool("zotero.enable", true) ? std::string("true"): std::string("false")));
    Poco::URI indirectionURI(config.getString("indirection_endpoint.url", ""));
    Poco::replaceInPlace(preprocess, std::string("%INDIRECTION_URL%"), indirectionURI.toString());

    const std::string mimeType = "text/html";

    std::ostringstream cspOss;
    cspOss << "Content-Security-Policy: default-src 'none'; "
        "frame-src 'self' " << WELCOME_URL << " " << FEEDBACK_URL << " " << buyProduct << "; "
           "connect-src 'self' https://www.zotero.org https://api.zotero.org "
           << cnxDetails.getWebSocketUrl() << " " << cnxDetails.getWebServerUrl() << " "
           << indirectionURI.getAuthority() << "; "
           "script-src 'unsafe-inline' 'self'; "
           "style-src 'self' 'unsafe-inline'; "
           "font-src 'self' data:; "
           "object-src 'self' blob:; "
           "media-src 'self'; ";

    // Frame ancestors: Allow coolwsd host, wopi host and anything configured.
    std::string configFrameAncestor = config.getString("net.frame_ancestors", "");
    std::string frameAncestors = configFrameAncestor;
    Poco::URI uriHost(cnxDetails.getWebSocketUrl());
    if (uriHost.getHost() != configFrameAncestor)
        frameAncestors += ' ' + uriHost.getHost() + ":*";

    for (const auto& param : params)
    {
        if (param.first == "WOPISrc")
        {
            std::string wopiFrameAncestor;
            Poco::URI::decode(param.second, wopiFrameAncestor);
            Poco::URI uriWopiFrameAncestor(wopiFrameAncestor);
            // Remove parameters from URL
            wopiFrameAncestor = uriWopiFrameAncestor.getHost();
            if (wopiFrameAncestor != uriHost.getHost() && wopiFrameAncestor != configFrameAncestor)
            {
                frameAncestors += ' ' + wopiFrameAncestor + ":*";
                LOG_TRC("Picking frame ancestor from WOPISrc: " << wopiFrameAncestor);
            }
            break;
        }
    }

    std::string imgSrc = "img-src 'self' data: https://www.collaboraoffice.com/";
    if (!frameAncestors.empty())
    {
        LOG_TRC("Allowed frame ancestors: " << frameAncestors);
        // X-Frame-Options supports only one ancestor, ignore that
        //(it's deprecated anyway and CSP works in all major browsers)
        // frame anchestors are also allowed for img-src in order to load the views avatars
        cspOss << imgSrc << " " << frameAncestors << "; "
                << "frame-ancestors " << frameAncestors;
        std::string escapedFrameAncestors;
        Poco::URI::encode(frameAncestors, "'", escapedFrameAncestors);
        Poco::replaceInPlace(preprocess, std::string("%FRAME_ANCESTORS%"), escapedFrameAncestors);
    }
    else
    {
        LOG_TRC("Denied all frame ancestors");
        cspOss << imgSrc << "; ";
    }

    cspOss << "\r\n";

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

    // Append CSP to response headers too
    oss << cspOss.str();

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
                                                     const RequestDetails &/*requestDetails*/,
                                                     Poco::MemoryInputStream& /*message*/,
                                                     const std::shared_ptr<StreamSocket>& socket)
{
    Poco::Net::HTTPResponse response;
    const std::string relPath = getRequestPathname(request);
    LOG_DBG("Preprocessing file: " << relPath);
    std::string templateWelcome = *getUncompressedFile(relPath);

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
    oss << templateWelcome;
    socket->send(oss.str());
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

    ServerURL cnxDetails(requestDetails);
    std::string responseRoot = cnxDetails.getResponseRoot();

    static const std::string scriptJS("<script src=\"%s/browser/" COOLWSD_VERSION_HASH "/%s.js\"></script>");
    static const std::string footerPage("<footer class=\"footer has-text-centered\"><strong>Key:</strong> %s &nbsp;&nbsp;<strong>Expiry Date:</strong> %s</footer>");

    const std::string relPath = getRequestPathname(request);
    LOG_DBG("Preprocessing file: " << relPath);
    std::string adminFile = *getUncompressedFile(relPath);
    const std::string templatePath =
        Poco::Path(relPath).setFileName("admintemplate.html").toString();
    std::string templateFile = *getUncompressedFile(templatePath);
    Poco::replaceInPlace(templateFile, std::string("<!--%MAIN_CONTENT%-->"), adminFile); // Now template has the main content..

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
