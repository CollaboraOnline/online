/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <string>

// Default values and other shared data between processes.
#ifndef INCLUDED_COMMON_HPP
#define INCLUDED_COMMON_HPP

constexpr int DEFAULT_CLIENT_PORT_NUMBER = 9980;

constexpr int COMMAND_TIMEOUT_MS = 5000;
constexpr int CHILD_TIMEOUT_MS = COMMAND_TIMEOUT_MS;
constexpr int CHILD_REBALANCE_INTERVAL_MS = CHILD_TIMEOUT_MS / 10;
constexpr int POLL_TIMEOUT_MICRO_S = (COMMAND_TIMEOUT_MS / 5) * 1000;
constexpr int WS_SEND_TIMEOUT_MS = 1000;

constexpr int TILE_ROUNDTRIP_TIMEOUT_MS = 5000;

/// Pipe and Socket read buffer size.
/// Should be large enough for ethernet packets
/// which can be 1500 bytes long.
constexpr long READ_BUFFER_SIZE = 64 * 1024;

/// Message larger than this will be dropped as invalid
/// or as intentionally flooding the server.
constexpr int MAX_MESSAGE_SIZE = 2 * 1024 * READ_BUFFER_SIZE;

constexpr const char JAILED_DOCUMENT_ROOT[] = "/user/docs/";
constexpr const char CHILD_URI[] = "/loolws/child?";
constexpr const char NEW_CHILD_URI[] = "/loolws/newchild";
constexpr const char LO_JAIL_SUBPATH[] = "lo";
constexpr const char FORKIT_URI[] = "/loolws/forkit";

constexpr const char CAPABILITIES_END_POINT[] = "/hosting/capabilities";

/// The HTTP response User-Agent.
#define HTTP_AGENT_STRING "LOOLWSD HTTP Agent " LOOLWSD_VERSION

/// The WOPI User-Agent.
#define WOPI_AGENT_STRING "LOOLWSD WOPI Agent " LOOLWSD_VERSION

// The client port number, both loolwsd and the kits have this.
extern int ClientPortNumber;
extern std::string MasterLocation;

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
