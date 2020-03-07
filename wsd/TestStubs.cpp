/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
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

ClientSession::~ClientSession() {}

void ClientSession::performWrites() {}

void ClientSession::onDisconnect() {}

void ClientSession::dumpState(std::ostream& /*os*/) {}

void ClientSession::setReadOnly() {}

bool ClientSession::_handleInput(const char* /*buffer*/, int /*length*/) { return false; }

int ClientSession::getPollEvents(std::chrono::steady_clock::time_point /* now */, int & /* timeoutMaxMs */) { return 0; }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
