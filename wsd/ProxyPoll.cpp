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

namespace
{
[[maybe_unused]] static void startProxyPump(const std::shared_ptr<StreamSocket>& clientSocket,
                                            const std::string& targetIp, int targetPort,
                                            const Poco::Net::HTTPRequest& originalRequest)
{
    // pumps target -> client
    auto targetHandler = std::make_shared<ProxyHandler>(clientSocket);

    // Async connect to target pod (avoids blocking DNS)
    net::asyncConnect(
        targetIp, std::to_string(targetPort),
        false, // isSSL - internal traffic typically unencrypted
        targetHandler,
        [clientSocket, &originalRequest, targetHandler](
            const std::shared_ptr<StreamSocket>& targetSocket, net::AsyncConnectResult result)
        {
            if (result != net::AsyncConnectResult::Ok || !targetSocket)
            {
                LOG_ERR("Failed to connect to target pod");
                HttpHelper::sendErrorAndShutdown(http::StatusCode::BadGateway, clientSocket);
                return;
            }

            // pumps client -> target
            auto clientHandler = std::make_shared<ProxyHandler>(targetSocket);
            clientSocket->setHandler(clientHandler);

            std::ostringstream oss;
            originalRequest.write(oss);
            std::string reqStr = oss.str();

            // Inject X-COOL-Internal-Proxy header
            size_t headerEnd = reqStr.find("\r\n\r\n");
            std::string proxiedRequest = reqStr.substr(0, headerEnd) +
                                         "\r\nX-COOL-Internal-Proxy: true" +
                                         reqStr.substr(headerEnd);

            targetSocket->send(proxiedRequest);

            ProxyPoll::instance().insertNewSocket(clientSocket);
            ProxyPoll::instance().insertNewSocket(targetSocket);

            LOG_INF("Proxy established: client <-> target");
        });
}
} // namespace
