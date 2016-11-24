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
#include <Protocol.hpp>
#include <MessageQueue.hpp>
#include <Util.hpp>

/// WhiteBox unit-tests.
class WhiteBoxTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(WhiteBoxTests);

    CPPUNIT_TEST(testLOOLProtocolFunctions);
    CPPUNIT_TEST(testRegexListMatcher);
    CPPUNIT_TEST(testRegexListMatcher_Init);
    CPPUNIT_TEST(testEmptyCellCursor);

    CPPUNIT_TEST_SUITE_END();

    void testLOOLProtocolFunctions();
    void testRegexListMatcher();
    void testRegexListMatcher_Init();
    void testEmptyCellCursor();
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

    std::string message("hello x=1 y=2 foo=42 bar=hello-sailor mumble=goodbye zip zap");
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
                const bool /*haveDocPassword*/) override
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

    void notifyViewInfo(const std::vector<int>& /*viewIds*/) override
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

CPPUNIT_TEST_SUITE_REGISTRATION(WhiteBoxTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
