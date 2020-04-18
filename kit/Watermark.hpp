/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#pragma once

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitInit.h>
#include <LibreOfficeKit/LibreOfficeKit.hxx>
#include <LibreOfficeKit/LibreOfficeKitEnums.h>
#include <vector>
#include <Log.hpp>
#include <cstdlib>
#include <string>
#include "ChildSession.hpp"

class Watermark
{
public:
    Watermark(const std::shared_ptr<lok::Document>& loKitDoc,
              const std::shared_ptr<ChildSession> & session)
        : _loKitDoc(loKitDoc)
        , _text(session->getWatermarkText())
        , _font("Liberation Sans")
        , _width(0)
        , _height(0)
        , _alphaLevel(session->getWatermarkOpacity())
    {
    }

    ~Watermark()
    {
    }

    void blending(unsigned char* tilePixmap,
                   int offsetX, int offsetY,
                   int tilesPixmapWidth, int tilesPixmapHeight,
                   int tileWidth, int tileHeight,
                   LibreOfficeKitTileMode /*mode*/)
    {
        // set requested watermark size a little bit smaller than tile size
        int width = tileWidth * 0.9;
        int height = tileHeight * 0.9;

        const std::vector<unsigned char>* pixmap = getPixmap(width, height);

        if (pixmap && tilePixmap)
        {
            // center watermark
            const int maxX = std::min(tileWidth, _width);
            const int maxY = std::min(tileHeight, _height);
            offsetX += (tileWidth - maxX) / 2;
            offsetY += (tileHeight - maxY) / 2;

            alphaBlend(*pixmap, _width, _height, offsetX, offsetY, tilePixmap, tilesPixmapWidth, tilesPixmapHeight);
        }
    }

private:
    /// Alpha blend pixels from 'from' over the 'to'.
    void alphaBlend(const std::vector<unsigned char>& from, int from_width, int from_height, int from_offset_x, int from_offset_y,
            unsigned char* to, int to_width, int to_height)
    {
        for (int to_y = from_offset_y, from_y = 0; (to_y < to_height) && (from_y < from_height) ; ++to_y, ++from_y)
            for (int to_x = from_offset_x, from_x = 0; (to_x < to_width) && (from_x < from_width); ++to_x, ++from_x)
            {
                unsigned char* t = to + 4 * (to_y * to_width + to_x);

                if (t[3] != 255)
                    continue;

                double dst_r = t[0];
                double dst_g = t[1];
                double dst_b = t[2];
                double dst_a = t[3] / 255.0;

                const unsigned char* f = from.data() + 4 * (from_y * from_width + from_x);
                double src_r = f[0];
                double src_g = f[1];
                double src_b = f[2];
                double src_a = f[3] / 255.0;

                double out_a = src_a + dst_a * (1.0 - src_a);
                unsigned char out_r = src_r + dst_r * (1.0 - src_a);
                unsigned char out_g = src_g + dst_g * (1.0 - src_a);
                unsigned char out_b = src_b + dst_b * (1.0 - src_a);

                t[0] = out_r;
                t[1] = out_g;
                t[2] = out_b;
                t[3] = static_cast<unsigned char>(out_a * 255.0);
            }
    }

    /// Create bitmap that we later use as the watermark for every tile.
    const std::vector<unsigned char>* getPixmap(int width, int height)
    {
        if (!_pixmap.empty() && width == _width && height == _height)
            return &_pixmap;

        _pixmap.clear();

        _width = width;
        _height = height;

        if (!_loKitDoc)
        {
            LOG_ERR("Watermark rendering requested without a valid document.");
            return nullptr;
        }

        // renderFont returns a buffer based on RGBA mode, where r, g, b
        // are always set to 0 (black) and the alpha level is 0 everywhere
        // except on the text area; the alpha level take into account of
        // performing anti-aliasing over the text edges.
        unsigned char* textPixels = _loKitDoc->renderFont(_font.c_str(), _text.c_str(), &_width, &_height, 450);

        if (!textPixels)
        {
            LOG_ERR("Watermark: rendering failed.");
        }

        const unsigned int pixel_count = width * height * 4;

        std::vector<unsigned char> text(textPixels, textPixels + pixel_count);
        // No longer needed.
        std::free(textPixels);

        _pixmap.reserve(pixel_count);

        // Create the white blurred background
        // Use box blur, it's enough for our purposes
        const int r = 2;
        const double weight = (r+1) * (r+1);
        for (int y = 0; y < height; ++y)
        {
            for (int x = 0; x < width; ++x)
            {
                double t = 0;
                for (int ky = std::max(y - r, 0); ky <= std::min(y + r, height - 1); ++ky)
                {
                    for (int kx = std::max(x - r, 0); kx <= std::min(x + r, width - 1); ++kx)
                    {
                        // Pre-multiplied alpha; the text is black, so all the
                        // information is only in the alpha channel
                        t += text[4 * (ky * width + kx) + 3];
                    }
                }

                // Clamp the result.
                double avg = t / weight;
                if (avg > 255.0)
                    avg = 255.0;

                // Pre-multiplied alpha, but use white for the resulting color
                const double alpha = avg / 255.0;
                _pixmap[4 * (y * width + x) + 0] = 0xff * alpha;
                _pixmap[4 * (y * width + x) + 1] = 0xff * alpha;
                _pixmap[4 * (y * width + x) + 2] = 0xff * alpha;
                _pixmap[4 * (y * width + x) + 3] = avg;
            }
        }

        // Now copy the (black) text over the (white) blur
        alphaBlend(text, _width, _height, 0, 0, _pixmap.data(), _width, _height);

        // Make the resulting pixmap semi-transparent
        for (unsigned char* p = _pixmap.data(); p < _pixmap.data() + pixel_count; p++)
        {
            *p = static_cast<unsigned char>(*p * _alphaLevel);
        }

        return &_pixmap;
    }

private:
    std::shared_ptr<lok::Document> _loKitDoc;
    std::string _text;
    std::string _font;
    int _width;
    int _height;
    double _alphaLevel;
    std::vector<unsigned char> _pixmap;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
