// -*- Mode: ObjC; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

#import "CODocument.h"

@interface DocumentViewController : UIViewController

@property (strong) CODocument *document;
@property (strong) WKWebView *webView;
@property (strong) WKWebView *slideshowWebView;
@property std::string slideshowFile;
@property (strong) NSURL *slideshowURL;

- (void)bye;

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
