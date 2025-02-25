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

#import "config.h"

#import "CoolURLSchemeHandler.h"

#import "MobileApp.hpp"

#import <Foundation/NSSet.h>
#import <Foundation/NSURL.h>
#import <Foundation/NSURLResponse.h>

#import <Foundation/NSString.h>

#import <Poco/URI.h>

#import <wsd/DocumentBroker.hpp>

@implementation CoolURLSchemeHandler
- (id)initWithDocument:(CODocument *)document {
    self->document = document;
    self->ongoingTasks = [[NSMutableSet alloc] init];
    return self;
}

- (std::shared_ptr<DocumentBroker>)getDocumentBroker {
    std::weak_ptr<DocumentBroker> docBroker = DocumentData::get(document->appDocId).docBroker;
    
    return docBroker.lock();
}


- (std::optional<std::tuple<NSUInteger, NSUInteger, NSUInteger>>)getPositionsAndSizeForRange:(NSString *)range withTotalSize:(NSInteger)size {
    if ([range containsString:@","]) {
        return std::nullopt; // We do not provide multiple-range support
    }
    
    if (![range hasPrefix:@"bytes="]) {
        return std::nullopt; // Malformed range request - at time of writing bytes is the only valid type
    }
    
    NSString * unprefixedRange = [range substringFromIndex:[@"bytes=" length]];
    NSArray * rangeComponents = [unprefixedRange componentsSeparatedByString:@"-"];
    
    if ([rangeComponents count] != 2) {
        return std::nullopt; // Malformed range request - does not contain exactly 1 dash
    }
    
    // Yes, this lets through some malformed range requests if one side has a string and the other an integer - e.g. 'bytes=three-70' ... but I'm not sure I really mind
    // The other issues were all about things that would make it impossible to parse... treating non-numbers as the empty-string seems benign and easier to let it slip through
    // We can't use NSIntegers as they aren't nullable - we would get 0 instead... this rounds decimals, again fairly benign in my opinion
    NSNumberFormatter * formatter = [[NSNumberFormatter alloc] init];
    formatter.numberStyle = NSNumberFormatterStyle::NSNumberFormatterNoStyle;

    NSNumber * left = [formatter numberFromString:[rangeComponents firstObject]];
    NSNumber * right = [formatter numberFromString:[rangeComponents lastObject]];
    
    if (left == nil && right == nil) {
        return std::nullopt; // Malformed range request - at most one side can be empty
    }
    
    if (left == nil) {
        // Number is "-foo", specifying bytes before the end
        NSUInteger start = size - [right unsignedIntegerValue];
        NSUInteger end = size - 1;
        
        if (start < 0) {
            return std::nullopt; // Invalid range - too long
        }
        
        return std::make_optional(std::make_tuple(start, end, [right integerValue]));
    }
    
    if (right == nil) {
        // Number is "foo-", specifying a start position and asking for bytes until the end
        NSUInteger start = [left unsignedIntegerValue];
        NSUInteger end = size - 1;
        
        if (start > end) {
            return std::nullopt; // Invalid range - negative size
        }
        
        return std::make_optional(std::make_tuple(start, end, end - start + 1));
    }
    
    NSUInteger start = [left unsignedIntegerValue];
    NSUInteger end = [right unsignedIntegerValue];
    
    if (start > end) {
        return std::nullopt; // Invalid range - negative size
    }
    
    if (end >= size) {
        return std::nullopt; // Invalid range - out of bounds
    }
    
    return std::make_optional(std::make_tuple(start, end, end - start + 1));
}

- (void)webView:(WKWebView *)webView startURLSchemeTask:(id<WKURLSchemeTask>)urlSchemeTask {
    [ongoingTasks addObject:urlSchemeTask];
    
    // Get tag from request
    Poco::URI requestUri([[urlSchemeTask.request.URL absoluteString] UTF8String]);
    Poco::URI::QueryParameters params = requestUri.getQueryParameters();
    std::string tag;
    
    for (const auto& it : params) {
        if (it.first == "Tag") {
            tag = it.second;
        }
    }
    
    // Get path from tag & open a stream
    std::string mediaPath = [self getDocumentBroker]->getEmbeddedMediaPath(tag);
    NSInteger size = std::filesystem::file_size(mediaPath);
    
    NSDictionary<NSString*, NSString*> * requestHeaders = urlSchemeTask.request.allHTTPHeaderFields;
    NSMutableDictionary<NSString*, NSString*> * responseHeaders = [[NSMutableDictionary alloc] init];
    
    NSInteger responseStatus = 200;
    NSInteger start = 0;
    NSInteger end = size - 1; // 'end' is considered to be *inclusive* here to match the range header
    
    bool errorResponse = false;

    NSString * rangeHeader = [requestHeaders objectForKey:@"Range"];
    std::optional<std::tuple<NSUInteger, NSUInteger, NSUInteger>> rangePositionsAndSize = [self getPositionsAndSizeForRange:rangeHeader withTotalSize:size];

    if (rangeHeader != nil && rangePositionsAndSize == std::nullopt) {
        responseStatus = 416;
        [responseHeaders
         setObject:[NSString
                    stringWithFormat:@"bytes */%ld",
                    static_cast<long>(size)]
         forKey:@"Content-Range"];
        errorResponse = true;
    } else {
        responseStatus = 206;
        NSInteger totalSize = size;
        std::tie(start, end, size) = rangePositionsAndSize.value();
        [responseHeaders
         setObject:[NSString
                    stringWithFormat:@"bytes %ld-%ld/%ld",
                    start,
                    end,
                    totalSize]
         forKey:@"Content-Range"];
    }
        
    
    if (!errorResponse) {
        [responseHeaders setObject:[NSString stringWithFormat:@"%ld", size] forKey:@"Content-Length"];
    }
    
    [responseHeaders setObject:@"bytes" forKey:@"Accept-Ranges"];
    
    // Send preliminary file details
    NSHTTPURLResponse * response = [[NSHTTPURLResponse alloc]
                                    initWithURL:urlSchemeTask.request.URL
                                    statusCode:responseStatus
                                    HTTPVersion:nil
                                    headerFields:responseHeaders
    ];
    [urlSchemeTask didReceiveResponse:response];
    
    if (errorResponse) {
        [ongoingTasks removeObject:urlSchemeTask];
        [urlSchemeTask didFinish];
        return;
    }
    
    // Send file data, chunked into small amounts (1MiB (1048576 bytes) - the actual number here is pretty arbitrary)
    std::ifstream media(mediaPath, std::ios_base::in | std::ios_base::binary);
    char* chunk = new char[size];
    
    media.seekg(start);
    media.read(chunk, size);
        
    if (![ongoingTasks containsObject:urlSchemeTask]) {
        // The task was cancelled: exit immediately, without calling any further methods as per Apple docs
        media.close();
        return;
    }
    
    NSData * data = [NSData dataWithBytes:chunk length:size];
    [urlSchemeTask didReceiveData:data];
    
    delete[] chunk;
    media.close();
    
    // Tell the other side that we finished, and remove the ongoing-ness of the task
    [ongoingTasks removeObject:urlSchemeTask];
    [urlSchemeTask didFinish];
}

- (void)webView:(WKWebView *)webView stopURLSchemeTask:(id<WKURLSchemeTask>)urlSchemeTask {
    // Yeet the task from the ongoingTasks
    [ongoingTasks removeObject:urlSchemeTask];
}
@end
