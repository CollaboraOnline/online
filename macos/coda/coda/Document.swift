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
import PDFKit
import WebKit

/**
 * Represents a document in the application.
 */
class Document: NSDocument {

    // MARK: - Properties

    /// For the COWrapper to send the messages to the right file descriptor.
    @objc
    var fakeClientFd: Int32 = -1

    /// ID to identify the document to be able to get access to lok::Document (eg. for printing)
    @objc
    var appDocId: Int32 = -1

    /// Is this a read-only document?
    private var readOnly: Bool = false

    /// The webview that contains the document.
    var webView: WKWebView!

    /// The URL of the temporary directory where the document's working files are stored.
    private var tempDirectoryURL: URL?

    /// The URL of the temporary file that represents the "live" version of the document.
    @objc
    var tempFileURL: URL?

    /// Make sure the isModified access can be atomic.
    private var modifiedLock = NSLock()
    private var _isModified: Bool = false

    /**
     * Modified status mirrored from the core.
     */
    var isModified: Bool {
        get {
            modifiedLock.lock()
            let value = _isModified
            modifiedLock.unlock()

            return value
        }
        set {
            modifiedLock.lock()

            let oldValue = _isModified
            _isModified = newValue

            // trigger the saving operation when the document was previously marked as modified, but changes to non-modified
            if oldValue && !newValue {
                updateChangeCount(.changeDone)
            }

            modifiedLock.unlock()
        }
    }

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
        guard let windowController = storyboard.instantiateController(withIdentifier: identifier) as? WindowController else {
            fatalError("Unable to find DocumentWindowController in storyboard.")
        }
        self.addWindowController(windowController)

        if let viewController = windowController.contentViewController as? ViewController {
            viewController.loadDocument(self)
        }
    }

    /**
     * Called by the system when it wants to save or autosave the document.
     */
    override func data(ofType typeName: String) throws -> Data {
        guard let tempFileURL = self.tempFileURL else {
            // FIXME: handle error?
            return Data()
        }

        // Read the latest data from the temp file
        let data = try Data(contentsOf: tempFileURL)
        return data
    }

    /**
     * We save asynchronously, so that COOL can first write the file, and we can then copy it to the right location.
     */
    override func canAsynchronouslyWrite(to url: URL, ofType typeName: String, for saveOperation: NSDocument.SaveOperationType) -> Bool {
        return true
    }

    /**
     * Make sure that we first save by COOL when the user chooses to Save, and only then copy the content to the resulting place.
     */
    override func save(to url: URL, ofType typeName: String, for saveOperation: NSDocument.SaveOperationType, completionHandler: @escaping ((any Error)?) -> Void) {

        if isModified {
            // we have to wait for COOL to save first
            DispatchQueue.main.async {
                COWrapper.handleMessage(with: self, message: "save dontTerminateEdit=1 dontSaveIfUnmodified=1")
            }
        }
        else {
            // all is good, we can proceed with copying the data from COOL
            super.save(to: url, ofType: typeName, for: saveOperation, completionHandler: completionHandler)
        }

        DispatchQueue.main.async {
            completionHandler(nil)
        }
    }

    /**
     * Called by the system when the document is opened. The system provides the file contents as `Data`.
     * We create a non-predictable temporary directory using a UUID, and store the `data` there.
     */
    override func read(from data: Data, ofType typeName: String) throws {
        // Create a unique temp directory
        let tempDirBase = FileManager.default.temporaryDirectory
        let uniqueDirName = UUID().uuidString
        let tempDir = tempDirBase.appendingPathComponent(uniqueDirName, isDirectory: true)

        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true, attributes: nil)

        self.tempDirectoryURL = tempDir

        // If fileURL is available (document opened from a file), preserve the original filename.
        // If not available, use a generic name.
        let fileName: String
        if let fileURL = self.fileURL {
            fileName = fileURL.lastPathComponent
        }
        else {
            fileName = "Document-\(UUID().uuidString)"
        }

        let tempFile = tempDir.appendingPathComponent(fileName)
        try data.write(to: tempFile, options: .atomic)

        self.tempFileURL = tempFile
    }

    /**
     * Implement printing.
     */
    override func printOperation(withSettings printSettings: [NSPrintInfo.AttributeKey : Any]) throws -> NSPrintOperation {
        // export to a temporary PDF file
        let tmpURL = FileManager.default
            .temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("pdf")

        COWrapper.saveAs(with: self, url: tmpURL.absoluteString, format: "pdf", filterOptions: nil)

        // load the PDF into a PDFView
        guard let pdfDoc = PDFDocument(url: tmpURL) else {
            throw CocoaError(.fileReadCorruptFile, userInfo: [NSURLErrorKey: tmpURL])
        }

        // we no longer need the file
        try? FileManager.default.removeItem(at: tmpURL)

        // build the printing view and operation
        let pdfView = PDFView()
        pdfView.document   = pdfDoc
        pdfView.autoScales = true

        let op = NSPrintOperation(view: pdfView, printInfo: self.printInfo)
        op.showsPrintPanel    = true
        op.showsProgressPanel = true
        return op
    }

    /**
     * Clean up the temporary directory when the document closes.
     */
    override func close() {
        super.close()
        if let tempDir = self.tempDirectoryURL {
            try? FileManager.default.removeItem(at: tempDir)
        }
    }

    /**
     * Initiate loading of cool.html, which also triggers loading of the document via lokit.
     */
    func loadDocumentInWebView(webView: WKWebView, readOnly: Bool) {
        self.webView = webView
        self.readOnly = readOnly

        self.appDocId = COWrapper.generateNewAppDocId()
        self.fakeClientFd = COWrapper.fakeSocketSocket()

        guard let url = Bundle.main.url(forResource: "cool", withExtension: "html") else {
            fatalError("Resource 'cool.html' not found in the main bundle.")
        }

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        let permission = readOnly ? "readonly" : "edit"

        components.queryItems = [
            URLQueryItem(name: "file_path", value: tempFileURL!.absoluteString),
            URLQueryItem(name: "closebutton", value: "1"),
            URLQueryItem(name: "permission", value: permission),
            // TODO: add "lang" if needed
            URLQueryItem(name: "appdocid", value: "\(self.appDocId)"),
            URLQueryItem(name: "userinterfacemode", value: "notebookbar"),
            // TODO: add "dir" if needed
        ]

        let finalURL = components.url!
        let request = URLRequest(url: finalURL)
        let urlDir = url.deletingLastPathComponent()

        // If you need read access to a local file, use loadFileURL(_:allowingReadAccessTo:):
        // If `finalURL` is a file URL, do:
        if finalURL.isFileURL {
            webView.loadFileURL(finalURL, allowingReadAccessTo: urlDir)
        } else {
            // If it's not a file URL, just load the request normally
            webView.load(request)
        }
    }

    /**
     * Abbreviated message for debugging.
     */
    private func abbreviatedMessage(buffer: UnsafePointer<CChar>, length: Int) -> String {
        // Implement your logic or return a placeholder:
        let msgData = Data(bytes: buffer, count: length)
        let msgStr = String(data: msgData, encoding: .utf8) ?? "<non-UTF8 message>"
        return msgStr.prefix(100) + (msgStr.count > 100 ? "..." : "")
    }

    /**
     * Check if the message is of the given type.
     */
    private func isMessageOfType(_ buffer: UnsafePointer<CChar>, _ prefix: String, length: Int) -> Bool {
        let msgData = Data(bytes: buffer, count: min(length, prefix.count))
        guard let msgStr = String(data: msgData, encoding: .utf8) else { return false }
        return msgStr == prefix
    }

    @objc
    func send2JS(_ buffer: UnsafePointer<CChar>, length: Int) {
        let abbrMsg = abbreviatedMessage(buffer: buffer, length: length)
        COWrapper.LOG_TRC("To JS: \(abbrMsg)")

        let binaryMessage = (isMessageOfType(buffer, "tile:", length: length) ||
                             isMessageOfType(buffer, "tilecombine:", length: length) ||
                             isMessageOfType(buffer, "delta:", length: length) ||
                             isMessageOfType(buffer, "renderfont:", length: length) ||
                             isMessageOfType(buffer, "rendersearchlist:", length: length) ||
                             isMessageOfType(buffer, "windowpaint:", length: length))

        let pretext = binaryMessage
            ? "window.TheFakeWebSocket.onmessage({'data': window.atob('"
            : "window.TheFakeWebSocket.onmessage({'data': window.b64d('"
        let posttext = "')});"

        // Convert the buffer to Data
        let payloadData = Data(bytes: buffer, count: length)
        let encodedPayload = payloadData.base64EncodedString(options: [])

        // Construct the full JavaScript string
        let js = pretext + encodedPayload + posttext

        // Truncate for logging
        let truncatedJS = js.count > 100 ? (js.prefix(100) + "...") : js[...]
        COWrapper.LOG_TRC("Evaluating JavaScript: \(truncatedJS)")

        // Evaluate on main queue
        DispatchQueue.main.async {
            self.webView.evaluateJavaScript(js) { (obj, error) in
                if let error = error as NSError? {
                    COWrapper.LOG_ERR("Error after \(truncatedJS): \(error.localizedDescription)")
                    if let jsException = error.userInfo["WKJavaScriptExceptionMessage"] as? String {
                        COWrapper.LOG_ERR("JavaScript exception: \(jsException)")
                    }
                }
            }
        }
    }
}
