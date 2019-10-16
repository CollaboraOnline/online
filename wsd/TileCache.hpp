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

#include <iosfwd>
#include <map>
#include <memory>
#include <thread>
#include <string>

#include <Poco/Timestamp.h>
#include <Rectangle.hpp>

#include "TileDesc.hpp"

class ClientSession;

/// Handles the caching of tiles of one document.
class TileCache
{
    struct TileBeingRendered;

    std::shared_ptr<TileBeingRendered> findTileBeingRendered(const TileDesc& tile);

public:
    /// When the docURL is a non-file:// url, the timestamp has to be provided by the caller.
    /// For file:// url's, it's ignored.
    /// When it is missing for non-file:// url, it is assumed the document must be read, and no cached value used.
    TileCache(const std::string& docURL, const Poco::Timestamp& modifiedTime, const std::string& cacheDir, bool tileCachePersistent);
    ~TileCache();

    /// Remove the entire cache directory.
    void completeCleanup() const;

    TileCache(const TileCache&) = delete;

    /// Subscribes if no subscription exists and returns the version number.
    /// Otherwise returns 0 to signify a subscription exists.
    void subscribeToTileRendering(const TileDesc& tile, const std::shared_ptr<ClientSession>& subscriber);

    /// Create the TileBeingRendered object for the given tile indicating that the tile was sent to
    /// the kit for rendering. Note: subscribeToTileRendering calls this internally, so you don't need
    /// to call this method if you need also to subcribe for the rendered tile.
    void registerTileBeingRendered(const TileDesc& tile);

    /// Cancels all tile requests by the given subscriber.
    std::string cancelTiles(const std::shared_ptr<ClientSession>& subscriber);

    std::unique_ptr<std::fstream> lookupTile(const TileDesc& tile);

    void saveTileAndNotify(const TileDesc& tile, const char* data, const size_t size);

    /// Get the content of a cache file.
    /// @param content Valid only when the call returns true.
    /// @return true when the file actually exists
    bool getTextFile(const std::string& fileName, std::string& content);

    // Save some text into a file in the cache directory
    void saveTextFile(const std::string& text, const std::string& fileName);

    // Set the unsaved-changes state, used for sanity checks, ideally not needed
    void setUnsavedChanges(bool state);

    // Saves a font / style / etc rendering
    // The dir parameter should be the type of rendering, like "font", "style", etc
    void saveRendering(const std::string& name, const std::string& dir, const char* data, size_t size);

    std::unique_ptr<std::fstream> lookupCachedFile(const std::string& name, const std::string& dir);

    // The tiles parameter is an invalidatetiles: message as sent by the child process
    void invalidateTiles(const std::string& tiles, int normalizedViewId);

    /// Parse invalidateTiles message to a part number and a rectangle of the invalidated area
    static std::pair<int, Util::Rectangle> parseInvalidateMsg(const std::string& tiles);

    /// Store the timestamp to modtime.txt.
    void saveLastModified(const Poco::Timestamp& timestamp);

    void forgetTileBeingRendered(const std::shared_ptr<TileCache::TileBeingRendered>& tileBeingRendered, const TileDesc& tile);
    double getTileBeingRenderedElapsedTimeMs(const std::string& tileCacheName) const;

    bool hasTileBeingRendered(const TileDesc& tile);
    int getTileBeingRenderedVersion(const TileDesc& tile);

    void setThreadOwner(const std::thread::id &id) { _owner = id; }
    void assertCorrectThread();



private:
    void invalidateTiles(int part, int x, int y, int width, int height, int normalizedViewId);

    // Removes the given file from the cache
    void removeFile(const std::string& fileName);

    static std::string cacheFileName(const TileDesc& tile);
    static bool parseCacheFileName(const std::string& fileName, int& part, int& width, int& height, int& tilePosX, int& tilePosY, int& tileWidth, int& tileHeight, int& nViewid);

    /// Extract location from fileName, and check if it intersects with [x, y, width, height].
    static bool intersectsTile(const std::string& fileName, int part, int x, int y, int width, int height, int nViewId);

    /// Load the timestamp from modtime.txt.
    Poco::Timestamp getLastModified();

    const std::string _docURL;

    const std::string _cacheDir;

    const bool _tileCachePersistent;

    std::thread::id _owner;

    std::map<std::string, std::shared_ptr<TileBeingRendered> > _tilesBeingRendered;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
