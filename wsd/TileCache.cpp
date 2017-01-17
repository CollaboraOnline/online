/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include "TileCache.hpp"
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
#include <vector>

#include <Poco/DigestEngine.h>
#include <Poco/DirectoryIterator.h>
#include <Poco/Exception.h>
#include <Poco/File.h>
#include <Poco/Path.h>
#include <Poco/StringTokenizer.h>
#include <Poco/Timestamp.h>
#include <Poco/URI.h>

#include "ClientSession.hpp"
#include "Common.hpp"
#include "common/FileUtil.hpp"
#include "Protocol.hpp"
#include "Unit.hpp"
#include "Util.hpp"

using Poco::DirectoryIterator;
using Poco::File;
using Poco::StringTokenizer;
using Poco::Timestamp;

using namespace LOOLProtocol;

TileCache::TileCache(const std::string& docURL,
                     const Timestamp& modifiedTime,
                     const std::string& cacheDir) :
    _docURL(docURL),
    _cacheDir(cacheDir),
    _cacheMutex(),
    _tilesBeingRenderedMutex()
{
    Log::info() << "TileCache ctor for uri [" << _docURL
                << "] modifiedTime=" << (modifiedTime.raw()/1000000)
                << " getLastModified()=" << (getLastModified().raw()/1000000) << Log::end;
    File directory(_cacheDir);
    std::string unsaved;
    if (directory.exists() &&
        (getLastModified() < modifiedTime ||
         getTextFile("unsaved.txt", unsaved)))
    {
        // Document changed externally or modifications were not saved after all. Cache not useful.
        FileUtil::removeFile(_cacheDir, true);
        Log::info("Completely cleared tile cache: " + _cacheDir);
    }

    File(_cacheDir).createDirectories();

    saveLastModified(modifiedTime);
}

TileCache::~TileCache()
{
    Log::info("~TileCache dtor for uri [" + _docURL + "].");
}

/// Tracks the rendering of a given tile
/// to avoid duplication and help clock
/// rendering latency.
struct TileCache::TileBeingRendered
{
    std::vector<std::weak_ptr<ClientSession>> _subscribers;

    TileBeingRendered(const std::string& cachedName, const TileDesc& tile)
     : _startTime(std::chrono::steady_clock::now()),
       _tile(tile),
       _cachedName(cachedName)
    {
    }

    const TileDesc& getTile() const { return _tile; }
    const std::string& getCacheName() const { return _cachedName; }
    int getVersion() const { return _tile.getVersion(); }
    void setVersion(int version) { _tile.setVersion(version); }

    std::chrono::steady_clock::time_point getStartTime() const { return _startTime; }
    double getElapsedTimeMs() const { return std::chrono::duration_cast<std::chrono::milliseconds>
                                              (std::chrono::steady_clock::now() - _startTime).count(); }
    void resetStartTime()
    {
        _startTime = std::chrono::steady_clock::now();
    }

private:
    std::chrono::steady_clock::time_point _startTime;
    TileDesc _tile;
    std::string _cachedName;
};

std::shared_ptr<TileCache::TileBeingRendered> TileCache::findTileBeingRendered(const TileDesc& tileDesc)
{
    const std::string cachedName = cacheFileName(tileDesc);

    Util::assertIsLocked(_tilesBeingRenderedMutex);

    const auto tile = _tilesBeingRendered.find(cachedName);
    return (tile != _tilesBeingRendered.end() ? tile->second : nullptr);
}

void TileCache::forgetTileBeingRendered(const TileDesc& tile)
{
    const std::string cachedName = cacheFileName(tile);

    Util::assertIsLocked(_tilesBeingRenderedMutex);

    _tilesBeingRendered.erase(cachedName);
}

std::unique_ptr<std::fstream> TileCache::lookupTile(const TileDesc& tile)
{
    const std::string fileName = _cacheDir + "/" + cacheFileName(tile);

    std::unique_ptr<std::fstream> result(new std::fstream(fileName, std::ios::in));
    UnitWSD::get().lookupTile(tile.getPart(), tile.getWidth(), tile.getHeight(),
                              tile.getTilePosX(), tile.getTilePosY(),
                              tile.getTileWidth(), tile.getTileHeight(), result);

    if (result && result->is_open())
    {
        Log::trace("Found cache tile: " + fileName);
        return result;
    }

    return nullptr;
}

void TileCache::saveTileAndNotify(const TileDesc& tile, const char *data, const size_t size)
{
    std::unique_lock<std::mutex> lock(_tilesBeingRenderedMutex);

    std::shared_ptr<TileBeingRendered> tileBeingRendered = findTileBeingRendered(tile);

    // Save to disk.
    const auto cachedName = (tileBeingRendered ? tileBeingRendered->getCacheName()
                                               : cacheFileName(tile));

    // Ignore if we can't save the tile, things will work anyway, but slower. An error indication
    // has been supposed to be sent to all users in that case.
    const auto fileName = _cacheDir + "/" + cachedName;
    if (FileUtil::saveDataToFileSafely(fileName, data, size))
    {
        Log::trace() << "Saved cache tile: " << fileName << Log::end;
    }

    // Notify subscribers, if any.
    if (tileBeingRendered)
    {
        if (!tileBeingRendered->_subscribers.empty())
        {
            std::string response = tile.serialize("tile:");
            Log::debug("Sending tile message to subscribers: " + response);

            std::vector<char> output(256 + size);
            output.resize(response.size() + 1 + size);

            std::memcpy(output.data(), response.data(), response.size());
            output[response.size()] = '\n';
            std::memcpy(output.data() + response.size() + 1, data, size);

            // Send to first subscriber as-is (without cache marker).
            auto firstSubscriber = tileBeingRendered->_subscribers[0].lock();
            if (firstSubscriber)
            {
                try
                {
                    firstSubscriber->sendBinaryFrame(output.data(), output.size());
                }
                catch (const std::exception& ex)
                {
                    Log::warn("Failed to send tile to " + firstSubscriber->getName() + ": " + ex.what());
                }
            }

            // All others must get served from the cache.
            response += " renderid=cached\n";
            output.resize(response.size() + size);
            std::memcpy(output.data(), response.data(), response.size());
            std::memcpy(output.data() + response.size(), data, size);

            for (size_t i = 1; i < tileBeingRendered->_subscribers.size(); ++i)
            {
                auto subscriber = tileBeingRendered->_subscribers[i].lock();
                if (subscriber)
                {
                    try
                    {
                        subscriber->sendBinaryFrame(output.data(), output.size());
                    }
                    catch (const std::exception& ex)
                    {
                        Log::warn("Failed to send tile to " + subscriber->getName() + ": " + ex.what());
                    }
                }
            }
        }
        else
        {
            Log::debug("No subscribers for: " + cachedName);
        }

        // Remove subscriptions.
        if (tileBeingRendered->getVersion() <= tile.getVersion())
        {
            Log::debug() << "STATISTICS: tile " << tile.getVersion() << " internal roundtrip "
                         << tileBeingRendered->getElapsedTimeMs() << " ms." << Log::end;
            _tilesBeingRendered.erase(cachedName);
        }
    }
    else
    {
        Log::debug("No subscribers for: " + cachedName);
    }
}

bool TileCache::getTextFile(const std::string& fileName, std::string& content)
{
    const std::string fullFileName =  _cacheDir + "/" + fileName;

    std::fstream textStream(fullFileName, std::ios::in);
    if (!textStream.is_open())
    {
        Log::info("Could not open " + fullFileName);
        return false;
    }

    std::vector<char> buffer;
    textStream.seekg(0, std::ios_base::end);
    std::streamsize size = textStream.tellg();
    buffer.resize(size);
    textStream.seekg(0, std::ios_base::beg);
    textStream.read(buffer.data(), size);
    textStream.close();

    if (buffer.size() > 0 && buffer.back() == '\n')
        buffer.pop_back();

    content = std::string(buffer.data(), buffer.size());
    Log::info("Read '" + LOOLProtocol::getAbbreviatedMessage(content.c_str(), content.size()) + "' from " + fullFileName);

    return true;
}

void TileCache::saveTextFile(const std::string& text, const std::string& fileName)
{
    const std::string fullFileName = _cacheDir + "/" + fileName;
    std::fstream textStream(fullFileName, std::ios::out);

    if (!textStream.is_open())
    {
        Log::error("Could not save '" + text + "' to " + fullFileName);
        return;
    }
    else
    {
        Log::info("Saving '" + LOOLProtocol::getAbbreviatedMessage(text.c_str(), text.size()) + "' to " + fullFileName);
    }

    textStream << text << std::endl;
    textStream.close();
}

void TileCache::setUnsavedChanges(bool state)
{
    if (state)
        saveTextFile("1", "unsaved.txt");
    else
        removeFile("unsaved.txt");
}

void TileCache::saveRendering(const std::string& name, const std::string& dir, const char *data, size_t size)
{
    // can fonts be invalidated?
    const std::string dirName = _cacheDir + "/" + dir;

    File(dirName).createDirectories();

    const std::string fileName = dirName + "/" + name;

    FileUtil::saveDataToFileSafely(fileName, data, size);
}

std::unique_ptr<std::fstream> TileCache::lookupCachedFile(const std::string& name, const std::string& dir)
{
    const std::string dirName = _cacheDir + "/" + dir;
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

    File dir(_cacheDir);

    std::unique_lock<std::mutex> lock(_cacheMutex);
    std::unique_lock<std::mutex> lockSubscribers(_tilesBeingRenderedMutex);

    if (dir.exists() && dir.isDirectory())
    {
        for (auto tileIterator = DirectoryIterator(dir); tileIterator != DirectoryIterator(); ++tileIterator)
        {
            const std::string fileName = tileIterator.path().getFileName();
            if (intersectsTile(fileName, part, x, y, width, height))
            {
                Log::debug("Removing tile: " + tileIterator.path().toString());
                FileUtil::removeFile(tileIterator.path());
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
        return;
    }
    else if (tokens.count() == 3 && tokens[1] == "EMPTY,")
    {
        int part = 0;
        if (stringToInteger(tokens[2], part))
        {
            invalidateTiles(part, 0, 0, INT_MAX, INT_MAX);
            return;
        }
    }
    else
    {
        int part, x, y, width, height;
        if (tokens.count() == 6 &&
            getTokenInteger(tokens[1], "part", part) &&
            getTokenInteger(tokens[2], "x", x) &&
            getTokenInteger(tokens[3], "y", y) &&
            getTokenInteger(tokens[4], "width", width) &&
            getTokenInteger(tokens[5], "height", height))
        {
            invalidateTiles(part, x, y, width, height);
            return;
        }
    }

    Log::error("Unexpected invalidatetiles request: " + tiles);
}

void TileCache::removeFile(const std::string& fileName)
{
    const std::string fullFileName = _cacheDir + "/" + fileName;

    if (std::remove(fullFileName.c_str()) == 0)
        Log::info("Removed file: " + fullFileName);
}

std::string TileCache::cacheFileName(const TileDesc& tile)
{
    std::ostringstream oss;
    oss << tile.getPart() << '_' << tile.getWidth() << 'x' << tile.getHeight() << '.'
        << tile.getTilePosX() << ',' << tile.getTilePosY() << '.'
        << tile.getTileWidth() << 'x' << tile.getTileHeight() << ".png";
    return oss.str();
}

bool TileCache::parseCacheFileName(const std::string& fileName, int& part, int& width, int& height, int& tilePosX, int& tilePosY, int& tileWidth, int& tileHeight) const
{
    return (std::sscanf(fileName.c_str(), "%d_%dx%d.%d,%d.%dx%d.png", &part, &width, &height, &tilePosX, &tilePosY, &tileWidth, &tileHeight) == 7);
}

bool TileCache::intersectsTile(const std::string& fileName, int part, int x, int y, int width, int height) const
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
    std::fstream modTimeFile(_cacheDir + "/modtime.txt", std::ios::in);

    if (!modTimeFile.is_open())
        return 0;

    Timestamp::TimeVal result;
    modTimeFile >> result;

    modTimeFile.close();
    return result;
}

void TileCache::saveLastModified(const Timestamp& timestamp)
{
    std::fstream modTimeFile(_cacheDir + "/modtime.txt", std::ios::out);
    modTimeFile << timestamp.raw() << std::endl;
    modTimeFile.close();
}

// FIXME: to be further simplified when we centralize tile messages.
void TileCache::subscribeToTileRendering(const TileDesc& tile, const std::shared_ptr<ClientSession> &subscriber)
{
    assert(subscriber->getKind() == LOOLSession::Kind::ToClient);

    std::ostringstream oss;
    oss << '(' << tile.getPart() << ',' << tile.getTilePosX() << ',' << tile.getTilePosY() << ')';
    const auto name = oss.str();

    std::unique_lock<std::mutex> lock(_tilesBeingRenderedMutex);

    std::shared_ptr<TileBeingRendered> tileBeingRendered = findTileBeingRendered(tile);

    if (tileBeingRendered)
    {
        for (const auto &s : tileBeingRendered->_subscribers)
        {
            if (s.lock().get() == subscriber.get())
            {
                Log::debug("Redundant request to subscribe on tile " + name);
                tileBeingRendered->setVersion(tile.getVersion());
                return;
            }
        }

        Log::debug() << "Subscribing to tile " << name << " which has "
                     << tileBeingRendered->_subscribers.size()
                     << " subscribers already. Adding one more." << Log::end;
        tileBeingRendered->_subscribers.push_back(subscriber);

        const auto duration = (std::chrono::steady_clock::now() - tileBeingRendered->getStartTime());
        if (std::chrono::duration_cast<std::chrono::milliseconds>(duration).count() > COMMAND_TIMEOUT_MS)
        {
            // Tile painting has stalled. Reissue.
            tileBeingRendered->setVersion(tile.getVersion());
        }
    }
    else
    {
        Log::debug() << "Subscribing to tile " << name << " which has no subscribers. Subscribing for ver: "
                     << tile.getVersion() << "." << Log::end;

        const std::string cachedName = cacheFileName(tile);

        assert(_tilesBeingRendered.find(cachedName) == _tilesBeingRendered.end());

        tileBeingRendered = std::make_shared<TileBeingRendered>(cachedName, tile);
        tileBeingRendered->_subscribers.push_back(subscriber);
        _tilesBeingRendered[cachedName] = tileBeingRendered;
    }
}

std::string TileCache::cancelTiles(const std::shared_ptr<ClientSession> &subscriber)
{
    assert(subscriber && "cancelTiles expects valid subscriber");
    Log::trace("Cancelling tiles for " + subscriber->getName());

    std::unique_lock<std::mutex> lock(_tilesBeingRenderedMutex);

    const auto sub = subscriber.get();

    std::ostringstream oss;

    for (auto it = _tilesBeingRendered.begin(); it != _tilesBeingRendered.end(); )
    {
        if (it->second->getTile().getId() >= 0)
        {
            // Tile is for a thumbnail, don't cancel it
            ++it;
            continue;
        }

        auto& subscribers = it->second->_subscribers;
        Log::trace("Tile " + it->first + " has " + std::to_string(subscribers.size()) + " subscribers.");

        const auto itRem = std::find_if(subscribers.begin(), subscribers.end(),
                                        [sub](std::weak_ptr<ClientSession>& ptr){ return ptr.lock().get() == sub; });
        if (itRem != subscribers.end())
        {
            Log::trace("Tile " + it->first + " has " + std::to_string(subscribers.size()) + " subscribers. Removing one.");
            subscribers.erase(itRem, itRem + 1);
            if (subscribers.empty())
            {
                // No other subscriber, remove it from the render queue.
                oss << it->second->getVersion() << ',';
                it = _tilesBeingRendered.erase(it);
                continue;
            }
        }

        ++it;
    }

    const auto canceltiles = oss.str();
    return (canceltiles.empty() ? canceltiles : "canceltiles " + canceltiles);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
