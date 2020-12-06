/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <cassert>
#include <memory>
#include <queue>
#include <thread>
#include <unordered_map>
#include <vector>

#ifdef IOS
#import <fcntl.h>
#import <sys/mman.h>
#import <unistd.h>
#endif

#include "Png.hpp"
#include "Rectangle.hpp"
#include "TileDesc.hpp"

#if ENABLE_DEBUG
#  define ADD_DEBUG_RENDERID (" renderid=" + Util::UniqueId() + '\n')
#else
#  define ADD_DEBUG_RENDERID ("\n")
#endif

/// A quick & dirty cache of the last few PNGs
/// and their hashes to avoid re-compression
/// wherever possible.
class PngCache
{
public:
    typedef std::shared_ptr< std::vector< char > > CacheData;
private:
    struct CacheEntry {
    private:
        size_t    _hitCount;
        TileWireId _wireId;
        CacheData _data;
    public:
        CacheEntry(const CacheData &data, TileWireId id) :
            _hitCount(1),   // Every entry is used at least once; prevent removal at birth.
            _wireId(id),
            _data(data)
        {
        }

        size_t getHitCount() const
        {
            return _hitCount;
        }

        void incrementHitCount()
        {
            ++_hitCount;
        }

        void decrementHitCount()
        {
            --_hitCount;
        }

        const CacheData& getData() const
        {
            return _data;
        }

        TileWireId getWireId() const
        {
            return _wireId;
        }
    } ;
    size_t _cacheSize;
    static const size_t CacheSizeSoftLimit = (1024 * 4 * 32); // 128k of cache
    static const size_t CacheSizeHardLimit = CacheSizeSoftLimit * 2;
    static const size_t CacheWidHardLimit = 4096;
    size_t _cacheHits;
    size_t _cacheTests;
    TileWireId _nextId;

    std::unordered_map< TileBinaryHash, CacheEntry > _cache;
    // This uses little storage so can be much larger
    std::unordered_map< TileBinaryHash, TileWireId > _hashToWireId;

    void clearCache(bool logStats = false)
    {
        if (logStats)
            LOG_DBG("cache clear " << _cache.size() << " items total size " <<
                    _cacheSize << " current hits " << _cacheHits);
        _cache.clear();
        _hashToWireId.clear();
        _cacheSize = 0;
        _cacheHits = 0;
        _cacheTests = 0;
        _nextId = 1;
    }

    // Keep these ids small and wrap them.
    TileWireId createNewWireId()
    {
        TileWireId id = ++_nextId;
        // FIXME: if we wrap - we should flush the clients too really ...
        if (id < 1)
            clearCache(true);
        return id;
    }

public:
    // Performed only after a complete combinetiles
    void balanceCache()
    {
        // A normalish PNG image size for text in a writer document is
        // around 4k for a content tile, and sub 1k for a background one.
        if (_cacheSize > CacheSizeHardLimit)
        {
            size_t avgHits = 0;
            for (auto it = _cache.begin(); it != _cache.end(); ++it)
                avgHits += it->second.getHitCount();

            LOG_DBG("PNG cache has " << _cache.size() << " items, total size " <<
                    _cacheSize << ", current hits " << avgHits << ", total hit rate " <<
                    (_cacheHits * 100. / _cacheTests) << "% at balance start.");
            avgHits /= _cache.size();

            for (auto it = _cache.begin(); it != _cache.end();)
            {
                if ((_cacheSize > CacheSizeSoftLimit && it->second.getHitCount() == 0) ||
                    (_cacheSize > CacheSizeHardLimit && it->second.getHitCount() > 0 && it->second.getHitCount() <= avgHits))
                {
                    // Shrink cache when we exceed the size to maximize
                    // the chance of hitting these entries in the future.
                    _cacheSize -= it->second.getData()->size();
                    it = _cache.erase(it);
                }
                else
                {
                    if (it->second.getHitCount() > 0)
                        it->second.decrementHitCount();
                    ++it;
                }
            }

            LOG_DBG("PNG cache has " << _cache.size() << " items with total size of " <<
                    _cacheSize << " bytes after balance.");
        }

        if (_hashToWireId.size() > CacheWidHardLimit)
        {
            LOG_DBG("Clear half of wid cache of size " << _hashToWireId.size());
            TileWireId max = _nextId - CacheWidHardLimit/2;
            for (auto it = _hashToWireId.begin(); it != _hashToWireId.end();)
            {
                if (it->second < max)
                    it = _hashToWireId.erase(it);
                else
                    ++it;
            }
            LOG_DBG("Wid cache is now size " << _hashToWireId.size());
        }
    }

    /// Lookup an entry in the cache and store the data in output.
    /// Returns true on success, otherwise false.
    bool copyFromCache(const TileBinaryHash hash, std::vector<char>& output, size_t &imgSize)
    {
        if (hash)
        {
            ++_cacheTests;
            auto it = _cache.find(hash);
            if (it != _cache.end())
            {
                ++_cacheHits;
                LOG_DBG("PNG cache with hash " << hash << " hit.");
                output.insert(output.end(),
                              it->second.getData()->begin(),
                              it->second.getData()->end());
                it->second.incrementHitCount();
                imgSize = it->second.getData()->size();

                return true;
            }
        }

        LOG_DBG("PNG cache with hash " << hash << " missed.");
        return false;
    }

    void addToCache(const CacheData &data, TileWireId wid, const TileBinaryHash hash)
    {
        CacheEntry newEntry(data, wid);

        if (hash)
        {
            // Adding duplicates causes grim wid mixups
            assert(hashToWireId(hash) == wid);
            assert(_cache.find(hash) == _cache.end());

            data->shrink_to_fit();
            _cache.emplace(hash, newEntry);
            _cacheSize += data->size();
        }
    }

    PngCache()
    {
        clearCache();
    }

    TileWireId hashToWireId(TileBinaryHash hash)
    {
        TileWireId wid;
        if (hash == 0)
            return 0;
        auto it = _hashToWireId.find(hash);
        if (it != _hashToWireId.end())
            wid = it->second;
        else
        {
            wid = createNewWireId();
            _hashToWireId.emplace(hash, wid);
        }
        return wid;
    }
};

class ThreadPool {
    std::mutex _mutex;
    std::condition_variable _cond;
    std::condition_variable _complete;
    typedef std::function<void()> ThreadFn;
    std::queue<ThreadFn> _work;
    std::vector<std::thread> _threads;
    size_t _working;
    bool   _shutdown;
public:
    ThreadPool()
        : _working(0),
          _shutdown(false)
    {
        int maxConcurrency = 2;
#if MOBILEAPP && !defined(GTKAPP)
        maxConcurrency = std::max<int>(std::thread::hardware_concurrency(), 2);
#else
        const char *max = getenv("MAX_CONCURRENCY");
        if (max)
            maxConcurrency = atoi(max);
#endif
        LOG_TRC("PNG compression thread pool size " << maxConcurrency);
        for (int i = 1; i < maxConcurrency; ++i)
            _threads.push_back(std::thread(&ThreadPool::work, this));
    }
    ~ThreadPool()
    {
        {
            std::unique_lock< std::mutex > lock(_mutex);
            assert(_working == 0);
            _shutdown = true;
        }
        _cond.notify_all();
        for (auto &it : _threads)
            it.join();
    }

    size_t count() const
    {
        return _work.size();
    }

    void pushWorkUnlocked(const ThreadFn &fn)
    {
        _work.push(fn);
    }

    void runOne(std::unique_lock< std::mutex >& lock)
    {
        assert(!_work.empty());

        ThreadFn fn = _work.front();
        _work.pop();
        _working++;
        lock.unlock();

        fn();

        lock.lock();
        _working--;
        if (_work.empty() && _working == 0)
            _complete.notify_all();
    }

    void run()
    {
        std::unique_lock< std::mutex > lock(_mutex);
        assert(_working == 0);

        // Avoid notifying threads if we don't need to.
        bool useThreads = _threads.size() > 1 && _work.size() > 1;
        if (useThreads)
            _cond.notify_all();

        while(!_work.empty())
            runOne(lock);

        if (useThreads && (_working > 0 || !_work.empty()))
            _complete.wait(lock, [this]() { return _working == 0 && _work.empty(); } );

        assert(_working==0);
        assert(_work.empty());
    }

    void work()
    {
        std::unique_lock< std::mutex > lock(_mutex);
        while (!_shutdown)
        {
            _cond.wait(lock);
            if (!_shutdown && !_work.empty())
                runOne(lock);
        }
    }
};

namespace RenderTiles
{
    struct Buffer {
        unsigned char *_data;
        Buffer()
        {
            _data = nullptr;
        }
        Buffer(size_t x, size_t y) :
            Buffer()
        {
            allocate(x, y);
        }
        void allocate(size_t x, size_t y)
        {
            assert(!_data);
            _data = static_cast<unsigned char *>(calloc(x * y, 4));
        }
        ~Buffer()
        {
            if (_data)
                free (_data);
        }
        unsigned char *data() { return _data; }
    };

#ifndef IOS
    static void pushRendered(std::vector<TileDesc> &renderedTiles,
                             const TileDesc &desc, TileWireId wireId, size_t imgSize)
    {
        renderedTiles.push_back(desc);
        renderedTiles.back().setWireId(wireId);
        renderedTiles.back().setImgSize(imgSize);
    }
#endif

#ifdef IOS

#pragma pack(push)
#pragma pack(2)
    typedef struct
    {
        uint16_t bfType;
        uint32_t bfSize;
        uint16_t bfReserved1;
        uint16_t bfReserved2;
        uint32_t bfOffBits;
    } BITMAPFILEHEADER;
#pragma pack(pop)

    typedef uint32_t FXPT2DOT30; // Fixed point 2.30, whatever that means

    typedef struct
    {
        FXPT2DOT30 ciexyzX;
        FXPT2DOT30 ciexyzY;
        FXPT2DOT30 ciexyzZ;
    } CIEXYZ;

    typedef struct
    {
        CIEXYZ ciexyzRed;
        CIEXYZ ciexyzGreen;
        CIEXYZ ciexyzBlue;
    } CIEXYZTRIPLE;

    // We must use the BITMAPV5HEADER to get proper alpha handling.
    typedef struct
    {
        uint32_t bV5Size;
        int32_t bV5Width;
        int32_t bV5Height;
        uint16_t bV5Planes;
        uint16_t bV5BitCount;
        uint32_t bV5Compression;
        uint32_t bV5SizeImage;
        int32_t bV5XPelsPerMeter;
        int32_t bV5YPelsPerMeter;
        uint32_t bV5ClrUsed;
        uint32_t bV5ClrImportant;
        uint32_t bV5RedMask;
        uint32_t bV5GreenMask;
        uint32_t bV5BlueMask;
        uint32_t bV5AlphaMask;
        uint32_t bV5CSType;
        CIEXYZTRIPLE bV5Endpoints;
        uint32_t bV5GammaRed;
        uint32_t bV5GammaGreen;
        uint32_t bV5GammaBlue;
        uint32_t bV5Intent;
        uint32_t bV5ProfileData;
        uint32_t bV5ProfileSize;
        uint32_t bV5Reserved;
    } BITMAPV5HEADER;

#define BI_BITFIELDS 3

#define LCS_sRGB 0x73524742
#define LCS_GM_IMAGES 4

    static size_t bmpFileSize(int width, int height)
    {
        return sizeof(BITMAPFILEHEADER) + sizeof(BITMAPV5HEADER) + width * height * 4;
    }

    static void generateBmpHeader(char *buffer, int width, int height)
    {
        BITMAPFILEHEADER *bf = (BITMAPFILEHEADER*)buffer;
        bf->bfType = ('B' | ('M' << 8));
        bf->bfSize = bmpFileSize(width, height);
        bf->bfReserved1 = 0;
        bf->bfReserved2 = 0;
        bf->bfOffBits = sizeof(BITMAPFILEHEADER) + sizeof(BITMAPV5HEADER);

        BITMAPV5HEADER *bV5 = (BITMAPV5HEADER*) (buffer + sizeof(BITMAPFILEHEADER));
        bV5->bV5Size = sizeof(BITMAPV5HEADER);
        bV5->bV5Width = width;
        bV5->bV5Height = -height;
        bV5->bV5Planes = 1;
        bV5->bV5BitCount = 32;
        bV5->bV5Compression = BI_BITFIELDS;
        bV5->bV5SizeImage = 0;
        bV5->bV5XPelsPerMeter = 1000; // Dummy
        bV5->bV5YPelsPerMeter = 1000;
        bV5->bV5ClrUsed = 0;
        bV5->bV5ClrImportant = 0;
        bV5->bV5RedMask = 0x00FF0000;
        bV5->bV5GreenMask = 0x0000FF00;
        bV5->bV5BlueMask = 0x000000FF;
        bV5->bV5AlphaMask = 0xFF000000;
        bV5->bV5CSType = LCS_sRGB;
        // Leave out fields that are ignored with above settings.
        bV5->bV5Intent = LCS_GM_IMAGES; // ???
        bV5->bV5Reserved = 0;
    }

#endif

    bool doRender(std::shared_ptr<lok::Document> document,
                  TileCombined &tileCombined,
                  PngCache &pngCache,
                  ThreadPool &pngPool,
                  bool combined,
                  const std::function<void (unsigned char *data,
                                            int offsetX, int offsetY,
                                            size_t pixmapWidth, size_t pixmapHeight,
                                            int pixelWidth, int pixelHeight,
                                            LibreOfficeKitTileMode mode)>& blendWatermark,
                  const std::function<void (const char *buffer, size_t length)>& outputMessage)
    {
        auto& tiles = tileCombined.getTiles();

        // Calculate the area we cover
        Util::Rectangle renderArea;
        std::vector<Util::Rectangle> tileRecs;
        tileRecs.reserve(tiles.size());

        for (auto& tile : tiles)
        {
            Util::Rectangle rectangle(tile.getTilePosX(), tile.getTilePosY(),
                                      tileCombined.getTileWidth(), tileCombined.getTileHeight());

            if (tileRecs.empty())
            {
                renderArea = rectangle;
            }
            else
            {
                renderArea.extend(rectangle);
            }

            tileRecs.push_back(rectangle);
        }

        assert(tiles.size() == tileRecs.size());

        const size_t tilesByX = renderArea.getWidth() / tileCombined.getTileWidth();
        const size_t tilesByY = renderArea.getHeight() / tileCombined.getTileHeight();
        const int pixelWidth = tileCombined.getWidth();
        const int pixelHeight = tileCombined.getHeight();
        const size_t pixmapWidth = tilesByX * pixelWidth;
        const size_t pixmapHeight = tilesByY * pixelHeight;

        if (pixmapWidth > 4096 || pixmapHeight > 4096)
            LOG_WRN("Unusual extremely large tile combine of size " << pixmapWidth << 'x' << pixmapHeight);

        RenderTiles::Buffer pixmap(pixmapWidth, pixmapHeight);

        // Render the whole area
        const double area = pixmapWidth * pixmapHeight;
        const auto start = std::chrono::steady_clock::now();
        LOG_TRC("Calling paintPartTile(" << (void*)pixmap.data() << ')');
        document->paintPartTile(pixmap.data(),
                                tileCombined.getPart(),
                                pixmapWidth, pixmapHeight,
                                renderArea.getLeft(), renderArea.getTop(),
                                renderArea.getWidth(), renderArea.getHeight());
        auto duration = std::chrono::steady_clock::now() - start;
        auto elapsed = std::chrono::duration_cast<std::chrono::microseconds>(duration).count();
        double totalTime = elapsed/1000.;
        LOG_DBG("paintPartTile at (" << renderArea.getLeft() << ", " << renderArea.getTop() << "), (" <<
                renderArea.getWidth() << ", " << renderArea.getHeight() << ") " <<
                " rendered in " << totalTime << " ms (" << area / elapsed << " MP/s).");

#ifdef IOS

        for (int i = 0; i < tiles.size(); i++)
        {
            static int bmpFileCounter = 0;
            const int bmpId = bmpFileCounter++;

            const size_t positionX = (tileRecs[i].getLeft() - renderArea.getLeft()) / tileCombined.getTileWidth();
            const size_t positionY = (tileRecs[i].getTop() - renderArea.getTop()) / tileCombined.getTileHeight();

            const int offsetX = positionX * pixelWidth;
            const int offsetY = positionY * pixelHeight;

            NSString *mmapFileBaseName = [NSString stringWithFormat:@"%d.bmp", bmpId];
            NSURL *mmapFileURL = [[NSFileManager.defaultManager temporaryDirectory] URLByAppendingPathComponent:mmapFileBaseName];

            int fd = open([[mmapFileURL path] UTF8String], O_RDWR|O_CREAT, 0666);
            if (fd == -1)
            {
                LOG_SYS("Could not create file " << [[mmapFileURL path] UTF8String]);
                return false;
            }

            const size_t mmapFileSize = bmpFileSize(pixelWidth, pixelHeight);

            if (lseek(fd, mmapFileSize-1, SEEK_SET) == -1)
            {
                LOG_SYS("Could not seek in file " << [[mmapFileURL path] UTF8String]);
                return false;
            }

            if (write(fd, "", 1) == -1)
            {
                LOG_SYS("Could not write at end of " << [[mmapFileURL path] UTF8String]);
                return false;
            }

            char *mmapMemory = (char *)mmap(NULL, mmapFileSize, PROT_READ|PROT_WRITE, MAP_FILE|MAP_SHARED, fd, 0);
            if (mmapMemory == MAP_FAILED)
            {
                LOG_SYS("Could not map in file " << [[mmapFileURL path] UTF8String]);
                close(fd);
                return false;
            }

            close(fd);

            generateBmpHeader(mmapMemory, pixelWidth, pixelHeight);

            for (int y = 0; y < pixelHeight; y++)
                memcpy(mmapMemory + sizeof(BITMAPFILEHEADER) + sizeof(BITMAPV5HEADER) + y * pixelWidth * 4,
                       pixmap.data() + (offsetY + y) * pixmapWidth * 4 + offsetX * 4,
                       pixelWidth * 4);

            if (munmap(mmapMemory, mmapFileSize) == -1)
            {
                LOG_SYS("Could not unmap file " << [[mmapFileURL path] UTF8String]);
                return false;
            }

            std::string tileMsg = tiles[i].serialize("tile:", ADD_DEBUG_RENDERID) + std::string([[mmapFileURL absoluteString] UTF8String]);
            outputMessage(tileMsg.c_str(), tileMsg.length());
        }

#else

        const auto mode = static_cast<LibreOfficeKitTileMode>(document->getTileMode());

        const size_t pixmapSize = 4 * pixmapWidth * pixmapHeight;
        std::vector<char> output;
        output.reserve(pixmapSize);

        // Compress the area as tiles
        std::vector<TileDesc> renderedTiles;
        std::vector<TileDesc> duplicateTiles;
        std::vector<TileBinaryHash> duplicateHashes;
        std::vector<TileWireId> renderingIds;

        size_t tileIndex = 0;

        std::mutex pngMutex;

        for (Util::Rectangle& tileRect : tileRecs)
        {
            const size_t positionX = (tileRect.getLeft() - renderArea.getLeft()) / tileCombined.getTileWidth();
            const size_t positionY = (tileRect.getTop() - renderArea.getTop()) / tileCombined.getTileHeight();

            const int offsetX = positionX * pixelWidth;
            const int offsetY = positionY * pixelHeight;
            blendWatermark(pixmap.data(), offsetX, offsetY,
                           pixmapWidth, pixmapHeight,
                           pixelWidth, pixelHeight,
                           mode);

            const uint64_t hash = Png::hashSubBuffer(pixmap.data(), offsetX, offsetY,
                                                     pixelWidth, pixelHeight, pixmapWidth, pixmapHeight);

            TileWireId wireId = pngCache.hashToWireId(hash);
            TileWireId oldWireId = tiles[tileIndex].getOldWireId();
            if (hash != 0 && oldWireId == wireId)
            {
                // The tile content is identical to what the client already has, so skip it
                LOG_TRC("Match for tile #" << tileIndex << " at (" << positionX << ',' <<
                        positionY << ") oldhash==hash (" << hash << "), wireId: " << wireId << " skipping");
                // Push a zero byte image to inform WSD we didn't need that.
                // This allows WSD side TileCache to free up waiting subscribers.
                pushRendered(renderedTiles, tiles[tileIndex], wireId, 0);
                tileIndex++;
                continue;
            }

            bool skipCompress = false;
            size_t imgSize = -1;
            if (pngCache.copyFromCache(hash, output, imgSize))
            {
                pushRendered(renderedTiles, tiles[tileIndex], wireId, imgSize);
                skipCompress = true;
            }
            else
            {
                LOG_DBG("PNG cache with hash " << hash << " missed.");

                // Don't re-compress the same thing multiple times.
                for (auto id : renderingIds)
                {
                    if (wireId == id)
                    {
                        pushRendered(duplicateTiles, tiles[tileIndex], wireId, 0);
                        duplicateHashes.push_back(hash);
                        skipCompress = true;
                        LOG_TRC("Rendering duplicate tile #" << tileIndex << " at (" << positionX << ',' <<
                                positionY << ") oldhash==hash (" << hash << "), wireId: " << wireId << " skipping");
                        break;
                    }
                }
            }

            if (!skipCompress)
            {
                renderingIds.push_back(wireId);

                // Queue to be executed later in parallel inside 'run'
                pngPool.pushWorkUnlocked([=,&output,&pixmap,&tiles,&renderedTiles,&pngCache,&pngMutex](){

                        PngCache::CacheData data(new std::vector< char >() );
                        data->reserve(pixmapWidth * pixmapHeight * 1);

                        LOG_DBG("Encode a new png for tile #" << tileIndex);
                        if (!Png::encodeSubBufferToPNG(pixmap.data(), offsetX, offsetY, pixelWidth, pixelHeight,
                                                       pixmapWidth, pixmapHeight, *data, mode))
                        {
                            // FIXME: Return error.
                            // sendTextFrameAndLogError("error: cmd=tile kind=failure");
                            LOG_ERR("Failed to encode tile into PNG.");
                            return;
                        }

                        LOG_DBG("Tile " << tileIndex << " is " << data->size() << " bytes.");
                        std::unique_lock<std::mutex> pngLock(pngMutex);
                        output.insert(output.end(), data->begin(), data->end());
                        pngCache.addToCache(data, wireId, hash);
                        pushRendered(renderedTiles, tiles[tileIndex], wireId, data->size());
                    });
            }

            LOG_TRC("Encoded tile #" << tileIndex << " at (" << positionX << ',' << positionY << ") with oldWireId=" <<
                    tiles[tileIndex].getOldWireId() << ", hash=" << hash << " wireId: " << wireId << " in " << imgSize << " bytes.");
            tileIndex++;
        }

        // empty ones come first
        size_t zeroCheckStart = renderedTiles.size();

        pngPool.run();

        for (size_t i = zeroCheckStart; i < renderedTiles.size(); ++i)
        {
            if (renderedTiles[i].getImgSize() == 0)
            {
                LOG_TRC("Encoded 0-sized tile in slot !" << i);
                assert(!"0-sized tile enocded!");
            }
        }

        // FIXME: append duplicates - tragically for now as real duplicates
        // we should append these as
        {
            size_t imgSize = -1;
            assert(duplicateTiles.size() == duplicateHashes.size());
            for (size_t i = 0; i < duplicateTiles.size(); ++i)
            {
                if (pngCache.copyFromCache(duplicateHashes[i], output, imgSize))
                    pushRendered(renderedTiles, duplicateTiles[i],
                                 duplicateTiles[i].getWireId(), imgSize);
                else
                    LOG_ERR("Horror - tile disappeared while rendering! " << duplicateHashes[i]);
            }
        }

        pngCache.balanceCache();

        duration = std::chrono::steady_clock::now() - start;
        elapsed = std::chrono::duration_cast<std::chrono::microseconds>(duration).count();
        totalTime = elapsed/1000.;
        LOG_DBG("rendering tiles at (" << renderArea.getLeft() << ", " << renderArea.getTop() << "), (" <<
                renderArea.getWidth() << ", " << renderArea.getHeight() << ") " <<
                " took " << totalTime << " ms (including the paintPartTile).");

        if (tileIndex == 0)
            return false;

        std::string tileMsg;
        if (combined)
        {
            tileMsg = tileCombined.serialize("tilecombine:", ADD_DEBUG_RENDERID, renderedTiles);

            LOG_TRC("Sending back painted tiles for " << tileMsg << " of size " << output.size() << " bytes) for: " << tileMsg);

            std::unique_ptr<char[]> response;
            const size_t responseSize = tileMsg.size() + output.size();
            response.reset(new char[responseSize]);
            std::copy(tileMsg.begin(), tileMsg.end(), response.get());
            std::copy(output.begin(), output.end(), response.get() + tileMsg.size());
            outputMessage(response.get(), responseSize);
        }
        else
        {
            size_t outputOffset = 0;
            for (auto &i : renderedTiles)
            {
                tileMsg = i.serialize("tile:", ADD_DEBUG_RENDERID);
                const size_t responseSize = tileMsg.size() + i.getImgSize();
                std::unique_ptr<char[]> response;
                response.reset(new char[responseSize]);
                std::copy(tileMsg.begin(), tileMsg.end(), response.get());
                std::copy(output.begin() + outputOffset, output.begin() + outputOffset + i.getImgSize(), response.get() + tileMsg.size());
                outputMessage(response.get(), responseSize);
                outputOffset += i.getImgSize();
            }
        }
#endif
        return true;
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
