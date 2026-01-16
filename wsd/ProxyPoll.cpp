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
#include <memory>

namespace
{
/// Sanitize a string for logging: replace non-printable characters with readable equivalents
std::string sanitizeForLog(const char* data, size_t size, size_t maxLen = 128)
{
    const size_t len = std::min(size, maxLen);
    std::string result;
    result.reserve(len + 3);

    for (size_t i = 0; i < len; ++i)
    {
        const unsigned char c = static_cast<unsigned char>(data[i]);
        if (c == '\r')
            result += "\\r";
        else if (c == '\n')
            result += "\\n";
        else if (c == '\t')
            result += "\\t";
        else if (c >= 32 && c < 127)
            result += static_cast<char>(c);
        else
            result += '.';
    }

    if (size > maxLen)
        result += "...";

    return result;
}

inline std::string sanitizeForLog(const std::string& str, size_t maxLen = 128)
{
    return sanitizeForLog(str.data(), str.size(), maxLen);
}
} // anonymous namespace

class ProxyHandler : public SimpleSocketHandler
{
    // The other end of the proxy pair
    std::weak_ptr<StreamSocket> _peerSocket;

    std::weak_ptr<StreamSocket> _socket;

    // 256KB flow control
    // TODO: What should be the value of MAX_BUFFER ?
    static constexpr size_t MAX_BUFFER = 256 * 1024;

    // Track whether we've received any data (to detect connection failures)
    bool _receivedData;

public:
    ProxyHandler(const std::shared_ptr<StreamSocket>& peer)
        : _peerSocket(peer)
        , _receivedData(false)
    {
        LOG_DBG("ProxyHandler created, peer socket #" << (peer ? peer->getFD() : -1));
    }

    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _socket = socket;
        setLogContext(socket->getFD());
        auto peer = _peerSocket.lock();
        LOG_DBG("ProxyHandler::onConnect: socket #" << socket->getFD()
                << " connected, peer socket #" << (peer ? peer->getFD() : -1));
    }

    void handleIncomingMessage(SocketDisposition& disposition) override
    {
        auto peer = _peerSocket.lock();
        auto self = _socket.lock();

        if (!peer || !self)
        {
            LOG_DBG("ProxyHandler::handleIncomingMessage: peer or self is null, closing. "
                    << "peer=" << (peer ? peer->getFD() : -1)
                    << ", self=" << (self ? self->getFD() : -1));
            disposition.setClosed();
            return;
        }

        // Pump data: self -> peer
        auto& inBuffer = self->getInBuffer();
        if (!inBuffer.empty())
        {
            const size_t dataSize = inBuffer.size();
            LOG_DBG("ProxyHandler::handleIncomingMessage: socket #" << self->getFD()
                    << " -> peer #" << peer->getFD()
                    << ", pumping " << dataSize << " bytes"
                    << ", preview: [" << sanitizeForLog(inBuffer.data(), dataSize) << "]");

            _receivedData = true;

            peer->send(inBuffer.data(), inBuffer.size());
            LOG_DBG("ProxyHandler::handleIncomingMessage: sent " << dataSize
                    << " bytes from #" << self->getFD() << " to #" << peer->getFD()
                    << ", peer outBuffer size now: " << peer->getOutBuffer().size());
            inBuffer.clear();
        }
        else
        {
            LOG_DBG("ProxyHandler::handleIncomingMessage: socket #" << self->getFD()
                    << " has empty inBuffer, nothing to pump");
        }
    }

    int getPollEvents(std::chrono::steady_clock::time_point /*now*/,
                      int64_t& /*timeoutMaxMicroS*/) override
    {
        auto peer = _peerSocket.lock();
        auto self = _socket.lock();
        if (!peer)
        {
            LOG_DBG("ProxyHandler::getPollEvents: peer is null, returning 0");
            return 0;
        }

        // Flow control: pause if peer's output buffer is full
        const size_t peerOutSize = peer->getOutBuffer().size();
        if (peerOutSize >= MAX_BUFFER)
        {
            LOG_DBG("ProxyHandler::getPollEvents: backpressure on socket #"
                    << (self ? self->getFD() : -1)
                    << ", peer #" << peer->getFD()
                    << " outBuffer=" << peerOutSize << " >= MAX_BUFFER=" << MAX_BUFFER
                    << ", pausing read");
            return 0;
        }
        return POLLIN;
    }

    void performWrites(std::size_t /*capacity*/) override {}

    void onDisconnect() override
    {
        auto peer = _peerSocket.lock();
        auto self = _socket.lock();

        LOG_DBG("ProxyHandler::onDisconnect: socket #" << (self ? self->getFD() : -1)
                << ", peer #" << (peer ? peer->getFD() : -1)
                << ", receivedData=" << _receivedData);

        if (!peer)
        {
            LOG_DBG("ProxyHandler::onDisconnect: peer is null, nothing to do");
            return;
        }

        // If this is the target->client handler and we never received any data,
        // the connection to the target failed. Send 502 Bad Gateway.
        if (!_receivedData)
        {
            LOG_ERR("Target connection failed before receiving data, sending 502 Bad Gateway to peer #"
                    << peer->getFD());
            // Peer socket is in ProxyPoll, schedule the error response there
            ProxyPoll::instance()->addCallback(
                [weakPeer = std::weak_ptr<StreamSocket>(peer)]()
                {
                    auto peerSocket = weakPeer.lock();
                    if (!peerSocket)
                        return;
                    HttpHelper::sendErrorAndShutdown(http::StatusCode::BadGateway, peerSocket);
                });
            return;
        }

        LOG_DBG("ProxyHandler::onDisconnect: initiating asyncShutdown on peer #" << peer->getFD());
        peer->asyncShutdown();
    }
};

void ProxyPoll::startPump(const std::shared_ptr<StreamSocket>& clientSocket,
                          const std::string& targetIp, int targetPort,
                          const Poco::Net::HTTPRequest& originalRequest,
                          const std::shared_ptr<SocketPoll>& fromPoll)
{
    LOG_DBG("ProxyPoll::startPump: client socket #" << clientSocket->getFD()
            << " -> target " << targetIp << ':' << targetPort
            << ", fromPoll=" << fromPoll->name());

    std::ostringstream oss;
    originalRequest.write(oss);
    std::string reqStr = oss.str();

    // Inject X-COOL-Internal-Proxy header
    size_t headerEnd = reqStr.find("\r\n\r\n");
    std::string proxiedRequest =
        reqStr.substr(0, headerEnd) + "\r\nX-COOL-Internal-Proxy: true" + reqStr.substr(headerEnd);

    LOG_DBG("ProxyPoll::startPump: proxied request size=" << proxiedRequest.size()
            << " bytes, preview: [" << sanitizeForLog(proxiedRequest) << "]");

    auto targetHandler = std::make_shared<ProxyHandler>(clientSocket);

    LOG_DBG("ProxyPoll::startPump: transferring client socket #" << clientSocket->getFD()
            << " from " << fromPoll->name() << " to proxy_poll");

    // Transfer the client socket from the source poll to proxy_poll
    fromPoll->transferSocketTo(
        clientSocket, ProxyPoll::instance(), [](const std::shared_ptr<Socket>& /*moveSocket*/) {},
        nullptr);

    LOG_DBG("ProxyPoll::startPump: initiating async connect to " << targetIp << ':' << targetPort);

    // Async connect to target pod (avoids blocking DNS)
    net::asyncConnect(
        targetIp, std::to_string(targetPort),
        false, // isSSL - internal traffic typically unencrypted
        targetHandler,
        [weakClient = std::weak_ptr<StreamSocket>(clientSocket),
         proxiedRequest = std::move(proxiedRequest), targetHandler, targetIp, targetPort](
            const std::shared_ptr<StreamSocket>& targetSocket, net::AsyncConnectResult result)
        {
            auto clientSock = weakClient.lock();
            if (!clientSock)
            {
                LOG_DBG("ProxyPoll asyncConnect callback: client socket gone, aborting");
                return;
            }

            if (result != net::AsyncConnectResult::Ok || !targetSocket)
            {
                LOG_ERR("ProxyPoll asyncConnect callback: failed to connect to target pod "
                        << targetIp << ':' << targetPort
                        << ", result=" << static_cast<int>(result)
                        << ", targetSocket=" << (targetSocket ? targetSocket->getFD() : -1));
                ProxyPoll::instance()->addCallback(
                    [weakClient]()
                    {
                        auto client = weakClient.lock();
                        if (!client)
                            return;
                        HttpHelper::sendErrorAndShutdown(http::StatusCode::BadGateway, client);
                    });
                return;
            }

            LOG_DBG("ProxyPoll asyncConnect callback: connected to target "
                    << targetIp << ':' << targetPort
                    << ", target socket #" << targetSocket->getFD()
                    << ", client socket #" << clientSock->getFD());

            ProxyPoll::instance()->insertNewSocket(targetSocket);
            LOG_DBG("ProxyPoll: target socket #" << targetSocket->getFD() << " inserted into ProxyPoll");

            ProxyPoll::instance()->addCallback(
                [weakTarget = std::weak_ptr<StreamSocket>(targetSocket), weakClient,
                 proxiedRequest]()
                {
                    auto target = weakTarget.lock();
                    auto client = weakClient.lock();
                    if (!target || !client)
                        return;

                    auto clientHandler = std::make_shared<ProxyHandler>(target);
                    client->setHandler(clientHandler);

                    // Send request on the correct thread
                    LOG_INF("Proxy established: client #" << client->getFD()
                            << " <-> target #" << target->getFD()
                            << ", sending " << proxiedRequest.size() << " bytes to target");
                    target->send(proxiedRequest);
                    LOG_DBG("ProxyPoll: sent proxied request to target #" << target->getFD()
                            << ", target outBuffer size=" << target->getOutBuffer().size());
                });
        });
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
