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
#include <mutex>
#include <sstream>
#include <string>

#include <Poco/DigestEngine.h>
#include <Poco/DirectoryIterator.h>
#include <Poco/Exception.h>
#include <Poco/File.h>
#include <Poco/Path.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Timestamp.h>
#include <Poco/URI.h>

#include "Storage.hpp"
#include "LOOLProtocol.hpp"
#include "TileCache.hpp"
#include "Util.hpp"

using Poco::DirectoryIterator;
using Poco::File;
using Poco::FileException;
using Poco::Path;
using Poco::StringTokenizer;
using Poco::Timestamp;
using Poco::URI;

using namespace LOOLProtocol;

TileCache::TileCache(const std::string& docURL,
                     const Timestamp& modifiedTime,
                     const std::string& rootCacheDir) :
    _docURL(docURL),
    _rootCacheDir(rootCacheDir),
    _persCacheDir(Path(rootCacheDir, "persistent").toString()),
    _editCacheDir(Path(rootCacheDir, "editing").toString()),
    _isEditing(false),
    _hasUnsavedChanges(false)
{
    Log::info("TileCache ctor for uri [" + _docURL + "].");
    const bool cleanEverything = (getLastModified() < modifiedTime);
    if (cleanEverything)
    {
        // document changed externally, clean up everything
        Util::removeFile(_rootCacheDir, true);
        Log::info("Completely cleared tilecache: " + _rootCacheDir);
    }
    else
    {
        // remove only the Editing cache
        Util::removeFile(_editCacheDir, true);
        Log::info("Cleared the editing tilecache: " + _editCacheDir);
    }

    File(_rootCacheDir).createDirectories();
    File(_editCacheDir).createDirectories();
    File(_persCacheDir).createDirectories();

    saveLastModified(modifiedTime);
}

TileCache::~TileCache()
{
    Log::info("~TileCache dtor for uri [" + _docURL + "].");
}

std::unique_ptr<std::fstream> TileCache::lookupTile(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight)
{
    const std::string cachedName = cacheFileName(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);

    if (_hasUnsavedChanges)
    {
        // Try the Editing cache first.
        Path path(_editCacheDir, cachedName);
        const std::string fileName = path.toString();
        std::unique_ptr<std::fstream> result(new std::fstream(fileName, std::ios::in));
        if (result && result->is_open())
        {
            Log::trace("Found editing tile: " + fileName);
            return result;
        }
    }

    // Skip tiles scheduled for removal from the Persistent cache (on save)
    if (_toBeRemoved.find(cachedName) != _toBeRemoved.end())
    {
        Log::trace("Skipping perishable tile: " + cachedName);
        return nullptr;
    }

    // Default to the content of the Persistent cache.
    Path path(_persCacheDir, cachedName);
    const std::string fileName = path.toString();
    std::unique_ptr<std::fstream> result(new std::fstream(fileName, std::ios::in));
    if (result && result->is_open())
    {
        Log::trace("Found persistent tile: " + fileName);
        return result;
    }

    return nullptr;
}

void TileCache::saveTile(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight, const char *data, size_t size)
{
    if (_isEditing)
    {
        _hasUnsavedChanges = true;
    }

    const std::string dirName = cacheDirName(_hasUnsavedChanges);

    const std::string fileName = dirName + "/" + cacheFileName(part, width, height, tilePosX, tilePosY, tileWidth, tileHeight);
    Log::trace() << "Saving "
                 << (_hasUnsavedChanges ? "editing" : "persistent") <<
                 " tile: " << fileName << Log::end;

    std::fstream outStream(fileName, std::ios::out);
    outStream.write(data, size);
    outStream.close();
}

std::string TileCache::getTextFile(std::string fileName)
{
    const auto textFile = std::string("/" + fileName);

    std::string dirName = _persCacheDir;
    if (_hasUnsavedChanges)
    {
        // try the Editing cache first, and prefer it if it exists
        const std::string editingDirName = _editCacheDir;
        File dir(editingDirName);

        File text(editingDirName + textFile);
        if (dir.exists() && dir.isDirectory() && text.exists() && !text.isDirectory())
            dirName = editingDirName;
    }

    if (!File(dirName).exists() || !File(dirName).isDirectory())
    {
        return "";
    }

    fileName = dirName + textFile;
    std::fstream textStream(fileName, std::ios::in);
    if (!textStream.is_open())
    {
        return "";
    }

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
    Log::debug("Persisting editing tiles.");

    // first remove the invalidated tiles from the Persistent cache
    for (const auto& it : _toBeRemoved)
    {
        Util::removeFile(_persCacheDir + "/" + it);
    }

    _toBeRemoved.clear();

    // then move the new tiles from the Editing cache to Persistent
    try
    {
        std::unique_lock<std::mutex> lock(_cacheMutex);
        for (auto tileIterator = DirectoryIterator(_editCacheDir); tileIterator != DirectoryIterator(); ++tileIterator)
        {
            tileIterator->moveTo(_persCacheDir);
        }

        // update status
        _hasUnsavedChanges = false;

        // FIXME should we take the exact time of the file for the local files?
        saveLastModified(Timestamp());
    }
    catch (const FileException& exc)
    {
        // Just log this exception, ignore it otherwise
        Log::error() << "TileCache::documentSaved: Exception: " << exc.displayText()
                     << (exc.nested() ? " (" + exc.nested()->displayText() + ")" : "")
                     << Log::end;
    }
}

void TileCache::setEditing(bool editing)
{
    _isEditing = editing;
}

void TileCache::saveTextFile(const std::string& text, std::string fileName)
{
    const std::string dirName = cacheDirName(_isEditing);

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
    const std::string dirName = _persCacheDir + "/" + dir;

    File(dirName).createDirectories();

    const std::string fileName = dirName + "/" + name;

    std::fstream outStream(fileName, std::ios::out);
    outStream.write(data, size);
    outStream.close();
}

std::unique_ptr<std::fstream> TileCache::lookupRendering(const std::string& name, const std::string& dir)
{
    const std::string dirName = _persCacheDir + "/" + dir;
    const std::string fileName = dirName + "/" + name;
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
    Log::trace() << "Removing invalidated tiles: part: " << part
                 << ", x: " << x << ", y: " << y
                 << ", width: " << width
                 << ", height: " << height << Log::end;

    // in the Editing cache, remove immediately
    File editingDir(_editCacheDir);
    if (editingDir.exists() && editingDir.isDirectory())
    {
        std::unique_lock<std::mutex> lock(_cacheMutex);
        for (auto tileIterator = DirectoryIterator(editingDir); tileIterator != DirectoryIterator(); ++tileIterator)
        {
            const std::string fileName = tileIterator.path().getFileName();
            if (intersectsTile(fileName, part, x, y, width, height))
            {
                Util::removeFile(tileIterator.path());
            }
        }
    }

    // in the Persistent cache, add to _toBeRemoved for removal on save
    File persistentDir(_persCacheDir);
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

void TileCache::removeFile(const std::string fileName)
{
    Log::warn("Removing tile: " + fileName);
    Util::removeFile(_persCacheDir + "/" + fileName);
    Util::removeFile(_editCacheDir + "/" + fileName);
}

std::string TileCache::cacheDirName(const bool useEditingCache)
{
    return (useEditingCache ? _editCacheDir : _persCacheDir);
}

std::string TileCache::cacheFileName(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight)
{
    std::ostringstream oss;
    oss << part << '_' << width << 'x' << height << '.'
        << tilePosX << ',' << tilePosY << '.'
        << tileWidth << 'x' << tileHeight << ".png";
    return oss.str();
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

        const int left = std::max(x, tilePosX);
        const int right = std::min(x + width, tilePosX + tileWidth);
        const int top = std::max(y, tilePosY);
        const int bottom = std::min(y + height, tilePosY + tileHeight);

        if (left <= right && top <= bottom)
            return true;
    }

    return false;
}

Timestamp TileCache::getLastModified()
{
    std::fstream modTimeFile(_rootCacheDir + "/modtime.txt", std::ios::in);

    if (!modTimeFile.is_open())
        return 0;

    Timestamp::TimeVal result;
    modTimeFile >> result;

    modTimeFile.close();
    return result;
}

void TileCache::saveLastModified(const Timestamp& timestamp)
{
    std::fstream modTimeFile(_rootCacheDir + "/modtime.txt", std::ios::out);
    modTimeFile << timestamp.raw() << std::endl;
    modTimeFile.close();
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
