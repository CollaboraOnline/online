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
#include "Socket.hpp"

#include <Poco/MemoryStream.h>

/// Handles file requests over HTTP(S).
class FileServerRequestHandler
{
    static std::string getRequestPathname(const Poco::Net::HTTPRequest& request);

    static void preprocessFile(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& message, const std::shared_ptr<StreamSocket>& socket);

public:
    /// Evaluate if the cookie exists, and if not, ask for the credentials.
    static bool isAdminLoggedIn(const Poco::Net::HTTPRequest& request, Poco::Net::HTTPResponse& response);

    static void handleRequest(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& message, const std::shared_ptr<StreamSocket>& socket);

    static void initializeCompression();

    static void readDirToHash(std::string path);

    static std::string getCompressedFile(std::string path);

    static std::string getUncompressedFile(std::string path);

private:
   static std::map<std::string, std::pair<std::string, std::string>> FileHash;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
