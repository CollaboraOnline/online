/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <algorithm>
#include <condition_variable>
#include <mutex>
#include <thread>
#include <regex>

#include <Poco/DirectoryIterator.h>
#include <Poco/Dynamic/Var.h>
#include <Poco/FileStream.h>
#include <Poco/JSON/JSON.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/InvalidCertificateHandler.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/PrivateKeyPassphraseHandler.h>
#include <Poco/Net/SSLManager.h>
#include <Poco/Net/Socket.h>
#include <Poco/Net/WebSocket.h>
#include <Poco/Path.h>
#include <Poco/StreamCopier.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Thread.h>
#include <Poco/URI.h>
#include <cppunit/extensions/HelperMacros.h>

#include <Common.hpp>
#include <UserMessages.hpp>
#include <Util.hpp>
#include <LOOLProtocol.hpp>

/// Common helper testing functions.
/// Avoid the temptation to reuse from LOOL code!
/// These are supposed to be testing the latter.
namespace helpers
{
inline
void getDocumentPathAndURL(const char* document, std::string& documentPath, std::string& documentURL)
{
    documentPath = Util::getTempFilePath(TDOC, document);
    documentURL = "file://" + Poco::Path(documentPath).makeAbsolute().toString();

    std::cerr << "Test file: " << documentPath << std::endl;
}

inline
void sendTextFrame(Poco::Net::WebSocket& socket, const std::string& string)
{
    std::cerr << "Sending " << string.size() << " bytes: " << LOOLProtocol::getAbbreviatedMessage(string) << std::endl;
    socket.sendFrame(string.data(), string.size());
}

inline
bool isDocumentLoaded(Poco::Net::WebSocket& ws, std::string name = "")
{
    if (!name.empty())
    {
        name += ' ';
    }

    bool isLoaded = false;
    try
    {
        int flags;
        int bytes;
        int retries = 30;
        const Poco::Timespan waitTime(1000000);

        ws.setReceiveTimeout(0);
        do
        {
            char buffer[READ_BUFFER_SIZE];

            if (ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                bytes = ws.receiveFrame(buffer, sizeof(buffer), flags);
                if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    std::cerr << name << "Got " << bytes << " bytes: " << LOOLProtocol::getAbbreviatedMessage(buffer, bytes) << std::endl;
                    const std::string line = LOOLProtocol::getFirstLine(buffer, bytes);
                    const std::string prefixIndicator = "statusindicatorfinish:";
                    const std::string prefixStatus = "status:";
                    if (line.find(prefixIndicator) == 0 || line.find(prefixStatus) == 0)
                    {
                        isLoaded = true;
                        break;
                    }
                }
                else
                {
                    std::cerr << name << "Got " << bytes << " bytes, flags: " << std::hex << flags << std::dec << std::endl;
                }

                retries = 10;
            }
            else
            {
                std::cerr << "Timeout\n";
                --retries;
            }
        }
        while (retries > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    }
    catch (const Poco::Net::WebSocketException& exc)
    {
        std::cerr << exc.message();
    }

    return isLoaded;
}

inline
Poco::Net::HTTPClientSession* createSession(const Poco::URI& uri)
{
#if ENABLE_SSL
    return new Poco::Net::HTTPSClientSession(uri.getHost(), uri.getPort());
#else
    return new Poco::Net::HTTPClientSession(uri.getHost(), uri.getPort());
#endif
}

inline
std::string getTestServerURI()
{
    static const char* clientPort = getenv("LOOL_TEST_CLIENT_PORT");

    static std::string serverURI(
#if ENABLE_SSL
            "https://127.0.0.1:"
#else
            "http://127.0.0.1:"
#endif
            + (clientPort? std::string(clientPort) : std::to_string(DEFAULT_CLIENT_PORT_NUMBER)));

    return serverURI;
}

// Connecting to a Kit process is managed by document broker, that it does several
// jobs to establish the bridge connection between the Client and Kit process,
// The result, it is mostly time outs to get messages in the unit test and it could fail.
// connectLOKit ensures the websocket is connected to a kit process.
inline
std::shared_ptr<Poco::Net::WebSocket>
connectLOKit(Poco::URI uri,
             Poco::Net::HTTPRequest& request,
             Poco::Net::HTTPResponse& response)
{
    int flags;
    int received = 0;
    int retries = 3;
    bool ready = false;
    char buffer[READ_BUFFER_SIZE];
    std::shared_ptr<Poco::Net::WebSocket> ws;

    do
    {
        std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(uri));

        std::cerr << "Connecting... ";
        ws = std::make_shared<Poco::Net::WebSocket>(*session, request, response);

        do
        {
            try
            {
                received = ws->receiveFrame(buffer, sizeof(buffer), flags);
                if (received > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    const std::string message = LOOLProtocol::getFirstLine(buffer, received);
                    std::cerr << message << std::endl;
                    if (message.find("ready") != std::string::npos)
                    {
                        ready = true;
                        break;
                    }
                }
            }
            catch (const Poco::TimeoutException& exc)
            {
                std::cerr << exc.displayText() << std::endl;
            }
        }
        while (received > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    }
    while (retries-- && !ready);

    if (!ready)
        throw Poco::Net::WebSocketException("Failed to connect to lokit process", Poco::Net::WebSocket::WS_ENDPOINT_GOING_AWAY);

    return ws;
}

inline
void getResponseMessage(Poco::Net::WebSocket& ws, const std::string& prefix, std::string& response, const bool isLine)
{
    try
    {
        int flags;
        int bytes;
        int retries = 20;
        const Poco::Timespan waitTime(1000000);

        response.clear();
        ws.setReceiveTimeout(0);
        do
        {
            char buffer[READ_BUFFER_SIZE];

            if (ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                bytes = ws.receiveFrame(buffer, sizeof(buffer), flags);
                if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    std::cerr << "Got " << bytes << " bytes: " << LOOLProtocol::getAbbreviatedMessage(buffer, bytes) << std::endl;
                    const std::string message = isLine ?
                                                LOOLProtocol::getFirstLine(buffer, bytes) :
                                                std::string(buffer, bytes);

                    if (message.find(prefix) == 0)
                    {
                        response = message.substr(prefix.length());
                        break;
                    }
                }
                else
                {
                    std::cerr << "Got " << bytes << " bytes, flags: " << std::hex << flags << std::dec << '\n';
                }
                retries = 10;
            }
            else
            {
                std::cerr << "Timeout\n";
                --retries;
            }
        }
        while (retries > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    }
    catch (const Poco::Net::WebSocketException& exc)
    {
        std::cerr << exc.message();
    }
}

inline
std::vector<char> getResponseMessage(Poco::Net::WebSocket& ws, const std::string& prefix)
{
    try
    {
        int flags;
        int bytes;
        int retries = 20;
        const Poco::Timespan waitTime(1000000);
        std::vector<char> response;

        ws.setReceiveTimeout(0);
        do
        {
            if (ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                response.resize(READ_BUFFER_SIZE);
                bytes = ws.receiveFrame(response.data(), response.size(), flags);
                response.resize(bytes >= 0 ? bytes : 0);
                auto message = LOOLProtocol::getAbbreviatedMessage(response);
                std::cerr << "Got " << bytes << " bytes: " << message << std::endl;
                if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    if (message.find(prefix) == 0)
                    {
                        return response;
                    }
                    else if (message.find("nextmessage") == 0)
                    {
                        Poco::StringTokenizer tokens(message, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
                        int size = 0;
                        if (tokens.count() == 2 &&
                            tokens[0] == "nextmessage:" && LOOLProtocol::getTokenInteger(tokens[1], "size", size) && size > 0)
                        {
                            response.resize(size);
                            bytes = ws.receiveFrame(response.data(), response.size(), flags);
                            response.resize(bytes >= 0 ? bytes : 0);
                            message = LOOLProtocol::getAbbreviatedMessage(response);
                            std::cerr << "Got " << bytes << " bytes: " << message << std::endl;
                            if (bytes > 0 && message.find(prefix) == 0)
                            {
                                return response;
                            }
                        }
                    }
                }
                else
                {
                    response.resize(0);
                    std::cerr << "Got " << bytes << " bytes, flags: " << std::hex << flags << std::dec << '\n';
                }

                retries = 10;
            }
            else
            {
                std::cerr << "Timeout\n";
                --retries;
            }
        }
        while (retries > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    }
    catch (const Poco::Net::WebSocketException& exc)
    {
        std::cerr << exc.message();
    }

    return std::vector<char>();
}


inline
std::shared_ptr<Poco::Net::WebSocket> loadDocAndGetSocket(const Poco::URI& uri, const std::string& documentURL)
{
    try
    {
        // Load a document and get its status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::HTTPResponse response;
        auto socket = connectLOKit(uri, request, response);

        sendTextFrame(*socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(*socket));

        return socket;
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }

    // Really couldn't reach here, but the compiler doesn't know any better.
    return nullptr;
}

inline
void SocketProcessor(std::string name,
                     const std::shared_ptr<Poco::Net::WebSocket>& socket,
                     std::function<bool(const std::string& msg)> handler,
                     const size_t timeoutMs = 10000)
{
    if (!name.empty())
    {
        name += ' ';
    }

    socket->setReceiveTimeout(0);

    const Poco::Timespan waitTime(timeoutMs * 1000);
    int flags;
    int n;
    char buffer[READ_BUFFER_SIZE];
    do
    {
        if (!socket->poll(waitTime, Poco::Net::Socket::SELECT_READ))
        {
            std::cerr << "Timeout." << std::endl;
            break;
        }

        n = socket->receiveFrame(buffer, sizeof(buffer), flags);
        if (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
        {
            std::cerr << name << "Got " << n << " bytes: " << LOOLProtocol::getAbbreviatedMessage(buffer, n) << std::endl;
            if (!handler(std::string(buffer, n)))
            {
                break;
            }
        }
        else
        {
            std::cerr << name << "Got " << n << " bytes, flags: " << std::hex << flags << std::dec << std::endl;
        }
    }
    while (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
}

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
