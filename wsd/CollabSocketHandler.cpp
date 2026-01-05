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

#include <config.h>

#include "CollabSocketHandler.hpp"
#include "CollabBroker.hpp"

#include <COOLWSD.hpp>
#include <Protocol.hpp>
#include <RequestDetails.hpp>
#include <Socket.hpp>
#include <Util.hpp>

#include <Poco/Net/HTTPRequest.h>
#include <Poco/URI.h>

CollabSocketHandler::CollabSocketHandler(const std::shared_ptr<StreamSocket>& socket,
                                         const Poco::Net::HTTPRequest& request,
                                         bool allowedOrigin,
                                         const std::string& wopiSrc)
    : WebSocketHandler(socket, request, allowedOrigin)
    , _wopiSrc(wopiSrc)
    , _socketWeak(socket)
{
}

void CollabSocketHandler::handleMessage(const std::vector<char>& payload)
{
    if (_isValidating)
    {
        // Still validating, ignore messages
        LOG_DBG("Collab: validation in progress, ignoring message");
        return;
    }

    if (!_isAuthenticated)
    {
        const std::string msg(payload.data(), payload.size());
        static const std::string prefix = "access_token ";
        if (msg.size() > prefix.size() &&
            msg.compare(0, prefix.size(), prefix) == 0)
        {
            _accessToken = msg.substr(prefix.size());
            startValidation();
            return;
        }
        LOG_ERR("First message must be access_token, got: "
                << COOLProtocol::getAbbreviatedMessage(payload));
        sendMessage("error: cmd=collab kind=accesstoken");
        shutdown();
        return;
    }
    // TODO: Handle authenticated messages
}

void CollabSocketHandler::startValidation()
{
    _isValidating = true;

    // Send progress message
    sendMessage("progress: validating");

    // Build the WOPI URL with access_token
    std::string wopiUrl = _wopiSrc;
    if (wopiUrl.find('?') == std::string::npos)
        wopiUrl += "?access_token=" + _accessToken;
    else
        wopiUrl += "&access_token=" + _accessToken;

    const Poco::URI wopiUri = RequestDetails::sanitizeURI(wopiUrl);
    LOG_INF("Collab: starting CheckFileInfo validation for: "
            << COOLWSD::anonymizeUrl(wopiUri.toString()));

    // Store weak reference to this handler via ProtocolHandlerInterface base
    std::weak_ptr<ProtocolHandlerInterface> handlerWeak = shared_from_this();

    // Create callback to handle validation result
    auto onFinish = [handlerWeak](CheckFileInfo& cfi) {
        auto handlerBase = handlerWeak.lock();
        if (!handlerBase)
            return; // Handler was destroyed during validation

        // Safe downcast since we know the type
        CollabSocketHandler* handler = static_cast<CollabSocketHandler*>(handlerBase.get());
        handler->onCheckFileInfoFinished(cfi);
    };

    // Create and start CheckFileInfo request
    _checkFileInfo = std::make_shared<CheckFileInfo>(
        COOLWSD::getWebServerPoll(), wopiUri, std::move(onFinish));
    _checkFileInfo->checkFileInfo(/* redirectionLimit */ 5);
}

void CollabSocketHandler::onCheckFileInfoFinished(CheckFileInfo& cfi)
{
    _isValidating = false;

    const CheckFileInfo::State state = cfi.state();
    LOG_INF("Collab: CheckFileInfo finished with state: " << CheckFileInfo::name(state)
            << " for: " << COOLWSD::anonymizeUrl(_wopiSrc));

    switch (state)
    {
        case CheckFileInfo::State::Pass:
        {
            // Store the CheckFileInfo data
            _docKey = cfi.docKey();
            _wopiInfo = cfi.wopiInfo();

            // Extract commonly-needed fields from WOPI info
            if (_wopiInfo)
            {
                _userId = _wopiInfo->optValue<std::string>("UserId", std::string());
                _username = _wopiInfo->optValue<std::string>("UserFriendlyName", std::string());
                _userCanWrite = _wopiInfo->optValue<bool>("UserCanWrite", false);
            }

            // Find or create the CollabBroker for this document
            auto broker = findOrCreateCollabBroker(_docKey, _wopiSrc);
            if (broker)
            {
                _broker = broker;

                // Share WOPI info with the broker (first one wins)
                broker->setWopiInfo(_wopiInfo);

                // Register this handler with the broker
                // Need to get shared_ptr to this - use the ProtocolHandlerInterface base
                auto self = std::dynamic_pointer_cast<CollabSocketHandler>(shared_from_this());
                if (self)
                    broker->addHandler(self);
            }

            _isAuthenticated = true;
            LOG_INF("Collab session authenticated for WOPISrc: "
                    << COOLWSD::anonymizeUrl(_wopiSrc)
                    << ", docKey: " << _docKey
                    << ", userId: " << COOLWSD::anonymizeUsername(_userId)
                    << ", username: " << COOLWSD::anonymizeUsername(_username)
                    << ", canWrite: " << _userCanWrite);
            sendMessage("authenticated");
            break;
        }
        case CheckFileInfo::State::Unauthorized:
        {
            LOG_ERR("Collab: access denied for WOPISrc: "
                    << COOLWSD::anonymizeUrl(_wopiSrc));
            std::string error = "error: cmd=internal kind=unauthorized";
            std::string sslMsg = cfi.getSslVerifyMessage();
            if (!sslMsg.empty())
                error += " code=" + Util::base64Encode(sslMsg);
            sendMessage(error);
            shutdown();
            break;
        }
        case CheckFileInfo::State::Timedout:
        {
            LOG_ERR("Collab: CheckFileInfo timed out for WOPISrc: "
                    << COOLWSD::anonymizeUrl(_wopiSrc));
            sendMessage("error: cmd=internal kind=timeout");
            shutdown();
            break;
        }
        case CheckFileInfo::State::Fail:
        default:
        {
            LOG_ERR("Collab: CheckFileInfo failed for WOPISrc: "
                    << COOLWSD::anonymizeUrl(_wopiSrc));
            sendMessage("error: cmd=storage kind=loadfailed");
            shutdown();
            break;
        }
    }

    // Clear the CheckFileInfo reference
    _checkFileInfo.reset();
}

void CollabSocketHandler::onDisconnect()
{
    LOG_INF("Collab: handler disconnected for WOPISrc: " << COOLWSD::anonymizeUrl(_wopiSrc));

    // Unregister from the broker
    if (auto broker = _broker.lock())
    {
        auto self = std::dynamic_pointer_cast<CollabSocketHandler>(shared_from_this());
        if (self)
            broker->removeHandler(self);
    }

    // Call base class
    WebSocketHandler::onDisconnect();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
