/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
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

namespace config
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

bool isSslEnabled()
{
#if ENABLE_SSL
    return !Util::isFuzzing() && getBool("ssl.enable", true);
#else
    return false;
#endif
}
} // namespace config