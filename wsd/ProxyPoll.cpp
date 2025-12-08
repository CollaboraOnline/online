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

#include <ProxyPoll.hpp>
#include <Socket.hpp>
#include <memory>

class ProxyHandler : public SimpleSocketHandler
{
    // The other end of the proxy pair
    std::weak_ptr<StreamSocket> _peerSocket;

    std::weak_ptr<StreamSocket> _socket;

    // 256KB flow control
    static constexpr size_t MAX_BUFFER = 256 * 1024;

public:
    ProxyHandler(const std::shared_ptr<StreamSocket>& peer)
        : _peerSocket(peer)
    {
    }

    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _socket = socket;
        setLogContext(socket->getFD());
        LOG_TRC("Proxy connection established to target pod");
    }

    void handleIncomingMessage(SocketDisposition& disposition) override
    {
        auto peer = _peerSocket.lock();
        auto self = _socket.lock();

        if (!peer || !self)
        {
            disposition.setClosed();
            return;
        }

        // Flow control: pause if peer's output buffer is full
        if (peer->getOutBuffer().size() >= MAX_BUFFER)
        {
            LOG_TRC("Backpressure: peer buffer full, pausing read");
            return;
        }

        // Pump data: self -> peer
        auto& inBuffer = self->getInBuffer();
        if (!inBuffer.empty())
        {
            peer->send(inBuffer.data(), inBuffer.size());
            inBuffer.clear();
        }
    }

    int getPollEvents(std::chrono::steady_clock::time_point /*now*/,
                      int64_t& /*timeoutMaxMicroS*/) override
    {
        return POLLIN; // We're always interested in reading
    }

    void performWrites(std::size_t /*capacity*/) override {}

    void onDisconnect() override
    {
        if (auto peer = _peerSocket.lock())
            peer->asyncShutdown();
    }
};
