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

struct TileCache
{
    static std::unique_ptr<std::fstream> lookup(const std::string& docURL, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight);
    static void save(const std::string& docURL, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight, const char *data, size_t size);
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
