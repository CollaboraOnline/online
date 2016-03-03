/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <cassert>
#include <sys/poll.h>
#include <sys/prctl.h>

#include <Poco/Net/WebSocket.h>
#include <Poco/Net/HTTPRequestHandler.h>
#include <Poco/Net/HTTPServerParams.h>
#include <Poco/Net/HTTPServerRequest.h>
#include <Poco/Net/HTTPServerResponse.h>
#include <Poco/Net/NetException.h>
#include <Poco/StringTokenizer.h>

#include "Admin.hpp"
#include "AdminModel.hpp"
#include "Common.hpp"
#include "LOOLProtocol.hpp"
#include "Util.hpp"

using namespace LOOLProtocol;

using Poco::Net::HTTPRequestHandler;
using Poco::Net::HTTPRequestHandlerFactory;
using Poco::Net::HTTPResponse;
using Poco::Net::HTTPServerParams;
using Poco::Net::HTTPServerRequest;
using Poco::Net::HTTPServerResponse;
using Poco::Net::ServerSocket;
using Poco::Net::WebSocket;
using Poco::Net::WebSocketException;
using Poco::StringTokenizer;
using Poco::Net::Socket;

/// Handle admin requests.
class AdminRequestHandler: public HTTPRequestHandler
{
public:

    AdminRequestHandler(Admin* adminManager)
        : _admin(adminManager)
    {    }

    void handleRequest(HTTPServerRequest& request, HTTPServerResponse& response) override
    {
        assert(request.serverAddress().port() == ADMIN_PORT_NUMBER);

        const std::string thread_name = "admin_ws";
        try
        {
            if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(thread_name.c_str()), 0, 0, 0) != 0)
                Log::error("Cannot set thread name to " + thread_name + ".");

            Log::debug("Thread [" + thread_name + "] started.");

            auto ws = std::make_shared<WebSocket>(request, response);

            // Subscribe the websocket of any AdminModel updates
            AdminModel& model = _admin->getModel();
            model.subscribe(ws);

            const Poco::Timespan waitTime(POLL_TIMEOUT_MS * 1000);
            int flags = 0;
            int n = 0;
            ws->setReceiveTimeout(0);
            do
            {
                char buffer[200000]; //FIXME: Dynamic?

                if (ws->poll(waitTime, Socket::SELECT_READ))
                {
                    n = ws->receiveFrame(buffer, sizeof(buffer), flags);

                    if ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_PING)
                    {
                        // Echo back the ping payload as pong.
                        // Technically, we should send back a PONG control frame.
                        // However Firefox (probably) or Node.js (possibly) doesn't
                        // like that and closes the socket when we do.
                        // Echoing the payload as a normal frame works with Firefox.
                        ws->sendFrame(buffer, n /*, WebSocket::FRAME_OP_PONG*/);
                    }
                    else if ((flags & WebSocket::FRAME_OP_BITMASK) == WebSocket::FRAME_OP_PONG)
                    {
                        // In case we do send pings in the future.
                    }
                    else if (n <= 0)
                    {
                        // Connection closed.
                        Log::warn() << "Received " << n
                                    << " bytes. Connection closed. Flags: "
                                    << std::hex << flags << Log::end;
                        break;
                    }
                    else
                    {
                        assert(n > 0);
                        const std::string firstLine = getFirstLine(buffer, n);
                        StringTokenizer tokens(firstLine, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);
                        Log::trace() << "Recv: " << firstLine << Log::end;

                        if (firstLine == "eof")
                        {
                            Log::info("Received EOF. Finishing.");
                            break;
                        }

                        if (tokens.count() == 1 && tokens[0] == "stats")
                        {
                            //TODO: Collect stats and reply back to admin.
                            // We need to ask Broker to give us some numbers on docs/clients/etc.
                            // But we can also collect some memory info using system calls.

                            std::string statsResponse;

                            const auto cmd = "pstree -a -c -h -A -p " + std::to_string(getpid());
                            FILE* fp = popen(cmd.c_str(), "r");
                            if (fp == nullptr)
                            {
                                statsResponse = "error: failed to collect stats.";
                                ws->sendFrame(statsResponse.data(), statsResponse.size());
                                continue;
                            }

                            char treeBuffer[1024];
                            while (fgets(treeBuffer, sizeof(treeBuffer)-1, fp) != nullptr)
                            {
                                statsResponse += treeBuffer;
                                statsResponse += "</ BR>\n";
                            }

                            pclose(fp);

                            ws->sendFrame(statsResponse.data(), statsResponse.size());
                        }
                        else if (tokens.count() == 1 && tokens[0] == "documents")
                        {

                            std::string response = "documents " + model.query("documents");
                            ws->sendFrame(response.data(), response.size());
                        }
                    }
                }
            }
            while (!TerminationFlag &&
                   (flags & WebSocket::FRAME_OP_BITMASK) != WebSocket::FRAME_OP_CLOSE);
            Log::debug() << "Finishing AdminProcessor. TerminationFlag: " << TerminationFlag
                         << ", payload size: " << n
                         << ", flags: " << std::hex << flags << Log::end;
        }
        catch (const WebSocketException& exc)
        {
            Log::error("AdminRequestHandler::handleRequest(), WebSocketException: " + exc.message());
            switch (exc.code())
            {
            case WebSocket::WS_ERR_HANDSHAKE_UNSUPPORTED_VERSION:
                response.set("Sec-WebSocket-Version", WebSocket::WEBSOCKET_VERSION);
                // fallthrough
            case WebSocket::WS_ERR_NO_HANDSHAKE:
            case WebSocket::WS_ERR_HANDSHAKE_NO_VERSION:
            case WebSocket::WS_ERR_HANDSHAKE_NO_KEY:
                response.setStatusAndReason(HTTPResponse::HTTP_BAD_REQUEST);
                response.setContentLength(0);
                response.send();
                break;
            }
        }
        catch (const std::exception& exc)
        {
            Log::error(std::string("Exception: ") + exc.what());
        }

        Log::debug("Thread [" + thread_name + "] finished.");
    }

private:
    Admin* _admin;
};

//TODO: Move to common header.
class AdminRequestHandlerFactory: public HTTPRequestHandlerFactory
{
public:
    AdminRequestHandlerFactory(Admin* adminManager)
        : _admin(adminManager)
        {}

    HTTPRequestHandler* createRequestHandler(const HTTPServerRequest& request) override
    {
        auto logger = Log::info();
        logger << "Request from " << request.clientAddress().toString() << ": "
               << request.getMethod() << " " << request.getURI() << " "
               << request.getVersion();

        for (HTTPServerRequest::ConstIterator it = request.begin(); it != request.end(); ++it)
        {
            logger << " / " << it->first << ": " << it->second;
        }

        logger << Log::end;
        return new AdminRequestHandler(_admin);
    }

private:
    Admin* _admin;
};

/// An admin command processor.
Admin::Admin(const int brokerPipe, const int notifyPipe) :
    _srv(new AdminRequestHandlerFactory(this), ServerSocket(ADMIN_PORT_NUMBER), new HTTPServerParams),
    _model(AdminModel())
{
    Admin::BrokerPipe = brokerPipe;
    Admin::NotifyPipe = notifyPipe;
}

Admin::~Admin()
{
    Log::info("~Admin dtor.");
    _srv.stop();
}

void Admin::handleInput(std::string& message)
{
    _model.update(message);
}

void Admin::run()
{
    Log::info("Listening on Admin port " + std::to_string(ADMIN_PORT_NUMBER));

    // Start a server listening on the admin port.
    _srv.start();

    // Start listening for data changes
    struct pollfd pollPipeNotify;
    pollPipeNotify.fd = NotifyPipe;
    pollPipeNotify.events = POLLIN;
    pollPipeNotify.revents = 0;

    static const std::string thread_name = "admin_thread";

    if (prctl(PR_SET_NAME, reinterpret_cast<unsigned long>(thread_name.c_str()), 0, 0, 0) != 0)
        Log::error("Cannot set thread name to " + thread_name + ".");

    Log::info("Thread [" + thread_name + "] started.");

    Util::pollPipeForReading(pollPipeNotify, FIFO_NOTIFY, NotifyPipe,
                            [this](std::string& message) { return handleInput(message); } );

    Log::debug("Thread [" + thread_name + "] finished.");
}

AdminModel& Admin::getModel()
{
    return _model;
}

//TODO: Clean up with something more elegant.
int Admin::BrokerPipe;
int Admin::NotifyPipe;

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
