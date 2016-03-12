/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Default values and other shared data between processes.
#ifndef INCLUDED_COMMON_HPP
#define INCLUDED_COMMON_HPP

#include <string>

// The maximum number of client connections we can accept.
constexpr int MAX_SESSIONS = 1024;

constexpr int DEFAULT_CLIENT_PORT_NUMBER = 9980;
constexpr int MASTER_PORT_NUMBER = 9981;
constexpr int ADMIN_PORT_NUMBER = 9989;
constexpr int INTERVAL_PROBES = 10;
constexpr int MAINTENANCE_INTERVAL = 1;
constexpr int CHILD_TIMEOUT_SECS = 10;
constexpr int POLL_TIMEOUT_MS = 1000;

/// Pipe and Socket read buffer size.
/// Should be large enough for ethernet packets
/// which can be 1500 bytes long.
constexpr int READ_BUFFER_SIZE = 2048;
/// Size after which messages will be sent preceded with
/// 'nextmessage' frame to let the receiver know in advance
/// the size of larger coming message. All messages up to this
/// size are considered small messages.
constexpr int SMALL_MESSAGE_SIZE = READ_BUFFER_SIZE / 2;

static const std::string JailedDocumentRoot = "/user/docs/";
static const std::string CHILD_URI = "/loolws/child?";

#endif
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
