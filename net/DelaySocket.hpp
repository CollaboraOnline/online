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

/// Simulates network latency for local debugging.
///
/// We are lifecycle managed internally based on the physical /
/// delayFd lifecycle.
///
/// An instance of Delay must be created before using the
/// static members and must outlive all sockets.
class Delay final
{
public:
    Delay(std::size_t latencyMs);
    ~Delay();

    static int create(int delayMs, int physicalFd);
    static void dumpState(std::ostream &os);

private:
    static std::shared_ptr<TerminatingPoll> DelayPoll;
    static std::once_flag DelayPollOnceFlag;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
