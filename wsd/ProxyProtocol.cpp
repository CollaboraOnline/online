/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "DocumentBroker.hpp"
#include "ClientSession.hpp"
#include "ProxyProtocol.hpp"
#include "Exceptions.hpp"
#include "LOOLWSD.hpp"
#include <Socket.hpp>

#include <atomic>
#include <cassert>

void DocumentBroker::handleProxyRequest(
    const std::string& sessionId,
    const std::string& id,
    const Poco::URI& uriPublic,
    const bool isReadOnly,
    const std::string& hostNoTrust,
    const std::shared_ptr<Socket> &socket)
{
    std::shared_ptr<ClientSession> clientSession;
    if (sessionId == "fetchsession")
    {
        LOG_TRC("Create session for " << _docKey);
        clientSession = createNewClientSession(
                std::make_shared<ProxyProtocolHandler>(),
                id, uriPublic, isReadOnly, hostNoTrust);
        addSession(clientSession);
        LOOLWSD::checkDiskSpaceAndWarnClients(true);
        LOOLWSD::checkSessionLimitsAndWarnClients();
    }
    else
    {
        LOG_TRC("Find session for " << _docKey << " with id " << sessionId);
        for (const auto &it : _sessions)
        {
            if (it.second->getId() == sessionId)
            {
                clientSession = it.second;
                break;
            }
        }
        if (!clientSession)
        {
            LOG_ERR("Invalid session id used " << sessionId);
            throw BadRequestException("invalid session id");
        }
    }

    auto protocol = clientSession->getProtocol();
    auto streamSocket = std::static_pointer_cast<StreamSocket>(socket);
    streamSocket->setHandler(protocol);

    // this DocumentBroker's poll handles reading & writing
    addSocketToPoll(socket);

    auto proxy = std::static_pointer_cast<ProxyProtocolHandler>(
        protocol);

    proxy->handleRequest(uriPublic.toString(), socket);
}

void ProxyProtocolHandler::handleRequest(const std::string &uriPublic,
                                         const std::shared_ptr<Socket> &socket)
{
    bool bRead = uriPublic.find("/write") == std::string::npos;
    LOG_INF("Proxy handle request " << uriPublic << " type: " <<
            (bRead ? "read" : "write"));
    (void)socket;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
