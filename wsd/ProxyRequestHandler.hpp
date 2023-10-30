/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

#pragma once

#include <string>
#include "Socket.hpp"

class ProxyRequestHandler
{
public:
    static void handleRequest(const std::string& relPath,
                              const std::shared_ptr<StreamSocket>& socket,
                              const std::string& serverUri);
    static std::string getProxyRatingServer() { return ProxyRatingServer; }

private:
    static std::chrono::system_clock::time_point MaxAge;
    static constexpr auto ProxyRatingServer = "https://rating.collaboraonline.com";
    static std::unordered_map<std::string, std::shared_ptr<http::Response>> CacheFileHash;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
