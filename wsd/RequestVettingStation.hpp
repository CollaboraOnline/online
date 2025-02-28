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
#include "Util.hpp"
#include "WebSocketHandler.hpp"

#include <Poco/URI.h>

#include <string>

class CheckFileInfo;
class PresetsInstallTask;

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
class RequestVettingStation final : public std::enable_shared_from_this<RequestVettingStation>
{
public:
    /// Create an instance with a SocketPoll and a RequestDetails instance.
    RequestVettingStation(const std::shared_ptr<TerminatingPoll>& poll,
                          const RequestDetails& requestDetails)
        : _requestDetails(requestDetails)
        , _poll(poll)
        , _mobileAppDocId(0)
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

    /// Called when the WebSocket is connected (i.e. after cool.html is loaded in the browser).
    void handleRequest(const std::string& id, const RequestDetails& requestDetails,
                       const std::shared_ptr<WebSocketHandler>& ws,
                       const std::shared_ptr<StreamSocket>& socket, unsigned mobileAppDocId,
                       SocketDisposition& disposition);

    /// Returns true iff we are older than the given age.
    template <typename T>
    bool aged(T minAge,
              std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now()) const
    {
        return _birthday.elapsed<T>(minAge, now);
    }

private:
    bool createDocBroker(const std::string& docKey, const std::string& configId,
                         const std::string& url, const Poco::URI& uriPublic);

    void createClientSession(const std::string& docKey, const std::string& url,
                             const Poco::URI& uriPublic, const bool isReadOnly);

    /// Send unauthorized error to the client and disconnect the socket.
    /// Includes SSL verification status, if available, as the error code.
    void sendUnauthorizedErrorAndShutdown();

    /// Send an error to the client and disconnect the socket.
    static void sendErrorAndShutdown(const std::shared_ptr<WebSocketHandler>& ws,
                                     const std::string& msg,
                                     WebSocketHandler::StatusCodes statusCode);

#if !MOBILEAPP
    void launchInstallPresets();

    void checkFileInfo(const Poco::URI& uri, bool isReadOnly, int redirectionLimit);
    std::shared_ptr<CheckFileInfo> _checkFileInfo;
    std::shared_ptr<PresetsInstallTask> _asyncInstallTask;
#endif // !MOBILEAPP

    RequestDetails _requestDetails;
    std::string _id;
    std::shared_ptr<TerminatingPoll> _poll;
    std::shared_ptr<WebSocketHandler> _ws;
    std::shared_ptr<StreamSocket> _socket;
    std::shared_ptr<DocumentBroker> _docBroker;
    Util::Stopwatch _birthday;
    unsigned _mobileAppDocId;
};
