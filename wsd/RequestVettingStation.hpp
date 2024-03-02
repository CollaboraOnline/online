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
#if !MOBILEAPP
#include <wopi/CheckFileInfo.hpp>
#endif // !MOBILEAPP

#include <Poco/URI.h>

#include <string>

/// RequestVettingStation is used to vet the request in the background.
/// Vetting for a WOPI request is performed through CheckFileInfo.
/// Once the request checks out, we can proceed to creating a
/// DocBroker and a Kit process.
/// There are two ways to use this class. One is to create it when
/// serving cool.html, the other when the WebSocket is created
/// (by upgrading the socket).
/// Unfortunately, when serving cool.html the connection is not the one
/// used for the WebSocket. As such, it cannot be used to create
/// DocBroker. Therefore, we work in two modes: we do the CheckFileInfo
/// as soon as we serve cool.html, but then we need to wait for the
/// WebSocket to create DocBroker.
/// A small complication is that CheckFileInfo might not be done by
/// then. Or, it might have timed out. Alternatively, the WebSocket
/// might never arrive (say, because the user clicked away).
/// We take these possibilities into account and support them here.
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

    inline void logPrefix(std::ostream& os) const
    {
        if (_socket)
        {
            os << '#' << _socket->getFD() << ": ";
        }
    }

    /// Called when cool.html is served, to start the vetting as early as possible.
    void handleRequest(const std::string& id);

    void handleRequest(const std::string& id, const RequestDetails& requestDetails,
                       const std::shared_ptr<WebSocketHandler>& ws,
                       const std::shared_ptr<StreamSocket>& socket, unsigned mobileAppDocId,
                       SocketDisposition& disposition);

private:
    bool createDocBroker(const std::string& docKey, const std::string& url,
                         const Poco::URI& uriPublic);

    void createClientSession(const std::string& docKey, const std::string& url,
                             const Poco::URI& uriPublic, const bool isReadOnly);

    /// Send an error to the client and disconnect the socket.
    static void sendErrorAndShutdown(const std::shared_ptr<WebSocketHandler>& ws,
                                     const std::string& msg,
                                     WebSocketHandler::StatusCodes statusCode);

#if !MOBILEAPP
    void checkFileInfo(const Poco::URI& uri, bool isReadOnly, int redirectionLimit);
    std::unique_ptr<CheckFileInfo> _checkFileInfo;
#endif // !MOBILEAPP

    std::shared_ptr<TerminatingPoll> _poll;
    std::string _id;
    std::shared_ptr<WebSocketHandler> _ws;
    RequestDetails _requestDetails;
    std::shared_ptr<StreamSocket> _socket;
    unsigned _mobileAppDocId;
    std::shared_ptr<DocumentBroker> _docBroker;
};
