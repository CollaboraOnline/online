/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <iosfwd>
#include <memory>
#include <thread>
#include <string>
#include <unordered_map>

#include <Rectangle.hpp>

#include "TileDesc.hpp"

class ClientSession;

class TileCacheDesc : public TileDesc
{
public:
    TileCacheDesc(const TileDesc &copy)
        : TileDesc(copy)
    {
    }

    // The cache cares about only some properties.
    bool operator==(const TileCacheDesc& other) const
    {
        return _part == other._part &&
               _width == other._width &&
               _height == other._height &&
               _tilePosX == other._tilePosX &&
               _tilePosY == other._tilePosY &&
               _tileWidth == other._tileWidth &&
               _tileHeight == other._tileHeight &&
               _normalizedViewId == other._normalizedViewId;
    }
};

// The cache cares about only some properties.
struct TileCacheDescCompareEqual
{
    bool operator()(const TileCacheDesc &l, const TileCacheDesc &r) const { return l == r; }
};

// The cache cares about only some properties.
struct TileCacheDescHasher
{
    size_t
    operator()(const TileCacheDesc &t) const
    {
        size_t hash = t.getPart();

        hash = (hash << 5) + hash + t.getWidth();
        hash = (hash << 5) + hash + t.getHeight();
        hash = (hash << 5) + hash + t.getTilePosX();
        hash = (hash << 5) + hash + t.getTilePosY();
        hash = (hash << 5) + hash + t.getTileWidth();
        hash = (hash << 5) + hash + t.getTileHeight();
        hash = (hash << 5) + hash + t.getNormalizedViewId();

        return hash;
    }
};

/// Handles the caching of tiles of one document.
class TileCache
{
    struct TileBeingRendered;

    bool hasTileBeingRendered(const std::shared_ptr<TileCache::TileBeingRendered>& tileBeingRendered);
    std::shared_ptr<TileBeingRendered> findTileBeingRendered(const TileDesc& tile);

public:
    typedef std::shared_ptr<std::vector<char>> Tile;

    /// When the docURL is a non-file:// url, the timestamp has to be provided by the caller.
    /// For file:// url's, it's ignored.
    /// When it is missing for non-file:// url, it is assumed the document must be read, and no cached value used.
    TileCache(const std::string& docURL, const std::chrono::system_clock::time_point& modifiedTime, bool dontCache = false);
    ~TileCache();

    /// Completely clear the cache contents.
    void clear();

    TileCache(const TileCache&) = delete;
    TileCache& operator=(const TileCache&) = delete;

    /// Subscribes if no subscription exists and returns the version number.
    /// Otherwise returns 0 to signify a subscription exists.
    void subscribeToTileRendering(const TileDesc& tile, const std::shared_ptr<ClientSession>& subscriber);

    /// Create the TileBeingRendered object for the given tile indicating that the tile was sent to
    /// the kit for rendering. Note: subscribeToTileRendering calls this internally, so you don't need
    /// to call this method if you need also to subcribe for the rendered tile.
    void registerTileBeingRendered(const TileDesc& tile);

    /// Cancels all tile requests by the given subscriber.
    std::string cancelTiles(const std::shared_ptr<ClientSession>& subscriber);

    /// Find the tile with this description
    Tile lookupTile(const TileDesc& tile);

    void saveTileAndNotify(const TileDesc& tile, const char* data, const size_t size);

    enum StreamType {
        Font,
        Style,
        CmdValues,
        Last
    };

    /// Get the content of a cache file.
    /// @param content Valid only when the call returns true.
    /// @return true when the file actually exists
    bool getTextStream(StreamType type, const std::string& fileName, std::string& content);

    // Save some text into a file in the cache directory
    void saveTextStream(StreamType type, const std::string& text, const std::string& fileName);

    // Saves a font / style / etc rendering
    void saveStream(StreamType type, const std::string& name, const char* data, size_t size);

    /// Return the tile data if we have it, or nothing.
    Tile lookupCachedStream(StreamType type, const std::string& name);

    // The tiles parameter is an invalidatetiles: message as sent by the child process
    void invalidateTiles(const std::string& tiles, int normalizedViewId);

    /// Parse invalidateTiles message to a part number and a rectangle of the invalidated area
    static std::pair<int, Util::Rectangle> parseInvalidateMsg(const std::string& tiles);

    void forgetTileBeingRendered(const std::shared_ptr<TileCache::TileBeingRendered>& tileBeingRendered);
    double getTileBeingRenderedElapsedTimeMs(const TileDesc &tileDesc) const;

    size_t countTilesBeingRenderedForSession(const std::shared_ptr<ClientSession>& session);
    bool hasTileBeingRendered(const TileDesc& tileDesc);
    int  getTileBeingRenderedVersion(const TileDesc& tileDesc);

    /// Set the high watermark for tilecache size
    void setMaxCacheSize(size_t cacheSize);

    /// Get the current memory use.
    size_t getMemorySize() const { return _cacheSize; }

    // Debugging bits ...
    void dumpState(std::ostream& os);
    void setThreadOwner(const std::thread::id &id) { _owner = id; }
    void assertCorrectThread();
    void assertCacheSize();

private:
    void ensureCacheSize();
    static size_t itemCacheSize(const Tile &tile);

    void invalidateTiles(int part, int x, int y, int width, int height, int normalizedViewId);

    /// Lookup tile in our cache.
    TileCache::Tile findTile(const TileDesc &desc);

    /// Lookup tile in our stream cache.
    TileCache::Tile findStreamTile(StreamType type, const std::string &fileName);

    /// Removes the named stream from the cache
    void removeStream(StreamType type, const std::string& fileName);

    static std::string cacheFileName(const TileDesc& tileDesc);
    static bool parseCacheFileName(const std::string& fileName, int& part, int& width, int& height, int& tilePosX, int& tilePosY, int& tileWidth, int& tileHeight, int& nviewid);

    /// Extract location from fileName, and check if it intersects with [x, y, width, height].
    static bool intersectsTile(const TileDesc &tileDesc, int part, int x, int y, int width, int height, int normalizedViewId);

    void saveDataToCache(const TileDesc &desc, const char *data, const size_t size);
    void saveDataToStreamCache(StreamType type, const std::string &fileName, const char *data, const size_t size);

    const std::string _docURL;

    std::thread::id _owner;

    bool _dontCache;

    /// Approximate size of tilecache in bytes
    size_t _cacheSize;

    /// Maximum (high watermark) size of the tilecache in bytes
    size_t _maxCacheSize;

    // FIXME: should we have a tile-desc to WID map instead and a simpler lookup ?
    std::unordered_map<TileCacheDesc, Tile,
                       TileCacheDescHasher,
                       TileCacheDescCompareEqual> _cache;
    // FIXME: TileBeingRendered contains TileDesc too ...
    std::unordered_map<TileCacheDesc, std::shared_ptr<TileBeingRendered>,
                       TileCacheDescHasher,
                       TileCacheDescCompareEqual> _tilesBeingRendered;

    // old-style file-name to data grab-bag.
    std::map<std::string, Tile> _streamCache[(int)StreamType::Last];
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
