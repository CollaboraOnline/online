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
#include <mutex>

/** This class helps to build list of security warnings for a server instance
 */
class ServerAuditUtil
{
    mutable std::mutex _mutex;

    // <code, status>
    std::map<std::string, std::string> _entries;

    bool _disabled;

public:
    ServerAuditUtil();

    std::string getResultsJSON() const;

    void set(std::string code, std::string status);

    void disable() { _disabled = true; }
    bool isDisabled() const { return _disabled; }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
