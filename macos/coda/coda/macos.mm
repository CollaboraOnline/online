// -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#include "macos.h"

#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>

const char *user_name = nullptr;

int coolwsd_server_socket_fd = -1;

LibreOfficeKit *lo_kit;

std::string getBundlePath() {
    static std::string bundlePath;
    if (bundlePath.empty()) {
        NSString *path = [[NSBundle mainBundle] bundlePath];
        bundlePath = std::string([path UTF8String]);
    }
    return bundlePath;
}

std::string getResourceURL(const char *name, const char *ext) {
    NSURL *url = [[NSBundle mainBundle] URLForResource:[NSString stringWithUTF8String:name] withExtension:[NSString stringWithUTF8String:ext]];
    return std::string([[url absoluteString] UTF8String]);
}

// vim:set shiftwidth=4 softtabstop=4 expandtab:
