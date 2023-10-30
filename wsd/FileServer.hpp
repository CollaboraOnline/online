/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

#pragma once

#include <string>

#include <HttpRequest.hpp>
#include <Socket.hpp>

#include <Poco/MemoryStream.h>
#include <Poco/Util/LayeredConfiguration.h>

class RequestDetails;
/// Handles file requests over HTTP(S).
class FileServerRequestHandler
{
    friend class FileServeTests; // for unit testing

    static std::string getRequestPathname(const Poco::Net::HTTPRequest& request);

    static void preprocessFile(const Poco::Net::HTTPRequest& request,
                               const RequestDetails &requestDetails,
                               Poco::MemoryInputStream& message,
                               const std::shared_ptr<StreamSocket>& socket);
    static void preprocessWelcomeFile(const Poco::Net::HTTPRequest& request,
                                      const RequestDetails &requestDetails,
                                      Poco::MemoryInputStream& message,
                                      const std::shared_ptr<StreamSocket>& socket);
    static void preprocessAdminFile(const Poco::Net::HTTPRequest& request,
                                    const RequestDetails &requestDetails,
                                    const std::shared_ptr<StreamSocket>& socket);

    /// Construct a JSON to be accepted by the cool.html from a list like
    /// UIMode=classic;TextRuler=true;PresentationStatusbar=false
    /// that is passed as "ui_defaults" hidden input during the iframe setup.
    /// Also returns the UIMode from uiDefaults in uiMode output param
    /// and SavedUIState as a stringified boolean (default "true")
    static std::string uiDefaultsToJSON(const std::string& uiDefaults, std::string& uiMode, std::string& uiTheme, std::string& savedUIState);

    static std::string checkFileInfoToJSON(const std::string& checkfileFileInfo);

    static std::string cssVarsToStyle(const std::string& cssVars);

    static std::string stringifyBoolFromConfig(const Poco::Util::LayeredConfiguration& config,
                                               std::string propertyName,
                                               bool defaultValue);

public:
    FileServerRequestHandler(const std::string& root);
    ~FileServerRequestHandler();

    /// Evaluate if the cookie exists, and if not, ask for the credentials.
    static bool isAdminLoggedIn(const Poco::Net::HTTPRequest& request, Poco::Net::HTTPResponse& response);
    static bool isAdminLoggedIn(const Poco::Net::HTTPRequest& request, http::Response& response);

    static void handleRequest(const Poco::Net::HTTPRequest& request,
                              const RequestDetails &requestDetails,
                              Poco::MemoryInputStream& message,
                              const std::shared_ptr<StreamSocket>& socket);

    static void readDirToHash(const std::string &basePath, const std::string &path, const std::string &prefix = std::string());

    static const std::string *getCompressedFile(const std::string &path);

    static const std::string *getUncompressedFile(const std::string &path);

private:
    static std::map<std::string, std::pair<std::string, std::string>> FileHash;
    static void sendError(http::StatusCode errorCode, const Poco::Net::HTTPRequest& request,
                          const std::shared_ptr<StreamSocket>& socket,
                          const std::string& shortMessage, const std::string& longMessage,
                          const std::string& extraHeader = std::string());
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
