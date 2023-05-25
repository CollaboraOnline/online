/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <string>
#include "Socket.hpp"

#include <Poco/MemoryStream.h>
#include <Poco/Util/LayeredConfiguration.h>

class RequestDetails;
/// Handles file requests over HTTP(S).
class FileServerRequestHandler
{
    friend class WhiteBoxTests; // for unit testing

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
    static std::string uiDefaultsToJSON(const std::string& uiDefaults, std::string& uiMode, std::string& uiTheme);

    static std::string checkFileInfoToJSON(const std::string& checkfileFileInfo);

    static std::string cssVarsToStyle(const std::string& cssVars);

    static std::string stringifyBoolFromConfig(const Poco::Util::LayeredConfiguration& config,
                                               std::string propertyName,
                                               bool defaultValue);

public:
    /// Evaluate if the cookie exists, and if not, ask for the credentials.
    static bool isAdminLoggedIn(const Poco::Net::HTTPRequest& request, Poco::Net::HTTPResponse& response);

    static void handleRequest(const Poco::Net::HTTPRequest& request,
                              const RequestDetails &requestDetails,
                              Poco::MemoryInputStream& message,
                              const std::shared_ptr<StreamSocket>& socket);

    /// Read all files that we can serve into memory and compress them.
    static void initialize();

    /// Clean cached files.
    static void uninitialize() { FileHash.clear(); }

    static void readDirToHash(const std::string &basePath, const std::string &path, const std::string &prefix = std::string());

    static const std::string *getCompressedFile(const std::string &path);

    static const std::string *getUncompressedFile(const std::string &path);

private:
    static std::map<std::string, std::pair<std::string, std::string>> FileHash;
    static void sendError(int errorCode, const Poco::Net::HTTPRequest& request,
                          const std::shared_ptr<StreamSocket>& socket, const std::string& shortMessage,
                          const std::string& longMessage, const std::string& extraHeader = "");
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
