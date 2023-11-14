/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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

#include <Protocol.hpp>

namespace Seccomp {
    enum Type { KIT, WSD };

    /// Lock-down a process hard - @returns true on success.
    bool lockdown(Type type);
};

namespace Rlimit {
    /// Handles setconfig command with limit_... subcommands.
    /// Returns true iff it handled the command, regardless of success/failure.
    bool handleSetrlimitCommand(const StringVector& tokens);
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
