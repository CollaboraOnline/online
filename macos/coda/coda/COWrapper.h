/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@class Document;

@interface COWrapper : NSObject {
}

+ (void)startServer;
+ (void)stopServer;

+ (void)handleHULLOWithDocument:(Document *)document;
+ (void)handleMessageWith:(Document *)document message:(NSString *)message;
+ (void)saveAsWith:(Document *)document url:(NSString *)url format:(NSString *)format filterOptions:(NSString *)filterOptions;

+ (int)generateNewAppDocId;
+ (int)fakeSocketSocket;

+ (void)LOG_DBG:(NSString *)message NS_SWIFT_NAME(LOG_DBG(_:));
+ (void)LOG_ERR:(NSString *)message NS_SWIFT_NAME(LOG_ERR(_:));
+ (void)LOG_TRC:(NSString *)message NS_SWIFT_NAME(LOG_TRC(_:));

@end
