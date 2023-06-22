/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <test/lokassert.hpp>

#include <Delta.hpp>
#include <Util.hpp>
#include <Png.hpp>

#include <cppunit/extensions/HelperMacros.h>

#define DEBUG_DELTA_TESTS 0

/// Delta unit-tests.
class DeltaTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(DeltaTests);

#if ENABLE_DELTAS
    CPPUNIT_TEST(testRle);
    CPPUNIT_TEST(testRleComplex);
    CPPUNIT_TEST(testRleIdentical);
    CPPUNIT_TEST(testDeltaSequence);
    CPPUNIT_TEST(testRandomDeltas);
    CPPUNIT_TEST(testDeltaCopyOutOfBounds);
#endif

    CPPUNIT_TEST_SUITE_END();

    void testRle();
    void testRleComplex();
    void testRleIdentical();
    void testDeltaSequence();
    void testRandomDeltas();
    void testDeltaCopyOutOfBounds();

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
        const std::vector<char> &delta,
        const std::string& testname);

    void assertEqual(const std::vector<char> &a,
                     const std::vector<char> &b,
                     int width, int height,
                     const std::string& testname);
};

namespace {
void checkzDelta(const std::vector<char> &zDelta, const char *legend)
{
    constexpr auto testname = __func__;

#if DEBUG_DELTA_TESTS
    std::cout << "zdelta: " << legend << "\n";
    Util::dumpHex(std::cout, zDelta, "");
#else
    (void)legend;
#endif

    LOK_ASSERT(zDelta.size() >= 4);
    LOK_ASSERT(zDelta[0] == 'D');

    std::vector<char> delta;
    delta.resize(1024*1024*4); // lots of extra space.

    size_t compSize = ZSTD_decompress( delta.data(), delta.size(),
                                       zDelta.data() + 1, zDelta.size() - 1);
    LOK_ASSERT_EQUAL(ZSTD_isError(compSize), (unsigned)false);

    delta.resize(compSize);

#if DEBUG_DELTA_TESTS
    std::cout << "delta - uncompressed: " << legend << " of size " << delta.size() << ":\n";
#endif

    size_t i;
    for (i = 0; i < delta.size();)
    {
        switch (delta[i])
        {
        case 'c': // copy row.
        {
#if DEBUG_DELTA_TESTS
            size_t count = static_cast<uint8_t>(delta[i+1]);
            size_t srcRow = static_cast<uint8_t>(delta[i+2]);
            size_t destRow = static_cast<uint8_t>(delta[i+3]);
            std::cout << "c(opy row) from " << srcRow << " to " << destRow << " number of rows: " << count << "\n";
#endif
            i += 4;
            break;
        }
        case 'd': // new run
        {
#if DEBUG_DELTA_TESTS
            size_t destRow = static_cast<uint8_t>(delta[i+1]);
            size_t destCol = static_cast<uint8_t>(delta[i+2]);
#endif
            size_t length = static_cast<uint8_t>(delta[i+3]);
            i += 4;

#if DEBUG_DELTA_TESTS
            std::cout << "d(new pixels) to row " << destRow << " col " << destCol << " number of pixels: " << length << "\n";
            std::vector<char> data(delta.data() + 1, delta.data() + i + length * 4);
            std::cout << Util::stringifyHexLine(data, 0) << "\n";
#endif
            i += 4 * length;
            break;
        }
        case 't': // termination
            LOK_ASSERT(i == delta.size() - 1);
#if DEBUG_DELTA_TESTS
            std::cout << "t(ermination) - delta ended\n";
#endif
            i++;
            break;
        default:
            std::cout << "Unknown delta code " << delta[i] << '\n';
            LOK_ASSERT(false);
            break;
        }
    }
    LOK_ASSERT_EQUAL(delta.size(), i);
}
}

// Quick hack for debugging
std::vector<char> DeltaTests::applyDelta(
    const std::vector<char> &pixmap,
    png_uint_32 width, png_uint_32 height,
    const std::vector<char> &zDelta,
    const std::string& testname)
{
    LOK_ASSERT(zDelta.size() >= 4);
    LOK_ASSERT(zDelta[0] == 'D');

    std::vector<char> delta;
    delta.resize(1024*1024*4); // lots of extra space.

    size_t compSize = ZSTD_decompress( delta.data(), delta.size(),
                                       zDelta.data() + 1, zDelta.size() - 1);
    LOK_ASSERT_EQUAL(ZSTD_isError(compSize), (unsigned)false);

    delta.resize(compSize);

    // start with the same state.
    std::vector<char> output = pixmap;
    LOK_ASSERT_EQUAL(output.size(), size_t(pixmap.size()));
    LOK_ASSERT_EQUAL(output.size(), size_t(width * height * 4));

    size_t offset = 0, i;
    for (i = 0; i < delta.size() && offset < output.size();)
    {
        switch (delta[i])
        {
        case 'c': // copy row.
        {
            size_t count = static_cast<uint8_t>(delta[i+1]);
            size_t srcRow = static_cast<uint8_t>(delta[i+2]);
            size_t destRow = static_cast<uint8_t>(delta[i+3]);

            LOK_ASSERT(srcRow + count <= height);

//            std::cout << "copy " << count <<" row(s) " << srcRow << " to " << destRow << '\n';
            for (size_t cnt = 0; cnt < count; ++cnt)
            {
                const char *src = &pixmap[width * (srcRow + cnt) * 4];
                char *dest = &output[width * (destRow + cnt) * 4];
                for (size_t j = 0; j < width * 4; ++j)
                    *dest++ = *src++;
            }
            i += 4;
            break;
        }
        case 'd': // new run
        {
            size_t destRow = static_cast<uint8_t>(delta[i+1]);
            size_t destCol = static_cast<uint8_t>(delta[i+2]);
            size_t length = static_cast<uint8_t>(delta[i+3]);
            i += 4;

//            std::cout << "new " << length << " at " << destCol << ", " << destRow << '\n';
            LOK_ASSERT(length <= width - destCol);

            char *dest = &output[width * destRow * 4 + destCol * 4];
            for (size_t j = 0; j < length * 4 && i < delta.size(); j += 4)
            {
                *dest++ = delta[i];
                *dest++ = delta[i + 1];
                *dest++ = delta[i + 2];
                *dest++ = delta[i + 3];
                i += 4;
            }
            break;
        }
        case 't': // termination
            LOK_ASSERT(i == delta.size() - 1);
            i++;
            break;
        default:
            std::cout << "Unknown delta code " << delta[i] << '\n';
            LOK_ASSERT(false);
            break;
        }
    }
    LOK_ASSERT_EQUAL(delta.size(), i);
    return output;
}

void DeltaTests::assertEqual(const std::vector<char> &a,
                             const std::vector<char> &b,
                             int width, int /* height */,
                             const std::string& testname)
{
    LOK_ASSERT_EQUAL(a.size(), b.size());
    for (size_t i = 0; i < a.size(); ++i)
    {
        if (a[i] != b[i])
        {
            std::cout << "Differences starting at byte " << i << ' '
                      << (i/4 % width) << ", " << (i / (width * 4)) << ":\n";
            size_t len;
            for (len = 0; (a[i+len] != b[i+len] || len < 8) && i + len < a.size(); ++len)
            {
                std::cout << std::hex << (int)((unsigned char)a[i+len]) << " != ";
                std::cout << std::hex << (int)((unsigned char)b[i+len]) << "  ";
                if (len > 0 && (len % 16 == 0))
                    std::cout<< '\n';
            }
            std::cout << " size " << len << '\n';
            Util::dumpHex(std::cout, a, "a");
            Util::dumpHex(std::cout, b, "b");
            LOK_ASSERT(false);
        }
    }
}

void DeltaTests::testRle()
{
    constexpr auto testname = __func__;

    DeltaGenerator::DeltaBitmapRow rowa;
    DeltaGenerator::DeltaBitmapRow rowb;
    const uint32_t data[] = { 42, 42, 42, 42, 0, 0, 0, 1, 2, 3, 4,
        7, 7, 7, 1, 2, 3, 3, 2, 1, 0, 9, 9, 9, 9, 9, 0, 9, 0, 9, 0, 9 };
    const uint32_t elems = sizeof(data)/sizeof(data[0]);
    rowa.initRow(data, elems);
    rowb.initRow(data, elems);
    LOK_ASSERT(rowa.identical(rowb));

    DeltaGenerator::DeltaBitmapRow::PixIterator it(rowa);
    for (uint32_t i = 0; i < elems; ++i)
    {
        LOK_ASSERT_EQUAL(data[i], it.getPixel());
        it.next();
    }
}

void DeltaTests::testRleComplex()
{
    constexpr auto testname = __func__;

    DeltaGenerator gen;

    png_uint_32 height, width, rowBytes;
    const TileWireId textWid = 1;
    std::vector<char> text =
        DeltaTests::loadPng(TDOC "/delta-graphic.png",
                            height, width, rowBytes);

    DeltaGenerator::DeltaData data(
        textWid, reinterpret_cast<unsigned char*>(text.data()),
        0, 0, 256, 256, TileLocation(9, 9, 9, 0, 1), 256, 256);

    size_t off = 0;
    for (int y = 0; y < 256; ++y)
    {
        DeltaGenerator::DeltaBitmapRow::PixIterator it(data.getRow(y));
        for (uint32_t x = 0; x < 256; ++x)
        {
            uint32_t pix = reinterpret_cast<uint32_t *>(text.data())[off];
            uint32_t rpix = it.getPixel();
            if (pix != rpix)
            {
                // breakpoint point
                LOK_ASSERT_EQUAL(pix, rpix);
            }
            it.next();
            off++;
        }
    }
}

void DeltaTests::testRleIdentical()
{
    constexpr auto testname = __func__;

    DeltaGenerator gen;

    png_uint_32 height, width, rowBytes;
    const TileWireId textWid = 1;
    std::vector<char> text =
        DeltaTests::loadPng(TDOC "/delta-graphic.png",
                            height, width, rowBytes);
    LOK_ASSERT(height == 256 && width == 256 && rowBytes == 256*4);
    LOK_ASSERT_EQUAL(size_t(256 * 256 * 4), text.size());

    DeltaGenerator::DeltaData data(
        textWid, reinterpret_cast<unsigned char*>(text.data()),
        0, 0, 256, 256, TileLocation(9, 9, 9, 0, 1), 256, 256);

    std::vector<char> text2 =
        DeltaTests::loadPng(TDOC "/delta-graphic2.png",
                            height, width, rowBytes);
    LOK_ASSERT(height == 256 && width == 256 && rowBytes == 256*4);
    LOK_ASSERT_EQUAL(size_t(256 * 256 * 4), text2.size());

    DeltaGenerator::DeltaData data2(
        textWid, reinterpret_cast<unsigned char*>(text.data()),
        0, 0, 256, 256, TileLocation(9, 9, 9, 0, 1), 256, 256);

    // find identical rows
    for (int y = 0; y < 256; ++y)
    {
        for (int y2 = 0; y2 < 256; y2++)
        {
            auto &row = data.getRow(y);
            auto &row2 = data2.getRow(y2);
            if (row.identical(row2))
            {
                DeltaGenerator::DeltaBitmapRow::PixIterator it(row);
                DeltaGenerator::DeltaBitmapRow::PixIterator it2(row2);
                for (uint32_t i = 0; i < 256; ++i)
                {
                    if (it.getPixel() != it2.getPixel())
                    {
                        // breakpoint point.
                        LOK_ASSERT_EQUAL(it.getPixel(), it2.getPixel());
                    }
                    it.next(); it2.next();
                }
                break;
            }
        }
    }
}

void DeltaTests::testDeltaSequence()
{
    constexpr auto testname = __func__;

    DeltaGenerator gen;

    png_uint_32 height, width, rowBytes;
    const TileWireId textWid = 1;
    std::vector<char> text =
        DeltaTests::loadPng(TDOC "/delta-text.png",
                            height, width, rowBytes);
    LOK_ASSERT(height == 256 && width == 256 && rowBytes == 256*4);
    LOK_ASSERT_EQUAL(size_t(256 * 256 * 4), text.size());

    const TileWireId text2Wid = 2;
    std::vector<char> text2 =
        DeltaTests::loadPng(TDOC "/delta-text2.png",
                            height, width, rowBytes);
    LOK_ASSERT(height == 256 && width == 256 && rowBytes == 256*4);
    LOK_ASSERT_EQUAL(size_t(256 * 256 * 4), text2.size());

    std::vector<char> delta;
    // Stash it in the cache
    LOK_ASSERT(gen.createDelta(
                       reinterpret_cast<unsigned char *>(&text[0]),
                       0, 0, width, height, width, height,
                       TileLocation(1, 2, 3, 0, 1), delta, textWid, false) == false);
    LOK_ASSERT(delta.empty());

    // Build a delta between text2 & textWid
    LOK_ASSERT(gen.createDelta(
                       reinterpret_cast<unsigned char *>(&text2[0]),
                       0, 0, width, height, width, height,
                       TileLocation(1, 2, 3, 0, 1), delta, text2Wid, false) == true);
    LOK_ASSERT(delta.size() > 0);
    checkzDelta(delta, "text2 to textWid");

    // Apply it to move to the second frame
    std::vector<char> reText2 = applyDelta(text, width, height, delta, testname);
    assertEqual(reText2, text2, width, height, testname);

    // Build a delta between text & text2Wid
    std::vector<char> two2one;
    LOK_ASSERT(gen.createDelta(
                       reinterpret_cast<unsigned char *>(&text[0]),
                       0, 0, width, height, width, height,
                       TileLocation(1, 2, 3, 0, 1), two2one, textWid, false) == true);
    LOK_ASSERT(two2one.size() > 0);
    checkzDelta(two2one, "text to text2Wid");

    // Apply it to get back to where we started
    std::vector<char> reText = applyDelta(text2, width, height, two2one, testname);
    assertEqual(reText, text, width, height, testname);
}

void DeltaTests::testRandomDeltas()
{
}

void DeltaTests::testDeltaCopyOutOfBounds()
{
    constexpr auto testname = __func__;

    DeltaGenerator gen;

    png_uint_32 height, width, rowBytes;
    const TileWireId textWid = 1;
    std::vector<char> text =
        DeltaTests::loadPng(TDOC "/delta-graphic.png",
                            height, width, rowBytes);
    LOK_ASSERT(height == 256 && width == 256 && rowBytes == 256*4);
    LOK_ASSERT_EQUAL(size_t(256 * 256 * 4), text.size());

    const TileWireId text2Wid = 2;
    std::vector<char> text2 =
        DeltaTests::loadPng(TDOC "/delta-graphic2.png",
                            height, width, rowBytes);
    LOK_ASSERT(height == 256 && width == 256 && rowBytes == 256*4);
    LOK_ASSERT_EQUAL(size_t(256 * 256 * 4), text2.size());

    std::vector<char> delta;
    // Stash it in the cache
    LOK_ASSERT(gen.createDelta(
                       reinterpret_cast<unsigned char *>(&text[0]),
                       0, 0, width, height, width, height,
                       TileLocation(1, 2, 3, 0, 1), delta, textWid, false) == false);
    LOK_ASSERT(delta.empty());

    // Build a delta between the two frames
    LOK_ASSERT(gen.createDelta(
                       reinterpret_cast<unsigned char *>(&text2[0]),
                       0, 0, width, height, width, height,
                       TileLocation(1, 2, 3, 0, 1), delta, text2Wid, false) == true);
    LOK_ASSERT(delta.size() > 0);
    checkzDelta(delta, "copy out of bounds");

    // Apply it to move to the second frame
    std::vector<char> reText2 = applyDelta(text, width, height, delta, testname);
    assertEqual(reText2, text2, width, height, testname);
}

CPPUNIT_TEST_SUITE_REGISTRATION(DeltaTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
