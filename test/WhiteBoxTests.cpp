/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <test/lokassert.hpp>

#include <Auth.hpp>
#include <ChildSession.hpp>
#include <Common.hpp>
#include <FileUtil.hpp>
#include <Kit.hpp>
#include <MessageQueue.hpp>
#include <Protocol.hpp>
#include <TileDesc.hpp>
#include <Util.hpp>
#include <JsonUtil.hpp>
#include <RequestDetails.hpp>

#include <common/Authorization.hpp>
#include <wsd/FileServer.hpp>
#include <net/Buffer.hpp>
#include <net/NetUtil.hpp>

#include <chrono>
#include <fstream>

#include <cppunit/extensions/HelperMacros.h>

/// WhiteBox unit-tests.
class WhiteBoxTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(WhiteBoxTests);

    CPPUNIT_TEST(testLOOLProtocolFunctions);
    CPPUNIT_TEST(testSplitting);
    CPPUNIT_TEST(testMessageAbbreviation);
    CPPUNIT_TEST(testTokenizer);
    CPPUNIT_TEST(testTokenizerTokenizeAnyOf);
    CPPUNIT_TEST(testReplace);
    CPPUNIT_TEST(testRegexListMatcher);
    CPPUNIT_TEST(testRegexListMatcher_Init);
    CPPUNIT_TEST(testEmptyCellCursor);
    CPPUNIT_TEST(testTileDesc);
    CPPUNIT_TEST(testRectanglesIntersect);
    CPPUNIT_TEST(testAuthorization);
    CPPUNIT_TEST(testJson);
    CPPUNIT_TEST(testAnonymization);
    CPPUNIT_TEST(testTime);
    CPPUNIT_TEST(testBufferClass);
    CPPUNIT_TEST(testStringVector);
    CPPUNIT_TEST(testRequestDetails_DownloadURI);
    CPPUNIT_TEST(testRequestDetails_loleafletURI);
    CPPUNIT_TEST(testRequestDetails_local);
    CPPUNIT_TEST(testRequestDetails);
    CPPUNIT_TEST(testUIDefaults);
    CPPUNIT_TEST(testCSSVars);
    CPPUNIT_TEST(testAsciiToLower);
    CPPUNIT_TEST(testStat);
    CPPUNIT_TEST(testStringCompare);
    CPPUNIT_TEST(testParseUri);
    CPPUNIT_TEST(testParseUriUrl);
    CPPUNIT_TEST(testParseUrl);

    CPPUNIT_TEST_SUITE_END();

    void testLOOLProtocolFunctions();
    void testSplitting();
    void testMessageAbbreviation();
    void testTokenizer();
    void testTokenizerTokenizeAnyOf();
    void testReplace();
    void testRegexListMatcher();
    void testRegexListMatcher_Init();
    void testEmptyCellCursor();
    void testTileDesc();
    void testRectanglesIntersect();
    void testAuthorization();
    void testJson();
    void testAnonymization();
    void testTime();
    void testBufferClass();
    void testStringVector();
    void testRequestDetails_DownloadURI();
    void testRequestDetails_loleafletURI();
    void testRequestDetails_local();
    void testRequestDetails();
    void testUIDefaults();
    void testCSSVars();
    void testAsciiToLower();
    void testStat();
    void testStringCompare();
    void testParseUri();
    void testParseUriUrl();
    void testParseUrl();
};

void WhiteBoxTests::testLOOLProtocolFunctions()
{
    int foo;
    LOK_ASSERT(LOOLProtocol::getTokenInteger("foo=42", "foo", foo));
    LOK_ASSERT_EQUAL(42, foo);

    std::string bar;
    LOK_ASSERT(LOOLProtocol::getTokenString("bar=hello-sailor", "bar", bar));
    LOK_ASSERT_EQUAL(std::string("hello-sailor"), bar);

    LOK_ASSERT(LOOLProtocol::getTokenString("bar=", "bar", bar));
    LOK_ASSERT_EQUAL(std::string(""), bar);

    int mumble;
    std::map<std::string, int> map { { "hello", 1 }, { "goodbye", 2 }, { "adieu", 3 } };

    LOK_ASSERT(LOOLProtocol::getTokenKeyword("mumble=goodbye", "mumble", map, mumble));
    LOK_ASSERT_EQUAL(2, mumble);

    std::string message("hello x=1 y=2 foo=42 bar=hello-sailor mumble='goodbye' zip zap");
    StringVector tokens(Util::tokenize(message));

    LOK_ASSERT(LOOLProtocol::getTokenInteger(tokens, "foo", foo));
    LOK_ASSERT_EQUAL(42, foo);

    LOK_ASSERT(LOOLProtocol::getTokenString(tokens, "bar", bar));
    LOK_ASSERT_EQUAL(std::string("hello-sailor"), bar);

    LOK_ASSERT(LOOLProtocol::getTokenKeyword(tokens, "mumble", map, mumble));
    LOK_ASSERT_EQUAL(2, mumble);

    LOK_ASSERT(LOOLProtocol::getTokenIntegerFromMessage(message, "foo", foo));
    LOK_ASSERT_EQUAL(42, foo);

    LOK_ASSERT(LOOLProtocol::getTokenStringFromMessage(message, "bar", bar));
    LOK_ASSERT_EQUAL(std::string("hello-sailor"), bar);

    LOK_ASSERT(LOOLProtocol::getTokenKeywordFromMessage(message, "mumble", map, mumble));
    LOK_ASSERT_EQUAL(2, mumble);

    LOK_ASSERT_EQUAL(static_cast<size_t>(1), Util::trimmed("A").size());
    LOK_ASSERT_EQUAL(std::string("A"), Util::trimmed("A"));

    LOK_ASSERT_EQUAL(static_cast<size_t>(1), Util::trimmed(" X").size());
    LOK_ASSERT_EQUAL(std::string("X"), Util::trimmed(" X"));

    LOK_ASSERT_EQUAL(static_cast<size_t>(1), Util::trimmed("Y ").size());
    LOK_ASSERT_EQUAL(std::string("Y"), Util::trimmed("Y "));

    LOK_ASSERT_EQUAL(static_cast<size_t>(1), Util::trimmed(" Z ").size());
    LOK_ASSERT_EQUAL(std::string("Z"), Util::trimmed(" Z "));

    LOK_ASSERT_EQUAL(static_cast<size_t>(0), Util::trimmed(" ").size());
    LOK_ASSERT_EQUAL(std::string(""), Util::trimmed(" "));

    LOK_ASSERT_EQUAL(static_cast<size_t>(0), Util::trimmed("   ").size());
    LOK_ASSERT_EQUAL(std::string(""), Util::trimmed("   "));

    std::string s;

    s = "A";
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), Util::trim(s).size());
    s = "A";
    LOK_ASSERT_EQUAL(std::string("A"), Util::trim(s));

    s = " X";
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), Util::trim(s).size());
    s = " X";
    LOK_ASSERT_EQUAL(std::string("X"), Util::trim(s));

    s = "Y ";
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), Util::trim(s).size());
    s = "Y ";
    LOK_ASSERT_EQUAL(std::string("Y"), Util::trim(s));

    s = " Z ";
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), Util::trim(s).size());
    s = " Z ";
    LOK_ASSERT_EQUAL(std::string("Z"), Util::trim(s));

    s = " ";
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), Util::trim(s).size());
    s = " ";
    LOK_ASSERT_EQUAL(std::string(""), Util::trim(s));

    s = "   ";
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), Util::trim(s).size());
    s = "   ";
    LOK_ASSERT_EQUAL(std::string(""), Util::trim(s));
}

void WhiteBoxTests::testSplitting()
{
    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring(nullptr, 5, '\n'));
    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring(nullptr, -1, '\n'));
    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring("abc", 0, '\n'));
    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring("abc", -1, '\n'));
    LOK_ASSERT_EQUAL(std::string("ab"), Util::getDelimitedInitialSubstring("abc", 2, '\n'));

    std::string first;
    std::string second;

    std::tie(first, second) = Util::split(std::string(""), '.', true);
    std::tie(first, second) = Util::split(std::string(""), '.', false);

    std::tie(first, second) = Util::splitLast(std::string(""), '.', true);
    std::tie(first, second) = Util::splitLast(std::string(""), '.', false);

    // Split first, remove delim.
    std::tie(first, second) = Util::split(std::string("a"), '.', true);
    LOK_ASSERT_EQUAL(std::string("a"), first);
    LOK_ASSERT_EQUAL(std::string(""), second);

    // Split first, keep delim.
    std::tie(first, second) = Util::split(std::string("a"), '.', false);
    LOK_ASSERT_EQUAL(std::string("a"), first);
    LOK_ASSERT_EQUAL(std::string(""), second);

    // Split first, remove delim.
    std::tie(first, second) = Util::splitLast(std::string("a"), '.', true);
    LOK_ASSERT_EQUAL(std::string("a"), first);
    LOK_ASSERT_EQUAL(std::string(""), second);

    // Split first, keep delim.
    std::tie(first, second) = Util::splitLast(std::string("a"), '.', false);
    LOK_ASSERT_EQUAL(std::string("a"), first);
    LOK_ASSERT_EQUAL(std::string(""), second);


    // Split first, remove delim.
    std::tie(first, second) = Util::split(std::string("a."), '.', true);
    LOK_ASSERT_EQUAL(std::string("a"), first);
    LOK_ASSERT_EQUAL(std::string(""), second);

    // Split first, keep delim.
    std::tie(first, second) = Util::split(std::string("a."), '.', false);
    LOK_ASSERT_EQUAL(std::string("a"), first);
    LOK_ASSERT_EQUAL(std::string("."), second);

    // Split first, remove delim.
    std::tie(first, second) = Util::splitLast(std::string("a."), '.', true);
    LOK_ASSERT_EQUAL(std::string("a"), first);
    LOK_ASSERT_EQUAL(std::string(""), second);

    // Split first, keep delim.
    std::tie(first, second) = Util::splitLast(std::string("a."), '.', false);
    LOK_ASSERT_EQUAL(std::string("a"), first);
    LOK_ASSERT_EQUAL(std::string("."), second);


    // Split first, remove delim.
    std::tie(first, second) = Util::split(std::string("aa.bb"), '.', true);
    LOK_ASSERT_EQUAL(std::string("aa"), first);
    LOK_ASSERT_EQUAL(std::string("bb"), second);

    // Split first, keep delim.
    std::tie(first, second) = Util::split(std::string("aa.bb"), '.', false);
    LOK_ASSERT_EQUAL(std::string("aa"), first);
    LOK_ASSERT_EQUAL(std::string(".bb"), second);

    LOK_ASSERT_EQUAL(static_cast<size_t>(5), Util::getLastDelimiterPosition("aa.bb.cc", 8, '.'));

    // Split last, remove delim.
    std::tie(first, second) = Util::splitLast(std::string("aa.bb.cc"), '.', true);
    LOK_ASSERT_EQUAL(std::string("aa.bb"), first);
    LOK_ASSERT_EQUAL(std::string("cc"), second);

    // Split last, keep delim.
    std::tie(first, second) = Util::splitLast(std::string("aa.bb.cc"), '.', false);
    LOK_ASSERT_EQUAL(std::string("aa.bb"), first);
    LOK_ASSERT_EQUAL(std::string(".cc"), second);

    // Split last, remove delim.
    std::tie(first, second) = Util::splitLast(std::string("/owncloud/index.php/apps/richdocuments/wopi/files/13_ocgdpzbkm39u"), '/', true);
    LOK_ASSERT_EQUAL(std::string("/owncloud/index.php/apps/richdocuments/wopi/files"), first);
    LOK_ASSERT_EQUAL(std::string("13_ocgdpzbkm39u"), second);

    // Split last, keep delim.
    std::tie(first, second) = Util::splitLast(std::string("/owncloud/index.php/apps/richdocuments/wopi/files/13_ocgdpzbkm39u"), '/', false);
    LOK_ASSERT_EQUAL(std::string("/owncloud/index.php/apps/richdocuments/wopi/files"), first);
    LOK_ASSERT_EQUAL(std::string("/13_ocgdpzbkm39u"), second);

    std::string third;
    std::string fourth;

    std::tie(first, second, third, fourth) = Util::splitUrl("filename");
    LOK_ASSERT_EQUAL(std::string(""), first);
    LOK_ASSERT_EQUAL(std::string("filename"), second);
    LOK_ASSERT_EQUAL(std::string(""), third);
    LOK_ASSERT_EQUAL(std::string(""), fourth);

    std::tie(first, second, third, fourth) = Util::splitUrl("filename.ext");
    LOK_ASSERT_EQUAL(std::string(""), first);
    LOK_ASSERT_EQUAL(std::string("filename"), second);
    LOK_ASSERT_EQUAL(std::string(".ext"), third);
    LOK_ASSERT_EQUAL(std::string(""), fourth);

    std::tie(first, second, third, fourth) = Util::splitUrl("/path/to/filename");
    LOK_ASSERT_EQUAL(std::string("/path/to/"), first);
    LOK_ASSERT_EQUAL(std::string("filename"), second);
    LOK_ASSERT_EQUAL(std::string(""), third);
    LOK_ASSERT_EQUAL(std::string(""), fourth);

    std::tie(first, second, third, fourth) = Util::splitUrl("http://domain.com/path/filename");
    LOK_ASSERT_EQUAL(std::string("http://domain.com/path/"), first);
    LOK_ASSERT_EQUAL(std::string("filename"), second);
    LOK_ASSERT_EQUAL(std::string(""), third);
    LOK_ASSERT_EQUAL(std::string(""), fourth);

    std::tie(first, second, third, fourth) = Util::splitUrl("http://domain.com/path/filename.ext");
    LOK_ASSERT_EQUAL(std::string("http://domain.com/path/"), first);
    LOK_ASSERT_EQUAL(std::string("filename"), second);
    LOK_ASSERT_EQUAL(std::string(".ext"), third);
    LOK_ASSERT_EQUAL(std::string(""), fourth);

    std::tie(first, second, third, fourth) = Util::splitUrl("http://domain.com/path/filename.ext?params=3&command=5");
    LOK_ASSERT_EQUAL(std::string("http://domain.com/path/"), first);
    LOK_ASSERT_EQUAL(std::string("filename"), second);
    LOK_ASSERT_EQUAL(std::string(".ext"), third);
    LOK_ASSERT_EQUAL(std::string("?params=3&command=5"), fourth);
}

void WhiteBoxTests::testMessageAbbreviation()
{
    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring(nullptr, 5, '\n'));
    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring(nullptr, -1, '\n'));
    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring("abc", 0, '\n'));
    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring("abc", -1, '\n'));
    LOK_ASSERT_EQUAL(std::string("ab"), Util::getDelimitedInitialSubstring("abc", 2, '\n'));

    LOK_ASSERT_EQUAL(std::string(), LOOLProtocol::getAbbreviatedMessage(nullptr, 5));
    LOK_ASSERT_EQUAL(std::string(), LOOLProtocol::getAbbreviatedMessage(nullptr, -1));
    LOK_ASSERT_EQUAL(std::string(), LOOLProtocol::getAbbreviatedMessage("abc", 0));
    LOK_ASSERT_EQUAL(std::string(), LOOLProtocol::getAbbreviatedMessage("abc", -1));
    LOK_ASSERT_EQUAL(std::string("ab"), LOOLProtocol::getAbbreviatedMessage("abc", 2));

    std::string s;
    std::string abbr;

    s = "abcdefg";
    LOK_ASSERT_EQUAL(s, LOOLProtocol::getAbbreviatedMessage(s));

    s = "1234567890123\n45678901234567890123456789012345678901234567890123";
    abbr = "1234567890123...";
    LOK_ASSERT_EQUAL(abbr, LOOLProtocol::getAbbreviatedMessage(s.data(), s.size()));
    LOK_ASSERT_EQUAL(abbr, LOOLProtocol::getAbbreviatedMessage(s));
}

void WhiteBoxTests::testTokenizer()
{
    StringVector tokens;

    tokens = Util::tokenize("");
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), tokens.size());

    tokens = Util::tokenize("  ");
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), tokens.size());

    tokens = Util::tokenize("A");
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = Util::tokenize("  A");
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = Util::tokenize("A  ");
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = Util::tokenize(" A ");
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = Util::tokenize(" A  Z ");
    LOK_ASSERT_EQUAL(static_cast<size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = Util::tokenize("\n");
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), tokens.size());

    tokens = Util::tokenize(" A  \nZ ");
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = Util::tokenize(" A  Z\n ");
    LOK_ASSERT_EQUAL(static_cast<size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = Util::tokenize(" A  Z  \n ");
    LOK_ASSERT_EQUAL(static_cast<size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = Util::tokenize("tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=0 tilewidth=3840 tileheight=3840 ver=-1");
    LOK_ASSERT_EQUAL(static_cast<size_t>(10), tokens.size());
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
    tokens = Util::tokenize(std::string("ABC:DEF"), ':');
    LOK_ASSERT_EQUAL(std::string("ABC"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("DEF"), tokens[1]);

    tokens = Util::tokenize(std::string("ABC,DEF,XYZ"), ',');
    LOK_ASSERT_EQUAL(std::string("ABC"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("DEF"), tokens[1]);
    LOK_ASSERT_EQUAL(std::string("XYZ"), tokens[2]);

    static const std::string URI
        = "/lool/"
          "http%3A%2F%2Flocalhost%2Fnextcloud%2Findex.php%2Fapps%2Frichdocuments%2Fwopi%2Ffiles%"
          "2F593_ocqiesh0cngs%3Faccess_token%3DMN0KXXDv9GJ1wCCLnQcjVQT2T7WrfYpA%26access_token_ttl%"
          "3D0%26reuse_cookies%3Doc_sessionPassphrase%"
          "253D8nFRqycbs7bP97yxCuJviBbVKdCXmuiXp6ZYH0DfUoy5UZDCTQgLwluvbgRbKrdKodJteG3uNE19KNUAoE5t"
          "ypf4oBGwJdFY%25252F5W9RNST8wEHWkUVIjZy7vmY0ZX38PlS%253Anc_sameSiteCookielax%253Dtrue%"
          "253Anc_sameSiteCookiestrict%253Dtrue%253Aocqiesh0cngs%253Dr5ujg4tpvgu9paaf5bguiokgjl%"
          "253AXCookieName%253DXCookieValue%253ASuperCookieName%253DBAZINGA/"
          "ws?WOPISrc=http%3A%2F%2Flocalhost%2Fnextcloud%2Findex.php%2Fapps%2Frichdocuments%2Fwopi%"
          "2Ffiles%2F593_ocqiesh0cngs&compat=/ws/b26112ab1b6f2ed98ce1329f0f344791/close/31";

    tokens = Util::tokenize(URI, '/');
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(7), tokens.size());
    LOK_ASSERT_EQUAL(std::string("31"), tokens[6]);

    // Integer lists.
    std::vector<int> ints;

    ints = LOOLProtocol::tokenizeInts(std::string("-1"));
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), ints.size());
    LOK_ASSERT_EQUAL(-1, ints[0]);

    ints = LOOLProtocol::tokenizeInts(std::string("1,2,3,4"));
    LOK_ASSERT_EQUAL(static_cast<size_t>(4), ints.size());
    LOK_ASSERT_EQUAL(1, ints[0]);
    LOK_ASSERT_EQUAL(2, ints[1]);
    LOK_ASSERT_EQUAL(3, ints[2]);
    LOK_ASSERT_EQUAL(4, ints[3]);

    ints = LOOLProtocol::tokenizeInts("");
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), ints.size());

    ints = LOOLProtocol::tokenizeInts(std::string(",,,"));
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), ints.size());
}

void WhiteBoxTests::testTokenizerTokenizeAnyOf()
{
    StringVector tokens;
    const char delimiters[] = "\n\r"; // any of these delimits; and we trim whitespace

    tokens = Util::tokenizeAnyOf("", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), tokens.size());

    tokens = Util::tokenizeAnyOf("  ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), tokens.size());

    tokens = Util::tokenizeAnyOf("A", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = Util::tokenizeAnyOf("  A", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = Util::tokenizeAnyOf("A  ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = Util::tokenizeAnyOf(" A ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = Util::tokenizeAnyOf(" A  Z ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A  Z"), tokens[0]);

    tokens = Util::tokenizeAnyOf("\n", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), tokens.size());

    tokens = Util::tokenizeAnyOf("\n\r\r\n", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), tokens.size());

    tokens = Util::tokenizeAnyOf(" A  \nZ ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = Util::tokenizeAnyOf(" A  Z\n ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A  Z"), tokens[0]);

    tokens = Util::tokenizeAnyOf(" A  Z  \n\r\r\n ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A  Z"), tokens[0]);

    tokens = Util::tokenizeAnyOf(" A  \n\r\r\n  \r  \n  Z  \n ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = Util::tokenizeAnyOf("  \r A  \n  \r  \n  Z  \n ", delimiters);
    LOK_ASSERT_EQUAL(static_cast<size_t>(2), tokens.size());
    LOK_ASSERT_EQUAL(std::string("A"), tokens[0]);
    LOK_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = Util::tokenizeAnyOf(std::string("A\rB\nC\n\rD\r\nE\r\rF\n\nG\r\r\n\nH"),
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

void WhiteBoxTests::testReplace()
{
    LOK_ASSERT_EQUAL(std::string("zesz one zwo flee"), Util::replace("test one two flee", "t", "z"));
    LOK_ASSERT_EQUAL(std::string("testt one two flee"), Util::replace("test one two flee", "tes", "test"));
    LOK_ASSERT_EQUAL(std::string("testest one two flee"), Util::replace("test one two flee", "tes", "testes"));
    LOK_ASSERT_EQUAL(std::string("tete one two flee"), Util::replace("tettet one two flee", "tet", "te"));
    LOK_ASSERT_EQUAL(std::string("t one two flee"), Util::replace("test one two flee", "tes", ""));
    LOK_ASSERT_EQUAL(std::string("test one two flee"), Util::replace("test one two flee", "", "X"));
}

void WhiteBoxTests::testRegexListMatcher()
{
    Util::RegexListMatcher matcher;

    matcher.allow("localhost");
    LOK_ASSERT(matcher.match("localhost"));
    LOK_ASSERT(!matcher.match(""));
    LOK_ASSERT(!matcher.match("localhost2"));
    LOK_ASSERT(!matcher.match("xlocalhost"));
    LOK_ASSERT(!matcher.match("192.168.1.1"));

    matcher.deny("localhost");
    LOK_ASSERT(!matcher.match("localhost"));

    matcher.allow("www[0-9].*");
    LOK_ASSERT(matcher.match("www1example"));

    matcher.allow("192\\.168\\..*\\..*");
    LOK_ASSERT(matcher.match("192.168.1.1"));
    LOK_ASSERT(matcher.match("192.168.159.1"));
    LOK_ASSERT(matcher.match("192.168.1.134"));
    LOK_ASSERT(!matcher.match("192.169.1.1"));
    LOK_ASSERT(matcher.match("192.168.."));

    matcher.deny("192\\.168\\.1\\..*");
    LOK_ASSERT(!matcher.match("192.168.1.1"));

    matcher.allow("staging\\.collaboracloudsuite\\.com.*");
    matcher.deny(".*collaboracloudsuite.*");
    LOK_ASSERT(!matcher.match("staging.collaboracloudsuite"));
    LOK_ASSERT(!matcher.match("web.collaboracloudsuite"));
    LOK_ASSERT(!matcher.match("staging.collaboracloudsuite.com"));

    matcher.allow("10\\.10\\.[0-9]{1,3}\\.[0-9]{1,3}");
    matcher.deny("10\\.10\\.10\\.10");
    LOK_ASSERT(matcher.match("10.10.001.001"));
    LOK_ASSERT(!matcher.match("10.10.10.10"));
    LOK_ASSERT(matcher.match("10.10.250.254"));
}

void WhiteBoxTests::testRegexListMatcher_Init()
{
    Util::RegexListMatcher matcher({"localhost", "192\\..*"}, {"192\\.168\\..*"});

    LOK_ASSERT(matcher.match("localhost"));
    LOK_ASSERT(!matcher.match(""));
    LOK_ASSERT(!matcher.match("localhost2"));
    LOK_ASSERT(!matcher.match("xlocalhost"));
    LOK_ASSERT(!matcher.match("192.168.1.1"));
    LOK_ASSERT(matcher.match("192.172.10.122"));

    matcher.deny("localhost");
    LOK_ASSERT(!matcher.match("localhost"));

    matcher.allow("www[0-9].*");
    LOK_ASSERT(matcher.match("www1example"));

    matcher.allow("192\\.168\\..*\\..*");
    LOK_ASSERT(!matcher.match("192.168.1.1"));
    LOK_ASSERT(!matcher.match("192.168.159.1"));
    LOK_ASSERT(!matcher.match("192.168.1.134"));
    LOK_ASSERT(matcher.match("192.169.1.1"));
    LOK_ASSERT(!matcher.match("192.168.."));

    matcher.clear();

    matcher.allow("192\\.168\\..*\\..*");
    LOK_ASSERT(matcher.match("192.168.1.1"));
    LOK_ASSERT(matcher.match("192.168.159.1"));
    LOK_ASSERT(matcher.match("192.168.1.134"));
    LOK_ASSERT(!matcher.match("192.169.1.1"));
    LOK_ASSERT(matcher.match("192.168.."));
}

/// A stub DocumentManagerInterface implementation for unit test purposes.
class DummyDocument : public DocumentManagerInterface
{
    std::shared_ptr<TileQueue> _tileQueue;
    std::mutex _mutex;
    std::mutex _documentMutex;
public:
    DummyDocument()
        : _tileQueue(new TileQueue())
    {
    }

    bool onLoad(const std::string& /*sessionId*/,
                const std::string& /*uriAnonym*/,
                const std::string& /*renderOpts*/) override
    {
        return false;
    }

    void onUnload(const ChildSession& /*session*/) override
    {
    }

    std::shared_ptr<lok::Office> getLOKit() override
    {
        return nullptr;
    }

    std::shared_ptr<lok::Document> getLOKitDocument() override
    {
        return nullptr;
    }

    bool notifyAll(const std::string&) override
    {
        return true;
    }

    void notifyViewInfo() override
    {
    }

    void updateEditorSpeeds(int, int) override
    {
    }

    int getEditorId() const override
    {
        return -1;
    }

    std::map<int, UserInfo> getViewInfo() override
    {
        return {};
    }

    std::mutex& getMutex() override
    {
        return _mutex;
    }

    std::string getObfuscatedFileId() override
    {
        return std::string();
    }

    std::shared_ptr<TileQueue>& getTileQueue() override
    {
        return _tileQueue;
    }

    bool sendFrame(const char* /*buffer*/, int /*length*/, WSOpCode /*opCode*/) override
    {
        return true;
    }

    void alertAllUsers(const std::string& /*cmd*/, const std::string& /*kind*/) override
    {
    }

    unsigned getMobileAppDocId() const override
    {
        return 0;
    }
};

void WhiteBoxTests::testEmptyCellCursor()
{
    DummyDocument document;
    CallbackDescriptor callbackDescriptor{&document, 0};
    // This failed as stoi raised an std::invalid_argument exception.
    documentViewCallback(LOK_CALLBACK_CELL_CURSOR, "EMPTY", &callbackDescriptor);
}

void WhiteBoxTests::testTileDesc()
{
    // simulate a previous overflow
    errno = ERANGE;
    TileDesc desc = TileDesc::parse(
        "tile nviewid=0 part=5 width=256 height=256 tileposx=0 tileposy=12288 tilewidth=3072 tileheight=3072 oldwid=0 wid=0 ver=33");
    (void)desc; // exception in parse if we have problems.
    TileCombined combined = TileCombined::parse(
        "tilecombine nviewid=0 part=5 width=256 height=256 tileposx=0,3072,6144,9216,12288,15360,18432,21504,0,3072,6144,9216,12288,15360,18432,21504,0,3072,6144,9216,12288,15360,18432,21504,0,3072,6144,9216,12288,15360,18432,21504,0,3072,6144,9216,12288,15360,18432,21504,0,3072,6144,9216,12288,15360,18432,21504,0,3072,6144,9216,12288,15360,18432,21504 tileposy=0,0,0,0,0,0,0,0,3072,3072,3072,3072,3072,3072,3072,3072,6144,6144,6144,6144,6144,6144,6144,6144,9216,9216,9216,9216,9216,9216,9216,9216,12288,12288,12288,12288,12288,12288,12288,12288,15360,15360,15360,15360,15360,15360,15360,15360,18432,18432,18432,18432,18432,18432,18432,18432 oldwid=2,3,4,5,6,7,8,8,9,10,11,12,13,14,15,16,17,18,19,20,21,0,0,0,24,25,26,27,28,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 tilewidth=3072 tileheight=3072");
    (void)combined; // exception in parse if we have problems.
}

void WhiteBoxTests::testRectanglesIntersect()
{
    // these intersect
    LOK_ASSERT(TileDesc::rectanglesIntersect(1000, 1000, 2000, 1000,
                                                 2000, 1000, 2000, 1000));
    LOK_ASSERT(TileDesc::rectanglesIntersect(2000, 1000, 2000, 1000,
                                                 1000, 1000, 2000, 1000));

    LOK_ASSERT(TileDesc::rectanglesIntersect(1000, 1000, 2000, 1000,
                                                 3000, 2000, 1000, 1000));
    LOK_ASSERT(TileDesc::rectanglesIntersect(3000, 2000, 1000, 1000,
                                                 1000, 1000, 2000, 1000));

    // these don't
    LOK_ASSERT(!TileDesc::rectanglesIntersect(1000, 1000, 2000, 1000,
                                                  2000, 3000, 2000, 1000));
    LOK_ASSERT(!TileDesc::rectanglesIntersect(2000, 3000, 2000, 1000,
                                                  1000, 1000, 2000, 1000));

    LOK_ASSERT(!TileDesc::rectanglesIntersect(1000, 1000, 2000, 1000,
                                                  2000, 3000, 1000, 1000));
    LOK_ASSERT(!TileDesc::rectanglesIntersect(2000, 3000, 1000, 1000,
                                                  1000, 1000, 2000, 1000));
}

void WhiteBoxTests::testAuthorization()
{
    Authorization auth1(Authorization::Type::Token, "abc");
    Poco::URI uri1("http://localhost");
    auth1.authorizeURI(uri1);
    LOK_ASSERT_EQUAL(std::string("http://localhost/?access_token=abc"), uri1.toString());
    Poco::Net::HTTPRequest req1;
    auth1.authorizeRequest(req1);
    LOK_ASSERT_EQUAL(std::string("Bearer abc"), req1.get("Authorization"));

    Authorization auth1modify(Authorization::Type::Token, "modified");
    // still the same uri1, currently "http://localhost/?access_token=abc"
    auth1modify.authorizeURI(uri1);
    LOK_ASSERT_EQUAL(std::string("http://localhost/?access_token=modified"), uri1.toString());

    Authorization auth2(Authorization::Type::Header, "def");
    Poco::Net::HTTPRequest req2;
    auth2.authorizeRequest(req2);
    LOK_ASSERT(!req2.has("Authorization"));

    Authorization auth3(Authorization::Type::Header, "Authorization: Basic huhu== ");
    Poco::URI uri2("http://localhost");
    auth3.authorizeURI(uri2);
    // nothing added with the Authorization header approach
    LOK_ASSERT_EQUAL(std::string("http://localhost"), uri2.toString());
    Poco::Net::HTTPRequest req3;
    auth3.authorizeRequest(req3);
    LOK_ASSERT_EQUAL(std::string("Basic huhu=="), req3.get("Authorization"));

    Authorization auth4(Authorization::Type::Header, "  Authorization: Basic blah== \n\rX-Something:   additional  ");
    Poco::Net::HTTPRequest req4;
    auth4.authorizeRequest(req4);
    LOK_ASSERT_MESSAGE("Exected request to have Authorization header", req4.has("Authorization"));
    LOK_ASSERT_EQUAL(std::string("Basic blah=="), req4.get("Authorization"));
    LOK_ASSERT_MESSAGE("Exected request to have X-Something header", req4.has("X-Something"));
    LOK_ASSERT_EQUAL(std::string("additional"), req4.get("X-Something"));

    Authorization auth5(Authorization::Type::Header, "  Authorization: Basic huh== \n\rX-Something-More:   else  \n\r");
    Poco::Net::HTTPRequest req5;
    auth5.authorizeRequest(req5);
    LOK_ASSERT_EQUAL(std::string("Basic huh=="), req5.get("Authorization"));
    LOK_ASSERT_EQUAL(std::string("else"), req5.get("X-Something-More"));

    Authorization auth6(Authorization::Type::None, "Authorization: basic huh==");
    Poco::Net::HTTPRequest req6;
    CPPUNIT_ASSERT_NO_THROW(auth6.authorizeRequest(req6));

    {
        const std::string WorkingDocumentURI
            = "https://example.com:8443/rest/files/wopi/files/"
              "8ac75551de4d89e60002?access_header=Authorization%3A%2520Bearer%25201hpoiuytrewq%"
              "250D%250A%250D%250AX-Requested-With%3A%2520XMLHttpRequest&reuse_cookies=lang%3Den-"
              "us%3A_xx_%3DGS1.1.%3APublicToken%"
              "3DeyJzdWIiOiJhZG1pbiIsImV4cCI6MTU4ODkxNzc3NCwiaWF0IjoxNTg4OTE2ODc0LCJqdGkiOiI4OGZhN2"
              "E3ZC1lMzU5LTQ2OWEtYjg3Zi02NmFhNzI0ZGFkNTcifQ%3AZNPCQ003-32383700%3De9c71c3b%"
              "3AJSESSIONID%3Dnode019djohorurnaf1eo6f57ejhg0520.node0&permission=edit";

        const std::string AuthorizationParam = "Bearer 1hpoiuytrewq";

        Authorization auth(Authorization::create(WorkingDocumentURI));
        Poco::Net::HTTPRequest req;
        auth.authorizeRequest(req);
        LOK_ASSERT_EQUAL(AuthorizationParam, req.get("Authorization"));
        LOK_ASSERT_EQUAL(std::string("XMLHttpRequest"), req.get("X-Requested-With"));
    }

    {
        const std::string URI
            = "https://example.com:8443/rest/files/wopi/files/"
              "24e3f0a17230cca5017230fb6861000c?access_header=Authorization%3A%20Bearer%"
              "201hpoiuytrewq%0D%0A%0D%0AX-Requested-With%3A%20XMLHttpRequest";

        const std::string AuthorizationParam = "Bearer 1hpoiuytrewq";

        Authorization auth7(Authorization::create(URI));
        Poco::Net::HTTPRequest req7;
        auth7.authorizeRequest(req7);
        LOK_ASSERT_EQUAL(AuthorizationParam, req7.get("Authorization"));
        LOK_ASSERT_EQUAL(std::string("XMLHttpRequest"), req7.get("X-Requested-With"));
    }

    {
        const std::string URI
            = "https://example.com:8443/rest/files/wopi/files/"
              "8ac75551de4d89e60002?reuse_cookies=lang%3Den-us%3A_xx_%3DGS1.1.%3APublicToken%"
              "3DeyJzdWIiOiJhZG1pbiIsImV4cCI6MTU4ODkxNzc3NCwiaWF0IjoxNTg4OTE2ODc0LCJqdGkiOiI4OGZhN2"
              "E3ZC1lMzU5LTQ2OWEtYjg3Zi02NmFhNzI0ZGFkNTcifQ%3AZNPCQ003-32383700%3De9c71c3b%"
              "3AJSESSIONID%3Dnode019djohorurnaf1eo6f57ejhg0520.node0&permission=edit";

        Authorization auth7(Authorization::create(URI));
        Poco::Net::HTTPRequest req;
        auth7.authorizeRequest(req);
    }
}

void WhiteBoxTests::testJson()
{
    static const char* testString =
         "{\"BaseFileName\":\"SomeFile.pdf\",\"DisableCopy\":true,\"DisableExport\":true,\"DisableInactiveMessages\":true,\"DisablePrint\":true,\"EnableOwnerTermination\":true,\"HideExportOption\":true,\"HidePrintOption\":true,\"OwnerId\":\"id@owner.com\",\"PostMessageOrigin\":\"*\",\"Size\":193551,\"UserCanWrite\":true,\"UserFriendlyName\":\"Owning user\",\"UserId\":\"user@user.com\",\"WatermarkText\":null}";

    Poco::JSON::Object::Ptr object;
    LOK_ASSERT(JsonUtil::parseJSON(testString, object));

    size_t iValue = false;
    JsonUtil::findJSONValue(object, "Size", iValue);
    LOK_ASSERT_EQUAL(size_t(193551U), iValue);

    bool bValue = false;
    JsonUtil::findJSONValue(object, "DisableCopy", bValue);
    LOK_ASSERT_EQUAL(true, bValue);

    std::string sValue;
    JsonUtil::findJSONValue(object, "BaseFileName", sValue);
    LOK_ASSERT_EQUAL(std::string("SomeFile.pdf"), sValue);

    // Don't accept inexact key names.
    sValue.clear();
    JsonUtil::findJSONValue(object, "basefilename", sValue);
    LOK_ASSERT_EQUAL(std::string(), sValue);

    JsonUtil::findJSONValue(object, "invalid", sValue);
    LOK_ASSERT_EQUAL(std::string(), sValue);

    JsonUtil::findJSONValue(object, "UserId", sValue);
    LOK_ASSERT_EQUAL(std::string("user@user.com"), sValue);
}

void WhiteBoxTests::testAnonymization()
{
    static const std::string name = "some name with space";
    static const std::string filename = "filename.ext";
    static const std::string filenameTestx = "testx (6).odt";
    static const std::string path = "/path/to/filename.ext";
    static const std::string plainUrl
        = "http://localhost/owncloud/index.php/apps/richdocuments/wopi/files/"
          "736_ocgdpzbkm39u?access_token=Hn0zttjbwkvGWb5BHbDa5ArgTykJAyBl&access_token_ttl=0&"
          "permission=edit";
    static const std::string fileUrl = "http://localhost/owncloud/index.php/apps/richdocuments/"
                                       "wopi/files/736_ocgdpzbkm39u/"
                                       "secret.odt?access_token=Hn0zttjbwkvGWb5BHbDa5ArgTykJAyBl&"
                                       "access_token_ttl=0&permission=edit";

    std::uint64_t nAnonymizationSalt = 1111111111182589933;

    LOK_ASSERT_EQUAL(std::string("#0#5e45aef91248a8aa#"),
                         Util::anonymizeUrl(name, nAnonymizationSalt));
    LOK_ASSERT_EQUAL(std::string("#1#8f8d95bd2a202d00#.odt"),
                         Util::anonymizeUrl(filenameTestx, nAnonymizationSalt));
    LOK_ASSERT_EQUAL(std::string("/path/to/#2#5c872b2d82ecc8a0#.ext"),
                         Util::anonymizeUrl(path, nAnonymizationSalt));
    LOK_ASSERT_EQUAL(
        std::string("http://localhost/owncloud/index.php/apps/richdocuments/wopi/files/"
                    "#3#22c6f0caad277666#?access_token=Hn0zttjbwkvGWb5BHbDa5ArgTykJAyBl&access_"
                    "token_ttl=0&permission=edit"),
        Util::anonymizeUrl(plainUrl, nAnonymizationSalt));
    LOK_ASSERT_EQUAL(
        std::string("http://localhost/owncloud/index.php/apps/richdocuments/wopi/files/"
                    "736_ocgdpzbkm39u/"
                    "#4#294f0dfb18f6a80b#.odt?access_token=Hn0zttjbwkvGWb5BHbDa5ArgTykJAyBl&access_"
                    "token_ttl=0&permission=edit"),
        Util::anonymizeUrl(fileUrl, nAnonymizationSalt));

    nAnonymizationSalt = 0;

    LOK_ASSERT_EQUAL(std::string("#0#5e45aef91248a8aa#"), Util::anonymizeUrl(name, nAnonymizationSalt));
    Util::mapAnonymized(name, name);
    LOK_ASSERT_EQUAL(name, Util::anonymizeUrl(name, nAnonymizationSalt));

    LOK_ASSERT_EQUAL(std::string("#2#5c872b2d82ecc8a0#.ext"),
                         Util::anonymizeUrl(filename, nAnonymizationSalt));
    Util::mapAnonymized("filename", "filename"); // Identity map of the filename without extension.
    LOK_ASSERT_EQUAL(filename, Util::anonymizeUrl(filename, nAnonymizationSalt));

    LOK_ASSERT_EQUAL(std::string("#1#8f8d95bd2a202d00#.odt"),
                         Util::anonymizeUrl(filenameTestx, nAnonymizationSalt));
    Util::mapAnonymized("testx (6)",
                        "testx (6)"); // Identity map of the filename without extension.
    LOK_ASSERT_EQUAL(filenameTestx, Util::anonymizeUrl(filenameTestx, nAnonymizationSalt));

    LOK_ASSERT_EQUAL(path, Util::anonymizeUrl(path, nAnonymizationSalt));

    const std::string urlAnonymized = Util::replace(plainUrl, "736_ocgdpzbkm39u", "#3#22c6f0caad277666#");
    LOK_ASSERT_EQUAL(urlAnonymized, Util::anonymizeUrl(plainUrl, nAnonymizationSalt));
    Util::mapAnonymized("736_ocgdpzbkm39u", "736_ocgdpzbkm39u");
    LOK_ASSERT_EQUAL(plainUrl, Util::anonymizeUrl(plainUrl, nAnonymizationSalt));

    const std::string urlAnonymized2 = Util::replace(fileUrl, "secret", "#4#294f0dfb18f6a80b#");
    LOK_ASSERT_EQUAL(urlAnonymized2, Util::anonymizeUrl(fileUrl, nAnonymizationSalt));
    Util::mapAnonymized("secret", "736_ocgdpzbkm39u");
    const std::string urlAnonymized3 = Util::replace(fileUrl, "secret", "736_ocgdpzbkm39u");
    LOK_ASSERT_EQUAL(urlAnonymized3, Util::anonymizeUrl(fileUrl, nAnonymizationSalt));
}

void WhiteBoxTests::testTime()
{
    std::ostringstream oss;

    std::chrono::system_clock::time_point t(std::chrono::nanoseconds(1567444337874777375));
    LOK_ASSERT_EQUAL(std::string("2019-09-02T17:12:17.874777Z"),
                         Util::getIso8601FracformatTime(t));

    t = std::chrono::system_clock::time_point(std::chrono::nanoseconds(0));
    LOK_ASSERT_EQUAL(std::string("1970-01-01T00:00:00.000000Z"),
                         Util::getIso8601FracformatTime(t));

    t = Util::iso8601ToTimestamp("1970-01-01T00:00:00.000000Z", "LastModifiedTime");
    oss << t.time_since_epoch().count();
    LOK_ASSERT_EQUAL(std::string("0"), oss.str());
    LOK_ASSERT_EQUAL(std::string("1970-01-01T00:00:00.000000Z"),
                         Util::time_point_to_iso8601(t));

    oss.str(std::string());
    t = Util::iso8601ToTimestamp("2019-09-02T17:12:17.874777Z", "LastModifiedTime");
    oss << t.time_since_epoch().count();
    LOK_ASSERT_EQUAL(std::string("1567444337874777000"), oss.str());
    LOK_ASSERT_EQUAL(std::string("2019-09-02T17:12:17.874777Z"),
                         Util::time_point_to_iso8601(t));

    oss.str(std::string());
    t = Util::iso8601ToTimestamp("2019-10-24T14:31:28.063730Z", "LastModifiedTime");
    oss << t.time_since_epoch().count();
    LOK_ASSERT_EQUAL(std::string("1571927488063730000"), oss.str());
    LOK_ASSERT_EQUAL(std::string("2019-10-24T14:31:28.063730Z"),
                         Util::time_point_to_iso8601(t));

    t = Util::iso8601ToTimestamp("2020-02-20T20:02:20.100000Z", "LastModifiedTime");
    LOK_ASSERT_EQUAL(std::string("2020-02-20T20:02:20.100000Z"),
                         Util::time_point_to_iso8601(t));

    t = std::chrono::system_clock::time_point();
    LOK_ASSERT_EQUAL(std::string("Thu, 01 Jan 1970 00:00:00"), Util::getHttpTime(t));

    t = std::chrono::system_clock::time_point(std::chrono::nanoseconds(1569592993495336798));
    LOK_ASSERT_EQUAL(std::string("Fri, 27 Sep 2019 14:03:13"), Util::getHttpTime(t));

    t = Util::iso8601ToTimestamp("2020-09-22T21:45:12.583000Z", "LastModifiedTime");
    LOK_ASSERT_EQUAL(std::string("2020-09-22T21:45:12.583000Z"),
                         Util::time_point_to_iso8601(t));

    t = Util::iso8601ToTimestamp("2020-09-22T21:45:12.583Z", "LastModifiedTime");
    LOK_ASSERT_EQUAL(std::string("2020-09-22T21:45:12.583000Z"),
                         Util::time_point_to_iso8601(t));

    for (int i = 0; i < 100; ++i)
    {
        t = std::chrono::system_clock::now();
        const uint64_t t_in_micros = (t.time_since_epoch().count() / 1000) * 1000;

        const std::string s = Util::getIso8601FracformatTime(t);
        t = Util::iso8601ToTimestamp(s, "LastModifiedTime");
        LOK_ASSERT_EQUAL(std::to_string(t_in_micros),
                             std::to_string(t.time_since_epoch().count()));

        // Allow a small delay to get a different timestamp on next iteration.
        sleep(0);
    }
}

void WhiteBoxTests::testBufferClass()
{
    Buffer buf;
    CPPUNIT_ASSERT_EQUAL(0UL, buf.size());
    CPPUNIT_ASSERT_EQUAL(true, buf.empty());
    CPPUNIT_ASSERT(buf.getBlock() == nullptr);
    buf.eraseFirst(buf.size());
    CPPUNIT_ASSERT_EQUAL(0UL, buf.size());
    CPPUNIT_ASSERT_EQUAL(true, buf.empty());

    // Small data.
    const char data[] = "abcdefghijklmnop";
    buf.append(data, sizeof(data));

    CPPUNIT_ASSERT_EQUAL(static_cast<std::size_t>(sizeof(data)), buf.size());
    CPPUNIT_ASSERT_EQUAL(false, buf.empty());
    CPPUNIT_ASSERT(buf.getBlock() != nullptr);
    CPPUNIT_ASSERT_EQUAL(0, memcmp(buf.getBlock(), data, buf.size()));

    // Erase one char at a time.
    for (std::size_t i = buf.size(); i > 0; --i)
    {
        buf.eraseFirst(1);
        CPPUNIT_ASSERT_EQUAL(i - 1, buf.size());
        CPPUNIT_ASSERT_EQUAL(i == 1, buf.empty()); // Not empty until the last element.
        CPPUNIT_ASSERT_EQUAL(buf.getBlock() != nullptr, !buf.empty());
        if (!buf.empty())
            CPPUNIT_ASSERT_EQUAL(0, memcmp(buf.getBlock(), data + (sizeof(data) - i) + 1, buf.size()));
    }

    // Large data.
    constexpr std::size_t BlockSize = 512 * 1024; // We add twice this.
    constexpr std::size_t BlockCount = 10;
    for (std::size_t i = 0; i < BlockCount; ++i)
    {
        const auto prevSize = buf.size();

        const std::vector<char> dataLarge(2 * BlockSize, 'a' + i); // Block of a single char.
        buf.append(dataLarge.data(), dataLarge.size());
        CPPUNIT_ASSERT_EQUAL(prevSize + (2 * BlockSize), buf.size());

        // Remove half.
        buf.eraseFirst(BlockSize);
        CPPUNIT_ASSERT_EQUAL(prevSize + BlockSize, buf.size());
        CPPUNIT_ASSERT_EQUAL(0, memcmp(buf.getBlock() + prevSize, dataLarge.data(), BlockSize));
    }

    CPPUNIT_ASSERT_EQUAL(BlockSize * BlockCount, buf.size());
    CPPUNIT_ASSERT_EQUAL(false, buf.empty());

    // Remove each block of data and test.
    for (std::size_t i = BlockCount / 2; i < BlockCount; ++i) // We removed half above.
    {
        CPPUNIT_ASSERT_EQUAL(false, buf.empty());
        CPPUNIT_ASSERT_EQUAL(BlockSize * 2 * (BlockCount - i), buf.size());

        const std::vector<char> dataLarge(BlockSize * 2, 'a' + i); // Block of a single char.
        CPPUNIT_ASSERT_EQUAL(0, memcmp(buf.getBlock(), dataLarge.data(), BlockSize));

        buf.eraseFirst(BlockSize * 2);
    }

    CPPUNIT_ASSERT_EQUAL(0UL, buf.size());
    CPPUNIT_ASSERT_EQUAL(true, buf.empty());

    // Very large data.
    const std::vector<char> dataLarge(20 * BlockSize, 'x'); // Block of a single char.
    buf.append(dataLarge.data(), dataLarge.size());
    CPPUNIT_ASSERT_EQUAL(dataLarge.size(), buf.size());

    buf.append(data, sizeof(data)); // Add small data.
    CPPUNIT_ASSERT_EQUAL(dataLarge.size() + sizeof(data), buf.size());

    buf.eraseFirst(dataLarge.size()); // Remove large data.
    CPPUNIT_ASSERT_EQUAL(sizeof(data), buf.size());
    CPPUNIT_ASSERT_EQUAL(false, buf.empty());
    CPPUNIT_ASSERT_EQUAL(0, memcmp(buf.getBlock(), data, buf.size()));

    buf.eraseFirst(buf.size()); // Remove all.
    CPPUNIT_ASSERT_EQUAL(0UL, buf.size());
    CPPUNIT_ASSERT_EQUAL(true, buf.empty());
}

void WhiteBoxTests::testStringVector()
{
    // Test push_back() and getParam().
    StringVector vector;
    vector.push_back("a");
    vector.push_back("b");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(2), vector.size());
    auto it = vector.begin();
    CPPUNIT_ASSERT_EQUAL(std::string("a"), vector.getParam(*it));
    ++it;
    CPPUNIT_ASSERT_EQUAL(std::string("b"), vector.getParam(*it));

    // Test cat().
    CPPUNIT_ASSERT_EQUAL(std::string("a b"), vector.cat(" ", 0));
    CPPUNIT_ASSERT_EQUAL(std::string("a b"), vector.cat(' ', 0));
    CPPUNIT_ASSERT_EQUAL(std::string("a*b"), vector.cat('*', 0));
    CPPUNIT_ASSERT_EQUAL(std::string("a blah mlah b"), vector.cat(" blah mlah ", 0));
    CPPUNIT_ASSERT_EQUAL(std::string(), vector.cat(" ", 3));
    CPPUNIT_ASSERT_EQUAL(std::string(), vector.cat(" ", 42));

    // Test operator []().
    CPPUNIT_ASSERT_EQUAL(std::string("a"), vector[0]);
    CPPUNIT_ASSERT_EQUAL(std::string(""), vector[2]);

    // Test equals().
    CPPUNIT_ASSERT(vector.equals(0, "a"));
    CPPUNIT_ASSERT(!vector.equals(0, "A"));
    CPPUNIT_ASSERT(vector.equals(1, "b"));
    CPPUNIT_ASSERT(!vector.equals(1, "B"));
    CPPUNIT_ASSERT(!vector.equals(2, ""));

    // Test equals(), StringVector argument version.
    StringVector vector2;
    vector2.push_back("a");
    vector2.push_back("B");

    CPPUNIT_ASSERT(vector.equals(0, vector2, 0));
    CPPUNIT_ASSERT(!vector.equals(0, vector2, 1));
}

void WhiteBoxTests::testRequestDetails_DownloadURI()
{
    static const std::string Root = "localhost:9980";

    {
        static const std::string URI = "/loleaflet/49c225146/src/map/Clipboard.js";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, URI,
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        request.setHost(Root);

        RequestDetails details(request, "");

        // LOK_ASSERT_EQUAL(URI, details.getDocumentURI());

        LOK_ASSERT_EQUAL(static_cast<std::size_t>(5), details.size());
        LOK_ASSERT_EQUAL(std::string("loleaflet"), details[0]);
        LOK_ASSERT_EQUAL(std::string("loleaflet"), details.getField(RequestDetails::Field::Type));
        LOK_ASSERT(details.equals(RequestDetails::Field::Type, "loleaflet"));
        LOK_ASSERT(details.equals(0, "loleaflet"));
        LOK_ASSERT_EQUAL(std::string("49c225146"), details[1]);
        LOK_ASSERT_EQUAL(std::string("src"), details[2]);
        LOK_ASSERT_EQUAL(std::string("map"), details[3]);
        LOK_ASSERT_EQUAL(std::string("Clipboard.js"), details[4]);
    }

    {
        static const std::string URI = "/loleaflet/49c225146/select2.css";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, URI,
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        request.setHost(Root);

        RequestDetails details(request, "");

        // LOK_ASSERT_EQUAL(URI, details.getDocumentURI());

        LOK_ASSERT_EQUAL(static_cast<std::size_t>(3), details.size());
        LOK_ASSERT_EQUAL(std::string("loleaflet"), details[0]);
        LOK_ASSERT_EQUAL(std::string("loleaflet"), details.getField(RequestDetails::Field::Type));
        LOK_ASSERT(details.equals(RequestDetails::Field::Type, "loleaflet"));
        LOK_ASSERT(details.equals(0, "loleaflet"));
        LOK_ASSERT_EQUAL(std::string("49c225146"), details[1]);
        LOK_ASSERT_EQUAL(std::string("select2.css"), details[2]);
    }
}

void WhiteBoxTests::testRequestDetails_loleafletURI()
{
    static const std::string Root = "localhost:9980";

    static const std::string URI
        = "/loleaflet/49c225146/"
          "loleaflet.html?WOPISrc=http%3A%2F%2Flocalhost%2Fnextcloud%2Findex.php%2Fapps%"
          "2Frichdocuments%2Fwopi%2Ffiles%2F593_ocqiesh0cngs&title=empty.odt&lang=en-us&"
          "closebutton=1&revisionhistory=1";

    Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, URI,
                                   Poco::Net::HTTPMessage::HTTP_1_1);
    request.setHost(Root);

    RequestDetails details(request, "");

    const std::string wopiSrc
        = "http://localhost/nextcloud/index.php/apps/richdocuments/wopi/files/593_ocqiesh0cngs";

    LOK_ASSERT_EQUAL(wopiSrc, details.getField(RequestDetails::Field::WOPISrc));

    LOK_ASSERT_EQUAL(static_cast<std::size_t>(4), details.size());
    LOK_ASSERT_EQUAL(std::string("loleaflet"), details[0]);
    LOK_ASSERT_EQUAL(std::string("loleaflet"), details.getField(RequestDetails::Field::Type));
    LOK_ASSERT(details.equals(RequestDetails::Field::Type, "loleaflet"));
    LOK_ASSERT(details.equals(0, "loleaflet"));
    LOK_ASSERT_EQUAL(std::string("49c225146"), details[1]);
    LOK_ASSERT_EQUAL(std::string("loleaflet.html"), details[2]);
    LOK_ASSERT_EQUAL(std::string("WOPISrc=http%3A%2F%2Flocalhost%2Fnextcloud%2Findex.php%"
                                 "2Fapps%2Frichdocuments%2Fwopi%2Ffiles%2F593_ocqiesh0cngs&"
                                 "title=empty.odt&lang=en-us&closebutton=1&revisionhistory=1"),
                     details[3]);
}

void WhiteBoxTests::testRequestDetails_local()
{
    static const std::string Root = "localhost:9980";

    static const std::string ProxyPrefix
        = "http://localhost/nextcloud/apps/richdocuments/proxy.php?req=";

    {
        static const std::string URI = "/lool/"
                                       "file%3A%2F%2F%2Fhome%2Fash%2Fprj%2Flo%2Fonline%2Ftest%"
                                       "2Fdata%2Fhello-world.odt/ws/open/open/0";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, URI,
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        request.setHost(Root);
        request.set("User-Agent", WOPI_AGENT_STRING);
        request.set("ProxyPrefix", ProxyPrefix);

        RequestDetails details(request, "");
        LOK_ASSERT_EQUAL(true, details.isProxy());
        LOK_ASSERT_EQUAL(ProxyPrefix, details.getProxyPrefix());

        LOK_ASSERT_EQUAL(Root, details.getHostUntrusted());
        LOK_ASSERT_EQUAL(false, details.isWebSocket());
        LOK_ASSERT_EQUAL(true, details.isGet());

        const std::string docUri = "file:///home/ash/prj/lo/online/test/data/hello-world.odt";

        LOK_ASSERT_EQUAL(docUri, details.getLegacyDocumentURI());
        LOK_ASSERT_EQUAL(docUri, details.getDocumentURI());

        LOK_ASSERT_EQUAL(static_cast<std::size_t>(6), details.size());
        LOK_ASSERT_EQUAL(std::string("lool"), details[0]);
        LOK_ASSERT(details.equals(0, "lool"));
        LOK_ASSERT_EQUAL(
            std::string(
                "file%3A%2F%2F%2Fhome%2Fash%2Fprj%2Flo%2Fonline%2Ftest%2Fdata%2Fhello-world.odt"),
            details[1]);
        LOK_ASSERT_EQUAL(std::string("ws"), details[2]);
        LOK_ASSERT_EQUAL(std::string("open"), details[3]);
        LOK_ASSERT_EQUAL(std::string("open"), details[4]);
        LOK_ASSERT_EQUAL(std::string("0"), details[5]);

        LOK_ASSERT_EQUAL(std::string("lool"), details.getField(RequestDetails::Field::Type));
        LOK_ASSERT(details.equals(RequestDetails::Field::Type, "lool"));
        LOK_ASSERT_EQUAL(std::string("open"), details.getField(RequestDetails::Field::SessionId));
        LOK_ASSERT(details.equals(RequestDetails::Field::SessionId, "open"));
        LOK_ASSERT_EQUAL(std::string("open"), details.getField(RequestDetails::Field::Command));
        LOK_ASSERT(details.equals(RequestDetails::Field::Command, "open"));
        LOK_ASSERT_EQUAL(std::string("0"), details.getField(RequestDetails::Field::Serial));
        LOK_ASSERT(details.equals(RequestDetails::Field::Serial, "0"));
    }

    {
        // Blank entries are skipped.
        static const std::string URI = "/lool/"
                                       "file%3A%2F%2F%2Fhome%2Fash%2Fprj%2Flo%2Fonline%2Ftest%"
                                       "2Fdata%2Fhello-world.odt/ws//write/2";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, URI,
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        request.setHost(Root);
        request.set("User-Agent", WOPI_AGENT_STRING);
        request.set("ProxyPrefix", ProxyPrefix);

        RequestDetails details(request, "");
        LOK_ASSERT_EQUAL(true, details.isProxy());
        LOK_ASSERT_EQUAL(ProxyPrefix, details.getProxyPrefix());

        LOK_ASSERT_EQUAL(Root, details.getHostUntrusted());
        LOK_ASSERT_EQUAL(false, details.isWebSocket());
        LOK_ASSERT_EQUAL(true, details.isGet());

        const std::string docUri = "file:///home/ash/prj/lo/online/test/data/hello-world.odt";

        LOK_ASSERT_EQUAL(docUri, details.getDocumentURI());

        LOK_ASSERT_EQUAL(static_cast<std::size_t>(5), details.size());
        LOK_ASSERT_EQUAL(std::string("lool"), details[0]);
        LOK_ASSERT(details.equals(0, "lool"));
        LOK_ASSERT_EQUAL(
            std::string(
                "file%3A%2F%2F%2Fhome%2Fash%2Fprj%2Flo%2Fonline%2Ftest%2Fdata%2Fhello-world.odt"),
            details[1]);
        LOK_ASSERT_EQUAL(std::string("ws"), details[2]);
        LOK_ASSERT_EQUAL(std::string("write"), details[3]); // SessionId, since the real SessionId is blank.
        LOK_ASSERT_EQUAL(std::string("2"), details[4]); // Command, since SessionId was blank.

        LOK_ASSERT_EQUAL(std::string("lool"), details.getField(RequestDetails::Field::Type));
        LOK_ASSERT(details.equals(RequestDetails::Field::Type, "lool"));
        LOK_ASSERT_EQUAL(std::string("write"), details.getField(RequestDetails::Field::SessionId));
        LOK_ASSERT(details.equals(RequestDetails::Field::SessionId, "write"));
        LOK_ASSERT_EQUAL(std::string("2"), details.getField(RequestDetails::Field::Command));
        LOK_ASSERT(details.equals(RequestDetails::Field::Command, "2"));
        LOK_ASSERT_EQUAL(std::string(""), details.getField(RequestDetails::Field::Serial));
        LOK_ASSERT(details.equals(RequestDetails::Field::Serial, ""));
    }

    {
        // Apparently, the initial / can be missing -- all the tests do that.
        static const std::string URI = "lool/"
                                       "file%3A%2F%2F%2Fhome%2Fash%2Fprj%2Flo%2Fonline%2Ftest%"
                                       "2Fdata%2Fhello-world.odt/ws//write/2";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, URI,
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        request.setHost(Root);
        request.set("User-Agent", WOPI_AGENT_STRING);
        request.set("ProxyPrefix", ProxyPrefix);

        RequestDetails details(request, "");
        LOK_ASSERT_EQUAL(true, details.isProxy());
        LOK_ASSERT_EQUAL(ProxyPrefix, details.getProxyPrefix());

        LOK_ASSERT_EQUAL(Root, details.getHostUntrusted());
        LOK_ASSERT_EQUAL(false, details.isWebSocket());
        LOK_ASSERT_EQUAL(true, details.isGet());

        const std::string docUri = "file:///home/ash/prj/lo/online/test/data/hello-world.odt";

        LOK_ASSERT_EQUAL(docUri, details.getDocumentURI());

        LOK_ASSERT_EQUAL(static_cast<std::size_t>(5), details.size());
        LOK_ASSERT_EQUAL(std::string("lool"), details[0]);
        LOK_ASSERT(details.equals(0, "lool"));
        LOK_ASSERT_EQUAL(
            std::string(
                "file%3A%2F%2F%2Fhome%2Fash%2Fprj%2Flo%2Fonline%2Ftest%2Fdata%2Fhello-world.odt"),
            details[1]);
        LOK_ASSERT_EQUAL(std::string("ws"), details[2]);
        LOK_ASSERT_EQUAL(std::string("write"), details[3]); // SessionId, since the real SessionId is blank.
        LOK_ASSERT_EQUAL(std::string("2"), details[4]); // Command, since SessionId was blank.

        LOK_ASSERT_EQUAL(std::string("lool"), details.getField(RequestDetails::Field::Type));
        LOK_ASSERT(details.equals(RequestDetails::Field::Type, "lool"));
        LOK_ASSERT_EQUAL(std::string("write"), details.getField(RequestDetails::Field::SessionId));
        LOK_ASSERT(details.equals(RequestDetails::Field::SessionId, "write"));
        LOK_ASSERT_EQUAL(std::string("2"), details.getField(RequestDetails::Field::Command));
        LOK_ASSERT(details.equals(RequestDetails::Field::Command, "2"));
        LOK_ASSERT_EQUAL(std::string(""), details.getField(RequestDetails::Field::Serial));
        LOK_ASSERT(details.equals(RequestDetails::Field::Serial, ""));
    }
}

void WhiteBoxTests::testRequestDetails()
{
    static const std::string Root = "localhost:9980";

    static const std::string ProxyPrefix
        = "http://localhost/nextcloud/apps/richdocuments/proxy.php?req=";

    {
        static const std::string URI
            = "/lool/"
              "http%3A%2F%2Flocalhost%2Fnextcloud%2Findex.php%2Fapps%2Frichdocuments%2Fwopi%"
              "2Ffiles%"
              "2F593_ocqiesh0cngs%3Faccess_token%3DMN0KXXDv9GJ1wCCLnQcjVQT2T7WrfYpA%26access_token_"
              "ttl%"
              "3D0%26reuse_cookies%3Doc_sessionPassphrase%"
              "253D8nFRqycbs7bP97yxCuJviBbVKdCXmuiXp6ZYH0DfUoy5UZDCTQgLwluvbgRbKrdKodJteG3uNE19KNUA"
              "oE5t"
              "ypf4oBGwJdFY%25252F5W9RNST8wEHWkUVIjZy7vmY0ZX38PlS%253Anc_sameSiteCookielax%"
              "253Dtrue%"
              "253Anc_sameSiteCookiestrict%253Dtrue%253Aocqiesh0cngs%"
              "253Dr5ujg4tpvgu9paaf5bguiokgjl%"
              "253AXCookieName%253DXCookieValue%253ASuperCookieName%253DBAZINGA/"
              "ws?WOPISrc=http%3A%2F%2Flocalhost%2Fnextcloud%2Findex.php%2Fapps%2Frichdocuments%"
              "2Fwopi%"
              "2Ffiles%2F593_ocqiesh0cngs&compat=/ws/b26112ab1b6f2ed98ce1329f0f344791/close/31";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, URI,
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        request.setHost(Root);
        request.set("User-Agent", WOPI_AGENT_STRING);
        request.set("ProxyPrefix", ProxyPrefix);

        RequestDetails details(request, "");
        LOK_ASSERT_EQUAL(true, details.isProxy());
        LOK_ASSERT_EQUAL(ProxyPrefix, details.getProxyPrefix());

        LOK_ASSERT_EQUAL(Root, details.getHostUntrusted());
        LOK_ASSERT_EQUAL(false, details.isWebSocket());
        LOK_ASSERT_EQUAL(true, details.isGet());

        LOK_ASSERT_EQUAL(std::string("b26112ab1b6f2ed98ce1329f0f344791"), details.getField(RequestDetails::Field::SessionId));
        LOK_ASSERT_EQUAL(std::string("close"), details.getField(RequestDetails::Field::Command));
        LOK_ASSERT_EQUAL(std::string("31"), details.getField(RequestDetails::Field::Serial));

        const std::string docUri_WopiSrc
            = "http://localhost/nextcloud/index.php/apps/richdocuments/wopi/files/"
              "593_ocqiesh0cngs?access_token=MN0KXXDv9GJ1wCCLnQcjVQT2T7WrfYpA&access_token_ttl=0&"
              "reuse_"
              "cookies=oc_sessionPassphrase%"
              "3D8nFRqycbs7bP97yxCuJviBbVKdCXmuiXp6ZYH0DfUoy5UZDCTQgLwluvbgRbKrdKodJteG3uNE19KNUAoE"
              "5typ"
              "f4oBGwJdFY%252F5W9RNST8wEHWkUVIjZy7vmY0ZX38PlS%3Anc_sameSiteCookielax%3Dtrue%3Anc_"
              "sameSiteCookiestrict%3Dtrue%3Aocqiesh0cngs%3Dr5ujg4tpvgu9paaf5bguiokgjl%"
              "3AXCookieName%"
              "3DXCookieValue%3ASuperCookieName%3DBAZINGA/ws?WOPISrc=http://localhost/nextcloud/"
              "index.php/apps/richdocuments/wopi/files/593_ocqiesh0cngs&compat=";

        LOK_ASSERT_EQUAL(docUri_WopiSrc, details.getLegacyDocumentURI());

        const std::string docUri
            = "http://localhost/nextcloud/index.php/apps/richdocuments/wopi/files/"
              "593_ocqiesh0cngs?access_token=MN0KXXDv9GJ1wCCLnQcjVQT2T7WrfYpA&access_token_ttl=0&"
              "reuse_"
              "cookies=oc_sessionPassphrase%"
              "3D8nFRqycbs7bP97yxCuJviBbVKdCXmuiXp6ZYH0DfUoy5UZDCTQgLwluvbgRbKrdKodJteG3uNE19KNUAoE"
              "5typ"
              "f4oBGwJdFY%252F5W9RNST8wEHWkUVIjZy7vmY0ZX38PlS%3Anc_sameSiteCookielax%3Dtrue%3Anc_"
              "sameSiteCookiestrict%3Dtrue%3Aocqiesh0cngs%3Dr5ujg4tpvgu9paaf5bguiokgjl%"
              "3AXCookieName%"
              "3DXCookieValue%3ASuperCookieName%3DBAZINGA";

        LOK_ASSERT_EQUAL(docUri, details.getDocumentURI());

        const std::string wopiSrc
            = "http://localhost/nextcloud/index.php/apps/richdocuments/wopi/files/593_ocqiesh0cngs";

        LOK_ASSERT_EQUAL(wopiSrc, details.getField(RequestDetails::Field::WOPISrc));

        LOK_ASSERT_EQUAL(static_cast<std::size_t>(8), details.size());
        LOK_ASSERT_EQUAL(std::string("lool"), details[0]);
        LOK_ASSERT_EQUAL(std::string("lool"), details.getField(RequestDetails::Field::Type));
        LOK_ASSERT(details.equals(RequestDetails::Field::Type, "lool"));
        LOK_ASSERT(details.equals(0, "lool"));
        LOK_ASSERT_EQUAL(
            std::string(
                "http%3A%2F%2Flocalhost%2Fnextcloud%2Findex.php%2Fapps%2Frichdocuments%2Fwopi%"
                "2Ffiles%2F593_ocqiesh0cngs%3Faccess_token%3DMN0KXXDv9GJ1wCCLnQcjVQT2T7WrfYpA%"
                "26access_token_ttl%3D0%26reuse_cookies%3Doc_sessionPassphrase%"
                "253D8nFRqycbs7bP97yxCuJviBbVKdCXmuiXp6ZYH0DfUoy5UZDCTQgLwluvbgRbKrdKodJteG3uNE"
                "19KNUAoE5typf4oBGwJdFY%25252F5W9RNST8wEHWkUVIjZy7vmY0ZX38PlS%253Anc_"
                "sameSiteCookielax%253Dtrue%253Anc_sameSiteCookiestrict%253Dtrue%"
                "253Aocqiesh0cngs%253Dr5ujg4tpvgu9paaf5bguiokgjl%253AXCookieName%"
                "253DXCookieValue%253ASuperCookieName%253DBAZINGA"),
            details[1]);
        LOK_ASSERT_EQUAL(std::string("ws"), details[2]);
        LOK_ASSERT_EQUAL(
            std::string("WOPISrc=http%3A%2F%2Flocalhost%2Fnextcloud%2Findex.php%2Fapps%"
                        "2Frichdocuments%2Fwopi%2Ffiles%2F593_ocqiesh0cngs&compat="),
            details[3]);
        LOK_ASSERT_EQUAL(std::string("ws"), details[4]);
        LOK_ASSERT_EQUAL(std::string("b26112ab1b6f2ed98ce1329f0f344791"), details[5]);
        LOK_ASSERT_EQUAL(std::string("close"), details[6]);
        LOK_ASSERT_EQUAL(std::string("31"), details[7]);

        LOK_ASSERT_EQUAL(std::string("lool"), details.getField(RequestDetails::Field::Type));
        LOK_ASSERT(details.equals(RequestDetails::Field::Type, "lool"));
        LOK_ASSERT_EQUAL(std::string("b26112ab1b6f2ed98ce1329f0f344791"), details.getField(RequestDetails::Field::SessionId));
        LOK_ASSERT(details.equals(RequestDetails::Field::SessionId, "b26112ab1b6f2ed98ce1329f0f344791"));
        LOK_ASSERT_EQUAL(std::string("close"), details.getField(RequestDetails::Field::Command));
        LOK_ASSERT(details.equals(RequestDetails::Field::Command, "close"));
        LOK_ASSERT_EQUAL(std::string("31"), details.getField(RequestDetails::Field::Serial));
        LOK_ASSERT(details.equals(RequestDetails::Field::Serial, "31"));
    }

    {
        static const std::string URI
            = "/lool/"
              "http%3A%2F%2Flocalhost%2Fowncloud%2Findex.php%2Fapps%2Frichdocuments%2Fwopi%2Ffiles%"
              "2F165_ocgdpzbkm39u%3Faccess_token%3DODhIXdJdbsVYQoKKCuaYofyzrovxD3MQ%26access_token_"
              "ttl%"
              "3D0%26reuse_cookies%3DXCookieName%253DXCookieValue%253ASuperCookieName%253DBAZINGA/"
              "ws?WOPISrc=http%3A%2F%2Flocalhost%2Fowncloud%2Findex.php%2Fapps%2Frichdocuments%"
              "2Fwopi%"
              "2Ffiles%2F165_ocgdpzbkm39u&compat=/ws/1c99a7bcdbf3209782d7eb38512e6564/write/2";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, URI,
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        request.setHost(Root);
        request.set("User-Agent", WOPI_AGENT_STRING);
        request.set("ProxyPrefix", ProxyPrefix);

        RequestDetails details(request, "");
        LOK_ASSERT_EQUAL(true, details.isProxy());
        LOK_ASSERT_EQUAL(ProxyPrefix, details.getProxyPrefix());

        LOK_ASSERT_EQUAL(Root, details.getHostUntrusted());
        LOK_ASSERT_EQUAL(false, details.isWebSocket());
        LOK_ASSERT_EQUAL(true, details.isGet());

        const std::string docUri_WopiSrc
            = "http://localhost/owncloud/index.php/apps/richdocuments/wopi/files/"
              "165_ocgdpzbkm39u?access_token=ODhIXdJdbsVYQoKKCuaYofyzrovxD3MQ&access_token_ttl=0&"
              "reuse_cookies=XCookieName%3DXCookieValue%3ASuperCookieName%3DBAZINGA/"
              "ws?WOPISrc=http://localhost/owncloud/index.php/apps/richdocuments/wopi/files/"
              "165_ocgdpzbkm39u&compat=";

        LOK_ASSERT_EQUAL(docUri_WopiSrc, details.getLegacyDocumentURI());

        const std::string docUri
            = "http://localhost/owncloud/index.php/apps/richdocuments/wopi/files/"
              "165_ocgdpzbkm39u?access_token=ODhIXdJdbsVYQoKKCuaYofyzrovxD3MQ&access_token_ttl=0&"
              "reuse_cookies=XCookieName%3DXCookieValue%3ASuperCookieName%3DBAZINGA";

        LOK_ASSERT_EQUAL(docUri, details.getDocumentURI());

        const std::string wopiSrc
            = "http://localhost/owncloud/index.php/apps/richdocuments/wopi/files/"
              "165_ocgdpzbkm39u";

        LOK_ASSERT_EQUAL(wopiSrc, details.getField(RequestDetails::Field::WOPISrc));

        LOK_ASSERT_EQUAL(static_cast<std::size_t>(8), details.size());
        LOK_ASSERT_EQUAL(std::string("lool"), details[0]);
        LOK_ASSERT(details.equals(0, "lool"));
        LOK_ASSERT_EQUAL(
            std::string("http%3A%2F%2Flocalhost%2Fowncloud%2Findex.php%2Fapps%2Frichdocuments%"
                        "2Fwopi%2Ffiles%2F165_ocgdpzbkm39u%3Faccess_token%"
                        "3DODhIXdJdbsVYQoKKCuaYofyzrovxD3MQ%26access_token_ttl%3D0%26reuse_cookies%"
                        "3DXCookieName%253DXCookieValue%253ASuperCookieName%253DBAZINGA"),
            details[1]);
        LOK_ASSERT_EQUAL(std::string("ws"), details[2]);
        LOK_ASSERT_EQUAL(
            std::string("WOPISrc=http%3A%2F%2Flocalhost%2Fowncloud%2Findex.php%2Fapps%"
                        "2Frichdocuments%2Fwopi%2Ffiles%2F165_ocgdpzbkm39u&compat="),
            details[3]);
        LOK_ASSERT_EQUAL(std::string("ws"), details[4]);
        LOK_ASSERT_EQUAL(std::string("1c99a7bcdbf3209782d7eb38512e6564"), details[5]);
        LOK_ASSERT_EQUAL(std::string("write"), details[6]);
        LOK_ASSERT_EQUAL(std::string("2"), details[7]);

        LOK_ASSERT_EQUAL(std::string("lool"), details.getField(RequestDetails::Field::Type));
        LOK_ASSERT(details.equals(RequestDetails::Field::Type, "lool"));
        LOK_ASSERT_EQUAL(std::string("1c99a7bcdbf3209782d7eb38512e6564"), details.getField(RequestDetails::Field::SessionId));
        LOK_ASSERT(details.equals(RequestDetails::Field::SessionId, "1c99a7bcdbf3209782d7eb38512e6564"));
        LOK_ASSERT_EQUAL(std::string("write"), details.getField(RequestDetails::Field::Command));
        LOK_ASSERT(details.equals(RequestDetails::Field::Command, "write"));
        LOK_ASSERT_EQUAL(std::string("2"), details.getField(RequestDetails::Field::Serial));
        LOK_ASSERT(details.equals(RequestDetails::Field::Serial, "2"));
    }

    {
        static const std::string URI
            = "/lool/%2Ftmp%2Fslideshow_b8c3225b_setclientpart.odp/Ar3M1X89mVaryYkh/"
              "UjaCGP4cYHlU6TvUGdnFTPi8hjOS87uFym7ruWMq3F3jBr0kSPgVhbKz5CwUyV8R/slideshow.svg";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, URI,
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        request.setHost(Root);
        request.set("User-Agent", WOPI_AGENT_STRING);
        request.set("ProxyPrefix", ProxyPrefix);

        RequestDetails details(request, "");
        LOK_ASSERT_EQUAL(true, details.isProxy());
        LOK_ASSERT_EQUAL(ProxyPrefix, details.getProxyPrefix());

        LOK_ASSERT_EQUAL(Root, details.getHostUntrusted());
        LOK_ASSERT_EQUAL(false, details.isWebSocket());
        LOK_ASSERT_EQUAL(true, details.isGet());

        const std::string docUri
            = "/tmp/slideshow_b8c3225b_setclientpart.odp";

        LOK_ASSERT_EQUAL(docUri, details.getLegacyDocumentURI());
        LOK_ASSERT_EQUAL(docUri, details.getDocumentURI());

        LOK_ASSERT_EQUAL(std::string(), details.getField(RequestDetails::Field::WOPISrc));

        LOK_ASSERT_EQUAL(static_cast<std::size_t>(5), details.size());
        LOK_ASSERT_EQUAL(std::string("lool"), details[0]);
        LOK_ASSERT(details.equals(0, "lool"));
        LOK_ASSERT_EQUAL(std::string("%2Ftmp%2Fslideshow_b8c3225b_setclientpart.odp"), details[1]);
        LOK_ASSERT_EQUAL(std::string("Ar3M1X89mVaryYkh"), details[2]);
        LOK_ASSERT_EQUAL(std::string("UjaCGP4cYHlU6TvUGdnFTPi8hjOS87uFym7ruWMq3F3jBr0kSPgVhbKz5CwUyV8R"), details[3]);
        LOK_ASSERT_EQUAL(std::string("slideshow.svg"), details[4]);

        LOK_ASSERT_EQUAL(std::string("lool"), details.getField(RequestDetails::Field::Type));
        LOK_ASSERT(details.equals(RequestDetails::Field::Type, "lool"));
        LOK_ASSERT_EQUAL(std::string(""), details.getField(RequestDetails::Field::SessionId));
        LOK_ASSERT(details.equals(RequestDetails::Field::SessionId, ""));
        LOK_ASSERT_EQUAL(std::string(""), details.getField(RequestDetails::Field::Command));
        LOK_ASSERT(details.equals(RequestDetails::Field::Command, ""));
        LOK_ASSERT_EQUAL(std::string(""), details.getField(RequestDetails::Field::Serial));
        LOK_ASSERT(details.equals(RequestDetails::Field::Serial, ""));
    }

    {
        static const std::string URI = "/lool/"
                                       "clipboard?WOPISrc=file%3A%2F%2F%2Ftmp%2Fcopypasteef324307_"
                                       "empty.ods&ServerId=7add98ed&ViewId=0&Tag=5f7972ce4e6a37dd";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, URI,
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        request.setHost(Root);
        request.set("User-Agent", WOPI_AGENT_STRING);
        request.set("ProxyPrefix", ProxyPrefix);

        RequestDetails details(request, "");
        LOK_ASSERT_EQUAL(true, details.isProxy());
        LOK_ASSERT_EQUAL(ProxyPrefix, details.getProxyPrefix());

        LOK_ASSERT_EQUAL(Root, details.getHostUntrusted());
        LOK_ASSERT_EQUAL(false, details.isWebSocket());
        LOK_ASSERT_EQUAL(true, details.isGet());

        const std::string docUri = "clipboard";

        LOK_ASSERT_EQUAL(docUri, details.getLegacyDocumentURI());
        LOK_ASSERT_EQUAL(docUri, details.getDocumentURI());

        LOK_ASSERT_EQUAL(static_cast<std::size_t>(3), details.size());
        LOK_ASSERT_EQUAL(std::string("lool"), details[0]);
        LOK_ASSERT(details.equals(0, "lool"));
        LOK_ASSERT_EQUAL(std::string("clipboard"), details[1]);

        LOK_ASSERT_EQUAL(std::string("lool"), details.getField(RequestDetails::Field::Type));
        LOK_ASSERT(details.equals(RequestDetails::Field::Type, "lool"));
        LOK_ASSERT_EQUAL(std::string(""), details.getField(RequestDetails::Field::SessionId));
        LOK_ASSERT(details.equals(RequestDetails::Field::SessionId, ""));
        LOK_ASSERT_EQUAL(std::string(""), details.getField(RequestDetails::Field::Command));
        LOK_ASSERT(details.equals(RequestDetails::Field::Command, ""));
        LOK_ASSERT_EQUAL(std::string(""), details.getField(RequestDetails::Field::Serial));
        LOK_ASSERT(details.equals(RequestDetails::Field::Serial, ""));
    }

    {
        static const std::string URI
        = "/lool/"
          "https%3A%2F%2Fexample.com%3A8443%2Frest%2Ffiles%2Fwopi%2Ffiles%"
          "2F8ac75551de4d89e60002%3Faccess_header%3DAuthorization%253A%252520Bearer%"
          "252520poiuytrewq%25250D%25250A%25250D%25250AX-Requested-"
          "With%253A%252520XMLHttpRequest%26reuse_cookies%3Dlang%253Den-us%253A_ga_"
          "LMX4TVJ02K%253DGS1.1%"
          "253AToken%253DeyJhbGciOiJIUzUxMiJ9.vajknfkfajksdljfiwjek-"
          "W90fmgVb3C-00-eSkJBDqDNSYA%253APublicToken%"
          "253Dabc%253AZNPCQ003-32383700%253De9c71c3b%"
          "253AJSESSIONID%253Dnode0.node0%26permission%3Dedit/"
          "ws?WOPISrc=https://example.com:8443/rest/files/wopi/files/"
          "8c74c1deff7dede002&compat=/ws";

        Poco::Net::HTTPRequest request(Poco::Net::HTTPRequest::HTTP_GET, URI,
                                       Poco::Net::HTTPMessage::HTTP_1_1);
        request.setHost(Root);
        request.set("User-Agent", WOPI_AGENT_STRING);
        request.set("ProxyPrefix", ProxyPrefix);

        RequestDetails details(request, "");
        LOK_ASSERT_EQUAL(true, details.isProxy());
        LOK_ASSERT_EQUAL(ProxyPrefix, details.getProxyPrefix());

        LOK_ASSERT_EQUAL(Root, details.getHostUntrusted());
        LOK_ASSERT_EQUAL(false, details.isWebSocket());
        LOK_ASSERT_EQUAL(true, details.isGet());

        const std::string docUri
            = "https://example.com:8443/rest/files/wopi/files/"
              "8ac75551de4d89e60002?access_header=Authorization%3A%2520Bearer%2520poiuytrewq%250D%"
              "250A%250D%250AX-Requested-With%3A%2520XMLHttpRequest&reuse_cookies=lang%3Den-us%3A_"
              "ga_LMX4TVJ02K%3DGS1.1%3AToken%3DeyJhbGciOiJIUzUxMiJ9.vajknfkfajksdljfiwjek-"
              "W90fmgVb3C-00-eSkJBDqDNSYA%3APublicToken%3Dabc%3AZNPCQ003-32383700%3De9c71c3b%"
              "3AJSESSIONID%3Dnode0.node0&permission=edit";

        // LOK_ASSERT_EQUAL(docUri, details.getLegacyDocumentURI()); // Broken.
        LOK_ASSERT_EQUAL(docUri, details.getDocumentURI());

        const std::map<std::string, std::string>& params = details.getDocumentURIParams();
        LOK_ASSERT_EQUAL(static_cast<std::size_t>(3), params.size());
        auto it = params.find("access_header");
        const std::string access_header
            = "Authorization: Bearer poiuytrewq\r\n\r\nX-Requested-With: XMLHttpRequest";
        LOK_ASSERT_EQUAL(access_header, it != params.end() ? it->second : "");
        it = params.find("reuse_cookies");
        const std::string reuse_cookies
            = "lang=en-us:_ga_LMX4TVJ02K=GS1.1:Token=eyJhbGciOiJIUzUxMiJ9.vajknfkfajksdljfiwjek-"
              "W90fmgVb3C-00-eSkJBDqDNSYA:PublicToken=abc:ZNPCQ003-32383700=e9c71c3b:JSESSIONID="
              "node0.node0";
        LOK_ASSERT_EQUAL(reuse_cookies, it != params.end() ? it->second : "");
        it = params.find("permission");
        const std::string permission = "edit";
        LOK_ASSERT_EQUAL(permission, it != params.end() ? it->second : "");

        LOK_ASSERT_EQUAL(static_cast<std::size_t>(11), details.size());
        LOK_ASSERT_EQUAL(std::string("lool"), details[0]);
        LOK_ASSERT(details.equals(0, "lool"));

        const std::string encodedDocUri
            = "https%3A%2F%2Fexample.com%3A8443%2Frest%2Ffiles%2Fwopi%2Ffiles%"
              "2F8ac75551de4d89e60002%3Faccess_header%3DAuthorization%253A%252520Bearer%"
              "252520poiuytrewq%25250D%25250A%25250D%25250AX-Requested-With%253A%"
              "252520XMLHttpRequest%26reuse_cookies%3Dlang%253Den-us%253A_ga_LMX4TVJ02K%253DGS1.1%"
              "253AToken%253DeyJhbGciOiJIUzUxMiJ9.vajknfkfajksdljfiwjek-W90fmgVb3C-00-eSkJBDqDNSYA%"
              "253APublicToken%253Dabc%253AZNPCQ003-32383700%253De9c71c3b%253AJSESSIONID%253Dnode0."
              "node0%26permission%3Dedit";

        LOK_ASSERT_EQUAL(encodedDocUri, details[1]);

        LOK_ASSERT_EQUAL(std::string("lool"), details.getField(RequestDetails::Field::Type));
        LOK_ASSERT(details.equals(RequestDetails::Field::Type, "lool"));
        LOK_ASSERT_EQUAL(std::string(""), details.getField(RequestDetails::Field::SessionId));
        LOK_ASSERT(details.equals(RequestDetails::Field::SessionId, ""));
        LOK_ASSERT_EQUAL(std::string(""), details.getField(RequestDetails::Field::Command));
        LOK_ASSERT(details.equals(RequestDetails::Field::Command, ""));
        LOK_ASSERT_EQUAL(std::string(""), details.getField(RequestDetails::Field::Serial));
        LOK_ASSERT(details.equals(RequestDetails::Field::Serial, ""));
    }
}

void WhiteBoxTests::testUIDefaults()
{
    std::string uiMode;

    LOK_ASSERT_EQUAL(std::string("{\"uiMode\":\"classic\"}"),
                     FileServerRequestHandler::uiDefaultsToJSON("UIMode=classic;huh=bleh;", uiMode));
    LOK_ASSERT_EQUAL(std::string("classic"), uiMode);

    LOK_ASSERT_EQUAL(std::string("{\"spreadsheet\":{\"ShowSidebar\":false},\"text\":{\"ShowRuler\":true}}"),
                     FileServerRequestHandler::uiDefaultsToJSON("TextRuler=true;SpreadsheetSidebar=false", uiMode));
    LOK_ASSERT_EQUAL(std::string(""), uiMode);

    LOK_ASSERT_EQUAL(std::string("{\"presentation\":{\"ShowStatusbar\":false},\"spreadsheet\":{\"ShowSidebar\":false},\"text\":{\"ShowRuler\":true},\"uiMode\":\"notebookbar\"}"),
                     FileServerRequestHandler::uiDefaultsToJSON(";;UIMode=notebookbar;;PresentationStatusbar=false;;TextRuler=true;;bah=ugh;;SpreadsheetSidebar=false", uiMode));
    LOK_ASSERT_EQUAL(std::string("notebookbar"), uiMode);
}

void WhiteBoxTests::testCSSVars()
{
    LOK_ASSERT_EQUAL(std::string("<style>:root {--co-somestyle-text:#123456;--co-somestyle-size:15px;}</style>"),
                     FileServerRequestHandler::cssVarsToStyle("--co-somestyle-text=#123456;--co-somestyle-size=15px;"));

    LOK_ASSERT_EQUAL(std::string("<style>:root {--co-somestyle-text:#123456;--co-somestyle-size:15px;}</style>"),
                     FileServerRequestHandler::cssVarsToStyle(";;--co-somestyle-text=#123456;;--co-somestyle-size=15px;;;"));

    LOK_ASSERT_EQUAL(std::string("<style>:root {--co-somestyle-text:#123456;--co-somestyle-size:15px;}</style>"),
                     FileServerRequestHandler::cssVarsToStyle("--co-somestyle-text=#123456;;--co-somestyle-size=15px;--co-sometext#324;;"));

    LOK_ASSERT_EQUAL(std::string("<style>:root {--co-somestyle-text:#123456;}</style>"),
                     FileServerRequestHandler::cssVarsToStyle("--co-somestyle-text=#123456;;--some-val=3453--some-other-val=4536;;"));
}

void WhiteBoxTests::testAsciiToLower()
{
    LOK_ASSERT_EQUAL(std::string("something in lower case"),
                     Util::toLower("SOMETHING IN LOWER CASE"));

    LOK_ASSERT_EQUAL(std::string("\t\r\n"),
                     Util::toLower("\t\r\n"));

    LOK_ASSERT_EQUAL(std::string("Á É Í Ó Ú Ý Ć Ǵ Ḱ Ĺ Ḿ Ń Ṕ Ŕ Ś Ẃ Ź"),
                     Util::toLower("Á É Í Ó Ú Ý Ć Ǵ Ḱ Ĺ Ḿ Ń Ṕ Ŕ Ś Ẃ Ź"));
}

void WhiteBoxTests::testStat()
{
    FileUtil::Stat invalid("/missing/file/path");
    LOK_ASSERT(!invalid.good());
    LOK_ASSERT(invalid.bad());
    LOK_ASSERT(!invalid.exists());

    const std::string tmpFile = FileUtil::getTemporaryDirectoryPath() + "/test_stat";
    std::ofstream ofs(tmpFile);
    FileUtil::Stat st(tmpFile);
    LOK_ASSERT(st.good());
    LOK_ASSERT(!st.bad());
    LOK_ASSERT(st.exists());
    LOK_ASSERT(!st.isDirectory());
    LOK_ASSERT(st.isFile());
    LOK_ASSERT(!st.isLink());
    LOK_ASSERT(st.path() == tmpFile);

    // Modified-time tests.
    // Some test might fail when the system has a different resolution for file timestamps
    // and time_point. Specifically, if the filesystem has microsecond precision but time_point
    // has lower resolution (milliseconds or seconds, f.e.), modifiedTimepoint() will not match
    // modifiedTimeUs(), and the checks will fail.
    // So far, microseconds seem to be the lower common denominator. At least on Android and
    // iOS that's the precision of time_point (as of late 2020), but Linux servers have
    // nanosecond precision.

    LOK_ASSERT(std::chrono::time_point_cast<std::chrono::microseconds>(st.modifiedTimepoint())
                   .time_since_epoch()
                   .count()
               == static_cast<long>(st.modifiedTimeUs()));
    LOK_ASSERT(std::chrono::time_point_cast<std::chrono::milliseconds>(st.modifiedTimepoint())
                   .time_since_epoch()
                   .count()
               == static_cast<long>(st.modifiedTimeMs()));
    LOK_ASSERT(std::chrono::time_point_cast<std::chrono::seconds>(st.modifiedTimepoint())
                   .time_since_epoch()
                   .count()
               == static_cast<long>(st.modifiedTimeMs() / 1000));
    LOK_ASSERT(st.modifiedTime().tv_sec == static_cast<long>(st.modifiedTimeMs() / 1000));
    LOK_ASSERT(st.modifiedTime().tv_nsec / 1000
               == static_cast<long>(st.modifiedTimeUs())
                      - (st.modifiedTime().tv_sec * 1000 * 1000));

    ofs.close();
    FileUtil::removeFile(tmpFile);
}

void WhiteBoxTests::testStringCompare()
{
    LOK_ASSERT(Util::iequal("abcd", "abcd"));
    LOK_ASSERT(Util::iequal("aBcd", "abCd"));
    LOK_ASSERT(Util::iequal("", ""));

    LOK_ASSERT(!Util::iequal("abcd", "abc"));
    LOK_ASSERT(!Util::iequal("abc", "abcd"));
    LOK_ASSERT(!Util::iequal("abc", "abcd"));

    LOK_ASSERT(!Util::iequal("abc", 3, "abcd", 4));
}

void WhiteBoxTests::testParseUri()
{
    std::string scheme = "***";
    std::string host = "***";
    std::string port = "***";

    LOK_ASSERT(!net::parseUri(std::string(), scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT(host.empty());
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("localhost", scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("localhost"), host);
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("127.0.0.1", scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("domain.com", scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("127.0.0.1:9999", scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT_EQUAL(std::string("9999"), port);

    LOK_ASSERT(net::parseUri("domain.com:88", scheme, host, port));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);

    LOK_ASSERT(net::parseUri("http://domain.com", scheme, host, port));
    LOK_ASSERT_EQUAL(std::string("http://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("https://domain.com:88", scheme, host, port));
    LOK_ASSERT_EQUAL(std::string("https://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);

    LOK_ASSERT(net::parseUri("http://domain.com/path/to/file", scheme, host, port));
    LOK_ASSERT_EQUAL(std::string("http://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());

    LOK_ASSERT(net::parseUri("https://domain.com:88/path/to/file", scheme, host, port));
    LOK_ASSERT_EQUAL(std::string("https://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);

    LOK_ASSERT(net::parseUri("wss://127.0.0.1:9999/", scheme, host, port));
    LOK_ASSERT_EQUAL(std::string("wss://"), scheme);
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT_EQUAL(std::string("9999"), port);
}

void WhiteBoxTests::testParseUriUrl()
{
    std::string scheme = "***";
    std::string host = "***";
    std::string port = "***";
    std::string url = "***";

    LOK_ASSERT(!net::parseUri(std::string(), scheme, host, port, url));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT(host.empty());
    LOK_ASSERT(port.empty());
    LOK_ASSERT(url.empty());

    LOK_ASSERT(net::parseUri("localhost", scheme, host, port, url));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("localhost"), host);
    LOK_ASSERT(port.empty());
    LOK_ASSERT(url.empty());

    LOK_ASSERT(net::parseUri("127.0.0.1", scheme, host, port, url));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT(port.empty());
    LOK_ASSERT(url.empty());

    LOK_ASSERT(net::parseUri("domain.com", scheme, host, port, url));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());
    LOK_ASSERT(url.empty());

    LOK_ASSERT(net::parseUri("127.0.0.1:9999", scheme, host, port, url));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT_EQUAL(std::string("9999"), port);
    LOK_ASSERT(url.empty());

    LOK_ASSERT(net::parseUri("domain.com:88", scheme, host, port, url));
    LOK_ASSERT(scheme.empty());
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);
    LOK_ASSERT(url.empty());

    LOK_ASSERT(net::parseUri("http://domain.com", scheme, host, port, url));
    LOK_ASSERT_EQUAL(std::string("http://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());
    LOK_ASSERT(url.empty());

    LOK_ASSERT(net::parseUri("https://domain.com:88", scheme, host, port, url));
    LOK_ASSERT_EQUAL(std::string("https://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);

    LOK_ASSERT(net::parseUri("http://domain.com/path/to/file", scheme, host, port, url));
    LOK_ASSERT_EQUAL(std::string("http://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT(port.empty());
    LOK_ASSERT_EQUAL(std::string("/path/to/file"), url);

    LOK_ASSERT(net::parseUri("https://domain.com:88/path/to/file", scheme, host, port, url));
    LOK_ASSERT_EQUAL(std::string("https://"), scheme);
    LOK_ASSERT_EQUAL(std::string("domain.com"), host);
    LOK_ASSERT_EQUAL(std::string("88"), port);
    LOK_ASSERT_EQUAL(std::string("/path/to/file"), url);

    LOK_ASSERT(net::parseUri("wss://127.0.0.1:9999/", scheme, host, port, url));
    LOK_ASSERT_EQUAL(std::string("wss://"), scheme);
    LOK_ASSERT_EQUAL(std::string("127.0.0.1"), host);
    LOK_ASSERT_EQUAL(std::string("9999"), port);
    LOK_ASSERT_EQUAL(std::string("/"), url);
}

void WhiteBoxTests::testParseUrl()
{
    LOK_ASSERT_EQUAL(std::string(), net::parseUrl(""));

    LOK_ASSERT_EQUAL(std::string(), net::parseUrl("https://sub.domain.com:80"));
    LOK_ASSERT_EQUAL(std::string("/"), net::parseUrl("https://sub.domain.com:80/"));

    LOK_ASSERT_EQUAL(std::string("/some/path"),
                     net::parseUrl("https://sub.domain.com:80/some/path"));
}

CPPUNIT_TEST_SUITE_REGISTRATION(WhiteBoxTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
