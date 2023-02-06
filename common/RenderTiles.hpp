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
#include <common/SpookyV2.h>

#include "Png.hpp"
#include "Delta.hpp"
#include "Rectangle.hpp"
#include "TileDesc.hpp"

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
#ifdef __EMSCRIPTEN__
        // Leave it at that.
#elif MOBILEAPP && !defined(GTKAPP)
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

    void pushWork(const ThreadFn &fn)
    {
        std::unique_lock< std::mutex > lock(_mutex);
        assert(_working == 0);
        _work.push(fn);
    }

    void runOne(std::unique_lock< std::mutex >& lock)
    {
        assert(!_work.empty());

        ThreadFn fn = _work.front();
        _work.pop();
        _working++;
        lock.unlock();

        try {
            fn();
        } catch(...) {
            LOG_ERR("Exception in thread pool execution.");
        }

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

    void dumpState(std::ostream& oss)
    {
        oss << "\tthreadPool:"
            << "\n\t\tshutdown: " << _shutdown
            << "\n\t\tworking: " << _working
            << "\n\t\twork count: " << count()
            << "\n\t\tthread count " << _threads.size()
            << "\n";
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

    static void pushRendered(std::vector<TileDesc> &renderedTiles,
                             const TileDesc &desc, TileWireId wireId, size_t imgSize)
    {
        renderedTiles.push_back(desc);
        renderedTiles.back().setWireId(wireId);
        renderedTiles.back().setImgSize(imgSize);
    }

    bool doRender(std::shared_ptr<lok::Document> document,
                  DeltaGenerator &deltaGen,
                  TileCombined &tileCombined,
                  ThreadPool &pngPool,
                  bool combined,
                  const std::function<void (unsigned char *data,
                                            int offsetX, int offsetY,
                                            size_t pixmapWidth, size_t pixmapHeight,
                                            int pixelWidth, int pixelHeight,
                                            LibreOfficeKitTileMode mode)>& blendWatermark,
                  const std::function<void (const char *buffer, size_t length)>& outputMessage,
                  unsigned mobileAppDocId,
                  int canonicalViewId)
    {
        const auto& tiles = tileCombined.getTiles();

        // Otherwise our delta-building & threading goes badly wrong
        // external sources of tilecombine are checked at the perimeter
        assert(!tileCombined.hasDuplicates());

        // Calculate the area we cover
        Util::Rectangle renderArea;
        std::vector<Util::Rectangle> tileRecs;
        tileRecs.reserve(tiles.size());

        for (const auto& tile : tiles)
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
        assert (pixelWidth > 0 && pixelHeight > 0);
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
                                tileCombined.getEditMode(),
                                pixmapWidth, pixmapHeight,
                                renderArea.getLeft(), renderArea.getTop(),
                                renderArea.getWidth(), renderArea.getHeight());
        auto duration = std::chrono::steady_clock::now() - start;
        const auto elapsedMs = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
        const double elapsedMics = elapsedMs.count() * 1000.; // Need MPixels/sec, use Pixels/mics.
        LOG_DBG("paintPartTile at ("
                << renderArea.getLeft() << ", " << renderArea.getTop() << "), ("
                << renderArea.getWidth() << ", " << renderArea.getHeight() << ") "
                << " rendered in " << elapsedMs << " (" << area / elapsedMics << " MP/s).");

        (void) mobileAppDocId;

        const auto mode = static_cast<LibreOfficeKitTileMode>(document->getTileMode());

        const size_t pixmapSize = 4 * pixmapWidth * pixmapHeight;
        std::vector<char> output;
        output.reserve(pixmapSize);

        // Compress the area as tiles
        std::vector<TileDesc> renderedTiles;
        std::vector<TileWireId> renderingIds;

        size_t tileIndex = 0;

        std::mutex pngMutex;

        for (const Util::Rectangle& tileRect : tileRecs)
        {
            const size_t positionX = (tileRect.getLeft() - renderArea.getLeft()) / tileCombined.getTileWidth();
            const size_t positionY = (tileRect.getTop() - renderArea.getTop()) / tileCombined.getTileHeight();

            const int offsetX = positionX * pixelWidth;
            const int offsetY = positionY * pixelHeight;

            // FIXME: should this be in the delta / compression thread ?
            blendWatermark(pixmap.data(), offsetX, offsetY,
                           pixmapWidth, pixmapHeight,
                           pixelWidth, pixelHeight,
                           mode);

            // FIXME: prettify this.
            bool forceKeyframe = tiles[tileIndex].getOldWireId() == 0;

            // FIXME: we should perhaps increment only on a plausible edit
            static TileWireId nextId = 0;
            TileWireId wireId = ++nextId;

            bool skipCompress = false;
            if (!skipCompress)
            {
                renderingIds.push_back(wireId);

                LOG_TRC("Queued encoding of tile #" << tileIndex << " at (" << positionX << ',' << positionY << ") with " <<
                        (forceKeyframe?"force keyframe" : "allow delta") << ", wireId: " << wireId);

                // Queue to be executed later in parallel inside 'run'
                pngPool.pushWork([=,&output,&pixmap,&tiles,&renderedTiles,
                                  &pngMutex,&deltaGen]()
                    {
                        std::vector< char > data;
                        data.reserve(pixmapWidth * pixmapHeight * 1);

                        // FIXME: don't try to store & create deltas for read-only documents.
                        if (tiles[tileIndex].getId() < 0) // not a preview
                        {
                            // Can we create a delta ?
                            LOG_TRC("Compress new tile #" << tileIndex);
                            deltaGen.compressOrDelta(pixmap.data(), offsetX, offsetY,
                                                     pixelWidth, pixelHeight,
                                                     pixmapWidth, pixmapHeight,
                                                     TileLocation(
                                                         tileRect.getLeft(),
                                                         tileRect.getTop(),
                                                         tileRect.getWidth(),
                                                         tileCombined.getPart(),
                                                         canonicalViewId
                                                         ),
                                                     data, wireId, forceKeyframe);
                        }
                        else
                        {
                            // FIXME: write our own trivial PNG encoding code using deflate.
                            LOG_TRC("Encode a new png for tile #" << tileIndex);
                            if (!Png::encodeSubBufferToPNG(pixmap.data(), offsetX, offsetY, pixelWidth, pixelHeight,
                                                           pixmapWidth, pixmapHeight, data, mode))
                            {
                                // FIXME: Return error.
                                // sendTextFrameAndLogError("error: cmd=tile kind=failure");
                                LOG_ERR("Failed to encode tile into PNG.");
                                return;
                            }
                        }

                        LOG_TRC("Tile " << tileIndex << " is " << data.size() << " bytes.");
                        std::unique_lock<std::mutex> pngLock(pngMutex);
                        output.insert(output.end(), data.begin(), data.end());
                        pushRendered(renderedTiles, tiles[tileIndex], wireId, data.size());
                    });
            }
            tileIndex++;
        }

        pngPool.run();

        duration = std::chrono::steady_clock::now() - start;
        const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(duration);
        LOG_DBG("rendering tiles at (" << renderArea.getLeft() << ", " << renderArea.getTop()
                                       << "), (" << renderArea.getWidth() << ", "
                                       << renderArea.getHeight() << ") "
                                       << " took " << elapsed << " (including the paintPartTile).");

        if (tileIndex == 0)
            return false;

        std::string tileMsg;
        if (combined)
        {
            tileMsg = tileCombined.serialize("tilecombine:", "\n", renderedTiles);

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
                tileMsg = i.serialize("tile:", "\n");
                const size_t responseSize = tileMsg.size() + i.getImgSize();
                std::unique_ptr<char[]> response;
                response.reset(new char[responseSize]);
                std::copy(tileMsg.begin(), tileMsg.end(), response.get());
                std::copy(output.begin() + outputOffset, output.begin() + outputOffset + i.getImgSize(), response.get() + tileMsg.size());
                outputMessage(response.get(), responseSize);
                outputOffset += i.getImgSize();
            }
        }

        // Should we do this more frequently? and/orshould we defer it?
        deltaGen.rebalanceDeltas();
        return true;
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
