/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <config.h>

#include <string>
#include "ConfigUtil.hpp"

namespace Zotero
{

const std::string APIURL = "https://api.zotero.org";

class ZoteroConfig
{
    static std::string APIKey;
    static std::string UserId;

public:
    static bool isEnabled() { return config::getBool("zotero.enable", true); }

    static void setAPIKey(const std::string& key) { APIKey = key; }

    static const std::string getAPIKey() { return APIKey; }

    static void setUserId(const std::string& id) { UserId = id; }

    static std::string fetchUserId(const std::string& key);

    static const std::string getUserId() { return UserId; }

    static std::string fetchItemsList();
};

} // namespace Zotero