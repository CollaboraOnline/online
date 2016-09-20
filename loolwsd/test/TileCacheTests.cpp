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

#include "Common.hpp"
#include "LOOLProtocol.hpp"
#include "MessageQueue.hpp"
#include "Png.hpp"
#include "TileCache.hpp"
#include "Unit.hpp"
#include "Util.hpp"
#include "helpers.hpp"

using namespace helpers;

namespace CPPUNIT_NS
{
template<>
struct assertion_traits<std::vector<char>>
{
    static bool equal(const std::vector<char>& x, const std::vector<char>& y)
    {
        return x == y;
    }

    static std::string toString(const std::vector<char>& x)
    {
        const std::string text = '"' + (!x.empty() ? std::string(x.data(), x.size()) : "<empty>") + '"';
        return text;
    }
};
}

/// TileCache unit-tests.
class TileCacheTests : public CPPUNIT_NS::TestFixture
{
    const Poco::URI _uri;
    Poco::Net::HTTPResponse _response;

    CPPUNIT_TEST_SUITE(TileCacheTests);

    CPPUNIT_TEST(testSimple);
    CPPUNIT_TEST(testSimpleCombine);
    CPPUNIT_TEST(testPerformance);
    CPPUNIT_TEST(testUnresponsiveClient);
    CPPUNIT_TEST(testImpressTiles);
    CPPUNIT_TEST(testClientPartImpress);
    CPPUNIT_TEST(testClientPartCalc);
#if ENABLE_DEBUG
    CPPUNIT_TEST(testSimultaneousTilesRenderedJustOnce);
#endif
    CPPUNIT_TEST(testLoad12ods);
    CPPUNIT_TEST(testTileInvalidateWriter);
    //CPPUNIT_TEST(testTileInvalidateCalc);
    CPPUNIT_TEST(testTileQueuePriority);

    CPPUNIT_TEST_SUITE_END();

    void testSimple();
    void testSimpleCombine();
    void testPerformance();
    void testUnresponsiveClient();
    void testImpressTiles();
    void testClientPartImpress();
    void testClientPartCalc();
    void testSimultaneousTilesRenderedJustOnce();
    void testLoad12ods();
    void testTileInvalidateWriter();
    void testWriterAnyKey();
    void testTileInvalidateCalc();
    void testTileQueuePriority();

    void checkTiles(Poco::Net::WebSocket& socket,
                    const std::string& type,
                    const std::string& name = "checkTiles ");

    void requestTiles(Poco::Net::WebSocket& socket,
                      const int part,
                      const int docWidth,
                      const int docHeight,
                      const std::string& name = "requestTiles ");

    void checkBlackTiles(Poco::Net::WebSocket& socket,
                         const int part,
                         const int docWidth,
                         const int docHeight,
                         const std::string& name = "checkBlackTiles ");

    void checkBlackTile(std::stringstream& tile);

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
    TileDesc tile(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);

    // No Cache
    auto file = tc.lookupTile(tile);
    CPPUNIT_ASSERT_MESSAGE("found tile when none was expected", !file);

    // Cache Tile
    const auto size = 1024;
    const auto data = genRandomData(size);
    tc.saveTileAndNotify(tile, data.data(), size);

    // Find Tile
    file = tc.lookupTile(tile);
    CPPUNIT_ASSERT_MESSAGE("tile not found when expected", file && file->is_open());
    const auto tileData = readDataFromFile(file);
    CPPUNIT_ASSERT_MESSAGE("cached tile corrupted", data == tileData);

    // Invalidate Tiles
    tc.invalidateTiles("invalidatetiles: EMPTY");

    // No Cache
    file = tc.lookupTile(tile);
    CPPUNIT_ASSERT_MESSAGE("found tile when none was expected", !file);
}

void TileCacheTests::testSimpleCombine()
{
    const std::string docFilename = "hello.odt";
    auto socket1 = *loadDocAndGetSocket(docFilename, _uri, "simpleCombine-1 ");

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
    auto socket2 = *loadDocAndGetSocket(docFilename, _uri, "simpleCombine-2 ", true);
    sendTextFrame(socket2, "tilecombine part=0 width=256 height=256 tileposx=0,3840 tileposy=0,0 tilewidth=3840 tileheight=3840");

    auto tile2a = getResponseMessage(socket2, "tile:");
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile2a.empty());
    auto tile2b = getResponseMessage(socket2, "tile:");
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile2b.empty());

    socket1.shutdown();
    socket2.shutdown();
}

void TileCacheTests::testPerformance()
{
    auto socket = *loadDocAndGetSocket("hello.odt", _uri, "performance ");

    Poco::Timestamp timestamp;
    for (auto x = 0; x < 5; ++x)
    {
        sendTextFrame(socket, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840 tilewidth=3840 tileheight=3840");
        for (auto i = 0; i < 8; ++i)
        {
            auto tile = getResponseMessage(socket, "tile:", "tile-performance ");
            CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile.empty());
        }
    }

    std::cerr << "Tile rendering roundtrip for 5 x 8 tiles combined: " << timestamp.elapsed() / 1000.
              << " ms. Per-tilecombine: " << timestamp.elapsed() / (1000. * 5)
              << " ms. Per-tile: " << timestamp.elapsed() / (1000. * 5 * 8) << "ms."
              << std::endl;

    socket.shutdown();
}

void TileCacheTests::testUnresponsiveClient()
{
    const std::string docFilename = "hello.odt";
    std::cerr << "Connecting first client." << std::endl;
    auto socket1 = *loadDocAndGetSocket(docFilename, _uri, "unresponsiveClient-1 ");

    std::cerr << "Connecting second client." << std::endl;
    auto socket2 = *loadDocAndGetSocket(docFilename, _uri, "unresponsiveClient-2 ", true);

    // Pathologically request tiles and fail to read (say slow connection).
    // Meanwhile, verify that others can get all tiles fine.
    // TODO: Track memory consumption to verify we don't buffer too much.

    std::ostringstream oss;
    for (auto i = 0; i < 1000; ++i)
    {
        oss << Util::encodeId(Util::rng::getNext(), 6);
    }

    const auto documentContents = oss.str();
    for (auto x = 0; x < 8; ++x)
    {
        // Invalidate to force re-rendering.
        sendTextFrame(socket2, "uno .uno:SelectAll");
        sendTextFrame(socket2, "uno .uno:Delete");
        assertResponseLine(socket2, "invalidatetiles:", "client2 ");
        sendTextFrame(socket2, "paste mimetype=text/html\n" + documentContents);
        assertResponseLine(socket2, "invalidatetiles:", "client2 ");

        // Ask for tiles and don't read!
        sendTextFrame(socket1, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840 tilewidth=3840 tileheight=3840");

        // Verify that we get all 8 tiles.
        sendTextFrame(socket2, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840 tilewidth=3840 tileheight=3840");
        for (auto i = 0; i < 8; ++i)
        {
            auto tile = getResponseMessage(socket2, "tile:", "client2 ");
            CPPUNIT_ASSERT_MESSAGE("Did not receive tile #" + std::to_string(i+1) + " of 8: message as expected", !tile.empty());
        }
    }

    socket1.shutdown();
    socket2.shutdown();
}

void TileCacheTests::testImpressTiles()
{
    try
    {
        const std::string testName = "impressTiles ";
        auto socket = *loadDocAndGetSocket("setclientpart.odp", _uri, testName);

        sendTextFrame(socket, "tile part=0 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 id=0", testName);
        getTileMessage(socket, testName);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void TileCacheTests::testClientPartImpress()
{
    try
    {
        const std::string testName = "clientPartImpress ";
        auto socket = *loadDocAndGetSocket("setclientpart.odp", _uri, testName);

        checkTiles(socket, "presentation", testName);

        socket.shutdown();
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
        const std::string testName = "clientPartCalc ";
        auto socket = *loadDocAndGetSocket("setclientpart.ods", _uri, testName);

        checkTiles(socket, "spreadsheet", testName);

        socket.shutdown();
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

    // Wait for the invalidatetile events to pass, otherwise they
    // remove our tile subscription.
    assertResponseLine(socket1, "statechanged:", "client1 ");
    assertResponseLine(socket2, "statechanged:", "client2 ");

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

void TileCacheTests::testLoad12ods()
{
    try
    {
        const auto testName = "load12Ods ";
        auto socket = *loadDocAndGetSocket("load12.ods", _uri, testName);

        int docSheet = -1;
        int docSheets = 0;
        int docHeight = 0;
        int docWidth = 0;
        int docViewId = -1;

        // check document size
        sendTextFrame(socket, "status");

        std::string response;
        getResponseMessage(socket, "status:", response, false);
        CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
        parseDocSize(response, "spreadsheet", docSheet, docSheets, docWidth, docHeight, docViewId);

        checkBlackTiles(socket, docSheet, docWidth, docWidth, testName);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void TileCacheTests::checkBlackTile(std::stringstream& tile)
{
    png_uint_32 height = 0;
    png_uint_32 width = 0;
    png_uint_32 rowBytes = 0;

    auto rows = png::decodePNG(tile, height, width, rowBytes);

    png_uint_32 black = 0;
    for (png_uint_32 itRow = 0; itRow < height; ++itRow)
    {
        png_uint_32 itCol = 0;
        while (itCol <= rowBytes)
        {
            png_byte R = rows[itRow][itCol + 0];
            png_byte G = rows[itRow][itCol + 1];
            png_byte B = rows[itRow][itCol + 2];
            //png_byte A = rows[itRow][itCol + 3];
            if (R == 0x00 && G == 0x00 && B == 0x00)
            {
                ++black;
            }

            itCol += 4;
        }
    }

    CPPUNIT_ASSERT_MESSAGE("The tile is 100% black", black != height * width);
    assert(height * width != 0);
    CPPUNIT_ASSERT_MESSAGE("The tile is 90% black", (black * 100) / (height * width) < 90);
}

void TileCacheTests::checkBlackTiles(Poco::Net::WebSocket& socket, const int /*part*/, const int /*docWidth*/, const int /*docHeight*/, const std::string& name)
{
    // Check the last row of tiles to verify that the tiles
    // render correctly and there are no black tiles.
    // Current cap of table size ends at 257280 twips (for load12.ods),
    // otherwise 2035200 should be rendered successfully.
    const auto req = "tile part=0 width=256 height=256 tileposx=0 tileposy=253440 tilewidth=3840 tileheight=3840";
    sendTextFrame(socket, req);

    const auto tile = getResponseMessage(socket, "tile:", name);
    const std::string firstLine = LOOLProtocol::getFirstLine(tile);

#if 0
    std::fstream outStream("/tmp/black.png", std::ios::out);
    outStream.write(tile.data() + firstLine.size() + 1, tile.size() - firstLine.size() - 1);
    outStream.close();
#endif

    std::stringstream streamTile;
    std::copy(tile.begin() + firstLine.size() + 1, tile.end(), std::ostream_iterator<char>(streamTile));
    checkBlackTile(streamTile);
}

void TileCacheTests::testTileInvalidateWriter()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL);
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);

    auto socket = *loadDocAndGetSocket(_uri, documentURL);

    std::string text = "Test. Now go 3 \"Enters\":\n\n\nNow after the enters, goes this text";
    for (char ch : text)
    {
        sendChar(socket, ch); // Send ordinary characters and wait for response -> one tile invalidation for each
        assertResponseLine(socket, "invalidatetiles:");
    }

    text = "\n\n\n";
    for (char ch : text)
    {
        sendChar(socket, ch, skCtrl); // Send 3 Ctrl+Enter -> 3 new pages
        assertResponseLine(socket, "invalidatetiles:");
    }

    text = "abcde";
    for (char ch : text)
    {
        sendChar(socket, ch);
        assertResponseLine(socket, "invalidatetiles:");
    }

    // While extra invalidates are not desirable, they are inevitable at the moment.
    //CPPUNIT_ASSERT_MESSAGE("received unexpected invalidatetiles: message", getResponseMessage(socket, "invalidatetiles:").empty());

    // TODO: implement a random-sequence "monkey test"
}

// This isn't yet used
void TileCacheTests::testWriterAnyKey()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL);
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);

    auto socket = *loadDocAndGetSocket(_uri, documentURL);

    // Now test "usual" keycodes (TODO: whole 32-bit range)
    for (int i=0; i<0x1000; ++i)
    {
        std::stringstream ss("Keycode ");
        ss << i;
        auto s = ss.str();
        std::stringstream fn("saveas url=");
        fn << documentURL << i << ".odt format= options=";
        auto f = fn.str();

        const int istart = 474;
        sendText(socket, "\n"+s+"\n");
        sendKeyEvent(socket, "input", 0, i);
        sendKeyEvent(socket, "up", 0, i);
        sendText(socket, "\nEnd "+s+"\n");
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Shift:\n");
        sendKeyEvent(socket, "input", 0, i|skShift);
        sendKeyEvent(socket, "up", 0, i|skShift);
        sendText(socket, "\nEnd "+s+" With Shift\n");
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Ctrl:\n");
        sendKeyEvent(socket, "input", 0, i|skCtrl);
        sendKeyEvent(socket, "up", 0, i|skCtrl);
        sendText(socket, "\nEnd "+s+" With Ctrl\n");
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Alt:\n");
        sendKeyEvent(socket, "input", 0, i|skAlt);
        sendKeyEvent(socket, "up", 0, i|skAlt);
        sendText(socket, "\nEnd "+s+" With Alt\n");
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Shift+Ctrl:\n");
        sendKeyEvent(socket, "input", 0, i|skShift|skCtrl);
        sendKeyEvent(socket, "up", 0, i|skShift|skCtrl);
        sendText(socket, "\nEnd "+s+" With Shift+Ctrl\n");
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Shift+Alt:\n");
        sendKeyEvent(socket, "input", 0, i|skShift|skAlt);
        sendKeyEvent(socket, "up", 0, i|skShift|skAlt);
        sendText(socket, "\nEnd "+s+" With Shift+Alt\n");
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Ctrl+Alt:\n");
        sendKeyEvent(socket, "input", 0, i|skCtrl|skAlt);
        sendKeyEvent(socket, "up", 0, i|skCtrl|skAlt);
        sendText(socket, "\nEnd "+s+" With Ctrl+Alt\n");
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Shift+Ctrl+Alt:\n");
        sendKeyEvent(socket, "input", 0, i|skShift|skCtrl|skAlt);
        sendKeyEvent(socket, "up", 0, i|skShift|skCtrl|skAlt);
        sendText(socket, "\nEnd "+s+" With Shift+Ctrl+Alt\n");

        if (i>=istart)
            sendTextFrame(socket, f);

        // This is to allow server to process the input, and check that everything is still OK
        sendTextFrame(socket, "status");
        getResponseMessage(socket, "status:");
    }
    //    sendTextFrame(socket, "saveas url=file:///tmp/emptyempty.odt format= options=");
}

void TileCacheTests::testTileInvalidateCalc()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.ods", documentPath, documentURL);
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);

    auto socket = *loadDocAndGetSocket(_uri, documentURL);

    std::string text = "Test. Now go 3 \"Enters\": Now after the enters, goes this text";
    for (char ch : text)
    {
        sendChar(socket, ch); // Send ordinary characters -> one tile invalidation for each
        auto response = getResponseMessage(socket, "invalidatetiles:");
        //CPPUNIT_ASSERT_MESSAGE("did not receive a invalidatetiles: message as expected", !response.empty());
    }

    text = "\n\n\n";
    for (char ch : text)
    {
        sendChar(socket, ch, skCtrl); // Send 3 Ctrl+Enter -> 3 new pages; I see 3 tiles invalidated for each
        auto response1 = getResponseMessage(socket, "invalidatetiles:");
        CPPUNIT_ASSERT_MESSAGE("did not receive a invalidatetiles: message as expected", !response1.empty());
        auto response2 = getResponseMessage(socket, "invalidatetiles:");
        CPPUNIT_ASSERT_MESSAGE("did not receive a invalidatetiles: message as expected", !response2.empty());
        auto response3 = getResponseMessage(socket, "invalidatetiles:");
        CPPUNIT_ASSERT_MESSAGE("did not receive a invalidatetiles: message as expected", !response3.empty());
    }

    text = "abcde";
    for (char ch : text)
    {
        sendChar(socket, ch);
        auto response = getResponseMessage(socket, "invalidatetiles:");
        CPPUNIT_ASSERT_MESSAGE("did not receive a invalidatetiles: message as expected", !response.empty());
    }

    // While extra invalidates are not desirable, they are inevitable at the moment.
    //CPPUNIT_ASSERT_MESSAGE("received unexpected invalidatetiles: message", getResponseMessage(socket, "invalidatetiles:").empty());

    socket.shutdown();
}

void TileCacheTests::testTileQueuePriority()
{
    const std::string reqHigh = "tile part=0 width=256 height=256 tileposx=0 tileposy=0 tilewidth=3840 tileheight=3840";
    const TileQueue::Payload payloadHigh(reqHigh.data(), reqHigh.data() + reqHigh.size());
    const std::string reqLow = "tile part=0 width=256 height=256 tileposx=0 tileposy=253440 tilewidth=3840 tileheight=3840";
    const TileQueue::Payload payloadLow(reqLow.data(), reqLow.data() + reqLow.size());

    TileQueue queue;

    // Request the tiles.
    queue.put(reqLow);
    queue.put(reqHigh);

    // Original order.
    CPPUNIT_ASSERT_EQUAL(payloadLow, queue.get());
    CPPUNIT_ASSERT_EQUAL(payloadHigh, queue.get());

    // Request the tiles.
    queue.put(reqLow);
    queue.put(reqHigh);
    queue.put(reqHigh);
    queue.put(reqLow);

    // Set cursor above reqHigh.
    queue.updateCursorPosition(0, 0, 0, 0, 10, 100);

    // Prioritized order.
    CPPUNIT_ASSERT_EQUAL(payloadHigh, queue.get());
    CPPUNIT_ASSERT_EQUAL(payloadLow, queue.get());

    // Repeat with cursor position set.
    queue.put(reqLow);
    queue.put(reqHigh);
    CPPUNIT_ASSERT_EQUAL(payloadHigh, queue.get());
    CPPUNIT_ASSERT_EQUAL(payloadLow, queue.get());

    // Repeat by changing cursor position.
    queue.put(reqLow);
    queue.put(reqHigh);
    queue.updateCursorPosition(0, 0, 0, 253450, 10, 100);
    CPPUNIT_ASSERT_EQUAL(payloadLow, queue.get());
    CPPUNIT_ASSERT_EQUAL(payloadHigh, queue.get());
}

void TileCacheTests::checkTiles(Poco::Net::WebSocket& socket, const std::string& docType, const std::string& name)
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
    sendTextFrame(socket, "status");
    getResponseMessage(socket, "status:", response, false);
    CPPUNIT_ASSERT_MESSAGE("did not receive a status: message as expected", !response.empty());
    {
        std::string line;
        std::istringstream istr(response);
        std::getline(istr, line);

        std::cout << "status: " << response << std::endl;
        Poco::StringTokenizer tokens(line, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(6), tokens.count());

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
        requestTiles(socket, currentPart, docWidth, docHeight, name);
    }

    // random setclientpart
    std::srand(std::time(0));
    std::vector<int> vParts = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9};
    std::random_shuffle(vParts.begin(), vParts.end());
    for (auto it : vParts)
    {
        if (currentPart != it)
        {
            // change part
            text = Poco::format("setclientpart part=%d", it);
            std::cout << text << std::endl;
            sendTextFrame(socket, text);
            // Wait for the change to take effect otherwise we get invalidatetile
            // which removes our next tile request subscription (expecting us to
            // issue a new tile request as a response, which a real client would do).
            assertResponseLine(socket, "setpart:", "checkTiles");

            requestTiles(socket, it, docWidth, docHeight, name);
        }

        currentPart = it;
    }
}

void TileCacheTests::requestTiles(Poco::Net::WebSocket& socket, const int part, const int docWidth, const int docHeight, const std::string& name)
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
            tile = assertResponseLine(socket, "tile:", name);
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

CPPUNIT_TEST_SUITE_REGISTRATION(TileCacheTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
