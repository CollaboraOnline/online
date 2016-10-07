/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#ifndef INCLUDED_TILEDESC_HPP
#define INCLUDED_TILEDESC_HPP

#include <cassert>
#include <map>
#include <sstream>
#include <string>

#include <Poco/StringTokenizer.h>

#include "Exceptions.hpp"
#include "LOOLProtocol.hpp"

/// Tile Descriptor
/// Represents a tile's coordinates and dimensions.
class TileDesc
{
public:
    TileDesc(int part, int width, int height, int tilePosX, int tilePosY, int tileWidth, int tileHeight, int ver, int imgSize, int id, bool broadcast) :
        _part(part),
        _width(width),
        _height(height),
        _tilePosX(tilePosX),
        _tilePosY(tilePosY),
        _tileWidth(tileWidth),
        _tileHeight(tileHeight),
        _ver(ver),
        _imgSize(imgSize),
        _id(id),
        _broadcast(broadcast)
    {
        if (_part < 0 ||
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

    bool intersectsWithRect(int x, int y, int w, int h) const
    {
        return x + w >= getTilePosX() &&
               x <= getTilePosX() + getTileWidth() &&
               y + h >= getTilePosY() &&
               y <= getTilePosY() + getTileHeight();
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
            other.getTileHeight() != getTileHeight())
        {
            return false;
        }

        return other.getTilePosY() + other.getTileHeight() >= getTilePosY() &&
               other.getTilePosY() <= getTilePosY() + getTileHeight();
    }

    /// Serialize this instance into a string.
    /// Optionally prepend a prefix.
    std::string serialize(const std::string& prefix = "") const
    {
        std::ostringstream oss;
        oss << prefix
            << " part=" << _part
            << " width=" << _width
            << " height=" << _height
            << " tileposx=" << _tilePosX
            << " tileposy=" << _tilePosY
            << " tilewidth=" << _tileWidth
            << " tileheight=" << _tileHeight
            << " ver=" << _ver;

        if (_imgSize > 0)
        {
            oss << " imgsize=" << _imgSize;
        }

        if (_id >= 0)
        {
            oss << " id=" << _id;
        }

        if (_broadcast)
        {
            oss << " broadcast=yes";
        }

        return oss.str();
    }

    /// Deserialize a TileDesc from a tokenized string.
    static TileDesc parse(const Poco::StringTokenizer& tokens)
    {
        // We don't expect undocumented fields and
        // assume all values to be int.
        std::map<std::string, int> pairs;

        // Optional.
        pairs["ver"] = -1;
        pairs["imgsize"] = 0;
        pairs["id"] = -1;

        for (size_t i = 0; i < tokens.count(); ++i)
        {
            std::string name;
            int value = -1;
            if (LOOLProtocol::parseNameIntegerPair(tokens[i], name, value))
            {
                pairs[name] = value;
            }
        }
        std::string s;
        bool broadcast = (LOOLProtocol::getTokenString(tokens, "broadcast", s) && s == "yes");

        return TileDesc(pairs["part"], pairs["width"], pairs["height"],
                        pairs["tileposx"], pairs["tileposy"],
                        pairs["tilewidth"], pairs["tileheight"],
                        pairs["ver"],
                        pairs["imgsize"], pairs["id"], broadcast);
    }

    /// Deserialize a TileDesc from a string format.
    static TileDesc parse(const std::string& message)
    {
        Poco::StringTokenizer tokens(message, " ",
                                     Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        return parse(tokens);
    }

private:
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
};

/// One or more tile header.
/// Used to request the rendering of multiple
/// tiles as well as the header of the response.
class TileCombined
{
private:
    TileCombined(int part, int width, int height,
                 const std::string& tilePositionsX, const std::string& tilePositionsY,
                 int tileWidth, int tileHeight, int ver = -1,
                 const std::string& imgSizes = "", int id = -1) :
        _part(part),
        _width(width),
        _height(height),
        _tileWidth(tileWidth),
        _tileHeight(tileHeight),
        _ver(ver),
        _id(id)
    {
        if (_part < 0 ||
            _width <= 0 ||
            _height <= 0 ||
            _tileWidth <= 0 ||
            _tileHeight <= 0)
        {
            throw BadArgumentException("Invalid tilecombine descriptor.");
        }

        Poco::StringTokenizer positionXtokens(tilePositionsX, ",", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        Poco::StringTokenizer positionYtokens(tilePositionsY, ",", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        Poco::StringTokenizer sizeTokens(imgSizes, ",", Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);

        const auto numberOfPositions = positionYtokens.count();

        // check that number of positions for X and Y is the same
        if (numberOfPositions != positionXtokens.count() || (!imgSizes.empty() && numberOfPositions != sizeTokens.count()))
        {
            throw BadArgumentException("Invalid tilecombine descriptor. Uneven number of tiles.");
        }

        for (size_t i = 0; i < numberOfPositions; ++i)
        {
            int x = 0;
            if (!LOOLProtocol::stringToInteger(positionXtokens[i], x))
            {
                throw BadArgumentException("Invalid tilecombine descriptor.");
            }

            int y = 0;
            if (!LOOLProtocol::stringToInteger(positionYtokens[i], y))
            {
                throw BadArgumentException("Invalid tilecombine descriptor.");
            }

            int size = 0;
            if (sizeTokens.count() && !LOOLProtocol::stringToInteger(sizeTokens[i], size))
            {
                throw BadArgumentException("Invalid tilecombine descriptor.");
            }

            _tiles.emplace_back(_part, _width, _height, x, y, _tileWidth, _tileHeight, ver, size, id, false);
        }
    }

public:
    int getPart() const { return _part; }
    int getWidth() const { return _width; }
    int getHeight() const { return _height; }
    int getTileWidth() const { return _tileWidth; }
    int getTileHeight() const { return _tileHeight; }
    int getVersion() const { return _ver; }
    void setVersion(const int ver) { _ver = ver; }

    const std::vector<TileDesc>& getTiles() const { return _tiles; }
    std::vector<TileDesc>& getTiles() { return _tiles; }

    /// Serialize this instance into a string.
    /// Optionally prepend a prefix.
    std::string serialize(const std::string& prefix = "") const
    {
        std::ostringstream oss;
        oss << prefix
            << " part=" << _part
            << " width=" << _width
            << " height=" << _height
            << " tileposx=";
        for (const auto& tile : _tiles)
        {
            oss << tile.getTilePosX() << ',';
        }

        oss.seekp(-1, std::ios_base::cur); // Remove last comma.

        oss << " tileposy=";
        for (const auto& tile : _tiles)
        {
            oss << tile.getTilePosY() << ',';
        }

        oss.seekp(-1, std::ios_base::cur); // Remove last comma.

        oss << " imgsize=";
        for (const auto& tile : _tiles)
        {
            oss << tile.getImgSize() << ',';
        }

        oss.seekp(-1, std::ios_base::cur); // Remove last comma.

        oss << " tilewidth=" << _tileWidth
            << " tileheight=" << _tileHeight;
        if (_ver >= 0)
        {
            oss << " ver=" << _ver;
        }

        if (_id >= 0)
        {
            oss << " id=" << _id;
        }

        return oss.str();
    }

    /// Deserialize a TileDesc from a tokenized string.
    static TileCombined parse(const Poco::StringTokenizer& tokens)
    {
        // We don't expect undocumented fields and
        // assume all values to be int.
        std::map<std::string, int> pairs;

        // Optional.
        pairs["ver"] = -1;
        pairs["id"] = -1;

        std::string tilePositionsX;
        std::string tilePositionsY;
        std::string imgSizes;
        for (size_t i = 0; i < tokens.count(); ++i)
        {
            std::string name;
            std::string value;
            if (LOOLProtocol::parseNameValuePair(tokens[i], name, value))
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

        return TileCombined(pairs["part"], pairs["width"], pairs["height"],
                            tilePositionsX, tilePositionsY,
                            pairs["tilewidth"], pairs["tileheight"],
                            pairs["ver"],
                            imgSizes, pairs["id"]);
    }

    /// Deserialize a TileDesc from a string format.
    static TileCombined parse(const std::string& message)
    {
        Poco::StringTokenizer tokens(message, " ",
                                     Poco::StringTokenizer::TOK_IGNORE_EMPTY | Poco::StringTokenizer::TOK_TRIM);
        return parse(tokens);
    }

    static TileCombined create(const std::vector<TileDesc>& tiles)
    {
        assert(!tiles.empty());

        std::ostringstream xs;
        std::ostringstream ys;
        int ver = -1;

        for (auto& tile : tiles)
        {
            xs << tile.getTilePosX() << ',';
            ys << tile.getTilePosY() << ',';
            ver = std::max(tile.getVersion(), ver);
        }

        return TileCombined(tiles[0].getPart(), tiles[0].getWidth(), tiles[0].getHeight(),
                            xs.str(), ys.str(), tiles[0].getTileWidth(), tiles[0].getTileHeight(), ver, "", -1);
    }

private:
    std::vector<TileDesc> _tiles;
    int _part;
    int _width;
    int _height;
    int _tileWidth;
    int _tileHeight;
    int _ver; //< Versioning support.
    int _id;
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
