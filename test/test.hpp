/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_TEST_HPP
#define INCLUDED_TEST_HPP

#include <vector>

/// Are we running inside WSD or by ourselves.
bool isStandalone();

/// Run the set of client tests we have
bool runClientTests(bool standalone, bool verbose);

// ---- Abstraction for standalone vs. WSD ----

/// Get the list of kit PIDs
std::vector<int> getKitPids();

/// Get the PID of the forkit
std::vector<int> getForKitPids();

/// How many live lookit processes do we have ?
int getLoolKitProcessCount();

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
