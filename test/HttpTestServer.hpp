/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <net/HttpRequest.hpp>
#include <net/Socket.hpp>
#include <common/Log.hpp>
#include <common/Util.hpp>

#include <chrono>
#include <string>

#ifndef LOOLWSD_VERSION
static_assert(false, "config.h must be included in the .cpp being compiled");
#endif

/// Handles incoming connections and dispatches to the appropriate handler.
class ServerRequestHandler final : public SimpleSocketHandler
{
public:
    ServerRequestHandler() {}

private:
    /// Set the socket associated with this ResponseClient.
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _socket = socket;
        LOG_TRC('#' << socket->getFD() << " Connected to ServerRequestHandler.");
    }

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition& disposition) override
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (!socket)
        {
            LOG_ERR("Invalid socket while handling incoming client request");
            return;
        }

        LOG_TRC('#' << socket->getFD() << " handleIncomingMessage.");

        std::vector<char>& data = socket->getInBuffer();
        LOG_TRC('#' << socket->getFD() << " handleIncomingMessage: buffer has ["
                    << std::string(data.data(), data.size()));

        // Consume the incoming data by parsing and processing the body.
        http::Request request;
        const int64_t read = request.readData(data.data(), data.size());
        if (read < 0)
        {
            // Interrupt the transfer.
            disposition.setClosed();
            socket->shutdown();
            return;
        }

        if (read == 0)
        {
            // Not enough data.
            return;
        }

        assert(read > 0 && "Must have read some data!");

        // Remove consumed data.
        data.erase(data.begin(), data.begin() + read);

        LOG_TRC('#' << socket->getFD() << " handleIncomingMessage: removed " << read
                    << " bytes to have " << data.size() << " in the buffer.");

        Buffer& out = socket->getOutBuffer();

        if (request.getVerb() == http::Request::VERB_GET)
        {
            // Return test data.
            if (Util::startsWith(request.getUrl(), "/status/"))
            {
                const auto statusCode
                    = Util::i32FromString(request.getUrl().substr(sizeof("/status")));
                const auto reason = http::getReasonPhraseForCode(statusCode.first);
                LOG_TRC('#' << socket->getFD() << " handleIncomingMessage: got StatusCode "
                            << statusCode.first << ", sending back: " << reason);

                http::Response response(http::StatusLine(statusCode.first));
                std::string body;
                if (statusCode.first == 402)
                {
                    body = "Pay me!";
                }
                else if (statusCode.first == 406)
                {
                    body
                        = R"({"message": "Client did not request a supported media type.", "accept": ["image/webp", "image/svg+xml", "image/jpeg", "image/png", "image/*"]})";
                }
                else if (statusCode.first == 418)
                {
                    body = "I'm a teapot!";
                }

                if (!body.empty())
                    response.set("Content-Length", std::to_string(body.size()));
                else if (statusCode.first >= 200 && statusCode.first != 204
                         && statusCode.first != 304) // No Content for other tags.
                    response.set("Content-Length", "0");

                response.writeData(out);
                socket->send(body);
            }
            else
            {
                http::Response response(http::StatusLine(200));
                const std::string body = (Util::startsWith(request.getUrl(), "/echo/")
                                              ? request.getUrl().substr(sizeof("/echo"))
                                              : std::string());
                response.set("Content-Length", std::to_string(body.size()));
                response.writeData(out);
                socket->send(body);
            }
        }
        else
        {
            http::Response response(http::StatusLine(501));
            response.set("Content-Length", "0");
            response.writeData(out);
            socket->flush();
        }
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t& /* timeoutMaxMs */) override
    {
        return POLLIN;
    }

    void performWrites() override
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (!socket)
        {
            LOG_ERR("Invalid socket while performing writes.");
            return;
        }

        Buffer& out = socket->getOutBuffer();
        LOG_TRC("performWrites: " << out.size() << " bytes.");
        socket->flush();
    }

private:
    // The socket that owns us (we can't own it).
    std::weak_ptr<StreamSocket> _socket;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
