/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#include <config.h>

#define LIBO_INTERNAL_ONLY
#include <LibreOfficeKit/LibreOfficeKit.hxx>

#import <WebKit/WebKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

#import "coda-Swift.h"
#import "COWrapper.h"
#import "macos.h"

// Include necessary C++ headers
#include <thread>
#include <string>
#include <common/Clipboard.hpp>
#include <common/Log.hpp>
#include <common/MobileApp.hpp>
#include <common/Util.hpp>
#include <net/FakeSocket.hpp>
#include <wsd/COOLWSD.hpp>

// Declare the coolwsd pointer at global scope
COOLWSD *coolwsd = nullptr;

static int closeNotificationPipeForForwardingThread[2];

/**
 * Wrapper to be able to call the C++ code from Swift.
 *
 * The main purpose is to initialize the COOLWSD and interact with it.
 */
@implementation COWrapper

+ (void)startServer {
    // Initialize logging
    // Use "debug" or potentially even "trace" for debugging
#if DEBUG
    Log::initialize("Mobile", "debug");
#else
    Log::initialize("Mobile", "information");
#endif
    Util::setThreadName("main");

    // Set up the logging callback
    fakeSocketSetLoggingCallback([](const std::string& line) {
        LOG_TRC_NOFILE(line);
    });

    // Start the COOLWSD server in a detached thread
    NSLog(@"CollaboraOffice: Starting the thread");
    std::thread([]{
        assert(coolwsd == nullptr);

        // Prepare arguments for COOLWSD
        std::vector<std::string> args = {
            "coda"
        };

        Util::setThreadName("app");

        coolwsd = new COOLWSD();
        coolwsd->run(args);
        delete coolwsd;
        coolwsd = nullptr; // Reset the pointer after deletion
        NSLog(@"CollaboraOffice: The COOLWSD thread completed");
    }).detach();
}

+ (void)stopServer {
    if (coolwsd) {
        delete coolwsd;
        coolwsd = nullptr;
    }
}

+ (void)handleHULLOWithDocument:(Document *)document {
    // Contact the permanently (during app lifetime) listening COOLWSD server
    // "public" socket
    assert(coolwsd_server_socket_fd != -1);
    int rc = fakeSocketConnect(document.fakeClientFd, coolwsd_server_socket_fd);
    assert(rc != -1);

    // Create a socket pair to notify the below thread when the document has been closed
    fakeSocketPipe2(closeNotificationPipeForForwardingThread);

    // Start another thread to read responses and forward them to the JavaScript
    dispatch_async(dispatch_get_global_queue( DISPATCH_QUEUE_PRIORITY_DEFAULT, 0),
                   ^{
                       Util::setThreadName("app2js");
                       while (true) {
                           struct pollfd p[2];
                           p[0].fd = document.fakeClientFd;
                           p[0].events = POLLIN;
                           p[1].fd = closeNotificationPipeForForwardingThread[1];
                           p[1].events = POLLIN;
                           if (fakeSocketPoll(p, 2, -1) > 0) {
                               if (p[1].revents == POLLIN) {
                                   // The code below handling the "BYE" fake Websocket
                                   // message has closed the other end of the
                                   // closeNotificationPipeForForwardingThread. Let's close
                                   // the other end too just for cleanliness, even if a
                                   // FakeSocket as such is not a system resource so nothing
                                   // is saved by closing it.
                                   fakeSocketClose(closeNotificationPipeForForwardingThread[1]);

                                   // Close our end of the fake socket connection to the
                                   // ClientSession thread, so that it terminates
                                   fakeSocketClose(document.fakeClientFd);

                                   return;
                               }
                               if (p[0].revents == POLLIN) {
                                   size_t n = fakeSocketAvailableDataLength(document.fakeClientFd);
                                   // I don't want to check for n being -1 here, even if
                                   // that will lead to a crash (std::length_error from the
                                   // below std::vector constructor), as n being -1 is a
                                   // sign of something being wrong elsewhere anyway, and I
                                   // prefer to fix the root cause. Let's see how well this
                                   // works out. See tdf#122543 for such a case.
                                   if (n == 0)
                                       return;
                                   std::vector<char> buf(n);
                                   n = fakeSocketRead(document.fakeClientFd, buf.data(), n);
                                   [document send2JS:buf.data() length:n];
                               }
                           }
                           else
                               break;
                       }
                       assert(false);
                   });

    // First we simply send the Online C++ parts the URL and the appDocId. This corresponds
    // to the GET request with Upgrade to WebSocket.
    std::string url([[document.tempFileURL absoluteString] UTF8String]);
    struct pollfd p;
    p.fd = document.fakeClientFd;
    p.events = POLLOUT;
    fakeSocketPoll(&p, 1, -1);

    // appDocId is read in ClientRequestDispatcher::handleIncomingMessage() in COOLWSD.cpp
    std::string message(url + " " + std::to_string(document.appDocId));
    fakeSocketWrite(document.fakeClientFd, message.c_str(), message.size());
}

+ (void)handleMessageWith:(Document *)document message:(NSString *)message {
    const char *buf = [message UTF8String];
    struct pollfd p;
    p.fd = document.fakeClientFd;
    p.events = POLLOUT;
    fakeSocketPoll(&p, 1, -1);
    fakeSocketWrite(document.fakeClientFd, buf, strlen(buf));
}

+ (void)saveAsWith:(Document *)document url:(NSString *)url format:(NSString *)format filterOptions:(NSString *)filterOptions {
    DocumentData::get(document.appDocId).loKitDocument->saveAs([url UTF8String], [format UTF8String], [filterOptions UTF8String]);
}

/**
 * Call the LOKit getClipboard and return it so that it can be used in Swift.
 */
+ (NSArray<id<NSPasteboardWriting>> * _Nullable) getClipboardInternalWith:(Document *_Nonnull)document mimeTypes:(const char**)mimeTypes {
    size_t outCount = 0;
    char  **outMimeTypes = nullptr;
    size_t *outSizes = nullptr;
    char  **outStreams = nullptr;

    if (DocumentData::get(document.appDocId).loKitDocument->getClipboard(mimeTypes,
                                                                         &outCount, &outMimeTypes,
                                                                         &outSizes, &outStreams))
    {
        // return early
        if (outCount == 0)
            return nil;

        NSMutableArray<id<NSPasteboardWriting>> *result = [NSMutableArray array];

        for (size_t i = 0; i < outCount; ++i) {
            NSString * identifier = [NSString stringWithUTF8String:outMimeTypes[i]];

            // For interop with other apps, if this mime-type is known we can export it
            UTType * uti = [UTType typeWithMIMEType:identifier];
            if (uti != nil && !uti.dynamic) {
                if ([uti conformsToType:UTTypePlainText] && outStreams[i] != nullptr) {
                    [result addObject:[NSString stringWithUTF8String:outStreams[i]]];
                }
                else if ([uti conformsToType:UTTypeImage]) {
                    [result addObject:[[NSImage alloc] initWithData:[NSData dataWithBytes:outStreams[i] length:outSizes[i]]]];
                }
            }

            // Also preserve the data we need, we'll always also export the raw, unaltered bytes
            NSPasteboardItem * item = [[NSPasteboardItem alloc] init];
            [item setData:[NSData dataWithBytes:outStreams[i] length:outSizes[i]] forType:identifier];
        }

        return result;
    }
    else
        LOG_DBG("failed to fetch mime-types");

    return nil;
}

/**
 * Get the clipboard content. Defaults to fetching text and/or html only, when a generic query fails.
 */
+ (NSArray<id<NSPasteboardWriting>> * _Nullable) getClipboardWith:(Document *_Nonnull)document {
    NSArray<id<NSPasteboardWriting>> * result = [COWrapper getClipboardInternalWith:document mimeTypes:nullptr];
    if (result != nil)
        return result;

    const char* textMimeTypes[] = {
        "text/plain;charset=utf-8",
        "text/html",
        nullptr
    };

    return [COWrapper getClipboardInternalWith:document mimeTypes:textMimeTypes];
}

/**
 * Sets the LOKit internal clipboard with the content of NSPasteboard.
 */
+ (void)setClipboardWith:(Document *_Nonnull)document from:(NSPasteboard *_Nonnull)pasteboard {
    NSMutableDictionary * pasteboardItems = [NSMutableDictionary new];

    if (pasteboard.pasteboardItems.count != 0) {
        NSPasteboardItem *item = pasteboard.pasteboardItems.firstObject;

        for (NSPasteboardType identifier in item.types)
        {
            UTType * uti = [UTType typeWithIdentifier:identifier];
            NSString * mime = uti? uti.preferredMIMEType: identifier;

            if (mime == nil) {
                LOG_WRN("UTI " << [identifier UTF8String] << " did not have associated mime type when deserializing clipboard, skipping...");
                continue;
            }

            NSData * value = [item dataForType:identifier];
            if (value == nil)
                continue;

            if (uti != nil && [pasteboardItems objectForKey:mime] != nil) {
                // We export both mime and UTI keys, don't overwrite the mime-type ones with the UTI ones
                continue;
            }

            [pasteboardItems setObject:value forKey:mime];
        }
    }

    const char * pInMimeTypes[pasteboardItems.count];
    size_t pInSizes[pasteboardItems.count];
    const char * pInStreams[pasteboardItems.count];

    size_t i = 0;

    for (NSString * mime in pasteboardItems) {
        pInMimeTypes[i] = [mime UTF8String];
        pInStreams[i] = (const char*)[pasteboardItems[mime] bytes];
        pInSizes[i] = [pasteboardItems[mime] length];
        i++;
    }

    DocumentData::get(document.appDocId).loKitDocument->setClipboard(pasteboardItems.count, pInMimeTypes, pInSizes, pInStreams);
}

/**
 * Insert data into the internal clipboard. The content's format is mimeType\nlegth\ndata\n[...repeat for more mimetypes...].
 */
+ (bool)sendToInternalWith:(Document *_Nonnull)document content:(NSString *_Nonnull)content {
    std::vector<char> html;

    ClipboardData data;
    size_t nInCount;

    if ([content hasPrefix:@"<!DOCTYPE html>"]) {
        // Content is just HTML
        const char * _Nullable content_cstr = [content cStringUsingEncoding:NSUTF8StringEncoding];
        html = std::vector(content_cstr, content_cstr + [content lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);
        nInCount = 1;
    }
    else {
        // objcString -> std::string (keeps embedded NULs, no extra copy for UTF-8)
        std::string buffer(static_cast<const char*>([content UTF8String]),
                           [content lengthOfBytesUsingEncoding:NSUTF8StringEncoding]);

        // put the buffer into a std::stringbuf, treated as binary (allow NULs in there), and create the input stream
        std::stringbuf sb(buffer, std::ios::in | std::ios::binary);
        std::istream stream(&sb);

        // read the data
        data.read(stream);
        nInCount = data.size();
        // DEBUG: data.dumpState(std::cout);
    }

    std::vector<size_t> pInSizes(nInCount);
    std::vector<const char*> pInMimeTypes(nInCount);
    std::vector<const char*> pInStreams(nInCount);

    if (html.empty()) {
        for (size_t i = 0; i < nInCount; ++i) {
            pInSizes[i] = data._content[i].length();
            pInStreams[i] = data._content[i].c_str();
            pInMimeTypes[i] = data._mimeTypes[i].c_str();
        }
    }
    else {
        pInSizes[0] = html.size();
        pInStreams[0] = html.data();
        pInMimeTypes[0] = "text/html";
    }

    return DocumentData::get(document.appDocId).loKitDocument->setClipboard(nInCount, pInMimeTypes.data(), pInSizes.data(), pInStreams.data());
}

/**
 * We keep a running count of opening documents here. This is not necessarily in sync with the
 * DocBrokerId in DocumentBroker due to potential parallelism when opening multiple documents in
 * quick succession.
 */
static std::atomic<int> appDocIdCounter(1);

+ (int)generateNewAppDocId {
    DocumentData::allocate(appDocIdCounter);
    return appDocIdCounter++;
}

+ (int)fakeSocketSocket {
    return fakeSocketSocket();
}

/**
 * Convert NSString to std::string & call the C++ version of the logging function.
 */
+ (void)LOG_DBG:(NSString *)message {
    std::string stdMessage = [message UTF8String];
    LOG_DBG(stdMessage);
}

+ (void)LOG_ERR:(NSString *)message {
    std::string stdMessage = [message UTF8String];
    LOG_ERR(stdMessage);
}

+ (void)LOG_TRC:(NSString *)message {
    std::string stdMessage = [message UTF8String];
    LOG_TRC(stdMessage);
}

@end
