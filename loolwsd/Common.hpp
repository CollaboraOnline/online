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

// The maximum number of client connections we can accept.
constexpr int MAX_SESSIONS = 1024;

constexpr int DEFAULT_CLIENT_PORT_NUMBER = 9980;
constexpr int DEFAULT_MASTER_PORT_NUMBER = 9981;
constexpr int WSD_SLEEP_SECS = 2;
constexpr int CHILD_TIMEOUT_SECS = 4;
constexpr int POLL_TIMEOUT_MS = 1000;
constexpr int COMMAND_TIMEOUT_MS = 5000;
constexpr int WS_SEND_TIMEOUT_MICROSECS = 1000000; // 1 second.

/// Pipe and Socket read buffer size.
/// Should be large enough for ethernet packets
/// which can be 1500 bytes long.
constexpr int READ_BUFFER_SIZE = 2048;
/// Size after which messages will be sent preceded with
/// 'nextmessage' frame to let the receiver know in advance
/// the size of larger coming message. All messages up to this
/// size are considered small messages.
constexpr int SMALL_MESSAGE_SIZE = READ_BUFFER_SIZE / 2;

constexpr auto FIFO_LOOLWSD = "loolwsdfifo";
constexpr auto FIFO_PATH = "pipe";
constexpr auto JAILED_DOCUMENT_ROOT = "/user/docs/";
constexpr auto CHILD_URI = "/loolws/child?";
constexpr auto NEW_CHILD_URI = "/loolws/newchild?";
constexpr auto LO_JAIL_SUBPATH = "lo";

// The client port number, both loolwsd and the kits have this.
extern int ClientPortNumber;
extern int MasterPortNumber;

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
