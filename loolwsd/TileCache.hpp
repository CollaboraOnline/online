/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_TILECACHE_HPP
#define INCLUDED_TILECACHE_HPP

#include <fstream>
#include <memory>

#include <Poco/Timestamp.h>

class TileCache
{
public:
    TileCache(const std::string& docURL);

    std::unique_ptr<std::fstream> lookupTile(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight);
    void saveTile(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight, const char *data, size_t size);
    std::string getStatus();
    void saveStatus(const std::string& status);

private:
    std::string cacheDirName();
    std::string cacheFileName(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight);
    Poco::Timestamp getLastModified();

    const std::string& _docURL;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
