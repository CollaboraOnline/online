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

#include <Poco/MemoryStream.h>
#include <Poco/Net/HTTPRequestHandler.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTTPServerResponse.h>

#include "Socket.hpp"

/// Handles file requests over HTTP(S).
class FileServerRequestHandler
{
    static std::string getRequestPathname(const Poco::Net::HTTPRequest& request);

    static void preprocessFile(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& message, const std::shared_ptr<StreamSocket>& socket);

public:
    /// Evaluate if the cookie exists, and if not, ask for the credentials.
    static bool isAdminLoggedIn(Poco::Net::HTTPServerRequest& request, Poco::Net::HTTPServerResponse& response);

    static void handleRequest(const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& message, const std::shared_ptr<StreamSocket>& socket);
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
