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

#include <wsd/ProxyPoll.hpp>

#include <net/HttpHelper.hpp>
#include <net/Socket.hpp>
#include <Poco/Net/HTTPRequest.h>
#include <memory>

namespace
{

/// Handles one side of a proxy pair. Pumps data from its socket to the peer.
/// Flow control: stops reading when the peer's output buffer exceeds 256KB.
class ProxyHandler : public SimpleSocketHandler
{
    std::weak_ptr<StreamSocket> _peerSocket;
    std::weak_ptr<StreamSocket> _socket;

    static constexpr size_t MAX_BUFFER = 256 * 1024;

    /// Track whether we received any data from the target. If the target
    /// disconnects before sending anything, the connection failed and we
    /// send 502 Bad Gateway to the client.
    bool _receivedData;

public:
    ProxyHandler(const std::shared_ptr<StreamSocket>& peer)
        : _peerSocket(peer)
        , _receivedData(false)
    {
    }

    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _socket = socket;
        setLogContext(socket->getFD());
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

        auto& inBuffer = self->getInBuffer();
        if (!inBuffer.empty())
        {
            _receivedData = true;
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

        // Flow control: stop reading when peer's output buffer is full.
        if (peer->getOutBuffer().size() >= MAX_BUFFER)
            return 0;

        return POLLIN;
    }

    void performWrites(std::size_t /*capacity*/) override {}

    void onDisconnect() override
    {
        auto peer = _peerSocket.lock();
        if (!peer)
            return;

        if (!_receivedData)
        {
            LOG_ERR("Target connection failed before receiving data, sending 502");
            ProxyPoll::instance()->addCallback(
                [weakPeer = std::weak_ptr<StreamSocket>(peer)]()
                {
                    if (auto p = weakPeer.lock())
                        HttpHelper::sendErrorAndShutdown(http::StatusCode::BadGateway, p);
                });
            return;
        }

        peer->asyncShutdown();
    }
};

} // anonymous namespace

void ProxyPoll::startPump(const std::shared_ptr<StreamSocket>& clientSocket,
                          const std::string& targetIp, int targetPort,
                          const Poco::Net::HTTPRequest& originalRequest,
                          const std::shared_ptr<SocketPoll>& fromPoll)
{
    LOG_INF("Internal proxy: client #" << clientSocket->getFD()
            << " -> " << targetIp << ':' << targetPort);

    // Serialize the original HTTP request and inject the anti-loop header.
    std::ostringstream oss;
    originalRequest.write(oss);
    std::string reqStr = oss.str();
    size_t headerEnd = reqStr.find("\r\n\r\n");
    std::string proxiedRequest =
        reqStr.substr(0, headerEnd) + "\r\nX-COOL-Internal-Proxy: true" + reqStr.substr(headerEnd);

    auto targetHandler = std::make_shared<ProxyHandler>(clientSocket);

    // Move the client socket to ProxyPoll. If it's in another poll, transfer
    // it; otherwise insert directly.
    if (fromPoll != ProxyPoll::instance())
    {
        fromPoll->transferSocketTo(
            clientSocket, ProxyPoll::instance(),
            [](const std::shared_ptr<Socket>&) {},
            nullptr);
    }
    else
    {
        ProxyPoll::instance()->insertNewSocket(clientSocket);
    }

    // Non-blocking connect to the target pod.
    net::asyncConnect(
        targetIp, std::to_string(targetPort),
        false, // no SSL for internal traffic
        targetHandler,
        [weakClient = std::weak_ptr<StreamSocket>(clientSocket),
         proxiedRequest = std::move(proxiedRequest), targetIp, targetPort](
            const std::shared_ptr<StreamSocket>& targetSocket, net::AsyncConnectResult result)
        {
            auto clientSock = weakClient.lock();
            if (!clientSock)
                return;

            if (result != net::AsyncConnectResult::Ok || !targetSocket)
            {
                LOG_ERR("Failed to connect to target pod "
                        << targetIp << ':' << targetPort);
                ProxyPoll::instance()->addCallback(
                    [weakClient]()
                    {
                        if (auto c = weakClient.lock())
                            HttpHelper::sendErrorAndShutdown(http::StatusCode::BadGateway, c);
                    });
                return;
            }

            LOG_INF("Connected to target pod " << targetIp << ':' << targetPort
                    << ", target #" << targetSocket->getFD()
                    << ", client #" << clientSock->getFD());

            ProxyPoll::instance()->insertNewSocket(targetSocket);

            ProxyPoll::instance()->addCallback(
                [weakTarget = std::weak_ptr<StreamSocket>(targetSocket), weakClient,
                 proxiedRequest]()
                {
                    auto target = weakTarget.lock();
                    auto client = weakClient.lock();
                    if (!target || !client)
                        return;

                    // Set up the reverse direction: target -> client.
                    client->setHandler(std::make_shared<ProxyHandler>(target));

                    // Forward the original request to the target pod.
                    target->send(proxiedRequest);
                });
        });
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
