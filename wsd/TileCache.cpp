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
#include <Poco/URI.h>

#include "ClientSession.hpp"
#include <Common.hpp>
#include <Protocol.hpp>
#include <Unit.hpp>
#include <Util.hpp>
#include <common/FileUtil.hpp>

using namespace LOOLProtocol;

using Poco::StringTokenizer;

TileCache::TileCache(const std::string& docURL,
                     const std::chrono::system_clock::time_point& modifiedTime,
                     bool dontCache) :
    _docURL(docURL),
    _dontCache(dontCache)
{
#ifndef BUILDING_TESTS
    LOG_INF("TileCache ctor for uri [" << LOOLWSD::anonymizeUrl(_docURL) <<
            "], modifiedTime=" << std::chrono::duration_cast<std::chrono::seconds>
							(modifiedTime.time_since_epoch()).count() << "], dontCache=" << _dontCache);
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
    for (auto i : _streamCache)
        i.clear();
    LOG_INF("Completely cleared tile cache for: " << _docURL);
}

/// Tracks the rendering of a given tile
/// to avoid duplication and help clock
/// rendering latency.
struct TileCache::TileBeingRendered
{
    TileBeingRendered(const TileDesc& tile)
     : _startTime(std::chrono::steady_clock::now()),
       _tile(tile)
    {
    }

    const TileDesc& getTile() const { return _tile; }
    int getVersion() const { return _tile.getVersion(); }
    void setVersion(int version) { _tile.setVersion(version); }

    std::chrono::steady_clock::time_point getStartTime() const { return _startTime; }
    double getElapsedTimeMs() const { return std::chrono::duration_cast<std::chrono::milliseconds>
                                              (std::chrono::steady_clock::now() - _startTime).count(); }
    std::vector<std::weak_ptr<ClientSession>>& getSubscribers() { return _subscribers; }

    void dumpState(std::ostream& os);

private:
    std::vector<std::weak_ptr<ClientSession>> _subscribers;
    std::chrono::steady_clock::time_point _startTime;
    TileDesc _tile;
};

size_t TileCache::countTilesBeingRenderedForSession(const std::shared_ptr<ClientSession>& session)
{
    size_t count = 0;
    for (auto &it : _tilesBeingRendered)
    {
        for (auto &s : it.second->getSubscribers()) {
            if (s.lock() == session)
                count++;
        }
    }
    return count;
}

bool TileCache::hasTileBeingRendered(const std::shared_ptr<TileCache::TileBeingRendered>& tileBeingRendered)
{
    return _tilesBeingRendered.find(tileBeingRendered->getTile()) != _tilesBeingRendered.end();
}

std::shared_ptr<TileCache::TileBeingRendered> TileCache::findTileBeingRendered(const TileDesc& tileDesc)
{
    assertCorrectThread();

    const auto tile = _tilesBeingRendered.find(tileDesc);
    return tile != _tilesBeingRendered.end() ? tile->second : nullptr;
}

void TileCache::forgetTileBeingRendered(const std::shared_ptr<TileCache::TileBeingRendered>& tileBeingRendered)
{
    assertCorrectThread();
    assert(tileBeingRendered);
    assert(hasTileBeingRendered(tileBeingRendered));

    LOG_TRC("Removing all subscribers for " << tileBeingRendered->getTile().serialize());
    _tilesBeingRendered.erase(tileBeingRendered->getTile());
}

double TileCache::getTileBeingRenderedElapsedTimeMs(const TileDesc &tileDesc) const
{
    auto it = _tilesBeingRendered.find(tileDesc);
    if (it == _tilesBeingRendered.end())
        return -1.0; // Negativ value means that we did not find tileBeingRendered object

    return it->second->getElapsedTimeMs();
}

bool TileCache::hasTileBeingRendered(const TileDesc& tile)
{
    return findTileBeingRendered(tile) != nullptr;
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

    TileCache::Tile ret = findTile(tile);

    UnitWSD::get().lookupTile(tile.getPart(), tile.getWidth(), tile.getHeight(),
                              tile.getTilePosX(), tile.getTilePosY(),
                              tile.getTileWidth(), tile.getTileHeight(), ret);

    return ret;
}

void TileCache::saveTileAndNotify(const TileDesc& tile, const char *data, const size_t size)
{
    assertCorrectThread();

    std::shared_ptr<TileBeingRendered> tileBeingRendered = findTileBeingRendered(tile);

    // Save to disk.

    // Ignore if we can't save the tile, things will work anyway, but slower.
    // An error indication is supposed to be sent to all users in that case.
    saveDataToCache(tile, data, size);
    LOG_TRC("Saved cache tile: " << cacheFileName(tile) << " of size " << size << " bytes");

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
            LOG_DBG("No subscribers for: " << cacheFileName(tile));
        }

        // Remove subscriptions.
        if (tileBeingRendered->getVersion() <= tile.getVersion())
        {
            LOG_DBG("STATISTICS: tile " << tile.getVersion() << " internal roundtrip " <<
                    tileBeingRendered->getElapsedTimeMs() << " ms.");
            forgetTileBeingRendered(tileBeingRendered);
        }
    }
    else
    {
        LOG_DBG("No subscribers for: " << cacheFileName(tile));
    }
}

bool TileCache::getTextStream(StreamType type, const std::string& fileName, std::string& content)
{
    Tile textStream = lookupCachedStream(type, fileName);
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

void TileCache::saveTextStream(StreamType type, const std::string& text, const std::string& fileName)
{
    LOG_INF("Saving '" << LOOLProtocol::getAbbreviatedMessage(text.c_str(), text.size()) <<
            "' to " << fileName << " of size " << text.size() << " bytes");

    saveDataToStreamCache(type, fileName, text.c_str(), text.size());
}

void TileCache::saveStream(StreamType type, const std::string& name, const char *data, std::size_t size)
{
    // can fonts be invalidated?
    saveDataToStreamCache(type, name, data, size);
}

TileCache::Tile TileCache::lookupCachedStream(StreamType type, const std::string& name)
{
    auto it = _streamCache[type].find(name);
    if (it != _streamCache[type].end())
    {
        LOG_TRC("Found stream cache tile: " << name << " of size " << it->second->size() << " bytes");
        return it->second;
    }
    else
        return TileCache::Tile();
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
        if (intersectsTile(it->first, part, x, y, width, height))
        {
            LOG_TRC("Removing tile: " << it->first.serialize());
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

void TileCache::removeStream(StreamType type, const std::string& fileName)
{
    auto it = _streamCache[type].find(fileName);
    if (it != _streamCache[type].end())
    {
        LOG_INF("Removed file: " << fileName);
        _streamCache[type].erase(it);
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

bool TileCache::intersectsTile(const TileDesc &tileDesc, int part, int x, int y, int width, int height)
{
    if (part != -1 && tileDesc.getPart() != part)
        return false;

    const int left = std::max(x, tileDesc.getTilePosX());
    const int right = std::min(x + width, tileDesc.getTilePosX() + tileDesc.getTileWidth());
    const int top = std::max(y, tileDesc.getTilePosY());
    const int bottom = std::min(y + height, tileDesc.getTilePosY() + tileDesc.getTileHeight());

    return left <= right && top <= bottom;
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
                " ver=" << tile.getVersion() << " which has no subscribers " << tile.serialize());

        assert(_tilesBeingRendered.find(tile) == _tilesBeingRendered.end());

        tileBeingRendered = std::make_shared<TileBeingRendered>(tile);
        tileBeingRendered->getSubscribers().push_back(subscriber);
        _tilesBeingRendered[tile] = tileBeingRendered;
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
        assert(_tilesBeingRendered.find(tile) == _tilesBeingRendered.end());

        tileBeingRendered = std::make_shared<TileBeingRendered>(tile);
        _tilesBeingRendered[tile] = tileBeingRendered;
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
        LOG_TRC("Tile " << it->first.serialize() << " has " << subscribers.size() << " subscribers.");

        const auto itRem = std::find_if(subscribers.begin(), subscribers.end(),
                                        [sub](std::weak_ptr<ClientSession>& ptr){ return ptr.lock().get() == sub; });
        if (itRem != subscribers.end())
        {
            LOG_TRC("Tile " << it->first.serialize() << " has " << subscribers.size() <<
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

TileCache::Tile TileCache::findTile(const TileDesc &desc)
{
    auto it = _cache.find(desc);
    if (it != _cache.end())
    {
        LOG_TRC("Found cache tile: " << desc.serialize() << " of size " << it->second->size() << " bytes");
        return it->second;
    }
    else
        return TileCache::Tile();
}

void TileCache::saveDataToCache(const TileDesc &desc, const char *data, const size_t size)
{
    if (_dontCache)
        return;

    TileCache::Tile tile = std::make_shared<std::vector<char>>(size);
    std::memcpy(tile->data(), data, size);
    _cache[desc] = tile;
}

void TileCache::saveDataToStreamCache(StreamType type, const std::string &fileName, const char *data, const size_t size)
{
    if (_dontCache)
        return;

    TileCache::Tile tile = std::make_shared<std::vector<char>>(size);
    std::memcpy(tile->data(), data, size);
    _streamCache[type][fileName] = tile;
}

void TileCache::TileBeingRendered::dumpState(std::ostream& os)
{
    os << "    " << _tile.serialize() << " " << std::setw(4) << getElapsedTimeMs() << "ms " << _subscribers.size() << " subscribers\n";
    for (const auto& it : _subscribers)
    {
        std::shared_ptr<ClientSession> session = it.lock();
        os << "      " << session->getId() << " " << session->getUserId() << " " << session->getName() << "\n";
    }
}

void TileCache::dumpState(std::ostream& os)
{
    {
        size_t num = 0, size = 0;
        for (const auto& it : _cache)
        {
            num++; size += it.second->size();
        }
        os << "  tile cache: num: " << num << " size: " << size << " bytes\n";
        for (const auto& it : _cache)
        {
            os << "    " << std::setw(4) << it.first.getWireId()
               << "\t" << std::setw(6) << it.second->size() << " bytes"
               << "\t'" << it.first.serialize() << "'\n" ;
        }
    }

    int type = 0;
    for (const auto& i : _streamCache)
    {
        size_t num = 0, size = 0;
        for (const auto& it : i)
        {
            num++; size += it.second->size();
        }
        os << "  stream cache: " << type++ << " num: " << num << " size: " << size << " bytes\n";
        for (const auto& it : i)
        {
            os << "    " << it.first
               << "\t" << std::setw(6) << it.second->size() << " bytes\n";
        }
    }

    os << "  tiles being rendered " << _tilesBeingRendered.size() << "\n";
    for (const auto& it : _tilesBeingRendered)
        it.second->dumpState(os);
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
