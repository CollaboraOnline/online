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
                     const std::vector<char> &b);
};

// Quick hack for debugging
std::vector<char> DeltaTests::applyDelta(
    const std::vector<char> &pixmap,
    png_uint_32 /* width */, png_uint_32 /* height */,
    const std::vector<char> &delta)
{
    CPPUNIT_ASSERT(delta.size() >= 4);
    CPPUNIT_ASSERT(delta[0] == 'D');

//    std::cout << "apply delta of size " << delta.size() << "\n";

    std::vector<char> output = pixmap;
    CPPUNIT_ASSERT_EQUAL(output.size(), pixmap.size());
    size_t offset = 0;
    for (size_t i = 1; i < delta.size() &&
             offset < output.size();)
    {
        bool isChangedRun = delta[i++] & 64;
        CPPUNIT_ASSERT(i < delta.size());
        uint32_t span = (unsigned char)delta[i++];
        CPPUNIT_ASSERT(i < delta.size());
        span += ((unsigned char)delta[i++])*256;
        CPPUNIT_ASSERT(i < delta.size() ||
                       (i == delta.size() && !isChangedRun));
        span *= 4;
//        std::cout << "span " << span << " offset " << offset << "\n";
        if (isChangedRun)
        {
            CPPUNIT_ASSERT(offset + span <= output.size());
            memcpy(&output[offset], &delta[i], span);
            i += span;
        }
        offset += span;
    }
    CPPUNIT_ASSERT_EQUAL(pixmap.size(), output.size());
    CPPUNIT_ASSERT_EQUAL(output.size(), offset);
    return output;
}

void DeltaTests::assertEqual(const std::vector<char> &a,
                             const std::vector<char> &b)
{
    CPPUNIT_ASSERT_EQUAL(a.size(), b.size());
    for (size_t i = 0; i < a.size(); ++i)
    {
        if (a[i] != b[i])
        {
            std::cout << "Differences starting at byte " << i;
            size_t len;
            for (len = 0; a[i+len] != b[i+len] && i + len < a.size(); ++len)
            {
                std::cout << std::hex << (int)((unsigned char)a[i+len]) << " ";
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
    assertEqual(reText2, text2);

    // Build a delta between text & text2Wid
    std::vector<char> two2one;
    CPPUNIT_ASSERT(gen.createDelta(
                       reinterpret_cast<unsigned char *>(&text[0]),
                       0, 0, width, height, width, height,
                       two2one, textWid, text2Wid) == true);
    CPPUNIT_ASSERT(two2one.size() > 0);

    // Apply it to get back to where we started
    std::vector<char> reText = applyDelta(text2, width, height, two2one);
    assertEqual(reText, text);
}

void DeltaTests::testRandomDeltas()
{
}

CPPUNIT_TEST_SUITE_REGISTRATION(DeltaTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
