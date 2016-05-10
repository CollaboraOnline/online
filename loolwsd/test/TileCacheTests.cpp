/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <Poco/Net/WebSocket.h>
#include <cppunit/extensions/HelperMacros.h>

#include <TileCache.hpp>

#include <Common.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <LOOLProtocol.hpp>
#include "helpers.hpp"

using namespace helpers;

/// TileCache unit-tests.
class TileCacheTests : public CPPUNIT_NS::TestFixture
{
    const Poco::URI _uri;
    Poco::Net::HTTPResponse _response;

    CPPUNIT_TEST_SUITE(TileCacheTests);

    CPPUNIT_TEST(testSimple);
    CPPUNIT_TEST(testSimpleCombine);
    CPPUNIT_TEST(testUnresponsiveClient);
    CPPUNIT_TEST(testClientPartImpress);
    CPPUNIT_TEST(testClientPartCalc);
#if ENABLE_DEBUG
    CPPUNIT_TEST(testSimultaneousTilesRenderedJustOnce);
#endif

    CPPUNIT_TEST_SUITE_END();

    void testSimple();
    void testSimpleCombine();
    void testUnresponsiveClient();
    void testClientPartImpress();
    void testClientPartCalc();
    void testSimultaneousTilesRenderedJustOnce();

    void checkTiles(Poco::Net::WebSocket& socket,
                    const std::string& type);

    void requestTiles(Poco::Net::WebSocket& socket,
                      const int part,
                      const int docWidth,
                      const int docHeight);

    void getTileMessage(Poco::Net::WebSocket& ws,
                        std::string& tile);

    static
    std::vector<char> genRandomData(const size_t size)
    {
        std::vector<char> v(size);
        v.resize(size);
        auto data = v.data();
        for (size_t i = 0; i < size; ++i)
        {
            data[i] = static_cast<char>(Util::rng::getNext());
        }

        return v;
    }

    static
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

public:
    TileCacheTests()
        : _uri(helpers::getTestServerURI())
    {
#if ENABLE_SSL
        Poco::Net::initializeSSL();
        // Just accept the certificate anyway for testing purposes
        Poco::SharedPtr<Poco::Net::InvalidCertificateHandler> invalidCertHandler = new Poco::Net::AcceptCertificateHandler(false);
        Poco::Net::Context::Params sslParams;
        Poco::Net::Context::Ptr sslContext = new Poco::Net::Context(Poco::Net::Context::CLIENT_USE, sslParams);
        Poco::Net::SSLManager::instance().initializeClient(0, invalidCertHandler, sslContext);
#endif
    }

#if ENABLE_SSL
    ~TileCacheTests()
    {
        Poco::Net::uninitializeSSL();
    }
#endif
};

void TileCacheTests::testSimple()
{
    if (!UnitWSD::init(UnitWSD::UnitType::TYPE_WSD, ""))
    {
        throw std::runtime_error("Failed to load wsd unit test library.");
    }

    // Create TileCache and pretend the file was modified as recently as
    // now, so it discards the cached data.
    TileCache tc("doc.ods", Poco::Timestamp(), "/tmp/tile_cache_tests");

    int part = 0;
    int width = 256;
    int height = 256;
    int tilePosX = 0;
    int tilePosY = 0;
    int tileWidth = 3840;
    int tileHeight = 3840;

    // No Cache
    auto file = tc.lookupTile(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
    CPPUNIT_ASSERT_MESSAGE("found tile when none was expected", !file);

    // Cache Tile
    const auto size = 1024;
    const auto data = genRandomData(size);
    tc.saveTile(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight, data.data(), size);

    // Find Tile
    file = tc.lookupTile(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
    CPPUNIT_ASSERT_MESSAGE("tile not found when expected", file && file->is_open());
    const auto tileData = readDataFromFile(file);
    CPPUNIT_ASSERT_MESSAGE("cached tile corrupted", data == tileData);

    // Invalidate Tiles
    tc.invalidateTiles("invalidatetiles: EMPTY");

    // No Cache
    file = tc.lookupTile(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
    CPPUNIT_ASSERT_MESSAGE("found tile when none was expected", !file);
}

void TileCacheTests::testSimpleCombine()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL);
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);

    auto socket1 = *loadDocAndGetSocket(_uri, documentURL);

    getResponseMessage(socket1, "invalidatetiles");

    sendTextFrame(socket1, "tilecombine part=0 width=256 height=256 tileposx=0,3840 tileposy=0,0 tilewidth=3840 tileheight=3840");

    auto tile1a = getResponseMessage(socket1, "tile:");
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile1a.empty());
    auto tile1b = getResponseMessage(socket1, "tile:");
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile1b.empty());
    sendTextFrame(socket1, "tilecombine part=0 width=256 height=256 tileposx=0,3840 tileposy=0,0 tilewidth=3840 tileheight=3840");

    tile1a = getResponseMessage(socket1, "tile:");
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile1a.empty());
    tile1b = getResponseMessage(socket1, "tile:");
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile1b.empty());

    std::cerr << "Connecting second client." << std::endl;
    auto socket2 = *loadDocAndGetSocket(_uri, documentURL);
    sendTextFrame(socket2, "tilecombine part=0 width=256 height=256 tileposx=0,3840 tileposy=0,0 tilewidth=3840 tileheight=3840");

    auto tile2a = getResponseMessage(socket2, "tile:");
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile2a.empty());
    auto tile2b = getResponseMessage(socket2, "tile:");
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile2b.empty());

    socket1.shutdown();
    socket2.shutdown();
}

void TileCacheTests::testUnresponsiveClient()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL);
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);

    auto socket1 = *loadDocAndGetSocket(_uri, documentURL);

    getResponseMessage(socket1, "invalidatetiles");

    std::cerr << "Connecting second client." << std::endl;
    auto socket2 = *loadDocAndGetSocket(_uri, documentURL);

    // Pathologically request tiles and fail to read (say slow connection).
    // Meanwhile, verify that others can get all tiles fine.
    // TODO: Track memory consumption to verify we don't buffer too much.
    for (auto x = 0; x < 5; ++x)
    {
        // As for tiles and don't read!
        sendTextFrame(socket1, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840 tilewidth=3840 tileheight=3840");

        // Verify that we get all 8 tiles.
        sendTextFrame(socket2, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840 tilewidth=3840 tileheight=3840");
        for (auto i = 0; i < 8; ++i)
        {
            auto tile = getResponseMessage(socket2, "tile:");
            CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile.empty());
        }
    }

    socket1.shutdown();
    socket2.shutdown();
}

void TileCacheTests::testClientPartImpress()
{
    try
    {
        // Load a document
        std::string documentPath, documentURL;
        getDocumentPathAndURL("setclientpart.odp", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        checkTiles(socket, "presentation");

        socket.shutdown();
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void TileCacheTests::testClientPartCalc()
{
    try
    {
        // Load a document
        std::string documentPath, documentURL;
        getDocumentPathAndURL("setclientpart.ods", documentPath, documentURL);

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
        Poco::Net::WebSocket socket = *connectLOKit(_uri, request, _response);

        sendTextFrame(socket, "load url=" + documentURL);
        CPPUNIT_ASSERT_MESSAGE("cannot load the document " + documentURL, isDocumentLoaded(socket));

        checkTiles(socket, "spreadsheet");

        socket.shutdown();
        Util::removeFile(documentPath);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void TileCacheTests::testSimultaneousTilesRenderedJustOnce()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL);

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);
    Poco::Net::WebSocket socket1 = *connectLOKit(_uri, request, _response);
    sendTextFrame(socket1, "load url=" + documentURL);

    Poco::Net::WebSocket socket2 = *connectLOKit(_uri, request, _response);
    sendTextFrame(socket2, "load url=" + documentURL);

    sendTextFrame(socket1, "tile part=42 width=400 height=400 tileposx=1000 tileposy=2000 tilewidth=3000 tileheight=3000");
    sendTextFrame(socket2, "tile part=42 width=400 height=400 tileposx=1000 tileposy=2000 tilewidth=3000 tileheight=3000");

    std::string response1;
    getResponseMessage(socket1, "tile:", response1, true);
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !response1.empty());

    std::string response2;
    getResponseMessage(socket2, "tile:", response2, true);
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !response2.empty());

    if (!response1.empty() && !response2.empty())
    {
        Poco::StringTokenizer tokens1(response1, " ");
        std::string renderId1;
        LOOLProtocol::getTokenString(tokens1, "renderid", renderId1);
        Poco::StringTokenizer tokens2(response2, " ");
        std::string renderId2;
        LOOLProtocol::getTokenString(tokens2, "renderid", renderId2);

        CPPUNIT_ASSERT(renderId1 == renderId2 ||
                       (renderId1 == "cached" && renderId2 != "cached") ||
                       (renderId1 != "cached" && renderId2 == "cached"));
    }

    socket1.shutdown();
    socket2.shutdown();
}

void TileCacheTests::checkTiles(Poco::Net::WebSocket& socket, const std::string& docType)
{
    const std::string current = "current=";
    const std::string height = "height=";
    const std::string parts = "parts=";
    const std::string type = "type=";
    const std::string width = "width=";

    int currentPart = -1;
    int totalParts = 0;
    int docHeight = 0;
    int docWidth = 0;

    std::string response;
    std::string text;

    // check total slides 10
    getResponseMessage(socket, "status:", response, false);
    CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
    {
        std::cout << "status: " << response << std::endl;
        Poco::StringTokenizer tokens(response, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(5), tokens.count());

        // Expected format is something like 'type= parts= current= width= height='.
        text = tokens[0].substr(type.size());
        totalParts = std::stoi(tokens[1].substr(parts.size()));
        currentPart = std::stoi(tokens[2].substr(current.size()));
        docWidth = std::stoi(tokens[3].substr(width.size()));
        docHeight = std::stoi(tokens[4].substr(height.size()));
        CPPUNIT_ASSERT_EQUAL(docType, text);
        CPPUNIT_ASSERT_EQUAL(10, totalParts);
        CPPUNIT_ASSERT(currentPart > -1);
        CPPUNIT_ASSERT(docWidth > 0);
        CPPUNIT_ASSERT(docHeight > 0);
    }

    if (docType == "presentation")
    {
        // request tiles
        requestTiles(socket, currentPart, docWidth, docHeight);
    }

    // random setclientpart
    std::srand(std::time(0));
    std::vector<int> vParts = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9};
    std::random_shuffle (vParts.begin(), vParts.end());
    for (auto it : vParts)
    {
        if (currentPart != it)
        {
            // change part
            text = Poco::format("setclientpart part=%d", it);
            std::cout << text << std::endl;
            sendTextFrame(socket, text);
            requestTiles(socket, it, docWidth, docHeight);
        }
        currentPart = it;
    }
}

void TileCacheTests::requestTiles(Poco::Net::WebSocket& socket, const int part, const int docWidth, const int docHeight)
{
    // twips
    const int tileSize = 3840;
    // pixel
    const int pixTileSize = 256;

    int rows;
    int cols;
    int tileX;
    int tileY;
    int tileWidth;
    int tileHeight;

    std::string text;
    std::string tile;

    rows = docHeight / tileSize;
    cols = docWidth / tileSize;

    // Note: this code tests tile requests in the wrong way.

    // This code does NOT match what was the idea how the LOOL protocol should/could be used. The
    // intent was never that the protocol would need to be, or should be, used in a strict
    // request/reply fashion. If a client needs n tiles, it should just send the requests, one after
    // another. There is no need to do n roundtrips. A client should all the time be reading
    // incoming messages, and handle incoming tiles as appropriate. There should be no expectation
    // that tiles arrive at the client in the same order that they were requested.

    // But, whatever.

    for (int itRow = 0; itRow < rows; ++itRow)
    {
        for (int itCol = 0; itCol < cols; ++itCol)
        {
            tileWidth = tileSize;
            tileHeight = tileSize;
            tileX = tileSize * itCol;
            tileY = tileSize * itRow;
            text = Poco::format("tile part=%d width=%d height=%d tileposx=%d tileposy=%d tilewidth=%d tileheight=%d",
                    part, pixTileSize, pixTileSize, tileX, tileY, tileWidth, tileHeight);

            sendTextFrame(socket, text);
            getTileMessage(socket, tile);
            // expected tile: part= width= height= tileposx= tileposy= tilewidth= tileheight=
            Poco::StringTokenizer tokens(tile, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
            CPPUNIT_ASSERT_EQUAL(std::string("tile:"), tokens[0]);
            CPPUNIT_ASSERT_EQUAL(part, std::stoi(tokens[1].substr(std::string("part=").size())));
            CPPUNIT_ASSERT_EQUAL(pixTileSize, std::stoi(tokens[2].substr(std::string("width=").size())));
            CPPUNIT_ASSERT_EQUAL(pixTileSize, std::stoi(tokens[3].substr(std::string("height=").size())));
            CPPUNIT_ASSERT_EQUAL(tileX, std::stoi(tokens[4].substr(std::string("tileposx=").size())));
            CPPUNIT_ASSERT_EQUAL(tileY, std::stoi(tokens[5].substr(std::string("tileposy=").size())));
            CPPUNIT_ASSERT_EQUAL(tileWidth, std::stoi(tokens[6].substr(std::string("tileWidth=").size())));
            CPPUNIT_ASSERT_EQUAL(tileHeight, std::stoi(tokens[7].substr(std::string("tileHeight=").size())));
        }
    }
}

void TileCacheTests::getTileMessage(Poco::Net::WebSocket& ws, std::string& tile)
{
    int flags;
    int bytes;
    int size = 0;
    int retries = 10;
    const Poco::Timespan waitTime(1000000);

    ws.setReceiveTimeout(0);
    std::cout << "==> getTileMessage\n";
    tile.clear();
    do
    {
        std::vector<char> payload(READ_BUFFER_SIZE * 100);
        if (retries > 0 && ws.poll(waitTime, Poco::Net::Socket::SELECT_READ))
        {
            bytes = ws.receiveFrame(payload.data(), payload.capacity(), flags);
            payload.resize(bytes > 0 ? bytes : 0);
            std::cout << "Got " << bytes << " bytes, flags: " << std::bitset<8>(flags) << '\n';
            if (bytes > 0 && (flags & Poco::Net::WebSocket::FRAME_OP_BITMASK) != Poco::Net::WebSocket::FRAME_OP_CLOSE)
            {
                tile = LOOLProtocol::getFirstLine(payload.data(), bytes);
                std::cout << "message: " << tile << '\n';
                Poco::StringTokenizer tokens(tile, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
                if (tokens.count() == 2 &&
                    tokens[0] == "nextmessage:" &&
                    LOOLProtocol::getTokenInteger(tokens[1], "size", size) &&
                    size > 0)
                {
                    payload.resize(size);
                    bytes = ws.receiveFrame(payload.data(), size, flags);
                    tile = LOOLProtocol::getFirstLine(payload.data(), bytes);
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

CPPUNIT_TEST_SUITE_REGISTRATION(TileCacheTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
