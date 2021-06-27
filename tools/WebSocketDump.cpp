/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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
#include <Poco/Util/XMLConfiguration.h>

#include <Log.hpp>
#include <Util.hpp>
#include <Protocol.hpp>
#include <ServerSocket.hpp>
#include <WebSocketHandler.hpp>
#if !MOBILEAPP
#include <net/HttpHelper.hpp>
#endif
#if ENABLE_SSL
#  include <SslSocket.hpp>
#endif

SocketPoll DumpSocketPoll("websocket");

// Dumps incoming websocket messages and doesn't respond.
class DumpSocketHandler : public WebSocketHandler
{
public:
    DumpSocketHandler(const std::weak_ptr<StreamSocket>& socket,
                      const Poco::Net::HTTPRequest& request)
        : WebSocketHandler(socket.lock(), request)
    {
    }

private:
    /// Process incoming websocket messages
    void handleMessage(const std::vector<char> &data) override
    {
        std::cout << "WebSocket message data:\n";
        Util::dumpHex(std::cout, data, "", "    ", false);
    }
};

/// Handles incoming connections and dispatches to the appropriate handler.
class ClientRequestDispatcher final : public SimpleSocketHandler
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
        LOG_TRC('#' << socket->getFD() << " Connected to ClientRequestDispatcher.");
    }

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition &disposition) override
    {
        std::shared_ptr<StreamSocket> socket = _socket.lock();
        if (!socket)
        {
            LOG_ERR("Invalid socket while reading client message.");
            return;
        }

        std::vector<char>& in = socket->getInBuffer();
        LOG_TRC('#' << socket->getFD() << " handling incoming " << in.size() << " bytes.");

        // Find the end of the header, if any.
        static const std::string marker("\r\n\r\n");
        auto itBody = std::search(in.begin(), in.end(),
                                  marker.begin(), marker.end());
        if (itBody == in.end())
        {
            LOG_DBG('#' << socket->getFD() << " doesn't have enough data yet.");
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
                logger << '#' << socket->getFD() << ": Client HTTP Request: "
                       << request.getMethod() << ' '
                       << request.getURI() << ' '
                       << request.getVersion();

                for (const auto& it : request)
                {
                    logger << " / " << it.first << ": " << it.second;
                }

                LOG_END(logger, true);
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
            StringVector pathTokens(Util::tokenize(requestURI, '/'));
            if (request.find("Upgrade") != request.end()
                && Util::iequal(request["Upgrade"], "websocket"))
            {
                auto dumpHandler = std::make_shared<DumpSocketHandler>(_socket, request);
                socket->setHandler(dumpHandler);
                dumpHandler->sendMessage("version");
                dumpHandler->sendMessage("documents");
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
            HttpHelper::sendErrorAndShutdown(400, socket);

            // NOTE: Check _wsState to choose between HTTP response or WebSocket (app-level) error.
            LOG_INF('#' << socket->getFD() << " Exception while processing incoming request: [" <<
                    LOOLProtocol::getAbbreviatedMessage(in) << "]: " << exc.what());
        }

        // if we succeeded - remove the request from our input buffer
        // we expect one request per socket
        in.erase(in.begin(), itBody);
    }

    int getPollEvents(std::chrono::steady_clock::time_point /* now */,
                      int64_t & /* timeoutMaxMicroS */) override
    {
        return POLLIN;
    }

    void performWrites(std::size_t /*capacity*/) override {}

private:
    // The socket that owns us (we can't own it).
    std::weak_ptr<StreamSocket> _socket;
};

class DumpSocketFactory final : public SocketFactory
{
private:
    bool _isSSL = false;

public:
    DumpSocketFactory(bool isSSL) : _isSSL(isSSL) {}

    std::shared_ptr<Socket> create(const int physicalFd) override
    {
#if ENABLE_SSL
        if (_isSSL)
            return StreamSocket::create<SslStreamSocket>(
                std::string(), physicalFd, false, std::make_shared<ClientRequestDispatcher>());
#else
        (void)_isSSL;
#endif
        return StreamSocket::create<StreamSocket>(std::string(), physicalFd, false,
                                                  std::make_shared<ClientRequestDispatcher>());
    }
};

namespace Util
{
    void alertAllUsers(const std::string& cmd, const std::string& kind)
    {
        std::cout << "error: cmd=" << cmd << " kind=" << kind << std::endl;
    }
}

class LoolConfig final: public Poco::Util::XMLConfiguration
{
public:
    LoolConfig()
        {}
};

int main (int argc, char **argv)
{
    (void) argc; (void) argv;

    if (!UnitWSD::init(UnitWSD::UnitType::Wsd, ""))
    {
        throw std::runtime_error("Failed to load wsd unit test library.");
    }

    Log::initialize("WebSocketDump", "trace", true, false,
                    std::map<std::string, std::string>());

    LoolConfig config;
    config.load("loolwsd.xml");

    // read the port & ssl support
    int port = 9042;
    bool isSSL = false;
    std::string monitorAddress = config.getString("monitors.monitor");
    if (!monitorAddress.empty())
    {
        Poco::URI monitorURI(monitorAddress);
        port = monitorURI.getPort();
        isSSL = (monitorURI.getScheme() == "wss");
    }

#if ENABLE_SSL
    // hard coded but easy for now.
    const std::string ssl_cert_file_path = "etc/cert.pem";
    const std::string ssl_key_file_path = "etc/key.pem";
    const std::string ssl_ca_file_path = "etc/ca-chain.cert.pem";
    const std::string ssl_cipher_list = "ALL:!ADH:!LOW:!EXP:!MD5:@STRENGTH";

    // Initialize the non-blocking socket SSL.
    if (isSSL)
        ssl::Manager::initializeServerContext(ssl_cert_file_path, ssl_key_file_path,
                                              ssl_ca_file_path, ssl_cipher_list);
#endif

    SocketPoll acceptPoll("accept");

    // Setup listening socket with a factory for connected sockets.
    auto serverSocket = std::make_shared<ServerSocket>(
        Socket::Type::All, DumpSocketPoll,
        std::make_shared<DumpSocketFactory>(isSSL));

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
        DumpSocketPoll.poll(std::chrono::seconds(100));
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
