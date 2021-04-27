/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Stub missing symbols required for unit tests ...
 */

#include <config.h>

#include "DocumentBroker.hpp"

#include "ClientSession.hpp"

void DocumentBroker::assertCorrectThread() const {}

void ClientSession::traceTileBySend(const TileDesc& /*tile*/, bool /*deduplicated = false*/) {}

void ClientSession::enqueueSendMessage(const std::shared_ptr<Message>& /*data*/) {};

ClientSession::~ClientSession() = default;

void ClientSession::onDisconnect() {}

bool ClientSession::hasQueuedMessages() const { return false; }

void ClientSession::writeQueuedMessages(std::size_t) {}

void ClientSession::dumpState(std::ostream& /*os*/) {}

void ClientSession::setReadOnly(bool) {}

bool ClientSession::_handleInput(const char* /*buffer*/, int /*length*/) { return false; }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
