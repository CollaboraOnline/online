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

let formatMenuCommandNames: [FormatMenuCommand: String] = [
    .bold: "Bold",
    .italic: "Italic",
    .underline: "Underline"
]

/// The structure we expect in the COMMANDSTATECHANGED payload.
struct CommandStateChange: Decodable {
    let commandName: String
    let state: String
}

/// Window controller that manages the document window & menus
class WindowController: NSWindowController, NSMenuItemValidation {

    /// Track menu states here, to be able to show the state in the menu
    var formatStates: [String: Bool] = [:]

    /// Single IBAction for all Format commands in the menu
    @IBAction func formatMenuAction(_ sender: NSMenuItem) {
        guard let command = FormatMenuCommand(rawValue: sender.tag) else { return }

        // Forward to the ViewController so it can actually set bold/italic/...
        if let vc = contentViewController as? ViewController {
            if let unoCommand = formatMenuCommandNames[command] ?? nil {
                COWrapper.handleMessage(with: vc.document, message: "uno .uno:\(unoCommand)")
            }
        }
    }

    /// Remember the new command state value as provided by JS.
    func handleCommandStateChange(_ stateChange: CommandStateChange) {
        // extract the command name from the ".uno:CommandName" form
        let unoCommmandName = stateChange.commandName
        guard let colon = unoCommmandName.firstIndex(of: ":") else { return }
        let commandName = unoCommmandName[unoCommmandName.index(after: colon)...]

        // store it
        formatStates[String(commandName)] = stateChange.state == "true"
    }

    /// Show on/off checkmarks for the particular command(s) like Bold/Italics/...
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if menuItem.action != #selector(formatMenuAction(_:)) {
            return true // not our action
        }

        // convert the id to a command name
        guard let command = FormatMenuCommand(rawValue: menuItem.tag) else { return false }
        guard let commandName = formatMenuCommandNames[command] else { return false }

        // Show a check if the command is currently ON
        let isOn = formatStates[commandName] ?? false
        menuItem.state = isOn ? .on : .off
        return true
    }
}
