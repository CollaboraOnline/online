// -*- Mode: swift; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import Foundation
import XCTest
import SafariServices

final class Launch {
    /// Launch the app to the filebrowser screen
    ///
    /// If the app is already open, this method will relaunch it to the filebrowser screen
    ///
    /// - Parameters:
    ///     - app: The XCUI app object
    static func fileBrowser(app: XCUIApplication) {
        app.launch()
    }
}
