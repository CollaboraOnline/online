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

#include <vector>
#include <memory>
#include <unordered_set>
#include <fstream>
#include <assert.h>
#include <zlib.h>
#include <zstd.h>
#include <Log.hpp>
#include <Common.hpp>
#include <FileUtil.hpp>
#include <Png.hpp>
#include <Simd.hpp>
#include <DeltaSimd.h>

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

    friend class DeltaTests;

    // fast - and deltas take lots of size off.
    static const int compressionLevel = -3;

    static constexpr size_t _rleMaskUnits = 256 / 64;

    /// Bitmap row with a CRC for quick vertical shift detection
    class DeltaBitmapRow final {
        size_t _rleSize;
        uint64_t _rleMask[_rleMaskUnits];
        uint32_t *_rleData;
    public:
        class PixIterator final
        {
            const DeltaBitmapRow &_row;
            unsigned int _nMask; // which mask to operate on
            uint32_t _lastPix; // last pixel (or possibly plain alpha)
            uint64_t _lastMask; // holding slot for mask
            uint64_t _bitToCheck; // which bit should we check.
            const uint32_t *_rlePtr; // next pixel to read
            const uint32_t *_endRleData; // end of pixel data
        public:
            PixIterator(const DeltaBitmapRow &row)
                : _row(row), _nMask(0),
                  _lastPix(0x00000000),
                  _lastMask(0),
                  _bitToCheck(0),
                  _rlePtr(row._rleData),
                  _endRleData(row._rleData + row._rleSize)
            {
                next();
            }
            uint32_t getPixel() const
            {
                return _lastPix;
            }
            bool identical(const PixIterator &i) const
            {
                return _lastPix == i._lastPix;
            }
            void next()
            {
                // already at end
                if (_rlePtr == _endRleData)
                    return;

                if (!_bitToCheck)
                { // slow path
                    if (_nMask < 4)
                        _lastMask = _row._rleMask[_nMask++];
                    else
                        _lastMask = 0xffffffffffffffff;
                    _bitToCheck = 1;
                }

                // fast path
                if (!(_lastMask & _bitToCheck))
                    _lastPix = *(_rlePtr++);

                _bitToCheck <<= 1;
            }
        };

        DeltaBitmapRow()
            : _rleSize(0)
            , _rleData(nullptr)
        {
            memset(_rleMask, 0, sizeof(_rleMask));
        }
        DeltaBitmapRow(const DeltaBitmapRow&) = delete;

        ~DeltaBitmapRow()
        {
            if (_rleData)
                free(_rleData);
        }

        size_t sizeBytes()
        {
            return sizeof(DeltaBitmapRow) + _rleSize * 4;
        }

    private:
        void initPixRowCpu(const uint32_t *from, uint32_t *scratch,
                           size_t *scratchLen, uint64_t *rleMaskBlock,
                           unsigned int width)
        {
            uint32_t lastPix = 0x00000000; // transparency
            unsigned int x = 0, outp = 0;

            // non-accelerated path
            for (unsigned int nMask = 0; nMask < 4; ++nMask)
            {
                uint64_t rleMask = 0;
                uint64_t bitToSet = 1;
                if (width - x > 64)
                {
                    // simplified inner loop for 64bit chunks
                    for (; bitToSet; ++x, bitToSet <<= 1)
                    {
                        if (from[x] == lastPix)
                            rleMask |= bitToSet;
                        else
                        {
                            lastPix = from[x];
                            scratch[outp++] = lastPix;
                        }
                    }
                }
                else
                {
                    // even slower inner loop for odd lengths
                    for (; x < width; ++x, bitToSet <<= 1)
                    {
                        if (from[x] == lastPix)
                            rleMask |= bitToSet;
                        else
                        {
                            lastPix = from[x];
                            scratch[outp++] = lastPix;
                        }
                    }
                }
                rleMaskBlock[nMask] = rleMask;
            }

            if (x < width)
            {
                memcpy(scratch + outp, from + x, (width - x) * 4);
                outp += width-x;
            }
            *scratchLen = outp;
        }

    public:

        void initRow(const uint32_t *from, unsigned int width)
        {
            uint32_t scratch[width];

            bool done = false;
            if (simd::HasAVX2 && width == 256)
            {
                done = simd_initPixRowSimd(from, scratch, &_rleSize, _rleMask);

#if ENABLE_DEBUG && 0 // SIMD validation
                if (done)
                {
                    uint32_t cpu_scratch[width];
                    uint64_t cpu_rleMask[_rleMaskUnits];
                    unsigned int cpu_outp = 0;
                    initPixRowCpu(from, cpu_scratch, &cpu_outp, cpu_rleMask, width);

                    // check our result
                    if (memcmp(cpu_rleMask, _rleMask, sizeof (cpu_rleMask)))
                    {
                        std::cerr << "Masks differ " <<
                            Util::bytesToHexString(reinterpret_cast<const char *>(_rleMask), sizeof(_rleMask)) << "\n" <<
                            Util::bytesToHexString(reinterpret_cast<const char *>(cpu_rleMask), sizeof(_rleMask)) << "\n";
                    }
                    assert(_rleSize == cpu_outp);
                    if(_rleSize > 0 && memcmp(scratch, cpu_scratch, _rleSize))
                    {
                        std::cerr << "RLE pixels differ mask:\n" <<
                            Util::bytesToHexString(reinterpret_cast<const char *>(_rleMask), sizeof(_rleMask)) << "\n" <<
                            "pixels:\n" <<
                            Util::bytesToHexString(reinterpret_cast<const char *>(scratch), _rleSize) << "\n" <<
                            Util::bytesToHexString(reinterpret_cast<const char *>(cpu_scratch), _rleSize) << "\n";
                    }
                }
#endif
            }
        // else CPU implementation
            if (!done)
                initPixRowCpu(from, scratch, &_rleSize, _rleMask, width);

            if (_rleSize > 0)
            {
                _rleData = (uint32_t *)malloc((size_t)_rleSize * 4);
                memcpy(_rleData, scratch, _rleSize * 4);
            }
            else
                _rleData = nullptr;
        }

        bool identical(const DeltaBitmapRow &other) const
        {
            if (_rleSize != other._rleSize)
                return false;
            if (memcmp(_rleMask, other._rleMask, sizeof(_rleMask)))
                return false;
            if (!_rleData && !other._rleData)
                return true;
            if (!_rleData || !other._rleData)
                return false;
            return !std::memcmp(_rleData, other._rleData, _rleSize * 4);
        }

        // Create a diff from our state to new state in curRow
        void diffRowTo(const DeltaBitmapRow &curRow,
                       const int width, const int curY,
                       std::vector<uint8_t> &output,
                       LibreOfficeKitTileMode mode) const
        {
            PixIterator oldPixels(*this);
            PixIterator curPixels(curRow);
            for (int x = 0; x < width;)
            {
                int same;
                for (same = 0; same + x < width &&
                         oldPixels.identical(curPixels);)
                {
                    oldPixels.next();
                    curPixels.next();
                    same++;
                }

                x += same;

                uint32_t scratch[256];

                int diff;
                for (diff = 0; diff + x < width &&
                         (!oldPixels.identical(curPixels) || diff < 3)
                         && diff < 254;)
                {
                    oldPixels.next();
                    scratch[diff] = curPixels.getPixel();
                    curPixels.next();
                    ++diff;
                }

                if (diff > 0)
                {
                    output.push_back('d');
                    output.push_back(curY);
                    output.push_back(x);
                    output.push_back(diff);

                    size_t dest = output.size();
                    output.resize(dest + diff * 4);

                    copy_row(reinterpret_cast<unsigned char *>(&output[dest]),
                              (const unsigned char *)(scratch),
                              diff, mode);

                    LOG_TRC("row " << curY << " different " << diff << "pixels");
                    x += diff;
                }
            }
        }
    };

    /// A bitmap tile with annotated rows and details on its location
    struct DeltaData final {
        // no careless copying
        DeltaData(const DeltaData&) = delete;
        DeltaData& operator=(const DeltaData&) = delete;

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

            for (int y = 0; y < height; ++y)
            {
                size_t position = ((startY + y) * bufferWidth * 4) + (startX * 4);
                DeltaBitmapRow &row = _rows[y];
                row.initRow(reinterpret_cast<uint32_t *>(pixmap + position), width);
            }
        }

        ~DeltaData()
        {
            delete[] _rows;
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

        size_t sizeBytes() const
        {
            size_t total = sizeof(DeltaData);
            for (int i = 0; i < _height; ++i)
                total += _rows[i].sizeBytes();
            return total;
        }

        void replaceAndFree(std::shared_ptr<DeltaData> &repl)
        {
            assert (_loc == repl->_loc);
            if (repl.get() == this)
            {
                assert(!"replacing with yourself should never happen");
                return;
            }
            _wid = repl->_wid;
            _width = repl->_width;
            _height = repl->_height;
            delete[] _rows;
            _rows = repl->_rows;
            repl->_rows = nullptr;
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

    void rebalanceDeltasT(bool bDropAll = false)
    {
        if (_deltaEntries.size() > _maxEntries || bDropAll)
        {
            size_t toRemove = _deltaEntries.size();
            if (!bDropAll)
                toRemove -= (_maxEntries * 3 / 4);
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

    static void
    copy_row (unsigned char *dest, const unsigned char *srcBytes, unsigned int count, LibreOfficeKitTileMode mode)
    {
        switch (mode)
        {
            case LOK_TILEMODE_RGBA:
                std::memcpy(dest, srcBytes, count * 4);
                break;
            case LOK_TILEMODE_BGRA:
                std::memcpy(dest, srcBytes, count * 4);
                for (size_t j = 0; j < count * 4; j += 4)
                    std::swap(dest[j], dest[j+2]);
                break;
        }
    }

    bool makeDelta(
        const DeltaData &prev,
        const DeltaData &cur,
        std::vector<char>& outStream,
        LibreOfficeKitTileMode mode)
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

        // let's use uint8_t instead of char to avoid implicit sign extension
        std::vector<uint8_t> output;
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
                        // check if we can extend the last copy
                        uint8_t cnt = output[lastCopy];
                        if (output[lastCopy + 1] + cnt == match &&
                            output[lastCopy + 2] + cnt == y &&
                            // make sure we're not copying from out of bounds of the previous tile
                            output[lastCopy + 1] + cnt + 1 < prev.getHeight())
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
            prev.getRow(y).diffRowTo(cur.getRow(y), prev.getWidth(), y, output, mode);
        }
        LOG_TRC("Created delta of size " << output.size());
        if (output.empty())
        {
            // The tile content is identical to what the client already has, so skip it
            LOG_TRC("Identical / un-changed tile");
            // Return a zero length delta to inform WSD we didn't need that.
            // This allows WSD side TileCache to send updates to waiting subscribers.
            outStream.push_back('D');
            return true;
        }

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
    DeltaGenerator()
        : _maxEntries(0)
    {}

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
        rebalanceDeltas(std::max(count, size_t(1)) * 96);
    }

    void dropCache()
    {
        std::unique_lock<std::mutex> guard(_deltaGuard);
        rebalanceDeltasT(true);
    }

    void dumpState(std::ostream& oss)
    {
        oss << "\tdelta generator with " << _deltaEntries.size() << " entries vs. max " << _maxEntries << "\n";
        size_t totalSize = 0;
        for (auto &it : _deltaEntries)
        {
            size_t size = it->sizeBytes();
            oss << "\t\t" << it->_loc._size << "," << it->_loc._part << "," << it->_loc._left << "," << it->_loc._top << " wid: " << it->getWid() << " size: " << size << "\n";
            totalSize += size;
        }
        oss << "\tdelta generator consumes " << totalSize << " bytes\n";
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
        TileWireId wid, bool forceKeyframe,
        LibreOfficeKitTileMode mode)
    {
        if ((width & 0x1) != 0) // power of two - RGBA
        {
            LOG_TRC("Bad width to create deltas " << width);
            return false;
        }

        if (width > 256 || height > 256)
        {
            LOG_TRC("Bad size << " << width << " x " << height << " to create deltas ");
            assert(false && "shouldn't be possible to get tiles > 256x256");
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
            delta = makeDelta(*cacheEntry, *update, output, mode);

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
        TileWireId wid, bool forceKeyframe,
        bool dumpTiles, LibreOfficeKitTileMode mode)
    {
        #if !ENABLE_DEBUG
        dumpTiles = false;
        #endif
        // Dump the tiles to the child sessions chroot jail
        int dumpedIndex = 1;
        if (dumpTiles)
        {
            std::string path = FileUtil::getSysTempDirectoryPath() + "/tiledump";
            bool directoryExists = FileUtil::Stat(path).exists();
            if (!directoryExists)
                FileUtil::createTmpDir("tiledump");

            // filename format: tile-<viewid>-<part>-<left>-<top>-<index>.png
            std::ostringstream oss;
            oss << "tile-" << loc._canonicalViewId << "-" << loc._part << "-" << loc._left << "-" << loc._top << "-";
            std::string baseFilename = oss.str();

            // find the next available filename
            bool found = false;
            int index = 1;

            while (!found)
            {
                std::string filename = std::string("/") + baseFilename + std::to_string(index) + ".png";
                if (!FileUtil::Stat(path + filename).exists())
                {
                    found = true;
                    path += filename;
                    dumpedIndex = index;
                }
                else
                {
                    index++;
                }
            }

            std::ofstream tileFile(path, std::ios::binary);
            std::vector<char> pngOutput;
            Png::encodeSubBufferToPNG(pixmap, startX, startY, width, height,
                                    bufferWidth, bufferHeight, pngOutput, mode);
            tileFile.write(pngOutput.data(), pngOutput.size());
        }

        if (!createDelta(pixmap, startX, startY, width, height,
                         bufferWidth, bufferHeight,
                         loc, output, wid, forceKeyframe, mode))
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
                copy_row(fixedupLine, pixmap + ((startY + y) * bufferWidth * 4) + (startX * 4), width, mode);

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
        else
        {
            // Dump the delta
            if (dumpTiles)
            {
                std::string path = FileUtil::getSysTempDirectoryPath() + "/tiledump";
                std::ostringstream oss;
                // filename format: tile-delta-<viewid>-<part>-<left>-<top>-<prev_index>_to_<index>.zstd
                oss << "tile-delta-" << loc._canonicalViewId << "-" << loc._part << "-" << loc._left << "-" << loc._top
                    << "-" << dumpedIndex - 1 << "_to_" << dumpedIndex << ".zstd";
                path += oss.str();
                std::ofstream tileFile(path, std::ios::binary);
                // Skip first character which is a 'D' used to identify deltas
                // The rest should be a zstd compressed delta
                tileFile.write(output.data() + 1, output.size() - 1);
            }
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
