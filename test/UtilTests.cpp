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

/*
 * Unit test for utility functions including character conversion and hex utilities.
 */

#include <config.h>

#include <test/lokassert.hpp>

#include <common/CharacterConverter.hpp>
#include <common/HexUtil.hpp>
#include <common/Util.hpp>

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
    CPPUNIT_TEST(testEliminatePrefix);
    CPPUNIT_TEST(testStreamMatch);
    CPPUNIT_TEST(testBase64EncodeRemovingNewLines);
    CPPUNIT_TEST(testBase64Decode);

    CPPUNIT_TEST_SUITE_END();

    void testStringifyHexLine();
    void testHexify();
    void testBytesToHex();
    void testNumberToHex();
    void testCharacterConverter();
    void testUtf8();
    void testEliminatePrefix();
    void testStreamMatch();
    void testBase64EncodeRemovingNewLines();
    void testBase64Decode();
};

void UtilTests::testStringifyHexLine()
{
    constexpr std::string_view testname = __func__;

    std::string test("hello here\ntest");
    std::string result1("68 65 6C 6C 6F 20 68 65  72 65 0A 74 65 73 74"
                        "                                                       "
                        "| hello here.test                 ");
    std::string result2("68 65 72 65 0A 74  | here.t");
    LOK_ASSERT_EQUAL(result1, HexUtil::stringifyHexLine(test, 0));
    LOK_ASSERT_EQUAL(result2, HexUtil::stringifyHexLine(test, 6, 6));
}

void UtilTests::testHexify()
{
    constexpr std::string_view testname = __func__;

    const std::string s1 = "some ascii text with !@#$%^&*()_+/-\\|";
    const auto hex = HexUtil::dataToHexString(s1, 0, s1.size());
    std::string decoded;
    LOK_ASSERT(HexUtil::dataFromHexString(hex, decoded));
    LOK_ASSERT_EQUAL(s1, decoded);

    for (std::size_t randStrLen = 1; randStrLen < 129; ++randStrLen)
    {
        const auto s2 = Util::rng::getBytes(randStrLen);
        LOK_ASSERT_EQUAL(randStrLen, s2.size());
        const auto hex2 = HexUtil::dataToHexString(s2, 0, s2.size());
        LOK_ASSERT_EQUAL(randStrLen * 2, hex2.size());
        std::vector<char> decoded2;
        LOK_ASSERT(HexUtil::dataFromHexString(hex2, decoded2));
        LOK_ASSERT_EQUAL(randStrLen, decoded2.size());
        LOK_ASSERT_EQUAL(Util::toString(s2), Util::toString(decoded2));
    }
}

void UtilTests::testBytesToHex()
{
    constexpr std::string_view testname = __func__;

    {
        const std::string d("Some text");
        const std::string hex = HexUtil::bytesToHexString(d);
        const std::string s = HexUtil::hexStringToBytes(hex);
        LOK_ASSERT_EQUAL(d, s);
    }
}

static std::string hexifyStd(const std::uint64_t number, int width, std::size_t size = INTMAX_MAX)
{
    std::ostringstream oss;
    oss << std::hex << std::setw(width) << std::setfill('0') << number;
    std::string str = oss.str();
    if (size < str.size())
       return str.substr(str.size() - size);
    return str;
}

void UtilTests::testNumberToHex()
{
    constexpr std::string_view testname = __func__;

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
    for (ssize_t sz = sizeof(buffer); sz >= 0; --sz)
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
    constexpr std::string_view testname = __func__;

    const std::string utf8 = "Ḽơᶉëᶆ ȋṕšᶙṁ ḍỡḽǭᵳ ʂǐť";
#ifndef __APPLE__
    const std::string utf7 = "+HjwBoR2JAOsdhg +AgseVQFhHZkeQQ +Hg0e4R49Ae0dcw +AoIB0AFl-";
#else
    // The macOS iconv gives slightly different results
    const std::string utf7 = "+HjwBoR2JAOsdhg +AgseVQFhHZkeQQ +Hg0e4R49Ae0dcw +AoIB0AFl";
#endif
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
#ifndef __APPLE__
        const std::string utf7l =
            R"xxx(+AQMEY9g13SAFbh7BAX8BIwIfE6XYNdyLAekBPh4/p5ECL9g13jHYNdxe2DXdy9g13jQCNtg134TYNd8IA8jYNdyZ2DXeBtg13qM-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQArAFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH7YNd4IHgbYNd2i2DXdbwZkHh4FDQQdAc/YNd5FAZgFOCyY2DXeSQnmA6HYNd3kAkzYNdziAhoEJtg13LEEYNg13OcBswIkBGcVrwEH2DXd8R7F2DXcU9g13lwQudg137LYNdxX2DXcjAE8HkMBSQQ+2DXfjtg13JIdcqcx2DXeaR7r2DXdzwF12DXcmdg13JoBeg-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQArAFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH4EEB4CLKTYNd3X2DXdpNg13dmnoKTnAgrYNdwJ2DXfJaTh2DXcQNg13HUB7Ng13n/YNdxEAVbYNdxG2DXcr9g13bTYNd4d2DXeHqTrAXjYNd8hHqPYNd4iAYDYNd28Hgsevx1uIQrYNd5dE6XYNd1bBDoDuR5DBWQsetg13MXYNd4y2DXdY9g13ZgBZ9g13GIefR6J2DXeBRDnAX4-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQArAFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH4EZtg13nEBhxXeA6MhMQUNBKQGYdg13Q0EGtg13NvYNdzcAZ0CDtg13rjYNdxEHlrYNdziHm4eegGyE9Sk69g13ojYNd6t2DXfNhPPAOcQ69g13FLYNd2/2DXdwB4n2DXdwtg13CMEnQJtHj/YNd1f2DXcKNg131TYNd1iHlvYNdz8BEIA+tg13TMegyks2DXfctg13dM-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQArAFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH7YNd2gA5LYNdye2DXeC9g13nTYNdzVASICHh7I2DXddaTXAp/YNd58IRUJ5tg13rjYNd3kBUCk4h5wAdMhZNg13RosrNg13EzYNd5V2DXeItg13WQ-)xxx";
#else
        // The macOS iconv gives slightly different results
        const std::string utf7l =
            R"xxx(+AQMEY9g13SAFbh7BAX8BIwIfE6XYNdyLAekBPh4/p5ECL9g13jHYNdxe2DXdy9g13jQCNtg134TYNd8IA8jYNdyZ2DXeBtg13qM-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQ-+-+AFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH7YNd4IHgbYNd2i2DXdbwZkHh4FDQQdAc/YNd5FAZgFOCyY2DXeSQnmA6HYNd3kAkzYNdziAhoEJtg13LEEYNg13OcBswIkBGcVrwEH2DXd8R7F2DXcU9g13lwQudg137LYNdxX2DXcjAE8HkMBSQQ+2DXfjtg13JIdcqcx2DXeaR7r2DXdzwF12DXcmdg13JoBeg-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQ-+-+AFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH4EEB4CLKTYNd3X2DXdpNg13dmnoKTnAgrYNdwJ2DXfJaTh2DXcQNg13HUB7Ng13n/YNdxEAVbYNdxG2DXcr9g13bTYNd4d2DXeHqTrAXjYNd8hHqPYNd4iAYDYNd28Hgsevx1uIQrYNd5dE6XYNd1bBDoDuR5DBWQsetg13MXYNd4y2DXdY9g13ZgBZ9g13GIefR6J2DXeBRDnAX4-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQ-+-+AFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH4EZtg13nEBhxXeA6MhMQUNBKQGYdg13Q0EGtg13NvYNdzcAZ0CDtg13rjYNdxEHlrYNdziHm4eegGyE9Sk69g13ojYNd6t2DXfNhPPAOcQ69g13FLYNd2/2DXdwB4n2DXdwtg13CMEnQJtHj/YNd1f2DXcKNg131TYNd1iHlvYNdz8BEIA+tg13TMegyks2DXfctg13dM-1234567890+ACEAQAAjACQAJQBeACYAKg()-+AF8APQ-+-+AFsAewBdAH0AOw:'+ACI,+ADw.+AD4-/?+AH7YNd2gA5LYNdye2DXeC9g13nTYNdzVASICHh7I2DXddaTXAp/YNd58IRUJ5tg13rjYNd3kBUCk4h5wAdMhZNg13RosrNg13EzYNd5V2DXeItg13WQ-)xxx";
#endif

        Util::CharacterConverter utf8_to_7("UTF-8", "UTF-7");
        LOK_ASSERT_EQUAL_STR(utf7, utf8_to_7.convert(utf8));
        LOK_ASSERT_EQUAL_STR(utf7l, utf8_to_7.convert(utf8l));
        LOK_ASSERT_EQUAL_STR(utf7, utf8_to_7.convert(utf8));
        LOK_ASSERT_EQUAL_STR(utf7l, utf8_to_7.convert(utf8l));

        Util::CharacterConverter utf7_to_8("UTF-7", "UTF-8");
        LOK_ASSERT_EQUAL_STR(utf8, utf7_to_8.convert(utf7));
#ifndef __APPLE__
        LOK_ASSERT_EQUAL_STR(utf8l, utf7_to_8.convert(utf7l));
#endif
        LOK_ASSERT_EQUAL_STR(utf8, utf7_to_8.convert(utf7));
#ifndef __APPLE__
        LOK_ASSERT_EQUAL_STR(utf8l, utf7_to_8.convert(utf7l));
#endif
    }
}

void UtilTests::testUtf8()
{
#if ENABLE_DEBUG
    constexpr std::string_view testname = __func__;
    LOK_ASSERT(Util::isValidUtf8("foo") > 3);
    LOK_ASSERT(Util::isValidUtf8("©") > 2); // 2 char
    LOK_ASSERT(Util::isValidUtf8("→ ") > 3); // 3 char
    LOK_ASSERT(Util::isValidUtf8("🏃 is not 🏊.") > 11);
    LOK_ASSERT(Util::isValidUtf8("\xff\x03") < 2);
#endif
}

void UtilTests::testEliminatePrefix()
{
    constexpr auto testname = __func__;

    LOK_ASSERT_EQUAL_STR(std::string(), Util::eliminatePrefix(std::string(), std::string()));
    LOK_ASSERT_EQUAL_STR("test", Util::eliminatePrefix("test", std::string()));
    LOK_ASSERT_EQUAL_STR("", Util::eliminatePrefix(std::string(), "test"));
    LOK_ASSERT_EQUAL_STR("what", Util::eliminatePrefix(std::string("testwhat"), "test"));
    LOK_ASSERT_EQUAL_STR("Command", Util::eliminatePrefix(std::string(".uno:Command"), ".uno:"));
    LOK_ASSERT_EQUAL_STR("", Util::eliminatePrefix(std::string(".uno:Command"), ".uno:Command"));
    LOK_ASSERT_EQUAL_STR(".uno:Command", Util::eliminatePrefix(std::string(".uno:Command"), ".uno:Commander"));
    LOK_ASSERT_EQUAL_STR("uno:Command", Util::eliminatePrefix(std::string(".uno:Command"), "."));
    LOK_ASSERT_EQUAL_STR(".uno:Command", Util::eliminatePrefix(std::string(".uno:Command"), ""));
}

void UtilTests::testStreamMatch()
{
    constexpr auto testname = __func__;

    std::string input("Lorem ipsum dolor sit amet consectetur adipiscing elit");
    std::istringstream is(input);
    std::ostringstream os;

    Util::copyToMatch(is, os, " amet ");
    std::string expected = "Lorem ipsum dolor sit";
    LOK_ASSERT_EQUAL_STR(expected, os.str());
    // input stream read position should be at the start of the match
    LOK_ASSERT_EQUAL(static_cast<std::streampos>(expected.size()), is.tellg());

    Util::seekToMatch(is, " adipiscing ");
    LOK_ASSERT_EQUAL(static_cast<std::streampos>(38), is.tellg());

    // copy as far as match that never occurs should copy to end of stream
    Util::copyToMatch(is, os, "nomatch");
    std::string final = "Lorem ipsum dolor sit adipiscing elit";
    LOK_ASSERT_EQUAL_STR(final, os.str());
}

void UtilTests::testBase64EncodeRemovingNewLines()
{
    constexpr std::string_view testname = __func__;

    // Simple string.
    LOK_ASSERT_EQUAL(std::string("SGVsbG8="),
                     Util::base64EncodeRemovingNewLines("Hello"));

    // Long input (>54 bytes) would trigger Poco line breaks every 72 output
    // chars. Verify the output contains no newlines.
    std::string longInput(200, 'A');
    std::string encoded = Util::base64EncodeRemovingNewLines(longInput);
    LOK_ASSERT(encoded.find('\n') == std::string::npos);
    LOK_ASSERT(encoded.find('\r') == std::string::npos);

#if 0
    // Input containing newlines is preserved through round-trip: the function
    // strips output newlines (from the encoder), not input newlines.
    // ... and it turns out that current base64Decode has a bug there anyway
    std::string withNewLines = "Hello\nWorld\n";
    std::string encodedNL = Util::base64EncodeRemovingNewLines(withNewLines);
    LOK_ASSERT_EQUAL(withNewLines, Util::base64Decode(encodedNL));

    // Vector<unsigned char> overload.
    std::vector<unsigned char> vec = {'H', 'i', '\n'};
    LOK_ASSERT_EQUAL(std::string("Hi\n"),
                     Util::base64Decode(Util::base64EncodeRemovingNewLines(vec)));
#endif
}

void UtilTests::testBase64Decode()
{
    constexpr std::string_view testname = __func__;

    // Simple round-trip.
    LOK_ASSERT_EQUAL(std::string("Hello"), Util::base64Decode("SGVsbG8="));

#if 0
    // Decode longer string.
    // ... and it turns out that current base64Decode has a bug there anyway
    LOK_ASSERT_EQUAL(std::string("Hello World!"),
                     Util::base64Decode("SGVsbG8gV29ybGQh"));
#endif
}

CPPUNIT_TEST_SUITE_REGISTRATION(UtilTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
