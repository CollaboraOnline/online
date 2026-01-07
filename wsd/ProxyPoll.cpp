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
#include <Socket.hpp>
#include <HttpHelper.hpp>
#include <Poco/Net/HTTPRequest.h>
#include <ProxyPoll.hpp>
#include <Unit.hpp>
#include <COOLWSD.hpp>
#include <memory>

class ProxyHandler : public SimpleSocketHandler
{
    // The other end of the proxy pair
    std::weak_ptr<StreamSocket> _peerSocket;

    std::weak_ptr<StreamSocket> _socket;

    // 256KB flow control
    static constexpr size_t MAX_BUFFER = 256 * 1024;

    // Direction flag: true = client->target, false = target->client
    bool _isClientToTarget;

public:
    ProxyHandler(const std::shared_ptr<StreamSocket>& peer, bool isClientToTarget = false)
        : _peerSocket(peer)
        , _isClientToTarget(isClientToTarget)
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

        // Pump data: self -> peer
        auto& inBuffer = self->getInBuffer();
        if (!inBuffer.empty())
        {
            if (UnitBase::isUnitTesting())
            {
                if (UnitWSD* unit = UnitWSD::getMaybeNull())
                    unit->onProxyData(inBuffer.data(), inBuffer.size(), _isClientToTarget);
            }

            peer->send(inBuffer.data(), inBuffer.size());
            inBuffer.clear();
        }
    }

    int getPollEvents(std::chrono::steady_clock::time_point /*now*/,
                      int64_t& /*timeoutMaxMicroS*/) override
    {
        auto peer = _peerSocket.lock();
        if (!peer)
            return 0;

        // Flow control: pause if peer's output buffer is full
        if (peer->getOutBuffer().size() >= MAX_BUFFER)
        {
            LOG_TRC("Backpressure: peer buffer full, pausing read");
            return 0;
        }
        return POLLIN;
    }

    void performWrites(std::size_t /*capacity*/) override {}

    void onDisconnect() override
    {
        if (auto peer = _peerSocket.lock())
            peer->asyncShutdown();
    }
};

void ProxyPoll::startPump(const std::shared_ptr<StreamSocket>& clientSocket,
                          const std::string& targetIp, int targetPort,
                          const Poco::Net::HTTPRequest& originalRequest)
{
    std::ostringstream oss;
    originalRequest.write(oss);
    std::string reqStr = oss.str();

    // Inject X-COOL-Internal-Proxy header
    size_t headerEnd = reqStr.find("\r\n\r\n");
    std::string proxiedRequest =
        reqStr.substr(0, headerEnd) + "\r\nX-COOL-Internal-Proxy: true" + reqStr.substr(headerEnd);

    // pumps target -> client (direction = false)
    auto targetHandler = std::make_shared<ProxyHandler>(clientSocket, false);

    // Async connect to target pod (avoids blocking DNS)
    net::asyncConnect(
        targetIp, std::to_string(targetPort),
        false, // isSSL - internal traffic typically unencrypted
        targetHandler,
        [clientSocket, proxiedRequest = std::move(proxiedRequest), targetHandler](
            const std::shared_ptr<StreamSocket>& targetSocket, net::AsyncConnectResult result)
        {
            if (result != net::AsyncConnectResult::Ok || !targetSocket)
            {
                LOG_ERR("Failed to connect to target pod");
                COOLWSD::getWebServerPoll()->addCallback(
                    [clientSocket]()
                    {
                        HttpHelper::sendErrorAndShutdown(http::StatusCode::BadGateway,
                                                         clientSocket);
                    });
                return;
            }

            // pumps client -> target (direction = true)
            ProxyPoll::instance().addCallback(
                [targetSocket, clientSocket, proxiedRequest]()
                {
                    auto clientHandler = std::make_shared<ProxyHandler>(targetSocket, true);
                    clientSocket->setHandler(clientHandler);

                    ProxyPoll::instance().insertNewSocket(clientSocket);
                    ProxyPoll::instance().insertNewSocket(targetSocket);

                    // Send request on the correct thread
                    targetSocket->send(proxiedRequest);
                });

            LOG_INF("Proxy established: client <-> target");
        });
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
