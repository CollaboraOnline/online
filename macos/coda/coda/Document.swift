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
#if canImport(CryptoKit)
import CryptoKit
#endif
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

    /** Parameters for a deferred Save / Save As… request. */
    private struct PendingSave {
        let url: URL
        let typeName: String
        let operation: NSDocument.SaveOperationType
        let completion: (((any Error)?) -> Void)
    }

    /** Stashed Save / Save As… request while edits are still dirty (nil when none). */
    private var pendingSave: PendingSave?

    /// Make sure the isModified access can be atomic.
    private var modifiedLock = NSLock()
    private var _isModified: Bool = false

    /// Observe the fileURL changes, so that we can remember the window size per document.
    private var fileURLObservation: NSKeyValueObservation?

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
            // in case this is the first modified -> unmodified flip after the user triggered "Save As"
            var triggerPendingSave: PendingSave? = nil
            // in case the save was triggered from inside the webview, we should ask for the document name (if it is Untitled) etc.
            var triggerImplicitSave = false

            modifiedLock.lock()

            let oldValue = _isModified
            _isModified = newValue

            // non-modified -> modified: Mark that the document became edited
            if !oldValue && newValue {
                updateChangeCount(.changeDone)
            }
            // modified -> non-modified: Trigger the saving operation
            else if oldValue && !newValue {
                // decide under the lock if we should run the stashed Save now
                if pendingSave != nil {
                    triggerPendingSave = pendingSave
                    pendingSave = nil
                }
                else {
                    triggerImplicitSave = true
                }
            }

            modifiedLock.unlock()

            // schedule the actual save outside the lock
            if let ps = triggerPendingSave {
                DispatchQueue.main.async {
                    self.performPendingSave(ps)
                }
            }
            else if triggerImplicitSave {
                DispatchQueue.main.async {
                    self.performImplicitSave()
                }
            }
        }
    }

    /**
     * Atomically checks dirty state and, if dirty, stashes a pending save target. Returns true if pending was set.
     */
    private func setPendingIfModified(url: URL,
                                      typeName: String,
                                      saveOperation: NSDocument.SaveOperationType,
                                      completionHandler: @escaping ((any Error)?) -> Void) -> Bool {
        modifiedLock.lock()
        defer { modifiedLock.unlock() }
        if _isModified {
            pendingSave = PendingSave(url: url, typeName: typeName, operation: saveOperation, completion: completionHandler)
            return true
        }

        return false
    }

    // MARK: - deinit

    deinit {
        fileURLObservation?.invalidate()
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
     *
     * Default to a nicer size when opening the document the 1st time, or update
     * the window size according to what we remember (per document).
     */
    override func makeWindowControllers() {
        // Load the storyboard and get the window controller.
        let storyboard = NSStoryboard(name: "Main", bundle: nil)
        let identifier = NSStoryboard.SceneIdentifier("DocumentWindowController")
        guard let windowController = storyboard.instantiateController(withIdentifier: identifier) as? WindowController else {
            fatalError("Unable to find DocumentWindowController in storyboard.")
        }

        // Assign a per-document autosave name early
        let initialName = FrameAutosaveHelper.keyName(for: self)
        windowController.windowFrameAutosaveName = initialName
        windowController.shouldCascadeWindows = false

        addWindowController(windowController)

        if let viewController = windowController.contentViewController as? ViewController {
            viewController.loadDocument(self)
        }

        // Ensure the window exists so we can apply a default if no saved frame yet
        windowController.loadWindow()
        if let win = windowController.window, !win.setFrameUsingName(initialName) {
            FrameAutosaveHelper.applyDefaultFrame(win, widthFraction: 0.95, heightFraction: 0.95)
        }

        // Observe fileURL so we can switch/migrate the autosave key after first save/rename.
        fileURLObservation = observe(\.fileURL, options: [.new]) { [weak windowController] doc, _ in
            guard let wc = windowController else { return }
            let oldName = wc.windowFrameAutosaveName
            let newName = FrameAutosaveHelper.keyName(for: doc)
            if newName == oldName { return }

            FrameAutosaveHelper.migrateSavedFrame(from: oldName, to: newName)
            wc.windowFrameAutosaveName = newName

            // If there’s already a window, try to apply the stored frame for the new key.
            if let win = wc.window { _ = win.setFrameUsingName(newName) }
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

        if setPendingIfModified(url: url, typeName: typeName, saveOperation: saveOperation, completionHandler: completionHandler) {
            // we have to wait for COOL to save first
            DispatchQueue.main.async {
                COWrapper.handleMessage(with: self, message: "save dontTerminateEdit=1 dontSaveIfUnmodified=1")
            }
        }
        else {
            // all is good, we can proceed with copying the data from COOL
            super.save(to: url, ofType: typeName, for: saveOperation, completionHandler: completionHandler)
        }
    }

    /**
     * Calls super.save(...) to complete a pending Save / Save As…
     */
    private func performPendingSave(_ ps: PendingSave) {
        do {
            // Perform the actual write using NSDocument’s writing pipeline (uses data(ofType:)).
            try self.write(to: ps.url, ofType: ps.typeName, for: ps.operation, originalContentsURL: self.fileURL)

            // For Save As / first Save, adopt the new URL/type. Save To must NOT change fileURL.
            if ps.operation == .saveAsOperation || (ps.operation == .saveOperation && self.fileURL == nil) {
                self.fileURL = ps.url
                self.fileType = ps.typeName
            }

            // Clear the change count; we’re now up to date.
            self.updateChangeCount(.changeCleared)

            // Tell AppKit the *original* save request completed (this unblocks the close button flow).
            DispatchQueue.main.async { ps.completion(nil) }
        }
        catch {
            DispatchQueue.main.async { ps.completion(error) }
        }
    }

    /**
     * Performs an AppKit-driven save (or Save As… if the document is untitled) after a COOL-initiated flush.
     */
    private func performImplicitSave() {
        // This will show the Save panel if fileURL == nil, otherwise it saves in place.
        self.save(self)
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
        guard let pdfDocument = PDFDocument(url: tmpURL) else {
            throw CocoaError(.fileReadCorruptFile, userInfo: [NSURLErrorKey: tmpURL])
        }

        // we no longer need the file
        try? FileManager.default.removeItem(at: tmpURL)

        guard let op = pdfDocument.printOperation(for: self.printInfo, scalingMode: .pageScaleNone, autoRotate: true) else {
            throw CocoaError(.fileReadCorruptFile, userInfo: [NSURLErrorKey: tmpURL])
        }

        return op
    }

    /*
     * Guard against double call of close().
     */
    private var isClosing = false

    /**
     * Clean up the temporary directory when the document closes.
     */
    override func close() {
        // there is no guarrantee that close() is called just once, see
        // https://stackoverflow.com/questions/5627267/nsdocument-subclass-close-method-called-twice
        if isClosing { return }
        isClosing = true

        NSLog("CollaboraOffice: Closing document")
        COWrapper.bye(self)
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
        let lang = Locale.preferredLanguages.first ?? "en-US"

        components.queryItems = [
            URLQueryItem(name: "file_path", value: tempFileURL!.absoluteString),
            URLQueryItem(name: "permission", value: permission),
            URLQueryItem(name: "lang", value: lang),
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

/**
 * Helper class containing functions for handling autosaving the size of the window.
 */
private class FrameAutosaveHelper {

    /**
     * Resize window to fractions of visible width & height, and center it on the target screen.
     */
    static func applyDefaultFrame(_ window: NSWindow, widthFraction: CGFloat, heightFraction: CGFloat) {
        // Choose the screen the window will appear on (fallback to main/first if unknown).
        let screen = window.screen ?? NSScreen.main ?? NSScreen.screens.first!
        let vf = screen.visibleFrame

        // Fraction for width and height
        let targetW = floor(vf.width * widthFraction)
        let targetH = floor(vf.height * heightFraction)

        let minSize = window.minSize
        let maxSize = window.maxSize

        // Respect any min/max constraints the window may have
        let clampedW = max(minSize.width, min(maxSize.width > 0 ? maxSize.width : .greatestFiniteMagnitude, targetW))
        let clampedH = max(minSize.height, min(maxSize.height > 0 ? maxSize.height : .greatestFiniteMagnitude, targetH))

        // Position so that the window is centered
        let x = vf.origin.x + (vf.width - clampedW) / 2.0
        let y = vf.origin.y + (vf.height - clampedH) / 2.0

        let clampedFrame = NSRect(x: x, y: y, width: clampedW, height: clampedH)

        window.setFrame(clampedFrame, display: false, animate: false)
    }

    /// Stable per-doc name. Untitled docs share one bucket so they all use the default layout.
    static func keyName(for doc: NSDocument) -> String {
        guard let url = doc.fileURL else { return "DocWindow-untitled" }

        if let stable = stableIdentityKey(for: url) {
            return "DocWindow-\(stable)"
        } else {
            // Fallback: based on standardized path (won’t survive moves/renames, but deterministic)
            return "DocWindow-path-\(hashHex(url.standardizedFileURL.path))"
        }
    }

    /// Try to build a move/rename-resistant identity from the file + volume IDs.
    private static func stableIdentityKey(for url: URL) -> String? {
        do {
            let vals = try url.resourceValues(forKeys: [.fileResourceIdentifierKey, .volumeIdentifierKey])
            guard let fid = vals.fileResourceIdentifier, let vid = vals.volumeIdentifier else { return nil }
            return "id-\(hashHex("\(vid)|\(fid)"))"
        } catch { return nil }
    }

    static func migrateSavedFrame(from old: String, to new: String) {
        let defaults = UserDefaults.standard
        let oldKey = "NSWindow Frame \(old)"
        let newKey = "NSWindow Frame \(new)"
        if let v = defaults.string(forKey: oldKey) {
            defaults.set(v, forKey: newKey)
        }
    }

    private static func hashHex(_ s: String) -> String {
        let data = Data(s.utf8)
        #if canImport(CryptoKit)
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
        #else
        // Deterministic FNV-1a 64-bit fallback
        var h: UInt64 = 0xcbf29ce484222325
        for b in data { h ^= UInt64(b); h &*= 0x100000001b3 }
        return String(format: "%016llx", h)
        #endif
    }
}
