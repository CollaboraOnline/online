// -*- Mode: ObjC; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#import <Foundation/NSObject.h>

#define LOK_USE_UNSTABLE_API
#import <LibreOfficeKit/LibreOfficeKit.h>

@class WKWebView;

@interface CODocument : NSObject {
@public
    int fakeClientFd;
    bool readOnly;
}

@property NSURL *fileURL;
@property unsigned appDocId;
@property (weak) WKWebView *webView;

/** Custom initializer */
- (instancetype)initWithWebView:(WKWebView *)webView fileURL:(NSURL *)fileURL readOnly:(bool)readOnly;

- (void)send2JS:(const char*)buffer length:(size_t)length;

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
