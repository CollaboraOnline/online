/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <memory>
#include <net/Socket.hpp>

/**
 * Implementation that builds a websocket like protocol from many
 * individual proxied HTTP requests back to back.
 *
 * we use a trivial framing: <hex-length>\r\n<content>\r\n
 */
class ProxyProtocolHandler : public ProtocolHandlerInterface
{
public:
    ProxyProtocolHandler() { }

    virtual ~ProxyProtocolHandler() { }

    /// Will be called exactly once by setHandler
    void onConnect(const std::shared_ptr<StreamSocket>& /* socket */) override
    {
    }

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition &/* disposition */) override;

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t &/* timeoutMaxMs */) override;

    void checkTimeout(std::chrono::steady_clock::time_point /* now */) override
    {
    }

    void performWrites() override;

    void onDisconnect() override
    {
        // connections & sockets come and go a lot.
    }

public:
    /// Clear all external references
    void dispose() override { _msgHandler.reset(); }

    int sendTextMessage(const char *msg, const size_t len, bool flush = false) const override;
    int sendBinaryMessage(const char *data, const size_t len, bool flush = false) const override;
    void shutdown(bool goingAway = false, const std::string &statusMessage = "") override;
    void getIOStats(uint64_t &sent, uint64_t &recv) override;
    void dumpState(std::ostream& os) override;
    bool parseEmitIncoming(const std::shared_ptr<StreamSocket> &socket);
    void handleRequest(bool isWaiting, const std::shared_ptr<Socket> &socket);

private:
    std::shared_ptr<StreamSocket> popOutSocket();
    bool slurpHasMessages();
    int sendMessage(const char *msg, const size_t len, bool text, bool flush);
    bool flushQueueTo(const std::shared_ptr<StreamSocket> &socket);

    struct Message : public std::vector<char>
    {
        Message(const char *msg, const size_t len, bool text)
        {
            const char *type = text ? "T" : "B";
            insert(end(), type, type + 1);
            std::ostringstream os;
            os << std::hex << "0x" << len << "\n";
            std::string str = os.str();
            insert(end(), str.c_str(), str.c_str() + str.size());
            insert(end(), msg, msg + len);
            const char *terminator = "\n";
            insert(end(), terminator, terminator + 1);
        }
    };
    /// queue things when we have no socket to hand.
    std::vector<std::shared_ptr<Message>> _writeQueue;
    std::vector<std::weak_ptr<StreamSocket>> _outSockets;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
