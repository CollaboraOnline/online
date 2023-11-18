// -*- Mode: ObjC; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

#import <UIKit/UIKit.h>
#import "AppDelegate.h"

int main(int argc, char * argv[]) {
    @autoreleasepool {
        // To be able debug the app in Xcode when it is started from another app (like from clicking
        // on an .odt attachment in the Mail app), uncomment these lines. Then when you see the
        // SLEEPING line in Console (on your Mac), attach the process in Xcode.

        // NSLog(@"CollaboraOffice: SLEEPING");
        // sleep(20);

        return UIApplicationMain(argc, argv, nil, NSStringFromClass([AppDelegate class]));
    }
}

// vim:set shiftwidth=4 softtabstop=4 expandtab:
