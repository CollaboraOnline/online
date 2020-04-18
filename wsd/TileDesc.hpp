/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <cassert>
#include <map>
#include <sstream>
#include <string>


#include "Exceptions.hpp"
#include <Protocol.hpp>

#define TILE_WIRE_ID
typedef uint32_t TileWireId;
typedef uint64_t TileBinaryHash;

/// Tile Descriptor
/// Represents a tile's coordinates and dimensions.
class TileDesc
{
public:
    TileDesc(int normalizedViewId, int part, int width, int height, int tilePosX, int tilePosY, int tileWidth,
             int tileHeight, int ver, int imgSize, int id, bool broadcast)
        : _normalizedViewId(normalizedViewId)
        , _part(part)
        , _width(width)
        , _height(height)
        , _tilePosX(tilePosX)
        , _tilePosY(tilePosY)
        , _tileWidth(tileWidth)
        , _tileHeight(tileHeight)
        , _ver(ver)
        , _imgSize(imgSize)
        , _id(id)
        , _broadcast(broadcast)
        , _oldWireId(0)
        , _wireId(0)
    {
        if (_normalizedViewId < 0 ||
            _part < 0 ||
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
    int getId() const { return _id; }
    bool getBroadcast() const { return _broadcast; }
    void setOldWireId(TileWireId id) { _oldWireId = id; }
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
               _broadcast == other._broadcast &&
               _normalizedViewId == other._normalizedViewId;
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
            other.getWidth() != getWidth() ||
            other.getHeight() != getHeight() ||
            other.getTileWidth() != getTileWidth() ||
            other.getTileHeight() != getTileHeight())
        {
            return false;
        }

        return intersects(other);
    }

    bool onSameRow(const TileDesc& other) const
    {
        if (other.getPart() != getPart() ||
            other.getWidth() != getWidth() ||
            other.getHeight() != getHeight() ||
            other.getTileWidth() != getTileWidth() ||
            other.getTileHeight() != getTileHeight() ||
            other.getNormalizedViewId() != getNormalizedViewId())
        {
            return false;
        }

        return other.getTilePosY() + other.getTileHeight() >= getTilePosY() &&
               other.getTilePosY() <= getTilePosY() + getTileHeight();
    }

    bool canCombine(const TileDesc& other) const
    {
        if (!onSameRow(other))
            return false;
        int gridX = getTilePosX() / getTileWidth();
        int gridXOther = other.getTilePosX() / other.getTileWidth();
        int delta = gridX - gridXOther;
        // a 4k screen - is sixteen 256 pixel wide tiles wide.
        if (delta < -16 || delta > 16)
            return false;
        else
            return true;
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

        if (_broadcast)
        {
            oss << " broadcast=yes";
        }

        oss << suffix;
        return oss.str();
    }

    /// Deserialize a TileDesc from a tokenized string.
    static TileDesc parse(const StringVector& tokens)
    {
        // We don't expect undocumented fields and
        // assume all values to be int.
        std::map<std::string, int> pairs;

        // Optional.
        pairs["ver"] = -1;
        pairs["imgsize"] = 0;
        pairs["id"] = -1;

        TileWireId oldWireId = 0;
        TileWireId wireId = 0;
        for (size_t i = 0; i < tokens.size(); ++i)
        {
            if (LOOLProtocol::getTokenUInt32(tokens[i], "oldwid", oldWireId))
                ;
            else if (LOOLProtocol::getTokenUInt32(tokens[i], "wid", wireId))
                ;
            else
            {
                std::string name;
                int value = -1;
                if (LOOLProtocol::parseNameIntegerPair(tokens[i], name, value))
                {
                    pairs[name] = value;
                }
            }
        }

        std::string s;
        const bool broadcast = (LOOLProtocol::getTokenString(tokens, "broadcast", s) &&
                                s == "yes");

        TileDesc result(pairs["nviewid"], pairs["part"], pairs["width"], pairs["height"],
                        pairs["tileposx"], pairs["tileposy"],
                        pairs["tilewidth"], pairs["tileheight"],
                        pairs["ver"],
                        pairs["imgsize"], pairs["id"], broadcast);
        result.setOldWireId(oldWireId);
        result.setWireId(wireId);

        return result;
    }

    /// Deserialize a TileDesc from a string format.
    static TileDesc parse(const std::string& message)
    {
        return parse(LOOLProtocol::tokenize(message.data(), message.size()));
    }

    std::string generateID() const
    {
        std::ostringstream tileID;
        tileID << getPart() << ":" << getTilePosX() << ":" << getTilePosY() << ":"
               << getTileWidth() << ":" << getTileHeight() << ":" << getNormalizedViewId();
        return tileID.str();
    }

protected:
    int _normalizedViewId;
    int _part;
    int _width;
    int _height;
    int _tilePosX;
    int _tilePosY;
    int _tileWidth;
    int _tileHeight;
    int _ver; //< Versioning support.
    int _imgSize; //< Used for responses.
    int _id;
    bool _broadcast;
    TileWireId _oldWireId;
    TileWireId _wireId;
};

/// One or more tile header.
/// Used to request the rendering of multiple
/// tiles as well as the header of the response.
class TileCombined
{
private:
    TileCombined(int normalizedViewId, int part, int width, int height,
                 const std::string& tilePositionsX, const std::string& tilePositionsY,
                 int tileWidth, int tileHeight, const std::string& vers,
                 const std::string& imgSizes,
                 const std::string& oldWireIds,
                 const std::string& wireIds) :
        _normalizedViewId(normalizedViewId),
        _part(part),
        _width(width),
        _height(height),
        _tileWidth(tileWidth),
        _tileHeight(tileHeight)
    {
        if (_part < 0 ||
            _width <= 0 ||
            _height <= 0 ||
            _tileWidth <= 0 ||
            _tileHeight <= 0)
        {
            throw BadArgumentException("Invalid tilecombine descriptor.");
        }

        StringVector positionXtokens(LOOLProtocol::tokenize(tilePositionsX, ','));
        StringVector positionYtokens(LOOLProtocol::tokenize(tilePositionsY, ','));
        StringVector imgSizeTokens(LOOLProtocol::tokenize(imgSizes, ','));
        StringVector verTokens(LOOLProtocol::tokenize(vers, ','));
        StringVector oldWireIdTokens(LOOLProtocol::tokenize(oldWireIds, ','));
        StringVector wireIdTokens(LOOLProtocol::tokenize(wireIds, ','));

        const size_t numberOfPositions = positionXtokens.size();

        // check that the comma-separated strings have the same number of elements
        if (numberOfPositions != positionYtokens.size() ||
            (!imgSizes.empty() && numberOfPositions != imgSizeTokens.size()) ||
            (!vers.empty() && numberOfPositions != verTokens.size()) ||
            (!oldWireIds.empty() && numberOfPositions != oldWireIdTokens.size()) ||
            (!wireIds.empty() && numberOfPositions != wireIdTokens.size()))
        {
            throw BadArgumentException("Invalid tilecombine descriptor. Unequal number of tiles in parameters.");
        }

        for (size_t i = 0; i < numberOfPositions; ++i)
        {
            int x = 0;
            if (!LOOLProtocol::stringToInteger(positionXtokens[i], x))
            {
                throw BadArgumentException("Invalid 'tileposx' in tilecombine descriptor.");
            }

            int y = 0;
            if (!LOOLProtocol::stringToInteger(positionYtokens[i], y))
            {
                throw BadArgumentException("Invalid 'tileposy' in tilecombine descriptor.");
            }

            int imgSize = 0;
            if (!imgSizeTokens.empty() && !LOOLProtocol::stringToInteger(imgSizeTokens[i], imgSize))
            {
                throw BadArgumentException("Invalid 'imgsize' in tilecombine descriptor.");
            }

            int ver = -1;
            if (!verTokens.empty() && !verTokens[i].empty() && !LOOLProtocol::stringToInteger(verTokens[i], ver))
            {
                throw BadArgumentException("Invalid 'ver' in tilecombine descriptor.");
            }

            TileWireId oldWireId = 0;
            if (!oldWireIdTokens.empty() && !LOOLProtocol::stringToUInt32(oldWireIdTokens[i], oldWireId))
            {
                throw BadArgumentException("Invalid tilecombine descriptor.");
            }

            TileWireId wireId = 0;
            if (!wireIdTokens.empty() && !LOOLProtocol::stringToUInt32(wireIdTokens[i], wireId))
            {
                throw BadArgumentException("Invalid tilecombine descriptor.");
            }

            _tiles.emplace_back(_normalizedViewId, _part, _width, _height, x, y, _tileWidth, _tileHeight, ver, imgSize, -1, false);
            _tiles.back().setOldWireId(oldWireId);
            _tiles.back().setWireId(wireId);
        }
    }

public:
    int getNormalizedViewId() const { return _normalizedViewId; }
    int getPart() const { return _part; }
    int getWidth() const { return _width; }
    int getHeight() const { return _height; }
    int getTileWidth() const { return _tileWidth; }
    int getTileHeight() const { return _tileHeight; }

    const std::vector<TileDesc>& getTiles() const { return _tiles; }
    std::vector<TileDesc>& getTiles() { return _tiles; }

    void setNormalizedViewId(int nViewId)
    {
        for (auto& tile : getTiles())
            tile.setNormalizedViewId(nViewId);

        _normalizedViewId = nViewId;
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

        oss << suffix;
        return oss.str();
    }

    /// Deserialize a TileDesc from a tokenized string.
    static TileCombined parse(const StringVector& tokens)
    {
        // We don't expect undocumented fields and
        // assume all values to be int.
        std::map<std::string, int> pairs;

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
            if (LOOLProtocol::parseNameValuePair(tokens.getParam(token), name, value))
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
                    if (LOOLProtocol::stringToInteger(value, v))
                    {
                        pairs[name] = v;
                    }
                }
            }
        }

        return TileCombined(pairs["nviewid"], pairs["part"], pairs["width"], pairs["height"],
                            tilePositionsX, tilePositionsY,
                            pairs["tilewidth"], pairs["tileheight"],
                            versions, imgSizes, oldwireIds, wireIds);
    }

    /// Deserialize a TileDesc from a string format.
    static TileCombined parse(const std::string& message)
    {
        return parse(LOOLProtocol::tokenize(message.data(), message.size()));
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
        return TileCombined(tiles[0].getNormalizedViewId(), tiles[0].getPart(), tiles[0].getWidth(), tiles[0].getHeight(),
                            xs.str(), ys.str(), tiles[0].getTileWidth(), tiles[0].getTileHeight(),
                            vers.str(), "", oldhs.str(), hs.str());
    }

    /// To support legacy / under-used renderTile
    TileCombined(const TileDesc &desc)
    {
        _part = desc.getPart();
        _width = desc.getWidth();
        _height = desc.getHeight();
        _tileWidth = desc.getTileWidth();
        _tileHeight = desc.getTileHeight();
        _normalizedViewId = desc.getNormalizedViewId();
        _tiles.push_back(desc);
    }

private:
    std::vector<TileDesc> _tiles;
    int _normalizedViewId;
    int _part;
    int _width;
    int _height;
    int _tileWidth;
    int _tileHeight;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
