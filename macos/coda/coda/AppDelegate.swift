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

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    /**
     * Create our document controller early so it becomes the shared instance.
     */
    private let documentController = DocumentController()

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        // Initialize the COOLWSD
        COWrapper.startServer()

        // Finish window restoration, and try to open the Open panel if no document is open
        DispatchQueue.main.async { [weak self] in
            self?.documentController.focusOrPresentOpenPanel()
        }
    }

    /**
     * Don’t auto-create an empty document at launch.
     */
    func applicationShouldOpenUntitledFile(_ sender: NSApplication) -> Bool {
        return false
    }

    /**
     * We close the app when there is no document or Open panel, but handle clicking the Dock's icon anyway, just for case.
     */
    func applicationShouldHandleReopen(_ app: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { documentController.focusOrPresentOpenPanel() }
        return false
    }

    /// Holds App Kit’s continuation block while we close documents.
    private var pendingQuitReply: ((Bool) -> Void)?

    /**
     * Intercept ⌘Q / Dock-Quit / system shutdown.
     * See https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/AppArchitecture/Tasks/GracefulAppTermination.html
     * for the description how to intercept the document closing and/or delay that until the cleanup is performed.
     */
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply
    {
        NSLog("CollaboraOffice: App quit requested")

        // save the continuation so we can reply later
        pendingQuitReply = { sender.reply(toApplicationShouldTerminate: $0) }

        // ask every open document to close; the delegate callback will run
        for doc in NSDocumentController.shared.documents {
            doc.canClose(withDelegate: self,
                         shouldClose: #selector(document(_:shouldClose:context:)),
                         contextInfo: nil)
        }

        // if there were no documents at all, we’re ready to quit
        if NSDocumentController.shared.documents.isEmpty {
            finishQuit(.terminateNow)
        }

        // tell App Kit we’ll decide later
        return .terminateLater
    }

    /**
     * Each NSDocument calls this when its asynchronous closing finishes
     */
    @objc func document(_ doc: NSDocument,
                        shouldClose: Bool,
                        context contextInfo: UnsafeMutableRawPointer?)
    {
        NSLog("CollaboraOffice: Checking if we should close the document")
        // user hit “Cancel” in a save dialog => abort quit
        if !shouldClose { return finishQuit(.terminateCancel) }

        // close the document in COOLWSD
        doc.close()

        // when the last doc is gone, we can tear everything down
        if NSDocumentController.shared.documents.isEmpty {
            finishQuit(.terminateNow)
        }
    }

    /**
     * Finalise quit or cancel
     */
    private func finishQuit(_ reply: NSApplication.TerminateReply) {
        guard let replyBlock = pendingQuitReply else { return }
        pendingQuitReply = nil

        if reply == .terminateNow {
            // All docs closed: safe place for global tear-down
            COWrapper.stopServer()
            NSLog("CollaboraOffice: Core shut down, quitting.")
        }
        else {
            NSLog("CollaboraOffice: Quit cancelled.")
        }

        replyBlock(reply == .terminateNow)
    }

    func applicationWillTerminate(_ aNotification: Notification) {
        // Insert code here to tear down your application
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return true
    }

    /**
     * Don't use the built-in mechanism to close without windows, it is unreliable in many scenarios.
     *
     * Instead, we'll check for any open document or window when the app loses focus.
     */
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }

    /**
     * Quit when the app loses focus AND there are no docs and no visible windows/panels.
     */
    func applicationDidResignActive(_ notification: Notification) {
        if !documentController.hasDocsOrWindows() {
            NSApp.terminate(nil)
        }
    }
}
