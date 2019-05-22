/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_TEST_HELPERS_HPP
#define INCLUDED_TEST_HELPERS_HPP

#include <iterator>

#include <Poco/BinaryReader.h>
#include <Poco/Dynamic/Var.h>
#include <Poco/JSON/JSON.h>
#include <Poco/JSON/Parser.h>
#include <Poco/Net/HTTPClientSession.h>
#include <Poco/Net/HTTPRequest.h>
#include <Poco/Net/HTTPResponse.h>
#include <Poco/Net/HTTPSClientSession.h>
#include <Poco/Net/NetException.h>
#include <Poco/Net/StreamSocket.h>
#include <Poco/Net/SecureStreamSocket.h>
#include <Poco/Net/Socket.h>
#include <Poco/Path.h>
#include <Poco/StringTokenizer.h>
#include <Poco/URI.h>

#include <cppunit/extensions/HelperMacros.h>

#include <Common.hpp>
#include "common/FileUtil.hpp"
#include <LOOLWebSocket.hpp>
#include <Util.hpp>

#ifndef TDOC
#error TDOC must be defined (see Makefile.am)
#endif

// Logging in unit-tests go to cerr, for now at least.
#define TST_LOG_NAME_BEGIN(NAME, X) do { std::cerr << NAME << "(@" << helpers::timeSinceTestStartMs() << "ms) " << X; } while (false)
#define TST_LOG_BEGIN(X) TST_LOG_NAME_BEGIN(testname, X)
#define TST_LOG_APPEND(X) do { std::cerr << X; } while (false)
#define TST_LOG_END do { std::cerr << "| " << __FILE__ << ':' << __LINE__ << std::endl; } while (false)
#define TST_LOG_NAME(NAME, X) TST_LOG_NAME_BEGIN(NAME, X); TST_LOG_END
#define TST_LOG(X) TST_LOG_NAME(testname, X)

/// Common helper testing functions.
/// Avoid the temptation to reuse from LOOL code!
/// These are supposed to be testing the latter.
namespace helpers
{
inline
std::chrono::time_point<std::chrono::steady_clock>& getTestStartTime()
{
    static auto TestStartTime = std::chrono::steady_clock::now();

    return TestStartTime;
}

inline
void resetTestStartTime()
{
    getTestStartTime() = std::chrono::steady_clock::now();
}

inline
size_t timeSinceTestStartMs()
{
    return std::chrono::duration_cast<std::chrono::milliseconds>(
                            std::chrono::steady_clock::now() - getTestStartTime()).count();
}

inline
std::vector<char> genRandomData(const size_t size)
{
    std::vector<char> v(size);
    v.resize(size);
    char* data = v.data();
    for (size_t i = 0; i < size; ++i)
    {
        data[i] = static_cast<char>(Util::rng::getNext());
    }

    return v;
}

inline
std::string genRandomString(const size_t size)
{
    std::string text;
    text.reserve(size);
    for (size_t i = 0; i < size; ++i)
    {
        text += static_cast<char>('!' + Util::rng::getNext() % 95);
    }

    return text;
}

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
void getDocumentPathAndURL(const std::string& docFilename, std::string& documentPath, std::string& documentURL, std::string prefix)
{
    const auto testname = prefix;
    std::replace(prefix.begin(), prefix.end(), ' ', '_');
    documentPath = FileUtil::getTempFilePath(TDOC, docFilename, prefix);
    std::string encodedUri;
    Poco::URI::encode("file://" + Poco::Path(documentPath).makeAbsolute().toString(), ":/?", encodedUri);
    documentURL = "lool/" + encodedUri + "/ws";
    TST_LOG("Test file: " << documentPath);
}

inline
void sendTextFrame(LOOLWebSocket& socket, const std::string& string, const std::string& testname)
{
#ifndef FUZZER
    TST_LOG("Sending " << string.size() << " bytes: " << LOOLProtocol::getAbbreviatedMessage(string));
#else
    (void) testname;
#endif
    socket.sendFrame(string.data(), string.size());
}

inline
void sendTextFrame(const std::shared_ptr<LOOLWebSocket>& socket, const std::string& string, const std::string& name = "")
{
    sendTextFrame(*socket, string, name);
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

inline int getClientPort()
{
    static const char* clientPort = std::getenv("LOOL_TEST_CLIENT_PORT");
    return clientPort? atoi(clientPort) : DEFAULT_CLIENT_PORT_NUMBER;
}

inline std::shared_ptr<Poco::Net::StreamSocket> createRawSocket()
{
    return
#if ENABLE_SSL
        std::make_shared<Poco::Net::SecureStreamSocket>
#else
        std::make_shared<Poco::Net::StreamSocket>
#endif
            (Poco::Net::SocketAddress("127.0.0.1", getClientPort()));
}

inline
std::string const & getTestServerURI()
{
    static std::string serverURI(
#if ENABLE_SSL
            "https://127.0.0.1:"
#else
            "http://127.0.0.1:"
#endif
            + std::to_string(getClientPort()));

    return serverURI;
}

inline
int getErrorCode(LOOLWebSocket& ws, std::string& message, const std::string& testname)
{
    int flags = 0;
    int bytes = 0;
    Poco::UInt16 statusCode = -1;
    Poco::Buffer<char> buffer(READ_BUFFER_SIZE);

    message.clear();
    ws.setReceiveTimeout(Poco::Timespan(5000000));
    do
    {
        bytes = ws.receiveFrame(buffer.begin(), READ_BUFFER_SIZE, flags);
        TST_LOG("Got " << LOOLProtocol::getAbbreviatedFrameDump(buffer.begin(), bytes, flags));
        std::this_thread::sleep_for(std::chrono::milliseconds(POLL_TIMEOUT_MS));
    }
    while (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);

    if (bytes > 0)
    {
        Poco::MemoryBinaryReader reader(buffer, Poco::BinaryReader::NETWORK_BYTE_ORDER);
        reader >> statusCode;
        message.append(buffer.begin() + 2, bytes - 2);
    }

    return statusCode;
}

inline
int getErrorCode(const std::shared_ptr<LOOLWebSocket>& ws, std::string& message, const std::string& testname)
{
    return getErrorCode(*ws, message, testname);
}

inline
std::vector<char> getResponseMessage(LOOLWebSocket& ws, const std::string& prefix, const std::string& testname, const size_t timeoutMs = 10000)
{
    try
    {
        int flags = 0;
        int retries = timeoutMs / 500;
        const Poco::Timespan waitTime(retries ? timeoutMs * 1000 / retries : timeoutMs * 1000);
        std::vector<char> response;

        bool timedout = false;
        ws.setReceiveTimeout(0);
        do
        {
            if (ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
            {
                if (timedout)
                {
                    TST_LOG_END;
                    timedout = false;
                }

                response.resize(READ_BUFFER_SIZE * 8);
                int bytes = ws.receiveFrame(response.data(), response.size(), flags);
                response.resize(std::max(bytes, 0));
                const auto message = LOOLProtocol::getFirstLine(response);
                if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    if (LOOLProtocol::matchPrefix(prefix, message))
                    {
                        TST_LOG("[" << prefix <<  "] Matched " <<
                                LOOLProtocol::getAbbreviatedFrameDump(response.data(), bytes, flags));
                        return response;
                    }
                }
                else
                {
                    response.resize(0);
                }

                if (bytes <= 0)
                {
                    break;
                }

                if ((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    // Don't ignore errors.
                    if (LOOLProtocol::matchPrefix("error:", message))
                    {
                        throw std::runtime_error(message);
                    }

                    TST_LOG("[" << prefix <<  "] Ignored " <<
                            LOOLProtocol::getAbbreviatedFrameDump(response.data(), bytes, flags));
                }
            }
            else
            {
                if (!timedout)
                {
                    TST_LOG_BEGIN("Timeout (" << (retries > 1 ? "retrying" : "giving up") << ") ");
                }
                else
                {
                    TST_LOG_APPEND(retries << ' ');
                }

                --retries;
                timedout = true;
            }
        }
        while (retries > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);

        if (timedout)
        {
            TST_LOG_END;
        }
    }
    catch (const Poco::Net::WebSocketException& exc)
    {
        TST_LOG_END;
        TST_LOG(exc.message());
    }

    return std::vector<char>();
}

inline
std::vector<char> getResponseMessage(const std::shared_ptr<LOOLWebSocket>& ws, const std::string& prefix, const std::string& testname, const size_t timeoutMs = 10000)
{
    return getResponseMessage(*ws, prefix, testname, timeoutMs);
}

template <typename T>
std::string getResponseString(T& ws, const std::string& prefix, const std::string& testname, const size_t timeoutMs = 10000)
{
    const auto response = getResponseMessage(ws, prefix, testname, timeoutMs);
    return std::string(response.data(), response.size());
}

template <typename T>
std::string assertResponseString(T& ws, const std::string& prefix, const std::string& testname)
{
    const auto res = getResponseString(ws, prefix, testname);
    CPPUNIT_ASSERT_EQUAL(prefix, res.substr(0, prefix.length()));
    return res;
}

/// Assert that we don't get a response with the given prefix.
template <typename T>
std::string assertNotInResponse(T& ws, const std::string& prefix, const std::string& testname)
{
    const auto res = getResponseString(ws, prefix, testname, 1000);
    CPPUNIT_ASSERT_MESSAGE(testname + "Did not expect getting message [" + res + "].", res.empty());
    return res;
}

inline
bool isDocumentLoaded(LOOLWebSocket& ws, const std::string& testname, bool isView = true)
{
    const std::string prefix = isView ? "status:" : "statusindicatorfinish:";
    const auto message = getResponseString(ws, prefix, testname);
    return LOOLProtocol::matchPrefix(prefix, message);
}

inline
bool isDocumentLoaded(std::shared_ptr<LOOLWebSocket>& ws, const std::string& testname, bool isView = true)
{
    return isDocumentLoaded(*ws, testname, isView);
}

// Connecting to a Kit process is managed by document broker, that it does several
// jobs to establish the bridge connection between the Client and Kit process,
// The result, it is mostly time outs to get messages in the unit test and it could fail.
// connectLOKit ensures the websocket is connected to a kit process.
inline
std::shared_ptr<LOOLWebSocket>
connectLOKit(const Poco::URI& uri,
             Poco::Net::HTTPRequest& request,
             Poco::Net::HTTPResponse& response,
             const std::string& testname)
{
    TST_LOG_BEGIN("Connecting... ");
    int retries = 10;
    do
    {
        try
        {
            std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(uri));
            auto ws = std::make_shared<LOOLWebSocket>(*session, request, response);
            const char* expected_response = "statusindicator: ready";
            if (getResponseString(ws, expected_response, testname) == expected_response)
            {
                return ws;
            }

            TST_LOG_APPEND(11 - retries);
        }
        catch (const std::exception& ex)
        {
            TST_LOG_END;
            TST_LOG("Connection problem: " << ex.what());
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(POLL_TIMEOUT_MS));
    }
    while (retries--);

    TST_LOG_END;
    throw std::runtime_error("Cannot connect to [" + uri.toString() + "].");
}

inline
std::shared_ptr<LOOLWebSocket> loadDocAndGetSocket(const Poco::URI& uri, const std::string& documentURL, const std::string& testname, bool isView = true)
{
    try
    {
        // Load a document and get its status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::HTTPResponse response;
        std::shared_ptr<LOOLWebSocket> socket = connectLOKit(uri, request, response, testname);

        sendTextFrame(socket, "load url=" + documentURL, testname);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(*socket, testname, isView));

        TST_LOG("Loaded document [" << documentURL << "].");
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
std::shared_ptr<LOOLWebSocket> loadDocAndGetSocket(const std::string& docFilename, const Poco::URI& uri, const std::string& testname, bool isView = true)
{
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL(docFilename, documentPath, documentURL, testname);
        return loadDocAndGetSocket(uri, documentURL, testname, isView);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }

    // Really couldn't reach here, but the compiler doesn't know any better.
    return nullptr;
}

inline
void SocketProcessor(const std::string& testname,
                     const std::shared_ptr<LOOLWebSocket>& socket,
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
            TST_LOG("Timeout polling.");
            break;
        }

        n = socket->receiveFrame(buffer, sizeof(buffer), flags);
        TST_LOG("Got " << LOOLProtocol::getAbbreviatedFrameDump(buffer, n, flags));
        if (n > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
        {
            if (!handler(std::string(buffer, n)))
            {
                break;
            }
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
std::vector<char> getTileMessage(LOOLWebSocket& ws, const std::string& testname)
{
    return getResponseMessage(ws, "tile", testname);
}

inline
std::vector<char> assertTileMessage(LOOLWebSocket& ws, const std::string& testname)
{
    const std::vector<char> response = getTileMessage(ws, testname);

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
std::vector<char> assertTileMessage(const std::shared_ptr<LOOLWebSocket>& ws, const std::string& testname)
{
    return assertTileMessage(*ws, testname);
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

inline void sendKeyEvent(std::shared_ptr<LOOLWebSocket>& socket, const char* type, int chr, int key, const std::string& testname)
{
    std::ostringstream ssIn;
    ssIn << "key type=" << type << " char=" << chr << " key=" << key;
    sendTextFrame(socket, ssIn.str(), testname);
}

inline void sendKeyPress(std::shared_ptr<LOOLWebSocket>& socket, int chr, int key, const std::string& testname)
{
    sendKeyEvent(socket, "input", chr, key, testname);
    sendKeyEvent(socket, "up", chr, key, testname);
}

inline void sendChar(std::shared_ptr<LOOLWebSocket>& socket, char ch, SpecialKey specialKeys, const std::string& testname)
{
    sendKeyPress(socket, getCharChar(ch, specialKeys), getCharKey(ch, specialKeys), testname);
}

inline void sendText(std::shared_ptr<LOOLWebSocket>& socket, const std::string& text, const std::string& testname)
{
    for (char ch : text)
    {
        sendChar(socket, ch, skNone, testname);
    }
}

inline std::vector<char> getTileAndSave(std::shared_ptr<LOOLWebSocket>& socket,
                                        const std::string& req,
                                        const std::string& filename,
                                        const std::string& testname)
{
    TST_LOG("Requesting: " << req);
    sendTextFrame(socket, req, testname);

    const std::vector<char> tile = getResponseMessage(socket, "tile:", testname);
    TST_LOG(" Tile PNG size: " << tile.size());

    const std::string firstLine = LOOLProtocol::getFirstLine(tile);
    std::vector<char> res(tile.begin() + firstLine.size() + 1, tile.end());
    std::stringstream streamRes;
    std::copy(res.begin(), res.end(), std::ostream_iterator<char>(streamRes));

    if (!filename.empty())
    {
        std::fstream outStream(filename, std::ios::out);
        outStream.write(res.data(), res.size());
        outStream.close();
        TST_LOG("Saved [" << firstLine << "] to [" << filename << "]");
    }

    return res;
}

inline void getServerVersion(LOOLWebSocket& socket,
                             int& major, int& minor,
                             const std::string& testname)
{
    const std::string clientVersion = "loolclient 0.1";
    sendTextFrame(socket, clientVersion, testname);
    std::vector<char> loVersion = getResponseMessage(socket, "lokitversion", testname);
    std::string line = LOOLProtocol::getFirstLine(loVersion.data(), loVersion.size());
    line = line.substr(strlen("lokitversion "));
    Poco::JSON::Parser parser;
    Poco::Dynamic::Var loVersionVar = parser.parse(line);
    const Poco::SharedPtr<Poco::JSON::Object>& loVersionObject = loVersionVar.extract<Poco::JSON::Object::Ptr>();
    std::string loProductVersion = loVersionObject->get("ProductVersion").toString();
    std::istringstream stream(loProductVersion);
    stream >> major;
    assert(stream.get() == '.');
    stream >> minor;

    TST_LOG("Client [" << major << '.' << minor << "].");
}

inline void getServerVersion(std::shared_ptr<LOOLWebSocket>& socket,
                             int& major, int& minor,
                             const std::string& testname)
{
    getServerVersion(*socket, major, minor, testname);
}

}

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
