// -*- Mode: ObjC; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This file is part of the LibreOffice project.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#import "config.h"

#import "AppDelegate.h"
#import "Document.h"
#import "DocumentViewController.h"

#import "Kit.hpp"
#import "KitHelper.hpp"
#import "Log.hpp"
#import "Protocol.hpp"

@implementation Document

// https://github.com/google/google-api-cpp-client/blob/master/src/googleapis/strings/memutil.cc,
// Apache licensed

static size_t memspn(const char* s, size_t slen, const char* accept) {
  const char* p = s;
  const char* spanp;
  char c, sc;

cont:
  c = *p++;
  if (slen-- == 0) return p - 1 - s;
  for (spanp = accept; (sc = *spanp++) != '\0';)
    if (sc == c) goto cont;
  return p - 1 - s;
}

static const char* setupSafeNonBinaryCharSpan()
{
    static char result[256];

    memset(result, 0, 256);
    char *p = result;
    for (char c = ' '; c <= '~'; c++)
        if (c != '\'' && c != '\\')
            *p++ = c;
    return result;
}

static void send2JS(const char *buffer, int length, void *data)
{
    Document *doc = (__bridge Document*) data;
    [doc send2JS:buffer length:length];
}

- (id)contentsForType:(NSString*)typeName error:(NSError **)errorPtr {
    // Encode your document with an instance of NSData or NSFileWrapper
    return [[NSData alloc] init];
}

- (BOOL)loadFromContents:(id)contents ofType:(NSString *)typeName error:(NSError **)errorPtr {
    Log::initialize("", "trace", false, false, {});

    bridge.registerJSSender(send2JS, (__bridge void*) self);

    dispatch_async(dispatch_get_global_queue( DISPATCH_QUEUE_PRIORITY_DEFAULT, 0),
                   ^{
                       lokit_main(std::string([[[self fileURL] absoluteString] UTF8String]), self->bridge);
                   });

    return YES;
}

- (void)send2JS:(const char *)buffer length:(int)length {
    NSLog(@"send to JS: %s", LOOLProtocol::getAbbreviatedMessage(buffer, length).c_str());

    static const char * const safeChar = setupSafeNonBinaryCharSpan();

    NSString *js;
    // Check if the message is non-binary and doesn't contain any single quotes or backslashes either.

    // Yes, this doesn't accept non-ASCII UTF-8 sequences even if they would be perfectly fine. I
    // think we don't send any such to this, though?

    if (memspn(buffer, length, safeChar) == length) {
        js = @"window.TheFakeWebSocket.onmessage({'data': '";
        js = [js stringByAppendingString: [NSString stringWithCString:buffer encoding:NSASCIIStringEncoding]];
        js = [js stringByAppendingString:@"'});"];
        dispatch_async(dispatch_get_main_queue(), ^{
                [self.viewController.webView evaluateJavaScript:js
                                              completionHandler:^(id _Nullable obj, NSError * _Nullable error)
                     {
                         if (error) {
                             NSLog(@"name = %@ error = %@",@"", error.localizedDescription);
                         }
                     }
                 ];
            });
    } else {
        js = @"window.TheFakeWebSocket.onmessage({'data': atob('";
        js = [js stringByAppendingString: [[NSData dataWithBytes:buffer length:length] base64EncodedStringWithOptions:0]];
        js = [js stringByAppendingString:@"')});"];
        dispatch_async(dispatch_get_main_queue(), ^{
                [self.viewController.webView evaluateJavaScript:js
                                              completionHandler:^(id _Nullable obj, NSError * _Nullable error)
                     {
                         if (error) {
                             NSLog(@"name = %@ error = %@",@"", error.localizedDescription);
                         }
                     }
                 ];
            });
    }
}

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
