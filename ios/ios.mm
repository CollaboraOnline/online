// -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This file is part of the LibreOffice project.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#include <cstring>

#import <Foundation/Foundation.h>

extern "C" {
#import <native-code.h>
}

const char* getCacheDir()
{
    static NSString *cachePath = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES) objectAtIndex:0];
    static const char* result = strdup([cachePath UTF8String]);

    return result;
}

// vim:set shiftwidth=4 softtabstop=4 expandtab:
