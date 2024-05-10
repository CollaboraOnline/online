/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <fuzzer/Common.hpp>

#include <map>
#include <string>

#include "config.h"
#include <Log.hpp>

namespace fuzzer
{
bool DoInitialization()
{
    std::string logLevel("none");
    bool withColor = false;
    bool logToFile = false;
    std::map<std::string, std::string> logProperties;
    Log::initialize("wsd", logLevel, withColor, logToFile, logProperties);
    return true;
}
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
