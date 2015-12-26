/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "config.h"

#include <cassert>
#include <climits>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>

#include <Poco/DigestEngine.h>
#include <Poco/DirectoryIterator.h>
#include <Poco/Exception.h>
#include <Poco/File.h>
#include <Poco/Path.h>
#include <Poco/SHA1Engine.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Timestamp.h>
#include <Poco/URI.h>

#include "LOOLWSD.hpp"
#include "LOOLProtocol.hpp"
#include "TileCache.hpp"
#include "Util.hpp"

using Poco::DigestEngine;
using Poco::DirectoryIterator;
using Poco::File;
using Poco::SHA1Engine;
using Poco::StringTokenizer;
using Poco::SyntaxException;
using Poco::Timestamp;
using Poco::URI;

using namespace LOOLProtocol;

TileCache::TileCache(const std::string& docURL, const std::string& timestamp) :
    _docURL(docURL),
    _isEditing(false),
    _hasUnsavedChanges(false)
{
    setup(timestamp);
}

std::unique_ptr<std::fstream> TileCache::lookupTile(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight)
{
    std::string cachedName = cacheFileName(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);

    if (_hasUnsavedChanges)
    {
        // try the Editing cache first
        std::string dirName = cacheDirName(true);
        std::string fileName =  + "/" + cachedName;
        File dir(dirName);

        if (dir.exists() && dir.isDirectory() && File(fileName).exists())
        {
            std::unique_ptr<std::fstream> result(new std::fstream(fileName, std::ios::in));
            return result;
        }
    }

    // skip tiles scheduled for removal from the Persistent cache (on save)
    if (_toBeRemoved.find(cachedName) != _toBeRemoved.end())
        return nullptr;

    // default to the content of the Persistent cache
    std::string dirName = cacheDirName(false);
    File dir(dirName);

    if (!dir.exists() || !dir.isDirectory())
        return nullptr;

    std::string fileName = dirName + "/" + cachedName;

    std::unique_ptr<std::fstream> result(new std::fstream(fileName, std::ios::in));

    return result;
}

void TileCache::saveTile(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight, const char *data, size_t size)
{
    if (_isEditing && !_hasUnsavedChanges)
        _hasUnsavedChanges = true;

    std::string dirName = cacheDirName(_hasUnsavedChanges);

    File(dirName).createDirectories();

    std::string fileName = dirName + "/" + cacheFileName(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);

    std::fstream outStream(fileName, std::ios::out);
    outStream.write(data, size);
    outStream.close();
}

std::string TileCache::getTextFile(std::string fileName)
{
    const auto textFile = std::string("/" + fileName);

    std::string dirName = cacheDirName(false);
    if (_hasUnsavedChanges)
    {
        // try the Editing cache first, and prefer it if it exists
        std::string editingDirName = cacheDirName(true);
        File dir(editingDirName);

        File text(editingDirName + textFile);
        if (dir.exists() && dir.isDirectory() && text.exists() && !text.isDirectory())
            dirName = editingDirName;
    }

    if (!File(dirName).exists() || !File(dirName).isDirectory())
        return "";

    fileName = dirName + textFile;
    std::fstream textStream(fileName, std::ios::in);
    if (!textStream.is_open())
        return "";

    std::vector<char> result;
    textStream.seekg(0, std::ios_base::end);
    std::streamsize size = textStream.tellg();
    result.resize(size);
    textStream.seekg(0, std::ios_base::beg);
    textStream.read(result.data(), size);
    textStream.close();

    if (result[result.size()-1] == '\n')
        result.resize(result.size() - 1);

    return std::string(result.data(), result.size());
}

void TileCache::documentSaved()
{
    // first remove the invalidated tiles from the Persistent cache
    std::string persistentDirName = cacheDirName(false);
    for (const auto& it : _toBeRemoved)
        Util::removeFile(persistentDirName + "/" + it);

    _cacheMutex.lock();
    // then move the new tiles from the Editing cache to Persistent
    for (auto tileIterator = DirectoryIterator(cacheDirName(true)); tileIterator != DirectoryIterator(); ++tileIterator)
        tileIterator->moveTo(persistentDirName);
    _cacheMutex.unlock();

    // update status
    _toBeRemoved.clear();
    _hasUnsavedChanges = false;

    // FIXME should we take the exact time of the file for the local files?
    saveLastModified(Timestamp());
}

void TileCache::setEditing(bool editing)
{
    _isEditing = editing;
}

void TileCache::saveTextFile(const std::string& text, std::string fileName)
{
    std::string dirName = cacheDirName(_isEditing);

    File(dirName).createDirectories();

    StringTokenizer tokens(text, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    fileName = dirName + "/" + fileName;
    std::fstream textStream(fileName, std::ios::out);

    if (!textStream.is_open())
        return;

    textStream << text << std::endl;
    textStream.close();
}

void TileCache::saveRendering(const std::string& name, const std::string& dir, const char *data, size_t size)
{
    // can fonts be invalidated?
    std::string dirName = cacheDirName(false) + "/" + dir;

    File(dirName).createDirectories();

    std::string fileName = dirName + "/" + name;

    std::fstream outStream(fileName, std::ios::out);
    outStream.write(data, size);
    outStream.close();
}

std::unique_ptr<std::fstream> TileCache::lookupRendering(const std::string& name, const std::string& dir)
{
    std::string dirName = cacheDirName(false) + "/" + dir;
    std::string fileName = dirName + "/" + name;
    File directory(dirName);

    if (directory.exists() && directory.isDirectory() && File(fileName).exists())
    {
        std::unique_ptr<std::fstream> result(new std::fstream(fileName, std::ios::in));
        return result;
    }

    return nullptr;
}

void TileCache::invalidateTiles(int part, int x, int y, int width, int height)
{
    // in the Editing cache, remove immediately
    const std::string editingDirName = cacheDirName(true);
    File editingDir(editingDirName);
    if (editingDir.exists() && editingDir.isDirectory())
    {
        _cacheMutex.lock();
        for (auto tileIterator = DirectoryIterator(editingDir); tileIterator != DirectoryIterator(); ++tileIterator)
        {
            const std::string fileName = tileIterator.path().getFileName();
            if (intersectsTile(fileName, part, x, y, width, height))
            {
                Util::removeFile(tileIterator.path());
            }
        }
        _cacheMutex.unlock();
    }

    // in the Persistent cache, add to _toBeRemoved for removal on save
    const std::string persistentDirName = cacheDirName(false);
    File persistentDir(persistentDirName);
    if (persistentDir.exists() && persistentDir.isDirectory())
    {
        for (auto tileIterator = DirectoryIterator(persistentDir); tileIterator != DirectoryIterator(); ++tileIterator)
        {
            const std::string fileName = tileIterator.path().getFileName();
            if (_toBeRemoved.find(fileName) == _toBeRemoved.end() && intersectsTile(fileName, part, x, y, width, height))
            {
                _toBeRemoved.insert(fileName);
            }
        }
    }
}

void TileCache::invalidateTiles(const std::string& tiles)
{
    StringTokenizer tokens(tiles, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    assert(tokens[0] == "invalidatetiles:");

    if (tokens.count() == 2 && tokens[1] == "EMPTY")
    {
        invalidateTiles(-1, 0, 0, INT_MAX, INT_MAX);
    }
    else if (tokens.count() != 6)
    {
        return;
    }
    else
    {
        int part, x, y, width, height;
        if (getTokenInteger(tokens[1], "part", part) &&
            getTokenInteger(tokens[2], "x", x) &&
            getTokenInteger(tokens[3], "y", y) &&
            getTokenInteger(tokens[4], "width", width) &&
            getTokenInteger(tokens[5], "height", height))
        {
            invalidateTiles(part, x, y, width, height);
        }
    }
}

std::string TileCache::toplevelCacheDirName()
{
    SHA1Engine digestEngine;

    digestEngine.update(_docURL.c_str(), _docURL.size());

    return (LOOLWSD::cache + "/" +
            DigestEngine::digestToHex(digestEngine.digest()).insert(3, "/").insert(2, "/").insert(1, "/"));
}

std::string TileCache::cacheDirName(bool useEditingCache)
{
    if (useEditingCache)
        return toplevelCacheDirName() + "/editing";
    else
        return toplevelCacheDirName() + "/persistent";
}

std::string TileCache::cacheFileName(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight)
{
    return (std::to_string(part) + "_" +
            std::to_string(width) + "x" + std::to_string(height) + "." +
            std::to_string(tilePosX) + "," + std::to_string(tilePosY) + "." +
            std::to_string(tileWidth) + "x" + std::to_string(tileHeight) + ".png");
}

bool TileCache::parseCacheFileName(const std::string& fileName, int& part, int& width, int& height, int& tilePosX, int& tilePosY, int& tileWidth, int& tileHeight)
{
    return (std::sscanf(fileName.c_str(), "%d_%dx%d.%d,%d.%dx%d.png", &part, &width, &height, &tilePosX, &tilePosY, &tileWidth, &tileHeight) == 7);
}

bool TileCache::intersectsTile(const std::string& fileName, int part, int x, int y, int width, int height)
{
    int tilePart, tilePixelWidth, tilePixelHeight, tilePosX, tilePosY, tileWidth, tileHeight;

    if (parseCacheFileName(fileName, tilePart, tilePixelWidth, tilePixelHeight, tilePosX, tilePosY, tileWidth, tileHeight))
    {
        if (part != -1 && tilePart != part)
            return false;

        int left = std::max(x, tilePosX);
        int right = std::min(x + width, tilePosX + tileWidth);
        int top = std::max(y, tilePosY);
        int bottom = std::min(y + height, tilePosY + tileHeight);

        if (left <= right && top <= bottom)
            return true;
    }

    return false;
}

Timestamp TileCache::getLastModified()
{
    std::fstream modTimeFile(toplevelCacheDirName() + "/modtime.txt", std::ios::in);

    if (!modTimeFile.is_open())
        return 0;

    Timestamp::TimeVal result;
    modTimeFile >> result;

    modTimeFile.close();
    return result;
}

void TileCache::saveLastModified(const Poco::Timestamp& timestamp)
{
    std::fstream modTimeFile(toplevelCacheDirName() + "/modtime.txt", std::ios::out);
    modTimeFile << timestamp.raw() << std::endl;
    modTimeFile.close();
}

void TileCache::setup(const std::string& timestamp)
{
    bool cleanEverything = true;
    std::string filePath;
    Timestamp lastModified;

    try
    {
        URI uri(_docURL);
        if (uri.getScheme() == "" ||
            uri.getScheme() == "file")
        {
            filePath = uri.getPath();
        }
    }
    catch (SyntaxException& e)
    {
    }

    if (!filePath.empty() && File(filePath).exists() && File(filePath).isFile())
    {
        // for files, always use the real path
        lastModified = File(filePath).getLastModified();
        cleanEverything = (getLastModified() < lastModified);
    }
    else if (!timestamp.empty())
    {
        // otherwise try the timestamp provided by the caller
        Timestamp::TimeVal lastTimeVal;
        std::istringstream(timestamp) >> lastTimeVal;
        lastModified = lastTimeVal;
        Log::info("Timestamp provided externally: " + timestamp);

        cleanEverything = (getLastModified() < Timestamp(lastModified));
    }
    else
    {
        // when no timestamp, and non-file, assume 'now'
        lastModified = Timestamp();
    }

    if (cleanEverything)
    {
        // document changed externally, clean up everything
        const auto path = toplevelCacheDirName();
        Util::removeFile(path, true);
        Log::info("Completely cleared cache: " + path);
    }
    else
    {
        // remove only the Editing cache
        const auto path = cacheDirName(true);
        Util::removeFile(path, true);
        Log::info("Cleared the editing cache: " + path);
    }

    File cacheDir(toplevelCacheDirName());
    cacheDir.createDirectories();

    saveLastModified(lastModified);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
