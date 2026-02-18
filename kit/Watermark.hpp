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

#define LOK_USE_UNSTABLE_API
#include <LibreOfficeKit/LibreOfficeKitInit.h>
#include <LibreOfficeKit/LibreOfficeKit.hxx>
#include <LibreOfficeKit/LibreOfficeKitEnums.h>
#include <vector>
#include <Log.hpp>
#include <cstdlib>
#include <string>
#include <cmath>
#include <unordered_map>

class Watermark final
{
    struct PixmapData
    {
        std::vector<unsigned char> pixels;
        int width;
        int height;
        PixmapData() : width(0), height(0) {}
        PixmapData(int w, int h) : pixels(w * h * 4), width(w), height(h) {}
    };

public:
    Watermark(const std::shared_ptr<lok::Document>& loKitDoc, const std::string& text,
              double opacity)
        : _loKitDoc(loKitDoc)
        , _text(Util::replace(text, "\\n", "\n"))
        , _font("Carlito")
        , _alphaLevel(opacity)
    {
        if (_loKitDoc == nullptr)
        {
            LOG_ERR("Watermark rendering requested without a valid document. Watermarking will be disabled.");
            assert(_loKitDoc && "Valid loKitDoc is required for Watermark.");
        }
    }

    void blending(unsigned char* tilePixmap,
                   int offsetX, int offsetY,
                   int tilesPixmapWidth, int tilesPixmapHeight,
                   int tileWidth, int tileHeight,
                   LibreOfficeKitTileMode /*mode*/,
                   bool isSlideShowLayer = false)
    {
        // set requested watermark size a little bit smaller than tile size
        const int width = tileWidth * 0.8;
        const int height = tileHeight * 0.8;

        const PixmapData* pmData = getPixmap(width, height);

        if (pmData && tilePixmap)
        {
            // Use actual rendered dimensions for centering and blending
            const int actualWidth = pmData->width;
            const int actualHeight = pmData->height;

            // center watermark
            const int maxX = std::min(tileWidth, actualWidth);
            const int maxY = std::min(tileHeight, actualHeight);
            offsetX += (tileWidth - maxX) / 2;
            offsetY += (tileHeight - maxY) / 2;
            alphaBlend(pmData->pixels, actualWidth, actualHeight, offsetX, offsetY,
                       tilePixmap, tilesPixmapWidth, tilesPixmapHeight,
                       /*isFontBlending*/ false, isSlideShowLayer);
        }
    }

private:
    /// Alpha blend pixels from 'from' over the 'to'.
    void alphaBlend(const std::vector<unsigned char>& from, int from_width, int from_height, int from_offset_x, int from_offset_y,
            unsigned char* to, int to_width, int to_height, const bool isFontBlending, bool isSlideShowLayer = false)
    {
        bool isCalc = (_loKitDoc->getDocumentType() == LOK_DOCTYPE_SPREADSHEET);
        for (int to_y = from_offset_y, from_y = 0; (to_y < to_height) && (from_y < from_height) ; ++to_y, ++from_y)
            for (int to_x = from_offset_x, from_x = 0; (to_x < to_width) && (from_x < from_width); ++to_x, ++from_x)
            {
                unsigned char* t = to + 4 * (to_y * to_width + to_x);

                const bool isTransparentBackground = isSlideShowLayer && t[3] == 0;
                if (!isFontBlending && !isCalc && t[3] != 255 && !isTransparentBackground)
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
                if (isTransparentBackground)
                    out_a /= 8;
                unsigned char out_r = src_r + dst_r * (1.0 - src_a);
                unsigned char out_g = src_g + dst_g * (1.0 - src_a);
                unsigned char out_b = src_b + dst_b * (1.0 - src_a);

                t[0] = out_r;
                t[1] = out_g;
                t[2] = out_b;
                t[3] = static_cast<unsigned char>(out_a * 255.0);
            }
    }

    /// Render multi-line watermark text by rendering each line separately
    /// and composing them with proper inter-line spacing.
    /// Sets width and height to the actual composed pixmap dimensions.
    std::vector<unsigned char> renderMultiLineText(int& width, int& height)
    {
        // Split text into non-empty lines
        std::vector<std::string> lines;
        std::string::size_type start = 0;
        std::string::size_type pos;
        while ((pos = _text.find('\n', start)) != std::string::npos)
        {
            std::string line = _text.substr(start, pos - start);
            if (!line.empty())
                lines.push_back(std::move(line));
            start = pos + 1;
        }
        if (start < _text.size())
            lines.push_back(_text.substr(start));

        if (lines.empty())
            return {};

        // Render each line separately at natural size (width=0, height=0
        // triggers default font size) so that all lines share the same
        // font metrics and the spacing between them is not compressed.
        struct LinePixmap
        {
            std::vector<unsigned char> pixels;
            int width;
            int height;
        };
        std::vector<LinePixmap> rendered;
        int maxWidth = 0;
        int totalHeight = 0;
        int lineSpacing = 0;

        for (const auto& line : lines)
        {
            int w = 0, h = 0;
            unsigned char* px = _loKitDoc->renderFont(_font.c_str(), line.c_str(), &w, &h, 0);
            if (!px || w <= 0 || h <= 0)
            {
                std::free(px);
                continue;
            }
            rendered.push_back({
                std::vector<unsigned char>(px, px + w * h * 4), w, h
            });
            std::free(px);

            maxWidth = std::max(maxWidth, w);
            totalHeight += h;
            if (lineSpacing == 0)
                lineSpacing = std::max(1, static_cast<int>(h * 0.4));
        }

        if (rendered.empty())
            return {};

        // Add inter-line spacing
        totalHeight += lineSpacing * (static_cast<int>(rendered.size()) - 1);

        // Compose all lines into a single RGBA bitmap
        width = maxWidth;
        height = totalHeight;
        std::vector<unsigned char> result(width * height * 4, 0);

        int yOffset = 0;
        for (const auto& rl : rendered)
        {
            for (int y = 0; y < rl.height && (y + yOffset) < height; ++y)
            {
                const int copyWidth = std::min(rl.width, width);
                for (int x = 0; x < copyWidth; ++x)
                {
                    const int srcIdx = (y * rl.width + x) * 4;
                    const int dstIdx = ((y + yOffset) * width + x) * 4;
                    result[dstIdx + 0] = rl.pixels[srcIdx + 0];
                    result[dstIdx + 1] = rl.pixels[srcIdx + 1];
                    result[dstIdx + 2] = rl.pixels[srcIdx + 2];
                    result[dstIdx + 3] = rl.pixels[srcIdx + 3];
                }
            }
            yOffset += rl.height + lineSpacing;
        }

        return result;
    }

    /// Create bitmap that we later use as the watermark for every tile.
    const PixmapData* getPixmap(int width, int height)
    {
        if (_loKitDoc == nullptr)
        {
            return nullptr;
        }

        const size_t key = width + height * 10000;

        auto it = _pixmaps.find(key);
        if (it != _pixmaps.end())
        {
            return &it->second;
        }

        // renderFont returns a buffer based on RGBA mode, where r, g, b
        // are always set to 0 (black) and the alpha level is 0 everywhere
        // except on the text area; the alpha level take into account of
        // performing anti-aliasing over the text edges.
        std::vector<unsigned char> text;
        if (_text.find('\n') != std::string::npos)
        {
            // Multi-line: render each line separately for proper spacing.
            // Passing the full multi-line string to renderFont squeezes all
            // lines into a constrained area with insufficient line spacing.
            text = renderMultiLineText(width, height);
        }
        else
        {
            // Single-line: use renderFont directly with size constraints.
            unsigned char* textPixels = _loKitDoc->renderFont(_font.c_str(), _text.c_str(), &width, &height, 0);
            if (textPixels)
            {
                text.assign(textPixels, textPixels + width * height * 4);
                std::free(textPixels);
            }
        }

        if (text.empty())
        {
            LOG_ERR("Watermark: rendering failed.");
            return nullptr;
        }

        const unsigned int pixel_count = width * height * 4;

        _pixmaps.emplace(key, PixmapData(width, height));
        PixmapData& pmData = _pixmaps[key];
        std::vector<unsigned char>& _pixmap = pmData.pixels;

        /*
            apply 2d rotation transformation (counter-clockwise):
            | cos(a) -sin(a) |  | x |
            | sin(a)  cos(a) |  | y |
        */
        // Create the white blurred background
        // Use box blur, it's enough for our purposes

        // PI / 4 (45 degrees): sin = cos = 1/sqrt(2)
        const double sin = 0.707106781186547524;
        const double cos = sin;

        const double x0 = width / 2.0;
        const double y0 = height / 2.0;

        std::vector<unsigned char> _rotatedText(pixel_count);

        const int r = 2;
        const double weight = (r+1) * (r+1);
        for (int y = 0; y < height; ++y)
        {
            for (int x = 0; x < width; ++x)
            {
                // move origin to the center
                const double fx = x - x0;
                const double fy = y - y0;
                const int rX = (fx * cos) - (fy * sin) + x0;
                const int rY = (fx * sin) + (fy * cos) + y0;
                const unsigned int pos = 4 * (rY * width + rX);
                if (rX >= 0 && rX <= width && rY >= 0 && rY <= height && pos < text.size())
                {
                    unsigned char* p = text.data() + 4 * (rY * width + rX);
                    _rotatedText[4 * (y * width + x) + 0] = p[0];
                    _rotatedText[4 * (y * width + x) + 1] = p[1];
                    _rotatedText[4 * (y * width + x) + 2] = p[2];
                    _rotatedText[4 * (y * width + x) + 3] = p[3];
                }
                else
                {
                    _rotatedText[4 * (y * width + x) + 0] = 0.0;
                    _rotatedText[4 * (y * width + x) + 1] = 0.0;
                    _rotatedText[4 * (y * width + x) + 2] = 0.0;
                    _rotatedText[4 * (y * width + x) + 3] = 0.0;
                }

                double t = 0;
                for (int ky = std::max(rY - r, 0); ky <= std::min(rY + r, height - 1); ++ky)
                {
                    for (int kx = std::max(rX - r, 0); kx <= std::min(rX + r, width - 1); ++kx)
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
        alphaBlend(_rotatedText, width, height, 0, 0, _pixmap.data(), width, height, true);

        // Make the resulting pixmap semi-transparent
        for (unsigned char* p = _pixmap.data(); p < _pixmap.data() + pixel_count; p++)
        {
            *p = static_cast<unsigned char>(*p * _alphaLevel);
        }

        return &pmData;
    }

private:
    const std::shared_ptr<lok::Document> _loKitDoc;
    const std::string _text;
    const std::string _font;
    const double _alphaLevel;
    std::unordered_map<size_t, PixmapData> _pixmaps;
};

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
