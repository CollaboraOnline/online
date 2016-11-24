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

#include "config.h"

#include <string>
#include <vector>

#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPRequestHandler.h>
#include <Poco/Net/HTTPServer.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTTPServerResponse.h>
#include <Poco/Net/SecureServerSocket.h>

#include "Log.hpp"

/// Handles file requests over HTTP(S).
class FileServerRequestHandler : public Poco::Net::HTTPRequestHandler
{
    std::string getRequestPathname(const Poco::Net::HTTPServerRequest& request);

    void preprocessFile(Poco::Net::HTTPServerRequest& request, Poco::Net::HTTPServerResponse& response) throw(Poco::FileAccessDeniedException);

public:
    /// Evaluate if the cookie exists, and if not, ask for the credentials.
    static bool isAdminLoggedIn(Poco::Net::HTTPServerRequest& request, Poco::Net::HTTPServerResponse& response);

    void handleRequest(Poco::Net::HTTPServerRequest& request, Poco::Net::HTTPServerResponse& response) override;
};

/// Singleton class to serve files over HTTP(S).
class FileServer
{
public:
    static FileServer& instance()
    {
        static FileServer fileServer;
        return fileServer;
    }

    static FileServerRequestHandler* createRequestHandler()
    {
        return new FileServerRequestHandler();
    }

    FileServer(FileServer const&) = delete;
    void operator=(FileServer const&) = delete;

private:
    FileServer();
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
