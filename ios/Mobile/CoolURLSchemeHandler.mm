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

    NSMutableDictionary<NSString*, NSString*> * responseHeaders = [[NSMutableDictionary alloc] init];
    [responseHeaders setObject:[NSString stringWithFormat:@"%ld", size] forKey:@"Content-Length"];
    
    // Send preliminary file details
    NSHTTPURLResponse * response = [[NSHTTPURLResponse alloc]
                                    initWithURL:urlSchemeTask.request.URL
                                    statusCode:200
                                    HTTPVersion:nil
                                    headerFields:responseHeaders
    ];
    [urlSchemeTask didReceiveResponse:response];

    // Send actual file data
    std::ifstream media(mediaPath, std::ios_base::in | std::ios_base::binary);
    char* chunk = new char[size];

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
