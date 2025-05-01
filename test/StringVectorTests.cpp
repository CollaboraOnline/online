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
#include <cppunit/extensions/HelperMacros.h>

#include <common/StringVector.hpp>

/// StringVector unit-tests.
class StringVectorTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(StringVectorTests);
    CPPUNIT_TEST(testTokenizer);
    CPPUNIT_TEST(testTokenizerTokenizeAnyOf);
    CPPUNIT_TEST(testStringVector);
    CPPUNIT_TEST_SUITE_END();

    void testTokenizer();
    void testTokenizerTokenizeAnyOf();
    void testStringVector();
};

void StringVectorTests::testTokenizer()
{
    constexpr auto testname = __func__;

    StringVector tokens;

    tokens = StringVector::tokenize("");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), tokens.size());

    tokens = StringVector::tokenize("  ");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), tokens.size());

    tokens = StringVector::tokenize("A");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = StringVector::tokenize("  A");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = StringVector::tokenize("A  ");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = StringVector::tokenize(" A ");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = StringVector::tokenize(" A  Z ");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = StringVector::tokenize("\n");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), tokens.size());

    tokens = StringVector::tokenize(" A  \nZ ");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = StringVector::tokenize(" A  Z\n ");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = StringVector::tokenize(" A  Z  \n ");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = StringVector::tokenize("tile nviewid=0 part=0 width=256 height=256 tileposx=0 "
                                    "tileposy=0 tilewidth=3840 tileheight=3840 ver=-1");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(10), tokens.size());
    LOK_ASSERT_EQUAL(std::string("tile"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("nviewid=0"), tokens[1]);
    LOK_ASSERT_EQUAL(std::string("part=0"), tokens[2]);
    LOK_ASSERT_EQUAL(std::string("width=256"), tokens[3]);
    LOK_ASSERT_EQUAL(std::string("height=256"), tokens[4]);
    LOK_ASSERT_EQUAL(std::string("tileposx=0"), tokens[5]);
    LOK_ASSERT_EQUAL(std::string("tileposy=0"), tokens[6]);
    LOK_ASSERT_EQUAL(std::string("tilewidth=3840"), tokens[7]);
    LOK_ASSERT_EQUAL(std::string("tileheight=3840"), tokens[8]);
    LOK_ASSERT_EQUAL(std::string("ver=-1"), tokens[9]);

    // With custom delimiters
    tokens = StringVector::tokenize(std::string("ABC:DEF"), ':');
    LOK_ASSERT_EQUAL(std::string("ABC"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("DEF"), tokens[1]);

    tokens = StringVector::tokenize(std::string("ABC,DEF,XYZ"), ',');
    LOK_ASSERT_EQUAL(std::string("ABC"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("DEF"), tokens[1]);
    LOK_ASSERT_EQUAL(std::string("XYZ"), tokens[2]);

    static const std::string URI
        = "/cool/"
          "http%3A%2F%2Flocalhost%2Fnextcloud%2Findex.php%2Fapps%2Frichdocuments%2Fwopi%2Ffiles%"
          "2F593_ocqiesh0cngs%3Faccess_token%3DMN0KXXDv9GJ1wCCLnQcjVQT2T7WrfYpA%26access_token_ttl%"
          "3D0%26reuse_cookies%3Doc_sessionPassphrase%"
          "253D8nFRqycbs7bP97yxCuJviBbVKdCXmuiXp6ZYH0DfUoy5UZDCTQgLwluvbgRbKrdKodJteG3uNE19KNUAoE5t"
          "ypf4oBGwJdFY%25252F5W9RNST8wEHWkUVIjZy7vmY0ZX38PlS%253Anc_sameSiteCookielax%253Dtrue%"
          "253Anc_sameSiteCookiestrict%253Dtrue%253Aocqiesh0cngs%253Dr5ujg4tpvgu9paaf5bguiokgjl%"
          "253AXCookieName%253DXCookieValue%253ASuperCookieName%253DBAZINGA/"
          "ws?WOPISrc=http%3A%2F%2Flocalhost%2Fnextcloud%2Findex.php%2Fapps%2Frichdocuments%2Fwopi%"
          "2Ffiles%2F593_ocqiesh0cngs&compat=/ws/b26112ab1b6f2ed98ce1329f0f344791/close/31";

    tokens = StringVector::tokenize(URI, '/');
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(7), tokens.size());
    LOK_ASSERT_EQUAL(std::string("31"), tokens[6]);
}

void StringVectorTests::testTokenizerTokenizeAnyOf()
{
    constexpr auto testname = __func__;

    StringVector tokens;
    const char delimiters[] = "\n\r"; // any of these delimits; and we trim whitespace

    tokens = StringVector::tokenizeAnyOf("", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), tokens.size());

    tokens = StringVector::tokenizeAnyOf("  ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), tokens.size());

    tokens = StringVector::tokenizeAnyOf("A", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = StringVector::tokenizeAnyOf("  A", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = StringVector::tokenizeAnyOf("A  ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = StringVector::tokenizeAnyOf(" A ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = StringVector::tokenizeAnyOf(" A  Z ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A  Z"), tokens[0]);

    tokens = StringVector::tokenizeAnyOf("\n", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), tokens.size());

    tokens = StringVector::tokenizeAnyOf("\n\r\r\n", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), tokens.size());

    tokens = StringVector::tokenizeAnyOf(" A  \nZ ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = StringVector::tokenizeAnyOf(" A  Z\n ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A  Z"), tokens[0]);

    tokens = StringVector::tokenizeAnyOf(" A  Z  \n\r\r\n ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A  Z"), tokens[0]);

    tokens = StringVector::tokenizeAnyOf(" A  \n\r\r\n  \r  \n  Z  \n ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = StringVector::tokenizeAnyOf("  \r A  \n  \r  \n  Z  \n ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = StringVector::tokenizeAnyOf(std::string("A\rB\nC\n\rD\r\nE\r\rF\n\nG\r\r\n\nH"),
                                         delimiters);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(8), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("B"), tokens[1]);
    LOK_ASSERT_EQUAL(std::string("C"), tokens[2]);
    LOK_ASSERT_EQUAL(std::string("D"), tokens[3]);
    LOK_ASSERT_EQUAL(std::string("E"), tokens[4]);
    LOK_ASSERT_EQUAL(std::string("F"), tokens[5]);
    LOK_ASSERT_EQUAL(std::string("G"), tokens[6]);
    LOK_ASSERT_EQUAL(std::string("H"), tokens[7]);
}

void StringVectorTests::testStringVector()
{
    constexpr auto testname = __func__;

    // Test push_back() and getParam().
    StringVector vector;
    vector.push_back("a");
    vector.push_back("b");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(2), vector.size());
    auto it = vector.begin();
    LOK_ASSERT_EQUAL(std::string("a"), vector.getParam(*it));
    ++it;
    LOK_ASSERT_EQUAL(std::string("b"), vector.getParam(*it));

    // Test cat().
    LOK_ASSERT_EQUAL(std::string("a b"), vector.cat(" ", 0));
    LOK_ASSERT_EQUAL(std::string("a b"), vector.cat(' ', 0));
    LOK_ASSERT_EQUAL(std::string("a*b"), vector.cat('*', 0));
    LOK_ASSERT_EQUAL(std::string("a blah mlah b"), vector.cat(" blah mlah ", 0));
    LOK_ASSERT_EQUAL(std::string(), vector.cat(" ", 3));
    LOK_ASSERT_EQUAL(std::string(), vector.cat(" ", 42));

    // Test operator []().
    LOK_ASSERT_EQUAL(std::string("a"), vector[0]);
    LOK_ASSERT_EQUAL(std::string(""), vector[2]);

    // Test equals().
    LOK_ASSERT(vector.equals(0, "a"));
    LOK_ASSERT(!vector.equals(0, "A"));
    LOK_ASSERT(vector.equals(1, "b"));
    LOK_ASSERT(!vector.equals(1, "B"));
    LOK_ASSERT(!vector.equals(2, ""));

    // Test equals(), StringVector argument version.
    StringVector vector2;
    vector2.push_back("a");
    vector2.push_back("B");

    LOK_ASSERT(vector.equals(0, vector2, 0));
    LOK_ASSERT(!vector.equals(0, vector2, 1));

    // Test startsWith().
    StringVector vector3;
    vector3.push_back("hello, world");
    vector3.push_back("goodbye, world");

    LOK_ASSERT(vector3.startsWith(0, "hello"));
    LOK_ASSERT(vector3.startsWith(0, "hello, world"));
    LOK_ASSERT(!vector3.startsWith(0, "hello, world!"));
    LOK_ASSERT(!vector3.startsWith(0, "hello, world! super long text"));
    LOK_ASSERT(vector3.startsWith(1, "goodbye"));
    LOK_ASSERT(!vector3.startsWith(1, "hello"));

    // Test startsWith(), StringToken argument version
    StringToken hello = *vector3.begin();
    StringToken goodbye = *std::next(vector3.begin());
    StringToken unrelated(50, 10); // out of vector3 range

    LOK_ASSERT(vector3.startsWith(hello, "hello"));
    LOK_ASSERT(vector3.startsWith(hello, "hello, world"));
    LOK_ASSERT(!vector3.startsWith(hello, "hello, world!"));
    LOK_ASSERT(!vector3.startsWith(hello, "hello, world! super long text"));
    LOK_ASSERT(vector3.startsWith(goodbye, "goodbye"));
    LOK_ASSERT(!vector3.startsWith(goodbye, "hello"));
    LOK_ASSERT(!vector3.startsWith(unrelated, "hello"));

    {
        StringVector tokens;
        tokens.push_back("a=1");
        uint32_t value{};
        LOK_ASSERT(tokens.getUInt32(0, "a", value));
        LOK_ASSERT_EQUAL(static_cast<uint32_t>(1), value);

        // Prefix does not match.
        LOK_ASSERT(!tokens.getUInt32(0, "b", value));

        // Index is out of bounds.
        LOK_ASSERT(!tokens.getUInt32(1, "a", value));

        // Expected key is prefix of actual key.
        tokens.push_back("bb=1");
        LOK_ASSERT(!tokens.getUInt32(1, "b", value));

        // Actual key is prefix of expected key.
        tokens.push_back("c=1");
        LOK_ASSERT(!tokens.getUInt32(1, "cc", value));
    }

    {
        StringVector tokens;
        tokens.push_back("a=1");
        std::string name;
        int value{};
        LOK_ASSERT(tokens.getNameIntegerPair(0, name, value));
        LOK_ASSERT_EQUAL(std::string("a"), name);
        LOK_ASSERT_EQUAL(1, value);

        tokens.push_back("aa=1");
        LOK_ASSERT(tokens.getNameIntegerPair(1, name, value));
        LOK_ASSERT_EQUAL(std::string("aa"), name);
        LOK_ASSERT_EQUAL(1, value);

        tokens.push_back("a=11");
        LOK_ASSERT(tokens.getNameIntegerPair(2, name, value));
        LOK_ASSERT_EQUAL(std::string("a"), name);
        LOK_ASSERT_EQUAL(11, value);
    }
}

CPPUNIT_TEST_SUITE_REGISTRATION(StringVectorTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
