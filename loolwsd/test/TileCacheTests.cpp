/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <cppunit/extensions/HelperMacros.h>

#include <TileCache.hpp>
#include "Unit.hpp"
#include "Util.hpp"

/// TileCache unit-tests.
class TileCacheTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(TileCacheTests);

    CPPUNIT_TEST(test);

    CPPUNIT_TEST_SUITE_END();

    void test();

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
    {
        if (!UnitWSD::init(UnitWSD::UnitType::TYPE_WSD, ""))
        {
            throw std::runtime_error("Failed to load wsd unit test library.");
        }
    }
};

void TileCacheTests::test()
{
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

CPPUNIT_TEST_SUITE_REGISTRATION(TileCacheTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
