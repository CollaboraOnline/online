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

#include <Common.hpp>
#include <Protocol.hpp>
#include <Message.hpp>
#include <MessageQueue.hpp>
#include <SenderQueue.hpp>
#include <Util.hpp>

#include <cppunit/extensions/HelperMacros.h>

/// TileQueue unit-tests.
class TileQueueTests : public CPPUNIT_NS::TestFixture
{
    CPPUNIT_TEST_SUITE(TileQueueTests);

    CPPUNIT_TEST(testTileQueuePriority);
    CPPUNIT_TEST(testTileCombinedRendering);
    CPPUNIT_TEST(testTileRecombining);
    CPPUNIT_TEST(testViewOrder);
    CPPUNIT_TEST(testPreviewsDeprioritization);
    CPPUNIT_TEST(testSenderQueue);
    CPPUNIT_TEST(testSenderQueueTileDeduplication);
    CPPUNIT_TEST(testInvalidateViewCursorDeduplication);
    CPPUNIT_TEST(testCallbackModifiedStatusIsSkipped);
    CPPUNIT_TEST(testCallbackInvalidation);
    CPPUNIT_TEST(testCallbackIndicatorValue);
    CPPUNIT_TEST(testCallbackPageSize);

    CPPUNIT_TEST_SUITE_END();

    void testTileQueuePriority();
    void testTileCombinedRendering();
    void testTileRecombining();
    void testViewOrder();
    void testPreviewsDeprioritization();
    void testSenderQueue();
    void testSenderQueueTileDeduplication();
    void testInvalidateViewCursorDeduplication();
    void testCallbackModifiedStatusIsSkipped();
    void testCallbackInvalidation();
    void testCallbackIndicatorValue();
    void testCallbackPageSize();
};

void TileQueueTests::testTileQueuePriority()
{
    constexpr auto testname = __func__;

    const std::string reqHigh = "tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=0 tilewidth=3840 tileheight=3840 oldwid=0 wid=0";
    const std::string resHigh = "tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=0 tilewidth=3840 tileheight=3840 oldwid=0 wid=0 ver=-1";
    const TileQueue::Payload payloadHigh(resHigh.data(), resHigh.data() + resHigh.size());
    const std::string reqLow = "tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=253440 tilewidth=3840 tileheight=3840 oldwid=0 wid=0";
    const std::string resLow = "tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=253440 tilewidth=3840 tileheight=3840 oldwid=0 wid=0 ver=-1";
    const TileQueue::Payload payloadLow(resLow.data(), resLow.data() + resLow.size());

    TileQueue queue;

    // Request the tiles.
    queue.put(reqLow);
    queue.put(reqHigh);

    // Original order.
    LOK_ASSERT_EQUAL_STR(payloadLow, queue.get());
    LOK_ASSERT_EQUAL_STR(payloadHigh, queue.get());

    // Request the tiles.
    queue.put(reqLow);
    queue.put(reqHigh);
    queue.put(reqHigh);
    queue.put(reqLow);

    // Set cursor above reqHigh.
    queue.updateCursorPosition(0, 0, 0, 0, 10, 100);

    // Prioritized order.
    LOK_ASSERT_EQUAL_STR(payloadHigh, queue.get());
    LOK_ASSERT_EQUAL_STR(payloadLow, queue.get());

    // Repeat with cursor position set.
    queue.put(reqLow);
    queue.put(reqHigh);
    LOK_ASSERT_EQUAL_STR(payloadHigh, queue.get());
    LOK_ASSERT_EQUAL_STR(payloadLow, queue.get());

    // Repeat by changing cursor position.
    queue.put(reqLow);
    queue.put(reqHigh);
    queue.updateCursorPosition(0, 0, 0, 253450, 10, 100);
    LOK_ASSERT_EQUAL_STR(payloadLow, queue.get());
    LOK_ASSERT_EQUAL_STR(payloadHigh, queue.get());
}

void TileQueueTests::testTileCombinedRendering()
{
    constexpr auto testname = __func__;

    const std::string req1 = "tile nviewid=0 nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=0 tilewidth=3840 tileheight=3840";
    const std::string req2 = "tile nviewid=0 part=0 width=256 height=256 tileposx=3840 tileposy=0 tilewidth=3840 tileheight=3840";
    const std::string req3 = "tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=3840 tilewidth=3840 tileheight=3840";

    const std::string resHor = "tilecombine nviewid=0 part=0 width=256 height=256 tileposx=0,3840 tileposy=0,0 imgsize=0,0 tilewidth=3840 tileheight=3840 ver=-1,-1 oldwid=0,0 wid=0,0";
    const TileQueue::Payload payloadHor(resHor.data(), resHor.data() + resHor.size());
    const std::string resVer = "tilecombine nviewid=0 part=0 width=256 height=256 tileposx=0,0 tileposy=0,3840 imgsize=0,0 tilewidth=3840 tileheight=3840 ver=-1,-1 oldwid=0,0 wid=0,0";
    const TileQueue::Payload payloadVer(resVer.data(), resVer.data() + resVer.size());
    const std::string resFull = "tilecombine nviewid=0 part=0 width=256 height=256 tileposx=0,3840,0 tileposy=0,0,3840 imgsize=0,0,0 tilewidth=3840 tileheight=3840 ver=-1,-1,-1 oldwid=0,0,0 wid=0,0,0";
    const TileQueue::Payload payloadFull(resFull.data(), resFull.data() + resFull.size());

    TileQueue queue;

    // Horizontal.
    queue.put(req1);
    queue.put(req2);
    LOK_ASSERT_EQUAL_STR(payloadHor, queue.get());

    // Vertical.
    queue.put(req1);
    queue.put(req3);
    LOK_ASSERT_EQUAL_STR(payloadVer, queue.get());

    // Vertical.
    queue.put(req1);
    queue.put(req2);
    queue.put(req3);
    LOK_ASSERT_EQUAL_STR(payloadFull, queue.get());
}

void TileQueueTests::testTileRecombining()
{
    constexpr auto testname = __func__;

    TileQueue queue;

    queue.put("tilecombine nviewid=0 part=0 width=256 height=256 tileposx=0,3840,7680 tileposy=0,0,0 tilewidth=3840 tileheight=3840");
    queue.put("tilecombine nviewid=0 part=0 width=256 height=256 tileposx=0,3840 tileposy=0,0 tilewidth=3840 tileheight=3840");

    // the tilecombine's get merged, resulting in 3 "tile" messages
    LOK_ASSERT_EQUAL(3, static_cast<int>(queue.getQueue().size()));

    // but when we later extract that, it is just one "tilecombine" message
    LOK_ASSERT_EQUAL_STR(
        "tilecombine nviewid=0 part=0 width=256 height=256 tileposx=7680,0,3840 tileposy=0,0,0 "
        "imgsize=0,0,0 tilewidth=3840 tileheight=3840 ver=-1,-1,-1 oldwid=0,0,0 wid=0,0,0",
        queue.get());

    // and nothing remains in the queue
    LOK_ASSERT_EQUAL(0, static_cast<int>(queue.getQueue().size()));
}

void TileQueueTests::testViewOrder()
{
    constexpr auto testname = __func__;

    TileQueue queue;

    // should result in the 3, 2, 1, 0 order of the views
    queue.updateCursorPosition(0, 0, 0, 0, 10, 100);
    queue.updateCursorPosition(2, 0, 0, 0, 10, 100);
    queue.updateCursorPosition(1, 0, 0, 7680, 10, 100);
    queue.updateCursorPosition(3, 0, 0, 0, 10, 100);
    queue.updateCursorPosition(2, 0, 0, 15360, 10, 100);
    queue.updateCursorPosition(3, 0, 0, 23040, 10, 100);

    const std::vector<std::string> tiles =
    {
        "tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=0 tilewidth=3840 tileheight=3840 oldwid=0 wid=0 ver=-1",
        "tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=7680 tilewidth=3840 tileheight=3840 oldwid=0 wid=0 ver=-1",
        "tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=15360 tilewidth=3840 tileheight=3840 oldwid=0 wid=0 ver=-1",
        "tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=23040 tilewidth=3840 tileheight=3840 oldwid=0 wid=0 ver=-1"
    };

    for (auto &tile : tiles)
        queue.put(tile);

    LOK_ASSERT_EQUAL(4, static_cast<int>(queue.getQueue().size()));

    // should result in the 3, 2, 1, 0 order of the tiles thanks to the cursor
    // positions
    for (size_t i = 0; i < tiles.size(); ++i)
    {
        LOK_ASSERT_EQUAL_STR(tiles[3 - i], queue.get());
    }
}

void TileQueueTests::testPreviewsDeprioritization()
{
    constexpr auto testname = __func__;

    TileQueue queue;

    // simple case - put previews to the queue and get everything back again
    const std::vector<std::string> previews =
    {
        "tile nviewid=0 part=0 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 ver=-1 id=0",
        "tile nviewid=0 part=1 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 ver=-1 id=1",
        "tile nviewid=0 part=2 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 ver=-1 id=2",
        "tile nviewid=0 part=3 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 ver=-1 id=3"
    };

    for (auto &preview : previews)
        queue.put(preview);

    for (size_t i = 0; i < previews.size(); ++i)
    {
        LOK_ASSERT_EQUAL_STR(previews[i], queue.get());
    }

    // stays empty after all is done
    LOK_ASSERT_EQUAL(0, static_cast<int>(queue.getQueue().size()));

    // re-ordering case - put previews and normal tiles to the queue and get
    // everything back again but this time the tiles have to interleave with
    // the previews
    const std::vector<std::string> tiles =
    {
        "tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=0 tilewidth=3840 tileheight=3840 oldwid=0 wid=0 ver=-1",
        "tile nviewid=0 part=0 width=256 height=256 tileposx=0 tileposy=7680 tilewidth=3840 tileheight=3840 oldwid=0 wid=0 ver=-1"
    };

    for (auto &preview : previews)
        queue.put(preview);

    queue.put(tiles[0]);

    LOK_ASSERT_EQUAL_STR(previews[0], queue.get());
    LOK_ASSERT_EQUAL_STR(tiles[0], queue.get());
    LOK_ASSERT_EQUAL_STR(previews[1], queue.get());

    queue.put(tiles[1]);

    LOK_ASSERT_EQUAL_STR(previews[2], queue.get());
    LOK_ASSERT_EQUAL_STR(tiles[1], queue.get());
    LOK_ASSERT_EQUAL_STR(previews[3], queue.get());

    // stays empty after all is done
    LOK_ASSERT_EQUAL(0, static_cast<int>(queue.getQueue().size()));

    // cursor positioning case - the cursor position should not prioritize the
    // previews
    queue.updateCursorPosition(0, 0, 0, 0, 10, 100);

    queue.put(tiles[1]);
    queue.put(previews[0]);

    LOK_ASSERT_EQUAL_STR(tiles[1], queue.get());
    LOK_ASSERT_EQUAL_STR(previews[0], queue.get());

    // stays empty after all is done
    LOK_ASSERT_EQUAL(0, static_cast<int>(queue.getQueue().size()));
}

void TileQueueTests::testSenderQueue()
{
    constexpr auto testname = __func__;

    SenderQueue<std::shared_ptr<Message>> queue;

    std::shared_ptr<Message> item;

    // Empty queue
    LOK_ASSERT_EQUAL_STR(false, queue.dequeue(item));
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), queue.size());

    const std::vector<std::string> messages =
    {
        "message 1",
        "message 2",
        "message 3"
    };

    for (const auto& msg : messages)
    {
        queue.enqueue(std::make_shared<Message>(msg, Message::Dir::Out));
    }

    LOK_ASSERT_EQUAL(static_cast<size_t>(3), queue.size());

    LOK_ASSERT_EQUAL_STR(true, queue.dequeue(item));
    LOK_ASSERT_EQUAL(static_cast<size_t>(2), queue.size());
    LOK_ASSERT(item);
    LOK_ASSERT_EQUAL(messages[0], std::string(item->data().data(), item->data().size()));

    LOK_ASSERT_EQUAL_STR(true, queue.dequeue(item));
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), queue.size());
    LOK_ASSERT(item);
    LOK_ASSERT_EQUAL(messages[1], std::string(item->data().data(), item->data().size()));

    LOK_ASSERT_EQUAL_STR(true, queue.dequeue(item));
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), queue.size());
    LOK_ASSERT(item);
    LOK_ASSERT_EQUAL(messages[2], std::string(item->data().data(), item->data().size()));

    LOK_ASSERT_EQUAL(static_cast<size_t>(0), queue.size());
}

void TileQueueTests::testSenderQueueTileDeduplication()
{
    constexpr auto testname = __func__;

    SenderQueue<std::shared_ptr<Message>> queue;

    std::shared_ptr<Message> item;

    // Empty queue
    LOK_ASSERT_EQUAL_STR(false, queue.dequeue(item));
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), queue.size());

    const std::vector<std::string> part_messages =
    {
        "tile: nviewid=0 part=0 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 ver=0",
        "tile: nviewid=0 part=1 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 ver=1",
        "tile: nviewid=0 part=2 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 ver=-1"
    };

    for (const auto& msg : part_messages)
    {
        queue.enqueue(std::make_shared<Message>(msg, Message::Dir::Out));
    }

    LOK_ASSERT_EQUAL(static_cast<size_t>(3), queue.size());
    LOK_ASSERT_EQUAL_STR(true, queue.dequeue(item));
    LOK_ASSERT_EQUAL_STR(true, queue.dequeue(item));
    LOK_ASSERT_EQUAL_STR(true, queue.dequeue(item));

    LOK_ASSERT_EQUAL(static_cast<size_t>(0), queue.size());

    const std::vector<std::string> dup_messages =
    {
        "tile: nviewid=0 part=0 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 ver=-1",
        "tile: nviewid=0 part=0 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 ver=1",
        "tile: nviewid=0 part=0 width=180 height=135 tileposx=0 tileposy=0 tilewidth=15875 tileheight=11906 ver=1"
    };

    for (const auto& msg : dup_messages)
    {
        queue.enqueue(std::make_shared<Message>(msg, Message::Dir::Out));
    }

    LOK_ASSERT_EQUAL(static_cast<size_t>(1), queue.size());
    LOK_ASSERT_EQUAL_STR(true, queue.dequeue(item));

    LOK_ASSERT(item);

    // The last one should persist.
    LOK_ASSERT_EQUAL(dup_messages[2], std::string(item->data().data(), item->data().size()));

    LOK_ASSERT_EQUAL(static_cast<size_t>(0), queue.size());
}

void TileQueueTests::testInvalidateViewCursorDeduplication()
{
    constexpr auto testname = __func__;

    SenderQueue<std::shared_ptr<Message>> queue;

    std::shared_ptr<Message> item;

    // Empty queue
    LOK_ASSERT_EQUAL_STR(false, queue.dequeue(item));
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), queue.size());

    const std::vector<std::string> view_messages =
    {
        "invalidateviewcursor: {    \"viewId\": \"1\",     \"rectangle\": \"3999, 1418, 0, 298\",     \"part\": \"0\" }",
        "invalidateviewcursor: {    \"viewId\": \"2\",     \"rectangle\": \"3999, 1418, 0, 298\",     \"part\": \"0\" }",
        "invalidateviewcursor: {    \"viewId\": \"3\",     \"rectangle\": \"3999, 1418, 0, 298\",     \"part\": \"0\" }",
    };

    for (const auto& msg : view_messages)
    {
        queue.enqueue(std::make_shared<Message>(msg, Message::Dir::Out));
    }

    LOK_ASSERT_EQUAL(static_cast<size_t>(3), queue.size());

    LOK_ASSERT_EQUAL_STR(true, queue.dequeue(item));
    LOK_ASSERT_EQUAL(static_cast<size_t>(2), queue.size());
    LOK_ASSERT(item);
    LOK_ASSERT_EQUAL(view_messages[0], std::string(item->data().data(), item->data().size()));

    LOK_ASSERT_EQUAL_STR(true, queue.dequeue(item));
    LOK_ASSERT_EQUAL(static_cast<size_t>(1), queue.size());
    LOK_ASSERT(item);
    LOK_ASSERT_EQUAL(view_messages[1], std::string(item->data().data(), item->data().size()));

    LOK_ASSERT_EQUAL_STR(true, queue.dequeue(item));
    LOK_ASSERT_EQUAL(static_cast<size_t>(0), queue.size());
    LOK_ASSERT(item);
    LOK_ASSERT_EQUAL(view_messages[2], std::string(item->data().data(), item->data().size()));

    LOK_ASSERT_EQUAL(static_cast<size_t>(0), queue.size());

    const std::vector<std::string> dup_messages =
    {
        "invalidateviewcursor: {    \"viewId\": \"1\",     \"rectangle\": \"3999, 1418, 0, 298\",     \"part\": \"0\" }",
        "invalidateviewcursor: {    \"viewId\": \"1\",     \"rectangle\": \"1000, 1418, 0, 298\",     \"part\": \"0\" }",
        "invalidateviewcursor: {    \"viewId\": \"1\",     \"rectangle\": \"2000, 1418, 0, 298\",     \"part\": \"0\" }",
    };

    for (const auto& msg : dup_messages)
    {
        queue.enqueue(std::make_shared<Message>(msg, Message::Dir::Out));
    }

    LOK_ASSERT_EQUAL(static_cast<size_t>(1), queue.size());
    LOK_ASSERT_EQUAL_STR(true, queue.dequeue(item));

    // The last one should persist.
    LOK_ASSERT_EQUAL(dup_messages[2], std::string(item->data().data(), item->data().size()));

    LOK_ASSERT_EQUAL(static_cast<size_t>(0), queue.size());
}

void TileQueueTests::testCallbackInvalidation()
{
    constexpr auto testname = __func__;

    TileQueue queue;

    // join tiles
    queue.put("callback all 0 284, 1418, 11105, 275, 0");
    queue.put("callback all 0 4299, 1418, 7090, 275, 0");

    LOK_ASSERT_EQUAL(1, static_cast<int>(queue.getQueue().size()));

    LOK_ASSERT_EQUAL_STR("callback all 0 284, 1418, 11105, 275, 0", queue.get());

    // invalidate everything with EMPTY, but keep the different part intact
    queue.put("callback all 0 284, 1418, 11105, 275, 0");
    queue.put("callback all 0 4299, 1418, 7090, 275, 1");
    queue.put("callback all 0 4299, 10418, 7090, 275, 0");
    queue.put("callback all 0 4299, 20418, 7090, 275, 0");

    LOK_ASSERT_EQUAL(4, static_cast<int>(queue.getQueue().size()));

    queue.put("callback all 0 EMPTY, 0");

    LOK_ASSERT_EQUAL(2, static_cast<int>(queue.getQueue().size()));
    LOK_ASSERT_EQUAL_STR("callback all 0 4299, 1418, 7090, 275, 1", queue.get());
    LOK_ASSERT_EQUAL_STR("callback all 0 EMPTY, 0", queue.get());
}

void TileQueueTests::testCallbackIndicatorValue()
{
    constexpr auto testname = __func__;

    TileQueue queue;

    // join tiles
    queue.put("callback all 10 25");
    queue.put("callback all 10 50");

    LOK_ASSERT_EQUAL(1, static_cast<int>(queue.getQueue().size()));
    LOK_ASSERT_EQUAL_STR("callback all 10 50", queue.get());
}

void TileQueueTests::testCallbackPageSize()
{
    constexpr auto testname = __func__;

    TileQueue queue;

    // join tiles
    queue.put("callback all 13 12474, 188626");
    queue.put("callback all 13 12474, 205748");

    LOK_ASSERT_EQUAL(1, static_cast<int>(queue.getQueue().size()));
    LOK_ASSERT_EQUAL_STR("callback all 13 12474, 205748", queue.get());
}

void TileQueueTests::testCallbackModifiedStatusIsSkipped()
{
    constexpr auto testname = __func__;

    TileQueue queue;
    std::stringstream ss;
    ss << "callback all " << LOK_CALLBACK_STATE_CHANGED;

    const std::vector<std::string> messages =
    {
        ss.str() + " .uno:ModifiedStatus=false",
        ss.str() + " .uno:ModifiedStatus=true",
        ss.str() + " .uno:ModifiedStatus=true",
        ss.str() + " .uno:ModifiedStatus=false"
    };

    for (const auto& msg : messages)
    {
        queue.put(msg);
    }

    LOK_ASSERT_EQUAL(static_cast<size_t>(4), queue.getQueue().size());

    LOK_ASSERT_EQUAL_STR(messages[0], queue.get());
    LOK_ASSERT_EQUAL_STR(messages[1], queue.get());
    LOK_ASSERT_EQUAL_STR(messages[2], queue.get());
    LOK_ASSERT_EQUAL_STR(messages[3], queue.get());
}

CPPUNIT_TEST_SUITE_REGISTRATION(TileQueueTests);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
