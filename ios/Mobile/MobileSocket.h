// -*- Mode: objc; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#import "ios.h"
#import <Foundation/NSObject.h>

#import <WebKit/WKURLSchemeTask.h>
#import <WebKit/WKURLSchemeHandler.h>

#import "CODocument.h"

#import <wsd/DocumentBroker.hpp>

@interface MobileSocket : NSObject
- (void)open:(id<WKURLSchemeTask>)urlSchemeTask;
- (void)write:(id<WKURLSchemeTask>)urlSchemeTask onFinish:(void (^)(void))callback;

- (void)queueSend:(std::string)message then:(void (^)(void))callback;

- (void)stopURLSchemeTask:(id<WKURLSchemeTask>)urlSchemeTask;
@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
