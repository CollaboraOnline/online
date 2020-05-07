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
    const ServerURL &serverURL,
    const std::shared_ptr<StreamSocket> &socket,
    bool isWaiting)
{
    std::shared_ptr<ClientSession> clientSession;
    if (sessionId == "fetchsession")
    {
        LOG_TRC("proxy: Create session for " << _docKey);
        clientSession = createNewClientSession(
                std::make_shared<ProxyProtocolHandler>(),
                id, uriPublic, isReadOnly, serverURL);
        addSession(clientSession);
        LOOLWSD::checkDiskSpaceAndWarnClients(true);
        LOOLWSD::checkSessionLimitsAndWarnClients();

        LOG_TRC("proxy: Returning sessionId " << clientSession->getId());

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
        LOG_TRC("proxy: find session for " << _docKey << " with id " << sessionId);
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

    proxy->handleRequest(isWaiting, socket);
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
        // Type
        if ((in[0] != 'T' && in[0] != 'B') || in.size() < 2)
        {
            LOG_ERR("Invalid message type " << in[0]);
            return false;
        }
        auto it = in.begin() + 1;

        // Serial
        for (; it != in.end() && *it != '\n'; ++it);
        *it = '\0';
        uint64_t serial = strtoll( &in[1], nullptr, 16 );
        in.erase(in.begin(), it + 1);
        if (in.size() < 2)
        {
            LOG_ERR("Invalid message framing size " << in.size());
            return false;
        }

        // Length
        it = in.begin();
        for (; it != in.end() && *it != '\n'; ++it);
        *it = '\0';
        uint64_t len = strtoll( &in[0], nullptr, 16 );
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

        if (serial != _inSerial + 1)
            LOG_ERR("Serial mismatch " << serial << " vs. " << (_inSerial + 1));
        _inSerial = serial;
        _msgHandler->handleMessage(data);
    }
    return true;
}

void ProxyProtocolHandler::handleRequest(bool isWaiting, const std::shared_ptr<Socket> &socket)
{
    auto streamSocket = std::static_pointer_cast<StreamSocket>(socket);

    LOG_INF("proxy: handle request type: " << (isWaiting ? "wait" : "respond") <<
            " on socket #" << socket->getFD());

    if (!isWaiting)
    {
        if (!_msgHandler)
            LOG_WRN("proxy: unusual - incoming message with no-one to handle it");
        else if (!parseEmitIncoming(streamSocket))
        {
            std::stringstream oss;
            streamSocket->dumpState(oss);
            LOG_ERR("proxy: bad socket structure " << oss.str());
        }
    }

    bool sentMsg = flushQueueTo(streamSocket);
    if (!sentMsg && isWaiting)
    {
        LOG_TRC("proxy: queue a waiting out socket #" << streamSocket->getFD());
        // longer running 'write socket' (marked 'read' by the client)
        _outSockets.push_back(streamSocket);
        if (_outSockets.size() > 16)
        {
            LOG_ERR("proxy: Unexpected - client opening many concurrent waiting connections " << _outSockets.size());
            // cleanup older waiting sockets.
            auto sockWeak = _outSockets.front();
            _outSockets.erase(_outSockets.begin());
            auto sock = sockWeak.lock();
            if (sock)
                sock->shutdown();
        }
    }
    else
    {
        if (!sentMsg)
        {
            // FIXME: we should really wait around a bit.
            LOG_TRC("Nothing to send - closing immediately");
            std::ostringstream oss;
            oss << "HTTP/1.1 200 OK\r\n"
                "Last-Modified: " << Util::getHttpTimeNow() << "\r\n"
                "User-Agent: " WOPI_AGENT_STRING "\r\n"
                "Content-Length: " << 0 << "\r\n"
                "\r\n";
            streamSocket->send(oss.str());
        }
        else
            LOG_TRC("Returned a reply immediately");

        socket->shutdown();
    }
}

void ProxyProtocolHandler::handleIncomingMessage(SocketDisposition &disposition)
{
    std::stringstream oss;
    disposition.getSocket()->dumpState(oss);
    LOG_ERR("If you got here, it means we failed to parse this properly in handleRequest: " << oss.str());
}

int ProxyProtocolHandler::sendMessage(const char *msg, const size_t len, bool text, bool flush)
{
    _writeQueue.push_back(std::make_shared<Message>(msg, len, text, _outSerial++));
    if (flush)
    {
        auto sock = popOutSocket();
        if (sock)
        {
            flushQueueTo(sock);
            sock->shutdown();
        }
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
    os << "proxy protocol sockets: " << _outSockets.size() << " writeQueue: " << _writeQueue.size() << ":\n";
    os << "\t";
    for (auto &it : _outSockets)
    {
        auto sock = it.lock();
        os << "#" << (sock ? sock->getFD() : -2) << " ";
    }
    os << "\n";
    for (auto it : _writeQueue)
        Util::dumpHex(os, "\twrite queue entry:", "\t\t", *it);
    if (_msgHandler)
        _msgHandler->dumpState(os);
}

int ProxyProtocolHandler::getPollEvents(std::chrono::steady_clock::time_point /* now */,
                                        int64_t &/* timeoutMaxMs */)
{
    int events = POLLIN;
    if (_msgHandler && _msgHandler->hasQueuedMessages())
        events |= POLLOUT;
    return events;
}

/// slurp from the core to us, @returns true if there are messages to send
bool ProxyProtocolHandler::slurpHasMessages()
{
    if (_msgHandler && _msgHandler->hasQueuedMessages())
        _msgHandler->writeQueuedMessages();

    return _writeQueue.size() > 0;
}

void ProxyProtocolHandler::performWrites()
{
    if (!slurpHasMessages())
        return;

    auto sock = popOutSocket();
    if (sock)
    {
        LOG_TRC("proxy: performWrites");
        flushQueueTo(sock);
        sock->shutdown();
    }
}

bool ProxyProtocolHandler::flushQueueTo(const std::shared_ptr<StreamSocket> &socket)
{
    if (!slurpHasMessages())
        return false;

    size_t totalSize = 0;
    for (auto it : _writeQueue)
        totalSize += it->size();

    if (!totalSize)
        return false;

    LOG_TRC("proxy: flushQueue of size " << totalSize << " to socket #" << socket->getFD() << " & close");

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
std::shared_ptr<StreamSocket> ProxyProtocolHandler::popOutSocket()
{
    std::weak_ptr<StreamSocket> sock;
    while (!_outSockets.empty())
    {
        sock = _outSockets.front();
        _outSockets.erase(_outSockets.begin());
        auto realSock = sock.lock();
        if (realSock)
        {
            LOG_TRC("proxy: popped an out socket #" << realSock->getFD() << " leaving: " << _outSockets.size());
            return realSock;
        }
    }
    LOG_TRC("proxy: no out sockets to pop.");
    return std::shared_ptr<StreamSocket>();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
