/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <iosfwd>
#include <memory>
#include <string>
#include <thread>
#include <unordered_map>
#include <unordered_set>

#include <Rectangle.hpp>

#include "Log.hpp"
#include "Common.hpp"
#include "TileDesc.hpp"

class ClientSession;

// The cache cares about only some properties.
struct TileDescCacheCompareEq final
{
    inline bool operator()(const TileDesc& l, const TileDesc& r) const
    {
        return l.getPart() == r.getPart() &&
               l.getWidth() == r.getWidth() &&
               l.getHeight() == r.getHeight() &&
               l.getTilePosX() == r.getTilePosX() &&
               l.getTilePosY() == r.getTilePosY() &&
               l.getTileWidth() == r.getTileWidth() &&
               l.getTileHeight() == r.getTileHeight() &&
               l.getNormalizedViewId() == r.getNormalizedViewId();
    }
};

// The cache cares about only some properties.
struct TileDescCacheHasher final
{
    inline size_t operator()(const TileDesc& t) const
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

struct TileData
{
    TileData(TileWireId start, const char *data, const size_t size)
    {
        appendBlob(start, data, size);
    }

    // Add a frame or delta and - return the size change
    ssize_t appendBlob(TileWireId id, const char *data, const size_t dataSize)
    {
        size_t oldSize = 0;

        oldSize = size();

        assert (dataSize >= 1); // kit provides us a 'Z' or a 'D' or a png
        if (isKeyframe(data, dataSize))
        {
            LOG_TRC("received key-frame - clearing tile");
            _wids.clear();
            _deltas.clear();
        }
        else
            LOG_TRC("received delta of size " << dataSize << " - appending to existing " << _wids.size());

        // too many/large deltas means we should reset -
        // but not here - when requesting the tiles.
        _wids.push_back(id);
        _deltas.push_back(std::make_shared<BlobData>(dataSize - 1));
        std::memcpy(_deltas.back()->data(), data + 1, dataSize - 1);

        // FIXME: possible race - should store a seq. from the invalidation(s) ?
        _valid = true;

        // FIXME: speed up sizing.
        return size() - oldSize;
    }

    bool isPng() const { return (_deltas.size() == 1 &&
                                 _deltas[0]->size() > 1 &&
                                 (*_deltas[0])[0] == (char)0x89); }

    static bool isKeyframe(const char *data, size_t dataSize)
    {
        // keyframe or png
        return dataSize > 0 && (data[0] == 'Z' || data[0] == (char)0x89);
    }

    bool isValid() const { return _valid; }
    void invalidate() { _valid = false; }

    bool _valid; // not true - waiting for a new tile if in view.
    std::vector<TileWireId> _wids;
    std::vector<Blob> _deltas; // first item is a key-frame

    size_t size()
    {
        size_t size = 0;
        for (auto &b : _deltas)
            size += b->size() + sizeof(BlobData);
        return size + sizeof(TileData);
    }

    Blob &keyframe()
    {
        assert(_deltas.size() > 0);
        return _deltas[0];
    }

    /// if we send changes since this seq - do we need to first send the keyframe ?
    bool needsKeyframe(TileWireId since)
    {
        return since < _wids[0];
    }

    bool appendChangesSince(std::vector<char> &output, TileWireId since)
    {
        size_t i;
        for (i = 0; since != 0 && i < _wids.size() && _wids[i] <= since; ++i);

        if (i >= _wids.size())
        {
            LOG_WRN("odd outcome - requested for a later id with no tile: " << since);
            return false;
        }
        else
        {
            size_t start = i, extra = 0;
            if (start != _deltas.size() - 1)
                LOG_TRC("appending from " << start << " to " << (_deltas.size() - 1) <<
                        " from wid: " << _wids[start] << " to wid: " << since);
            for (i = start; i < _deltas.size(); ++i)
                extra += _deltas[i]->size();

            size_t offset = output.size();
            output.resize(output.size() + extra);

            // FIXME: better writev style interface in the end ?
//            LOG_TRC("added " << extra << " to array size " << offset);
            for (i = start; i < _deltas.size(); ++i)
            {
                size_t toCopy = _deltas[i]->size();
/*                LOG_TRC("copy item " << i << "/" << _deltas.size() << " of " << toCopy <<
                        " bytes to array offset " << offset << ":\n"
                        << Util::dumpHex(std::string((char *)_deltas[i]->data(), toCopy))); */

                std::memcpy(output.data() + offset, _deltas[i]->data(), toCopy);
                offset += toCopy;
            }
        }
        return true;
    }

    void dumpState(std::ostream& os)
    {
        if (_wids.size() < 2)
            os << "keyframe";
        else {
            os << "deltas: ";
            for (size_t i = 0; i < _wids.size(); ++i)
            {
                os << i << ": " << _wids[i] << " -> " << _deltas[i]->size() << " ";
            }
        }
    }
};
using Tile = std::shared_ptr<TileData>;

/// Handles the caching of tiles of one document.
class TileCache
{
    struct TileBeingRendered;

    std::shared_ptr<TileBeingRendered> findTileBeingRendered(const TileDesc& tile);

public:
    /// When the docURL is a non-file:// url, the timestamp has to be provided by the caller.
    /// For file:// url's, it's ignored.
    /// When it is missing for non-file:// url, it is assumed the document must be read, and no cached value used.
    TileCache(std::string docURL, const std::chrono::system_clock::time_point& modifiedTime,
              bool dontCache = false);
    ~TileCache();

    /// Completely clear the cache contents.
    void clear();

    TileCache(const TileCache&) = delete;
    TileCache& operator=(const TileCache&) = delete;

    /// Subscribes if no subscription exists and returns the version number.
    /// Otherwise returns 0 to signify a subscription exists.
    void subscribeToTileRendering(const TileDesc& tile, const std::shared_ptr<ClientSession>& subscriber,
                                  const std::chrono::steady_clock::time_point& now);

    /// Create the TileBeingRendered object for the given tile indicating that the tile was sent to
    /// the kit for rendering. Note: subscribeToTileRendering calls this internally, so you don't need
    /// to call this method if you need also to subscribe for the rendered tile.
    void registerTileBeingRendered(const TileDesc& tile);

    /// Cancels all tile requests by the given subscriber.
    std::string cancelTiles(const std::shared_ptr<ClientSession>& subscriber);

    /// Find the tile with this description
    Tile lookupTile(const TileDesc& tile);

    void saveTileAndNotify(const TileDesc& tile, const char* data, size_t size);

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

    /// Return the data if we have it, or nothing.
    Blob lookupCachedStream(StreamType type, const std::string& name);

    // The tiles parameter is an invalidatetiles: message as sent by the child process
    void invalidateTiles(const std::string& tiles, int normalizedViewId);

    /// Parse invalidateTiles message to a part number and a rectangle of the invalidated area
    static std::pair<int, Util::Rectangle> parseInvalidateMsg(const std::string& tiles);

    void forgetTileBeingRendered(const std::shared_ptr<TileCache::TileBeingRendered>& tileBeingRendered);

    size_t countTilesBeingRenderedForSession(const std::shared_ptr<ClientSession>& session,
                                             const std::chrono::steady_clock::time_point& now);
    bool hasTileBeingRendered(const TileDesc& tileDesc, const std::chrono::steady_clock::time_point *now = nullptr) const;

    int getTileBeingRenderedVersion(const TileDesc& tileDesc);

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
    Tile findTile(const TileDesc &desc);

    static std::string cacheFileName(const TileDesc& tileDesc);
    static bool parseCacheFileName(const std::string& fileName, int& part, int& width, int& height, int& tilePosX, int& tilePosY, int& tileWidth, int& tileHeight, int& nviewid);

    /// Extract location from fileName, and check if it intersects with [x, y, width, height].
    static bool intersectsTile(const TileDesc &tileDesc, int part, int x, int y, int width, int height, int normalizedViewId);

    Tile saveDataToCache(const TileDesc& desc, const char* data, size_t size);
    void saveDataToStreamCache(StreamType type, const std::string& fileName, const char* data,
                               size_t size);

    const std::string _docURL;

    std::thread::id _owner;

    const bool _dontCache;

    /// Approximate size of tilecache in bytes
    size_t _cacheSize;

    /// Maximum (high watermark) size of the tilecache in bytes
    size_t _maxCacheSize;

    // FIXME: should we have a tile-desc to WID map instead and a simpler lookup ?
    std::unordered_map<TileDesc, Tile,
                       TileDescCacheHasher,
                       TileDescCacheCompareEq> _cache;
    // FIXME: TileBeingRendered contains TileDesc too ...
    std::unordered_map<TileDesc, std::shared_ptr<TileBeingRendered>,
                       TileDescCacheHasher,
                       TileDescCacheCompareEq> _tilesBeingRendered;

    // old-style file-name to data grab-bag.
    std::map<std::string, Blob> _streamCache[static_cast<int>(StreamType::Last)];
};

/// Tracks view-port area tiles to track which we last
/// sent to avoid re-sending an existing delta causing grief
class ClientDeltaTracker final {
public:
    // FIXME: could be a simple 2d TileWireId array for better packing.
    std::unordered_set<TileDesc,
                       TileDescCacheHasher,
                       TileDescCacheCompareEq> _cache;
    ClientDeltaTracker() {
    }

    // FIXME: only need to store this for the current viewports
    void updateViewPort( /* ... */ )
    {
        // copy the set to another while filtering I guess.
    }

    /// return wire-id of last tile sent - or 0 if not present
    /// update last-tile sent wire-id to curSeq if found.
    TileWireId updateTileSeq(const TileDesc &desc)
    {
        auto it = _cache.find(desc);
        if (it == _cache.end())
        {
            _cache.insert(desc);
            return 0;
        }
        const TileWireId curSeq = desc.getWireId();
        TileWireId last = it->getWireId();
        // id is not included in the hash.
        auto pDesc = const_cast<TileDesc *>(&(*it));
        pDesc->setWireId(curSeq);
        return last;
    }

    void resetTileSeq(const TileDesc &desc)
    {
        auto it = _cache.find(desc);
        if (it == _cache.end())
            return;
        // id is not included in the hash.
        auto pDesc = const_cast<TileDesc *>(&(*it));
        pDesc->setWireId(0);
    }
};

inline std::ostream& operator<< (std::ostream& os, const Tile& tile)
{
    if (!tile)
        os << "nullptr";
    else
        os << "keyframe id " << tile->_wids[0] <<
            " size: " << tile->_deltas[0]->size() <<
            " deltas: " << (tile->_wids.size() - 1);
    return os;
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
