/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <Poco/Net/AcceptCertificateHandler.h>
#include <Poco/Net/InvalidCertificateHandler.h>
#include <Poco/Net/SSLManager.h>

#include <cppunit/extensions/HelperMacros.h>

#include <Common.hpp>
#include <Protocol.hpp>
#include <LOOLWebSocket.hpp>
#include <MessageQueue.hpp>
#include <Png.hpp>
#include <TileCache.hpp>
#include <Unit.hpp>
#include <Util.hpp>

#include <countloolkits.hpp>
#include <helpers.hpp>
#include <test.hpp>
#include <sstream>

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
    CPPUNIT_TEST(testCancelTiles);
    // unstable
    // CPPUNIT_TEST(testCancelTilesMultiView);
    CPPUNIT_TEST(testDisconnectMultiView);
    CPPUNIT_TEST(testUnresponsiveClient);
    CPPUNIT_TEST(testImpressTiles);
    CPPUNIT_TEST(testClientPartImpress);
    CPPUNIT_TEST(testClientPartCalc);
    // FIXME CPPUNIT_TEST(testTilesRenderedJustOnce);
    // CPPUNIT_TEST(testTilesRenderedJustOnceMultiClient); // always fails, seems complicated to fix
#if ENABLE_DEBUG
    CPPUNIT_TEST(testSimultaneousTilesRenderedJustOnce);
#endif
    CPPUNIT_TEST(testLoad12ods);
    CPPUNIT_TEST(testTileInvalidateWriter);
    CPPUNIT_TEST(testTileInvalidateWriterPage);
    CPPUNIT_TEST(testTileInvalidateCalc);
    // temporarily disable
    //CPPUNIT_TEST(testTileInvalidatePartCalc);
    //CPPUNIT_TEST(testTileInvalidatePartImpress);
    CPPUNIT_TEST(testTileRequestByInvalidation);
    CPPUNIT_TEST(testTileRequestByZoom);
    CPPUNIT_TEST(testTileWireIDHandling);
    CPPUNIT_TEST(testTileProcessed);
    CPPUNIT_TEST(testTileInvalidatedOutside);
    CPPUNIT_TEST(testTileBeingRenderedHandling);
    CPPUNIT_TEST(testWireIDFilteringOnWSDSide);
    CPPUNIT_TEST(testLimitTileVersionsOnFly);


    CPPUNIT_TEST_SUITE_END();

    void testSimple();
    void testSimpleCombine();
    void testCancelTiles();
    void testCancelTilesMultiView();
    void testDisconnectMultiView();
    void testUnresponsiveClient();
    void testImpressTiles();
    void testClientPartImpress();
    void testClientPartCalc();
    void testTilesRenderedJustOnce();
    void testTilesRenderedJustOnceMultiClient();
    void testSimultaneousTilesRenderedJustOnce();
    void testLoad12ods();
    void testTileInvalidateWriter();
    void testTileInvalidateWriterPage();
    void testWriterAnyKey();
    void testTileInvalidateCalc();
    void testTileInvalidatePartCalc();
    void testTileInvalidatePartImpress();
    void testTileRequestByInvalidation();
    void testTileRequestByZoom();
    void testTileWireIDHandling();
    void testTileProcessed();
    void testTileInvalidatedOutside();
    void testTileBeingRenderedHandling();
    void testWireIDFilteringOnWSDSide();
    void testLimitTileVersionsOnFly();

    void checkTiles(std::shared_ptr<LOOLWebSocket>& socket,
                    const std::string& type,
                    const std::string& name = "checkTiles ");

    void requestTiles(std::shared_ptr<LOOLWebSocket>& socket,
                      const int part,
                      const int docWidth,
                      const int docHeight,
                      const std::string& name = "requestTiles ");

    void checkBlackTiles(std::shared_ptr<LOOLWebSocket>& socket,
                         const int part,
                         const int docWidth,
                         const int docHeight,
                         const std::string& name = "checkBlackTiles ");

    void checkBlackTile(std::stringstream& tile);

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
        Poco::Net::SSLManager::instance().initializeClient(nullptr, invalidCertHandler, sslContext);
#endif
    }

#if ENABLE_SSL
    ~TileCacheTests()
    {
        Poco::Net::uninitializeSSL();
    }
#endif

    void setUp()
    {
        resetTestStartTime();
        testCountHowManyLoolkits();
        resetTestStartTime();
    }

    void tearDown()
    {
        resetTestStartTime();
        testNoExtraLoolKitsLeft();
        resetTestStartTime();
    }
};

void TileCacheTests::testSimple()
{
    if (isStandalone())
    {
        if (!UnitWSD::init(UnitWSD::UnitType::Wsd, ""))
            throw std::runtime_error("Failed to load wsd unit test library.");
    }

    // Create TileCache and pretend the file was modified as recently as
    // now, so it discards the cached data.
    TileCache tc("doc.ods", Poco::Timestamp(), "/tmp/tile_cache_tests", true);

    int part = 0;
    int width = 256;
    int height = 256;
    int tilePosX = 0;
    int tilePosY = 0;
    int tileWidth = 3840;
    int tileHeight = 3840;
    TileDesc tile(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight, -1, 0, -1, false);

    // No Cache
    std::unique_ptr<std::fstream> file = tc.lookupTile(tile);
    CPPUNIT_ASSERT_MESSAGE("found tile when none was expected", !file);

    // Cache Tile
    const int size = 1024;
    const std::vector<char> data = genRandomData(size);
    tc.saveTileAndNotify(tile, data.data(), size);

    // Find Tile
    file = tc.lookupTile(tile);
    CPPUNIT_ASSERT_MESSAGE("tile not found when expected", file && file->is_open());
    const std::vector<char> tileData = readDataFromFile(file);
    CPPUNIT_ASSERT_MESSAGE("cached tile corrupted", data == tileData);

    // Invalidate Tiles
    tc.invalidateTiles("invalidatetiles: EMPTY");

    // No Cache
    file = tc.lookupTile(tile);
    CPPUNIT_ASSERT_MESSAGE("found tile when none was expected", !file);
}

void TileCacheTests::testSimpleCombine()
{
    const char* testname = "simpleCombine ";
    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL, testname);

    // First.
    std::shared_ptr<LOOLWebSocket> socket1 = loadDocAndGetSocket(_uri, documentURL, "simpleCombine-1 ");

    sendTextFrame(socket1, "tilecombine part=0 width=256 height=256 tileposx=0,3840 tileposy=0,0 tilewidth=3840 tileheight=3840");

    std::vector<char> tile1a = getResponseMessage(socket1, "tile:", testname);
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile1a.empty());
    std::vector<char> tile1b = getResponseMessage(socket1, "tile:", testname);
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile1b.empty());
    sendTextFrame(socket1, "tilecombine part=0 width=256 height=256 tileposx=0,3840 tileposy=0,0 tilewidth=3840 tileheight=3840");

    tile1a = getResponseMessage(socket1, "tile:", testname);
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile1a.empty());
    tile1b = getResponseMessage(socket1, "tile:", testname);
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile1b.empty());

    // Second.
    std::cerr << "Connecting second client." << std::endl;
    std::shared_ptr<LOOLWebSocket> socket2 = loadDocAndGetSocket(_uri, documentURL, "simpleCombine-2 ", true);

    sendTextFrame(socket2, "tilecombine part=0 width=256 height=256 tileposx=0,3840 tileposy=0,0 tilewidth=3840 tileheight=3840");

    std::vector<char> tile2a = getResponseMessage(socket2, "tile:", testname);
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile2a.empty());
    std::vector<char> tile2b = getResponseMessage(socket2, "tile:", testname);
    CPPUNIT_ASSERT_MESSAGE("did not receive a tile: message as expected", !tile2b.empty());
}

void TileCacheTests::testCancelTiles()
{
    const char* testName = "cancelTiles ";

    // The tile response can race past the canceltiles,
    // so be forgiving to avoid spurious failures.
    const size_t repeat = 4;
    for (size_t i = 1; i <= repeat; ++i)
    {
        std::cerr << "cancelTiles try #" << i << std::endl;

        // Wait to clear previous sessions.
        countLoolKitProcesses(InitialLoolKitCount);

        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket("setclientpart.ods", _uri, testName);

        // Request a huge tile, and cancel immediately.
        sendTextFrame(socket, "tilecombine part=0 width=2560 height=2560 tileposx=0 tileposy=0 tilewidth=38400 tileheight=38400");
        sendTextFrame(socket, "canceltiles");

        const auto res = getResponseString(socket, "tile:", testName, 1000);
        if (res.empty())
        {
            break;
        }
        else
        {
            if (i == repeat)
            {
                CPPUNIT_ASSERT_MESSAGE("Did not expect getting message [" + res + "].", res.empty());
            }

            std::cerr << "Unexpected: [" << res << "]" << std::endl;
        }
    }
}

void TileCacheTests::testCancelTilesMultiView()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("setclientpart.ods", documentPath, documentURL, "cancelTilesMultiView ");

    // The tile response can race past the canceltiles,
    // so be forgiving to avoid spurious failures.
    const size_t repeat = 4;
    for (size_t j = 1; j <= repeat; ++j)
    {
        std::cerr << "cancelTilesMultiView try #" << j << std::endl;

        // Wait to clear previous sessions.
        countLoolKitProcesses(InitialLoolKitCount);

        // Request a huge tile, and cancel immediately.
        std::shared_ptr<LOOLWebSocket> socket1 = loadDocAndGetSocket(_uri, documentURL, "cancelTilesMultiView-1 ");
        std::shared_ptr<LOOLWebSocket> socket2 = loadDocAndGetSocket(_uri, documentURL, "cancelTilesMultiView-2 ", true);

        sendTextFrame(socket1, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840 tilewidth=3840 tileheight=3840", "cancelTilesMultiView-1 ");
        sendTextFrame(socket2, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,0 tileposy=0,0,0,22520 tilewidth=3840 tileheight=3840", "cancelTilesMultiView-2 ");

        sendTextFrame(socket1, "canceltiles");
        const auto res1 = getResponseString(socket1, "tile:", "cancelTilesMultiView-1 ", 500);
        if (!res1.empty())
        {
            if (j == repeat)
            {
                CPPUNIT_ASSERT_MESSAGE("Did not expect getting message [" + res1 + "].", res1.empty());
            }

            std::cerr << "Unexpected: [" << res1 << "]" << std::endl;
            continue;
        }

        for (int i = 0; i < 4; ++i)
        {
            getTileMessage(*socket2, "cancelTilesMultiView-2 ");
        }

        // Should never get more than 4 tiles on socket2.
        // Though in practice we get the rendering result from socket1's request and ours.
        // This happens because we currently always send back tiles even if they are of old version
        // because we want to be responsive, since we've rendered them anyway.
        const auto res2 = getResponseString(socket2, "tile:", "cancelTilesMultiView-2 ", 500);
        if (!res2.empty())
        {
            if (j == repeat)
            {
                CPPUNIT_ASSERT_MESSAGE("Did not expect getting message [" + res2 + "].", res1.empty());
            }

            std::cerr << "Unexpected: [" << res2 << "]" << std::endl;
            continue;
        }

        if (res1.empty() && res2.empty())
        {
            break;
        }
    }
}

void TileCacheTests::testDisconnectMultiView()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("setclientpart.ods", documentPath, documentURL, "disconnectMultiView ");

    const size_t repeat = 4;
    for (size_t j = 1; j <= repeat; ++j)
    {
        std::cerr << "disconnectMultiView try #" << j << std::endl;

        // Wait to clear previous sessions.
        countLoolKitProcesses(InitialLoolKitCount);

        // Request a huge tile, and cancel immediately.
        std::shared_ptr<LOOLWebSocket> socket1 = loadDocAndGetSocket(_uri, documentURL, "disconnectMultiView-1 ");
        std::shared_ptr<LOOLWebSocket> socket2 = loadDocAndGetSocket(_uri, documentURL, "disconnectMultiView-2 ", true);

        sendTextFrame(socket1, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840 tilewidth=3840 tileheight=3840", "cancelTilesMultiView-1 ");
        sendTextFrame(socket2, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,0 tileposy=0,0,0,22520 tilewidth=3840 tileheight=3840", "cancelTilesMultiView-2 ");

        socket1->shutdown();

        for (int i = 0; i < 4; ++i)
        {
            getTileMessage(*socket2, "disconnectMultiView-2 ");
        }

        // Should never get more than 4 tiles on socket2.
        getResponseString(socket2, "tile:", "disconnectMultiView-2 ", 500);
    }
}

void TileCacheTests::testUnresponsiveClient()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL, "unresponsiveClient ");

    std::cerr << "Connecting first client." << std::endl;
    std::shared_ptr<LOOLWebSocket> socket1 = loadDocAndGetSocket(_uri, documentURL, "unresponsiveClient-1 ");

    std::cerr << "Connecting second client." << std::endl;
    std::shared_ptr<LOOLWebSocket> socket2 = loadDocAndGetSocket(_uri, documentURL, "unresponsiveClient-2 ");

    // Pathologically request tiles and fail to read (say slow connection).
    // Meanwhile, verify that others can get all tiles fine.
    // TODO: Track memory consumption to verify we don't buffer too much.

    std::ostringstream oss;
    for (int i = 0; i < 1000; ++i)
    {
        oss << Util::encodeId(Util::rng::getNext(), 6);
    }

    const std::string documentContents = oss.str();
    for (int x = 0; x < 8; ++x)
    {
        // Invalidate to force re-rendering.
        sendTextFrame(socket2, "uno .uno:SelectAll");
        sendTextFrame(socket2, "uno .uno:Delete");
        assertResponseString(socket2, "invalidatetiles:", "client2 ");
        sendTextFrame(socket2, "paste mimetype=text/html\n" + documentContents);
        assertResponseString(socket2, "invalidatetiles:", "client2 ");

        // Ask for tiles and don't read!
        sendTextFrame(socket1, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840 tilewidth=3840 tileheight=3840");

        // Verify that we get all 8 tiles.
        sendTextFrame(socket2, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680,11520,0,3840,7680,11520 tileposy=0,0,0,0,3840,3840,3840,3840 tilewidth=3840 tileheight=3840");
        for (int i = 0; i < 8; ++i)
        {
            std::vector<char> tile = getResponseMessage(socket2, "tile:", "client2 ");
            CPPUNIT_ASSERT_MESSAGE("Did not receive tile #" + std::to_string(i+1) + " of 8: message as expected", !tile.empty());
        }
        /// Send canceltiles message to clear tiles-on-fly list, otherwise wsd waits for tileprocessed messages
        sendTextFrame(socket2, "canceltiles");
    }
}

void TileCacheTests::testImpressTiles()
{
    try
    {
        const std::string testName = "impressTiles ";
        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket("setclientpart.odp", _uri, testName);

        sendTextFrame(socket, "tile part=0 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 id=0", testName);
        getTileMessage(*socket, testName);
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
        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket("setclientpart.odp", _uri, testName);

        checkTiles(socket, "presentation", testName);

        socket->shutdown();
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
        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket("setclientpart.ods", _uri, testName);

        checkTiles(socket, "spreadsheet", testName);

        socket->shutdown();
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
}

void TileCacheTests::testTilesRenderedJustOnce()
{
    const char* testname = "tilesRenderdJustOnce ";

    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket("with_comment.odt", _uri, testname);

    assertResponseString(socket, "statechanged: .uno:AcceptTrackedChange=", testname);

    for (int i = 0; i < 10; ++i)
    {
        // Get initial rendercount.
        sendTextFrame(socket, "ping", testname);
        const auto ping1 = assertResponseString(socket, "pong", testname);
        int renderCount1 = 0;
        CPPUNIT_ASSERT(LOOLProtocol::getTokenIntegerFromMessage(ping1, "rendercount", renderCount1));
        CPPUNIT_ASSERT_EQUAL(i * 3, renderCount1);

        // Modify.
        sendText(socket, "a", testname);
        assertResponseString(socket, "invalidatetiles:", testname);

        // Get 3 tiles.
        sendTextFrame(socket, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840", testname);
        assertResponseString(socket, "tile:", testname);
        assertResponseString(socket, "tile:", testname);
        assertResponseString(socket, "tile:", testname);

        // Get new rendercount.
        sendTextFrame(socket, "ping", testname);
        const auto ping2 = assertResponseString(socket, "pong", testname);
        int renderCount2 = 0;
        CPPUNIT_ASSERT(LOOLProtocol::getTokenIntegerFromMessage(ping2, "rendercount", renderCount2));
        CPPUNIT_ASSERT_EQUAL((i+1) * 3, renderCount2);

        // Get same 3 tiles.
        sendTextFrame(socket, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840", testname);
        const auto tile1 = assertResponseString(socket, "tile:", testname);
        std::string renderId1;
        LOOLProtocol::getTokenStringFromMessage(tile1, "renderid", renderId1);
        CPPUNIT_ASSERT_EQUAL(std::string("cached"), renderId1);

        const auto tile2 = assertResponseString(socket, "tile:", testname);
        std::string renderId2;
        LOOLProtocol::getTokenStringFromMessage(tile2, "renderid", renderId2);
        CPPUNIT_ASSERT_EQUAL(std::string("cached"), renderId2);

        const auto tile3 = assertResponseString(socket, "tile:", testname);
        std::string renderId3;
        LOOLProtocol::getTokenStringFromMessage(tile3, "renderid", renderId3);
        CPPUNIT_ASSERT_EQUAL(std::string("cached"), renderId3);

        // Get new rendercount.
        sendTextFrame(socket, "ping", testname);
        const auto ping3 = assertResponseString(socket, "pong", testname);
        int renderCount3 = 0;
        CPPUNIT_ASSERT(LOOLProtocol::getTokenIntegerFromMessage(ping3, "rendercount", renderCount3));
        CPPUNIT_ASSERT_EQUAL(renderCount2, renderCount3);
    }
}

void TileCacheTests::testTilesRenderedJustOnceMultiClient()
{
    const std::string testname = "tilesRenderdJustOnceMultiClient";
    const auto testname1 = testname + "-1 ";
    const auto testname2 = testname + "-2 ";
    const auto testname3 = testname + "-3 ";
    const auto testname4 = testname + "-4 ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("with_comment.odt", documentPath, documentURL, testname);

    std::cerr << "Connecting first client." << std::endl;
    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname1);
    std::cerr << "Connecting second client." << std::endl;
    std::shared_ptr<LOOLWebSocket> socket2 = loadDocAndGetSocket(_uri, documentURL, testname2);
    std::cerr << "Connecting third client." << std::endl;
    std::shared_ptr<LOOLWebSocket> socket3 = loadDocAndGetSocket(_uri, documentURL, testname3);
    std::cerr << "Connecting fourth client." << std::endl;
    std::shared_ptr<LOOLWebSocket> socket4 = loadDocAndGetSocket(_uri, documentURL, "tilesRenderdJustOnce-4 ");

    for (int i = 0; i < 10; ++i)
    {
        // No tiles at this point.
        assertNotInResponse(socket, "tile:", testname1);
        assertNotInResponse(socket2, "tile:", testname2);
        assertNotInResponse(socket3, "tile:", testname3);
        assertNotInResponse(socket4, "tile:", testname4);

        // Get initial rendercount.
        sendTextFrame(socket, "ping", testname1);
        const auto ping1 = assertResponseString(socket, "pong", testname1);
        int renderCount1 = 0;
        CPPUNIT_ASSERT(LOOLProtocol::getTokenIntegerFromMessage(ping1, "rendercount", renderCount1));
        CPPUNIT_ASSERT_EQUAL(i * 3, renderCount1);

        // Modify.
        sendText(socket, "a", testname1);
        assertResponseString(socket, "invalidatetiles:", testname1);

        // Get 3 tiles.
        sendTextFrame(socket, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840", testname1);
        assertResponseString(socket, "tile:", testname1);
        assertResponseString(socket, "tile:", testname1);
        assertResponseString(socket, "tile:", testname1);

        assertResponseString(socket2, "invalidatetiles:", testname2);
        sendTextFrame(socket2, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840", testname2);
        assertResponseString(socket2, "tile:", testname2);
        assertResponseString(socket2, "tile:", testname2);
        assertResponseString(socket2, "tile:", testname2);

        assertResponseString(socket3, "invalidatetiles:", testname3);
        sendTextFrame(socket3, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840", testname3);
        assertResponseString(socket3, "tile:", testname3);
        assertResponseString(socket3, "tile:", testname3);
        assertResponseString(socket3, "tile:", testname3);

        assertResponseString(socket4, "invalidatetiles:", testname4);
        sendTextFrame(socket4, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840", testname4);
        assertResponseString(socket4, "tile:", testname4);
        assertResponseString(socket4, "tile:", testname4);
        assertResponseString(socket4, "tile:", testname4);

        // Get new rendercount.
        sendTextFrame(socket, "ping", testname1);
        const auto ping2 = assertResponseString(socket, "pong", testname1);
        int renderCount2 = 0;
        CPPUNIT_ASSERT(LOOLProtocol::getTokenIntegerFromMessage(ping2, "rendercount", renderCount2));
        CPPUNIT_ASSERT_EQUAL((i+1) * 3, renderCount2);

        // Get same 3 tiles.
        sendTextFrame(socket, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840", testname1);
        const auto tile1 = assertResponseString(socket, "tile:", testname1);
        std::string renderId1;
        LOOLProtocol::getTokenStringFromMessage(tile1, "renderid", renderId1);
        CPPUNIT_ASSERT_EQUAL(std::string("cached"), renderId1);

        const auto tile2 = assertResponseString(socket, "tile:", testname1);
        std::string renderId2;
        LOOLProtocol::getTokenStringFromMessage(tile2, "renderid", renderId2);
        CPPUNIT_ASSERT_EQUAL(std::string("cached"), renderId2);

        const auto tile3 = assertResponseString(socket, "tile:", testname1);
        std::string renderId3;
        LOOLProtocol::getTokenStringFromMessage(tile3, "renderid", renderId3);
        CPPUNIT_ASSERT_EQUAL(std::string("cached"), renderId3);

        // Get new rendercount.
        sendTextFrame(socket, "ping", testname1);
        const auto ping3 = assertResponseString(socket, "pong", testname1);
        int renderCount3 = 0;
        CPPUNIT_ASSERT(LOOLProtocol::getTokenIntegerFromMessage(ping3, "rendercount", renderCount3));
        CPPUNIT_ASSERT_EQUAL(renderCount2, renderCount3);
    }
}

void TileCacheTests::testSimultaneousTilesRenderedJustOnce()
{
    std::string documentPath, documentURL;
    getDocumentPathAndURL("hello.odt", documentPath, documentURL, "simultaneousTilesrenderedJustOnce ");

    std::cerr << "Connecting first client." << std::endl;
    std::shared_ptr<LOOLWebSocket> socket1 = loadDocAndGetSocket(_uri, documentURL, "simultaneousTilesRenderdJustOnce-1 ");
    std::cerr << "Connecting second client." << std::endl;
    std::shared_ptr<LOOLWebSocket> socket2 = loadDocAndGetSocket(_uri, documentURL, "simultaneousTilesRenderdJustOnce-2 ");

    // Wait for the invalidatetile events to pass, otherwise they
    // remove our tile subscription.
    assertResponseString(socket1, "statechanged:", "client1 ");
    assertResponseString(socket2, "statechanged:", "client2 ");

    sendTextFrame(socket1, "tile part=42 width=400 height=400 tileposx=1000 tileposy=2000 tilewidth=3000 tileheight=3000");
    sendTextFrame(socket2, "tile part=42 width=400 height=400 tileposx=1000 tileposy=2000 tilewidth=3000 tileheight=3000");

    const auto response1 = assertResponseString(socket1, "tile:", "client1 ");
    const auto response2 = assertResponseString(socket2, "tile:", "client2 ");

    if (!response1.empty() && !response2.empty())
    {
        std::string renderId1;
        LOOLProtocol::getTokenStringFromMessage(response1, "renderid", renderId1);
        std::string renderId2;
        LOOLProtocol::getTokenStringFromMessage(response2, "renderid", renderId2);

        CPPUNIT_ASSERT(renderId1 == renderId2 ||
                       (renderId1 == "cached" && renderId2 != "cached") ||
                       (renderId1 != "cached" && renderId2 == "cached"));
    }
}

void TileCacheTests::testLoad12ods()
{
    try
    {
        const char* testname = "load12ods ";
        std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket("load12.ods", _uri, testname);

        int docSheet = -1;
        int docSheets = 0;
        int docHeight = 0;
        int docWidth = 0;
        int docViewId = -1;

        // check document size
        sendTextFrame(socket, "status");

        const auto response = assertResponseString(socket, "status:", testname);
        parseDocSize(response.substr(7), "spreadsheet", docSheet, docSheets, docWidth, docHeight, docViewId);

        checkBlackTiles(socket, docSheet, docWidth, docWidth, testname);
    }
    catch (const Poco::Exception& exc)
    {
        CPPUNIT_FAIL(exc.displayText());
    }
    catch (...)
    {
        CPPUNIT_FAIL("Unexpected exception thrown during ods load");
    }
}

void TileCacheTests::checkBlackTile(std::stringstream& tile)
{
    png_uint_32 height = 0;
    png_uint_32 width = 0;
    png_uint_32 rowBytes = 0;

    std::vector<png_bytep> rows = Png::decodePNG(tile, height, width, rowBytes);

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

void TileCacheTests::checkBlackTiles(std::shared_ptr<LOOLWebSocket>& socket, const int /*part*/, const int /*docWidth*/, const int /*docHeight*/, const std::string& name)
{
    // Check the last row of tiles to verify that the tiles
    // render correctly and there are no black tiles.
    // Current cap of table size ends at 257280 twips (for load12.ods),
    // otherwise 2035200 should be rendered successfully.
    const char* req = "tile part=0 width=256 height=256 tileposx=0 tileposy=253440 tilewidth=3840 tileheight=3840";
    sendTextFrame(socket, req);

    const std::vector<char> tile = getResponseMessage(socket, "tile:", name);
    if (!tile.size())
    {
        CPPUNIT_FAIL("No tile returned to checkBlackTiles - failed load ?");
        return;
    }

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
    const char* testname = "tileInvalidateWriter ";
    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);

    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

    std::string text = "Test. Now go 3 \"Enters\":\n\n\nNow after the enters, goes this text";
    for (char ch : text)
    {
        sendChar(socket, ch, skNone, testname); // Send ordinary characters and wait for response -> one tile invalidation for each
        assertResponseString(socket, "invalidatetiles:", testname);
    }

    text = "\n\n\n";
    for (char ch : text)
    {
        sendChar(socket, ch, skCtrl, testname); // Send 3 Ctrl+Enter -> 3 new pages
        assertResponseString(socket, "invalidatetiles:", testname);
    }

    text = "abcde";
    for (char ch : text)
    {
        sendChar(socket, ch, skNone, testname);
        assertResponseString(socket, "invalidatetiles:", testname);
    }

    // While extra invalidates are not desirable, they are inevitable at the moment.
    //CPPUNIT_ASSERT_MESSAGE("received unexpected invalidatetiles: message", getResponseMessage(socket, "invalidatetiles:").empty());

    // TODO: implement a random-sequence "monkey test"
}

void TileCacheTests::testTileInvalidateWriterPage()
{
    const char* testname = "tileInvalidateWriterPage ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);

    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

    sendChar(socket, '\n', skCtrl, testname); // Send Ctrl+Enter (page break).
    assertResponseString(socket, "invalidatetiles:", testname);

    sendTextFrame(socket, "uno .uno:InsertTable { \"Columns\": { \"type\": \"long\",\"value\": 3 }, \"Rows\": { \"type\": \"long\",\"value\": 2 }}", testname);

    const auto res = assertResponseString(socket, "invalidatetiles:", testname);
    int part = -1;
    CPPUNIT_ASSERT_MESSAGE("No part# in invalidatetiles message.",
                           LOOLProtocol::getTokenIntegerFromMessage(res, "part", part));
    CPPUNIT_ASSERT_EQUAL(1, part);
}

// This isn't yet used
void TileCacheTests::testWriterAnyKey()
{
    const char* testname = "writerAnyKey ";
    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, documentURL);

    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // Now test "usual" keycodes (TODO: whole 32-bit range)
    for (int i=0; i<0x1000; ++i)
    {
        std::stringstream ss("Keycode ");
        ss << i;
        std::string s = ss.str();
        std::stringstream fn("saveas url=");
        fn << documentURL << i << ".odt format= options=";
        std::string f = fn.str();

        const int istart = 474;
        sendText(socket, "\n"+s+"\n", testname);
        sendKeyEvent(socket, "input", 0, i, testname);
        sendKeyEvent(socket, "up", 0, i, testname);
        sendText(socket, "\nEnd "+s+"\n", testname);
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Shift:\n", testname);
        sendKeyEvent(socket, "input", 0, i|skShift, testname);
        sendKeyEvent(socket, "up", 0, i|skShift, testname);
        sendText(socket, "\nEnd "+s+" With Shift\n", testname);
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Ctrl:\n", testname);
        sendKeyEvent(socket, "input", 0, i|skCtrl, testname);
        sendKeyEvent(socket, "up", 0, i|skCtrl, testname);
        sendText(socket, "\nEnd "+s+" With Ctrl\n", testname);
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Alt:\n", testname);
        sendKeyEvent(socket, "input", 0, i|skAlt, testname);
        sendKeyEvent(socket, "up", 0, i|skAlt, testname);
        sendText(socket, "\nEnd "+s+" With Alt\n", testname);
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Shift+Ctrl:\n", testname);
        sendKeyEvent(socket, "input", 0, i|skShift|skCtrl, testname);
        sendKeyEvent(socket, "up", 0, i|skShift|skCtrl, testname);
        sendText(socket, "\nEnd "+s+" With Shift+Ctrl\n", testname);
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Shift+Alt:\n", testname);
        sendKeyEvent(socket, "input", 0, i|skShift|skAlt, testname);
        sendKeyEvent(socket, "up", 0, i|skShift|skAlt, testname);
        sendText(socket, "\nEnd "+s+" With Shift+Alt\n", testname);
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Ctrl+Alt:\n", testname);
        sendKeyEvent(socket, "input", 0, i|skCtrl|skAlt, testname);
        sendKeyEvent(socket, "up", 0, i|skCtrl|skAlt, testname);
        sendText(socket, "\nEnd "+s+" With Ctrl+Alt\n", testname);
        if (i>=istart)
            sendTextFrame(socket, f);

        sendText(socket, "\n"+s+" With Shift+Ctrl+Alt:\n", testname);
        sendKeyEvent(socket, "input", 0, i|skShift|skCtrl|skAlt, testname);
        sendKeyEvent(socket, "up", 0, i|skShift|skCtrl|skAlt, testname);
        sendText(socket, "\nEnd "+s+" With Shift+Ctrl+Alt\n", testname);

        if (i>=istart)
            sendTextFrame(socket, f);

        // This is to allow server to process the input, and check that everything is still OK
        sendTextFrame(socket, "status", testname);
        getResponseMessage(socket, "status:", testname);
    }
    //    sendTextFrame(socket, "saveas url=file:///tmp/emptyempty.odt format= options=");
}

void TileCacheTests::testTileInvalidateCalc()
{
    const std::string testname = "tileInvalidateCalc ";
    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket("empty.ods", _uri, testname);

    std::string text = "Test. Now go 3 \"Enters\": Now after the enters, goes this text";
    for (char ch : text)
    {
        sendChar(socket, ch, skNone, testname); // Send ordinary characters -> one tile invalidation for each
        assertResponseString(socket, "invalidatetiles:", testname);
    }

    std::cerr << "Sending enters" << std::endl;
    text = "\n\n\n";
    for (char ch : text)
    {
        sendChar(socket, ch, skCtrl, testname); // Send 3 Ctrl+Enter -> 3 new pages; I see 3 tiles invalidated for each
        assertResponseString(socket, "invalidatetiles:", testname);
    }

    text = "abcde";
    for (char ch : text)
    {
        sendChar(socket, ch, skNone, testname);
        assertResponseString(socket, "invalidatetiles:", testname);
    }
}

void TileCacheTests::testTileInvalidatePartCalc()
{
    const std::string filename = "setclientpart.ods";
    const std::string testname = "tileInvalidatePartCalc";
    const std::string testname1 = testname + "-1 ";
    const std::string testname2 = testname + "-2 ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL(filename, documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket1 = loadDocAndGetSocket(_uri, documentURL, testname1);

    sendTextFrame(socket1, "setclientpart part=2", testname1);
    assertResponseString(socket1, "setpart:", testname1);
    sendTextFrame(socket1, "mouse type=buttondown x=1500 y=1500 count=1 buttons=1 modifier=0", testname1);

    std::shared_ptr<LOOLWebSocket> socket2 = loadDocAndGetSocket(_uri, documentURL, testname2);
    sendTextFrame(socket2, "setclientpart part=5", testname2);
    assertResponseString(socket2, "setpart:", testname2);
    sendTextFrame(socket2, "mouse type=buttondown x=1500 y=1500 count=1 buttons=1 modifier=0", testname2);

    static const std::string text = "Some test";
    for (char ch : text)
    {
        sendChar(socket1, ch, skNone, testname);
        sendChar(socket2, ch, skNone, testname);

        const auto response1 = assertResponseString(socket1, "invalidatetiles:", testname1);
        int value1;
        LOOLProtocol::getTokenIntegerFromMessage(response1, "part", value1);
        CPPUNIT_ASSERT_EQUAL(2, value1);

        const auto response2 = assertResponseString(socket2, "invalidatetiles:", testname2);
        int value2;
        LOOLProtocol::getTokenIntegerFromMessage(response2, "part", value2);
        CPPUNIT_ASSERT_EQUAL(5, value2);
    }
}

void TileCacheTests::testTileInvalidatePartImpress()
{
    const std::string filename = "setclientpart.odp";
    const std::string testname = "tileInvalidatePartImpress";
    const std::string testname1 = testname + "-1 ";
    const std::string testname2 = testname + "-2 ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL(filename, documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket1 = loadDocAndGetSocket(_uri, documentURL, testname1);

    sendTextFrame(socket1, "setclientpart part=2", testname1);
    assertResponseString(socket1, "setpart:", testname1);
    sendTextFrame(socket1, "mouse type=buttondown x=1500 y=1500 count=1 buttons=1 modifier=0", testname1);

    std::shared_ptr<LOOLWebSocket> socket2 = loadDocAndGetSocket(_uri, documentURL, testname2);
    sendTextFrame(socket2, "setclientpart part=5", testname2);
    assertResponseString(socket2, "setpart:", testname2);
    sendTextFrame(socket2, "mouse type=buttondown x=1500 y=1500 count=1 buttons=1 modifier=0", testname2);

    // This should be short, as in odp the font is large and we leave the page otherwise.
    static const std::string text = "Some test";
    for (char ch : text)
    {
        sendChar(socket1, ch, skNone, testname);
        sendChar(socket2, ch, skNone, testname);

        const auto response1 = assertResponseString(socket1, "invalidatetiles:", testname1);
        int value1;
        LOOLProtocol::getTokenIntegerFromMessage(response1, "part", value1);
        CPPUNIT_ASSERT_EQUAL(2, value1);

        const auto response2 = assertResponseString(socket2, "invalidatetiles:", testname2);
        int value2;
        LOOLProtocol::getTokenIntegerFromMessage(response2, "part", value2);
        CPPUNIT_ASSERT_EQUAL(5, value2);
    }
}

void TileCacheTests::checkTiles(std::shared_ptr<LOOLWebSocket>& socket, const std::string& docType, const std::string& name)
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

    // check total slides 10
    sendTextFrame(socket, "status", name);
    const auto response = assertResponseString(socket, "status:", name);
    {
        std::string line;
        std::istringstream istr(response.substr(8));
        std::getline(istr, line);

        Poco::StringTokenizer tokens(line, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(6), tokens.count());

        // Expected format is something like 'type= parts= current= width= height='.
        const std::string text = tokens[0].substr(type.size());
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
        std::cerr << "Requesting Impress tiles." << std::endl;
        requestTiles(socket, currentPart, docWidth, docHeight, name);
    }

    // random setclientpart
    std::srand(std::time(nullptr));
    std::vector<int> vParts = { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 };
    std::random_shuffle(vParts.begin(), vParts.end());
    int requests = 0;
    for (int it : vParts)
    {
        if (currentPart != it)
        {
            // change part
            const std::string text = Poco::format("setclientpart part=%d", it);
            sendTextFrame(socket, text, name);
            // Wait for the change to take effect otherwise we get invalidatetile
            // which removes our next tile request subscription (expecting us to
            // issue a new tile request as a response, which a real client would do).
            assertResponseString(socket, "setpart:", name);

            requestTiles(socket, it, docWidth, docHeight, name);

            if (++requests >= 3)
            {
                // No need to test all parts.
                break;
            }
        }

        currentPart = it;
    }
}

void TileCacheTests::requestTiles(std::shared_ptr<LOOLWebSocket>& socket, const int part, const int docWidth, const int docHeight, const std::string& name)
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

            sendTextFrame(socket, text, name);
            tile = assertResponseString(socket, "tile:", name);
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

void TileCacheTests::testTileRequestByInvalidation()
{
    const char* testname = "tileRequestByInvalidation ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // 1. use case: invalidation without having a valid visible area in wsd
    // Type one character to trigger invalidation
    sendChar(socket, 'x', skNone, testname);

    // First wsd forwards the invalidation
    assertResponseString(socket, "invalidatetiles:", testname);

    // Since we did not set client visible area wsd won't send tile
    std::vector<char> tile = getResponseMessage(socket, "tile:", testname);
    CPPUNIT_ASSERT_MESSAGE("Not expected tile message arrived!", tile.empty());

    // 2. use case: invalidation of one tile inside the client visible area
    // Now set the client visible area
    sendTextFrame(socket, "clientvisiblearea x=-4005 y=0 width=50490 height=72300");
    sendTextFrame(socket, "clientzoom tilepixelwidth=256 tilepixelheight=256 tiletwipwidth=3840 tiletwipheight=3840");

    // Type one character to trigger invalidation
    sendChar(socket, 'x', skNone, testname);

    // First wsd forwards the invalidation
    assertResponseString(socket, "invalidatetiles:", testname);

    // Then sends the new tile which was invalidated inside the visible area
    assertResponseString(socket, "tile:", testname);
}

void TileCacheTests::testTileRequestByZoom()
{
    // By zoom the client requests all the tile of the visible area
    // Server should push all these tiles to the network, so tiles-on-fly should be bigger than this count

    const char* testname = "testTileRequestByZoom ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // Set the client visible area
    sendTextFrame(socket, "clientvisiblearea x=-2662 y=0 width=16000 height=9875");
    sendTextFrame(socket, "clientzoom tilepixelwidth=256 tilepixelheight=256 tiletwipwidth=3200 tiletwipheight=3200");

    // Request all tile of the visible area (it happens by zoom)
    sendTextFrame(socket, "tilecombine part=0 width=256 height=256 tileposx=0,3200,6400,9600,12800,0,3200,6400,9600,12800,0,3200,6400,9600,12800,0,3200,6400,9600,12800 tileposy=0,0,0,0,0,3200,3200,3200,3200,3200,6400,6400,6400,6400,6400,9600,9600,9600,9600,9600 tilewidth=3200 tileheight=3200");

    // Check that we get all the tiles without we send back the tileprocessed message
    for (int i = 0; i < 20; ++i)
    {
        std::vector<char> tile = getResponseMessage(socket, "tile:", testname);
        CPPUNIT_ASSERT_MESSAGE("Did not get tile as expected!", !tile.empty());
    }
}

void TileCacheTests::testTileWireIDHandling()
{
    const char* testname = "testTileWireIDHandling ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // Set the client visible area
    sendTextFrame(socket, "clientvisiblearea x=-4005 y=0 width=50490 height=72300");
    sendTextFrame(socket, "clientzoom tilepixelwidth=256 tilepixelheight=256 tiletwipwidth=3840 tiletwipheight=3840");

    // Type one character to trigger invalidation
    sendChar(socket, 'x', skNone, testname);

    // First wsd forwards the invalidation
    assertResponseString(socket, "invalidatetiles:", testname);

    // For the first input wsd will send all invalidated tiles
    int arrivedTiles = 0;
    bool gotTile = false;
    do
    {
        std::vector<char> tile = getResponseMessage(socket, "tile:", testname);
        gotTile = !tile.empty();
        if(gotTile)
            ++arrivedTiles;
    } while(gotTile);

    CPPUNIT_ASSERT_MESSAGE("We expect two tiles at least!", arrivedTiles > 1);

    // Type an other character
    sendChar(socket, 'x', skNone, testname);
    assertResponseString(socket, "invalidatetiles:", testname);

    // For the second input wsd will send one tile, since some of them are indentical
    arrivedTiles = 0;
    gotTile = false;
    do
    {
        std::vector<char> tile = getResponseMessage(socket, "tile:", testname);
        gotTile = !tile.empty();
        if(gotTile)
            ++arrivedTiles;
    } while(gotTile);

    CPPUNIT_ASSERT_EQUAL(1, arrivedTiles);
}

void TileCacheTests::testTileProcessed()
{
    // Test whether tileprocessed message removes the tiles from the internal tiles-on-fly list
    const char* testname = "testTileProcessed ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // Set the client visible area
    sendTextFrame(socket, "clientvisiblearea x=-2662 y=0 width=10000 height=9000");
    sendTextFrame(socket, "clientzoom tilepixelwidth=256 tilepixelheight=256 tiletwipwidth=3200 tiletwipheight=3200");

    // Request a lots of tiles (more than wsd can send once)
    sendTextFrame(socket, "tilecombine part=0 width=256 height=256 tileposx=0,3200,6400,9600,12800,0,3200,6400,9600,12800,0,3200,6400,9600,12800,0,3200,6400,9600,12800,0,3200,6400,9600,12800 tileposy=0,0,0,0,0,3200,3200,3200,3200,3200,6400,6400,6400,6400,6400,9600,9600,9600,9600,9600,12800,12800,12800,12800,12800 tilewidth=3200 tileheight=3200");

    std::vector<std::string> tileIDs;
    int arrivedTile = 0;
    bool gotTile = false;
    do
    {
        std::string tile = getResponseString(socket, "tile:", testname);
        gotTile = !tile.empty();
        if(gotTile)
        {
            ++arrivedTile;

            // Store tileID, so we can send it back
            Poco::StringTokenizer tokens(tile, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
            std::string tileID = tokens[1].substr(std::string("part=").size()) + ":" +
                                 tokens[4].substr(std::string("tileposx=").size()) + ":" +
                                 tokens[5].substr(std::string("tileposy=").size()) + ":" +
                                 tokens[6].substr(std::string("tileWidth=").size()) + ":" +
                                 tokens[7].substr(std::string("tileHeight=").size());
            tileIDs.push_back(tileID);
        }

    } while(gotTile);

    CPPUNIT_ASSERT_MESSAGE("We expect two tiles at least!", arrivedTile > 1);
    CPPUNIT_ASSERT_MESSAGE("We expect that wsd can't send all the tiles!", arrivedTile < 25);

    for(std::string& tileID : tileIDs)
    {
        sendTextFrame(socket, "tileprocessed tile=" + tileID);
    }

    // Now we can get the remaining tiles
    int arrivedTile2 = 0;
    gotTile = false;
    do
    {
        std::vector<char> tile = getResponseMessage(socket, "tile:", testname);
        gotTile = !tile.empty();
        if(gotTile)
            ++arrivedTile2;

    } while(gotTile);

    CPPUNIT_ASSERT_MESSAGE("We expect one tile at least!", arrivedTile2 > 1);
}

void TileCacheTests::testTileInvalidatedOutside()
{
    // Test whether wsd sends us the tiles which are hanging out the visible area
    const char* testname = "testTileInvalidatedOutside ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // Type one character to trigger invalidation and get the invalidation rectangle
    sendChar(socket, 'x', skNone, testname);

    // First wsd forwards the invalidation
    std::string sInvalidate = assertResponseString(socket, "invalidatetiles:", testname);
    Poco::StringTokenizer tokens(sInvalidate, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
    int y = std::stoi(tokens[3].substr(std::string("y=").size()));
    int height = std::stoi(tokens[5].substr(std::string("height=").size()));


    // Set client visible area to make it not having intersection with the invalidate rectangle, but having shared tiles
    std::ostringstream oss;
    oss << "clientvisiblearea x=0 y=" << (y + height + 100) << " width=50490 height=72300";
    sendTextFrame(socket, oss.str());
    sendTextFrame(socket, "clientzoom tilepixelwidth=256 tilepixelheight=256 tiletwipwidth=3840 tiletwipheight=3840");

    // Type one character to trigger invalidation
    sendChar(socket, 'x', skNone, testname);

    // First wsd forwards the invalidation
    assertResponseString(socket, "invalidatetiles:", testname);

    // Since the invalidation rectangle is outside the visible area
    // wsd does not send a new tile even if some of the invalidated tiles
    // are partly visible.
    std::vector<char> tile = getResponseMessage(socket, "tile:", testname);
    CPPUNIT_ASSERT_MESSAGE("Not expected tile message arrived!", tile.empty());
}

void TileCacheTests::testTileBeingRenderedHandling()
{
    // The issue here was that we requested the tile of the same tile twice
    // and so sometimes we got the same tile message twice from wsd.
    const char* testname = "testTileBeingRenderedHandling ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // Set the client visible area
    sendTextFrame(socket, "clientvisiblearea x=-2662 y=0 width=16000 height=9875");
    sendTextFrame(socket, "clientzoom tilepixelwidth=256 tilepixelheight=256 tiletwipwidth=3200 tiletwipheight=3200");

    // Type one character to trigger invalidation
    sendChar(socket, 'x', skNone, testname);

    // First wsd forwards the invalidation
    assertResponseString(socket, "invalidatetiles:", testname);

    // For the first input wsd will send all invalidated tiles
    int arrivedTiles = 0;
    bool gotTile = false;
    do
    {
        std::vector<char> tile = getResponseMessage(socket, "tile:", testname);
        gotTile = !tile.empty();
        if(gotTile)
            ++arrivedTiles;
    } while(gotTile);

    CPPUNIT_ASSERT_MESSAGE("We expect two tiles at least!", arrivedTiles > 1);

    // For the later inputs wsd will send one tile, since other ones are indentical
    for(int i = 0; i < 5; ++i)
    {
        // Type an other character
        sendChar(socket, 'x', skNone, testname);
        assertResponseString(socket, "invalidatetiles:", testname);

        arrivedTiles = 0;
        gotTile = false;
        do
        {
            std::vector<char> tile = getResponseMessage(socket, "tile:", testname, 500);
            gotTile = !tile.empty();
            if(gotTile)
                ++arrivedTiles;
        } while(gotTile);

        CPPUNIT_ASSERT_EQUAL(1, arrivedTiles);

        sendTextFrame(socket, "tileprocessed tile=0:0:0:3200:3200");
    }
}

void TileCacheTests::testWireIDFilteringOnWSDSide()
{
    const char* testname = "testWireIDFilteringOnWSDSide ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket1 = loadDocAndGetSocket(_uri, documentURL, testname);
    // Set the client visible area
    sendTextFrame(socket1, "clientvisiblearea x=-4005 y=0 width=50490 height=72300");
    sendTextFrame(socket1, "clientzoom tilepixelwidth=256 tilepixelheight=256 tiletwipwidth=3840 tiletwipheight=3840");

    std::shared_ptr<LOOLWebSocket> socket2 = loadDocAndGetSocket(_uri, documentURL, testname, true);
    // Set the client visible area
    sendTextFrame(socket1, "clientvisiblearea x=-4005 y=0 width=50490 height=72300");
    sendTextFrame(socket1, "clientzoom tilepixelwidth=256 tilepixelheight=256 tiletwipwidth=3840 tiletwipheight=3840");

    //1. First make the first client to trigger the kit to filter out tiles based on identical wireIDs

    // Type one character to trigger invalidation
    sendChar(socket1, 'x', skNone, testname);

    // First wsd forwards the invalidation
    assertResponseString(socket1, "invalidatetiles:", testname);

    // For the first input wsd will send all invalidated tiles
    int arrivedTiles = 0;
    bool gotTile = false;
    do
    {
        std::vector<char> tile = getResponseMessage(socket1, "tile:", testname, 5000);
        gotTile = !tile.empty();
        if(gotTile)
            ++arrivedTiles;
    } while(gotTile);

    CPPUNIT_ASSERT_MESSAGE("We expect two tiles at least!", arrivedTiles > 1);

    // Type an other character
    sendChar(socket1, 'x', skNone, testname);
    assertResponseString(socket1, "invalidatetiles:", testname);

    // For the second input wsd will send one tile, since other tiles are indentical
    arrivedTiles = 0;
    gotTile = false;
    do
    {
        std::vector<char> tile = getResponseMessage(socket1, "tile:", testname, 1000);
        gotTile = !tile.empty();
        if(gotTile)
            ++arrivedTiles;
    } while(gotTile);

    CPPUNIT_ASSERT_EQUAL(1, arrivedTiles);

    //2. Now request the same tiles by the other client (e.g. scroll to the same view)

    sendTextFrame(socket2, "tilecombine part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840");

    // We expect three tiles sent to the second client
    arrivedTiles = 0;
    gotTile = false;
    do
    {
        std::vector<char> tile = getResponseMessage(socket2, "tile:", testname, 1000);
        gotTile = !tile.empty();
        if(gotTile)
            ++arrivedTiles;
    } while(gotTile);

    CPPUNIT_ASSERT_EQUAL(3, arrivedTiles);

    // wsd should not send tiles messages for the first client
    std::vector<char> tile = getResponseMessage(socket1, "tile:", testname, 1000);
    CPPUNIT_ASSERT_MESSAGE("Not expected tile message arrived!", tile.empty());
}

void TileCacheTests::testLimitTileVersionsOnFly()
{
    // We have an upper limit (2) for the versions of the same tile wsd send out
    // without getting the tileprocessed message for the first tile message.
    const char* testname = "testLimitTileVersionsOnFly ";

    std::string documentPath, documentURL;
    getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    std::shared_ptr<LOOLWebSocket> socket = loadDocAndGetSocket(_uri, documentURL, testname);

    // Set the client visible area
    sendTextFrame(socket, "clientvisiblearea x=-2662 y=0 width=16000 height=9875");
    sendTextFrame(socket, "clientzoom tilepixelwidth=256 tilepixelheight=256 tiletwipwidth=3200 tiletwipheight=3200");

    // Type one character to trigger sending tiles
    sendChar(socket, 'x', skNone, testname);

    // Handle all tiles send by wsd
    bool getTileResp = false;
    do
    {
        std::string tile = getResponseString(socket, "tile:", testname, 1000);
        getTileResp = !tile.empty();
    } while(getTileResp);

    // Type an other character to trigger sending tiles
    sendChar(socket, 'x', skNone, testname);

    // Handle all tiles sent by wsd
    getTileResp = false;
    do
    {
        std::string tile = getResponseString(socket, "tile:", testname, 1000);
        getTileResp = !tile.empty();
    } while(getTileResp);

    // For the third invalidation wsd does not send the new tile since
    // two versions of the same tile were already sent.
    sendChar(socket, 'x', skNone, testname);

    std::vector<char> tile1 = getResponseMessage(socket, "tile:", testname, 1000);
    CPPUNIT_ASSERT_MESSAGE("Not expected tile message arrived!", tile1.empty());

    // When the next tileprocessed message arrive with correct tileID
    // wsd sends the delayed tile
    sendTextFrame(socket, "tileprocessed tile=0:0:0:3200:3200");

    int arrivedTiles = 0;
    bool gotTile = false;
    do
    {
        std::vector<char> tile = getResponseMessage(socket, "tile:", testname, 1000);
        gotTile = !tile.empty();
        if(gotTile)
            ++arrivedTiles;
    } while(gotTile);

    CPPUNIT_ASSERT_EQUAL(1, arrivedTiles);
}

CPPUNIT_TEST_SUITE_REGISTRATION(TileCacheTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
