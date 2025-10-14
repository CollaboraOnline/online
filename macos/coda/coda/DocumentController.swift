/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * NSDocumentController instance to modify functionality related to the Open panel.
 */
final class DocumentController: NSDocumentController {

    /**
     * The current, live NSOpenPanel instance that was open during the app startup.
     *
     * We make sure that there is always just one instance, and focus it in case anybody
     * tries to trigger File -> Open... when the Open panel is already presented.
     */
    private weak var liveOpenPanel: NSOpenPanel?

    /**
     * One place to decide if we should quit the app on losing focus.
     */
    func hasDocsOrWindows() -> Bool {
        let hasDocs = !documents.isEmpty
        let hasVisibleWindows = NSApp.windows.contains { $0.isVisible }
        return hasDocs || hasVisibleWindows
    }

    /**
     * Remember the live/current Open panel instance.
     */
    override func beginOpenPanel(_ openPanel: NSOpenPanel,
                                 forTypes inTypes: [String]?,
                                 completionHandler: @escaping (Int) -> Void) {

        liveOpenPanel = openPanel

        super.beginOpenPanel(openPanel, forTypes: inTypes) { [weak self] result in
            guard let self = self else { return }
            // Panel is going away regardless of result.
            self.liveOpenPanel = nil
            completionHandler(result)
        }
    }

    /**
     * Make the File -> Open… menu also reuse/focus the existing panel (to avoid 2 open panels at the same time).
     */
    override func openDocument(_ sender: Any?) {
        focusOrPresentOpenPanel()
    }

    /**
     * If the Open panel is live, close it.
     */
    private func closeLiveOpenPanel() {
        liveOpenPanel?.cancel(nil)
        liveOpenPanel = nil
    }

    /**
     * Intercept File -> New (and also the Open panel's New Document button)
     */
    override func newDocument(_ sender: Any?) {
        closeLiveOpenPanel()

        // TODO open the dialog for the new document here
    }

    /**
     * Make sure to cancel the Open panel when a document has been open by different means, eg. via File -> Recent files.
     */
    override func openDocument(withContentsOf url: URL,
                               display displayDocument: Bool,
                               completionHandler: @escaping (NSDocument?, Bool, Error?) -> Void) {
        closeLiveOpenPanel()

        super.openDocument(withContentsOf: url, display: displayDocument, completionHandler: completionHandler)
    }

    /**
     * Opens the Open panel when no other documents or windows are presented.
     */
    func focusOrPresentOpenPanel() {
        if let panel = liveOpenPanel {
            // Focus the existing panel (sheet or app-modal).
            if let parent = panel.sheetParent {
                parent.makeKeyAndOrderFront(nil)
            }
            else {
                panel.makeKeyAndOrderFront(nil)
            }
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        // No panel up -> trigger standard Open panel flow.
        super.openDocument(nil)
    }
}
