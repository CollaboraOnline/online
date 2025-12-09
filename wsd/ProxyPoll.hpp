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
#include <Socket.hpp>

// Singleton proxy poll - one thread handles all proxy connections
class ProxyPoll : public TerminatingPoll
{
public:
    static ProxyPoll& instance()
    {
        static ProxyPoll poll;
        return poll;
    }

    static void startPump(const std::shared_ptr<StreamSocket>& clientSocket,
                          const std::string& targetIp, int targetPort,
                          const Poco::Net::HTTPRequest& originalRequest);

private:
    ProxyPoll()
        : TerminatingPoll("proxy_poll")
    {
        startThread(); // Spawns new thread running pollingThread()
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
