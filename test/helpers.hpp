/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <test/testlog.hpp>
#include <test/lokassert.hpp>

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
#include <Poco/URI.h>

#include <Common.hpp>
#include "common/FileUtil.hpp"
#include <LOOLWebSocket.hpp>
#include <Util.hpp>

#include <iterator>
#include <fstream>
#include <string>

#ifndef TDOC
#error TDOC must be defined (see Makefile.am)
#endif

// Sometimes we need to retry some commands as they can (due to timing or load) soft-fail.
constexpr int COMMAND_RETRY_COUNT = 5;

/// Common helper testing functions.
/// Avoid the temptation to reuse from LOOL code!
/// These are supposed to be testing the latter.
namespace helpers
{

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

inline void getDocumentPathAndURL(const std::string& docFilename, std::string& documentPath,
                                  std::string& documentURL, std::string prefix)
{
    const std::string testname = prefix;

    static std::mutex lock;
    std::unique_lock<std::mutex> guard(lock);

    std::replace(prefix.begin(), prefix.end(), ' ', '_');
    documentPath = FileUtil::getTempFilePath(TDOC, docFilename, prefix);
    std::string encodedUri;
    Poco::URI::encode("file://" + Poco::Path(documentPath).makeAbsolute().toString(), ":/?",
                      encodedUri);
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

inline std::unique_ptr<Poco::Net::HTTPClientSession> createSession(const Poco::URI& uri)
{
#if ENABLE_SSL
    if (uri.getScheme() == "https" || uri.getScheme() == "wss")
        return Util::make_unique<Poco::Net::HTTPSClientSession>(uri.getHost(), uri.getPort());
#endif

    return Util::make_unique<Poco::Net::HTTPClientSession>(uri.getHost(), uri.getPort());
}

/// Uses Poco to make an HTTP GET from the given URI.
inline std::pair<std::shared_ptr<Poco::Net::HTTPResponse>, std::string>
pocoGet(const Poco::URI& uri)
{
    try
    {
        LOG_INF("pocoGet: " << uri.toString());
        std::unique_ptr<Poco::Net::HTTPClientSession> session(helpers::createSession(uri));
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, uri.getPathAndQuery(),
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        session->sendRequest(request);
        auto response = std::make_shared<Poco::Net::HTTPResponse>();
        std::istream& rs = session->receiveResponse(*response);

        LOG_DBG("pocoGet response for ["
                << uri.toString() << "]: " << response->getStatus() << ' ' << response->getReason()
                << ", hasContentLength: " << response->hasContentLength() << ", ContentLength: "
                // << (response->hasContentLength() ? response->getContentLength64() : -1));
                << response->getContentLength64());

        for (const auto& pair : *response)
        {
            LOG_TRC(pair.first << '=' << pair.second);
        }

        std::string responseString;
        if (response->hasContentLength() && response->getContentLength() > 0)
        {
            std::ostringstream outputStringStream;
            Poco::StreamCopier::copyStream(rs, outputStringStream);
            responseString = outputStringStream.str();
            LOG_DBG("pocoGet [" << uri.toString() << "]: " << responseString);
        }

        return std::make_pair(response, responseString);
    }
    catch (const std::exception& ex)
    {
        LOG_ERR("pocoGet failed for [" << uri.toString() << "]: " << ex.what());
        throw;
    }
}

/// Uses Poco to make an HTTP GET from the given URI components.
inline std::pair<std::shared_ptr<Poco::Net::HTTPResponse>, std::string>
pocoGet(bool secure, const std::string& host, const int port, const std::string& url)
{
    const char* scheme = (secure ? "https://" : "http://");
    Poco::URI uri(scheme + host + ':' + std::to_string(port) + url);
    return pocoGet(uri);
}

inline std::shared_ptr<Poco::Net::StreamSocket> createRawSocket()
{
    return
#if ENABLE_SSL
        std::make_shared<Poco::Net::SecureStreamSocket>
#else
        std::make_shared<Poco::Net::StreamSocket>
#endif
        (Poco::Net::SocketAddress("127.0.0.1", ClientPortNumber));
}

// Sets read / write timeout for the given file descriptor.
inline void setSocketTimeOut(int socketFD, int timeMS)
{
    struct timeval tv;
    tv.tv_sec = (float)timeMS / (float)1000;
    tv.tv_usec = timeMS;
    setsockopt(socketFD, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof tv);
}

// Sets socket's blocking mode. true for blocking, false for non blocking.
inline void setSocketBlockingMode(int socketFD, bool blocking)
{
    ioctl(socketFD, FIONBIO, blocking == true ? 0: 1);
}

// Creates a socket and connects it to a local server. Returns the file descriptor.
inline int connectToLocalServer(int portNumber, int socketTimeOutMS, bool blocking)
{
    int socketFD = 0;
    struct sockaddr_in serv_addr;

    if ((socketFD = socket(AF_INET, SOCK_STREAM, 0)) < 0)
    {
        LOG_ERR("helpers::connectToLocalServer: Server client could not be created.");
        return -1;
    }
    else
    {
        serv_addr.sin_family = AF_INET;
        serv_addr.sin_port = htons(portNumber);
        if(inet_pton(AF_INET, "127.0.0.1", &serv_addr.sin_addr) <= 0)
        {
            LOG_ERR("helpers::connectToLocalServer: Invalid address.");
            close(socketFD);
            return -1;
        }
        else
        {
            if (connect(socketFD, (sockaddr*)&serv_addr, sizeof(serv_addr)) < 0)
            {
                LOG_ERR("helpers::connectToLocalServer: Connection failed.");
                close(socketFD);
                return -1;
            }
            else
            {
                setSocketTimeOut(socketFD, socketTimeOutMS);
                setSocketBlockingMode(socketFD, blocking);
                return socketFD;
            }
        }
    }
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
            + std::to_string(ClientPortNumber));

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
        // Read next WS frame and log it.
        bytes = ws.receiveFrame(buffer.begin(), READ_BUFFER_SIZE, flags, testname);
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
    while (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);

    if (bytes > 0)
    {
        TST_LOG("Got Close Frame: " << LOOLWebSocket::getAbbreviatedFrameDump(buffer.begin(), bytes,
                                                                              flags));
        Poco::MemoryBinaryReader reader(buffer, Poco::BinaryReader::NETWORK_BYTE_ORDER);
        reader >> statusCode;
        if (reader.available() > 0)
        {
            // An optional message after the status code.
            message.append(buffer.begin() + bytes - reader.available(), reader.available());
        }
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
        std::vector<char> response;

        auto endTime = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeoutMs);

        ws.setReceiveTimeout(0);
        do
        {
            auto now = std::chrono::steady_clock::now();
            if (now > endTime) // timedout
            {
                TST_LOG("Timeout after " << timeoutMs << " ms.");
                break;
            }
            long waitTimeUs = std::chrono::duration_cast<std::chrono::microseconds>(endTime - now).count();
            if (ws.poll(Poco::Timespan(waitTimeUs), Poco::Net::Socket::SELECT_READ))
            {
                response.resize(READ_BUFFER_SIZE * 8);
                const int bytes = ws.receiveFrame(response.data(), response.size(), flags, testname);
                response.resize(std::max(bytes, 0));
                const auto message = LOOLProtocol::getFirstLine(response);
                if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    if (LOOLProtocol::matchPrefix(prefix, message))
                    {
                        TST_LOG('[' << prefix <<  "] Matched " <<
                                LOOLWebSocket::getAbbreviatedFrameDump(response.data(), bytes, flags));
                        return response;
                    }
                }
                else
                {
                    response.resize(0);
                }

                if (bytes <= 0)
                {
                    // Try again, timeout will be handled above.
                    continue;
                }

                if ((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
                {
                    // Don't ignore errors.
                    if (LOOLProtocol::matchPrefix("error:", message))
                    {
                        throw std::runtime_error(message);
                    }

                    TST_LOG('[' << prefix <<  "] Ignored " <<
                            LOOLWebSocket::getAbbreviatedFrameDump(response.data(), bytes, flags));
                }
            }
        }
        while ((flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE);
    }
    catch (const Poco::Net::WebSocketException& exc)
    {
        TST_LOG('[' << prefix <<  "] ERROR in helpers::getResponseMessage: " << exc.message());
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
std::string assertResponseString(T& ws, const std::string& prefix, const std::string& testname, const size_t timeoutMs = 10000)
{
    const auto res = getResponseString(ws, prefix, testname, timeoutMs);
    LOK_ASSERT_EQUAL(prefix, res.substr(0, prefix.length()));
    return res;
}

/// Assert that we don't get a response with the given prefix.
template <typename T>
std::string assertNotInResponse(T& ws, const std::string& prefix, const std::string& testname)
{
    const auto res = getResponseString(ws, prefix, testname, 1000);
    LOK_ASSERT_MESSAGE(testname + "Did not expect getting message [" + res + "].", res.empty());
    return res;
}

inline
int countMessages(LOOLWebSocket& ws, const std::string& prefix, const std::string& testname, const size_t timeoutMs = 10000)
{
    int count = 0;
    while (!getResponseMessage(ws, prefix, testname, timeoutMs).empty())
        ++count;

    return count;
}

inline
int countMessages(const std::shared_ptr<LOOLWebSocket>& ws, const std::string& prefix, const std::string& testname, const size_t timeoutMs = 10000)
{
    return countMessages(*ws, prefix, testname, timeoutMs);
}

inline
bool isDocumentLoaded(LOOLWebSocket& ws, const std::string& testname, bool isView = true)
{
    const std::string prefix = isView ? "status:" : "statusindicatorfinish:";
    // Allow 20 secs to load
    const auto message = getResponseString(ws, prefix, testname, 30 * 1000);
    bool success = LOOLProtocol::matchPrefix(prefix, message);
    if (!success)
        TST_LOG("ERR: Timed out loading document");
    return success;
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
    TST_LOG("Connecting to " << uri.toString());
    constexpr int max_retries = 11;
    int retries = max_retries - 1;
    do
    {
        try
        {
            std::unique_ptr<Poco::Net::HTTPClientSession> session(createSession(uri));
            auto ws = std::make_shared<LOOLWebSocket>(*session, request, response);

            const char* expected_response = "statusindicator: ready";

            TST_LOG("Connected to " << uri.toString() << ", waiting for response ["
                                    << expected_response << "]");
            if (getResponseString(ws, expected_response, testname) == expected_response)
            {
                return ws;
            }

            TST_LOG("ERROR: Reconnecting (retry #" << (max_retries - retries) << ") to " << uri.toString());
        }
        catch (const std::exception& ex)
        {
            TST_LOG("ERROR: Failed to connect to " << uri.toString() << ": " << ex.what());
        }

        std::this_thread::sleep_for(std::chrono::microseconds(POLL_TIMEOUT_MICRO_S));
    }
    while (retries--);

    TST_LOG("ERROR: Giving up connecting to " << uri.toString());
    throw std::runtime_error("Cannot connect to [" + uri.toString() + "].");
}

inline
std::shared_ptr<LOOLWebSocket> loadDocAndGetSocket(const Poco::URI& uri, const std::string& documentURL, const std::string& testname, bool isView = true, bool isAssert = true)
{
    try
    {
        // Load a document and get its status.
        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::HTTPResponse response;
        std::shared_ptr<LOOLWebSocket> socket = connectLOKit(uri, request, response, testname);

        sendTextFrame(socket, "load url=" + documentURL, testname);
        bool isLoaded = isDocumentLoaded(*socket, testname, isView);
        if (!isLoaded && !isAssert)
        {
            return nullptr;
        }

        LOK_ASSERT_MESSAGE("Failed to load the document " + documentURL, isLoaded);

        TST_LOG("Loaded document [" << documentURL << "].");
        return socket;
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
    }

    // Really couldn't reach here, but the compiler doesn't know any better.
    return nullptr;
}

inline
std::shared_ptr<LOOLWebSocket> loadDocAndGetSocket(const std::string& docFilename, const Poco::URI& uri, const std::string& testname, bool isView = true, bool isAssert = true)
{
    try
    {
        std::string documentPath, documentURL;
        getDocumentPathAndURL(docFilename, documentPath, documentURL, testname);
        return loadDocAndGetSocket(uri, documentURL, testname, isView, isAssert);
    }
    catch (const Poco::Exception& exc)
    {
        LOK_ASSERT_FAIL(exc.displayText());
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

        n = socket->receiveFrame(buffer, sizeof(buffer), flags, testname);
        TST_LOG("Got " << LOOLWebSocket::getAbbreviatedFrameDump(buffer, n, flags));
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
    StringVector tokens(Util::tokenize(message, ' '));

    // Expected format is something like 'type= parts= current= width= height='.
    const std::string text = tokens[0].substr(std::string("type=").size());
    parts = std::stoi(tokens[1].substr(std::string("parts=").size()));
    part = std::stoi(tokens[2].substr(std::string("current=").size()));
    width = std::stoi(tokens[3].substr(std::string("width=").size()));
    height = std::stoi(tokens[4].substr(std::string("height=").size()));
    viewid = std::stoi(tokens[5].substr(std::string("viewid=").size()));
    LOK_ASSERT_EQUAL(type, text);
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
    StringVector tileTokens(Util::tokenize(firstLine, ' '));
    LOK_ASSERT_EQUAL(std::string("tile:"), tileTokens[0]);
    LOK_ASSERT_EQUAL(std::string("part="), tileTokens[1].substr(0, std::string("part=").size()));
    LOK_ASSERT_EQUAL(std::string("width="), tileTokens[2].substr(0, std::string("width=").size()));
    LOK_ASSERT_EQUAL(std::string("height="), tileTokens[3].substr(0, std::string("height=").size()));
    LOK_ASSERT_EQUAL(std::string("tileposx="), tileTokens[4].substr(0, std::string("tileposx=").size()));
    LOK_ASSERT_EQUAL(std::string("tileposy="), tileTokens[5].substr(0, std::string("tileposy=").size()));
    LOK_ASSERT_EQUAL(std::string("tilewidth="), tileTokens[6].substr(0, std::string("tilewidth=").size()));
    LOK_ASSERT_EQUAL(std::string("tileheight="), tileTokens[7].substr(0, std::string("tileheight=").size()));

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

inline void saveTileAs(const std::vector<char> &tileResponse,
                       const std::string &filename,
                       const std::string &testname)
{
    const std::string firstLine = LOOLProtocol::getFirstLine(tileResponse);
    std::vector<char> res(tileResponse.begin() + firstLine.size() + 1, tileResponse.end());
    std::stringstream streamRes;
    std::copy(res.begin(), res.end(), std::ostream_iterator<char>(streamRes));
    std::fstream outStream(filename, std::ios::out);
    outStream.write(res.data(), res.size());
    outStream.close();
    TST_LOG("Saved [" << firstLine << "] to [" << filename << ']');
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
        saveTileAs(tile, filename, testname);

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

inline bool svgMatch(const char *testname, const std::vector<char> &response, const char *templateFile)
{
    const std::vector<char> expectedSVG = helpers::readDataFromFile(templateFile);
    if (expectedSVG != response)
    {
        TST_LOG_BEGIN("Svg mismatch: response is\n");
        if(response.empty())
            TST_LOG_APPEND("<empty>");
        else
            TST_LOG_APPEND(std::string(response.data(), response.size()));
        TST_LOG_APPEND("\nvs. expected (from '" << templateFile << "' :\n");
        TST_LOG_APPEND(std::string(expectedSVG.data(), expectedSVG.size()));
        std::string newName = templateFile;
        newName += ".new";
        TST_LOG_APPEND("Updated template writing to: " << newName << '\n');
        TST_LOG_END;

        FILE *of = fopen(Poco::Path(TDOC, newName).toString().c_str(), "w");
        CPPUNIT_ASSERT(fwrite(response.data(), response.size(), 1, of) == response.size());
        fclose(of);
        return false;
    }
    return true;
}

/// Select all and wait for the text selection update.
inline void selectAll(const std::shared_ptr<LOOLWebSocket>& socket, const std::string& testname, int repeat = COMMAND_RETRY_COUNT)
{
    for (int i = 0; i < repeat; ++i)
    {
        sendTextFrame(socket, "uno .uno:SelectAll", testname);
        if (!getResponseString(socket, "textselection:", testname).empty())
            break;
    }
}


/// Delete all and wait for the text selection update.
inline void deleteAll(const std::shared_ptr<LOOLWebSocket>& socket, const std::string& testname, int repeat = COMMAND_RETRY_COUNT)
{
    selectAll(socket, testname);

    for (int i = 0; i < repeat; ++i)
    {
        sendTextFrame(socket, "uno .uno:Delete", testname);
        if (!getResponseString(socket, "textselection:", testname).empty())
            break;
    }
}

inline std::string getAllText(const std::shared_ptr<LOOLWebSocket>& socket,
                              const std::string& testname,
                              const std::string& expected = std::string(),
                              int retry = COMMAND_RETRY_COUNT)
{
    static const std::string prefix = "textselectioncontent: ";

    for (int i = 0; i < retry; ++i)
    {
        selectAll(socket, testname);

        sendTextFrame(socket, "gettextselection mimetype=text/plain;charset=utf-8", testname);
        const std::string text = getResponseString(socket, prefix, testname);
        if (!text.empty())
        {
            if (expected.empty() || (prefix + expected) == text)
                return text;
        }
    }

    return std::string();
}

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
