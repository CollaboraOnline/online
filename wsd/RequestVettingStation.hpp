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

#include "RequestDetails.hpp"
#include <Storage.hpp>
#include "WebSocketHandler.hpp"

#include <string>

class RequestVettingStation
{
public:
    RequestVettingStation(std::string id, std::shared_ptr<WebSocketHandler> ws,
                          const RequestDetails& requestDetails,
                          const std::shared_ptr<StreamSocket>& socket, unsigned mobileAppDocId)
        : _id(std::move(id))
        , _ws(ws)
        , _requestDetails(requestDetails)
        , _socket(socket)
        , _mobileAppDocId(mobileAppDocId)
    {
        // Indicate to the client that document broker is searching.
        static const std::string status("statusindicator: find");
        LOG_TRC("Sending to Client [" << status << "].");
        _ws->sendMessage(status);
    }

    inline void logPrefix(std::ostream& os) const { os << '#' << _socket->getFD() << ": "; }

    void handleRequest(SocketPoll& poll, SocketDisposition& disposition);

private:
    void createDocBroker(const std::string& docKey, const std::string& url,
                         const Poco::URI& uriPublic, const bool isReadOnly,
                         Poco::JSON::Object::Ptr wopiInfo = nullptr);

#if !MOBILEAPP
    void checkFileInfo(SocketPoll& poll, const std::string& url, const Poco::URI& uriPublic,
                       const std::string& docKey, bool isReadOnly, int redirectionLimit);
#endif //!MOBILEAPP

    /// Send an error to the client and disconnect the socket.
    static void sendErrorAndShutdown(const std::shared_ptr<WebSocketHandler>& ws,
                                     const std::shared_ptr<Socket>& socket, const std::string& msg,
                                     WebSocketHandler::StatusCodes statusCode);

private:
    const std::string _id;
    std::shared_ptr<WebSocketHandler> _ws;
    const RequestDetails _requestDetails;
    const std::shared_ptr<StreamSocket> _socket;
    std::shared_ptr<http::Session> _httpSession;
    const unsigned _mobileAppDocId;
    std::unique_ptr<WopiStorage::WOPIFileInfo> _wopiInfo;
    LockContext _lockCtx;
};
