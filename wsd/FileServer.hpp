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

    static void preprocessAndSendLoleafletHtml(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& message, const std::shared_ptr<StreamSocket>& socket);

public:
    /// If valid cookies exists in request, log the admin in (returns true)
    /// If no cookie exist check the credentials, set the cookie and log the admin in
    /// In case no valid cookie exists or invalid or no credentials exist, return false
    static bool tryAdminLogin(const Poco::Net::HTTPRequest& request, Poco::Net::HTTPResponse& response);

    static void handleRequest(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& message, const std::shared_ptr<StreamSocket>& socket);
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
