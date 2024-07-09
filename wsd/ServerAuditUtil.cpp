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

#include "ServerAuditUtil.hpp"

ServerAuditUtil::ServerAuditUtil()
    : _disabled(false)
{
    set("is_admin", "ok");
    set("certwarning", "ok");
}

std::string ServerAuditUtil::getResultsJSON() const
{
    std::lock_guard<std::mutex> lock(_mutex);

    std::string result = "{\"serverAudit\": [";

    bool isFirst = true;
    for (auto entry : _entries)
    {
        if (!isFirst)
            result += ", ";
        isFirst = false;

        result += "{\"code\": \"" + entry.first + "\", \"status\": \"" + entry.second + "\"}";
    }

    result += "]}";
    return result;
}

void ServerAuditUtil::set(std::string code, std::string status)
{
    std::lock_guard<std::mutex> lock(_mutex);

    _entries[code] = std::move(status);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
