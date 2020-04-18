/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// A list of user-visible messages.
// This list is intended to be centralized for review and i18n support.

#pragma once

constexpr const char* SERVICE_UNAVAILABLE_INTERNAL_ERROR = "error: cmd=socket kind=serviceunavailable";
constexpr const char* PAYLOAD_UNAVAILABLE_LIMIT_REACHED = "error: cmd=socket kind=hardlimitreached params=%u,%u";
constexpr const char* PAYLOAD_INFO_LIMIT_REACHED = "info: cmd=socket kind=limitreached params=%u,%u";

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
