/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <fstream>
#include <iostream>
#include <memory>

#include <Poco/File.h>
#include <Poco/Path.h>
#include <Poco/SHA1Engine.h>

#include "TileCache.hpp"

namespace {
    std::string cacheFileName(const std::string& docURL, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight)
    {
        Poco::SHA1Engine digestEngine;

        digestEngine.update(docURL.c_str(), docURL.size());
        digestEngine.update(std::to_string(width));
        digestEngine.update(std::to_string(height));
        digestEngine.update(std::to_string(tilePosX));
        digestEngine.update(std::to_string(tilePosY));
        digestEngine.update(std::to_string(tileWidth));
        digestEngine.update(std::to_string(tileHeight));

        std::string digest = Poco::DigestEngine::digestToHex(digestEngine.digest()).insert(3, "/").insert(2, "/").insert(1, "/");

        return LOOLWSD_CACHEDIR "/" + digest + ".png";
    }
}

std::unique_ptr<std::fstream> TileCache::lookup(const std::string& docURL, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight)
{
    std::string file = cacheFileName(docURL, width, height, tilePosX, tilePosY, tileWidth, tileHeight);

    std::unique_ptr<std::fstream> result(new std::fstream(file, std::ios::in));

    return result;
}

void TileCache::save(const std::string& docURL, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight, const char *data, size_t size)
{
    std::string file = cacheFileName(docURL, width, height, tilePosX, tilePosY, tileWidth, tileHeight);

    Poco::File(Poco::Path(file).makeFile().makeParent()).createDirectories();

    std::fstream outStream(file, std::ios::out);
    outStream.write(data, size);
    outStream.close();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
