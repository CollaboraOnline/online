/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
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
namespace Delay
{
    int create(int delayMs, int physicalFd);
    void dumpState(std::ostream &os);
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
