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

#ifndef TDOC
#error TDOC must be defined (see Makefile.am)
#endif

/// Common helper testing functions.
/// Avoid the temptation to reuse from LOOL code!
/// These are supposed to be testing the latter.
namespace helpers
{
inline
std::vector<char> readDataFromFile(const std::string& filename)
{
    std::ifstream ifs(Poco::Path(TDOC, filename).toString(), std::ios::binary);

    // Apparently std::ios::binary is not good
    // enough to stop eating new-line chars!
    ifs.unsetf(std::ios::skipws);

    std::istream_iterator<char> start(ifs);
    std::istream_iterator<char> end;
    return std::vector<char>(start, end);
}

inline
std::vector<char> readDataFromFile(std::unique_ptr<std::fstream>& file)
{
    file->seekg(0, std::ios_base::end);
    const std::streamsize size = file->tellg();

    std::vector<char> v;
    v.resize(size);

    file->seekg(0, std::ios_base::beg);
    file->read(v.data(), size);

    return v;
}

inline
void getDocumentPathAndURL(const std::string& docFilename, std::string& documentPath, std::string& documentURL)
{
    documentPath = Util::getTempFilePath(TDOC, docFilename);
    documentURL = "lool/ws/file://" + Poco::Path(documentPath).makeAbsolute().toString();

    std::cerr << "Test file: " << documentPath << std::endl;
}

inline
void sendTextFrame(Poco::Net::WebSocket& socket, const std::string& string, const std::string& name = "")
{
    std::cerr << name << "Sending " << string.size() << " bytes: " << LOOLProtocol::getAbbreviatedMessage(string) << std::endl;
    socket.sendFrame(string.data(), string.size());
}

inline
void sendTextFrame(const std::shared_ptr<Poco::Net::WebSocket>& socket, const std::string& string, const std::string& name = "")
{
    sendTextFrame(*socket, string, name);
}

inline
bool isDocumentLoaded(Poco::Net::WebSocket& ws, const std::string& name = "", bool isView = false)
{
    bool isLoaded = false;
    try
    {
        int flags = 0;
        int retries = 30;
        const Poco::Timespan waitTime(1000000);

        ws.setReceiveTimeout(0);
        do
        {
            char buffer[READ_BUFFER_SIZE];
            if (ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                int bytes = ws.receiveFrame(buffer, sizeof(buffer), flags);
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
bool isDocumentLoaded(std::shared_ptr<Poco::Net::WebSocket>& ws, const std::string& name = "", bool isView = false)
{
    return isDocumentLoaded(*ws, name, isView);
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
void getResponseMessage(Poco::Net::WebSocket& ws, const std::string& prefix, std::string& response, const bool isLine, const std::string& name = "")
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
                    std::cerr << name << "Got " << bytes << " bytes: " << LOOLProtocol::getAbbreviatedMessage(buffer, bytes) << std::endl;
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
                    std::cerr << name << "Got " << bytes << " bytes, flags: " << std::hex << flags << std::dec << '\n';
                }
                retries = 10;
            }
            else
            {
                std::cerr << name << "Timeout waiting for " << prefix << "\n";
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
    name = name + '[' + prefix + "] ";
    try
    {
        int flags = 0;
        int retries = 20;
        static const Poco::Timespan waitTime(2000000);
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
                if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    if (message.find(prefix) == 0)
                    {
                        std::cerr << name << "Got " << bytes << " bytes: " << message << std::endl;
                        return response;
                    }
                    else if (message.find("nextmessage") == 0)
                    {
                        std::cerr << name << "Got " << bytes << " bytes: " << message << std::endl;
                        Poco::StringTokenizer tokens(message, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
                        int size = 0;
                        if (tokens.count() == 2 &&
                            tokens[0] == "nextmessage:" && LOOLProtocol::getTokenInteger(tokens[1], "size", size) && size > 0)
                        {
                            response.resize(size);
                            bytes = ws.receiveFrame(response.data(), response.size(), flags);
                            response.resize(bytes >= 0 ? bytes : 0);
                            message = LOOLProtocol::getAbbreviatedMessage(response);
                            if (bytes > 0 && message.find(prefix) == 0)
                            {
                                std::cerr << name << "Got " << bytes << " bytes: " << message << std::endl;
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
                if (bytes <= 0)
                {
                    break;
                }

                if ((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                    std::cerr << name << "Ignored: " << message << std::endl;
            }
            else
            {
                --retries;
                std::cerr << name << "Timeout " << retries << std::endl;
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
std::vector<char> getResponseMessage(const std::shared_ptr<Poco::Net::WebSocket>& ws, const std::string& prefix, const std::string& name = "")
{
    return getResponseMessage(*ws, prefix, name);
}

template <typename T>
std::string getResponseLine(T& ws, const std::string& prefix, const std::string name = "")
{
    return LOOLProtocol::getFirstLine(getResponseMessage(ws, prefix, name));
}

template <typename T>
std::string assertResponseLine(T& ws, const std::string& prefix, const std::string name = "")
{
    const auto res = getResponseLine(ws, prefix, name);
    CPPUNIT_ASSERT_EQUAL(prefix, res.substr(0, prefix.length()));
    return res;
}

/// Assert that we don't get a response with the given prefix.
template <typename T>
std::string assertNotInResponse(T& ws, const std::string& prefix, const std::string name = "")
{
    const auto res = getResponseLine(ws, prefix, name);
    CPPUNIT_ASSERT_MESSAGE("Did not expect getting message [" + res + "].", res.empty());
    return res;
}

inline
void getResponseMessage(const std::shared_ptr<Poco::Net::WebSocket>& ws, const std::string& prefix, std::string& response, const bool isLine, const std::string& name = "")
{
    getResponseMessage(*ws, prefix, response, isLine, name);
}

// Connecting to a Kit process is managed by document broker, that it does several
// jobs to establish the bridge connection between the Client and Kit process,
// The result, it is mostly time outs to get messages in the unit test and it could fail.
// connectLOKit ensures the websocket is connected to a kit process.
inline
std::shared_ptr<Poco::Net::WebSocket>
connectLOKit(const Poco::URI& uri,
             Poco::Net::HTTPRequest& request,
             Poco::Net::HTTPResponse& response,
             const std::string& name = "")
{
    int retries = 10;
    do
    {
        std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(uri));

        std::cerr << name << "Connecting... " << std::endl;
        auto ws = std::make_shared<Poco::Net::WebSocket>(*session, request, response);
        getResponseMessage(ws, "statusindicator: ready", name);

        return ws;
    }
    while (retries--);

    CPPUNIT_FAIL("Cannot connect to [" + uri.toString() + "].");
}

inline
std::shared_ptr<Poco::Net::WebSocket> loadDocAndGetSocket(const Poco::URI& uri, const std::string& documentURL, const std::string& name = "", bool isView = false)
{
    try
    {
        // Load a document and get its status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::HTTPResponse response;
        auto socket = connectLOKit(uri, request, response, name);

        sendTextFrame(socket, "load url=" + documentURL, name);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(*socket, name, isView));

        std::cerr << name << "Loaded document [" << documentURL << "]." << std::endl;
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
std::shared_ptr<Poco::Net::WebSocket> loadDocAndGetSocket(const std::string& docFilename, const Poco::URI& uri, const std::string& name = "", bool isView = false)
{
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL(docFilename, documentPath, documentURL);
        return loadDocAndGetSocket(uri, documentURL, name, isView);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }

    // Really couldn't reach here, but the compiler doesn't know any better.
    return nullptr;
}

inline
void SocketProcessor(const std::string& name,
                     const std::shared_ptr<Poco::Net::WebSocket>& socket,
                     const std::function<bool(const std::string& msg)>& handler,
                     const size_t timeoutMs = 10000)
{
    socket->setReceiveTimeout(0);

    const Poco::Timespan waitTime(timeoutMs * 1000);
    int flags = 0;
    int n = 0;
    char buffer[READ_BUFFER_SIZE];
    do
    {
        if (!socket->poll(waitTime, Poco::Net::Socket::SELECT_READ))
        {
            std::cerr << name << "Timeout polling." << std::endl;
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

inline
void parseDocSize(const std::string& message, const std::string& type,
                  int& part, int& parts, int& width, int& height, int& viewid)
{
    Poco::StringTokenizer tokens(message, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);

    // Expected format is something like 'type= parts= current= width= height='.
    const std::string text = tokens[0].substr(std::string("type=").size());
    parts = std::stoi(tokens[1].substr(std::string("parts=").size()));
    part = std::stoi(tokens[2].substr(std::string("current=").size()));
    width = std::stoi(tokens[3].substr(std::string("width=").size()));
    height = std::stoi(tokens[4].substr(std::string("height=").size()));
    viewid = std::stoi(tokens[5].substr(std::string("viewid=").size()));
    CPPUNIT_ASSERT_EQUAL(type, text);
    CPPUNIT_ASSERT(parts > 0);
    CPPUNIT_ASSERT(part >= 0);
    CPPUNIT_ASSERT(width > 0);
    CPPUNIT_ASSERT(height > 0);
    CPPUNIT_ASSERT(viewid >= 0);
}

inline
std::vector<char> getTileMessage(Poco::Net::WebSocket& ws, const std::string& name = "")
{
    return getResponseMessage(ws, "tile", name);
}

inline
std::vector<char> assertTileMessage(Poco::Net::WebSocket& ws, const std::string& name = "")
{
    const auto response = getTileMessage(ws, name);

    const std::string firstLine = LOOLProtocol::getFirstLine(response);
    Poco::StringTokenizer tileTokens(firstLine, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
    CPPUNIT_ASSERT_EQUAL(std::string("tile:"), tileTokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("part="), tileTokens[1].substr(0, std::string("part=").size()));
    CPPUNIT_ASSERT_EQUAL(std::string("width="), tileTokens[2].substr(0, std::string("width=").size()));
    CPPUNIT_ASSERT_EQUAL(std::string("height="), tileTokens[3].substr(0, std::string("height=").size()));
    CPPUNIT_ASSERT_EQUAL(std::string("tileposx="), tileTokens[4].substr(0, std::string("tileposx=").size()));
    CPPUNIT_ASSERT_EQUAL(std::string("tileposy="), tileTokens[5].substr(0, std::string("tileposy=").size()));
    CPPUNIT_ASSERT_EQUAL(std::string("tilewidth="), tileTokens[6].substr(0, std::string("tilewidth=").size()));
    CPPUNIT_ASSERT_EQUAL(std::string("tileheight="), tileTokens[7].substr(0, std::string("tileheight=").size()));

    return response;
}

inline
std::vector<char> assertTileMessage(const std::shared_ptr<Poco::Net::WebSocket>& ws, const std::string& name = "")
{
    return assertTileMessage(*ws, name);
}

enum SpecialKey { skNone=0, skShift=0x1000, skCtrl=0x2000, skAlt=0x4000 };

inline int getCharChar(char ch, SpecialKey specialKeys)
{
    // Some primitive code just suitable to basic needs of specific test.
    // TODO: improve as appropriate.
    if (specialKeys & (skCtrl | skAlt))
        return 0;

    switch (ch)
    {
        case '\x0a': // Enter
            return 13;
        default:
            return ch;
    }
}

inline int getCharKey(char ch, SpecialKey specialKeys)
{
    // Some primitive code just suitable to basic needs of specific test.
    // TODO: improve as appropriate.
    int result;
    switch (ch)
    {
        case '\x0a': // Enter
            result = 1280;
            break;
        default:
            result = ch;
    }
    return result | specialKeys;
}

inline void sendKeyEvent(Poco::Net::WebSocket& socket, const char* type, int chr, int key)
{
    std::ostringstream ssIn;
    ssIn << "key type=" << type << " char=" << chr << " key=" << key;
    sendTextFrame(socket, ssIn.str());
}

inline void sendKeyPress(Poco::Net::WebSocket& socket, int chr, int key)
{
    sendKeyEvent(socket, "input", chr, key);
    sendKeyEvent(socket, "up", chr, key);
}

inline void sendChar(Poco::Net::WebSocket& socket, char ch, SpecialKey specialKeys=skNone)
{
    sendKeyPress(socket, getCharChar(ch, specialKeys), getCharKey(ch, specialKeys));
}

inline void sendText(Poco::Net::WebSocket& socket, const std::string& text)
{
    for (char ch : text)
    {
        sendChar(socket, ch);
    }
}

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
