// -*- Mode: ObjC; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This file is part of the LibreOffice project.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#import "config.h"

#import <cstring>

#include <sal/config.h>

#import "ios.h"
#import "AppDelegate.h"
#import "COAppDocument.hpp"
#import "CODocument.h"
#import "DocumentViewController.h"
#import "Log.hpp"
#import "MobileApp.hpp"
#import "Protocol.hpp"

@implementation CODocument

- (id)contentsForType:(NSString*)typeName error:(NSError **)errorPtr {
    return [NSData dataWithContentsOfFile:[copyFileURL path] options:0 error:errorPtr];
}

// We keep a running count of opening documents here. This is not necessarily in sync with the
// DocBrokerId in DocumentBroker due to potential parallelism when opening multiple documents in
// quick succession.

- (BOOL)loadFromContents:(id)contents ofType:(NSString *)typeName error:(NSError **)errorPtr {

    appDocument = std::make_shared<COAppDocument>(lo_kit, self);

    NSURL *copyFileDirectory = [[NSFileManager.defaultManager temporaryDirectory] URLByAppendingPathComponent:[NSString stringWithFormat:@"%d", appDocument->getAppDocId()]];
    if (![NSFileManager.defaultManager createDirectoryAtURL:copyFileDirectory withIntermediateDirectories:YES attributes:nil error:nil]) {
        LOG_ERR("Could not create directory " << [[copyFileDirectory path] UTF8String]);
        return NO;
    }

    copyFileURL = [copyFileDirectory URLByAppendingPathComponent:[[[self fileURL] path] lastPathComponent]];

    NSError *error;
    [[NSFileManager defaultManager] removeItemAtURL:copyFileURL error:nil];
    [[NSFileManager defaultManager] copyItemAtURL:[self fileURL] toURL:copyFileURL error:&error];
    if (error != nil)
        return NO;

    NSURL *url = [[NSBundle mainBundle] URLForResource:@"loleaflet" withExtension:@"html"];
    NSURLComponents *components = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
    allocateDocumentDataForMobileAppDocId(appDocument->getAppDocId()).coDocument = self;
    components.queryItems = @[ [NSURLQueryItem queryItemWithName:@"file_path" value:[copyFileURL absoluteString]],
                               [NSURLQueryItem queryItemWithName:@"closebutton" value:@"1"],
                               [NSURLQueryItem queryItemWithName:@"permission" value:@"edit"],
                               [NSURLQueryItem queryItemWithName:@"lang" value:app_locale],
                                 [NSURLQueryItem queryItemWithName:@"appdocid" value:[NSString stringWithFormat:@"%u", appDocument->getAppDocId()]],
                             ];

    NSURLRequest *request = [[NSURLRequest alloc]initWithURL:components.URL];
    [self.viewController.webView loadRequest:request];

    return YES;
}

- (void)handleProtocolMessage:(NSString*)message {
    const char *buffer = [message UTF8String];
    int length = strlen(buffer);

    appDocument->handleProtocolMessage(buffer, length);
}

- (void)send2JS:(std::string)string {
    [self send2JS:string.c_str() length:string.size()];
}

- (void)send2JS:(const char *)buffer length:(int)length {
    LOG_ERR("To JS: " << LOOLProtocol::getAbbreviatedMessage(buffer, length).c_str());

    NSString *js;

    const unsigned char *ubufp = (const unsigned char *)buffer;
    std::vector<char> data;
    for (int i = 0; i < length; i++) {
        if (ubufp[i] < ' ' || ubufp[i] == '\'' || ubufp[i] == '\\') {
            data.push_back('\\');
            data.push_back('x');
            data.push_back("0123456789abcdef"[(ubufp[i] >> 4) & 0x0F]);
            data.push_back("0123456789abcdef"[ubufp[i] & 0x0F]);
        } else {
            data.push_back(ubufp[i]);
        }
    }
    data.push_back(0);

    js = @"window.TheFakeWebSocket.onmessage({'data': '";
    js = [js stringByAppendingString:[NSString stringWithUTF8String:data.data()]];
    js = [js stringByAppendingString:@"'});"];

    NSString *subjs = [js substringToIndex:std::min(100ul, js.length)];
    if (subjs.length < js.length)
        subjs = [subjs stringByAppendingString:@"..."];

    dispatch_async(dispatch_get_main_queue(), ^{
            [self.viewController.webView evaluateJavaScript:js
                                          completionHandler:^(id _Nullable obj, NSError * _Nullable error)
                 {
                     if (error) {
                         LOG_ERR("Error after " << [subjs UTF8String] << ": " << [[error localizedDescription] UTF8String]);
                         NSString *jsException = error.userInfo[@"WKJavaScriptExceptionMessage"];
                         if (jsException != nil)
                             LOG_ERR("JavaScript exception: " << [jsException UTF8String]);
                     }
                 }
             ];
        });
}

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
