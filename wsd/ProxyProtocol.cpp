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
    const std::shared_ptr<StreamSocket> &socket)
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

        LOG_TRC("Returning id " << clientSession->getId());

        std::ostringstream oss;
        oss << "HTTP/1.1 200 OK\r\n"
            "Last-Modified: " << Util::getHttpTimeNow() << "\r\n"
            "User-Agent: " WOPI_AGENT_STRING "\r\n"
            "Content-Length: " << clientSession->getId().size() << "\r\n"
            "Content-Type: application/json\r\n"
            "X-Content-Type-Options: nosniff\r\n"
            "\r\n"
            << clientSession->getId();

        socket->send(oss.str());
        socket->shutdown();
        return;
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

bool ProxyProtocolHandler::parseEmitIncoming(
    const std::shared_ptr<StreamSocket> &socket)
{
    std::vector<char> &in = socket->getInBuffer();

    std::stringstream oss;
    socket->dumpState(oss);
    LOG_TRC("Parse message:\n" << oss.str());

    while (in.size() > 0)
    {
        if (in[0] != 'T' && in[0] != 'B')
        {
            LOG_ERR("Invalid message type " << in[0]);
            return false;
        }
        auto it = in.begin() + 1;
        for (; it != in.end() && *it != '\n'; ++it);
        *it = '\0';
        uint64_t len = strtoll( &in[1], nullptr, 16 );
        in.erase(in.begin(), it + 1);
        if (len > in.size())
        {
            LOG_ERR("Invalid message length " << len << " vs " << in.size());
            return false;
        }
        // far from efficient:
        std::vector<char> data;
        data.insert(data.begin(), in.begin(), in.begin() + len + 1);
        in.erase(in.begin(), in.begin() + len);

        if (in.size() < 1 || in[0] != '\n')
        {
            LOG_ERR("Missing final newline");
            return false;
        }
        in.erase(in.begin(), in.begin() + 1);

        _msgHandler->handleMessage(data);
    }
    return true;
}

void ProxyProtocolHandler::handleRequest(const std::string &uriPublic,
                                         const std::shared_ptr<Socket> &socket)
{
    auto streamSocket = std::static_pointer_cast<StreamSocket>(socket);

    bool bRead = uriPublic.find("/write") == std::string::npos;
    LOG_INF("Proxy handle request " << uriPublic << " type: " <<
            (bRead ? "read" : "write"));

    if (bRead)
    {
        if (!_msgHandler)
            LOG_WRN("unusual - incoming message with no-one to handle it");
        else if (!parseEmitIncoming(streamSocket))
        {
            std::stringstream oss;
            streamSocket->dumpState(oss);
            LOG_ERR("bad socket structure " << oss.str());
        }
    }

    if (!flushQueueTo(streamSocket) && !bRead)
    {
        // longer running 'write socket'
        _writeSockets.push_back(streamSocket);
    }
    else
        socket->shutdown();
}

void ProxyProtocolHandler::handleIncomingMessage(SocketDisposition &disposition)
{
    std::stringstream oss;
    disposition.getSocket()->dumpState(oss);
    LOG_ERR("If you got here, it means we failed to parse this properly in handleRequest: " << oss.str());
}

int ProxyProtocolHandler::sendMessage(const char *msg, const size_t len, bool text, bool flush)
{
    _writeQueue.push_back(std::make_shared<Message>(msg, len, text));
    auto sock = popWriteSocket();
    if (sock && flush)
    {
        flushQueueTo(sock);
        sock->shutdown();
    }

    return len;
}

int ProxyProtocolHandler::sendTextMessage(const char *msg, const size_t len, bool flush) const
{
    LOG_TRC("ProxyHack - send text msg " + std::string(msg, len));
    return const_cast<ProxyProtocolHandler *>(this)->sendMessage(msg, len, true, flush);
}

int ProxyProtocolHandler::sendBinaryMessage(const char *data, const size_t len, bool flush) const
{
    LOG_TRC("ProxyHack - send binary msg len " << len);
    return const_cast<ProxyProtocolHandler *>(this)->sendMessage(data, len, false, flush);
}

void ProxyProtocolHandler::shutdown(bool goingAway, const std::string &statusMessage)
{
    LOG_TRC("ProxyHack - shutdown " << goingAway << ": " << statusMessage);
}

void ProxyProtocolHandler::getIOStats(uint64_t &sent, uint64_t &recv)
{
    sent = recv = 0;
}

void ProxyProtocolHandler::dumpState(std::ostream& os)
{
    os << "proxy protocol sockets: " << _writeSockets.size() << " writeQueue: " << _writeQueue.size() << ":\n";
    for (auto it : _writeQueue)
        Util::dumpHex(os, "\twrite queue entry:", "\t\t", *it);
}

void ProxyProtocolHandler::performWrites()
{
    if (_msgHandler)
        _msgHandler->writeQueuedMessages();
    if (_writeQueue.size() <= 0)
        return;

    auto sock = popWriteSocket();
    if (sock)
    {
        flushQueueTo(sock);
        sock->shutdown();
    }
}

bool ProxyProtocolHandler::flushQueueTo(const std::shared_ptr<StreamSocket> &socket)
{
    // slurp from the core to us.
    if (_msgHandler && _msgHandler->hasQueuedMessages())
        _msgHandler->writeQueuedMessages();

    size_t totalSize = 0;
    for (auto it : _writeQueue)
        totalSize += it->size();

    if (!totalSize)
        return false;

    std::ostringstream oss;
    oss << "HTTP/1.1 200 OK\r\n"
        "Last-Modified: " << Util::getHttpTimeNow() << "\r\n"
        "User-Agent: " WOPI_AGENT_STRING "\r\n"
        "Content-Length: " << totalSize << "\r\n"
        "Content-Type: application/json\r\n"
        "X-Content-Type-Options: nosniff\r\n"
        "\r\n";
    socket->send(oss.str());

    for (auto it : _writeQueue)
        socket->send(it->data(), it->size(), false);
    _writeQueue.clear();

    return true;
}

// LRU-ness ...
std::shared_ptr<StreamSocket> ProxyProtocolHandler::popWriteSocket()
{
    std::weak_ptr<StreamSocket> sock;
    while (!_writeSockets.empty())
    {
        sock = _writeSockets.front();
        _writeSockets.erase(_writeSockets.begin());
        auto realSock = sock.lock();
        if (realSock)
            return realSock;
    }
    return std::shared_ptr<StreamSocket>();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
