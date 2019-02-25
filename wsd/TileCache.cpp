/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#include "TileCache.hpp"

#include <cassert>
#include <climits>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <memory>
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
#include <Common.hpp>
#include <Protocol.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <common/FileUtil.hpp>

using namespace LOOLProtocol;

using Poco::StringTokenizer;
using Poco::Timestamp;

TileCache::TileCache(const std::string& docURL,
                     const Timestamp& modifiedTime,
                     bool dontCache) :
    _docURL(docURL),
    _dontCache(dontCache)
{
#ifndef BUILDING_TESTS
    LOG_INF("TileCache ctor for uri [" << LOOLWSD::anonymizeUrl(_docURL) <<
            "], modifiedTime=" << (modifiedTime.raw()/1000000) <<
            "], dontCache=" << _dontCache);
#endif
    (void)modifiedTime;
}

TileCache::~TileCache()
{
    _owner = std::thread::id();
#ifndef BUILDING_TESTS
    LOG_INF("~TileCache dtor for uri [" << LOOLWSD::anonymizeUrl(_docURL) << "].");
#endif
}

void TileCache::clear()
{
    _cache.clear();
    LOG_INF("Completely cleared tile cache for: " << _docURL);
}

/// Tracks the rendering of a given tile
/// to avoid duplication and help clock
/// rendering latency.
struct TileCache::TileBeingRendered
{
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
    std::vector<std::weak_ptr<ClientSession>>& getSubscribers() { return _subscribers; }
private:
    std::vector<std::weak_ptr<ClientSession>> _subscribers;
    std::chrono::steady_clock::time_point _startTime;
    TileDesc _tile;
    std::string _cachedName;
};

std::shared_ptr<TileCache::TileBeingRendered> TileCache::findTileBeingRendered(const TileDesc& tileDesc)
{
    const std::string cachedName = cacheFileName(tileDesc);

    assertCorrectThread();

    const auto tile = _tilesBeingRendered.find(cachedName);
    return tile != _tilesBeingRendered.end() ? tile->second : nullptr;
}

void TileCache::forgetTileBeingRendered(const std::shared_ptr<TileCache::TileBeingRendered>& tileBeingRendered, const TileDesc& tile)
{
    assertCorrectThread();
    assert(tileBeingRendered);
    assert(_tilesBeingRendered.find(tileBeingRendered->getCacheName()) != _tilesBeingRendered.end());

    for(auto& subscriber : tileBeingRendered->getSubscribers())
    {
        std::shared_ptr<ClientSession> session = subscriber.lock();
        if(session && tile.getId() == -1)
            session->traceUnSubscribeToTile(tileBeingRendered->getCacheName());
    }

    _tilesBeingRendered.erase(tileBeingRendered->getCacheName());
}

double TileCache::getTileBeingRenderedElapsedTimeMs(const std::string& tileCacheName) const
{
    auto iterator = _tilesBeingRendered.find(tileCacheName);
    if(iterator == _tilesBeingRendered.end())
        return -1.0; // Negativ value means that we did not find tileBeingRendered object

    return iterator->second->getElapsedTimeMs();
}

bool TileCache::hasTileBeingRendered(const TileDesc& tile)
{
    return (findTileBeingRendered(tile) != nullptr);
}

int TileCache::getTileBeingRenderedVersion(const TileDesc& tile)
{
    std::shared_ptr<TileBeingRendered> tileBeingRendered = findTileBeingRendered(tile);
    if (tileBeingRendered)
        return tileBeingRendered->getVersion();
    else
        return 0;
}

TileCache::Tile TileCache::lookupTile(const TileDesc& tile)
{
    if (_dontCache)
        return TileCache::Tile();

    const std::string fileName = cacheFileName(tile);
    TileCache::Tile ret = loadTile(fileName);

    UnitWSD::get().lookupTile(tile.getPart(), tile.getWidth(), tile.getHeight(),
                              tile.getTilePosX(), tile.getTilePosY(),
                              tile.getTileWidth(), tile.getTileHeight(), ret);

    return ret;
}

void TileCache::saveDataToCache(const std::string &fileName, const char *data, const size_t size)
{
    if (_dontCache)
        return;

    TileCache::Tile tile = std::make_shared<std::vector<char>>(size);
    std::memcpy(tile->data(), data, size);
    _cache[fileName] = tile;
}

void TileCache::saveTileAndNotify(const TileDesc& tile, const char *data, const size_t size)
{
    assertCorrectThread();

    std::shared_ptr<TileBeingRendered> tileBeingRendered = findTileBeingRendered(tile);

    // Save to disk.
    const std::string cachedName = (tileBeingRendered ? tileBeingRendered->getCacheName()
                                               : cacheFileName(tile));

    // Ignore if we can't save the tile, things will work anyway, but slower.
    // An error indication is supposed to be sent to all users in that case.
    const auto fileName = cachedName;
    saveDataToCache(fileName, data, size);
    LOG_TRC("Saved cache tile: " << fileName);

    // Notify subscribers, if any.
    if (tileBeingRendered)
    {
        const size_t subscriberCount = tileBeingRendered->getSubscribers().size();
        if (subscriberCount > 0)
        {
            std::string response = tile.serialize("tile:");
            LOG_DBG("Sending tile message to " << subscriberCount << " subscribers: " << response);

            // Send to first subscriber as-is (without cache marker).
            auto payload = std::make_shared<Message>(response,
                                                     Message::Dir::Out,
                                                     response.size() + 1 + size);
            payload->append("\n", 1);
            payload->append(data, size);

            auto& firstSubscriber = tileBeingRendered->getSubscribers()[0];
            std::shared_ptr<ClientSession> firstSession = firstSubscriber.lock();
            if (firstSession)
            {
                firstSession->enqueueSendMessage(payload);
            }

            if (subscriberCount > 1)
            {
                // All others must get served from the cache.
                response += " renderid=cached\n";

                // Create a new Payload.
                payload.reset();
                payload = std::make_shared<Message>(response,
                                                    Message::Dir::Out,
                                                    response.size() + size);
                payload->append(data, size);

                for (size_t i = 1; i < subscriberCount; ++i)
                {
                    auto& subscriber = tileBeingRendered->getSubscribers()[i];
                    std::shared_ptr<ClientSession> session = subscriber.lock();
                    if (session)
                    {
                        session->enqueueSendMessage(payload);
                    }
                }
            }
        }
        else
        {
            LOG_DBG("No subscribers for: " << cachedName);
        }

        // Remove subscriptions.
        if (tileBeingRendered->getVersion() <= tile.getVersion())
        {
            LOG_DBG("STATISTICS: tile " << tile.getVersion() << " internal roundtrip " <<
                    tileBeingRendered->getElapsedTimeMs() << " ms.");
            forgetTileBeingRendered(tileBeingRendered, tile);
        }
    }
    else
    {
        LOG_DBG("No subscribers for: " << cachedName);
    }
}

bool TileCache::getTextFile(const std::string& fileName, std::string& content)
{
    Tile textStream = loadTile(fileName);
    if (!textStream)
    {
        LOG_INF("Could not open " << fileName);
        return false;
    }

    std::vector<char> buffer = *textStream;

    if (buffer.size() > 0 && buffer.back() == '\n')
        buffer.pop_back();

    content = std::string(buffer.data(), buffer.size());
    LOG_INF("Read '" << LOOLProtocol::getAbbreviatedMessage(content.c_str(), content.size()) <<
            "' from " << fileName);

    return true;
}

void TileCache::saveTextFile(const std::string& text, const std::string& fileName)
{
    LOG_INF("Saving '" << LOOLProtocol::getAbbreviatedMessage(text.c_str(), text.size()) <<
            "' to " << fileName);

    saveDataToCache(fileName, text.c_str(), text.size());
}

void TileCache::setUnsavedChanges(bool state)
{
    if (state)
        saveTextFile("1", "unsaved.txt");
    else
        removeFile("unsaved.txt");
}

void TileCache::saveRendering(const std::string& name, const std::string& dir, const char *data, std::size_t size)
{
    // can fonts be invalidated?
    const std::string fileName = dir + "/" + name;

    saveDataToCache(fileName, data, size);
}

TileCache::Tile TileCache::lookupCachedTile(const std::string& name, const std::string& dir)
{
    return loadTile(dir + "/" + name);
}

void TileCache::invalidateTiles(int part, int x, int y, int width, int height)
{
    LOG_TRC("Removing invalidated tiles: part: " << part <<
            ", x: " << x << ", y: " << y <<
            ", width: " << width <<
            ", height: " << height);

    assertCorrectThread();

    for (auto it = _cache.begin(); it != _cache.end();)
    {
        const std::string fileName = it->first;
        if (intersectsTile(fileName, part, x, y, width, height))
        {
            LOG_DBG("Removing tile: " << it->first);
            it = _cache.erase(it);
        }
        else
            ++it;
    }
}

void TileCache::invalidateTiles(const std::string& tiles)
{
    std::pair<int, Util::Rectangle> result = TileCache::parseInvalidateMsg(tiles);
    Util::Rectangle& invalidateRect = result.second;
    invalidateTiles(result.first, invalidateRect.getLeft(), invalidateRect.getTop(), invalidateRect.getWidth(), invalidateRect.getHeight());
}

std::pair<int, Util::Rectangle> TileCache::parseInvalidateMsg(const std::string& tiles)
{
    StringTokenizer tokens(tiles, " ", StringTokenizer::TOK_IGNORE_EMPTY | StringTokenizer::TOK_TRIM);

    assert(tokens[0] == "invalidatetiles:");

    if (tokens.count() == 2 && tokens[1] == "EMPTY")
    {
        return std::pair<int, Util::Rectangle>(-1, Util::Rectangle(0, 0, INT_MAX, INT_MAX));
    }
    else if (tokens.count() == 3 && tokens[1] == "EMPTY,")
    {
        int part = 0;
        if (stringToInteger(tokens[2], part))
        {
            return std::pair<int, Util::Rectangle>(part, Util::Rectangle(0, 0, INT_MAX, INT_MAX));
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

            return std::pair<int, Util::Rectangle>(part, Util::Rectangle(x, y, width, height));
        }
    }

    LOG_ERR("Unexpected invalidatetiles request [" << tiles << "].");
    return std::pair<int, Util::Rectangle>(-1, Util::Rectangle(0, 0, 0, 0));
}

void TileCache::removeFile(const std::string& fileName)
{
    auto it = _cache.find(fileName);
    if (it != _cache.end())
    {
        LOG_INF("Removed file: " << fileName);
        _cache.erase(it);
    }
}

std::string TileCache::cacheFileName(const TileDesc& tile)
{
    std::ostringstream oss;
    oss << tile.getPart() << '_' << tile.getWidth() << 'x' << tile.getHeight() << '.'
        << tile.getTilePosX() << ',' << tile.getTilePosY() << '.'
        << tile.getTileWidth() << 'x' << tile.getTileHeight() << ".png";
    return oss.str();
}

bool TileCache::parseCacheFileName(const std::string& fileName, int& part, int& width, int& height, int& tilePosX, int& tilePosY, int& tileWidth, int& tileHeight)
{
    return std::sscanf(fileName.c_str(), "%d_%dx%d.%d,%d.%dx%d.png", &part, &width, &height, &tilePosX, &tilePosY, &tileWidth, &tileHeight) == 7;
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

// FIXME: to be further simplified when we centralize tile messages.
void TileCache::subscribeToTileRendering(const TileDesc& tile, const std::shared_ptr<ClientSession>& subscriber)
{
    std::ostringstream oss;
    oss << '(' << tile.getPart() << ',' << tile.getTilePosX() << ',' << tile.getTilePosY() << ')';
    const std::string name = oss.str();

    assertCorrectThread();

    std::shared_ptr<TileBeingRendered> tileBeingRendered = findTileBeingRendered(tile);

    if (tileBeingRendered)
    {
        for (const auto &s : tileBeingRendered->getSubscribers())
        {
            if (s.lock().get() == subscriber.get())
            {
                LOG_DBG("Redundant request to subscribe on tile " << name);
                tileBeingRendered->setVersion(tile.getVersion());
                return;
            }
        }

        LOG_DBG("Subscribing " << subscriber->getName() << " to tile " << name << " which has " <<
                tileBeingRendered->getSubscribers().size() << " subscribers already.");
        tileBeingRendered->getSubscribers().push_back(subscriber);
        if(tile.getId() == -1)
            subscriber->traceSubscribeToTile(tileBeingRendered->getCacheName());

        const auto duration = (std::chrono::steady_clock::now() - tileBeingRendered->getStartTime());
        if (std::chrono::duration_cast<std::chrono::milliseconds>(duration).count() > COMMAND_TIMEOUT_MS)
        {
            // Tile painting has stalled. Reissue.
            tileBeingRendered->setVersion(tile.getVersion());
        }
    }
    else
    {
        LOG_DBG("Subscribing " << subscriber->getName() << " to tile " << name <<
                " ver=" << tile.getVersion() << " which has no subscribers.");

        const std::string cachedName = cacheFileName(tile);

        assert(_tilesBeingRendered.find(cachedName) == _tilesBeingRendered.end());

        tileBeingRendered = std::make_shared<TileBeingRendered>(cachedName, tile);
        tileBeingRendered->getSubscribers().push_back(subscriber);
        if(tile.getId() == -1)
            subscriber->traceSubscribeToTile(tileBeingRendered->getCacheName());
        _tilesBeingRendered[cachedName] = tileBeingRendered;
    }
}

void TileCache::registerTileBeingRendered(const TileDesc& tile)
{
    std::shared_ptr<TileBeingRendered> tileBeingRendered = findTileBeingRendered(tile);
    if (tileBeingRendered)
    {
        const auto duration = (std::chrono::steady_clock::now() - tileBeingRendered->getStartTime());
        if (std::chrono::duration_cast<std::chrono::milliseconds>(duration).count() > COMMAND_TIMEOUT_MS)
        {
            // Tile painting has stalled. Reissue.
            tileBeingRendered->setVersion(tile.getVersion());
        }
    }
    else
    {
        const std::string cachedName = cacheFileName(tile);

        assert(_tilesBeingRendered.find(cachedName) == _tilesBeingRendered.end());

        tileBeingRendered = std::make_shared<TileBeingRendered>(cachedName, tile);
        _tilesBeingRendered[cachedName] = tileBeingRendered;
    }
}

std::string TileCache::cancelTiles(const std::shared_ptr<ClientSession> &subscriber)
{
    assert(subscriber && "cancelTiles expects valid subscriber");
    LOG_TRC("Cancelling tiles for " << subscriber->getName());

    assertCorrectThread();

    const ClientSession* sub = subscriber.get();

    std::ostringstream oss;

    for (auto it = _tilesBeingRendered.begin(); it != _tilesBeingRendered.end(); )
    {
        if (it->second->getTile().getId() >= 0)
        {
            // Tile is for a thumbnail, don't cancel it
            ++it;
            continue;
        }

        auto& subscribers = it->second->getSubscribers();
        LOG_TRC("Tile " << it->first << " has " << subscribers.size() << " subscribers.");

        const auto itRem = std::find_if(subscribers.begin(), subscribers.end(),
                                        [sub](std::weak_ptr<ClientSession>& ptr){ return ptr.lock().get() == sub; });
        if (itRem != subscribers.end())
        {
            LOG_TRC("Tile " << it->first << " has " << subscribers.size() <<
                    " subscribers. Removing " << subscriber->getName() << ".");
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

    const std::string canceltiles = oss.str();
    return canceltiles.empty() ? canceltiles : "canceltiles " + canceltiles;
}

void TileCache::assertCorrectThread()
{
    const bool correctThread = _owner == std::thread::id() || std::this_thread::get_id() == _owner;
    if (!correctThread)
        LOG_ERR("TileCache method invoked from foreign thread. Expected: " <<
                Log::to_string(_owner) << " but called from " <<
                std::this_thread::get_id() << " (" << Util::getThreadId() << ").");
    assert (correctThread);
}

TileCache::Tile TileCache::loadTile(const std::string &fileName)
{
    auto it = _cache.find(fileName);
    if (it != _cache.end())
    {
        LOG_TRC("Found cache tile: " << fileName);
        return it->second;
    }
    else
        return TileCache::Tile();
}

void TileCache::dumpState(std::ostream& os)
{
    size_t num = 0, size = 0;
    for (auto it : _cache)
    {
        num++; size += it.second->size();
    }
    os << "  tile cache: num: " << num << " size: " << size << " bytes\n";
    for (auto it : _cache)
    {
        os << "    " /* << std::setw(4) << it.first->getWireId() */ << " - '" << it.first << "' - " << it.second->size() << " bytes\n";
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
