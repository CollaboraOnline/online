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

#include <ChildSession.hpp>
#include <Common.hpp>
#include <Kit.hpp>
#include <MessageQueue.hpp>
#include <Protocol.hpp>
#include <TileDesc.hpp>
#include <Util.hpp>

/// WhiteBox unit-tests.
class WhiteBoxTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(WhiteBoxTests);

    CPPUNIT_TEST(testLOOLProtocolFunctions);
    CPPUNIT_TEST(testMessageAbbreviation);
    CPPUNIT_TEST(testTokenizer);
    CPPUNIT_TEST(testRegexListMatcher);
    CPPUNIT_TEST(testRegexListMatcher_Init);
    CPPUNIT_TEST(testEmptyCellCursor);
    CPPUNIT_TEST(testRectanglesIntersect);

    CPPUNIT_TEST_SUITE_END();

    void testLOOLProtocolFunctions();
    void testMessageAbbreviation();
    void testTokenizer();
    void testRegexListMatcher();
    void testRegexListMatcher_Init();
    void testEmptyCellCursor();
    void testRectanglesIntersect();
};

void WhiteBoxTests::testLOOLProtocolFunctions()
{
    int foo;
    CPPUNIT_ASSERT(LOOLProtocol::getTokenInteger("foo=42", "foo", foo));
    CPPUNIT_ASSERT_EQUAL(42, foo);

    std::string bar;
    CPPUNIT_ASSERT(LOOLProtocol::getTokenString("bar=hello-sailor", "bar", bar));
    CPPUNIT_ASSERT_EQUAL(std::string("hello-sailor"), bar);

    int mumble;
    std::map<std::string, int> map { { "hello", 1 }, { "goodbye", 2 }, { "adieu", 3 } };

    CPPUNIT_ASSERT(LOOLProtocol::getTokenKeyword("mumble=goodbye", "mumble", map, mumble));
    CPPUNIT_ASSERT_EQUAL(2, mumble);

    std::string message("hello x=1 y=2 foo=42 bar=hello-sailor mumble='goodbye' zip zap");
    Poco::StringTokenizer tokens(message, " ", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);

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

    CPPUNIT_ASSERT_EQUAL(1UL, Util::trimmed("A").size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), Util::trimmed("A"));

    CPPUNIT_ASSERT_EQUAL(1UL, Util::trimmed(" X").size());
    CPPUNIT_ASSERT_EQUAL(std::string("X"), Util::trimmed(" X"));

    CPPUNIT_ASSERT_EQUAL(1UL, Util::trimmed("Y ").size());
    CPPUNIT_ASSERT_EQUAL(std::string("Y"), Util::trimmed("Y "));

    CPPUNIT_ASSERT_EQUAL(1UL, Util::trimmed(" Z ").size());
    CPPUNIT_ASSERT_EQUAL(std::string("Z"), Util::trimmed(" Z "));

    CPPUNIT_ASSERT_EQUAL(0UL, Util::trimmed(" ").size());
    CPPUNIT_ASSERT_EQUAL(std::string(""), Util::trimmed(" "));

    CPPUNIT_ASSERT_EQUAL(0UL, Util::trimmed("   ").size());
    CPPUNIT_ASSERT_EQUAL(std::string(""), Util::trimmed("   "));

    std::string s;

    s = "A";
    CPPUNIT_ASSERT_EQUAL(1UL, Util::trim(s).size());
    s = "A";
    CPPUNIT_ASSERT_EQUAL(std::string("A"), Util::trim(s));

    s = " X";
    CPPUNIT_ASSERT_EQUAL(1UL, Util::trim(s).size());
    s = " X";
    CPPUNIT_ASSERT_EQUAL(std::string("X"), Util::trim(s));

    s = "Y ";
    CPPUNIT_ASSERT_EQUAL(1UL, Util::trim(s).size());
    s = "Y ";
    CPPUNIT_ASSERT_EQUAL(std::string("Y"), Util::trim(s));

    s = " Z ";
    CPPUNIT_ASSERT_EQUAL(1UL, Util::trim(s).size());
    s = " Z ";
    CPPUNIT_ASSERT_EQUAL(std::string("Z"), Util::trim(s));

    s = " ";
    CPPUNIT_ASSERT_EQUAL(0UL, Util::trim(s).size());
    s = " ";
    CPPUNIT_ASSERT_EQUAL(std::string(""), Util::trim(s));

    s = "   ";
    CPPUNIT_ASSERT_EQUAL(0UL, Util::trim(s).size());
    s = "   ";
    CPPUNIT_ASSERT_EQUAL(std::string(""), Util::trim(s));
}

void WhiteBoxTests::testMessageAbbreviation()
{
    CPPUNIT_ASSERT_EQUAL(std::string(), LOOLProtocol::getDelimitedInitialSubstring(nullptr, 5, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string(), LOOLProtocol::getDelimitedInitialSubstring(nullptr, -1, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string(), LOOLProtocol::getDelimitedInitialSubstring("abc", 0, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string(), LOOLProtocol::getDelimitedInitialSubstring("abc", -1, '\n'));
    CPPUNIT_ASSERT_EQUAL(std::string("ab"), LOOLProtocol::getDelimitedInitialSubstring("abc", 2, '\n'));

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
    std::vector<std::string> tokens;

    tokens = LOOLProtocol::tokenize("");
    CPPUNIT_ASSERT_EQUAL(0UL, tokens.size());

    tokens = LOOLProtocol::tokenize("  ");
    CPPUNIT_ASSERT_EQUAL(0UL, tokens.size());

    tokens = LOOLProtocol::tokenize("A");
    CPPUNIT_ASSERT_EQUAL(1UL, tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = LOOLProtocol::tokenize("  A");
    CPPUNIT_ASSERT_EQUAL(1UL, tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = LOOLProtocol::tokenize("A  ");
    CPPUNIT_ASSERT_EQUAL(1UL, tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = LOOLProtocol::tokenize(" A ");
    CPPUNIT_ASSERT_EQUAL(1UL, tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = LOOLProtocol::tokenize(" A  Z ");
    CPPUNIT_ASSERT_EQUAL(2UL, tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = LOOLProtocol::tokenize("\n");
    CPPUNIT_ASSERT_EQUAL(0UL, tokens.size());

    tokens = LOOLProtocol::tokenize(" A  \nZ ");
    CPPUNIT_ASSERT_EQUAL(1UL, tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);

    tokens = LOOLProtocol::tokenize(" A  Z\n ");
    CPPUNIT_ASSERT_EQUAL(2UL, tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = LOOLProtocol::tokenize(" A  Z  \n ");
    CPPUNIT_ASSERT_EQUAL(2UL, tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("A"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("Z"), tokens[1]);

    tokens = LOOLProtocol::tokenize("tile part=0 width=256 height=256 tileposx=0 tileposy=0 tilewidth=3840 tileheight=3840 ver=-1");
    CPPUNIT_ASSERT_EQUAL(9UL, tokens.size());
    CPPUNIT_ASSERT_EQUAL(std::string("tile"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("part=0"), tokens[1]);
    CPPUNIT_ASSERT_EQUAL(std::string("width=256"), tokens[2]);
    CPPUNIT_ASSERT_EQUAL(std::string("height=256"), tokens[3]);
    CPPUNIT_ASSERT_EQUAL(std::string("tileposx=0"), tokens[4]);
    CPPUNIT_ASSERT_EQUAL(std::string("tileposy=0"), tokens[5]);
    CPPUNIT_ASSERT_EQUAL(std::string("tilewidth=3840"), tokens[6]);
    CPPUNIT_ASSERT_EQUAL(std::string("tileheight=3840"), tokens[7]);
    CPPUNIT_ASSERT_EQUAL(std::string("ver=-1"), tokens[8]);

    // With custom delimeters
    tokens = LOOLProtocol::tokenize(std::string("ABC:DEF"), ':');
    CPPUNIT_ASSERT_EQUAL(std::string("ABC"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("DEF"), tokens[1]);

    tokens = LOOLProtocol::tokenize(std::string("ABC,DEF,XYZ"), ',');
    CPPUNIT_ASSERT_EQUAL(std::string("ABC"), tokens[0]);
    CPPUNIT_ASSERT_EQUAL(std::string("DEF"), tokens[1]);
    CPPUNIT_ASSERT_EQUAL(std::string("XYZ"), tokens[2]);
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

/// A stub IDocumentManager implementation for unit test purposes.
class DummyDocument : public IDocumentManager
{
    std::shared_ptr<TileQueue> _tileQueue;
    std::mutex _mutex;
    std::mutex _documentMutex;
public:
    DummyDocument()
        : _tileQueue(new TileQueue()),
        _mutex(),
        _documentMutex()
    {
    }
    bool onLoad(const std::string& /*sessionId*/,
                const std::string& /*jailedFilePath*/,
                const std::string& /*userName*/,
                const std::string& /*docPassword*/,
                const std::string& /*renderOpts*/,
                const bool /*haveDocPassword*/,
                const std::string& /*lang*/) override
    {
        return false;
    }

    void onUnload(const ChildSession& /*session*/) override
    {
    }

    std::shared_ptr<lok::Document> getLOKitDocument() override
    {
        return nullptr;
    }

    void notifyViewInfo() override
    {
    }

    std::map<int, UserInfo> getViewInfo() override
    {
        return {};
    }

    std::mutex& getMutex() override
    {
        return _mutex;
    }

    std::mutex& getDocumentMutex() override
    {
        return _mutex;
    }

    std::shared_ptr<TileQueue>& getTileQueue() override
    {
        return _tileQueue;
    }

    bool sendTextFrame(const std::string& /*message*/) override
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

CPPUNIT_TEST_SUITE_REGISTRATION(WhiteBoxTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
