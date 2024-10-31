/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <test/lokassert.hpp>

#include <Util.hpp>
#include <CharacterConverter.hpp>

#include <cppunit/extensions/HelperMacros.h>

#include <cstdint>
#include <iomanip>
#include <sstream>

/// Util unit-tests.
class UtilTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(UtilTests);

    CPPUNIT_TEST(testStringifyHexLine);
    CPPUNIT_TEST(testHexify);
    CPPUNIT_TEST(testBytesToHex);
    CPPUNIT_TEST(testNumberToHex);
    CPPUNIT_TEST(testCharacterConverter);
#if ENABLE_DEBUG
    CPPUNIT_TEST(testUtf8);
#endif

    CPPUNIT_TEST_SUITE_END();

    void testStringifyHexLine();
    void testHexify();
    void testBytesToHex();
    void testNumberToHex();
    void testCharacterConverter();
    void testUtf8();
};

void UtilTests::testStringifyHexLine()
{
    constexpr auto testname = __func__;

    std::string test("hello here\ntest");
    std::string result1("68 65 6C 6C 6F 20 68 65  72 65 0A 74 65 73 74"
                        "                                                       "
                        "| hello here.test                 ");
    std::string result2("68 65 72 65 0A 74  | here.t");
    LOK_ASSERT_EQUAL(result1, Util::stringifyHexLine(test, 0));
    LOK_ASSERT_EQUAL(result2, Util::stringifyHexLine(test, 6, 6));
}

void UtilTests::testHexify()
{
    constexpr auto testname = __func__;

    const std::string s1 = "some ascii text with !@#$%^&*()_+/-\\|";
    const auto hex = Util::dataToHexString(s1, 0, s1.size());
    std::string decoded;
    LOK_ASSERT(Util::dataFromHexString(hex, decoded));
    LOK_ASSERT_EQUAL(s1, decoded);

    for (std::size_t randStrLen = 1; randStrLen < 129; ++randStrLen)
    {
        const auto s2 = Util::rng::getBytes(randStrLen);
        LOK_ASSERT_EQUAL(randStrLen, s2.size());
        const auto hex2 = Util::dataToHexString(s2, 0, s2.size());
        LOK_ASSERT_EQUAL(randStrLen * 2, hex2.size());
        std::vector<char> decoded2;
        LOK_ASSERT(Util::dataFromHexString(hex2, decoded2));
        LOK_ASSERT_EQUAL(randStrLen, decoded2.size());
        LOK_ASSERT_EQUAL(Util::toString(s2), Util::toString(decoded2));
    }
}

void UtilTests::testBytesToHex()
{
    constexpr auto testname = __func__;

    {
        const std::string d("Some text");
        const std::string hex = Util::bytesToHexString(d);
        const std::string s = Util::hexStringToBytes(hex);
        LOK_ASSERT_EQUAL(d, s);
    }
}

static std::string hexifyStd(const std::uint64_t number, int width, std::size_t size = INTMAX_MAX)
{
    std::ostringstream oss;
    oss << std::hex << std::setw(width) << std::setfill('0') << number;
    std::string str = oss.str();
    return size < str.size() ? str.substr(str.size() - size) : str;
}

void UtilTests::testNumberToHex()
{
    constexpr auto testname = __func__;

    for (int width = 0; width < 33; ++width)
    {
        std::uint64_t number = 0;
        LOK_TRACE("Number: " << std::hex << number << std::dec << " (shift: 0"
                             << "), width: " << width);
        LOK_ASSERT_EQUAL_STR(hexifyStd(number, width), Util::encodeId(number, width));
        LOK_ASSERT_EQUAL_STR(hexifyStd(~number, width), Util::encodeId(~number, width));

        for (int shift = 0; shift < 64; ++shift)
        {
            number = 1UL << shift;
            LOK_TRACE("Number: " << std::hex << number << std::dec << " (shift: " << shift
                                 << "), width: " << width);
            LOK_ASSERT_EQUAL_STR(hexifyStd(number, width), Util::encodeId(number, width));
            LOK_ASSERT_EQUAL_STR(hexifyStd(~number, width), Util::encodeId(~number, width));
        }
    }

    char buffer[32];
    for (ptrdiff_t sz = sizeof(buffer); sz >= 0; --sz)
    {
        std::size_t size = static_cast<std::size_t>(sz);
        for (int width = 0; width < 33; ++width)
        {
            std::uint64_t number = 0;
            LOK_TRACE("Number: " << std::hex << number << std::dec << " (shift: 0"
                                 << "), width: " << width << ", size: " << size);
            LOK_ASSERT_EQUAL_STR(hexifyStd(number, width, size),
                                 Util::encodeId(buffer, size, number, width));
            LOK_ASSERT_EQUAL_STR(hexifyStd(~number, width, size),
                                 Util::encodeId(buffer, size, ~number, width));

            for (int shift = 0; shift < 64; ++shift)
            {
                number = 1UL << shift;
                LOK_TRACE("Number: " << std::hex << number << std::dec << " (shift: " << shift
                                     << "), width: " << width << ", size: " << size);
                LOK_ASSERT_EQUAL_STR(hexifyStd(number, width, size),
                                     Util::encodeId(buffer, size, number, width));
                LOK_ASSERT_EQUAL_STR(hexifyStd(~number, width, size),
                                     Util::encodeId(buffer, size, ~number, width));
            }
        }
    }
}

void UtilTests::testCharacterConverter()
{
    constexpr auto testname = __func__;

    const std::string utf8 = "Ḽơᶉëᶆ ȋṕšᶙṁ ḍỡḽǭᵳ ʂǐť";
    const std::string utf7 = "+HjwBoR2JAOsdhg +AgseVQFhHZkeQQ +Hg0e4R49Ae0dcw +AoIB0AFl-";
    {
        Util::CharacterConverter utf8_to_7("UTF-8", "UTF-7");
        LOK_ASSERT_EQUAL_STR(utf7, utf8_to_7.convert(utf8));
        LOK_ASSERT_EQUAL_STR(utf7, utf8_to_7.convert(utf8)); // Convert again.

        Util::CharacterConverter utf7_to_8("UTF-7", "UTF-8");
        LOK_ASSERT_EQUAL_STR(utf8, utf7_to_8.convert(utf7));
        LOK_ASSERT_EQUAL_STR(utf8, utf7_to_8.convert(utf7)); // Convert again.
    }

    {
        const std::string utf8l =
            R"xxx(ăѣ𝔠ծềſģȟᎥ𝒋ǩľḿꞑȯ𝘱𝑞𝗋𝘴ȶ𝞄𝜈ψ𝒙𝘆𝚣1234567890!@#$%^&*()-_=+[{]};:'",<.>/?~𝘈Ḇ𝖢𝕯٤ḞԍНǏ𝙅ƘԸⲘ𝙉০Ρ𝗤Ɍ𝓢ȚЦ𝒱Ѡ𝓧ƳȤѧᖯć𝗱ễ𝑓𝙜Ⴙ𝞲𝑗𝒌ļṃŉо𝞎𝒒ᵲꜱ𝙩ừ𝗏ŵ𝒙𝒚ź1234567890!@#$%^&*()-_=+[{]};:'",<.>/?~АḂⲤ𝗗𝖤𝗙ꞠꓧȊ𝐉𝜥ꓡ𝑀𝑵Ǭ𝙿𝑄Ŗ𝑆𝒯𝖴𝘝𝘞ꓫŸ𝜡ả𝘢ƀ𝖼ḋếᵮℊ𝙝Ꭵ𝕛кιṃդⱺ𝓅𝘲𝕣𝖘ŧ𝑢ṽẉ𝘅ყž1234567890!@#$%^&*()-_=+[{]};:'",<.>/?~Ѧ𝙱ƇᗞΣℱԍҤ١𝔍К𝓛𝓜ƝȎ𝚸𝑄Ṛ𝓢ṮṺƲᏔꓫ𝚈𝚭𝜶Ꮟçძ𝑒𝖿𝗀ḧ𝗂𝐣ҝɭḿ𝕟𝐨𝝔𝕢ṛ𝓼тú𝔳ẃ⤬𝝲𝗓1234567890!@#$%^&*()-_=+[{]};:'",<.>/?~𝖠Β𝒞𝘋𝙴𝓕ĢȞỈ𝕵ꓗʟ𝙼ℕ০𝚸𝗤ՀꓢṰǓⅤ𝔚Ⲭ𝑌𝙕𝘢𝕤)xxx";
        const std::string utf7l =
            R"xxx(+AQMEY9g13SAFbh7BAX8BIwIfE6XYNdyLAekBPh4/p5ECL9g13jHYNdxe2DXdy9g13jQCNtg134TYNd8IA8jYNdyZ2DXeBtg13qM-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQArAFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH7YNd4IHgbYNd2i2DXdbwZkHh4FDQQdAc/YNd5FAZgFOCyY2DXeSQnmA6HYNd3kAkzYNdziAhoEJtg13LEEYNg13OcBswIkBGcVrwEH2DXd8R7F2DXcU9g13lwQudg137LYNdxX2DXcjAE8HkMBSQQ+2DXfjtg13JIdcqcx2DXeaR7r2DXdzwF12DXcmdg13JoBeg-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQArAFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH4EEB4CLKTYNd3X2DXdpNg13dmnoKTnAgrYNdwJ2DXfJaTh2DXcQNg13HUB7Ng13n/YNdxEAVbYNdxG2DXcr9g13bTYNd4d2DXeHqTrAXjYNd8hHqPYNd4iAYDYNd28Hgsevx1uIQrYNd5dE6XYNd1bBDoDuR5DBWQsetg13MXYNd4y2DXdY9g13ZgBZ9g13GIefR6J2DXeBRDnAX4-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQArAFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH4EZtg13nEBhxXeA6MhMQUNBKQGYdg13Q0EGtg13NvYNdzcAZ0CDtg13rjYNdxEHlrYNdziHm4eegGyE9Sk69g13ojYNd6t2DXfNhPPAOcQ69g13FLYNd2/2DXdwB4n2DXdwtg13CMEnQJtHj/YNd1f2DXcKNg131TYNd1iHlvYNdz8BEIA+tg13TMegyks2DXfctg13dM-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQArAFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH7YNd2gA5LYNdye2DXeC9g13nTYNdzVASICHh7I2DXddaTXAp/YNd58IRUJ5tg13rjYNd3kBUCk4h5wAdMhZNg13RosrNg13EzYNd5V2DXeItg13WQ-)xxx";

        Util::CharacterConverter utf8_to_7("UTF-8", "UTF-7");
        LOK_ASSERT_EQUAL_STR(utf7, utf8_to_7.convert(utf8));
        LOK_ASSERT_EQUAL_STR(utf7l, utf8_to_7.convert(utf8l));
        LOK_ASSERT_EQUAL_STR(utf7, utf8_to_7.convert(utf8));
        LOK_ASSERT_EQUAL_STR(utf7l, utf8_to_7.convert(utf8l));

        Util::CharacterConverter utf7_to_8("UTF-7", "UTF-8");
        LOK_ASSERT_EQUAL_STR(utf8, utf7_to_8.convert(utf7));
        LOK_ASSERT_EQUAL_STR(utf8l, utf7_to_8.convert(utf7l));
        LOK_ASSERT_EQUAL_STR(utf8, utf7_to_8.convert(utf7));
        LOK_ASSERT_EQUAL_STR(utf8l, utf7_to_8.convert(utf7l));
    }
}

void UtilTests::testUtf8()
{
#if ENABLE_DEBUG
    constexpr auto testname = __func__;
    LOK_ASSERT(Util::isValidUtf8("foo"));
    LOK_ASSERT(Util::isValidUtf8("©")); // 2 char
    LOK_ASSERT(Util::isValidUtf8("→ ")); // 3 char
    LOK_ASSERT(Util::isValidUtf8("🏃 is not 🏊."));
    LOK_ASSERT(!Util::isValidUtf8("\xff\x03"));
#endif
}

CPPUNIT_TEST_SUITE_REGISTRATION(UtilTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
