/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
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

void ChildSession::loKitCallback(const int /* type */, const std::string& /* payload */) {}
void ChildSession::disconnect() {}
bool ChildSession::_handleInput(const char* /*buffer*/, int /*length*/) { return false; }
ChildSession::~ChildSession() {}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
