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

#pragma once

#include <common/Log.hpp>
#include <common/Util.hpp>
#include <net/HttpRequest.hpp>
#include <net/Socket.hpp>

#include <chrono>
#include <cstdint>
#include <string>

/// Handles incoming connections and dispatches to the appropriate handler.
class ServerRequestHandler final : public SimpleSocketHandler
{
private:
    /// Set the socket associated with this ResponseClient.
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        LOG_ASSERT_MSG(socket, "Invalid socket passed to ServerRequestHandler::onConnect");

        _socket = socket;
        setLogContext(socket->getFD());
        LOG_TRC("Connected to ServerRequestHandler");
    }

    void onDisconnect() override
    {
        LOG_TRC("ServerRequestHandler disconnected");

        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (socket)
        {
            socket->asyncShutdown(); // Flag for shutdown for housekeeping in SocketPoll.
            socket->shutdownConnection(); // Immediately disconnect.
        }
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

        Buffer& data = socket->getInBuffer();
        if (data.empty())
        {
            LOG_DBG("No data to process from the socket");
            return;
        }

        LOG_TRC("HandleIncomingMessage: buffer has:\n"
                << HexUtil::dumpHex(std::string(data.data(), std::min(data.size(), 256UL))));

        // Consume the incoming data by parsing and processing the body.
        if (!_request)
        {
            _request.reset(new http::RequestParser());
        }

        const int64_t read = _request->readData(data.data(), data.size());
        if (read < 0)
        {
            // Interrupt the transfer.
            disposition.setClosed();
            socket->asyncShutdown();
            return;
        }

        if (read == 0)
        {
            // Not enough data.
            return;
        }

        assert(read > 0 && "Must have read some data!");

        // Remove consumed data.
        data.eraseFirst(read);

        const int fd = socket->getFD();
        LOG_TRC("HandleIncomingMessage: removed " << read << " bytes to have " << data.size()
                                                  << " in the buffer");

        const std::string& verb = _request->getVerb();
        const std::string& url = _request->getUrl();

        if (verb == http::Request::VERB_GET)
        {
            // Return test data.
            if (url.starts_with("/status/"))
            {
                const auto statusCode = Util::i32FromString(url.substr(sizeof("/status")));
                const auto reason = http::getReasonPhraseForCode(statusCode.first);
                LOG_TRC("HandleIncomingMessage: got StatusCode " << statusCode.first
                                                                 << ", sending back: " << reason);

                http::Response response(http::StatusLine(statusCode.first), fd);
                if (statusCode.first == 402)
                {
                    response.setBody("Pay me!");
                }
                else if (statusCode.first == 406)
                {
                    response.setBody(
                        R"({"message": "Client did not request a supported media type.", )"
                        R"("accept": ["image/webp", "image/svg+xml", "image/jpeg", "image/png", "image/*"]})");
                }
                else if (statusCode.first == 418)
                {
                    response.setBody("I'm a teapot!");
                }

                if (response.getBody().empty() && statusCode.first >= 200 && statusCode.first != 204
                    && statusCode.first != 304) // No Content for other tags.
                {
                    response.setContentLength(0);
                }

                socket->send(response);
            }
            else if (url == "/timeout")
            {
                // Don't send anything back.
            }
            else if (url.starts_with("/inject"))
            {
                // /inject/<hex data> sends back the data (in binary form)
                // verbatim. It doesn't add headers or anything at all.
                const std::string hex = url.substr(sizeof("/inject"));
                const std::string bytes = HexUtil::hexStringToBytes(
                    reinterpret_cast<const uint8_t*>(hex.data()), hex.size());
                socket->send(bytes);
                socket->asyncShutdown();
            }
            else if (url.starts_with("/large/"))
            {
                // /large/<size> returns a response body of <size> bytes of 'X'
                const std::string sizeStr = url.substr(sizeof("/large/") - 1);
                const auto size = Util::i32FromString(sizeStr);
                if (size.second && size.first > 0)
                {
                    http::Response response(http::StatusCode::OK, fd);
                    response.setBody(std::string(size.first, 'X'));
                    socket->send(response);
                }
                else
                {
                    http::Response response(http::StatusCode::BadRequest, fd);
                    response.setContentLength(0);
                    socket->send(response);
                }
            }
            else
            {
                http::Response response(http::StatusCode::OK, fd);
                if (url.starts_with("/echo/"))
                {
                    if (url.starts_with("/echo/chunked/"))
                    {
                        response.set("transfer-encoding", "chunked");
                        std::string body = url.substr(sizeof("/echo/chunked"));
                        while (!body.empty())
                        {
                            if (body.size() < 5)
                            {
                                response.appendChunk(body);
                                break;
                            }

                            const auto half = body.size() / 2;
                            const auto size = (Util::rng::getNext() % half) + 1; // 0-size means the end.

                            const auto chunk = body.substr(0, size);
                            response.appendChunk(chunk);
                            body = body.substr(size);
                        }

                        response.appendChunk(std::string()); // Empty chunk to end.
                    }
                    else
                        response.setBody(url.substr(sizeof("/echo")));
                }
                else
                    response.setBody("You have reached HttpTestServer " + url);
                socket->send(response);
            }
        }
        else if (verb == http::Request::VERB_POST)
        {
            if (url.starts_with("/post"))
            {
                if (_request->header().hasContentLength() &&
                    static_cast<int64_t>(_request->getBody().size()) ==
                        _request->header().getContentLength())
                {
                    http::Response response(http::StatusCode::OK, fd);
                    response.setBody(std::string(_request->getBody()));
                    socket->send(response);
                }
            }
        }
        else
        {
            http::Response response(http::StatusCode::NotImplemented, fd);
            response.setContentLength(0);
            socket->send(response);
        }
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t& /* timeoutMaxMs */) override
    {
        return POLLIN;
    }

    void performWrites(std::size_t) override
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (!socket)
        {
            LOG_ERR("Invalid socket while performing writes.");
            return;
        }

        Buffer& out = socket->getOutBuffer();
        LOG_TRC("performWrites: " << out.size() << " bytes.");
        socket->attemptWrites();
    }

private:
    // The socket that owns us (we can't own it).
    std::weak_ptr<StreamSocket> _socket;
    std::unique_ptr<http::RequestParser> _request;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
