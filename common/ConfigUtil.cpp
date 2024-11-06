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

#include <config.h>

#include <ConfigUtil.hpp>
#include <Util.hpp>

#include <cassert>
#include <string>
#include <sstream>

#include <Poco/Util/AbstractConfiguration.h>
#include <Poco/Util/XMLConfiguration.h>

namespace ConfigUtil
{
static Poco::AutoPtr<Poco::Util::XMLConfiguration> XmlConfig;
static const Poco::Util::AbstractConfiguration* Config{ 0 };

void initialize(const Poco::Util::AbstractConfiguration* config)
{
    assert(!Config && "Config is already initialized.");
    Config = config;
}

void initialize(const std::string& xml)
{
    std::istringstream iss(xml);
    XmlConfig.reset(new Poco::Util::XMLConfiguration(iss));
    initialize(XmlConfig);
}

bool isInitialized()
{
    return Config;
}

/// Recursively extract the sub-keys of the given parent key.
void extract(const std::string& parentKey, const Poco::Util::AbstractConfiguration* config,
             std::map<std::string, std::string>& map)
{
    std::vector<std::string> keys;
    config->keys(parentKey, keys);
    for (const auto& subKey : keys)
    {
        const auto key = parentKey + '.' + subKey;
        if (config->has(key))
        {
            map.emplace(key, config->getString(key));
            extract(key, config, map);
        }
    }
}

std::map<std::string, std::string> extractAll(const Poco::Util::AbstractConfiguration* config)
{
    std::map<std::string, std::string> map;

    std::vector<std::string> keys;
    config->keys(keys);
    for (const auto& key : keys)
    {
        if (config->has(key))
        {
            extract(key, config, map);
        }
    }

    // These keys have no values, but Poco gives us the values of
    // their children concatenated, which is worse than useless.
    // E.g. logging.file: /tmp/coolwsd.lognevertimestamptrue10 days10truefalse
    map.erase("admin_console.logging");
    map.erase("logging.anonymize");
    map.erase("logging.file");
    map.erase("net.lok_allow");
    map.erase("net.post_allow");
    map.erase("per_document.cleanup");
    map.erase("ssl.sts");

    return map;
}

std::string getString(const std::string& key, const std::string& def)
{
    assert(Config && "Config is not initialized.");
    return Config ? Config->getString(key, def) : def;
}

bool getBool(const std::string& key, const bool def)
{
    assert(Config && "Config is not initialized.");
    return Config ? Config->getBool(key, def) : def;
}

int getInt(const std::string& key, const int def)
{
    assert(Config && "Config is not initialized.");
    return Config ? Config->getInt(key, def) : def;
}

bool has(const std::string& key)
{
    assert(Config && "Config is not initialized.");
    return Config ? Config->has(key) : false;
}

bool isSslEnabled()
{
#if ENABLE_SSL
    return !Util::isFuzzing() && getBool("ssl.enable", true);
#else
    return false;
#endif
}

bool isSupportKeyEnabled()
{
#if ENABLE_SUPPORT_KEY
    return true;
#else
    return false;
#endif
}

} // namespace ConfigUtil
