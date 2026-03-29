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

#include <string>

namespace ContentType
{
/// Map a file name (or path) to its MIME content type based on extension.
/// Returns "application/octet-stream" for unknown extensions.
std::string fromFileName(const std::string& fileName);

/// Return true if the file name corresponds to a spreadsheet type.
bool isSpreadsheet(const std::string& fileName);

} // namespace ContentType

/* vim:set shiftwidth=4 expandtab: */
