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

#include "Delta.hpp"
#include "Util.hpp"
#include "Png.hpp"
#include "helpers.hpp"

/// Delta unit-tests.
class DeltaTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(DeltaTests);

    CPPUNIT_TEST(testDeltaSequence);
    CPPUNIT_TEST(testRandomDeltas);

    CPPUNIT_TEST_SUITE_END();

    void testDeltaSequence();
    void testRandomDeltas();

    std::vector<char> loadPng(const char *relpath,
                              png_uint_32& height,
                              png_uint_32& width,
                              png_uint_32& rowBytes)
    {
        std::ifstream file(relpath);
        std::stringstream buffer;
        buffer << file.rdbuf();
        file.close();
        std::vector<png_bytep> rows =
            Png::decodePNG(buffer, height, width, rowBytes);
        std::vector<char> output;
        for (png_uint_32 y = 0; y < height; ++y)
        {
            for (png_uint_32 i = 0; i < width * 4; ++i)
            {
                output.push_back(rows[y][i]);
            }
        }
        return output;
    }

    std::vector<char> applyDelta(
        const std::vector<char> &pixmap,
        png_uint_32 width, png_uint_32 height,
        const std::vector<char> &delta);

    void assertEqual(const std::vector<char> &a,
                     const std::vector<char> &b,
                     int width, int height);
};

// Quick hack for debugging
std::vector<char> DeltaTests::applyDelta(
    const std::vector<char> &pixmap,
    png_uint_32 width, png_uint_32 height,
    const std::vector<char> &delta)
{
    CPPUNIT_ASSERT(delta.size() >= 4);
    CPPUNIT_ASSERT(delta[0] == 'D');

    std::cout << "apply delta of size " << delta.size() << "\n";

    // start with the same state.
    std::vector<char> output = pixmap;
    CPPUNIT_ASSERT_EQUAL(output.size(), size_t(pixmap.size()));
    CPPUNIT_ASSERT_EQUAL(output.size(), size_t(width * height * 4));

    size_t offset = 0, i;
    for (i = 1; i < delta.size() && offset < output.size();)
    {
        switch (delta[i])
        {
        case 'c': // copy row.
        {
            int srcRow = (uint8_t)(delta[i+1]);
            int destRow = (uint8_t)(delta[i+2]);

            std::cout << "copy row " << srcRow << " to " << destRow << "\n";
            const char *src = &pixmap[width * srcRow * 4];
            char *dest = &output[width * destRow * 4];
            for (size_t j = 0; j < width * 4; ++j)
                *dest++ = *src++;
            i += 3;
            break;
        }
        case 'd': // new run
        {
            int destRow = (uint8_t)(delta[i+1]);
            int destCol = (uint8_t)(delta[i+2]);
            size_t length = (uint8_t)(delta[i+3]);
            i += 4;

            std::cout << "new " << length << " at " << destCol << ", " << destRow << "\n";
            CPPUNIT_ASSERT(length <= width - destCol);

            char *dest = &output[width * destRow * 4 + destCol * 4];
            for (size_t j = 0; j < length * 4 && i < delta.size(); ++j)
                *dest++ = delta[i++];
            break;
        }
        default:
            std::cout << "Unknown delta code " << delta[i] << "\n";
            CPPUNIT_ASSERT(false);
            break;
        }
    }
    CPPUNIT_ASSERT_EQUAL(delta.size(), i);
    return output;
}

void DeltaTests::assertEqual(const std::vector<char> &a,
                             const std::vector<char> &b,
                             int width, int /* height */)
{
    CPPUNIT_ASSERT_EQUAL(a.size(), b.size());
    for (size_t i = 0; i < a.size(); ++i)
    {
        if (a[i] != b[i])
        {
            std::cout << "Differences starting at byte " << i << " "
                      << (i/4 % width) << ", " << (i / (width * 4)) << ":\n";
            size_t len;
            for (len = 0; (a[i+len] != b[i+len] || len < 8) && i + len < a.size(); ++len)
            {
                std::cout << std::hex << (int)((unsigned char)a[i+len]) << " != ";
                std::cout << std::hex << (int)((unsigned char)b[i+len]) << "  ";
                if (len > 0 && (len % 16 == 0))
                    std::cout<< "\n";
            }
            std::cout << " size " << len << "\n";
            CPPUNIT_ASSERT(false);
        }
    }
}

void DeltaTests::testDeltaSequence()
{
    DeltaGenerator gen;

    png_uint_32 height, width, rowBytes;
    const TileWireId textWid = 1;
    std::vector<char> text =
        DeltaTests::loadPng("data/delta-text.png",
                            height, width, rowBytes);
    CPPUNIT_ASSERT(height == 256 && width == 256 && rowBytes == 256*4);
    CPPUNIT_ASSERT_EQUAL(size_t(256 * 256 * 4), text.size());

    const TileWireId text2Wid = 2;
    std::vector<char> text2 =
        DeltaTests::loadPng("data/delta-text2.png",
                            height, width, rowBytes);
    CPPUNIT_ASSERT(height == 256 && width == 256 && rowBytes == 256*4);
    CPPUNIT_ASSERT_EQUAL(size_t(256 * 256 * 4), text2.size());

    std::vector<char> delta;
    // Stash it in the cache
    CPPUNIT_ASSERT(gen.createDelta(
                       reinterpret_cast<unsigned char *>(&text[0]),
                       0, 0, width, height, width, height,
                       delta, textWid, 0) == false);
    CPPUNIT_ASSERT(delta.size() == 0);

    // Build a delta between text2 & textWid
    CPPUNIT_ASSERT(gen.createDelta(
                       reinterpret_cast<unsigned char *>(&text2[0]),
                       0, 0, width, height, width, height,
                       delta, text2Wid, textWid) == true);
    CPPUNIT_ASSERT(delta.size() > 0);

    // Apply it to move to the second frame
    std::vector<char> reText2 = applyDelta(text, width, height, delta);
    assertEqual(reText2, text2, width, height);

    // Build a delta between text & text2Wid
    std::vector<char> two2one;
    CPPUNIT_ASSERT(gen.createDelta(
                       reinterpret_cast<unsigned char *>(&text[0]),
                       0, 0, width, height, width, height,
                       two2one, textWid, text2Wid) == true);
    CPPUNIT_ASSERT(two2one.size() > 0);

    // Apply it to get back to where we started
    std::vector<char> reText = applyDelta(text2, width, height, two2one);
    assertEqual(reText, text, width, height);
}

void DeltaTests::testRandomDeltas()
{
}

CPPUNIT_TEST_SUITE_REGISTRATION(DeltaTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
