// -*- Mode: ObjC; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This file is part of the LibreOffice project.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#import "config.h"

#import <algorithm>

#import "ios.h"
#import "AppDelegate.h"
#import "Document.h"
#import "DocumentViewController.h"

#import "ClientSession.hpp"
#import "DocumentBroker.hpp"
#import "FakeSocket.hpp"
#import "Kit.hpp"
#import "KitHelper.hpp"
#import "Log.hpp"
#import "LOOLWSD.hpp"
#import "Protocol.hpp"

@implementation Document

- (id)contentsForType:(NSString*)typeName error:(NSError **)errorPtr {
    // Encode your document with an instance of NSData or NSFileWrapper
    return [[NSData alloc] init];
}

- (BOOL)loadFromContents:(id)contents ofType:(NSString *)typeName error:(NSError **)errorPtr {
    fakeClientFd = fakeSocketSocket();
    uri = [[[self fileURL] absoluteString] UTF8String];

    NSURL *url = [[NSBundle mainBundle] URLForResource:@"loleaflet" withExtension:@"html"];
    NSURLComponents *components = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
    components.queryItems = @[ [NSURLQueryItem queryItemWithName:@"file_path" value:[NSString stringWithUTF8String:uri.c_str()]],
                               [NSURLQueryItem queryItemWithName:@"closebutton" value:@"1"],
                               [NSURLQueryItem queryItemWithName:@"permission" value:@"edit"]];
    NSURLRequest *request = [[NSURLRequest alloc]initWithURL:components.URL];
    [self.viewController.webView loadRequest:request];

    return YES;
}

- (void)send2JS:(const char *)buffer length:(int)length {
    NSLog(@"send to JS: %s", LOOLProtocol::getAbbreviatedMessage(buffer, length).c_str());

    NSString *js;

    // Check if the message is binary. We say that any message that isn't just a single line is
    // "binary" even if that strictly speaking isn't the case; for instance the commandvalues:
    // message has a long bunch of non-binary JSON on multiple lines. But _onMessage() in Socket.js
    // handles it fine even if such a message, too, comes in as an ArrayBuffer. (Look for the
    // "textMsg = String.fromCharCode.apply(null, imgBytes);".)

    const char *newline = (const char *)memchr(buffer, '\n', length);
    if (newline != nullptr) {
        // The data needs to be an ArrayBuffer
        js = @"window.TheFakeWebSocket.onmessage({'data': Base64ToArrayBuffer('";
        js = [js stringByAppendingString: [[NSData dataWithBytes:buffer length:length] base64EncodedStringWithOptions:0]];
        js = [js stringByAppendingString:@"')});"];
        NSString *subjs = [js substringToIndex:std::min(40ul, js.length)];

        // NSLog(@"Evaluating JavaScript: %@ (length %lu)", subjs, (unsigned long)js.length);

        dispatch_async(dispatch_get_main_queue(), ^{
                [self.viewController.webView evaluateJavaScript:js
                                              completionHandler:^(id _Nullable obj, NSError * _Nullable error)
                     {
                         if (error) {
                             NSLog(@"error after %@ (length %lu): %@", subjs, (unsigned long)js.length, error.localizedDescription);
                         }
                     }
                 ];
        });
    } else {
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

        // NSLog(@"Evaluating JavaScript: %@", js);

        dispatch_async(dispatch_get_main_queue(), ^{
                [self.viewController.webView evaluateJavaScript:js
                                              completionHandler:^(id _Nullable obj, NSError * _Nullable error)
                     {
                         if (error) {
                             NSLog(@"error after %@: %@: %@", js, error.localizedDescription, error.userInfo[@"WKJavaScriptExceptionMessage"]);
                         }
                     }
                 ];
            });
    }
}

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
