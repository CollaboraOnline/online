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
    std::string encodedUri;
    Poco::URI::encode("file://" + Poco::Path(documentPath).makeAbsolute().toString(), ":/?", encodedUri);
    documentURL = "lool/" + encodedUri + "/ws";
    std::cerr << "Test file: " << documentPath << std::endl;
}

inline
void sendTextFrame(Poco::Net::WebSocket& socket, const std::string& string)
{
    std::cerr << "Sending " << string.size() << " bytes: " << LOOLProtocol::getAbbreviatedMessage(string) << std::endl;
    socket.sendFrame(string.data(), string.size());
}

inline
void sendTextFrame(const std::shared_ptr<Poco::Net::WebSocket>& socket, const std::string& string)
{
    sendTextFrame(*socket, string);
}

inline
bool isDocumentLoaded(Poco::Net::WebSocket& ws, std::string name = "", bool isView = false)
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
                    const std::string prefix = isView ? "status:" : "statusindicatorfinish:";
                    if (line.find(prefix) == 0)
                    {
                        isLoaded = true;
                        break;
                    }
                }
                else
                {
                    std::cerr << name << "Got " << bytes << " bytes, flags: " << std::hex << flags << std::dec << std::endl;
                    break;
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

inline
void getResponseMessage(Poco::Net::WebSocket& ws, const std::string& prefix, std::string& response, const bool isLine)
{
    try
    {
        int flags = 0;
        int retries = 20;
        const Poco::Timespan waitTime(1000000);

        response.clear();
        ws.setReceiveTimeout(0);
        do
        {

            if (ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                char buffer[READ_BUFFER_SIZE];
                int bytes = ws.receiveFrame(buffer, sizeof(buffer), flags);
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
std::vector<char> getResponseMessage(Poco::Net::WebSocket& ws, const std::string& prefix, std::string name = "")
{
    if (!name.empty())
    {
        name += ": ";
    }

    try
    {
        int flags = 0;
        int retries = 20;
        static const Poco::Timespan waitTime(1000000);
        std::vector<char> response;

        ws.setReceiveTimeout(0);
        do
        {
            if (ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                response.resize(READ_BUFFER_SIZE);
                int bytes = ws.receiveFrame(response.data(), response.size(), flags);
                response.resize(bytes >= 0 ? bytes : 0);
                auto message = LOOLProtocol::getAbbreviatedMessage(response);
                std::cerr << name << "Got " << bytes << " bytes: " << message << std::endl;
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
                            std::cerr << name << "Got " << bytes << " bytes: " << message << std::endl;
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
                    std::cerr << name << "Got " << bytes << " bytes, flags: " << std::hex << flags << std::dec << std::endl;
                }

                retries = 10;
            }
            else
            {
                std::cerr << name << "Timeout\n";
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
std::vector<char> getResponseMessage(const std::shared_ptr<Poco::Net::WebSocket>& ws, const std::string& prefix, const std::string name = "")
{
    return getResponseMessage(*ws, prefix, name);
}

template <typename T>
std::string getResponseLine(T& ws, const std::string& prefix, const std::string name = "")
{
    return LOOLProtocol::getFirstLine(getResponseMessage(ws, prefix, name));
}

template <typename T>
void assertResponseLine(T& ws, const std::string& prefix, const std::string name = "")
{
    CPPUNIT_ASSERT_EQUAL(prefix, LOOLProtocol::getFirstToken(getResponseLine(ws, prefix, name)));
}

inline
void getResponseMessage(const std::shared_ptr<Poco::Net::WebSocket>& ws, const std::string& prefix, std::string& response, const bool isLine)
{
    getResponseMessage(*ws, prefix, response, isLine);
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
    int retries = 10;
    do
    {
        std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(uri));

            std::cerr << "Connecting... ";
        auto ws = std::make_shared<Poco::Net::WebSocket>(*session, request, response);
        getResponseMessage(ws, "statusindicator: ready");

        return ws;
    }
    while (retries--);

    CPPUNIT_FAIL("Cannot connect to [" + uri.toString() + "].");
}

inline
std::shared_ptr<Poco::Net::WebSocket> loadDocAndGetSocket(const Poco::URI& uri, const std::string& documentURL, bool isView = false)
{
    try
    {
        // Load a document and get its status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::HTTPResponse response;
        auto socket = connectLOKit(uri, request, response);

        sendTextFrame(socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(*socket, "", isView));

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
