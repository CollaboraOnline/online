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

+ (void)handleHULLOWithDocument:(Document *_Nonnull)document;
+ (void)handleMessageWith:(Document *_Nonnull)document message:(NSString *_Nonnull)message;
+ (void)saveAsWith:(Document *_Nonnull)document url:(NSString *_Nonnull)url format:(NSString *_Nonnull)format filterOptions:(NSString *_Nullable)filterOptions;
+ (NSArray<id<NSPasteboardWriting>> * _Nullable) getClipboardWith:(Document *_Nonnull)document NS_SWIFT_NAME(getClipboard(_:));

+ (int)generateNewAppDocId;
+ (int)fakeSocketSocket;

+ (void)LOG_DBG:(NSString *_Nonnull)message NS_SWIFT_NAME(LOG_DBG(_:));
+ (void)LOG_ERR:(NSString *_Nonnull)message NS_SWIFT_NAME(LOG_ERR(_:));
+ (void)LOG_TRC:(NSString *_Nonnull)message NS_SWIFT_NAME(LOG_TRC(_:));

@end
