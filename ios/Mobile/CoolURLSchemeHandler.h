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

@interface CoolURLSchemeHandler : NSObject<WKURLSchemeHandler>
{
    NSMutableSet<id<WKURLSchemeTask>> *ongoingTasks;
    CODocument *document;
}

- (id)initWithDocument:(CODocument *)document;
- (std::shared_ptr<DocumentBroker>)getDocumentBroker;
- (std::optional<std::tuple<NSUInteger, NSUInteger, NSUInteger>>)getPositionsAndSizeForRange:(NSString *)range withTotalSize:(NSInteger)size;
@end
