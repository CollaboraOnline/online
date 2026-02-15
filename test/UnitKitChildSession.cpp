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
 * Unit test for Kit child session functionality.
 */

#include <config.h>

#include <cstdlib>
#include <memory>
#include <ostream>
#include <string>
#include <vector>

#include <Poco/URI.h>

#include <common/Log.hpp>
#include <common/StringVector.hpp>
#include <common/Unit.hpp>
#include <net/Socket.hpp>

#include <lokassert.hpp>
#include <helpers.hpp>

/// Covers kit/ChildSession.cpp fixes.
class UnitKitChildSession : public UnitWSD
{
public:
    UnitKitChildSession();

    void invokeWSDTest() override;
};

UnitKitChildSession::UnitKitChildSession()
    : UnitWSD("UnitKitChildSession")
{
}

void UnitKitChildSession::invokeWSDTest()
{
    // Given a Writer document which has tiles rendered in mode=0 and mode=2:
    std::string documentPath;
    std::string documentURL;
    helpers::getDocumentPathAndURL("empty.odt", documentPath, documentURL, testname);
    std::shared_ptr<SocketPoll> socketPoll = std::make_shared<SocketPoll>("KitChildSessionPoll");
    socketPoll->startThread();
    std::shared_ptr<http::WebSocketSession> socket = helpers::loadDocAndGetSession(
        socketPoll, Poco::URI(helpers::getTestServerURI()), documentURL, testname);
    helpers::sendTextFrame(socket,
                           "tilecombine nviewid=0 part=0 mode=0 width=256 height=256 tileposx=0 "
                           "tileposy=0 oldwid=0 tilewidth=3840 tileheight=3840",
                           testname);
    std::vector<char> message = helpers::getResponseMessage(socket, "tile:", testname);
    LOK_ASSERT(!message.empty());
    // Switch from mode=0 to mode=2.
    helpers::sendTextFrame(socket, "uno .uno:RedlineRenderMode", testname);
    message = helpers::getResponseMessage(socket, "statusupdate:", testname);
    LOK_ASSERT(!message.empty());
    helpers::sendTextFrame(socket,
                           "tilecombine nviewid=0 part=0 mode=2 width=256 height=256 tileposx=0 "
                           "tileposy=0 oldwid=0 tilewidth=3840 tileheight=3840",
                           testname);
    message = helpers::getResponseMessage(socket, "tile:", testname);
    // Switch from mode=2 to mode=0.
    helpers::sendTextFrame(socket, "uno .uno:RedlineRenderMode", testname);
    message = helpers::getResponseMessage(socket, "statusupdate:", testname);
    LOK_ASSERT(!message.empty());

    // When switching to mode=2 again:
    helpers::sendTextFrame(socket, "uno .uno:RedlineRenderMode", testname);
    message = helpers::getResponseMessage(socket, "invalidatetiles:", testname);
    LOK_ASSERT(!message.empty());

    // Then make sure the invalidatetiles message's mode is correct:
    std::string payload(message.data(), message.size());
    StringVector tokens(StringVector::tokenize(payload, ' '));
    LOK_ASSERT(tokens.size() >= 4);
    LOK_ASSERT_EQUAL_STR("invalidatetiles:", tokens[0]);
    LOK_ASSERT_EQUAL_STR("EMPTY,", tokens[1]);
    int part = std::atoi(tokens[2].c_str());
    LOK_ASSERT_EQUAL(0, part);
    int mode = std::atoi(tokens[3].c_str());
    // Without the accompanying fix in place, this test would have failed, expected 'mode' to be '2'
    // but it was '0'.
    LOK_ASSERT_EQUAL(2, mode);
    exitTest(TestResult::Ok);
}

UnitBase* unit_create_wsd(void) { return new UnitKitChildSession(); }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
