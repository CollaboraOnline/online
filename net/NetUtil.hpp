/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <string>
#include <memory>

// This file hosts network related common functionality
// and helper/utility functions and classes.
// HTTP-specific helpers are in HttpHeler.hpp.

class StreamSocket;
class ProtocolHandlerInterface;

namespace net
{
/// Connect to an end-point at the given host and port and return StreamSocket.
std::shared_ptr<StreamSocket>
connect(const std::string& host, const std::string& port, const bool isSSL,
        const std::shared_ptr<ProtocolHandlerInterface>& protocolHandler);

/// Decomposes a URI into its components.
/// Returns true if parsing was successful.
bool parseUri(std::string uri, std::string& scheme, std::string& host, std::string& port);

} // namespace net