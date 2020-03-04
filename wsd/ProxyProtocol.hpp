/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <net/Socket.hpp>

/// Interface for building a websocket from this ...
class ProxyProtocolHandler : public ProtocolHandlerInterface
{
public:
    ProxyProtocolHandler()
    {
    }

    virtual ~ProxyProtocolHandler()
    {
    }

    /// Will be called exactly once by setHandler
    void onConnect(const std::shared_ptr<StreamSocket>& /* socket */) override
    {
    }

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition &/* disposition */) override
    {
        assert("we get our data a different way" && false);
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int &/* timeoutMaxMs */) override
    {
        // underlying buffer based polling is fine.
        return POLLIN;
    }

    void checkTimeout(std::chrono::steady_clock::time_point /* now */) override
    {
    }

    void performWrites() override
    {
    }

    void onDisconnect() override
    {
        // connections & sockets come and go a lot.
    }

public:
    /// Clear all external references
    virtual void dispose() { _msgHandler.reset(); }

    int sendTextMessage(const char *msg, const size_t len, bool flush = false) const override
    {
        LOG_TRC("ProxyHack - send text msg " + std::string(msg, len));
        (void) flush;
        return len;
    }

    int sendBinaryMessage(const char *data, const size_t len, bool flush = false) const override
    {
        (void) data; (void) flush;
        LOG_TRC("ProxyHack - send binary msg len " << len);
        return len;
    }

    void shutdown(bool goingAway = false, const std::string &statusMessage = "") override
    {
        LOG_TRC("ProxyHack - shutdown " << goingAway << ": " << statusMessage);
    }

    void getIOStats(uint64_t &sent, uint64_t &recv) override
    {
        sent = recv = 0;
    }

    void dumpState(std::ostream& os)
    {
        os << "proxy protocol\n";
    }

    void handleRequest(const std::string &uriPublic,
                       const std::shared_ptr<Socket> &socket);

private:
    std::vector<std::weak_ptr<StreamSocket>> _sockets;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
