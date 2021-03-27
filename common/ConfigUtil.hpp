/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Configuration related utilities.
// Placed here to reduce avoid polluting
// Util.hpp with the config headers.

#pragma once

#include <string>

#include <Poco/Util/AbstractConfiguration.h>

namespace config
{
/// Returns the value of an entry as string or @def if it is not found.
inline std::string getString(const Poco::Util::AbstractConfiguration& config,
                             const std::string& key, const std::string& def)
{
    return config.getString(key, def);
}

/// Returns the value of an entry as string or @def if it is not found.
inline bool getBool(const Poco::Util::AbstractConfiguration& config, const std::string& key,
                    const bool def)
{
    return config.getBool(key, def);
}

} // namespace config