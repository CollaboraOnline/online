/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
#ifndef INCLUDED_DELTA_HPP
#define INCLUDED_DELTA_HPP

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
        uint64_t _crc;
        std::vector<uint32_t> _pixels;

        bool identical(const DeltaBitmapRow &other) const
        {
            if (_crc != other._crc)
                return false;
            return _pixels == other._pixels;
        }
    };

    struct DeltaData {
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
        if (prev._width != cur._width || prev._height != cur._height)
        {
            LOG_ERR("mis-sized delta: " << prev._width << "x" << prev._height << " vs "
                    << cur._width << "x" << cur._height);
            return false;
        }

        output.push_back('D');
        LOG_TRC("building delta of a " << cur._width << "x" << cur._height << " bitmap");

        // row move/copy src/dest is a byte.
        assert (prev._height <= 256);
        // column position is a byte.
        assert (prev._width <= 256);

        // How do the rows look against each other ?
        size_t lastMatchOffset = 0;
        for (int y = 0; y < prev._height; ++y)
        {
            // Life is good where rows match:
            if (prev._rows[y].identical(cur._rows[y]))
                continue;

            // Hunt for other rows
            bool matched = false;
            for (int yn = 0; yn < prev._height && !matched; ++yn)
            {
                size_t match = (y + lastMatchOffset + yn) % prev._height;
                if (prev._rows[match].identical(cur._rows[y]))
                {
                    // TODO: if offsets are >256 - use 16bits?

                    // hopefully find blocks of this.
                    lastMatchOffset = match - y;
                    output.push_back('c'); // copy-row
                    output.push_back(match); // src
                    output.push_back(y); // dest
                    matched = true;
                    continue;
                }
            }
            if (matched)
                continue;

            // Our row is just that different:
            const DeltaBitmapRow &curRow = cur._rows[y];
            const DeltaBitmapRow &prevRow = prev._rows[y];
            for (int x = 0; x < prev._width;)
            {
                int same;
                for (same = 0; same + x < prev._width &&
                         prevRow._pixels[x+same] == curRow._pixels[x+same];)
                    ++same;

                x += same;

                int diff;
                for (diff = 0; diff + x < prev._width &&
                         (prevRow._pixels[x+diff] == curRow._pixels[x+diff] || diff < 2) &&
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
                    memcpy(&output[dest], &curRow._pixels[x], diff * 4);

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
        data->_wid = wid;

        assert (startX + width <= (size_t)bufferWidth);
        assert (startY + height <= (size_t)bufferHeight);

        LOG_TRC("Converting pixel data to delta data of size "
                << (width * height * 4) << " width " << width
                << " height " << height);

        data->_width = width;
        data->_height = height;
        data->_rows.resize(height);
        for (int y = 0; y < height; ++y)
        {
            DeltaBitmapRow &row = data->_rows[y];
            size_t position = ((startY + y) * bufferWidth * 4) + (startX * 4);
            int32_t *src = reinterpret_cast<int32_t *>(pixmap + position);

            // We get the hash ~for free as we copy - with a cheap hash.
            uint64_t crc = 0x7fffffff - 1;
            row._pixels.resize(width);
            for (int x = 0; x < width; ++x)
            {
                crc = (crc << 7) + crc + src[x];
                row._pixels[x] = src[x];
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
            if (oldWid == old->_wid)
                return makeDelta(*old, *update, output);
        }
        return false;
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
