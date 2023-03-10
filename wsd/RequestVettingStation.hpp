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
    }

    inline void logPrefix(std::ostream& os) const { os << '#' << _socket->getFD() << ": "; }

    void handleRequest(SocketPoll& poll, SocketDisposition& disposition);

private:
    void createDocBroker(const std::string& docKey, const std::string& url,
                         const Poco::URI& uriPublic, const bool isReadOnly);

private:
    const std::string _id;
    std::shared_ptr<WebSocketHandler> _ws;
    const RequestDetails _requestDetails;
    const std::shared_ptr<StreamSocket> _socket;
    std::shared_ptr<http::Session> _httpSession;
    unsigned _mobileAppDocId;
};
