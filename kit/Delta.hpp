/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <vector>
#include <unordered_set>
#include <assert.h>
#include <zlib.h>
#include <zstd.h>
#include <Log.hpp>
#include <Common.hpp>

#define ENABLE_DELTAS 1

#ifndef TILE_WIRE_ID
#  define TILE_WIRE_ID
   typedef uint32_t TileWireId;
#endif

/// Unique location of a tile
struct TileLocation {
    // in TWIPS
    int _left;
    int _top;
    int _size;
    int _part;
    int _canonicalViewId;
    TileLocation(int left, int top, int size, int part,
                 int canonicalViewId)
        : _left(left), _top(top), _size(size), _part(part),
          _canonicalViewId(canonicalViewId)
    {
    }
    size_t hash() const
    {
        size_t left = _left;
        size_t top = _top;
        size_t part = _part;
        size_t size = _size;
        size_t canonicalViewId = _canonicalViewId;
        return (left << 20) ^ top ^ (part << 15) ^ (size << 7) ^
               (canonicalViewId << 24);
    }
    bool operator==(const TileLocation& other) const
    {
        return _left == other._left && _top == other._top &&
               _size == other._size && _part == other._part &&
               _canonicalViewId == other._canonicalViewId;
    }
};

/// A quick and dirty, thread-safe delta generator for last tile changes
class DeltaGenerator {

    // fast - and deltas take lots of size off.
    static const int compressionLevel = -3;

    /// Bitmap row with a CRC for quick vertical shift detection
    struct DeltaBitmapRow {
        // FIXME: add "whole row the same" flag.
        uint64_t        _crc;
        const uint32_t *_pixels; // FIXME: remove me.
        size_t          _pixSize;

        bool identical(const DeltaBitmapRow &other) const
        {
            if (_crc != other._crc)
                return false;
            return !std::memcmp(_pixels, other._pixels, _pixSize * 4);
        }
    };

    /// A bitmap tile with annotated rows and details on its location
    struct DeltaData final {
        // no careless copying
        DeltaData(const DeltaData&) = delete;
        DeltaData& operator=(const DeltaData&) = delete;

        static inline uint64_t copyWithCrc(uint32_t *to, const uint32_t *from, unsigned int width)
        {
            assert ((width & 0x1) == 0); // copy 64bits at a time.

            const uint64_t *src = reinterpret_cast<const uint64_t *>(from);
            uint64_t *dest = reinterpret_cast<uint64_t *>(to);

            // We get the hash ~for free as we copy - with a cheap hash.
            uint64_t crc = 0x7fffffff - 1;
            for (unsigned int x = 0; x < (width>>1); ++x)
            {
                crc = (crc << 7) + crc + src[x];
                dest[x] = src[x];
            }
            return crc;
        }

        DeltaData (TileWireId wid,
                   unsigned char* pixmap, size_t startX, size_t startY,
                   int width, int height,
                   const TileLocation &loc, int bufferWidth, int bufferHeight
            ) :
            _loc(loc),
            _inUse(false),
            _wid(wid),
            // in Pixels
            _width(width),
            _height(height),
            _rows(new DeltaBitmapRow[height])
        {
            assert (startX + width <= (size_t)bufferWidth);
            assert (startY + height <= (size_t)bufferHeight);

            (void)bufferHeight;

            LOG_TRC("Converting pixel data to delta data of size "
                    << (width * height * 4) << " width " << width
                    << " height " << height);

            _pixels = (uint32_t *)malloc((size_t)width * height * 4);
            for (int y = 0; y < height; ++y)
            {
                size_t position = ((startY + y) * bufferWidth * 4) + (startX * 4);
                DeltaBitmapRow &row = _rows[y];
                row._pixels = _pixels + width * y;
                row._pixSize = width;
                row._crc = copyWithCrc(
                    const_cast<uint32_t *>(row._pixels),
                    reinterpret_cast<uint32_t *>(pixmap + position), width);
            }
        }

        ~DeltaData()
        {
            delete[] _rows;
            if (_pixels)
                free (_pixels);
        }

        void setWid(TileWireId wid)
        {
            _wid = wid;
        }

        TileWireId getWid() const
        {
            return _wid;
        }

        void setWidth(int width)
        {
            _width = width;
        }

        int getWidth() const
        {
            return _width;
        }

        void setHeight(int height)
        {
            _height = height;
        }

        int getHeight() const
        {
            return _height;
        }

        const DeltaBitmapRow& getRow(int y) const
        {
            return _rows[y];
        }

        void replaceAndFree(std::shared_ptr<DeltaData> &repl)
        {
            assert (_loc == repl->_loc);
            if (repl.get() == this)
            {
                assert("replacing with yourself should never happen");
                return;
            }
            _wid = repl->_wid;
            _width = repl->_width;
            _height = repl->_height;
            delete[] _rows;
            _rows = repl->_rows;
            repl->_rows = nullptr;
            free (_pixels);
            _pixels = repl->_pixels;
            repl->_pixels = nullptr;
            repl.reset();
        }

        inline void use()
        {
            const bool wasInUse = _inUse.exchange(true); (void)wasInUse;
            assert(!wasInUse && "Error: delta was already in use by another thread");
        }

        inline void unuse()
        {
            const bool wasInUse = _inUse.exchange(false); (void)wasInUse;
            assert(wasInUse && "Error: delta was already un-used by another thread");
        }

        TileLocation _loc;
    private:
        std::atomic<bool> _inUse; // thread debugging check.
        TileWireId _wid;
        int _width;
        int _height;
        uint32_t *_pixels;
        DeltaBitmapRow *_rows;
    };

    struct DeltaHasher {
        std::size_t operator()(const std::shared_ptr<DeltaData> &t) const
        {
            return t->_loc.hash();
        }
    };

    struct DeltaCompare {
        bool operator()(const std::shared_ptr<DeltaData> &a,
                        const std::shared_ptr<DeltaData> &b) const
        {
            return a->_loc == b->_loc;
        }
    };

    std::mutex _deltaGuard;
    /// The last several bitmap entries as a cache
    std::unordered_set<std::shared_ptr<DeltaData>, DeltaHasher, DeltaCompare> _deltaEntries;
    size_t _maxEntries;

    void rebalanceDeltasT()
    {
        if (_deltaEntries.size() > _maxEntries)
        {
            size_t toRemove = _deltaEntries.size() - (_maxEntries * 3 / 4);
            std::vector<std::shared_ptr<DeltaData>> entries;
            entries.insert(entries.end(), _deltaEntries.begin(), _deltaEntries.end());
            std::sort(entries.begin(), entries.end(),
                      [](const std::shared_ptr<DeltaData> &a,
                         const std::shared_ptr<DeltaData> &b)
                          {
                              return a->getWid() < b->getWid();
                          });
            for (size_t i = 0; i < toRemove; ++i)
                _deltaEntries.erase(entries[i]);
        }
    }

    // Unpremultiplies data and converts native endian ARGB => RGBA bytes
    static void
    unpremult_copy (unsigned char *dest, const unsigned char *srcBytes, unsigned int count)
    {
        const uint32_t *src = reinterpret_cast<const uint32_t *>(srcBytes);

        for (unsigned int i = 0; i < count; ++i)
        {
            // Profile me: avoid math for runs of duplicate pixels
            // possibly we should RLE earlier ?
            if (i > 0 && src[i-1] == src[i])
            {
                std::memcpy (dest, dest - 4, 4);
                dest += 4;
                continue;
            }

            uint32_t pix;
            uint8_t  alpha;

            std::memcpy (&pix, src + i, sizeof (uint32_t));

            alpha = (pix & 0xff000000) >> 24;
            if (alpha == 255)
            {
                dest[0] = ((pix & 0xff0000) >> 16);
                dest[1] = ((pix & 0x00ff00) >>  8);
                dest[2] = ((pix & 0x0000ff) >>  0);
                dest[3] = 255;
            }
            else if (alpha == 0)
                dest[0] = dest[1] = dest[2] = dest[3] = 0;

            else
            {
                dest[0] = (((pix & 0xff0000) >> 16) * 255 + alpha / 2) / alpha;
                dest[1] = (((pix & 0x00ff00) >>  8) * 255 + alpha / 2) / alpha;
                dest[2] = (((pix & 0x0000ff) >>  0) * 255 + alpha / 2) / alpha;
                dest[3] = alpha;
            }
            dest += 4;
        }
    }

    bool makeDelta(
        const DeltaData &prev,
        const DeltaData &cur,
        std::vector<char>& outStream)
    {
        // TODO: should we split and compress alpha separately ?
        if (prev.getWidth() != cur.getWidth() || prev.getHeight() != cur.getHeight())
        {
            LOG_ERR("mis-sized delta: " << prev.getWidth() << 'x' << prev.getHeight() << " vs "
                    << cur.getWidth() << 'x' << cur.getHeight());
            return false;
        }

        LOG_TRC("building delta of a " << cur.getWidth() << 'x' << cur.getHeight() << " bitmap " <<
                "between old wid " << prev.getWid() << " and " << cur.getWid());

        std::vector<char> output;
        // guestimated upper-bound delta size
        output.reserve(cur.getWidth() * (cur.getHeight() + 4) * 4);

        // row move/copy src/dest is a byte.
        assert (prev.getHeight() <= 256);
        // column position is a byte.
        assert (prev.getWidth() <= 256);

        // How do the rows look against each other ?
        size_t lastMatchOffset = 0;
        size_t lastCopy = 0;
        for (int y = 0; y < prev.getHeight(); ++y)
        {
            // Life is good where rows match:
            if (prev.getRow(y).identical(cur.getRow(y)))
                continue;

            // Hunt for other rows
            bool matched = false;
            for (int yn = 0; yn < prev.getHeight() && !matched; ++yn)
            {
                size_t match = (y + lastMatchOffset + yn) % prev.getHeight();
                if (prev.getRow(match).identical(cur.getRow(y)))
                {
                    // TODO: if offsets are >256 - use 16bits?
                    if (lastCopy > 0)
                    {
                        char cnt = output[lastCopy];
                        if (output[lastCopy + 1] + cnt == (char)(match) &&
                            output[lastCopy + 2] + cnt == (char)(y))
                        {
                            output[lastCopy]++;
                            matched = true;
                            continue;
                        }
                    }

                    lastMatchOffset = match - y;
                    output.push_back('c');   // copy-row
                    lastCopy = output.size();
                    output.push_back(1);     // count - updated later.
                    output.push_back(match); // src
                    output.push_back(y);     // dest

                    matched = true;
                    continue;
                }
            }
            if (matched)
                continue;

            // Our row is just that different:
            const DeltaBitmapRow &curRow = cur.getRow(y);
            const DeltaBitmapRow &prevRow = prev.getRow(y);
            for (int x = 0; x < prev.getWidth();)
            {
                int same;
                for (same = 0; same + x < prev.getWidth() &&
                         prevRow._pixels[x+same] == curRow._pixels[x+same];)
                    ++same;

                x += same;

                int diff;
                for (diff = 0; diff + x < prev.getWidth() &&
                         (prevRow._pixels[x+diff] != curRow._pixels[x+diff] || diff < 3) &&
                         diff < 254;)
                    ++diff;
                if (diff > 0)
                {
                    output.push_back('d');
                    output.push_back(y);
                    output.push_back(x);
                    output.push_back(diff);

                    size_t dest = output.size();
                    output.resize(dest + diff * 4);

                    unpremult_copy(reinterpret_cast<unsigned char *>(&output[dest]),
                                   (const unsigned char *)(curRow._pixels + x),
                                   diff);

                    LOG_TRC("row " << y << " different " << diff << "pixels");
                    x += diff;
                }
            }
        }
        LOG_TRC("Created delta of size " << output.size());
        if (output.empty())
        {
            // The tile content is identical to what the client already has, so skip it
            LOG_TRC("Identical / un-changed tile");
            // Return a zero byte image to inform WSD we didn't need that.
            // This allows WSD side TileCache to free up waiting subscribers.
            return true;
        }

#if !ENABLE_DELTAS
        return false; // Disable transmission for now; just send keyframes.
#endif

        // terminating this delta so we can detect the next one.
        output.push_back('t');

        // FIXME: avoid allocation & make this more efficient.
        size_t maxCompressed = ZSTD_COMPRESSBOUND(output.size());
        std::unique_ptr<char, void (*)(void*)> compressed((char*)malloc(maxCompressed), free);

        // compress for speed, not size - and trust to deltas.
        size_t compSize = ZSTD_compress(compressed.get(), maxCompressed,
                                        output.data(), output.size(),
                                        compressionLevel);
        if (ZSTD_isError(compSize))
        {
            LOG_ERR("Failed to compress delta of size " << output.size() << " with " << ZSTD_getErrorName(compSize));
            return false;
        }

        LOG_TRC("Compressed delta of size " << output.size() << " to size " << compSize);
//                << Util::dumpHex(std::string((char *)compressed.get(), compSize)));

        // FIXME: should get zstd to drop it directly in-place really.
        outStream.push_back('D');
        size_t oldSize = outStream.size();
        outStream.resize(oldSize + compSize);
        memcpy(&outStream[oldSize], compressed.get(), compSize);

        return true;
    }

  public:
    DeltaGenerator() {}

    /// Re-balances the cache size to fit the number of sessions
    void rebalanceDeltas(ssize_t limit = -1)
    {
        std::unique_lock<std::mutex> guard(_deltaGuard);
        if (limit > 0)
            _maxEntries = limit;
        rebalanceDeltasT();
    }

    /// Adapts cache sizing to the number of sessions
    void setSessionCount(size_t count)
    {
        rebalanceDeltas(std::max(count, size_t(1)) * 24);
    }

    void dumpState(std::ostream& oss)
    {
        oss << "\tdelta generator with " << _deltaEntries.size() << " entries vs. max " << _maxEntries << "\n";
        for (auto &it : _deltaEntries)
            oss << "\t\t" << it->_loc._size << "," << it->_loc._part << "," << it->_loc._left << "," << it->_loc._top << " wid: " << it->getWid() << "\n";
    }

    /**
     * Creates a delta if possible:
     *   if so - returns @true and appends the delta to @output
     * stores @pixmap, and other data to accelerate delta
     * creation in a limited size cache.
     */
    bool createDelta(
        unsigned char* pixmap, size_t startX, size_t startY,
        int width, int height,
        int bufferWidth, int bufferHeight,
        const TileLocation &loc,
        std::vector<char>& output,
        TileWireId wid, bool forceKeyframe)
    {
        if ((width & 0x1) != 0) // power of two - RGBA
        {
            LOG_TRC("Bad width to create deltas " << width);
            return false;
        }

        // FIXME: why duplicate this ? we could overwrite
        // as we make the delta into an existing cache entry,
        // and just do this as/when there is no entry.
        std::shared_ptr<DeltaData> update(
            new DeltaData(
                wid, pixmap, startX, startY, width, height,
                loc, bufferWidth, bufferHeight));
        std::shared_ptr<DeltaData> cacheEntry;

        {
            // protect _deltaEntries
            std::unique_lock<std::mutex> guard(_deltaGuard);

            auto it = _deltaEntries.find(update);
            if (it == _deltaEntries.end())
            {
                _deltaEntries.insert(update);
                return false;
            }
            cacheEntry = *it;
            cacheEntry->use();
        }

        // interestingly cacheEntry may no longer be in the cache by here.
        // but no other thread can touch the same tile at the same time.
        assert (cacheEntry);

        bool delta = false;
        if (!forceKeyframe)
            delta = makeDelta(*cacheEntry, *update, output);

        // no two threads can be working on the same DeltaData.
        cacheEntry->replaceAndFree(update);

        cacheEntry->unuse();
        return delta;
    }

    /**
     * Compress the relevant pixmap data either to a delta if we can
     * or a plain deflated stream if we cannot.
     */
    size_t compressOrDelta(
        unsigned char* pixmap, size_t startX, size_t startY,
        int width, int height,
        int bufferWidth, int bufferHeight,
        const TileLocation &loc,
        std::vector<char>& output,
        TileWireId wid, bool forceKeyframe)
    {
        if (!createDelta(pixmap, startX, startY, width, height,
                         bufferWidth, bufferHeight,
                         loc, output, wid, forceKeyframe))
        {
            // FIXME: should stream it in =)
            size_t maxCompressed = ZSTD_COMPRESSBOUND((size_t)width * height * 4);

            std::unique_ptr<char, void (*)(void*)> compressed((char*)malloc(maxCompressed), free);
            if (!compressed)
            {
                LOG_ERR("Failed to allocate buffer of size " << maxCompressed << " to compress into");
                return 0;
            }

            ZSTD_CCtx *cctx = ZSTD_createCCtx();

            ZSTD_CCtx_setParameter(cctx, ZSTD_c_compressionLevel, compressionLevel);

            ZSTD_outBuffer outb;
            outb.dst = compressed.get();
            outb.size = maxCompressed;
            outb.pos = 0;

            unsigned char fixedupLine[width * 4];

            // FIXME: should we RLE in pixels first ?
            for (int y = 0; y < height; ++y)
            {
                unpremult_copy(fixedupLine, pixmap + ((startY + y) * bufferWidth * 4) + (startX * 4), width);

                ZSTD_inBuffer inb;
                inb.src = fixedupLine;
                inb.size = width * 4;
                inb.pos = 0;

                bool lastRow = (y == height - 1);

                ZSTD_EndDirective endOp = lastRow ? ZSTD_e_end : ZSTD_e_continue;
                size_t compSize = ZSTD_compressStream2(cctx, &outb, &inb, endOp);
                if (ZSTD_isError(compSize))
                {
                    LOG_ERR("failed to compress image: " << compSize << " is: " << ZSTD_getErrorName(compSize));
                    ZSTD_freeCCtx(cctx);
                    return 0;
                }
            }

            ZSTD_freeCCtx(cctx);

            size_t compSize = outb.pos;
            LOG_TRC("Compressed image of size " << (width * height * 4) << " to size " << compSize);
//                    << Util::dumpHex(std::string((char *)compressed, compSize)));

            // FIXME: get zstd to compress directly into this buffer.
            output.push_back('Z');
            size_t oldSize = output.size();
            output.resize(oldSize + compSize);
            memcpy(&output[oldSize], compressed.get(), compSize);
        }

        return output.size();
    }

    // used only by test code
    static Blob expand(const Blob &blob)
    {
        Blob img = std::make_shared<BlobData>();
        img->resize(1024*1024*4); // lots of extra space.

        size_t const dSize = ZSTD_decompress(img->data(), img->size(), blob->data(), blob->size());
        if (ZSTD_isError(dSize))
        {
            LOG_ERR("Failed to decompress blob of size " << blob->size() << " with " << ZSTD_getErrorName(dSize));
            return Blob();
        }
        img->resize(dSize);

        return img;
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
