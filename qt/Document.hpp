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

#include <Poco/URI.h>

namespace coda
{
struct DocumentData
{
    Poco::URI _fileURL; // Temp file path that COOL actually operates on
    int _fakeClientFd = -1;
    unsigned _appDocId = 0;
    Poco::URI _saveLocationURI; // Save location URI, that is only changed on save or auto-save.
};
} // namespace coda

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
