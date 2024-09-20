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

#include <RequestVettingStation.hpp>
#include <RequestDetails.hpp>
#include <Socket.hpp>
#if !MOBILEAPP
#include <wopi/WopiProxy.hpp>
#endif // !MOBILEAPP

#include <string>
#include <memory>

/// Handles incoming connections and dispatches to the appropriate handler.
class ClientRequestDispatcher final : public SimpleSocketHandler
{
public:
    ClientRequestDispatcher() {}

    static void InitStaticFileContentCache()
    {
        StaticFileContentCache["discovery.xml"] = getDiscoveryXML();
    }

    typedef std::function<void(bool)> AsyncFn;

private:
    /// Set the socket associated with this ResponseClient.
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override;

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition& disposition) override;

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t& /* timeoutMaxMs */) override
    {
        return POLLIN;
    }

    void performWrites(std::size_t /*capacity*/) override {}

#if !MOBILEAPP
    /// Does this address feature in the allowed hosts list.
    static bool allowPostFrom(const std::string& address);

    static bool allowConvertTo(const std::string& address, const Poco::Net::HTTPRequest& request, AsyncFn asyncCb);

    /// @return true if request has been handled synchronously and response sent, otherwise false
    bool handleRootRequest(const RequestDetails& requestDetails,
                           const std::shared_ptr<StreamSocket>& socket);

    /// @return true if request has been handled synchronously and response sent, otherwise false
    static bool handleFaviconRequest(const RequestDetails& requestDetails,
                                     const std::shared_ptr<StreamSocket>& socket);

    /// @return true if request has been handled synchronously and response sent, otherwise false
    bool handleWopiDiscoveryRequest(const RequestDetails& requestDetails,
                                    const std::shared_ptr<StreamSocket>& socket);

    /// @return true if request has been handled synchronously and response sent, otherwise false
    bool handleCapabilitiesRequest(const Poco::Net::HTTPRequest& request,
                                   const std::shared_ptr<StreamSocket>& socket);

    /// @return true if request has been handled synchronously and response sent, otherwise false
    static bool handleClipboardRequest(const Poco::Net::HTTPRequest& request,
                                       Poco::MemoryInputStream& message,
                                       SocketDisposition& disposition,
                                       const std::shared_ptr<StreamSocket>& socket);

    /// @return true if request has been handled synchronously and response sent, otherwise false
    static bool handleRobotsTxtRequest(const Poco::Net::HTTPRequest& request,
                                       const std::shared_ptr<StreamSocket>& socket);

    /// @return true if request has been handled synchronously and response sent, otherwise false
    static bool handleMediaRequest(const Poco::Net::HTTPRequest& request,
                                   SocketDisposition& /*disposition*/,
                                   const std::shared_ptr<StreamSocket>& socket);

    static std::string getContentType(const std::string& fileName);

    static bool isSpreadsheet(const std::string& fileName);

    /// @return true if request has been handled synchronously and response sent, otherwise false
    bool handlePostRequest(const RequestDetails& requestDetails,
                           const Poco::Net::HTTPRequest& request, Poco::MemoryInputStream& message,
                           SocketDisposition& disposition,
                           const std::shared_ptr<StreamSocket>& socket);

    bool handleClientProxyRequest(const Poco::Net::HTTPRequest& request,
                                  const RequestDetails& requestDetails,
                                  Poco::MemoryInputStream& message, SocketDisposition& disposition);

#endif // !MOBILEAPP

    /// @return true if request has been handled synchronously and response sent, otherwise false
    bool handleClientWsUpgrade(const Poco::Net::HTTPRequest& request,
                               const RequestDetails& requestDetails, SocketDisposition& disposition,
                               const std::shared_ptr<StreamSocket>& socket,
                               unsigned mobileAppDocId = 0);

    /// Lookup cached file content.
    static const std::string& getFileContent(const std::string& filename);

    /// Process the discovery.xml file and return as string.
    static std::string getDiscoveryXML();

private:
    // The socket that owns us (we can't own it).
    std::weak_ptr<StreamSocket> _socket;
    std::string _id;

    // Used for StreamSocket::parseHeader, net::Defaults::HTTPTimeout acting as max delay
    std::chrono::steady_clock::time_point _lastSeenHTTPHeader;

#if !MOBILEAPP
    /// WASM document request handler. Used only when WASM is enabled.
    std::unique_ptr<WopiProxy> _wopiProxy;
#endif // !MOBILEAPP

    /// The private RequestVettingStation. Held privately after the
    /// WS is created and as long as it is connected.
    std::shared_ptr<RequestVettingStation> _rvs;

    /// External requests are first vetted before allocating DocBroker and Kit process.
    /// This is a map of the request URI to the RequestVettingStation for vetting.
    static std::unordered_map<std::string, std::shared_ptr<RequestVettingStation>>
        RequestVettingStations;

    /// Cache for static files, to avoid reading and processing from disk.
    static std::map<std::string, std::string> StaticFileContentCache;
};
