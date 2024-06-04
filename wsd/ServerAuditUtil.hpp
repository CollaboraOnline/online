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
#include <map>

/** This class helps to build list of security warnings for a server instance
 */
class ServerAuditUtil
{
    // <code, status>
    static std::map<std::string, std::string> entries;

public:
    static void initialize();

    static std::string getResultsJSON();

    static void set(std::string code, std::string status);
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
