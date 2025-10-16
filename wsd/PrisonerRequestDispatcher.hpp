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

#include <Socket.hpp>
#include <Process.hpp>

/// Handles the socket that the prisoner kit connected to WSD on.
class PrisonerRequestDispatcher final : public WebSocketHandler
{
    std::weak_ptr<ChildProcess> _childProcess;
    int _pid; ///< The Kit's PID (for logging).
    int _socketFD; ///< The socket FD to the Kit (for logging).
    bool _associatedWithDoc; ///< True when/if we get a DocBroker.

public:
    PrisonerRequestDispatcher();
    ~PrisonerRequestDispatcher();

private:
    /// Keep our socket around ...
    void onConnect(const std::shared_ptr<StreamSocket>& socket) override;
    void onDisconnect() override;

    /// Called after successful socket reads.
    void handleIncomingMessage(SocketDisposition &disposition) override;
    /// Prisoner websocket fun ... (for now)
    virtual void handleMessage(const std::vector<char> &data) override;

    int getPollEvents(std::chrono::steady_clock::time_point now, int64_t & timeoutMaxMs) override;
    void performWrites(std::size_t capacity) override;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
