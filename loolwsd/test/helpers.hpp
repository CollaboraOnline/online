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

static
void sendTextFrame(Poco::Net::WebSocket& socket, const std::string& string)
{
    socket.sendFrame(string.data(), string.size());
}

static
bool isDocumentLoaded(Poco::Net::WebSocket& ws)
{
    bool isLoaded = false;
    try
    {
        int flags;
        int bytes;
        int retries = 30;
        const Poco::Timespan waitTime(1000000);

        ws.setReceiveTimeout(0);
        std::cout << "==> isDocumentLoaded\n";
        do
        {
            char buffer[READ_BUFFER_SIZE];

            if (ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                bytes = ws.receiveFrame(buffer, sizeof(buffer), flags);
                std::cout << "Got " << bytes << " bytes, flags: " << std::hex << flags << std::dec << '\n';
                if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    std::cout << "Received message: " << LOOLProtocol::getAbbreviatedMessage(buffer, bytes) << '\n';
                    const std::string line = LOOLProtocol::getFirstLine(buffer, bytes);
                    const std::string prefixIndicator = "statusindicatorfinish:";
                    const std::string prefixStatus = "status:";
                    if (line.find(prefixIndicator) == 0 || line.find(prefixStatus) == 0)
                    {
                        isLoaded = true;
                        break;
                    }
                }
                retries = 10;
            }
            else
            {
                std::cout << "Timeout\n";
                --retries;
            }
        }
        while (retries > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    }
    catch (const Poco::Net::WebSocketException& exc)
    {
        std::cout << exc.message();
    }

    return isLoaded;
}


// Connecting to a Kit process is managed by document broker, that it does several
// jobs to establish the bridge connection between the Client and Kit process,
// The result, it is mostly time outs to get messages in the unit test and it could fail.
// connectLOKit ensures the websocket is connected to a kit process.
static
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
#if ENABLE_SSL
        Poco::Net::HTTPSClientSession session(uri.getHost(), uri.getPort());
#else
        Poco::Net::HTTPClientSession session(uri.getHost(), uri.getPort());
#endif
        std::cerr << "Connecting... ";
        ws = std::make_shared<Poco::Net::WebSocket>(session, request, response);

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
                std::cout << exc.displayText() << std::endl;
            }
        }
        while (received > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    }
    while (retries-- && !ready);

    if (!ready)
        throw Poco::Net::WebSocketException("Failed to connect to lokit process", Poco::Net::WebSocket::WS_ENDPOINT_GOING_AWAY);

    return ws;
}

static
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
        std::cout << "==> getResponseMessage(" << prefix << ")\n";
        do
        {
            char buffer[READ_BUFFER_SIZE];

            if (ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                bytes = ws.receiveFrame(buffer, sizeof(buffer), flags);
                std::cout << "Got " << bytes << " bytes, flags: " << std::hex << flags << std::dec << '\n';
                if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    std::cout << "Received message: " << LOOLProtocol::getAbbreviatedMessage(buffer, bytes) << '\n';
                    const std::string message = isLine ?
                                                LOOLProtocol::getFirstLine(buffer, bytes) :
                                                std::string(buffer, bytes);

                    if (message.find(prefix) == 0)
                    {
                        response = message.substr(prefix.length());
                        break;
                    }
                }
                retries = 10;
            }
            else
            {
                std::cout << "Timeout\n";
                --retries;
            }
        }
        while (retries > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    }
    catch (const Poco::Net::WebSocketException& exc)
    {
        std::cout << exc.message();
    }
}

static
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
            std::cout << name << "Got " << n << " bytes: " << LOOLProtocol::getAbbreviatedMessage(buffer, n) << std::endl;
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
