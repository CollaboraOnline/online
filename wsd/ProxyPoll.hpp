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

#pragma once

#include <config.h>
#include <net/Socket.hpp>
#include <Log.hpp>
#include <memory>

namespace Poco::Net { class HTTPRequest; }

/// Singleton poll thread that handles all internal proxy connections.
/// When a pod receives a request for a document it doesn't own, ProxyPoll
/// pumps data bidirectionally between the client and the owning pod.
class ProxyPoll : public TerminatingPoll
{
public:
    static std::shared_ptr<ProxyPoll> instance()
    {
        static std::shared_ptr<ProxyPoll> poll(new ProxyPoll());
        return poll;
    }

    /// Set up a bidirectional proxy between the client and a target pod.
    /// Transfers the client socket to this poll, async-connects to the target,
    /// and pumps data in both directions with 256KB flow control.
    static void startPump(const std::shared_ptr<StreamSocket>& clientSocket,
                          const std::string& targetIp, int targetPort,
                          const Poco::Net::HTTPRequest& originalRequest,
                          const std::shared_ptr<SocketPoll>& fromPoll);

    ~ProxyPoll()
    {
        joinThread();
    }

private:
    ProxyPoll()
        : TerminatingPoll("proxy_poll")
    {
        startThread();
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
