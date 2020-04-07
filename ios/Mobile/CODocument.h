// -*- Mode: ObjC; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This file is part of the LibreOffice project.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#import <string>

#import <UIKit/UIKit.h>

#define LOK_USE_UNSTABLE_API
#import <LibreOfficeKit/LibreOfficeKit.h>

@class DocumentViewController;

@interface CODocument : UIDocument {
@public
    int fakeClientFd;
    NSURL *copyFileURL;
}

@property (weak) DocumentViewController *viewController;

- (void)send2JS:(const char*)buffer length:(int)length;

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
