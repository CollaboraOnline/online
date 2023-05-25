/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <test/lokassert.hpp>
#include <cppunit/TestAssert.h>
#include <cstddef>

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

#include <common/Message.hpp>
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
    CPPUNIT_TEST(testCOOLProtocolFunctions);
    CPPUNIT_TEST(testSplitting);
    CPPUNIT_TEST(testMessage);
    CPPUNIT_TEST(testPathPrefixTrimming);
    CPPUNIT_TEST(testMessageAbbreviation);
    CPPUNIT_TEST(testReplace);
    CPPUNIT_TEST(testRegexListMatcher);
    CPPUNIT_TEST(testRegexListMatcher_Init);
    CPPUNIT_TEST(testEmptyCellCursor);
    CPPUNIT_TEST(testTileDesc);
    CPPUNIT_TEST(testTileData);
    CPPUNIT_TEST(testRectanglesIntersect);
    CPPUNIT_TEST(testJson);
    CPPUNIT_TEST(testAnonymization);
    CPPUNIT_TEST(testIso8601Time);
    CPPUNIT_TEST(testClockAsString);
    CPPUNIT_TEST(testBufferClass);
    CPPUNIT_TEST(testHexify);
    CPPUNIT_TEST(testUIDefaults);
    CPPUNIT_TEST(testCSSVars);
    CPPUNIT_TEST(testStat);
    CPPUNIT_TEST(testStringCompare);
    CPPUNIT_TEST(testParseUri);
    CPPUNIT_TEST(testParseUriUrl);
    CPPUNIT_TEST(testParseUrl);
    CPPUNIT_TEST(testSafeAtoi);
    CPPUNIT_TEST(testBytesToHex);
    CPPUNIT_TEST(testJsonUtilEscapeJSONValue);
#if ENABLE_DEBUG
    CPPUNIT_TEST(testUtf8);
#endif
    CPPUNIT_TEST_SUITE_END();

    void testCOOLProtocolFunctions();
    void testSplitting();
    void testMessage();
    void testPathPrefixTrimming();
    void testMessageAbbreviation();
    void testReplace();
    void testRegexListMatcher();
    void testRegexListMatcher_Init();
    void testEmptyCellCursor();
    void testTileDesc();
    void testTileData();
    void testRectanglesIntersect();
    void testJson();
    void testAnonymization();
    void testIso8601Time();
    void testClockAsString();
    void testBufferClass();
    void testHexify();
    void testUIDefaults();
    void testCSSVars();
    void testStat();
    void testStringCompare();
    void testParseUri();
    void testParseUriUrl();
    void testParseUrl();
    void testSafeAtoi();
    void testBytesToHex();
    void testJsonUtilEscapeJSONValue();
    void testUtf8();
};

void WhiteBoxTests::testCOOLProtocolFunctions()
{
    constexpr auto testname = __func__;

    int foo;
    LOK_ASSERT(COOLProtocol::getTokenInteger("foo=42", "foo", foo));
    LOK_ASSERT_EQUAL(42, foo);

    std::string bar;
    LOK_ASSERT(COOLProtocol::getTokenString("bar=hello-sailor", "bar", bar));
    LOK_ASSERT_EQUAL(std::string("hello-sailor"), bar);

    LOK_ASSERT(COOLProtocol::getTokenString("bar=", "bar", bar));
    LOK_ASSERT_EQUAL(std::string(""), bar);

    int mumble;
    std::map<std::string, int> map { { "hello", 1 }, { "goodbye", 2 }, { "adieu", 3 } };

    LOK_ASSERT(COOLProtocol::getTokenKeyword("mumble=goodbye", "mumble", map, mumble));
    LOK_ASSERT_EQUAL(2, mumble);

    std::string message("hello x=1 y=2 foo=42 bar=hello-sailor mumble='goodbye' zip zap");
    StringVector tokens(StringVector::tokenize(message));

    LOK_ASSERT(COOLProtocol::getTokenInteger(tokens, "foo", foo));
    LOK_ASSERT_EQUAL(42, foo);

    LOK_ASSERT(COOLProtocol::getTokenString(tokens, "bar", bar));
    LOK_ASSERT_EQUAL(std::string("hello-sailor"), bar);

    LOK_ASSERT(COOLProtocol::getTokenKeyword(tokens, "mumble", map, mumble));
    LOK_ASSERT_EQUAL(2, mumble);

    LOK_ASSERT(COOLProtocol::getTokenIntegerFromMessage(message, "foo", foo));
    LOK_ASSERT_EQUAL(42, foo);

    LOK_ASSERT(COOLProtocol::getTokenStringFromMessage(message, "bar", bar));
    LOK_ASSERT_EQUAL(std::string("hello-sailor"), bar);

    LOK_ASSERT(COOLProtocol::getTokenKeywordFromMessage(message, "mumble", map, mumble));
    LOK_ASSERT_EQUAL(2, mumble);

    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), Util::trimmed("A").size());
    LOK_ASSERT_EQUAL(std::string("A"), Util::trimmed("A"));

    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), Util::trimmed(" X").size());
    LOK_ASSERT_EQUAL(std::string("X"), Util::trimmed(" X"));

    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), Util::trimmed("Y ").size());
    LOK_ASSERT_EQUAL(std::string("Y"), Util::trimmed("Y "));

    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), Util::trimmed(" Z ").size());
    LOK_ASSERT_EQUAL(std::string("Z"), Util::trimmed(" Z "));

    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), Util::trimmed(" ").size());
    LOK_ASSERT_EQUAL(std::string(""), Util::trimmed(" "));

    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), Util::trimmed("   ").size());
    LOK_ASSERT_EQUAL(std::string(""), Util::trimmed("   "));

    std::string s;

    s = "A";
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), Util::trim(s).size());
    s = "A";
    LOK_ASSERT_EQUAL(std::string("A"), Util::trim(s));

    s = " X";
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), Util::trim(s).size());
    s = " X";
    LOK_ASSERT_EQUAL(std::string("X"), Util::trim(s));

    s = "Y ";
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), Util::trim(s).size());
    s = "Y ";
    LOK_ASSERT_EQUAL(std::string("Y"), Util::trim(s));

    s = " Z ";
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), Util::trim(s).size());
    s = " Z ";
    LOK_ASSERT_EQUAL(std::string("Z"), Util::trim(s));

    s = " ";
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), Util::trim(s).size());
    s = " ";
    LOK_ASSERT_EQUAL(std::string(""), Util::trim(s));

    s = "   ";
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), Util::trim(s).size());
    s = "   ";
    LOK_ASSERT_EQUAL(std::string(""), Util::trim(s));

    // Integer lists.
    std::vector<int> ints;

    ints = COOLProtocol::tokenizeInts(std::string("-1"));
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(1), ints.size());
    LOK_ASSERT_EQUAL(-1, ints[0]);

    ints = COOLProtocol::tokenizeInts(std::string("1,2,3,4"));
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(4), ints.size());
    LOK_ASSERT_EQUAL(1, ints[0]);
    LOK_ASSERT_EQUAL(2, ints[1]);
    LOK_ASSERT_EQUAL(3, ints[2]);
    LOK_ASSERT_EQUAL(4, ints[3]);

    ints = COOLProtocol::tokenizeInts("");
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), ints.size());

    ints = COOLProtocol::tokenizeInts(std::string(",,,"));
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(0), ints.size());
}

void WhiteBoxTests::testSplitting()
{
    constexpr auto testname = __func__;

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

    LOK_ASSERT_EQUAL(static_cast<std::size_t>(5), Util::getLastDelimiterPosition("aa.bb.cc", 8, '.'));

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

void WhiteBoxTests::testMessage()
{
    // try to force an isolated page alloc, likely to have
    // an invalid, electrified fence page after it.
    size_t sz = 4096*128;
    char *big = static_cast<char *>(malloc(sz));
    const char msg[] = "bogus-forward";
    char *dest = big + sz - (sizeof(msg) - 1);
    memcpy(dest, msg, sizeof (msg) - 1);
    Message overrun(dest, sizeof (msg) - 1, Message::Dir::Out);
    free(big);
}

void WhiteBoxTests::testPathPrefixTrimming()
{
    constexpr auto testname = __func__;

    // These helpers are used by the logging macros.
    // See Log.hpp for details.

#ifdef IOS

    LOK_ASSERT_EQUAL(std::size_t(23), skipPathToFilename("./path/to/a/looooooong/filename.cpp"));
    LOK_ASSERT_EQUAL(std::size_t(21), skipPathToFilename("path/to/a/looooooong/filename.cpp"));
    LOK_ASSERT_EQUAL(std::size_t(22), skipPathToFilename("/path/to/a/looooooong/filename.cpp"));
    LOK_ASSERT_EQUAL(std::size_t(24), skipPathToFilename("../path/to/a/looooooong/filename.cpp"));
    LOK_ASSERT_EQUAL(std::size_t(0), skipPathToFilename(""));
    LOK_ASSERT_EQUAL(std::size_t(0), skipPathToFilename("/"));
    LOK_ASSERT_EQUAL(std::size_t(0), skipPathToFilename("."));

    LOK_ASSERT_EQUAL(std::string("filename.cpp"),
                     std::string(LOG_FILE_NAME("./path/to/a/looooooong/filename.cpp")));
    LOK_ASSERT_EQUAL(std::string("filename.cpp"),
                     std::string(LOG_FILE_NAME("path/to/a/looooooong/filename.cpp")));
    LOK_ASSERT_EQUAL(std::string("filename.cpp"),
                     std::string(LOG_FILE_NAME("/path/to/a/looooooong/filename.cpp")));
    LOK_ASSERT_EQUAL(std::string(), std::string(LOG_FILE_NAME("")));
    LOK_ASSERT_EQUAL(std::string(), std::string(LOG_FILE_NAME("/")));
    LOK_ASSERT_EQUAL(std::string(), std::string(LOG_FILE_NAME(".")));

#else

    LOK_ASSERT_EQUAL(std::size_t(2), skipPathPrefix("./path/to/a/looooooong/filename.cpp"));
    LOK_ASSERT_EQUAL(std::size_t(0), skipPathPrefix("path/to/a/looooooong/filename.cpp"));
    LOK_ASSERT_EQUAL(std::size_t(1), skipPathPrefix("/path/to/a/looooooong/filename.cpp"));
    LOK_ASSERT_EQUAL(std::size_t(3), skipPathPrefix("../path/to/a/looooooong/filename.cpp"));
    LOK_ASSERT_EQUAL(std::size_t(0), skipPathPrefix(""));
    LOK_ASSERT_EQUAL(std::size_t(1), skipPathPrefix("/"));
    LOK_ASSERT_EQUAL(std::size_t(1), skipPathPrefix("."));

    LOK_ASSERT_EQUAL(std::string("path/to/a/looooooong/filename.cpp"),
                     std::string(LOG_FILE_NAME("./path/to/a/looooooong/filename.cpp")));
    LOK_ASSERT_EQUAL(std::string("path/to/a/looooooong/filename.cpp"),
                     std::string(LOG_FILE_NAME("path/to/a/looooooong/filename.cpp")));
    LOK_ASSERT_EQUAL(std::string("path/to/a/looooooong/filename.cpp"),
                     std::string(LOG_FILE_NAME("/path/to/a/looooooong/filename.cpp")));
    LOK_ASSERT_EQUAL(std::string("path/to/a/looooooong/filename.cpp"),
                     std::string(LOG_FILE_NAME("../path/to/a/looooooong/filename.cpp")));
    LOK_ASSERT_EQUAL(std::string(), std::string(LOG_FILE_NAME("")));
    LOK_ASSERT_EQUAL(std::string(), std::string(LOG_FILE_NAME("/")));
    LOK_ASSERT_EQUAL(std::string(), std::string(LOG_FILE_NAME(".")));

#endif
}

void WhiteBoxTests::testMessageAbbreviation()
{
    constexpr auto testname = __func__;

    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring(nullptr, 5, '\n'));
    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring(nullptr, -1, '\n'));
    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring("abc", 0, '\n'));
    LOK_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring("abc", -1, '\n'));
    LOK_ASSERT_EQUAL(std::string("ab"), Util::getDelimitedInitialSubstring("abc", 2, '\n'));

    LOK_ASSERT_EQUAL(std::string(), COOLProtocol::getAbbreviatedMessage(nullptr, 5));
    LOK_ASSERT_EQUAL(std::string(), COOLProtocol::getAbbreviatedMessage(nullptr, -1));
    LOK_ASSERT_EQUAL(std::string(), COOLProtocol::getAbbreviatedMessage("abc", 0));
    LOK_ASSERT_EQUAL(std::string(), COOLProtocol::getAbbreviatedMessage("abc", -1));
    LOK_ASSERT_EQUAL(std::string("ab"), COOLProtocol::getAbbreviatedMessage("abc", 2));

    std::string s;
    std::string abbr;

    s = "abcdefg";
    LOK_ASSERT_EQUAL(s, COOLProtocol::getAbbreviatedMessage(s));

    s = "1234567890123\n45678901234567890123456789012345678901234567890123";
    abbr = "1234567890123...";
    LOK_ASSERT_EQUAL(abbr, COOLProtocol::getAbbreviatedMessage(s.data(), s.size()));
    LOK_ASSERT_EQUAL(abbr, COOLProtocol::getAbbreviatedMessage(s));
}

void WhiteBoxTests::testReplace()
{
    constexpr auto testname = __func__;

    LOK_ASSERT_EQUAL(std::string("zesz one zwo flee"), Util::replace("test one two flee", "t", "z"));
    LOK_ASSERT_EQUAL(std::string("testt one two flee"), Util::replace("test one two flee", "tes", "test"));
    LOK_ASSERT_EQUAL(std::string("testest one two flee"), Util::replace("test one two flee", "tes", "testes"));
    LOK_ASSERT_EQUAL(std::string("tete one two flee"), Util::replace("tettet one two flee", "tet", "te"));
    LOK_ASSERT_EQUAL(std::string("t one two flee"), Util::replace("test one two flee", "tes", ""));
    LOK_ASSERT_EQUAL(std::string("test one two flee"), Util::replace("test one two flee", "", "X"));
}

void WhiteBoxTests::testRegexListMatcher()
{
    constexpr auto testname = __func__;

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
    constexpr auto testname = __func__;

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

    void trimIfInactive() override
    {
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

void WhiteBoxTests::testTileData()
{
    constexpr auto testname = __func__;

    TileData data(42, "Zfoo", 4);

    // replace keyframe
    data.appendBlob(43, "Zfoo", 4);
    LOK_ASSERT_EQUAL(size_t(3), data.size());

    // append a delta
    data.appendBlob(44, "Dbaa", 4);
    LOK_ASSERT_EQUAL(size_t(6), data.size());

    LOK_ASSERT_EQUAL(data.isPng(), false);

    // validation.
    LOK_ASSERT_EQUAL(data.isValid(), true);
    data.invalidate();
    LOK_ASSERT_EQUAL(data.isValid(), false);

    std::vector<char> out;
    LOK_ASSERT_EQUAL(data.appendChangesSince(out, 128), false);
    LOK_ASSERT_EQUAL(out.size(), size_t(0));

    LOK_ASSERT_EQUAL(data.appendChangesSince(out, 42), true);
    LOK_ASSERT_EQUAL(std::string("foobaa"), Util::toString(out));

    out.clear();
    LOK_ASSERT_EQUAL(data.appendChangesSince(out, 43), true);
    LOK_ASSERT_EQUAL(std::string("baa"), Util::toString(out));

    // append another delta
    data.appendBlob(47, "Dbaz", 4);
    LOK_ASSERT_EQUAL(data.size(), size_t(9));

    out.clear();
    LOK_ASSERT_EQUAL(data.appendChangesSince(out, 1), true);
    LOK_ASSERT_EQUAL(std::string("foobaabaz"), Util::toString(out));

    out.clear();
    LOK_ASSERT_EQUAL(data.appendChangesSince(out, 43), true);
    LOK_ASSERT_EQUAL(std::string("baabaz"), Util::toString(out));
}

void WhiteBoxTests::testRectanglesIntersect()
{
    constexpr auto testname = __func__;

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

void WhiteBoxTests::testJson()
{
    constexpr auto testname = __func__;

    static const char* testString =
         "{\"BaseFileName\":\"SomeFile.pdf\",\"DisableCopy\":true,\"DisableExport\":true,\"DisableInactiveMessages\":true,\"DisablePrint\":true,\"EnableOwnerTermination\":true,\"HideExportOption\":true,\"HidePrintOption\":true,\"OwnerId\":\"id@owner.com\",\"PostMessageOrigin\":\"*\",\"Size\":193551,\"UserCanWrite\":true,\"UserFriendlyName\":\"Owning user\",\"UserId\":\"user@user.com\",\"WatermarkText\":null}";

    Poco::JSON::Object::Ptr object;
    LOK_ASSERT(JsonUtil::parseJSON(testString, object));

    std::size_t iValue = 0;
    JsonUtil::findJSONValue(object, "Size", iValue);
    LOK_ASSERT_EQUAL(static_cast<std::size_t>(193551), iValue);

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
    constexpr auto testname = __func__;

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

void WhiteBoxTests::testIso8601Time()
{
    constexpr auto testname = __func__;

    std::ostringstream oss;

    std::chrono::system_clock::time_point t(std::chrono::duration_cast<std::chrono::system_clock::duration>(std::chrono::nanoseconds(1567444337874777375)));
    LOK_ASSERT_EQUAL(std::string("2019-09-02T17:12:17.874777Z"),
                         Util::getIso8601FracformatTime(t));

    t = std::chrono::system_clock::time_point(std::chrono::system_clock::duration::zero());
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
    if (std::is_same<std::chrono::system_clock::period, std::nano>::value)
        LOK_ASSERT_EQUAL(std::string("1567444337874777000"), oss.str());
    else
        LOK_ASSERT_EQUAL(std::string("1567444337874777"), oss.str());
    LOK_ASSERT_EQUAL(std::string("2019-09-02T17:12:17.874777Z"),
                         Util::time_point_to_iso8601(t));

    oss.str(std::string());
    t = Util::iso8601ToTimestamp("2019-10-24T14:31:28.063730Z", "LastModifiedTime");
    oss << t.time_since_epoch().count();
    if (std::is_same<std::chrono::system_clock::period, std::nano>::value)
        LOK_ASSERT_EQUAL(std::string("1571927488063730000"), oss.str());
    else
        LOK_ASSERT_EQUAL(std::string("1571927488063730"), oss.str());
    LOK_ASSERT_EQUAL(std::string("2019-10-24T14:31:28.063730Z"),
                         Util::time_point_to_iso8601(t));

    t = Util::iso8601ToTimestamp("2020-02-20T20:02:20.100000Z", "LastModifiedTime");
    LOK_ASSERT_EQUAL(std::string("2020-02-20T20:02:20.100000Z"),
                         Util::time_point_to_iso8601(t));

    t = std::chrono::system_clock::time_point();
    LOK_ASSERT_EQUAL(std::string("Thu, 01 Jan 1970 00:00:00"), Util::getHttpTime(t));

    t = std::chrono::system_clock::time_point(std::chrono::duration_cast<std::chrono::system_clock::duration>(std::chrono::nanoseconds(1569592993495336798)));
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

        std::string t_in_micros_str = std::to_string(t_in_micros);
        std::string time_since_epoch_str = std::to_string(t.time_since_epoch().count());
        if (!std::is_same<std::chrono::system_clock::period, std::nano>::value)
        {
            // If the system clock has nanoseconds precision, the last 3 digits
            // of these strings may not match. For example,
            // 1567444337874777000
            // 1567444337874777123
            t_in_micros_str.resize(t_in_micros_str.length() - 3);
            time_since_epoch_str.resize(time_since_epoch_str.length() - 3);
        }

        LOK_ASSERT_EQUAL(t_in_micros_str, time_since_epoch_str);

        // Allow a small delay to get a different timestamp on next iteration.
        sleep(0);
    }
}

void WhiteBoxTests::testClockAsString()
{
    // This test depends on locale and timezone.
    // It is only here to test changes to these functions,
    // but the tests can't be run elsewhere.
    // I left them here to avoid recreating them when needed.
#if 0
    constexpr auto testname = __func__;

    const auto steady_tp = std::chrono::steady_clock::time_point(
        std::chrono::steady_clock::duration(std::chrono::nanoseconds(295708311764285)));
    LOK_ASSERT_EQUAL(std::string("Sat Feb 12 18:58.889 2022"),
                     Util::getSteadyClockAsString(steady_tp));

    const auto sys_tp = std::chrono::system_clock::time_point(
        std::chrono::system_clock::duration(std::chrono::nanoseconds(1644764467739980124)));
    LOK_ASSERT_EQUAL(std::string("Sat Feb 12 18:58.889 2022"),
                     Util::getSystemClockAsString(sys_tp));
#endif
}

void WhiteBoxTests::testBufferClass()
{
    constexpr auto testname = __func__;

    Buffer buf;
    LOK_ASSERT_EQUAL(0UL, buf.size());
    LOK_ASSERT_EQUAL(true, buf.empty());
    LOK_ASSERT(buf.getBlock() == nullptr);
    buf.eraseFirst(buf.size());
    LOK_ASSERT_EQUAL(0UL, buf.size());
    LOK_ASSERT_EQUAL(true, buf.empty());

    // Small data.
    const char data[] = "abcdefghijklmnop";
    buf.append(data, sizeof(data));

    LOK_ASSERT_EQUAL(static_cast<std::size_t>(sizeof(data)), buf.size());
    LOK_ASSERT_EQUAL(false, buf.empty());
    LOK_ASSERT(buf.getBlock() != nullptr);
    LOK_ASSERT_EQUAL(0, memcmp(buf.getBlock(), data, buf.size()));

    // Erase one char at a time.
    for (std::size_t i = buf.size(); i > 0; --i)
    {
        buf.eraseFirst(1);
        LOK_ASSERT_EQUAL(i - 1, buf.size());
        LOK_ASSERT_EQUAL(i == 1, buf.empty()); // Not empty until the last element.
        LOK_ASSERT_EQUAL(buf.getBlock() != nullptr, !buf.empty());
        if (!buf.empty())
            LOK_ASSERT_EQUAL(0, memcmp(buf.getBlock(), data + (sizeof(data) - i) + 1, buf.size()));
    }

    // Large data.
    constexpr std::size_t BlockSize = 512 * 1024; // We add twice this.
    constexpr std::size_t BlockCount = 10;
    for (std::size_t i = 0; i < BlockCount; ++i)
    {
        const auto prevSize = buf.size();

        const std::vector<char> dataLarge(2 * BlockSize, 'a' + i); // Block of a single char.
        buf.append(dataLarge.data(), dataLarge.size());
        LOK_ASSERT_EQUAL(prevSize + (2 * BlockSize), buf.size());

        // Remove half.
        buf.eraseFirst(BlockSize);
        LOK_ASSERT_EQUAL(prevSize + BlockSize, buf.size());
        LOK_ASSERT_EQUAL(0, memcmp(buf.getBlock() + prevSize, dataLarge.data(), BlockSize));
    }

    LOK_ASSERT_EQUAL(BlockSize * BlockCount, buf.size());
    LOK_ASSERT_EQUAL(false, buf.empty());

    // Remove each block of data and test.
    for (std::size_t i = BlockCount / 2; i < BlockCount; ++i) // We removed half above.
    {
        LOK_ASSERT_EQUAL(false, buf.empty());
        LOK_ASSERT_EQUAL(BlockSize * 2 * (BlockCount - i), buf.size());

        const std::vector<char> dataLarge(BlockSize * 2, 'a' + i); // Block of a single char.
        LOK_ASSERT_EQUAL(0, memcmp(buf.getBlock(), dataLarge.data(), BlockSize));

        buf.eraseFirst(BlockSize * 2);
    }

    LOK_ASSERT_EQUAL(0UL, buf.size());
    LOK_ASSERT_EQUAL(true, buf.empty());

    // Very large data.
    const std::vector<char> dataLarge(20 * BlockSize, 'x'); // Block of a single char.
    buf.append(dataLarge.data(), dataLarge.size());
    LOK_ASSERT_EQUAL(dataLarge.size(), buf.size());

    buf.append(data, sizeof(data)); // Add small data.
    LOK_ASSERT_EQUAL(dataLarge.size() + sizeof(data), buf.size());

    buf.eraseFirst(dataLarge.size()); // Remove large data.
    LOK_ASSERT_EQUAL(sizeof(data), buf.size());
    LOK_ASSERT_EQUAL(false, buf.empty());
    LOK_ASSERT_EQUAL(0, memcmp(buf.getBlock(), data, buf.size()));

    buf.eraseFirst(buf.size()); // Remove all.
    LOK_ASSERT_EQUAL(0UL, buf.size());
    LOK_ASSERT_EQUAL(true, buf.empty());
}


void WhiteBoxTests::testHexify()
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

void WhiteBoxTests::testUIDefaults()
{
    constexpr auto testname = __func__;

    std::string uiMode;
    std::string uiTheme;

    LOK_ASSERT_EQUAL(std::string("{\"uiMode\":\"classic\"}"),
                     FileServerRequestHandler::uiDefaultsToJSON("UIMode=classic;huh=bleh;", uiMode, uiTheme));
    LOK_ASSERT_EQUAL(std::string("classic"), uiMode);

    LOK_ASSERT_EQUAL(std::string("{\"spreadsheet\":{\"ShowSidebar\":false},\"text\":{\"ShowRuler\":true}}"),
                     FileServerRequestHandler::uiDefaultsToJSON("TextRuler=true;SpreadsheetSidebar=false", uiMode, uiTheme));
    LOK_ASSERT_EQUAL(std::string(""), uiMode);

    LOK_ASSERT_EQUAL(std::string("{\"presentation\":{\"ShowStatusbar\":false},\"spreadsheet\":{\"ShowSidebar\":false},\"text\":{\"ShowRuler\":true},\"uiMode\":\"notebookbar\"}"),
                     FileServerRequestHandler::uiDefaultsToJSON(";;UIMode=notebookbar;;PresentationStatusbar=false;;TextRuler=true;;bah=ugh;;SpreadsheetSidebar=false", uiMode, uiTheme));

    LOK_ASSERT_EQUAL(std::string("{\"drawing\":{\"ShowStatusbar\":true},\"presentation\":{\"ShowStatusbar\":false},\"spreadsheet\":{\"ShowSidebar\":false},\"text\":{\"ShowRuler\":true},\"uiMode\":\"notebookbar\"}"),
                     FileServerRequestHandler::uiDefaultsToJSON(";;UIMode=notebookbar;;PresentationStatusbar=false;;TextRuler=true;;bah=ugh;;SpreadsheetSidebar=false;;DrawingStatusbar=true", uiMode, uiTheme));

    LOK_ASSERT_EQUAL(std::string("notebookbar"), uiMode);
}

void WhiteBoxTests::testCSSVars()
{
    constexpr auto testname = __func__;

    LOK_ASSERT_EQUAL(std::string("<style>:root {--co-somestyle-text:#123456;--co-somestyle-size:15px;}</style>"),
                     FileServerRequestHandler::cssVarsToStyle("--co-somestyle-text=#123456;--co-somestyle-size=15px;"));

    LOK_ASSERT_EQUAL(std::string("<style>:root {--co-somestyle-text:#123456;--co-somestyle-size:15px;}</style>"),
                     FileServerRequestHandler::cssVarsToStyle(";;--co-somestyle-text=#123456;;--co-somestyle-size=15px;;;"));

    LOK_ASSERT_EQUAL(std::string("<style>:root {--co-somestyle-text:#123456;--co-somestyle-size:15px;}</style>"),
                     FileServerRequestHandler::cssVarsToStyle("--co-somestyle-text=#123456;;--co-somestyle-size=15px;--co-sometext#324;;"));

    LOK_ASSERT_EQUAL(std::string("<style>:root {--co-somestyle-text:#123456;}</style>"),
                     FileServerRequestHandler::cssVarsToStyle("--co-somestyle-text=#123456;;--some-val=3453--some-other-val=4536;;"));
}

void WhiteBoxTests::testStat()
{
    constexpr auto testname = __func__;

    FileUtil::Stat invalid("/missing/file/path");
    LOK_ASSERT(!invalid.good());
    LOK_ASSERT(invalid.bad());
    LOK_ASSERT(!invalid.exists());

    const std::string tmpFile = FileUtil::getSysTempDirectoryPath() + "/test_stat";
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
    constexpr auto testname = __func__;

    LOK_ASSERT(Util::iequal("abcd", "abcd"));
    LOK_ASSERT(Util::iequal("aBcd", "abCd"));
    LOK_ASSERT(Util::iequal("", ""));

    LOK_ASSERT(!Util::iequal("abcd", "abc"));
    LOK_ASSERT(!Util::iequal("abc", "abcd"));
    LOK_ASSERT(!Util::iequal("abc", "abcd"));

    LOK_ASSERT(!Util::iequal("abc", 3, "abcd", 4));

    LOK_ASSERT(!Util::startsWith("abc", "abcd"));
    LOK_ASSERT(Util::startsWith("abcd", "abc"));
    LOK_ASSERT(Util::startsWith("abcd", "abcd"));

    LOK_ASSERT(!Util::endsWith("abc", "abcd"));
    LOK_ASSERT(Util::endsWith("abcd", "bcd"));
    LOK_ASSERT(Util::endsWith("abcd", "abcd"));
}

void WhiteBoxTests::testParseUri()
{
    constexpr auto testname = __func__;

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
    constexpr auto testname = __func__;

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
    constexpr auto testname = __func__;

    LOK_ASSERT_EQUAL(std::string(), net::parseUrl(""));

    LOK_ASSERT_EQUAL(std::string(), net::parseUrl("https://sub.domain.com:80"));
    LOK_ASSERT_EQUAL(std::string("/"), net::parseUrl("https://sub.domain.com:80/"));

    LOK_ASSERT_EQUAL(std::string("/some/path"),
                     net::parseUrl("https://sub.domain.com:80/some/path"));
}

void WhiteBoxTests::testSafeAtoi()
{
    constexpr auto testname = __func__;

    {
        std::string s("7");
        LOK_ASSERT_EQUAL(7, Util::safe_atoi(s.data(), s.size()));
    }
    {
        std::string s("+7");
        LOK_ASSERT_EQUAL(7, Util::safe_atoi(s.data(), s.size()));
    }
    {
        std::string s("-7");
        LOK_ASSERT_EQUAL(-7, Util::safe_atoi(s.data(), s.size()));
    }
    {
        std::string s("42");
        LOK_ASSERT_EQUAL(42, Util::safe_atoi(s.data(), s.size()));
    }
    {
        std::string s("42");
        LOK_ASSERT_EQUAL(4, Util::safe_atoi(s.data(), 1));
    }
    {
        std::string s("  42");
        LOK_ASSERT_EQUAL(42, Util::safe_atoi(s.data(), s.size()));
    }
    {
        std::string s("42xy");
        LOK_ASSERT_EQUAL(42, Util::safe_atoi(s.data(), s.size()));
    }
    {
        // Make sure signed integer overflow doesn't happen.
        std::string s("9999999990");
        // Good:       2147483647
        // Bad:        1410065398
        LOK_ASSERT_EQUAL(std::numeric_limits<int>::max(), Util::safe_atoi(s.data(), s.size()));
    }
    {
        std::string s("123");
        s[1] = '\0';
        LOK_ASSERT_EQUAL(1, Util::safe_atoi(s.data(), s.size()));
    }
    {
        LOK_ASSERT_EQUAL(0, Util::safe_atoi(nullptr, 0));
    }
}

void WhiteBoxTests::testBytesToHex()
{
    constexpr auto testname = __func__;

    {
        const std::string d("Some text");
        const std::string hex = Util::bytesToHexString(d);
        const std::string s = Util::hexStringToBytes(hex);
        LOK_ASSERT_EQUAL(d, s);
    }
}

void WhiteBoxTests::testJsonUtilEscapeJSONValue()
{
    constexpr auto testname = __func__;

    const std::string in = "domain\\username";
    const std::string expected = "domain\\\\username";
    LOK_ASSERT_EQUAL(JsonUtil::escapeJSONValue(in), expected);
}

void WhiteBoxTests::testUtf8()
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

CPPUNIT_TEST_SUITE_REGISTRATION(WhiteBoxTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
