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

std::string Cache::getConfigId(const std::string& uri)
{
    Poco::URI settingsUri(uri);
    std::string sourcePrefix = settingsUri.getScheme() +
                               '_' + settingsUri.getAuthority();
    std::string sourcePathEtc = settingsUri.getPathEtc();
    return sourcePrefix + sourcePathEtc;
}

std::string Cache::locateConfigFile(const std::string& configId, const std::string& uri)
{
    Poco::URI sourceUri(uri);
    std::string sourcePrefix = sourceUri.getScheme() + '_' + sourceUri.getAuthority();
    std::string sourcePathEtc = sourceUri.getPathEtc();

    Poco::Path rootPath(CachePath, configId);
    rootPath.makeDirectory();

    Poco::Path source(sourcePrefix, sourcePathEtc);
    source.makeDirectory();

    Poco::Path cachePath(rootPath, source);
    cachePath.makeDirectory();

    Poco::File(cachePath).createDirectories();
    Poco::Path destPath(cachePath, "contents");
    return destPath.toString();
}

void Cache::cacheConfigFile(const std::string& configId, const std::string& uri, const std::string& filename)
{
    FileUtil::copyFileTo(filename, locateConfigFile(configId, uri));
}

bool Cache::supplyConfigFile(const std::string& configId, const std::string& uri, const std::string& filename)
{
    std::string cacheFile = locateConfigFile(configId, uri);
    bool exists = FileUtil::Stat(cacheFile).exists();
    if (exists)
        FileUtil::copyFileTo(cacheFile, filename);
    return exists;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
