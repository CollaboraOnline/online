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

#include <net/WebSocketHandler.hpp>
#include <wsd/wopi/CheckFileInfo.hpp>

#include <memory>
#include <string>

class StreamSocket;

namespace Poco::Net
{
class HTTPRequest;
}

/// WebSocket handler for /co/collab endpoint.
/// Accepts WOPISrc from URL, access_token from first message,
/// then validates via CheckFileInfo before allowing authentication.
class CollabSocketHandler : public WebSocketHandler
{
    std::string _wopiSrc;
    std::string _accessToken;
    bool _isAuthenticated = false;
    bool _isValidating = false;
    std::shared_ptr<CheckFileInfo> _checkFileInfo;
    std::weak_ptr<StreamSocket> _socketWeak;

public:
    CollabSocketHandler(const std::shared_ptr<StreamSocket>& socket,
                        const Poco::Net::HTTPRequest& request,
                        bool allowedOrigin,
                        const std::string& wopiSrc);

    void handleMessage(const std::vector<char>& payload) override;

    const std::string& getWopiSrc() const { return _wopiSrc; }
    const std::string& getAccessToken() const { return _accessToken; }
    bool isAuthenticated() const { return _isAuthenticated; }

private:
    void startValidation();
    void onCheckFileInfoFinished(CheckFileInfo& cfi);
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
