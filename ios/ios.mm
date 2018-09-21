// -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This file is part of the LibreOffice project.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#include <cstring>

#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>

extern "C" {
#import <native-code.h>
}

int loolwsd_server_socket_fd = -1;

static thread_local CGContextRef cgc = nullptr;

const char* lo_ios_app_getCacheDir()
{
    static NSString *cachePath = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES) objectAtIndex:0];
    static const char* result = strdup([cachePath UTF8String]);

    return result;
}

extern unsigned char *lo_ios_app_get_cgcontext_for_buffer(unsigned char *buffer, int width, int height)
{
    assert(cgc == nullptr);

    cgc = CGBitmapContextCreate(buffer, width, height, 8, width*4, CGColorSpaceCreateDeviceRGB(), kCGImageAlphaNoneSkipFirst);

#if 0
    // Do we need to turn the coordinate system upside down, or not? Unclear yet whether this is
    // taken care of in LO core or not. Anyway, with or without this, I still at the moment get no
    // contents rendered in the tiles.
    CGContextTranslateCTM(cgc, 0, height);
    CGContextScaleCTM(cgc, 1, -1);
#endif

    return (unsigned char*)cgc;
}

extern void lo_ios_app_release_cgcontext_for_buffer()
{
    assert(cgc != nullptr);
    CGContextRelease(cgc);
    cgc = nullptr;
}

// vim:set shiftwidth=4 softtabstop=4 expandtab:
