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

#include "RequestDetails.hpp"
#include <Storage.hpp>
#include "WebSocketHandler.hpp"

#include <string>

class RequestVettingStation
{
public:
    /// Create an instance with a SocketPoll and a RequestDetails instance.
    RequestVettingStation(const std::shared_ptr<TerminatingPoll>& poll,
                          const RequestDetails& requestDetails)
        : _poll(poll)
        , _requestDetails(requestDetails)
    {
    }

    inline void logPrefix(std::ostream& os) const { os << '#' << _socket->getFD() << ": "; }

    void handleRequest(const std::string& id, const std::shared_ptr<WebSocketHandler>& ws,
                       const std::shared_ptr<StreamSocket>& socket, unsigned mobileAppDocId,
                       SocketDisposition& disposition);

private:
    void createDocBroker(const std::string& docKey, const std::string& url,
                         const Poco::URI& uriPublic, const bool isReadOnly);

#if !MOBILEAPP
    void checkFileInfo(const std::string& url, const Poco::URI& uriPublic,
                       const std::string& docKey, bool isReadOnly, int redirectionLimit);
#endif //!MOBILEAPP

    /// Send an error to the client and disconnect the socket.
    static void sendErrorAndShutdown(const std::shared_ptr<WebSocketHandler>& ws,
                                     const std::string& msg,
                                     WebSocketHandler::StatusCodes statusCode);

private:
    std::shared_ptr<TerminatingPoll> _poll;
    std::string _id;
    std::shared_ptr<WebSocketHandler> _ws;
    RequestDetails _requestDetails;
    std::shared_ptr<StreamSocket> _socket;
    std::shared_ptr<http::Session> _httpSession;
    unsigned _mobileAppDocId;
    Poco::JSON::Object::Ptr _wopiInfo;
    LockContext _lockCtx;
};
