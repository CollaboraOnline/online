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
        if (read > 0)
        {
            // Remove consumed data.
            data.erase(data.begin(), data.begin() + read);

            LOG_TRC('#' << socket->getFD() << " handleIncomingMessage: removed " << read
                        << " bytes to have " << data.size() << " in the buffer.");

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

                    if (reason)
                    {
                        std::ostringstream oss;
                        oss << "HTTP/1.1 " << statusCode.first << ' ' << reason << "\r\n"
                            << "Date: " << Util::getHttpTimeNow() << "\r\n"
                            << "Content-Type: text/html; charset=utf-8\r\n"
                            << "Server: " HTTP_AGENT_STRING "\r\n";

                        if (statusCode.first >= 200 && statusCode.first != 204
                            && statusCode.first != 304) // No Content
                            oss << "Content-Length: 0\r\n";

                        oss << "\r\n";
                        socket->send(oss.str());
                    }
                    else
                    {
                        std::ostringstream oss;
                        oss << "HTTP/1.1 " << statusCode.first << " Unknown\r\n"
                            << "Date: " << Util::getHttpTimeNow() << "\r\n"
                            << "Server: " HTTP_AGENT_STRING "\r\n";

                        if (statusCode.first >= 200)
                            oss << "Content-Length: 0\r\n";

                        oss << "\r\n";
                        socket->send(oss.str());
                    }
                }
                else
                {
                    std::ostringstream oss;
                    oss << "HTTP/1.1 200 OK\r\n"
                        << "Date: " << Util::getHttpTimeNow() << "\r\n"
                        << "Server: " HTTP_AGENT_STRING "\r\n"
                        << "Content-Length: 0\r\n"
                        << "\r\n";
                    socket->send(oss.str());
                }
            }
            else
            {
                std::ostringstream oss;
                oss << "HTTP/1.1 501 Not Implemented\r\n"
                    << "Date: " << Util::getHttpTimeNow() << "\r\n"
                    << "Server: " HTTP_AGENT_STRING "\r\n"
                    << "Content-Length: 0\r\n"
                    << "\r\n";
                socket->send(oss.str());
            }
        }
        else if (read < 0)
        {
            // Interrupt the transfer.
            disposition.setClosed();
            socket->shutdown();
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
        if (!out.empty())
        {
            socket->writeOutgoingData();
        }
    }

private:
    // The socket that owns us (we can't own it).
    std::weak_ptr<StreamSocket> _socket;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
