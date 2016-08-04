/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* cairo - a vector graphics library with display and print output
 *
 * Copyright © 2003 University of Southern California
 *
 * This library is free software; you can redistribute it and/or
 * modify it either under the terms of the GNU Lesser General Public
 * License version 2.1 as published by the Free Software Foundation
 * (the "LGPL") or, at your option, under the terms of the Mozilla
 * Public License Version 1.1 (the "MPL"). If you do not alter this
 * notice, a recipient may use your version of this file under either
 * the MPL or the LGPL.
 *
 * You should have received a copy of the LGPL along with this library
 * in the file COPYING-LGPL-2.1; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Suite 500, Boston, MA 02110-1335, USA
 * You should have received a copy of the MPL along with this library
 * in the file COPYING-MPL-1.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * This software is distributed on an "AS IS" basis, WITHOUT WARRANTY
 * OF ANY KIND, either express or implied. See the LGPL or the MPL for
 * the specific language governing rights and limitations.
 *
 * The Original Code is the cairo graphics library.
 *
 * The Initial Developer of the Original Code is University of Southern
 * California.
 *
 * Contributor(s):
 *        Carl D. Worth <cworth@cworth.org>
 *        Kristian Høgsberg <krh@redhat.com>
 *        Chris Wilson <chris@chris-wilson.co.uk>
 */

#define PNG_SKIP_SETJMP_CHECK
#include <png.h>

namespace png
{

// Callback functions for libpng
extern "C"
{
    static void user_write_status_fn(png_structp, png_uint_32, int)
    {
    }

    static void user_write_fn(png_structp png_ptr, png_bytep data, png_size_t length)
    {
        std::vector<char> *outputp = (std::vector<char> *) png_get_io_ptr(png_ptr);
        const size_t oldsize = outputp->size();
        outputp->resize(oldsize + length);
        std::memcpy(outputp->data() + oldsize, data, length);
    }

    static void user_flush_fn(png_structp)
    {
    }
}


/* Unpremultiplies data and converts native endian ARGB => RGBA bytes */
static void
unpremultiply_data (png_structp /*png*/, png_row_infop row_info, png_bytep data)
{
    unsigned int i;

    for (i = 0; i < row_info->rowbytes; i += 4)
    {
        uint8_t *b = &data[i];
        uint32_t pixel;
        uint8_t  alpha;

        memcpy (&pixel, b, sizeof (uint32_t));
        alpha = (pixel & 0xff000000) >> 24;
        if (alpha == 0)
        {
            b[0] = b[1] = b[2] = b[3] = 0;
        }
        else
        {
            b[0] = (((pixel & 0xff0000) >> 16) * 255 + alpha / 2) / alpha;
            b[1] = (((pixel & 0x00ff00) >>  8) * 255 + alpha / 2) / alpha;
            b[2] = (((pixel & 0x0000ff) >>  0) * 255 + alpha / 2) / alpha;
            b[3] = alpha;
        }
    }
}

// Sadly, older libpng headers don't use const for the pixmap pointer parameter to
// png_write_row(), so can't use const here for pixmap.
inline
bool encodeSubBufferToPNG(unsigned char* pixmap, size_t startX, size_t startY,
                          int width, int height,
                          int bufferWidth, int bufferHeight,
                          std::vector<char>& output, LibreOfficeKitTileMode mode)
{
    if (bufferWidth < width || bufferHeight < height)
    {
        return false;
    }

    png_structp png_ptr = png_create_write_struct(PNG_LIBPNG_VER_STRING, nullptr, nullptr, nullptr);

    png_infop info_ptr = png_create_info_struct(png_ptr);

    if (setjmp(png_jmpbuf(png_ptr)))
    {
        png_destroy_write_struct(&png_ptr, nullptr);
        return false;
    }

    png_set_IHDR(png_ptr, info_ptr, width, height, 8, PNG_COLOR_TYPE_RGB_ALPHA, PNG_INTERLACE_NONE, PNG_COMPRESSION_TYPE_DEFAULT, PNG_FILTER_TYPE_DEFAULT);

    png_set_write_fn(png_ptr, &output, user_write_fn, user_flush_fn);
    png_set_write_status_fn(png_ptr, user_write_status_fn);

    png_write_info(png_ptr, info_ptr);

    if (mode == LOK_TILEMODE_BGRA)
    {
        png_set_write_user_transform_fn (png_ptr, unpremultiply_data);
    }

    for (int y = 0; y < height; ++y)
    {
        size_t position = ((startY + y) * bufferWidth * 4) + (startX * 4);
        png_write_row(png_ptr, pixmap + position);
    }

    png_write_end(png_ptr, info_ptr);

    png_destroy_write_struct(&png_ptr, &info_ptr);

    return true;
}

inline
bool encodeBufferToPNG(unsigned char* pixmap, int width, int height,
                       std::vector<char>& output, LibreOfficeKitTileMode mode)
{
    return encodeSubBufferToPNG(pixmap, 0, 0, width, height, width, height, output, mode);
}

}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
