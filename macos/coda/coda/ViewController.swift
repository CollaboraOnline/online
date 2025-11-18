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

final class ConsoleController: NSWindowController {
    let webView: WKWebView

    init(webView: WKWebView) {
        self.webView = webView
        let style: NSWindow.StyleMask = [.closable, .resizable, .miniaturizable]
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1000, height: 640),
                              styleMask: style, backing: .buffered, defer: false)
        super.init(window: window)

        // put the webView into the window
        webView.translatesAutoresizingMaskIntoConstraints = false
        window.contentView?.addSubview(webView)

        if let content = window.contentView {
            NSLayoutConstraint.activate([
                webView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
                webView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
                webView.topAnchor.constraint(equalTo: content.topAnchor),
                webView.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            ])
        }
    }

    required init?(coder: NSCoder) { fatalError("doesn't seem to matter") }
}

class ViewController: NSViewController, WKScriptMessageHandlerWithReply, WKNavigationDelegate, WKUIDelegate {

    /// Access to the NSDocument (document loading & saving infrastructure).
    var document: Document!

    /// The actual webview holding the document.
    var webView: WKWebView!

    var consoleWindow: ConsoleController!

    var savedViewFrame: NSRect!

    var observer: AnyObject!

    override func viewDidLoad() {
        super.viewDidLoad()

        // Setup jsHandler as the entry point co call back from JavaScript
        let contentController = WKUserContentController()
        contentController.addScriptMessageHandler(self, contentWorld: .page, name: "debug")
        contentController.addScriptMessageHandler(self, contentWorld: .page, name: "lok")
        contentController.addScriptMessageHandler(self, contentWorld: .page, name: "error")
        contentController.addScriptMessageHandler(self, contentWorld: .page, name: "clipboard")

        let config = WKWebViewConfiguration()
        config.preferences.isElementFullscreenEnabled = true
        config.userContentController = contentController

        // Create the web view
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self

#if DEBUG
        // Enable possibility to debug the webview from Safari
        webView.isInspectable = true
#endif

        // Add it to the view controller's view
        self.view.addSubview(webView)

        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: self.view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: self.view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: self.view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: self.view.bottomAnchor)
        ])
    }

    /**
     * Load the the document; to be called from the Document (NSDocument) instance.
     */
    func loadDocument(_ document: Document) {
        self.document = document
        let permission = document.isWelcome ? "view" : "edit"
        self.document.loadDocumentInWebView(webView: webView, permission: permission, isWelcome: document.isWelcome)
    }

    /**
     * Receive message from JavaScript, with the possibility to reply
     */
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) async -> (Any?, String?) {
        switch message.name {

        case "error":
            if let body = message.body as? String {
                COWrapper.LOG_ERR("Error from WebView: \(body)")
            }

        case "debug":
            if let body = message.body as? String {
                print("==> \(body)")
            }

        case "clipboard":
            if let body = message.body as? String {
                switch body {

                case "read":
                    COWrapper.setClipboard(document, from: .general)
                    return ("(internal)", nil);

                case "write":
                    guard let content = COWrapper.getClipboard(document) else {
                        COWrapper.LOG_ERR("Failed to get clipboard contents")
                        return (nil, nil)
                    }
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.writeObjects(content)

                case let s where s.hasPrefix("sendToInternal "):
                    if !COWrapper.sendToInternalClipboard(document, content: String(s.dropFirst("sendToInternal ".count))) {
                        COWrapper.LOG_ERR("set clipboard returned failure");
                        return (nil, "set clipboard returned failure");
                    }

                default:
                    COWrapper.LOG_ERR("Invalid clipboard action \(body)")
                }
            }

        case "lok":
            if let body = message.body as? String {
                COWrapper.LOG_DBG("To Online: '\(message.body)'")

                if body == "HULLO" {
                    // Now we know that the JS has started completely
                    COWrapper.handleHULLO(with: document)
                    return (nil, nil)
                }
                else if body == "BYE" {
                    COWrapper.LOG_TRC("Document window terminating on JavaScript side. Closing our end of the socket.")
                    view.window?.performClose(nil)
                    return (nil, nil)
                }
                else if body.hasPrefix("COMMANDSTATECHANGED ") {
                    if let brace = body.firstIndex(of: "{") {
                        // substring that shares storage with the original string
                        let jsonSlice = body[brace...]

                        // convert directly to Data and decode.
                        let data = Data(jsonSlice.utf8)
                        do {
                            let state = try JSONDecoder().decode(CommandStateChange.self, from: data)

                            // Has the modification state of the document changed?
                            // This is smportant for saving which has to copy the document from the temporary location.
                            if state.commandName == ".uno:ModifiedStatus" {
                                document?.isModified = (state.state == "true")
                            }

                            // remember states of the commands for app menu handling
                            if let windowController = view.window?.windowController as? WindowController {
                                windowController.handleCommandStateChange(state)
                            }
                        } catch {}
                    }
                }
                else if body.hasPrefix("COMMANDRESULT ") {
                    if let brace = body.firstIndex(of: "{") {
                        // substring that shares storage with the original string
                        let jsonSlice = body[brace...]

                        // convert directly to Data and decode.
                        let data = Data(jsonSlice.utf8)
                        do {
                            let result = try JSONDecoder().decode(CommandResult.self, from: data)

                            // Was it a successful save?
                            if result.commandName == ".uno:Save" && result.success == true && result.wasModified == true {
                                document.triggerSave()
                            }
                        } catch {}
                    }
                }
                else if body == "PRINT" {
                    document.printDocument(self)
                    return (nil, nil)
                }
                else if body == "FOCUSIFHWKBD" {
                    COWrapper.LOG_ERR("TODO: Implement FOCUSIFHWKBD")
                    /*
                    if isExternalKeyboardAttached() {
                        let hwKeyboardMagic = """
                                {
                                    if (window.MagicToGetHWKeyboardWorking) {
                                        window.MagicToGetHWKeyboardWorking();
                                    }
                                }
                                """
                        self.webView.evaluateJavaScript(hwKeyboardMagic) { (result, error) in
                            if let error = error {
                                COOLWrapper.LOG_ERR("Error after \(hwKeyboardMagic): \(error.localizedDescription)")
                                if let jsException = (error as NSError).userInfo["WKJavaScriptExceptionMessage"] as? String {
                                    COOLWrapper.LOG_ERR("JavaScript exception: \(jsException)")
                                }
                            }
                        }
                    }
                    */
                    return (nil, nil)
                }
                else if body.hasPrefix("HYPERLINK") {
                    let messageBodyItems = body.components(separatedBy: " ")
                    if messageBodyItems.count >= 2 {
                        if let url = URL(string: messageBodyItems[1]) {
                            NSWorkspace.shared.open(url)
                            return (nil, nil)
                        }
                    }
                    return (nil, nil)
                }
                else if body == "FONTPICKER" {
                    COWrapper.LOG_ERR("TODO: Implement FONTPICKER")
                    /*
                    // Font picker is not available on macOS like on iOS, but you can use NSFontPanel
                    let fontManager = NSFontManager.shared
                    fontManager.target = self
                    fontManager.action = #selector(changeFont(_:))
                    fontManager.orderFrontFontPanel(self)
                    */
                    return (nil, nil)
                }
                else if body == "WELCOME" {
                    (NSDocumentController.shared as? DocumentController)?.openWelcome()
                    return (nil, nil)
                }
                else if body == "LICENSE" {
                    guard let url = Bundle.main.url(forResource: "LICENSE", withExtension: "html") else {
                        COWrapper.LOG_ERR("LICENSE.html not found in bundle")
                        return (nil, nil)
                     }

                     NSWorkspace.shared.open(url)
                     return (nil, nil)
                }
                else if body.hasPrefix("downloadas ") {
                    let messageBodyItems = body.components(separatedBy: " ")
                    var format: String?
                    if messageBodyItems.count >= 2 {
                        for item in messageBodyItems[1...] {
                            if item.hasPrefix("format=") {
                                format = String(item.dropFirst("format=".count))
                            }
                        }
                        guard let format = format else { return (nil, nil) }

                        // Handle special "direct-" formats
                        var adjustedFormat = format
                        if adjustedFormat.hasPrefix("direct-") {
                            adjustedFormat = String(adjustedFormat.dropFirst("direct-".count))
                        }

                        // Save the document in the requested format
                        let tmpFileDirectory = FileManager.default.temporaryDirectory.appendingPathComponent("export")
                        do {
                            try FileManager.default.createDirectory(at: tmpFileDirectory, withIntermediateDirectories: true, attributes: nil)
                        } catch {
                            COWrapper.LOG_ERR("Could not create directory \(tmpFileDirectory.path)")
                            return (nil, nil)
                        }

                        // Remove the original extension from the file name and add the adjustedFormat
                        guard let tmpFileName = self.document?.tempFileURL?.deletingPathExtension().appendingPathExtension(adjustedFormat).lastPathComponent else { return (nil, nil) }
                        let downloadAsTmpURL = tmpFileDirectory.appendingPathComponent(tmpFileName)

                        // Remove any existing file
                        do {
                            try FileManager.default.removeItem(at: downloadAsTmpURL)
                        } catch {
                            // File may not exist, ignore error
                        }

                        // Perform the actual Save As
                        COWrapper.saveAs(with: document, url: downloadAsTmpURL.absoluteString, format: adjustedFormat, filterOptions: nil)

                        // Verify the file was saved
                        let fileExists = FileManager.default.fileExists(atPath: downloadAsTmpURL.path)
                        if !fileExists {
                            COWrapper.LOG_ERR("Could not save to '\(downloadAsTmpURL.path)'")
                            return (nil, nil)
                        }

                        // Present a save panel to let the user choose where to save the file
                        let savePanel = NSSavePanel()
                        savePanel.directoryURL = FileManager.default.homeDirectoryForCurrentUser
                        savePanel.nameFieldStringValue = tmpFileName
                        savePanel.begin { (result) in
                            if result == .OK, let url = savePanel.url {
                                do {
                                    try FileManager.default.copyItem(at: downloadAsTmpURL, to: url)
                                    // Remove the temporary file
                                    try FileManager.default.removeItem(at: downloadAsTmpURL)
                                } catch {
                                    COWrapper.LOG_ERR("Error during file save: \(error)")
                                }
                            }
                        }
                    }
                    return (nil, nil)
                }
                else if body.hasPrefix("newdoc ") {
                    let messageBodyItems = body.components(separatedBy: " ")
                    var type: String?
                    if messageBodyItems.count >= 2 {
                        for item in messageBodyItems[1...] {
                            if item.hasPrefix("type=") {
                                type = String(item.dropFirst("type=".count))
                            }
                        }

                        let kind: DocumentController.NewKind
                        switch type {
                            case "calc": kind = .spreadsheet
                            case "impress": kind = .presentation
                            default : kind = .text
                        }

                        (NSDocumentController.shared as? DocumentController)?.createDocument(fromTemplateFor: kind)
                    }
                }
                else if body == "uno .uno:Open" {
                    // FIXME A real message would be preferred over intercepting a uno command; but this is what the backstage currently uses
                    (NSDocumentController.shared as? DocumentController)?.focusOrPresentOpenPanel()
                }
                else {
                    // Just send the message
                    COWrapper.handleMessage(with: document, message: body)
                }
            }

        default:
            if let body = message.body as? String {
                COWrapper.LOG_ERR("Unrecognized kind of message received from WebView: \(message.name):\(body)")
            }
            else {
                COWrapper.LOG_ERR("Unrecognized kind of message received from WebView: \(message.name)")
            }
        }

        return (nil, nil)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        COWrapper.LOG_ERR("createWebViewWith \(navigationAction.request.url)")

        let consoleWebView = WKWebView(frame: .zero, configuration: configuration)
        consoleWebView.uiDelegate = self

        let wc = ConsoleController(webView: consoleWebView)
        self.consoleWindow = wc

        let window = view.window!

        self.savedViewFrame = window.frame;

        let screens = NSScreen.screens

        var laptopScreen: NSScreen! = nil
        var externalScreen: NSScreen! = nil

        if (screens.count > 1)
        {
            // Lets see if there is are two monitors where one is built-in and one is not.
            for screen in screens {
                let viewDisplayID = screen.deviceDescription[NSDeviceDescriptionKey(rawValue: "NSScreenNumber")] as! CGDirectDisplayID
                if (CGDisplayIsBuiltin(viewDisplayID) != 0) {
                    if (laptopScreen == nil) {
                        laptopScreen = screen
                    }
                } else {
                    if (externalScreen == nil) {
                        externalScreen = screen
                    }
                }
            }

            // If not then assume the main screen, which is just where the current activity is,
            // is the laptop screen and pick another to be the external
            if (laptopScreen == nil || externalScreen == nil) {
                laptopScreen = NSScreen.main
                for screen in screens {
                    if (screen != laptopScreen) {
                        externalScreen = screen;
                        break;
                    }
                }
            }

            let behaviors: NSWindow.CollectionBehavior = [.fullScreenAllowsTiling, .fullScreenPrimary]

            window.collectionBehavior = behaviors
            window.setFrame(externalScreen.frame, display: true, animate: false)

            // Observe full-screen exit, and at that point dispatch the attempt to restore
            // original monitor, size & position. Otherwise we remain on the monitor we are
            // presenting to.
            let center = NotificationCenter.default
            self.observer = center.addObserver(
                forName: NSWindow.didExitFullScreenNotification,
                object: window,
                queue: OperationQueue.main) { _ in

                    DispatchQueue.main.async {
                        window.setFrame(self.savedViewFrame, display: true, animate: false)
                        window.makeKeyAndOrderFront(nil)
                    }

                    center.removeObserver(self.observer!)
            }

            window.toggleFullScreen(nil)

            let window2 = wc.window!;
            window2.collectionBehavior = behaviors
            window2.setFrame(laptopScreen.frame, display: true, animate: false)
            window2.toggleFullScreen(nil)
        }

        return consoleWebView
    }

    func webViewDidClose(_ webView: WKWebView) {
        if (self.consoleWindow != nil && webView == self.consoleWindow.webView) {
            self.consoleWindow.close()
            self.consoleWindow = nil;

            // this will trigger the restoration of original location/size
            // via the convoluted observer stuff.
            self.view.window!.toggleFullScreen(nil)
        }
    }
}
