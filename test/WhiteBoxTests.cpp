/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include <cppunit/extensions/HelperMacros.h>

#include <Auth.hpp>
#include <ChildSession.hpp>
#include <Common.hpp>
#include <Kit.hpp>
#include <MessageQueue.hpp>
#include <Protocol.hpp>
#include <TileDesc.hpp>
#include <Util.hpp>
#include <JsonUtil.hpp>

#include <common/Authorization.hpp>

/// WhiteBox unit-tests.
class WhiteBoxTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(WhiteBoxTests);

    CPPUNIT_TEST(testLOOLProtocolFunctions);
    CPPUNIT_TEST(testSplitting);
    CPPUNIT_TEST(testMessageAbbreviation);
    CPPUNIT_TEST(testTokenizer);
    CPPUNIT_TEST(testReplace);
    CPPUNIT_TEST(testRegexListMatcher);
    CPPUNIT_TEST(testRegexListMatcher_Init);
    CPPUNIT_TEST(testEmptyCellCursor);
    CPPUNIT_TEST(testRectanglesIntersect);
    CPPUNIT_TEST(testAuthorization);
    CPPUNIT_TEST(testJson);
    CPPUNIT_TEST(testAnonymization);
    CPPUNIT_TEST(testTime);
    CPPUNIT_TEST(testStringVector);

    CPPUNIT_TEST_SUITE_END();

    void testLOOLProtocolFunctions();
    void testSplitting();
    void testMessageAbbreviation();
    void testTokenizer();
    void testReplace();
    void testRegexListMatcher();
    void testRegexListMatcher_Init();
    void testEmptyCellCursor();
    void testRectanglesIntersect();
    void testAuthorization();
    void testJson();
    void testAnonymization();
    void testTime();
    void testStringVector();
};

void WhiteBoxTests::testLOOLProtocolFunctions()
{
    int foo;
    CPPUNIT_ASSERT(LOOLProtocol::getTokenInteger("foo=42", "foo", foo));
    CPPUNIT_ASSERT_EQUAL(42, foo);

    std::string bar;
    CPPUNIT_ASSERT(LOOLProtocol::getTokenString("bar=hello-sailor", "bar", bar));
    CPPUNIT_ASSERT_EQUAL(std::string("hello-sailor"), bar);

    CPPUNIT_ASSERT(LOOLProtocol::getTokenString("bar=", "bar", bar));
    CPPUNIT_ASSERT_EQUAL(std::string(""), bar);

    int mumble;
    std::map<std::string, int> map { { "hello", 1 }, { "goodbye", 2 }, { "adieu", 3 } };

    CPPUNIT_ASSERT(LOOLProtocol::getTokenKeyword("mumble=goodbye", "mumble", map, mumble));
    CPPUNIT_ASSERT_EQUAL(2, mumble);

    std::string message("hello x=1 y=2 foo=42 bar=hello-sailor mumble='goodbye' zip zap");
    StringVector tokens(LOOLProtocol::tokenize(message));

    CPPUNIT_ASSERT(LOOLProtocol::getTokenInteger(tokens, "foo", foo));
    CPPUNIT_ASSERT_EQUAL(42, foo);

    CPPUNIT_ASSERT(LOOLProtocol::getTokenString(tokens, "bar", bar));
    CPPUNIT_ASSERT_EQUAL(std::string("hello-sailor"), bar);

    CPPUNIT_ASSERT(LOOLProtocol::getTokenKeyword(tokens, "mumble", map, mumble));
    CPPUNIT_ASSERT_EQUAL(2, mumble);

    CPPUNIT_ASSERT(LOOLProtocol::getTokenIntegerFromMessage(message, "foo", foo));
    CPPUNIT_ASSERT_EQUAL(42, foo);

    CPPUNIT_ASSERT(LOOLProtocol::getTokenStringFromMessage(message, "bar", bar));
    CPPUNIT_ASSERT_EQUAL(std::string("hello-sailor"), bar);

    CPPUNIT_ASSERT(LOOLProtocol::getTokenKeywordFromMessage(message, "mumble", map, mumble));
    CPPUNIT_ASSERT_EQUAL(2, mumble);

    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), Util::trimmed("A").size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), Util::trimmed("A"));

    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), Util::trimmed(" X").size());
    CPPUNIT_ASSERT_EQUAL(std::string("X"), Util::trimmed(" X"));

    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), Util::trimmed("Y ").size());
    CPPUNIT_ASSERT_EQUAL(std::string("Y"), Util::trimmed("Y "));

    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), Util::trimmed(" Z ").size());
    CPPUNIT_ASSERT_EQUAL(std::string("Z"), Util::trimmed(" Z "));

    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(0), Util::trimmed(" ").size());
    CPPUNIT_ASSERT_EQUAL(std::string(""), Util::trimmed(" "));

    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(0), Util::trimmed("   ").size());
    CPPUNIT_ASSERT_EQUAL(std::string(""), Util::trimmed("   "));

    std::string s;

    s = "A";
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), Util::trim(s).size());
    s = "A";
    CPPUNIT_ASSERT_EQUAL(std::string("A"), Util::trim(s));

    s = " X";
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), Util::trim(s).size());
    s = " X";
    CPPUNIT_ASSERT_EQUAL(std::string("X"), Util::trim(s));

    s = "Y ";
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), Util::trim(s).size());
    s = "Y ";
    CPPUNIT_ASSERT_EQUAL(std::string("Y"), Util::trim(s));

    s = " Z ";
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), Util::trim(s).size());
    s = " Z ";
    CPPUNIT_ASSERT_EQUAL(std::string("Z"), Util::trim(s));

    s = " ";
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(0), Util::trim(s).size());
    s = " ";
    CPPUNIT_ASSERT_EQUAL(std::string(""), Util::trim(s));

    s = "   ";
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(0), Util::trim(s).size());
    s = "   ";
    CPPUNIT_ASSERT_EQUAL(std::string(""), Util::trim(s));
}

void WhiteBoxTests::testSplitting()
{
    CPPUNIT_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring(nullptr, 5, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring(nullptr, -1, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring("abc", 0, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring("abc", -1, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string("ab"), Util::getDelimitedInitialSubstring("abc", 2, '\n'));

    std::string first;
    std::string second;

    std::tie(first, second) = Util::split(std::string(""), '.', true);
    std::tie(first, second) = Util::split(std::string(""), '.', false);

    std::tie(first, second) = Util::splitLast(std::string(""), '.', true);
    std::tie(first, second) = Util::splitLast(std::string(""), '.', false);

    // Split first, remove delim.
    std::tie(first, second) = Util::split(std::string("a"), '.', true);
    CPPUNIT_ASSERT_EQUAL(std::string("a"), first);
    CPPUNIT_ASSERT_EQUAL(std::string(""), second);

    // Split first, keep delim.
    std::tie(first, second) = Util::split(std::string("a"), '.', false);
    CPPUNIT_ASSERT_EQUAL(std::string("a"), first);
    CPPUNIT_ASSERT_EQUAL(std::string(""), second);

    // Split first, remove delim.
    std::tie(first, second) = Util::splitLast(std::string("a"), '.', true);
    CPPUNIT_ASSERT_EQUAL(std::string("a"), first);
    CPPUNIT_ASSERT_EQUAL(std::string(""), second);

    // Split first, keep delim.
    std::tie(first, second) = Util::splitLast(std::string("a"), '.', false);
    CPPUNIT_ASSERT_EQUAL(std::string("a"), first);
    CPPUNIT_ASSERT_EQUAL(std::string(""), second);


    // Split first, remove delim.
    std::tie(first, second) = Util::split(std::string("a."), '.', true);
    CPPUNIT_ASSERT_EQUAL(std::string("a"), first);
    CPPUNIT_ASSERT_EQUAL(std::string(""), second);

    // Split first, keep delim.
    std::tie(first, second) = Util::split(std::string("a."), '.', false);
    CPPUNIT_ASSERT_EQUAL(std::string("a"), first);
    CPPUNIT_ASSERT_EQUAL(std::string("."), second);

    // Split first, remove delim.
    std::tie(first, second) = Util::splitLast(std::string("a."), '.', true);
    CPPUNIT_ASSERT_EQUAL(std::string("a"), first);
    CPPUNIT_ASSERT_EQUAL(std::string(""), second);

    // Split first, keep delim.
    std::tie(first, second) = Util::splitLast(std::string("a."), '.', false);
    CPPUNIT_ASSERT_EQUAL(std::string("a"), first);
    CPPUNIT_ASSERT_EQUAL(std::string("."), second);


    // Split first, remove delim.
    std::tie(first, second) = Util::split(std::string("aa.bb"), '.', true);
    CPPUNIT_ASSERT_EQUAL(std::string("aa"), first);
    CPPUNIT_ASSERT_EQUAL(std::string("bb"), second);

    // Split first, keep delim.
    std::tie(first, second) = Util::split(std::string("aa.bb"), '.', false);
    CPPUNIT_ASSERT_EQUAL(std::string("aa"), first);
    CPPUNIT_ASSERT_EQUAL(std::string(".bb"), second);

    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(5), Util::getLastDelimiterPosition("aa.bb.cc", 8, '.'));

    // Split last, remove delim.
    std::tie(first, second) = Util::splitLast(std::string("aa.bb.cc"), '.', true);
    CPPUNIT_ASSERT_EQUAL(std::string("aa.bb"), first);
    CPPUNIT_ASSERT_EQUAL(std::string("cc"), second);

    // Split last, keep delim.
    std::tie(first, second) = Util::splitLast(std::string("aa.bb.cc"), '.', false);
    CPPUNIT_ASSERT_EQUAL(std::string("aa.bb"), first);
    CPPUNIT_ASSERT_EQUAL(std::string(".cc"), second);

    // Split last, remove delim.
    std::tie(first, second) = Util::splitLast(std::string("/owncloud/index.php/apps/richdocuments/wopi/files/13_ocgdpzbkm39u"), '/', true);
    CPPUNIT_ASSERT_EQUAL(std::string("/owncloud/index.php/apps/richdocuments/wopi/files"), first);
    CPPUNIT_ASSERT_EQUAL(std::string("13_ocgdpzbkm39u"), second);

    // Split last, keep delim.
    std::tie(first, second) = Util::splitLast(std::string("/owncloud/index.php/apps/richdocuments/wopi/files/13_ocgdpzbkm39u"), '/', false);
    CPPUNIT_ASSERT_EQUAL(std::string("/owncloud/index.php/apps/richdocuments/wopi/files"), first);
    CPPUNIT_ASSERT_EQUAL(std::string("/13_ocgdpzbkm39u"), second);

    std::string third;
    std::string fourth;

    std::tie(first, second, third, fourth) = Util::splitUrl("filename");
    CPPUNIT_ASSERT_EQUAL(std::string(""), first);
    CPPUNIT_ASSERT_EQUAL(std::string("filename"), second);
    CPPUNIT_ASSERT_EQUAL(std::string(""), third);
    CPPUNIT_ASSERT_EQUAL(std::string(""), fourth);

    std::tie(first, second, third, fourth) = Util::splitUrl("filename.ext");
    CPPUNIT_ASSERT_EQUAL(std::string(""), first);
    CPPUNIT_ASSERT_EQUAL(std::string("filename"), second);
    CPPUNIT_ASSERT_EQUAL(std::string(".ext"), third);
    CPPUNIT_ASSERT_EQUAL(std::string(""), fourth);

    std::tie(first, second, third, fourth) = Util::splitUrl("/path/to/filename");
    CPPUNIT_ASSERT_EQUAL(std::string("/path/to/"), first);
    CPPUNIT_ASSERT_EQUAL(std::string("filename"), second);
    CPPUNIT_ASSERT_EQUAL(std::string(""), third);
    CPPUNIT_ASSERT_EQUAL(std::string(""), fourth);

    std::tie(first, second, third, fourth) = Util::splitUrl("http://domain.com/path/filename");
    CPPUNIT_ASSERT_EQUAL(std::string("http://domain.com/path/"), first);
    CPPUNIT_ASSERT_EQUAL(std::string("filename"), second);
    CPPUNIT_ASSERT_EQUAL(std::string(""), third);
    CPPUNIT_ASSERT_EQUAL(std::string(""), fourth);

    std::tie(first, second, third, fourth) = Util::splitUrl("http://domain.com/path/filename.ext");
    CPPUNIT_ASSERT_EQUAL(std::string("http://domain.com/path/"), first);
    CPPUNIT_ASSERT_EQUAL(std::string("filename"), second);
    CPPUNIT_ASSERT_EQUAL(std::string(".ext"), third);
    CPPUNIT_ASSERT_EQUAL(std::string(""), fourth);

    std::tie(first, second, third, fourth) = Util::splitUrl("http://domain.com/path/filename.ext?params=3&command=5");
    CPPUNIT_ASSERT_EQUAL(std::string("http://domain.com/path/"), first);
    CPPUNIT_ASSERT_EQUAL(std::string("filename"), second);
    CPPUNIT_ASSERT_EQUAL(std::string(".ext"), third);
    CPPUNIT_ASSERT_EQUAL(std::string("?params=3&command=5"), fourth);
}

void WhiteBoxTests::testMessageAbbreviation()
{
    CPPUNIT_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring(nullptr, 5, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring(nullptr, -1, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring("abc", 0, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string(), Util::getDelimitedInitialSubstring("abc", -1, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string("ab"), Util::getDelimitedInitialSubstring("abc", 2, '\n'));

    CPPUNIT_ASSERT_EQUAL(std::string(), LOOLProtocol::getAbbreviatedMessage(nullptr, 5));
    CPPUNIT_ASSERT_EQUAL(std::string(), LOOLProtocol::getAbbreviatedMessage(nullptr, -1));
    CPPUNIT_ASSERT_EQUAL(std::string(), LOOLProtocol::getAbbreviatedMessage("abc", 0));
    CPPUNIT_ASSERT_EQUAL(std::string(), LOOLProtocol::getAbbreviatedMessage("abc", -1));
    CPPUNIT_ASSERT_EQUAL(std::string("ab"), LOOLProtocol::getAbbreviatedMessage("abc", 2));

    std::string s;
    std::string abbr;

    s = "abcdefg";
    CPPUNIT_ASSERT_EQUAL(s, LOOLProtocol::getAbbreviatedMessage(s));

    s = "1234567890123\n45678901234567890123456789012345678901234567890123";
    abbr = "1234567890123...";
    CPPUNIT_ASSERT_EQUAL(abbr, LOOLProtocol::getAbbreviatedMessage(s.data(), s.size()));
    CPPUNIT_ASSERT_EQUAL(abbr, LOOLProtocol::getAbbreviatedMessage(s));
}

void WhiteBoxTests::testTokenizer()
{
    StringVector tokens;

    tokens = LOOLProtocol::tokenize("");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(0), tokens.size());

    tokens = LOOLProtocol::tokenize("  ");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(0), tokens.size());

    tokens = LOOLProtocol::tokenize("A");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = LOOLProtocol::tokenize("  A");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = LOOLProtocol::tokenize("A  ");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = LOOLProtocol::tokenize(" A ");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = LOOLProtocol::tokenize(" A  Z ");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(2), tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = LOOLProtocol::tokenize("\n");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(0), tokens.size());

    tokens = LOOLProtocol::tokenize(" A  \nZ ");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = LOOLProtocol::tokenize(" A  Z\n ");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(2), tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = LOOLProtocol::tokenize(" A  Z  \n ");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(2), tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = LOOLProtocol::tokenize("tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=0 tilewidth=3840 tileheight=3840 ver=-1");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(10), tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("tile"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("nviewid=0"), tokens[1]);
    CPPUNIT_ASSERT_EQUAL(std::string("part=0"), tokens[2]);
    CPPUNIT_ASSERT_EQUAL(std::string("width=256"), tokens[3]);
    CPPUNIT_ASSERT_EQUAL(std::string("height=256"), tokens[4]);
    CPPUNIT_ASSERT_EQUAL(std::string("tileposx=0"), tokens[5]);
    CPPUNIT_ASSERT_EQUAL(std::string("tileposy=0"), tokens[6]);
    CPPUNIT_ASSERT_EQUAL(std::string("tilewidth=3840"), tokens[7]);
    CPPUNIT_ASSERT_EQUAL(std::string("tileheight=3840"), tokens[8]);
    CPPUNIT_ASSERT_EQUAL(std::string("ver=-1"), tokens[9]);

    // With custom delimiters
    tokens = LOOLProtocol::tokenize(std::string("ABC:DEF"), ':');
    CPPUNIT_ASSERT_EQUAL(std::string("ABC"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("DEF"), tokens[1]);

    tokens = LOOLProtocol::tokenize(std::string("ABC,DEF,XYZ"), ',');
    CPPUNIT_ASSERT_EQUAL(std::string("ABC"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("DEF"), tokens[1]);
    CPPUNIT_ASSERT_EQUAL(std::string("XYZ"), tokens[2]);

    // Integer lists.
    std::vector<int> ints;

    ints = LOOLProtocol::tokenizeInts(std::string("-1"));
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(1), ints.size());
    CPPUNIT_ASSERT_EQUAL(-1, ints[0]);

    ints = LOOLProtocol::tokenizeInts(std::string("1,2,3,4"));
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(4), ints.size());
    CPPUNIT_ASSERT_EQUAL(1, ints[0]);
    CPPUNIT_ASSERT_EQUAL(2, ints[1]);
    CPPUNIT_ASSERT_EQUAL(3, ints[2]);
    CPPUNIT_ASSERT_EQUAL(4, ints[3]);

    ints = LOOLProtocol::tokenizeInts("");
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(0), ints.size());

    ints = LOOLProtocol::tokenizeInts(std::string(",,,"));
    CPPUNIT_ASSERT_EQUAL(static_cast<size_t>(0), ints.size());
}

void WhiteBoxTests::testReplace()
{
    CPPUNIT_ASSERT_EQUAL(std::string("zesz one zwo flee"), Util::replace("test one two flee", "t", "z"));
    CPPUNIT_ASSERT_EQUAL(std::string("testt one two flee"), Util::replace("test one two flee", "tes", "test"));
    CPPUNIT_ASSERT_EQUAL(std::string("testest one two flee"), Util::replace("test one two flee", "tes", "testes"));
    CPPUNIT_ASSERT_EQUAL(std::string("tete one two flee"), Util::replace("tettet one two flee", "tet", "te"));
    CPPUNIT_ASSERT_EQUAL(std::string("t one two flee"), Util::replace("test one two flee", "tes", ""));
    CPPUNIT_ASSERT_EQUAL(std::string("test one two flee"), Util::replace("test one two flee", "", "X"));
}

void WhiteBoxTests::testRegexListMatcher()
{
    Util::RegexListMatcher matcher;

    matcher.allow("localhost");
    CPPUNIT_ASSERT(matcher.match("localhost"));
    CPPUNIT_ASSERT(!matcher.match(""));
    CPPUNIT_ASSERT(!matcher.match("localhost2"));
    CPPUNIT_ASSERT(!matcher.match("xlocalhost"));
    CPPUNIT_ASSERT(!matcher.match("192.168.1.1"));

    matcher.deny("localhost");
    CPPUNIT_ASSERT(!matcher.match("localhost"));

    matcher.allow("www[0-9].*");
    CPPUNIT_ASSERT(matcher.match("www1example"));

    matcher.allow("192\\.168\\..*\\..*");
    CPPUNIT_ASSERT(matcher.match("192.168.1.1"));
    CPPUNIT_ASSERT(matcher.match("192.168.159.1"));
    CPPUNIT_ASSERT(matcher.match("192.168.1.134"));
    CPPUNIT_ASSERT(!matcher.match("192.169.1.1"));
    CPPUNIT_ASSERT(matcher.match("192.168.."));

    matcher.deny("192\\.168\\.1\\..*");
    CPPUNIT_ASSERT(!matcher.match("192.168.1.1"));

    matcher.allow("staging\\.collaboracloudsuite\\.com.*");
    matcher.deny(".*collaboracloudsuite.*");
    CPPUNIT_ASSERT(!matcher.match("staging.collaboracloudsuite"));
    CPPUNIT_ASSERT(!matcher.match("web.collaboracloudsuite"));
    CPPUNIT_ASSERT(!matcher.match("staging.collaboracloudsuite.com"));

    matcher.allow("10\\.10\\.[0-9]{1,3}\\.[0-9]{1,3}");
    matcher.deny("10\\.10\\.10\\.10");
    CPPUNIT_ASSERT(matcher.match("10.10.001.001"));
    CPPUNIT_ASSERT(!matcher.match("10.10.10.10"));
    CPPUNIT_ASSERT(matcher.match("10.10.250.254"));
}

void WhiteBoxTests::testRegexListMatcher_Init()
{
    Util::RegexListMatcher matcher({"localhost", "192\\..*"}, {"192\\.168\\..*"});

    CPPUNIT_ASSERT(matcher.match("localhost"));
    CPPUNIT_ASSERT(!matcher.match(""));
    CPPUNIT_ASSERT(!matcher.match("localhost2"));
    CPPUNIT_ASSERT(!matcher.match("xlocalhost"));
    CPPUNIT_ASSERT(!matcher.match("192.168.1.1"));
    CPPUNIT_ASSERT(matcher.match("192.172.10.122"));

    matcher.deny("localhost");
    CPPUNIT_ASSERT(!matcher.match("localhost"));

    matcher.allow("www[0-9].*");
    CPPUNIT_ASSERT(matcher.match("www1example"));

    matcher.allow("192\\.168\\..*\\..*");
    CPPUNIT_ASSERT(!matcher.match("192.168.1.1"));
    CPPUNIT_ASSERT(!matcher.match("192.168.159.1"));
    CPPUNIT_ASSERT(!matcher.match("192.168.1.134"));
    CPPUNIT_ASSERT(matcher.match("192.169.1.1"));
    CPPUNIT_ASSERT(!matcher.match("192.168.."));

    matcher.clear();

    matcher.allow("192\\.168\\..*\\..*");
    CPPUNIT_ASSERT(matcher.match("192.168.1.1"));
    CPPUNIT_ASSERT(matcher.match("192.168.159.1"));
    CPPUNIT_ASSERT(matcher.match("192.168.1.134"));
    CPPUNIT_ASSERT(!matcher.match("192.169.1.1"));
    CPPUNIT_ASSERT(matcher.match("192.168.."));
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
                const std::string& /*renderOpts*/,
                const std::string& /*docTemplate*/) override
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
};

void WhiteBoxTests::testEmptyCellCursor()
{
    DummyDocument document;
    CallbackDescriptor callbackDescriptor{&document, 0};
    // This failed as stoi raised an std::invalid_argument exception.
    documentViewCallback(LOK_CALLBACK_CELL_CURSOR, "EMPTY", &callbackDescriptor);
}

void WhiteBoxTests::testRectanglesIntersect()
{
    // these intersect
    CPPUNIT_ASSERT(TileDesc::rectanglesIntersect(1000, 1000, 2000, 1000,
                                                 2000, 1000, 2000, 1000));
    CPPUNIT_ASSERT(TileDesc::rectanglesIntersect(2000, 1000, 2000, 1000,
                                                 1000, 1000, 2000, 1000));

    CPPUNIT_ASSERT(TileDesc::rectanglesIntersect(1000, 1000, 2000, 1000,
                                                 3000, 2000, 1000, 1000));
    CPPUNIT_ASSERT(TileDesc::rectanglesIntersect(3000, 2000, 1000, 1000,
                                                 1000, 1000, 2000, 1000));

    // these don't
    CPPUNIT_ASSERT(!TileDesc::rectanglesIntersect(1000, 1000, 2000, 1000,
                                                  2000, 3000, 2000, 1000));
    CPPUNIT_ASSERT(!TileDesc::rectanglesIntersect(2000, 3000, 2000, 1000,
                                                  1000, 1000, 2000, 1000));

    CPPUNIT_ASSERT(!TileDesc::rectanglesIntersect(1000, 1000, 2000, 1000,
                                                  2000, 3000, 1000, 1000));
    CPPUNIT_ASSERT(!TileDesc::rectanglesIntersect(2000, 3000, 1000, 1000,
                                                  1000, 1000, 2000, 1000));
}

void WhiteBoxTests::testAuthorization()
{
    Authorization auth1(Authorization::Type::Token, "abc");
    Poco::URI uri1("http://localhost");
    auth1.authorizeURI(uri1);
    CPPUNIT_ASSERT_EQUAL(std::string("http://localhost/?access_token=abc"), uri1.toString());
    Poco::Net::HTTPRequest req1;
    auth1.authorizeRequest(req1);
    CPPUNIT_ASSERT_EQUAL(std::string("Bearer abc"), req1.get("Authorization"));

    Authorization auth1modify(Authorization::Type::Token, "modified");
    // still the same uri1, currently "http://localhost/?access_token=abc"
    auth1modify.authorizeURI(uri1);
    CPPUNIT_ASSERT_EQUAL(std::string("http://localhost/?access_token=modified"), uri1.toString());

    Authorization auth2(Authorization::Type::Header, "def");
    Poco::Net::HTTPRequest req2;
    auth2.authorizeRequest(req2);
    CPPUNIT_ASSERT(!req2.has("Authorization"));

    Authorization auth3(Authorization::Type::Header, "Authorization: Basic huhu== ");
    Poco::URI uri2("http://localhost");
    auth3.authorizeURI(uri2);
    // nothing added with the Authorization header approach
    CPPUNIT_ASSERT_EQUAL(std::string("http://localhost"), uri2.toString());
    Poco::Net::HTTPRequest req3;
    auth3.authorizeRequest(req3);
    CPPUNIT_ASSERT_EQUAL(std::string("Basic huhu=="), req3.get("Authorization"));

    Authorization auth4(Authorization::Type::Header, "  Authorization: Basic blah== \n\r X-Something:   additional  ");
    Poco::Net::HTTPRequest req4;
    auth4.authorizeRequest(req4);
    CPPUNIT_ASSERT_EQUAL(std::string("Basic blah=="), req4.get("Authorization"));
    CPPUNIT_ASSERT_EQUAL(std::string("additional"), req4.get("X-Something"));

    Authorization auth5(Authorization::Type::Header, "  Authorization: Basic huh== \n\r X-Something-More:   else  \n\r");
    Poco::Net::HTTPRequest req5;
    auth5.authorizeRequest(req5);
    CPPUNIT_ASSERT_EQUAL(std::string("Basic huh=="), req5.get("Authorization"));
    CPPUNIT_ASSERT_EQUAL(std::string("else"), req5.get("X-Something-More"));

    Authorization auth6(Authorization::Type::None, "Authorization: basic huh==");
    Poco::Net::HTTPRequest req6;
    CPPUNIT_ASSERT_THROW(auth6.authorizeRequest(req6), BadRequestException);
}

void WhiteBoxTests::testJson()
{
    static const char* testString =
         "{\"BaseFileName\":\"SomeFile.pdf\",\"DisableCopy\":true,\"DisableExport\":true,\"DisableInactiveMessages\":true,\"DisablePrint\":true,\"EnableOwnerTermination\":true,\"HideExportOption\":true,\"HidePrintOption\":true,\"OwnerId\":\"id@owner.com\",\"PostMessageOrigin\":\"*\",\"Size\":193551,\"UserCanWrite\":true,\"UserFriendlyName\":\"Owning user\",\"UserId\":\"user@user.com\",\"WatermarkText\":null}";

    Poco::JSON::Object::Ptr object;
    CPPUNIT_ASSERT(JsonUtil::parseJSON(testString, object));

    size_t iValue = false;
    JsonUtil::findJSONValue(object, "Size", iValue);
    CPPUNIT_ASSERT_EQUAL(size_t(193551U), iValue);

    bool bValue = false;
    JsonUtil::findJSONValue(object, "DisableCopy", bValue);
    CPPUNIT_ASSERT_EQUAL(true, bValue);

    std::string sValue;
    JsonUtil::findJSONValue(object, "BaseFileName", sValue);
    CPPUNIT_ASSERT_EQUAL(std::string("SomeFile.pdf"), sValue);

    // Don't accept inexact key names.
    sValue.clear();
    JsonUtil::findJSONValue(object, "basefilename", sValue);
    CPPUNIT_ASSERT_EQUAL(std::string(), sValue);

    JsonUtil::findJSONValue(object, "invalid", sValue);
    CPPUNIT_ASSERT_EQUAL(std::string(), sValue);

    JsonUtil::findJSONValue(object, "UserId", sValue);
    CPPUNIT_ASSERT_EQUAL(std::string("user@user.com"), sValue);
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

    CPPUNIT_ASSERT_EQUAL(std::string("#0#5e45aef91248a8aa#"),
                         Util::anonymizeUrl(name, nAnonymizationSalt));
    CPPUNIT_ASSERT_EQUAL(std::string("#1#8f8d95bd2a202d00#.odt"),
                         Util::anonymizeUrl(filenameTestx, nAnonymizationSalt));
    CPPUNIT_ASSERT_EQUAL(std::string("/path/to/#2#5c872b2d82ecc8a0#.ext"),
                         Util::anonymizeUrl(path, nAnonymizationSalt));
    CPPUNIT_ASSERT_EQUAL(
        std::string("http://localhost/owncloud/index.php/apps/richdocuments/wopi/files/"
                    "#3#22c6f0caad277666#?access_token=Hn0zttjbwkvGWb5BHbDa5ArgTykJAyBl&access_"
                    "token_ttl=0&permission=edit"),
        Util::anonymizeUrl(plainUrl, nAnonymizationSalt));
    CPPUNIT_ASSERT_EQUAL(
        std::string("http://localhost/owncloud/index.php/apps/richdocuments/wopi/files/"
                    "736_ocgdpzbkm39u/"
                    "#4#294f0dfb18f6a80b#.odt?access_token=Hn0zttjbwkvGWb5BHbDa5ArgTykJAyBl&access_"
                    "token_ttl=0&permission=edit"),
        Util::anonymizeUrl(fileUrl, nAnonymizationSalt));

    nAnonymizationSalt = 0;

    CPPUNIT_ASSERT_EQUAL(std::string("#0#5e45aef91248a8aa#"), Util::anonymizeUrl(name, nAnonymizationSalt));
    Util::mapAnonymized(name, name);
    CPPUNIT_ASSERT_EQUAL(name, Util::anonymizeUrl(name, nAnonymizationSalt));

    CPPUNIT_ASSERT_EQUAL(std::string("#2#5c872b2d82ecc8a0#.ext"),
                         Util::anonymizeUrl(filename, nAnonymizationSalt));
    Util::mapAnonymized("filename", "filename"); // Identity map of the filename without extension.
    CPPUNIT_ASSERT_EQUAL(filename, Util::anonymizeUrl(filename, nAnonymizationSalt));

    CPPUNIT_ASSERT_EQUAL(std::string("#1#8f8d95bd2a202d00#.odt"),
                         Util::anonymizeUrl(filenameTestx, nAnonymizationSalt));
    Util::mapAnonymized("testx (6)",
                        "testx (6)"); // Identity map of the filename without extension.
    CPPUNIT_ASSERT_EQUAL(filenameTestx, Util::anonymizeUrl(filenameTestx, nAnonymizationSalt));

    CPPUNIT_ASSERT_EQUAL(path, Util::anonymizeUrl(path, nAnonymizationSalt));

    const std::string urlAnonymized = Util::replace(plainUrl, "736_ocgdpzbkm39u", "#3#22c6f0caad277666#");
    CPPUNIT_ASSERT_EQUAL(urlAnonymized, Util::anonymizeUrl(plainUrl, nAnonymizationSalt));
    Util::mapAnonymized("736_ocgdpzbkm39u", "736_ocgdpzbkm39u");
    CPPUNIT_ASSERT_EQUAL(plainUrl, Util::anonymizeUrl(plainUrl, nAnonymizationSalt));

    const std::string urlAnonymized2 = Util::replace(fileUrl, "secret", "#4#294f0dfb18f6a80b#");
    CPPUNIT_ASSERT_EQUAL(urlAnonymized2, Util::anonymizeUrl(fileUrl, nAnonymizationSalt));
    Util::mapAnonymized("secret", "736_ocgdpzbkm39u");
    const std::string urlAnonymized3 = Util::replace(fileUrl, "secret", "736_ocgdpzbkm39u");
    CPPUNIT_ASSERT_EQUAL(urlAnonymized3, Util::anonymizeUrl(fileUrl, nAnonymizationSalt));
}

void WhiteBoxTests::testTime()
{
    std::ostringstream oss;

    std::chrono::system_clock::time_point t(std::chrono::nanoseconds(1567444337874777375));
    CPPUNIT_ASSERT_EQUAL(std::string("2019-09-02T17:12:17.874777Z"),
                         Util::getIso8601FracformatTime(t));

    t = std::chrono::system_clock::time_point(std::chrono::nanoseconds(0));
    CPPUNIT_ASSERT_EQUAL(std::string("1970-01-01T00:00:00.000000Z"),
                         Util::getIso8601FracformatTime(t));

    t = Util::iso8601ToTimestamp("1970-01-01T00:00:00.000000Z", "LastModifiedTime");
    oss << t.time_since_epoch().count();
    CPPUNIT_ASSERT_EQUAL(std::string("0"), oss.str());
    CPPUNIT_ASSERT_EQUAL(std::string("1970-01-01T00:00:00.000000Z"),
                         Util::time_point_to_iso8601(t));

    oss.str(std::string());
    t = Util::iso8601ToTimestamp("2019-09-02T17:12:17.874777Z", "LastModifiedTime");
    oss << t.time_since_epoch().count();
    CPPUNIT_ASSERT_EQUAL(std::string("1567444337874777000"), oss.str());
    CPPUNIT_ASSERT_EQUAL(std::string("2019-09-02T17:12:17.874777Z"),
                         Util::time_point_to_iso8601(t));

    oss.str(std::string());
    t = Util::iso8601ToTimestamp("2019-10-24T14:31:28.063730Z", "LastModifiedTime");
    oss << t.time_since_epoch().count();
    CPPUNIT_ASSERT_EQUAL(std::string("1571927488063730000"), oss.str());
    CPPUNIT_ASSERT_EQUAL(std::string("2019-10-24T14:31:28.063730Z"),
                         Util::time_point_to_iso8601(t));

    t = Util::iso8601ToTimestamp("2020-02-20T20:02:20.100000Z", "LastModifiedTime");
    CPPUNIT_ASSERT_EQUAL(std::string("2020-02-20T20:02:20.100000Z"),
                         Util::time_point_to_iso8601(t));

    t = std::chrono::system_clock::time_point();
    CPPUNIT_ASSERT_EQUAL(std::string("Thu, 01 Jan 1970 00:00:00"), Util::getHttpTime(t));

    t = std::chrono::system_clock::time_point(std::chrono::nanoseconds(1569592993495336798));
    CPPUNIT_ASSERT_EQUAL(std::string("Fri, 27 Sep 2019 14:03:13"), Util::getHttpTime(t));

    for (int i = 0; i < 100; ++i)
    {
        t = std::chrono::system_clock::now();
        const uint64_t t_in_micros = (t.time_since_epoch().count() / 1000) * 1000;

        const std::string s = Util::getIso8601FracformatTime(t);
        t = Util::iso8601ToTimestamp(s, "LastModifiedTime");
        CPPUNIT_ASSERT_EQUAL(std::to_string(t_in_micros),
                             std::to_string(t.time_since_epoch().count()));

        // Allow a small delay to get a different timestamp on next iteration.
        sleep(0);
    }
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

CPPUNIT_TEST_SUITE_REGISTRATION(WhiteBoxTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
