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
#include <string>

#include <Poco/File.h>
#include <Poco/Timestamp.h>

class TileCache
{
public:
    TileCache(const std::string& docURL);

    std::unique_ptr<std::fstream> lookupTile(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight);
    void saveTile(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight, const char *data, size_t size);
    std::string getStatus();

    // The parameter is a status: message
    void saveStatus(const std::string& status);

    // The tiles parameter is an invalidatetiles: message as sent by the child process
    void invalidateTiles(int part, const std::string& tiles);

    void invalidateTiles(int part, int x, int y, int width, int height);

private:
    std::string cacheDirName();
    std::string cacheFileName(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight);
    bool parseCacheFileName(std::string& fileName, int& part, int& width, int& height, int& tilePosX, int& tilePosY, int& tileWidth, int& tileHeight);
    Poco::Timestamp getLastModified();
    void setupForFile(Poco::File& cacheDir, const std::string& path);

    const std::string& _docURL;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
