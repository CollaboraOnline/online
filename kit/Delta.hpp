/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <vector>
#include <assert.h>
#include <Log.hpp>
#include <zlib.h>

#ifndef TILE_WIRE_ID
#  define TILE_WIRE_ID
   typedef uint32_t TileWireId;
#endif

/// A quick and dirty delta generator for last tile changes
class DeltaGenerator {

    /// Bitmap row with a CRC for quick vertical shift detection
    struct DeltaBitmapRow {
    private:
        uint64_t _crc;
        std::vector<uint32_t> _pixels;

    public:
        bool identical(const DeltaBitmapRow &other) const
        {
            if (_crc != other._crc)
                return false;
            return _pixels == other._pixels;
        }

        const std::vector<uint32_t>& getPixels() const
        {
            return _pixels;
        }

        std::vector<uint32_t>& getPixels()
        {
            return _pixels;
        }
    };

    /// A bitmap tile with annotated rows and details on its location
    struct DeltaData {
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

        void setTilePos(int left, int top, int part)
        {
            _left = left;
            _top = top;
            _part = part;
        }

        const std::vector<DeltaBitmapRow>& getRows() const
        {
            return _rows;
        }

        std::vector<DeltaBitmapRow>& getRows()
        {
            return _rows;
        }

        void replace(const std::shared_ptr<DeltaData> &repl)
        {
            assert (_left == repl->_left && _top == repl->_top && _part == repl->_part);
            _wid = repl->_wid;
            _width = repl->_width;
            _height = repl->_height;
            _rows = repl->_rows; // FIXME: shared_ptr?
        }

        int _left;
        int _top;
        int _part;
    private:
        TileWireId _wid;
        int _width;
        int _height;
        std::vector<DeltaBitmapRow> _rows;
    };

    /// The last several bitmap entries as a cache
    std::vector<std::shared_ptr<DeltaData>> _deltaEntries;

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
                dest[0] = dest[-4];
                dest[1] = dest[-3];
                dest[2] = dest[-2];
                dest[3] = dest[-1];
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

        LOG_TRC("building delta of a " << cur.getWidth() << 'x' << cur.getHeight() << " bitmap");

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
            if (prev.getRows()[y].identical(cur.getRows()[y]))
                continue;

            // Hunt for other rows
            bool matched = false;
            for (int yn = 0; yn < prev.getHeight() && !matched; ++yn)
            {
                size_t match = (y + lastMatchOffset + yn) % prev.getHeight();
                if (prev.getRows()[match].identical(cur.getRows()[y]))
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
                    output.push_back(1);     // count
                    output.push_back(match); // src
                    output.push_back(y);     // dest

                    matched = true;
                    continue;
                }
            }
            if (matched)
                continue;

            // Our row is just that different:
            const DeltaBitmapRow &curRow = cur.getRows()[y];
            const DeltaBitmapRow &prevRow = prev.getRows()[y];
            for (int x = 0; x < prev.getWidth();)
            {
                int same;
                for (same = 0; same + x < prev.getWidth() &&
                         prevRow.getPixels()[x+same] == curRow.getPixels()[x+same];)
                    ++same;

                x += same;

                int diff;
                for (diff = 0; diff + x < prev.getWidth() &&
                         (prevRow.getPixels()[x+diff] != curRow.getPixels()[x+diff] || diff < 3) &&
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
                                   (const unsigned char *)(&curRow.getPixels()[x]),
                                   diff);

                    LOG_TRC("different " << diff << "pixels");
                    x += diff;
                }
            }
        }
        LOG_TRC("Created delta of size " << output.size());

        z_stream zstr;
        memset((void *)&zstr, 0, sizeof (zstr));

        if (deflateInit2 (&zstr, Z_DEFAULT_COMPRESSION, Z_DEFLATED,
                          -MAX_WBITS, 8, Z_DEFAULT_STRATEGY) != Z_OK) {
            LOG_ERR("Failed to init deflate");
            return false;
        }

        // FIXME: avoid allocation & make this more efficient.
        uLong maxCompressed = compressBound(output.size());
        Bytef *compressed = (Bytef *)malloc(maxCompressed);

        zstr.next_in = (Bytef *)output.data();
        zstr.avail_in = output.size();
        zstr.next_out = compressed;
        zstr.avail_out = maxCompressed;

        if (!compressed || deflate(&zstr, Z_FINISH) != Z_STREAM_END) {
            LOG_ERR("Failed to compress delta of size " << output.size());
            return false;
        }

        deflateEnd(&zstr);

        uLong compSize = maxCompressed - zstr.avail_out;
        LOG_TRC("Compressed delta of size " << output.size() << " to size " << compSize);
//                << Util::dumpHex(std::string((char *)compressed, compSize)));

        // FIXME: should get zlib to drop it directly in really.
        outStream.push_back('D');
        size_t oldSize = outStream.size();
        outStream.resize(oldSize + compSize);
        memcpy(&outStream[oldSize], compressed, compSize);
        free (compressed);

        return true;
    }

    std::shared_ptr<DeltaData> dataToDeltaData(
        TileWireId wid,
        unsigned char* pixmap, size_t startX, size_t startY,
        int width, int height,
        int tileLeft, int tileTop, int tilePart,
        int bufferWidth, int bufferHeight)
    {
        auto data = std::make_shared<DeltaData>();
        data->setWid(wid);

        assert (startX + width <= (size_t)bufferWidth);
        assert (startY + height <= (size_t)bufferHeight);

        (void)bufferHeight;

        LOG_TRC("Converting pixel data to delta data of size "
                << (width * height * 4) << " width " << width
                << " height " << height);

        // FIXME: switch to constructor and remove set methods
        data->setWidth(width);
        data->setHeight(height);
        data->setTilePos(tileLeft, tileTop, tilePart);
        data->getRows().resize(height);
        for (int y = 0; y < height; ++y)
        {
            DeltaBitmapRow &row = data->getRows()[y];
            size_t position = ((startY + y) * bufferWidth * 4) + (startX * 4);
            int32_t *src = reinterpret_cast<int32_t *>(pixmap + position);

            // We get the hash ~for free as we copy - with a cheap hash.
            uint64_t crc = 0x7fffffff - 1;
            row.getPixels().resize(width);
            for (int x = 0; x < width; ++x)
            {
                crc = (crc << 7) + crc + src[x];
                row.getPixels()[x] = src[x];
            }
        }

        return data;
    }

  public:
    DeltaGenerator() {}

    /**
     * Creates a delta between @oldWid and pixmap if possible:
     *   if so - returns @true and appends the delta to @output
     * stores @pixmap, and other data to accelerate delta
     * creation in a limited size cache.
     */
    bool createDelta(
        unsigned char* pixmap, size_t startX, size_t startY,
        int width, int height,
        int bufferWidth, int bufferHeight,
        int tileLeft, int tileTop, int tilePart,
        std::vector<char>& output,
        TileWireId wid, TileWireId oldWid,
        std::mutex &pngMutex)
    {
        // FIXME: why duplicate this ? we could overwrite
        // as we make the delta into an existing cache entry,
        // and just do this as/when there is no entry.
        std::shared_ptr<DeltaData> update =
            dataToDeltaData(wid, pixmap, startX, startY, width, height,
                            tileLeft, tileTop, tilePart,
                            bufferWidth, bufferHeight);

        std::shared_ptr<DeltaData> cacheEntry;

        {
            // protect _deltaEntries
            std::unique_lock<std::mutex> pngLock(pngMutex);

            if (_deltaEntries.size() > 16) // FIXME: hard-coded & not per-view
                _deltaEntries.erase(_deltaEntries.begin());

            for (auto &old : _deltaEntries)
            {
                // FIXME: we badly need to check the size of the tile
                // in case of a match across positions at different zooms ...
                if (old->_left == tileLeft && old->_top == tileTop && old->_part == tilePart)
                {
                    cacheEntry = old;
                    break;
                }
            }
        }

        // no other thread can touch the same tile at the same time.
        if (cacheEntry)
        {
            // zero to force key-frame
            if (oldWid != 0)
            {
                makeDelta(*cacheEntry, *update, output);
                cacheEntry->replace(update);
                return true;
            }
            cacheEntry->replace(update);
            return false;
        }
        else
        {
            // protect _deltaEntries
            std::unique_lock<std::mutex> pngLock(pngMutex);
            _deltaEntries.push_back(update);
        }

        return false;
    }

    /**
     * Compress the relevant pixmap data either to a delta if we can
     * or a plain deflated stream if we cannot.
     */
    void compressOrDelta(
        unsigned char* pixmap, size_t startX, size_t startY,
        int width, int height,
        int bufferWidth, int bufferHeight,
        int tileLeft, int tileTop, int tilePart,
        std::vector<char>& output,
        TileWireId wid, TileWireId oldWid,
        std::mutex &pngMutex)
    {
        if (!createDelta(pixmap, startX, startY, width, height, bufferWidth, bufferHeight,
                         tileLeft, tileTop, tilePart, output, wid, oldWid, pngMutex))
        {
            // FIXME: should stream it in =)


            // FIXME: get sizes right [!] ...
            z_stream zstr;
            memset((void *)&zstr, 0, sizeof (zstr));

            if (deflateInit2 (&zstr, Z_DEFAULT_COMPRESSION, Z_DEFLATED,
                              -MAX_WBITS, 8, Z_DEFAULT_STRATEGY) != Z_OK)
            {
                LOG_ERR("Failed to init deflate");
                return;
            }

            uLong maxCompressed = compressBound(width * height * 4);
            Bytef *compressed = (Bytef *)malloc(maxCompressed);
            if (!compressed)
            {
                LOG_ERR("Failed to allocate buffer of size " << maxCompressed << " to compress into");
                return;
            }

            zstr.next_out = compressed;
            zstr.avail_out = maxCompressed;

            unsigned char fixedupLine[width * 4];

            // FIXME: should we RLE in pixels first ?
            for (int y = 0; y < height; ++y)
            {
                unpremult_copy(fixedupLine, (Bytef *)pixmap + ((startY + y) * bufferWidth * 4) + (startX * 4), width);

                zstr.next_in = fixedupLine;
                zstr.avail_in = width * 4;

                bool lastRow = (y == height - 1);
                int flushFlag = lastRow ? Z_FINISH : Z_NO_FLUSH;
                int expected = lastRow ? Z_STREAM_END : Z_OK;
                if (deflate(&zstr,  flushFlag) != expected)
                {
                    LOG_ERR("failed to compress image ");
                    return;
                }
            }

            deflateEnd(&zstr);

            uLong compSize = maxCompressed - zstr.avail_out;
            LOG_TRC("Compressed image of size " << (width * height * 4) << " to size " << compSize
                    << Util::dumpHex(std::string((char *)compressed, compSize)));

            // FIXME: get zlib to drop it directly into this buffer really.
            output.push_back('Z');
            size_t oldSize = output.size();
            output.resize(oldSize + compSize);
            memcpy(&output[oldSize], compressed, compSize);
            free (compressed);
        }
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
