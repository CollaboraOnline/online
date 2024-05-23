/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <Exceptions.hpp>
#include <Protocol.hpp>
#include <StringVector.hpp>

#include <cassert>
#include <unordered_map>
#include <sstream>
#include <string>
#include <string_view>

#define TILE_WIRE_ID
using TileWireId = uint32_t;

namespace TileParse
{
    template <typename A> struct Comp
    {
        bool operator()(const A& av, const std::string_view arg) { return av.first < arg; }
        bool operator()(const std::string_view arg, const A& av) { return arg < av.first; }
        bool operator()(const A& av, const A& bv) { return av.first < bv.first; }
    };

#ifndef NDEBUG
    template <class T, size_t N> bool checkSorted(T const (&args)[N], int maxEnum)
    {
        bool sorted = std::is_sorted(std::begin(args), std::end(args), Comp<T>{});
        for (int i = 0; i < maxEnum; ++i)
        {
            auto range = std::equal_range(std::begin(args), std::end(args), args[i], Comp<T>{});
            assert(range.first != range.second &&                      // is found
                   std::distance(range.first, range.second) == 1 &&    // one match
                   std::distance(std::begin(args), range.first) == i); // match is in correct index
        }
        return sorted;
    }
#endif

    template <class T, size_t N> bool setArg(T (&args)[N], const std::string_view arg, int value)
    {
        auto range = std::equal_range(std::begin(args), std::end(args), arg, Comp<T>{});
        if (range.first == range.second)
            return false;
        range.first->second = value;
        return true;
    }
}

/// Tile Descriptor
/// Represents a tile's coordinates and dimensions.
class TileDesc final
{
public:
    TileDesc(int normalizedViewId, int part, int mode, int width, int height, int tilePosX, int tilePosY, int tileWidth,
             int tileHeight, int ver, int imgSize, int id)
        : _normalizedViewId(normalizedViewId)
        , _part(part)
        , _mode(mode)
        , _width(width)
        , _height(height)
        , _tilePosX(tilePosX)
        , _tilePosY(tilePosY)
        , _tileWidth(tileWidth)
        , _tileHeight(tileHeight)
        , _ver(ver)
        , _imgSize(imgSize)
        , _id(id)
        , _oldWireId(0)
        , _wireId(0)
    {
        if (_normalizedViewId < 0 ||
            _part < 0 ||
            _mode < 0 ||
            _width <= 0 ||
            _height <= 0 ||
            _tilePosX < 0 ||
            _tilePosY < 0 ||
            _tileWidth <= 0 ||
            _tileHeight <= 0 ||
            _imgSize < 0)
        {
            throw BadArgumentException("Invalid tile descriptor.");
        }
    }

    int getNormalizedViewId() const { return _normalizedViewId; }
    void setNormalizedViewId(const int normalizedViewId) { _normalizedViewId = normalizedViewId; }
    int getPart() const { return _part; }
    int getEditMode() const { return _mode; }
    int getWidth() const { return _width; }
    int getHeight() const { return _height; }
    int getTilePosX() const { return _tilePosX; }
    int getTilePosY() const { return _tilePosY; }
    int getTileWidth() const { return _tileWidth; }
    int getTileHeight() const { return _tileHeight; }
    int getVersion() const { return _ver; }
    void setVersion(const int ver) { _ver = ver; }
    int getImgSize() const { return _imgSize; }
    void setImgSize(const int imgSize) { _imgSize = imgSize; }
    /// if non-zero: a preview.
    int getId() const { return _id; }
    void setId(TileWireId id) { _id = id; }
    void setOldWireId(TileWireId id) { _oldWireId = id; }
    void forceKeyframe() { setOldWireId(0); }
    TileWireId getOldWireId() const { return _oldWireId; }
    void setWireId(TileWireId id) { _wireId = id; }
    TileWireId getWireId() const { return _wireId; }

    bool operator==(const TileDesc& other) const
    {
        return _part == other._part &&
               _width == other._width &&
               _height == other._height &&
               _tilePosX == other._tilePosX &&
               _tilePosY == other._tilePosY &&
               _tileWidth == other._tileWidth &&
               _tileHeight == other._tileHeight &&
               _id == other._id &&
               _normalizedViewId == other._normalizedViewId &&
               _mode == other._mode;
    }

    // used to cache a hash of the key elements compared in ==
    uint32_t equalityHash() const
    {
        uint32_t a = _normalizedViewId << 17;
        uint32_t b = _tilePosX << 7;

        a ^= _part;
        b ^= _tilePosY;
        a ^= _mode << 30;
        b ^= _tileWidth << 20;
        a ^= _width << 19;

        return a ^ b;
    }

    static bool rectanglesIntersect(int x1, int y1, int w1, int h1, int x2, int y2, int w2, int h2)
    {
        return x1 + w1 >= x2 &&
               x1 <= x2 + w2 &&
               y1 + h1 >= y2 &&
               y1 <= y2 + h2;
    }

    bool intersectsWithRect(int x, int y, int w, int h) const
    {
        return rectanglesIntersect(getTilePosX(), getTilePosY(), getTileWidth(), getTileHeight(), x, y, w, h);
    }

    bool intersects(const TileDesc& other) const
    {
        return intersectsWithRect(other.getTilePosX(), other.getTilePosY(),
                                  other.getTileWidth(), other.getTileHeight());
    }

    bool isAdjacent(const TileDesc& other) const
    {
        if (other.getPart() != getPart() ||
            other.getEditMode() != getEditMode() ||
            other.getWidth() != getWidth() ||
            other.getHeight() != getHeight() ||
            other.getTileWidth() != getTileWidth() ||
            other.getTileHeight() != getTileHeight())
        {
            return false;
        }

        return intersects(other);
    }

    // return false if the TileDesc cannot appear in the same TileCombine
    // because their fields differ for the shared tilecombine case
    bool sameTileCombineParams(const TileDesc& other) const
    {
        if (other.getPart() != getPart() ||
            other.getEditMode() != getEditMode() ||
            other.getWidth() != getWidth() ||
            other.getHeight() != getHeight() ||
            other.getTileWidth() != getTileWidth() ||
            other.getTileHeight() != getTileHeight() ||
            other.getNormalizedViewId() != getNormalizedViewId())
        {
            return false;
        }
        return true;
    }

    bool onSameRow(const TileDesc& other) const
    {
        if (!sameTileCombineParams(other))
            return false;

        return other.getTilePosY() + other.getTileHeight() >= getTilePosY() &&
               other.getTilePosY() <= getTilePosY() + getTileHeight();
    }

    bool canCombine(const TileDesc& other) const
    {
        if (!onSameRow(other))
            return false;

        const int gridX = getTilePosX() / getTileWidth();
        const int gridXOther = other.getTilePosX() / other.getTileWidth();
        const int delta = gridX - gridXOther;
        // a 4k screen - is sixteen 256 pixel wide tiles wide.
        return (delta >= -16 && delta <= 16);
    }

    /// Serialize this instance into a string.
    /// Optionally prepend a prefix.
    std::string serialize(const std::string& prefix = std::string(),
                          const std::string& suffix = std::string()) const
    {
        std::ostringstream oss;
        oss << prefix
            << " nviewid=" << _normalizedViewId
            << " part=" << _part
            << " width=" << _width
            << " height=" << _height
            << " tileposx=" << _tilePosX
            << " tileposy=" << _tilePosY
            << " tilewidth=" << _tileWidth
            << " tileheight=" << _tileHeight
            << " oldwid=" << _oldWireId
            << " wid=" << _wireId;

        // Anything after ver is optional.
        oss << " ver=" << _ver;

        if (_id >= 0)
        {
            oss << " id=" << _id;
        }

        if (_imgSize > 0)
        {
            oss << " imgsize=" << _imgSize;
        }

        if (_mode)
        {
            oss << " mode=" << _mode;
        }

        oss << suffix;
        return oss.str();
    }

    /// short name for a tile for debugging.
    std::string debugName() const
    {
        std::ostringstream oss;
        oss << '(' << getNormalizedViewId() << ',' << getPart() << ',' << getEditMode() << ',' << getTilePosX() << ',' << getTilePosY() << ')';
        return oss.str();
    }

    /// Deserialize a TileDesc from a tokenized string.
    static TileDesc parse(const StringVector& tokens)
    {
        enum argenum { height, id, imgsize, mode, nviewid, part, tileheight, tileposx, tileposy, tilewidth, ver, width, maxEnum };

        struct TileDescParseResults
        {
            typedef std::pair<const std::string_view, int> arg_value;

            arg_value args[maxEnum] = {
                { STRINGIFY(height), 0 },
                { STRINGIFY(id), -1 },          // Optional
                { STRINGIFY(imgsize), 0 },      // Optional
                { STRINGIFY(mode), 0 },         // Optional
                { STRINGIFY(nviewid), 0 },
                { STRINGIFY(part), 0 },
                { STRINGIFY(tileheight), 0 },
                { STRINGIFY(tileposx), 0 },
                { STRINGIFY(tileposy), 0 },
                { STRINGIFY(tilewidth), 0 },
                { STRINGIFY(ver), -1 },         // Optional
                { STRINGIFY(width), 0 }
            };

#ifndef NDEBUG
            TileDescParseResults()
            {
                static bool isSorted = TileParse::checkSorted(args, maxEnum);
                assert(isSorted);
            }
#endif

            bool set(const std::string_view arg, int value)
            {
                return TileParse::setArg(args, arg, value);
            }

            int operator[](argenum arg) const
            {
                return args[arg].second;
            }
        };

        // We don't expect undocumented fields and
        // assume all values to be int.
        TileDescParseResults pairs;

        TileWireId oldWireId = 0;
        TileWireId wireId = 0;
        for (std::size_t i = 0; i < tokens.size(); ++i)
        {
            if (tokens.getUInt32(i, "oldwid", oldWireId))
                ;
            else if (tokens.getUInt32(i, "wid", wireId))
                ;
            else
            {
                std::string name;
                int value = -1;
                if (tokens.getNameIntegerPair(i, name, value))
                    pairs.set(name, value);
            }
        }

        TileDesc result(pairs[nviewid], pairs[part], pairs[mode],
                        pairs[width], pairs[height],
                        pairs[tileposx], pairs[tileposy],
                        pairs[tilewidth], pairs[tileheight],
                        pairs[ver],
                        pairs[imgsize], pairs[id]);
        result.setOldWireId(oldWireId);
        result.setWireId(wireId);

        return result;
    }

    /// Deserialize a TileDesc from a string format.
    static TileDesc parse(const std::string& message)
    {
        return parse(StringVector::tokenize(message.data(), message.size()));
    }

    std::string generateID() const
    {
        std::ostringstream tileID;
        tileID << getPart() << ':' << getEditMode() << ':' << getTilePosX() << ':' << getTilePosY()
                << ':' << getTileWidth() << ':' << getTileHeight() << ':' << getNormalizedViewId();
        return tileID.str();
    }

private:
    int _normalizedViewId;
    int _part;
    int _mode; //< Used in Impress for EditMode::(Page|MasterPage), 0 = default
    int _width;
    int _height;
    int _tilePosX;
    int _tilePosY;
    int _tileWidth;
    int _tileHeight;
    int _ver; //< Versioning support.
    int _imgSize; //< Used for responses.
    int _id;
    TileWireId _oldWireId;
    TileWireId _wireId;
};

/// One or more tile header.
/// Used to request the rendering of multiple
/// tiles as well as the header of the response.
class TileCombined final
{
private:
    TileCombined(int normalizedViewId, int part, int mode, int width, int height,
                 const std::string& tilePositionsX, const std::string& tilePositionsY,
                 int tileWidth, int tileHeight, const std::string& vers,
                 const std::string& imgSizes,
                 const std::string& oldWireIds,
                 const std::string& wireIds) :
        _normalizedViewId(normalizedViewId),
        _part(part),
        _mode(mode),
        _width(width),
        _height(height),
        _tileWidth(tileWidth),
        _tileHeight(tileHeight),
        _isCompiled(true)
    {
        if (_part < 0 ||
            _mode < 0 ||
            _width <= 0 ||
            _height <= 0 ||
            _tileWidth <= 0 ||
            _tileHeight <= 0)
        {
            throw BadArgumentException("Invalid tilecombine descriptor. Elements: " +
                    std::to_string(_part) + " " + std::to_string(_mode) + " " +
                    std::to_string(_width) + " " + std::to_string(_height) + " " +
                    std::to_string(_tileWidth) + " " + std::to_string(_tileHeight));
        }

        StringVector positionXtokens(StringVector::tokenize(tilePositionsX, ','));
        StringVector positionYtokens(StringVector::tokenize(tilePositionsY, ','));
        StringVector imgSizeTokens(StringVector::tokenize(imgSizes, ','));
        StringVector verTokens(StringVector::tokenize(vers, ','));
        StringVector oldWireIdTokens(StringVector::tokenize(oldWireIds, ','));
        StringVector wireIdTokens(StringVector::tokenize(wireIds, ','));

        const std::size_t numberOfPositions = positionXtokens.size();

        // check that the comma-separated strings have the same number of elements
        if (numberOfPositions != positionYtokens.size() ||
            (!imgSizes.empty() && numberOfPositions != imgSizeTokens.size()) ||
            (!vers.empty() && numberOfPositions != verTokens.size()) ||
            (!oldWireIds.empty() && numberOfPositions != oldWireIdTokens.size()) ||
            (!wireIds.empty() && numberOfPositions != wireIdTokens.size()))
        {
            throw BadArgumentException("Invalid tilecombine descriptor. Unequal number of tiles in parameters.");
        }

        for (std::size_t i = 0; i < numberOfPositions; ++i)
        {
            int x = 0;
            if (!COOLProtocol::stringToInteger(positionXtokens[i], x))
            {
                throw BadArgumentException("Invalid 'tileposx' in tilecombine descriptor.");
            }

            int y = 0;
            if (!COOLProtocol::stringToInteger(positionYtokens[i], y))
            {
                throw BadArgumentException("Invalid 'tileposy' in tilecombine descriptor.");
            }

            int imgSize = 0;
            if (!imgSizeTokens.empty() && !COOLProtocol::stringToInteger(imgSizeTokens[i], imgSize))
            {
                throw BadArgumentException("Invalid 'imgsize' in tilecombine descriptor.");
            }

            int ver = -1;
            if (!verTokens.empty() && !verTokens[i].empty() && !COOLProtocol::stringToInteger(verTokens[i], ver))
            {
                throw BadArgumentException("Invalid 'ver' in tilecombine descriptor.");
            }

            TileWireId oldWireId = 0;
            if (!oldWireIdTokens.empty() && !COOLProtocol::stringToUInt32(oldWireIdTokens[i], oldWireId))
            {
                throw BadArgumentException("Invalid tilecombine descriptor. oldWireIdToken: " + oldWireIdTokens[i]);
            }

            TileWireId wireId = 0;
            if (!wireIdTokens.empty() && !COOLProtocol::stringToUInt32(wireIdTokens[i], wireId))
            {
                throw BadArgumentException("Invalid tilecombine descriptor. wireIdToken: " + wireIdTokens[i]);
            }

            _tiles.emplace_back(_normalizedViewId, _part, _mode, _width, _height, x, y, _tileWidth, _tileHeight, ver, imgSize, -1);
            _tiles.back().setOldWireId(oldWireId);
            _tiles.back().setWireId(wireId);
        }
    }

public:
    int getNormalizedViewId() const { return _normalizedViewId; }
    int getPart() const { return _part; }
    int getEditMode() const { return _mode; }
    int getWidth() const { return _width; }
    int getHeight() const { return _height; }
    int getTileWidth() const { return _tileWidth; }
    int getTileHeight() const { return _tileHeight; }
    bool getCombined() const { return _isCompiled; }

    const std::vector<TileDesc>& getTiles() const { return _tiles; }
    std::vector<TileDesc>& getTiles() { return _tiles; }

    void setNormalizedViewId(int nViewId)
    {
        for (auto& tile : getTiles())
            tile.setNormalizedViewId(nViewId);

        _normalizedViewId = nViewId;
    }

    bool hasDuplicates() const
    {
        if (_tiles.size() < 2)
            return false;
        for (size_t i = 0; i < _tiles.size() - 1; ++i)
        {
            const auto &a = _tiles[i];
            assert(a.getPart() == _part);
            assert(a.getEditMode() == _mode);
            assert(a.getWidth() == _width);
            assert(a.getHeight() == _height);
            assert(a.getTileWidth() == _tileWidth);
            assert(a.getTileHeight() == _tileHeight);
            for (size_t j = i + 1; j < _tiles.size(); ++j)
            {
                const auto &b = _tiles[j];
                if (a.getTilePosX() == b.getTilePosX() &&
                    a.getTilePosY() == b.getTilePosY())
                    return true;
            }
        }
        return false;
    }

    /// Serialize this instance into a string.
    /// Optionally prepend a prefix.
    std::string serialize(const std::string& prefix = std::string(),
                          const std::string& suffix = std::string()) const
    {
        return serialize(prefix, suffix, _tiles);
    }

    std::string serialize(const std::string& prefix, const std::string &suffix,
                          const std::vector<TileDesc> &tiles) const
    {
        std::ostringstream oss;
        oss << prefix
            << " nviewid=" << _normalizedViewId
            << " part=" << _part
            << " width=" << _width
            << " height=" << _height
            << " tileposx=";
        for (const auto& tile : tiles)
        {
            oss << tile.getTilePosX() << ',';
        }
        oss.seekp(-1, std::ios_base::cur); // Seek back over last comma, overwritten below.

        oss << " tileposy=";
        for (const auto& tile : tiles)
        {
            oss << tile.getTilePosY() << ',';
        }
        oss.seekp(-1, std::ios_base::cur); // Ditto.

        oss << " imgsize=";
        for (const auto& tile : tiles)
        {
            oss << tile.getImgSize() << ','; // Ditto.
        }
        oss.seekp(-1, std::ios_base::cur);

        oss << " tilewidth=" << _tileWidth
            << " tileheight=" << _tileHeight;

        oss << " ver=";
        for (const auto& tile : tiles)
        {
            oss << tile.getVersion() << ',';
        }
        oss.seekp(-1, std::ios_base::cur); // Ditto.

        oss << " oldwid=";
        for (const auto& tile : tiles)
        {
            oss << tile.getOldWireId() << ',';
        }
        oss.seekp(-1, std::ios_base::cur); // Ditto

        oss << " wid=";

        bool comma = false;
        for (const auto& tile : tiles)
        {
            if (comma)
                oss << ',';

            oss << tile.getWireId();
            comma = true;
        }

        if (_mode)
            oss << " mode=" << _mode;

        oss << suffix;
        return oss.str();
    }

    /// Deserialize a TileDesc from a tokenized string.
    static TileCombined parse(const StringVector& tokens)
    {
        enum argenum { height, mode, nviewid, part, tileheight, tilewidth, width, maxEnum };

        struct TileCombinedParseResults
        {
            typedef std::pair<const std::string_view, int> arg_value;

            arg_value args[maxEnum] = {
                { STRINGIFY(height), 0 },
                { STRINGIFY(mode), 0 },
                { STRINGIFY(nviewid), 0 },
                { STRINGIFY(part), 0 },
                { STRINGIFY(tileheight), 0 },
                { STRINGIFY(tilewidth), 0 },
                { STRINGIFY(width), 0 }
            };

#ifndef NDEBUG
            TileCombinedParseResults()
            {
                static bool isSorted = TileParse::checkSorted(args, maxEnum);
                assert(isSorted);
            }
#endif

            bool set(const std::string_view arg, int value)
            {
                return TileParse::setArg(args, arg, value);
            }

            int operator[](argenum arg) const
            {
                return args[arg].second;
            }
        };

        // We don't expect undocumented fields and
        // assume all values to be int.
        TileCombinedParseResults pairs;

        std::string tilePositionsX;
        std::string tilePositionsY;
        std::string imgSizes;
        std::string versions;
        std::string oldwireIds;
        std::string wireIds;

        for (const auto& token : tokens)
        {
            std::string name;
            std::string value;
            if (COOLProtocol::parseNameValuePair(tokens.getParam(token), name, value))
            {
                if (name == "tileposx")
                {
                    tilePositionsX = value;
                }
                else if (name == "tileposy")
                {
                    tilePositionsY = value;
                }
                else if (name == "imgsize")
                {
                    imgSizes = value;
                }
                else if (name == "ver")
                {
                    versions = value;
                }
                else if (name == "oldwid")
                {
                    oldwireIds = value;
                }
                else if (name == "wid")
                {
                    wireIds = value;
                }
                else
                {
                    int v = 0;
                    if (COOLProtocol::stringToInteger(value, v))
                    {
                        pairs.set(name, v);
                    }
                }
            }
        }

        return TileCombined(pairs[nviewid], pairs[part], pairs[mode],
                            pairs[width], pairs[height],
                            tilePositionsX, tilePositionsY,
                            pairs[tilewidth], pairs[tileheight],
                            versions, imgSizes, oldwireIds, wireIds);
    }

    /// Deserialize a TileDesc from a string format.
    static TileCombined parse(const std::string& message)
    {
        return parse(StringVector::tokenize(message.data(), message.size()));
    }

    static TileCombined create(const std::vector<TileDesc>& tiles)
    {
        assert(!tiles.empty());

        std::ostringstream xs;
        std::ostringstream ys;
        std::ostringstream vers;
        std::ostringstream oldhs;
        std::ostringstream hs;

        for (const auto& tile : tiles)
        {
            xs << tile.getTilePosX() << ',';
            ys << tile.getTilePosY() << ',';
            vers << tile.getVersion() << ',';
            oldhs << tile.getOldWireId() << ',';
            hs << tile.getWireId() << ',';
        }

        vers.seekp(-1, std::ios_base::cur); // Remove last comma.
        return TileCombined(tiles[0].getNormalizedViewId(), tiles[0].getPart(), tiles[0].getEditMode(),
                            tiles[0].getWidth(), tiles[0].getHeight(),
                            xs.str(), ys.str(), tiles[0].getTileWidth(), tiles[0].getTileHeight(),
                            vers.str(), "", oldhs.str(), hs.str());
    }

    /// To support legacy / under-used renderTile
    explicit TileCombined(const TileDesc &desc)
    {
        _part = desc.getPart();
        _mode = desc.getEditMode();
        _width = desc.getWidth();
        _height = desc.getHeight();
        _tileWidth = desc.getTileWidth();
        _tileHeight = desc.getTileHeight();
        _normalizedViewId = desc.getNormalizedViewId();
        _tiles.push_back(desc);
        _isCompiled = false;
    }

private:
    std::vector<TileDesc> _tiles;
    int _normalizedViewId;
    int _part;
    int _mode;
    int _width;
    int _height;
    int _tileWidth;
    int _tileHeight;
    bool _isCompiled;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
