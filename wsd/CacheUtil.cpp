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

#include "CacheUtil.hpp"

#include <Poco/Path.h>
#include <Poco/URI.h>
#include "ClientSession.hpp"
#include "DocumentBroker.hpp"
#include "FileUtil.hpp"
#include "Util.hpp"

#include <chrono>
#include <common/Common.hpp>
#include <common/StringVector.hpp>
#include <common/Log.hpp>
#include <mutex>

std::string Cache::CachePath;

void Cache::initialize(const std::string& path)
{
    if (!CachePath.empty())
    {
        return;
    }

    LOG_INF("Initializing Cache at [" << path << "]");

    // Make sure the cache directories exists, or we throw if we can't create it.
    Poco::File(path).createDirectories();

    // We are initialized at this point.
    CachePath = path;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
