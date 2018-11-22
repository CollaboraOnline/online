// -*- Mode: objc; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This file is part of the LibreOffice project.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#import "config.h"

#import <cassert>
#import <cstdlib>
#import <cstring>

#import "AppDelegate.h"
#import "DocumentBrowserViewController.h"
#import "DocumentViewController.h"
#import "Document.h"

#import "FakeSocket.hpp"
#import "Log.hpp"
#import "LOOLWSD.hpp"
#import "Util.hpp"

static LOOLWSD *loolwsd = nullptr;

@interface AppDelegate ()

@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    auto trace = std::getenv("LOOL_LOGLEVEL");
    if (!trace)
        trace = strdup("warning");

    Log::initialize("Mobile", trace, false, false, {});
    Util::setThreadName("main");
    fakeSocketSetLoggingCallback([](const std::string& line)
                                 {
                                     LOG_TRC_NOFILE(line);
                                 });

    dispatch_async(dispatch_get_global_queue( DISPATCH_QUEUE_PRIORITY_DEFAULT, 0),
                   ^{
                       assert(loolwsd == nullptr);
                       char *argv[2];
                       argv[0] = strdup([[NSBundle mainBundle].executablePath UTF8String]);
                       argv[1] = nullptr;
                       Util::setThreadName("app");
                       while (true) {
                           loolwsd = new LOOLWSD();
                           loolwsd->run(1, argv);
                           delete loolwsd;
                           LOG_TRC("One run of LOOLWSD completed");
                       }
                   });
    return YES;
}

- (void)applicationWillResignActive:(UIApplication *)application {
    // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
    // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
}

- (void)applicationDidEnterBackground:(UIApplication *)application {
    // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
    // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
}

- (void)applicationWillEnterForeground:(UIApplication *)application {
    // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
}

- (void)applicationDidBecomeActive:(UIApplication *)application {
    // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
}

- (void)applicationWillTerminate:(UIApplication *)application {
    // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
}

- (BOOL)application:(UIApplication *)app openURL:(NSURL *)inputURL options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options {
    // Ensure the URL is a file URL
    if (!inputURL.isFileURL) {
        return NO;
    }

    // Reveal / import the document at the URL
    DocumentBrowserViewController *documentBrowserViewController = (DocumentBrowserViewController *)self.window.rootViewController;
    [documentBrowserViewController revealDocumentAtURL:inputURL importIfNeeded:YES completion:^(NSURL * _Nullable revealedDocumentURL, NSError * _Nullable error) {
        if (error) {
            // Handle the error appropriately
            LOG_ERR("Failed to reveal the document at URL " << [[inputURL description] UTF8String] << " with error: " << [[error description] UTF8String]);
            return;
        }

        // Present the Document View Controller for the revealed URL
        [documentBrowserViewController presentDocumentAtURL:revealedDocumentURL];
    }];
    return YES;
}

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
