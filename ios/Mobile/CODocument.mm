// -*- Mode: ObjC; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#import "config.h"

#import <algorithm>

// This is not "external" code in the UNO-based extensions sense. To be able to include
// <comphelper/lok.hxx>, we must #define LIBO_INTERNAL_ONLY.

#define LIBO_INTERNAL_ONLY
#include <sal/config.h>
#include <sal/log.hxx>
#include <rtl/ustring.hxx>
#include <comphelper/lok.hxx>
#include <i18nlangtag/languagetag.hxx>

#import "ios.h"
#import "AppDelegate.h"
#import "CODocument.h"
#import "DocumentViewController.h"

#import "ClientSession.hpp"
#import "DocumentBroker.hpp"
#import "FakeSocket.hpp"
#import "Kit.hpp"
#import "KitHelper.hpp"
#import "Log.hpp"
#import "COOLWSD.hpp"
#import "MobileApp.hpp"
#import "Protocol.hpp"

static inline bool isMessageOfType(const char *message, const char *type, size_t lengthOfMessage) {
    // Note: message is not zero terminated but type is
    size_t typeLen = strlen(type);
    return (typeLen <= lengthOfMessage && !strncmp(message, type, typeLen));
}

@implementation CODocument

- (id)contentsForType:(NSString*)typeName error:(NSError **)errorPtr {
    return [NSData dataWithContentsOfFile:[copyFileURL path] options:0 error:errorPtr];
}

// We keep a running count of opening documents here. This is not necessarily in sync with the
// DocBrokerId in DocumentBroker due to potential parallelism when opening multiple documents in
// quick succession.

static std::atomic<unsigned> appDocIdCounter(1);

- (BOOL)loadFromContents:(id)contents ofType:(NSString *)typeName error:(NSError **)errorPtr {

    // If this method is called a second time on the same CODocument object, just ignore it. This
    // seems to happen occasionally when the device is awakened after sleep. See tdf#122543.
    if (fakeClientFd >= 0)
        return YES;

    fakeClientFd = fakeSocketSocket();

    appDocId = appDocIdCounter++;
    NSURL *copyFileDirectory = [[NSFileManager.defaultManager temporaryDirectory] URLByAppendingPathComponent:[NSString stringWithFormat:@"%d", appDocId]];
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

    NSURL *url = [[NSBundle mainBundle] URLForResource:@"cool" withExtension:@"html"];
    NSURLComponents *components = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
    DocumentData::allocate(appDocId).coDocument = self;
    components.queryItems = @[ [NSURLQueryItem queryItemWithName:@"file_path" value:[copyFileURL absoluteString]],
                               [NSURLQueryItem queryItemWithName:@"closebutton" value:@"1"],
                               [NSURLQueryItem queryItemWithName:@"permission" value:(readOnly ? @"readonly" : @"edit")],
                               [NSURLQueryItem queryItemWithName:@"lang" value:app_locale],
                               [NSURLQueryItem queryItemWithName:@"appdocid" value:[NSString stringWithFormat:@"%u", appDocId]],
                               [NSURLQueryItem queryItemWithName:@"userinterfacemode" value:([[UIDevice currentDevice] userInterfaceIdiom] == UIUserInterfaceIdiomPad ? @"notebookbar" : @"classic")],
                               // Related to issue #5841: the iOS app sets the
                               // base text direction via the "dir" parameter
                               [NSURLQueryItem queryItemWithName:@"dir" value:app_text_direction],
                             ];

    NSURLRequest *request = [[NSURLRequest alloc]initWithURL:components.URL];
    [self.viewController.webView loadRequest:request];

    return YES;
}

- (void)send2JS:(const char *)buffer length:(int)length {
    LOG_TRC("To JS: " << COOLProtocol::getAbbreviatedMessage(buffer, length).c_str());

    const unsigned char *ubufp = (const unsigned char *)buffer;
    std::vector<char> data;
    // Reserve the maxiumum possible length after encoding
    // This avoids an excessive number of reallocations. This is overkill
    // for non-binary messages, but most non-binary messages appear to be
    // under 1K bytes in length. In contrast, it appears that binary
    // messags routinely use at least 75% of the maximum possible length.
    data.reserve((length * 4) + 1);
    bool newlineFound = false;
    bool binaryMessage = (isMessageOfType(buffer, "tile:", length) ||
                          isMessageOfType(buffer, "tilecombine:", length) ||
                          isMessageOfType(buffer, "delta:", length) ||
                          isMessageOfType(buffer, "renderfont:", length) ||
                          isMessageOfType(buffer, "rendersearchlist:", length) ||
                          isMessageOfType(buffer, "windowpaint:", length));

    const char *pretext = "window.TheFakeWebSocket.onmessage({'data': '";
    const int pretextlen = strlen(pretext);
    for (int i = 0; i < pretextlen; i++)
        data.push_back(pretext[i]);

    for (int i = 0; i < length; i++) {
        // Another fix for issue #5843 limit non-ASCII escaping to only
        // certain message types
        if (binaryMessage && !newlineFound && ubufp[i] == '\n')
            newlineFound = true;

        // Fix issue #5843 escape non-ASCII characters only for image data
        // Passing non-ASCII, UTF-8 text from native to JavaScript works
        // fine, but images become corrupted if any non-ASCII bytes are
        // not escaped.
        // The Socket._extractTextImg() JavaScript function assumes that,
        // in the iOS app, the first newline separates text from image data
        // so assume all bytes after the first new line are image data.
        if (ubufp[i] < ' ' || ubufp[i] == '\'' || ubufp[i] == '\\' || (newlineFound && ubufp[i] >= 0x80)) {
            data.push_back('\\');
            data.push_back('x');
            data.push_back("0123456789abcdef"[(ubufp[i] >> 4) & 0x0F]);
            data.push_back("0123456789abcdef"[ubufp[i] & 0x0F]);
        } else {
            data.push_back(ubufp[i]);
        }
    }

    const char *posttext = "'});";
    const int posttextlen = strlen(posttext);
    for (int i = 0; i < posttextlen; i++)
        data.push_back(posttext[i]);

    data.push_back(0);

    // Related to issue #5876: don't autorelease large NSStrings
    // The +[NSString string...] selectors won't be released until
    // an enclosing autorelease pool is released. But since we use
    // ARC, we don't know where the compiler has inserted the
    // autorelease pool so JS messages may not be released until
    // after a very long time potentially causing an out of memory
    // crash. So, use the -[[NSString alloc] init...] selectors
    // instead.
    NSString *js = [[NSString alloc] initWithUTF8String:data.data()];
    if (!js) {
        char outBuf[length + 1];
        memcpy(outBuf, buffer, length);
        outBuf[length] = '\0';
        LOG_ERR("Couldn't create NSString with message: " << outBuf);
        return;
    }

    NSString *subjs = [js substringToIndex:std::min(100ul, js.length)];
    if (subjs.length < js.length)
        subjs = [subjs stringByAppendingString:@"..."];

    // LOG_TRC("Evaluating JavaScript: " << [subjs UTF8String]);

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
