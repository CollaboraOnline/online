/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#include <vector>
#include <assert.h>
#include <Log.hpp>

#ifndef TILE_WIRE_ID
#  define TILE_WIRE_ID
   typedef uint32_t TileWireId;
#endif

/// A quick and dirty delta generator for last tile changes
class DeltaGenerator {

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

        const std::vector<DeltaBitmapRow>& getRows() const
        {
            return _rows;
        }

        std::vector<DeltaBitmapRow>& getRows()
        {
            return _rows;
        }

    private:
        TileWireId _wid;
        int _width;
        int _height;
        std::vector<DeltaBitmapRow> _rows;
    };
    std::vector<std::shared_ptr<DeltaData>> _deltaEntries;

    bool makeDelta(
        const DeltaData &prev,
        const DeltaData &cur,
        std::vector<char>& output)
    {
        // TODO: should we split and compress alpha separately ?
        if (prev.getWidth() != cur.getWidth() || prev.getHeight() != cur.getHeight())
        {
            LOG_ERR("mis-sized delta: " << prev.getWidth() << "x" << prev.getHeight() << " vs "
                    << cur.getWidth() << "x" << cur.getHeight());
            return false;
        }

        output.push_back('D');
        LOG_TRC("building delta of a " << cur.getWidth() << "x" << cur.getHeight() << " bitmap");

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
                         (prevRow.getPixels()[x+diff] == curRow.getPixels()[x+diff] || diff < 2) &&
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
                    memcpy(&output[dest], &curRow.getPixels()[x], diff * 4);

                    LOG_TRC("different " << diff << "pixels");
                    x += diff;
                }
            }
        }

        return true;
    }

    std::shared_ptr<DeltaData> dataToDeltaData(
        TileWireId wid,
        unsigned char* pixmap, size_t startX, size_t startY,
        int width, int height,
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

        data->setWidth(width);
        data->setHeight(height);
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
        std::vector<char>& output,
        TileWireId wid, TileWireId oldWid)
    {
        // First store a copy for later:
        if (_deltaEntries.size() > 6) // FIXME: hard-coded ...
            _deltaEntries.erase(_deltaEntries.begin());

        std::shared_ptr<DeltaData> update =
            dataToDeltaData(wid, pixmap, startX, startY, width, height,
                            bufferWidth, bufferHeight);
        _deltaEntries.push_back(update);

        for (auto &old : _deltaEntries)
        {
            if (oldWid == old->getWid())
                return makeDelta(*old, *update, output);
        }
        return false;
    }
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
