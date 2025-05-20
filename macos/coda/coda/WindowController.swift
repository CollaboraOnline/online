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
import WebKit

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
    var commandState: [String: String] = [:]

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
        commandState[String(commandName)] = stateChange.state
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
        let isOn = commandState[commandName] == "true"
        menuItem.state = isOn ? .on : .off
        return true
    }
}

/**
 * Extend the WKWebView so that we can set the state of Cut/Copy/Paste in the macOS menu too.
 */
extension WKWebView: @retroactive NSMenuItemValidation {

    public func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        guard let commandState = (window?.windowController as? WindowController)?.commandState else {
            return true
        }

        if menuItem.action == #selector(NSText.cut(_:)) {
            return commandState["Cut"] != "disabled"
        }
        else if menuItem.action == #selector(NSText.copy(_:)) {
            return commandState["Copy"] != "disabled"
        }
        else if menuItem.action == #selector(NSText.paste(_:)) {
            return commandState["Paste"] != "disabled"
        }

        return true
    }
}
