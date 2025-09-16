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

    /// Default to some nicer size when opening the document the 1st time.
    override func windowDidLoad() {
        super.windowDidLoad()
        guard let window = window else { return }

        // Let macOS remember the user's last size/position after first launch.
        window.setFrameAutosaveName("DocumentWindow")

        // If there isn't a saved frame yet, apply our default.
        if !window.setFrameUsingName("DocumentWindow") {
            applyDefaultFrame(window, widthFraction: 0.95, heightFraction: 0.95)
        }
    }

    /// Fractions of visible width & height, centered on the target screen.
    private func applyDefaultFrame(_ window: NSWindow, widthFraction: CGFloat, heightFraction: CGFloat) {
        // Choose the screen the window will appear on (fallback to main/first if unknown).
        let screen = window.screen ?? NSScreen.main ?? NSScreen.screens.first!
        let vf = screen.visibleFrame

        // Fraction for width, "as tall as possible" for the height
        let targetW = floor(vf.width * widthFraction)
        let targetH = floor(vf.height * heightFraction)

        // Center horizontally; align to bottom of visible area.
        let x = vf.origin.x + (vf.width - targetW) / 2.0
        let y = vf.origin.y + (vf.height - targetH) / 2.0

        let minSize = window.minSize
        let maxSize = window.maxSize

        // Respect any min/max constraints the window may have.
        let clampedW = max(minSize.width, min(maxSize.width > 0 ? maxSize.width : .greatestFiniteMagnitude, targetW))
        let clampedH = max(minSize.height, min(maxSize.height > 0 ? maxSize.height : .greatestFiniteMagnitude, targetH))
        let clampedFrame = NSRect(x: x, y: y, width: clampedW, height: clampedH)

        window.setFrame(clampedFrame, display: false, animate: false)
    }

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
