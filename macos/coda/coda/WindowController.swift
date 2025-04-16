/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import Cocoa

enum FormatMenuCommand: Int {
    case bold = 1
    case italic
    case underline
}

let formatMenuUnoCommands: [FormatMenuCommand: String] = [
    .bold: "Bold",
    .italic: "Italic",
    .underline: "Underline"
]

/// Window controller that manages the document window & menus
class WindowController: NSWindowController, NSMenuItemValidation {

    /// Track menu states here, to be able to show the state in the menu
    var formatStates: [FormatMenuCommand: Bool] = [:]

    /// Single IBAction for all Format commands in the menu
    @IBAction func formatMenuAction(_ sender: NSMenuItem) {
        guard let command = FormatMenuCommand(rawValue: sender.tag) else { return }

        // Toggle or otherwise update the command state
        let oldVal = formatStates[command] ?? false
        let newVal = !oldVal
        formatStates[command] = newVal

        // Forward to the ViewController so it can actually set bold/italic/...
        if let vc = contentViewController as? ViewController {
            if let unoCommand = formatMenuUnoCommands[command] ?? nil {
                COWrapper.handleMessage(with: vc.document, message: "uno .uno:\(unoCommand)")
            }
        }
    }

    /// Show on/off checkmarks for the particular command(s) like Bold/Italics/...
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if menuItem.action != #selector(formatMenuAction(_:)) {
            return true // not our action
        }

        guard let command = FormatMenuCommand(rawValue: menuItem.tag) else {
            return false
        }

        // Show a check if the command is currently ON
        let isOn = formatStates[command] ?? false
        menuItem.state = isOn ? .on : .off
        return true
    }
}
