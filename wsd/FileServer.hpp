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

#pragma once

#include <string>
#include <unordered_map>

#include <HttpRequest.hpp>
#include <Socket.hpp>
#include <COOLWSD.hpp>

class RequestDetails;

namespace Poco
{
namespace Net
{
class HTTPRequest;
class HTTPResponse;
class HTTPBasicCredentials;
} // namespace Net

} // namespace Poco

/// Represents a file that is preprocessed for variable
/// expansion/replacement before serving.
class PreProcessedFile
{
    friend class FileServeTests;

public:
    enum class SegmentType : char
    {
        Data,
        Variable,
        CommentedVariable
    };

    PreProcessedFile(std::string filename, const std::string& data);

    const std::string& filename() const { return _filename; }
    std::size_t size() const { return _size; }

    /// Substitute variables per the given map.
    std::string substitute(const std::unordered_map<std::string, std::string>& values);

private:
    const std::string _filename; //< Filename on disk, with extension.
    const std::size_t _size; //< Number of bytes in original file.
    /// The segments of the file in <IsVariable, Data> pairs.
    std::vector<std::pair<SegmentType, std::string>> _segments;
};

inline std::ostream& operator<<(std::ostream& os, const PreProcessedFile::SegmentType type)
{
    switch (type)
    {
        case PreProcessedFile::SegmentType::Data:
            os << "Data";
            break;
        case PreProcessedFile::SegmentType::Variable:
            os << "Variable";
            break;
        case PreProcessedFile::SegmentType::CommentedVariable:
            os << "CommentedVariable";
            break;
    }

    return os;
}

/// Handles file requests over HTTP(S).
class FileServerRequestHandler
{
public:
    /// The WOPI URL and authentication details,
    /// as extracted from the cool.html file-serving request.
    class ResourceAccessDetails
    {
    public:
        ResourceAccessDetails() = default;

        ResourceAccessDetails(std::string wopiSrc, std::string accessToken, std::string permission)
            : _wopiSrc(std::move(wopiSrc))
            , _accessToken(std::move(accessToken))
            , _permission(std::move(permission))
        {
        }

        bool isValid() const { return !_wopiSrc.empty() && !_accessToken.empty(); }

        const std::string wopiSrc() const { return _wopiSrc; }
        const std::string accessToken() const { return _accessToken; }
        const std::string permission() const { return _permission; }

    private:
        std::string _wopiSrc;
        std::string _accessToken;
        std::string _permission;
    };

private:
    friend class FileServeTests; // for unit testing

    static std::string getRequestPathname(const Poco::Net::HTTPRequest& request,
                                          const RequestDetails& requestDetails);

    static ResourceAccessDetails preprocessFile(const Poco::Net::HTTPRequest& request,
                                                http::Response& httpResponse,
                                                const RequestDetails& requestDetails,
                                                Poco::MemoryInputStream& message,
                                                const std::shared_ptr<StreamSocket>& socket);
    static void preprocessWelcomeFile(const Poco::Net::HTTPRequest& request,
                                      http::Response& httpResponse,
                                      const RequestDetails& requestDetails,
                                      Poco::MemoryInputStream& message,
                                      const std::shared_ptr<StreamSocket>& socket);
    static void preprocessAdminFile(const Poco::Net::HTTPRequest& request,
                                    http::Response& httpResponse,
                                    const RequestDetails& requestDetails,
                                    const std::shared_ptr<StreamSocket>& socket);

    /// Construct a JSON to be accepted by the cool.html from a list like
    /// UIMode=classic;TextRuler=true;PresentationStatusbar=false
    /// that is passed as "ui_defaults" hidden input during the iframe setup.
    /// Also returns the UIMode from uiDefaults in uiMode output param
    /// and SavedUIState as a stringified boolean (default "true")
    static std::string uiDefaultsToJSON(const std::string& uiDefaults, std::string& uiMode, std::string& uiTheme, std::string& savedUIState);

    static std::string checkFileInfoToJSON(const std::string& checkfileFileInfo);

    static std::string cssVarsToStyle(const std::string& cssVars);

public:
    FileServerRequestHandler(const std::string& root);
    ~FileServerRequestHandler();

    /// Evaluate if the cookie exists and returns it when it does.
    static bool isAdminLoggedIn(const Poco::Net::HTTPRequest& request, std::string& jwtToken);

    /// Evaluate if the cookie exists, and if not, ask for the credentials.
    static bool isAdminLoggedIn(const Poco::Net::HTTPRequest& request, http::Response& response);

    /// Authenticate the admin.
    static bool authenticateAdmin(const Poco::Net::HTTPBasicCredentials& credentials,
                                  http::Response& response, std::string& jwtToken);

    static void handleRequest(const Poco::Net::HTTPRequest& request,
                              const RequestDetails& requestDetails,
                              Poco::MemoryInputStream& message,
                              const std::shared_ptr<StreamSocket>& socket,
                              ResourceAccessDetails& accessDetails);

    static void readDirToHash(const std::string &basePath, const std::string &path, const std::string &prefix = std::string());

    static const std::string *getCompressedFile(const std::string &path);

    static const std::string *getUncompressedFile(const std::string &path);

    /// If configured and necessary, sets the HSTS headers.
    static void hstsHeaders([[maybe_unused]] http::Response& response)
    {
        // HSTS hardening. Disabled in debug builds.
#if !ENABLE_DEBUG
        if (COOLWSD::isSSLEnabled() || COOLWSD::isSSLTermination())
        {
            if (COOLWSD::getConfigValue<bool>("ssl.sts.enabled", false))
            {
                // Only for release, which doesn't support tests. No CONFIG_STATIC, therefore.
                static const auto maxAge =
                    COOLWSD::getConfigValue<int>("ssl.sts.max_age", 31536000); // Default 1 year.
                response.add("Strict-Transport-Security",
                             "max-age=" + std::to_string(maxAge) + "; includeSubDomains");
            }
        }
#endif
    }

private:
    static std::map<std::string, std::pair<std::string, std::string>> FileHash;
    static void sendError(http::StatusCode errorCode, const Poco::Net::HTTPRequest& request,
                          const std::shared_ptr<StreamSocket>& socket,
                          const std::string& shortMessage, const std::string& longMessage,
                          const std::string& extraHeader = std::string());
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
