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

/// Are we running inside WSD or by ourselves.
bool isStandalone();

/// Run the set of client tests we have
bool runClientTests(const char* cmd, bool standalone, bool verbose);

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
