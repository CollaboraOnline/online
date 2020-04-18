/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <vector>

/// Are we running inside WSD or by ourselves.
bool isStandalone();

/// Run the set of client tests we have
bool runClientTests(bool standalone, bool verbose);

// ---- Abstraction for standalone vs. WSD ----

/// Get the list of all kit PIDs
std::vector<int> getKitPids();

/// Get the list of spare (unused) kit PIDs
std::vector<int> getSpareKitPids();
/// Get the list of doc (loaded) kit PIDs
std::vector<int> getDocKitPids();

/// Get the PID of the forkit
std::vector<int> getForKitPids();

/// Which port should we connect to get to WSD.
int getClientPort();

/// How many live loolkit processes do we have ?
int getLoolKitProcessCount();

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
