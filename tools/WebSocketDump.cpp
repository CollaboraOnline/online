/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* A simple tool that accepts web-socket connections and dumps the contents */

#include <config.h>

#include <unistd.h>

#include <Poco/URI.h>
#include <Poco/MemoryStream.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/StringTokenizer.h>

#include <Log.hpp>
#include <Util.hpp>
#include <Protocol.hpp>
#include <ServerSocket.hpp>
#include <WebSocketHandler.hpp>
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif

SocketPoll DumpSocketPoll("websocket");

// Dumps incoming websocket messages and doesn't respond.
class DumpSocketHandler : public WebSocketHandler
{
public:
    DumpSocketHandler(const std::weak_ptr<StreamSocket>& socket,
                      const Poco::Net::HTTPRequest& request) :
        WebSocketHandler(socket, request)
    {
    }

private:
    /// Process incoming websocket messages
    void handleMessage(bool fin, WSOpCode code, std::vector<char> &data)
    {
        std::cout << "WebSocket message code " << (int)code << " fin " << fin << " data:\n";
        Util::dumpHex(std::cout, "", "    ", data, false);
    }
};

/// Handles incoming connections and dispatches to the appropriate handler.
class ClientRequestDispatcher : public SocketHandlerInterface
{
public:
    ClientRequestDispatcher()
    {
    }

private:

    /// Set the socket associated with this ResponseClient.
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override
    {
        _socket = socket;
        LOG_TRC("#" << socket->getFD() << " Connected to ClientRequestDispatcher.");
    }

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition &disposition) override
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        std::vector<char>& in = socket->_inBuffer;
        LOG_TRC("#" << socket->getFD() << " handling incoming " << in.size() << " bytes.");

        // Find the end of the header, if any.
        static const std::string marker("\r\n\r\n");
        auto itBody = std::search(in.begin(), in.end(),
                                  marker.begin(), marker.end());
        if (itBody == in.end())
        {
            LOG_DBG("#" << socket->getFD() << " doesn't have enough data yet.");
            return;
        }

        // Skip the marker.
        itBody += marker.size();

        Poco::MemoryInputStream message(&in[0], in.size());
        Poco::Net::HTTPRequest request;
        try
        {
            request.read(message);

            Log::StreamLogger logger = Log::info();
            if (logger.enabled())
            {
                logger << "#" << socket->getFD() << ": Client HTTP Request: "
                       << request.getMethod() << ' '
                       << request.getURI() << ' '
                       << request.getVersion();

                for (const auto& it : request)
                {
                    logger << " / " << it.first << ": " << it.second;
                }

                LOG_END(logger);
            }

            const std::streamsize contentLength = request.getContentLength();
            const auto offset = itBody - in.begin();
            const std::streamsize available = in.size() - offset;

            if (contentLength != Poco::Net::HTTPMessage::UNKNOWN_CONTENT_LENGTH && available < contentLength)
            {
                LOG_DBG("Not enough content yet: ContentLength: " << contentLength << ", available: " << available);
                return;
            }
        }
        catch (const std::exception& exc)
        {
            // Probably don't have enough data just yet.
            // TODO: timeout if we never get enough.
            return;
        }

        try
        {
            // Routing
            Poco::URI requestUri(request.getURI());
            std::vector<std::string> reqPathSegs;
            requestUri.getPathSegments(reqPathSegs);

            LOG_INF("Incoming websocket request: " << request.getURI());

            const std::string& requestURI = request.getURI();
            Poco::StringTokenizer pathTokens(requestURI, "/", Poco::StringTokenizer::TOK_IGNORE_EMPTY |
                                                              Poco::StringTokenizer::TOK_TRIM);

            if (request.find("Upgrade") != request.end() && Poco::icompare(request["Upgrade"], "websocket") == 0)
            {
                socket->setHandler(std::make_shared<DumpSocketHandler>(_socket, request));
            }
            else
            {
                Poco::Net::HTTPResponse response;
                response.setStatusAndReason(Poco::Net::HTTPResponse::HTTP_BAD_REQUEST);
                response.setContentLength(0);
                LOG_INF("DumpWebSockets bad request");
                socket->send(response);
                disposition.setClosed();
            }
        }
        catch (const std::exception& exc)
        {
            // Bad request.
            std::ostringstream oss;
            oss << "HTTP/1.1 400\r\n"
                << "Date: " << Poco::DateTimeFormatter::format(Poco::Timestamp(), Poco::DateTimeFormat::HTTP_FORMAT) << "\r\n"
                << "User-Agent: LOOLWSD WOPI Agent\r\n"
                << "Content-Length: 0\r\n"
                << "\r\n";
            socket->send(oss.str());
            socket->shutdown();

            // NOTE: Check _wsState to choose between HTTP response or WebSocket (app-level) error.
            LOG_INF("#" << socket->getFD() << " Exception while processing incoming request: [" <<
                    LOOLProtocol::getAbbreviatedMessage(in) << "]: " << exc.what());
        }

        // if we succeeded - remove the request from our input buffer
        // we expect one request per socket
        in.erase(in.begin(), itBody);
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int & /* timeoutMaxMs */) override
    {
        return POLLIN;
    }

    void performWrites() override
    {
    }

private:
    // The socket that owns us (we can't own it).
    std::weak_ptr<StreamSocket> _socket;
};

class DumpSocketFactory final : public SocketFactory
{
    std::shared_ptr<Socket> create(const int physicalFd) override
    {
#if 0 && ENABLE_SSL
        return StreamSocket::create<SslStreamSocket>(physicalFd, std::unique_ptr<SocketHandlerInterface>{ new ClientRequestDispatcher });
#else
        return StreamSocket::create<StreamSocket>(physicalFd, std::unique_ptr<SocketHandlerInterface>{ new ClientRequestDispatcher });
#endif
    }
};

namespace Util
{
    void alertAllUsers(const std::string& cmd, const std::string& kind)
    {
        std::cout << "error: cmd=" << cmd << " kind=" << kind << std::endl;
    }
}

int main (int argc, char **argv)
{
    int port = 9042;
    (void) argc; (void) argv;

    if (!UnitWSD::init(UnitWSD::UnitType::Wsd, ""))
    {
        throw std::runtime_error("Failed to load wsd unit test library.");
    }

    Log::initialize("WebSocketDump", "trace", true, false,
                    std::map<std::string, std::string>());

    SocketPoll acceptPoll("accept");

    // Setup listening socket with a factory for connected sockets.
    auto serverSocket = std::make_shared<ServerSocket>(
        Socket::Type::All, DumpSocketPoll,
        std::make_shared<DumpSocketFactory>());

    if (!serverSocket->bind(ServerSocket::Type::Public, port))
    {
        fprintf(stderr, "Failed to bind websocket to port %d\n", port);
        return -1;
    }

    if (!serverSocket->listen())
    {
        fprintf(stderr, "Failed to listen on websocket, port %d\n", port);
        return -1;
    }

    acceptPoll.startThread();
    acceptPoll.insertNewSocket(serverSocket);

    while (true)
    {
        DumpSocketPoll.poll(100 * 1000);
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
