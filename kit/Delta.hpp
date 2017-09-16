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

#ifdef TILE_WIRE_ID
#  define TILE_WIRE_ID
   typedef uint32_t TileWireId;
#endif

/// A quick and dirty delta generator for last tile changes
class DeltaGenerator {

    struct DeltaData {
        TileWireId _wid;
        std::shared_ptr<std::vector<uint32_t>> _rawData;
    };
    std::vector<DeltaData> _deltaEntries;

    bool makeDelta(
        const DeltaData &prevData,
        const DeltaData &curData,
        std::vector<char>& output)
    {
        std::vector<uint32_t> &prev = *prevData._rawData.get();
        std::vector<uint32_t> &cur = *curData._rawData.get();

        // FIXME: should we split and compress alpha separately ?

        if (prev.size() != cur.size())
        {
            LOG_ERR("mis-sized delta: " << prev.size() << " vs " << cur.size() << "bytes");
            return false;
        }

        output.push_back('D');
        LOG_TRC("building delta of " << prev.size() << "bytes");
        // FIXME: really lame - some RLE might help etc.
        for (size_t i = 0; i < prev.size();)
        {
            int sameCount = 0;
            while (i + sameCount < prev.size() &&
                   prev[i+sameCount] == cur[i+sameCount])
            {
                ++sameCount;
            }
            if (sameCount > 0)
            {
#if 0
                if (sameCount < 64)
                    output.push_back(sameCount);
                else
#endif
                {
                    output.push_back(0x80 | 0x00); // long-same
                    output.push_back(sameCount & 0xff);
                    output.push_back(sameCount >> 8);
                }
                i += sameCount;
                LOG_TRC("identical " << sameCount << "pixels");
            }

            int diffCount = 0;
            while (i + diffCount < prev.size() &&
                   (prev[i+diffCount] != cur[i+diffCount]))
            {
                ++diffCount;
            }

            if (diffCount > 0)
            {
#if 0
                if (diffCount < 64)
                    output.push_back(0x40 & diffCount);
                else
#endif
                {
                    output.push_back(0x80 | 0x40); // long-diff
                    output.push_back(diffCount & 0xff);
                    output.push_back(diffCount >> 8);
                }

                size_t dest = output.size();
                output.resize(dest + diffCount * 4);
                memcpy(&output[dest], &cur[i], diffCount * 4);
                LOG_TRC("different " << diffCount << "pixels");
                i += diffCount;
            }
        }
        return true;
    }

    std::shared_ptr<std::vector<uint32_t>> dataToVector(
        unsigned char* pixmap, size_t startX, size_t startY,
        int width, int height,
        int bufferWidth, int bufferHeight)
    {
        assert (startX + width <= (size_t)bufferWidth);
        assert (startY + height <= (size_t)bufferHeight);

        auto vector = std::make_shared<std::vector<uint32_t>>();
        LOG_TRC("Converting data to vector of size "
                << (width * height * 4) << " width " << width
                << " height " << height);

        vector->resize(width * height);
        for (int y = 0; y < height; ++y)
        {
            size_t position = ((startY + y) * bufferWidth * 4) + (startX * 4);
            memcpy(&(*vector)[y * width], pixmap + position, width * 4);
        }

        return vector;
    }

  public:
    DeltaGenerator() {}

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
        std::vector<char>& output,
        TileWireId wid, TileWireId oldWid)
    {
        // First store a copy for later:
        if (_deltaEntries.size() > 6) // FIXME: hard-coded ...
            _deltaEntries.erase(_deltaEntries.begin());

        // FIXME: assuming width etc. are all constant & so on.
        DeltaData update;
        update._wid = wid;
        update._rawData = dataToVector(pixmap, startX, startY, width, height,
                                       bufferWidth, bufferHeight);
        _deltaEntries.push_back(update);

        for (auto &old : _deltaEntries)
        {
            if (oldWid == old._wid)
                return makeDelta(old, update, output);
        }
        return false;
    }
};

#endif

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
