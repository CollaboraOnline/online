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

/*
 * Stub missing symbols required for unit tests ...
 */

#include <config.h>

#include "common/Common.hpp"
#include "ChildSession.hpp"
#include "DeltaSimd.h"

void ChildSession::loKitCallback(const int /* type */, const std::string& /* payload */) {}
void ChildSession::disconnect() {}
int ChildSession::getSpeed() { return 0; }
bool ChildSession::_handleInput(const char* /*buffer*/, int /*length*/) { return false; }
bool ChildSession::isTileInsideVisibleArea(const TileDesc& /*tile*/) const { return false; }
ChildSession::~ChildSession() {}

int simd_initPixRowSimd(const uint32_t *, uint32_t *, size_t *, uint64_t *) { return 0; }

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
