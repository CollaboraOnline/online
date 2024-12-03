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

/**
 * Represents a document in the application.
 */
class Document: NSDocument {

    // MARK: - Properties

    /// The content of the document, e.g., HTML data.
    var documentData: Data?

    // MARK: - Initialization

    override init() {
        super.init()
        // Initialization code here.
    }

    // MARK: - NSDocument Overrides

    /**
     * Enables autosaving.
     */
    override class var autosavesInPlace: Bool {
        return true
    }

    /**
     * Creates the window controllers for the document.
     */
    override func makeWindowControllers() {
        // Load the storyboard and get the window controller.
        let storyboard = NSStoryboard(name: "Main", bundle: nil)
        let identifier = NSStoryboard.SceneIdentifier("DocumentWindowController")
        guard let windowController = storyboard.instantiateController(withIdentifier: identifier) as? NSWindowController else {
            fatalError("Unable to find DocumentWindowController in storyboard.")
        }
        self.addWindowController(windowController)
    }

    /**
     * Returns the document data to be saved.
     */
    override func data(ofType typeName: String) throws -> Data {
        // Save the document's data.
        guard let data = documentData else {
            throw NSError(domain: NSOSStatusErrorDomain, code: unimpErr, userInfo: nil)
        }
        return data
    }

    /**
     * Loads the document from data.
     */
    override func read(from data: Data, ofType typeName: String) throws {
        // Load the document's data.
        self.documentData = data
    }
}
