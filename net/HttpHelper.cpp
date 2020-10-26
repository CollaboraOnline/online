/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "HttpHelper.hpp"

#include <Poco/MemoryStream.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <common/Common.hpp>
#include <common/Util.hpp>
#include <net/Socket.hpp>

namespace HttpHelper
{
void sendError(int errorCode, const std::shared_ptr<StreamSocket>& socket, const std::string& body,
               const std::string& extraHeader)
{
    std::ostringstream oss;
    oss << "HTTP/1.1 " << errorCode << "\r\n"
        << "Date: " << Util::getHttpTimeNow() << "\r\n"
        << "User-Agent: " << WOPI_AGENT_STRING << "\r\n"
        << "Content-Length: " << body.size() << "\r\n"
        << extraHeader << "\r\n"
        << body;
    socket->send(oss.str());
}

void sendErrorAndShutdown(int errorCode, const std::shared_ptr<StreamSocket>& socket,
                          const std::string& body, const std::string& extraHeader)
{
    sendError(errorCode, socket, body, extraHeader);
    socket->shutdown();
}
} // namespace HttpHelper
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
