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

class ViewController: NSViewController, WKScriptMessageHandler, WKNavigationDelegate {

    /// Access to the NSDocument (document loading & saving infrastructure).
    var document: Document!

    /// The actual webview holding the document.
    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        // Setup jsHandler as the entry point co call back from JavaScript
        let contentController = WKUserContentController()
        contentController.add(self, name: "debug")
        contentController.add(self, name: "lok")
        contentController.add(self, name: "error")

        let config = WKWebViewConfiguration()
        config.userContentController = contentController

        // Create the web view
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self

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
        self.document.loadDocumentInWebView(webView: webView, readOnly: false)
    }

    /**
     * Receive message from JavaScript
     */
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "error" {
            if let body = message.body as? String {
                COWrapper.LOG_ERR("Error from WebView: \(body)")
            }
        }
        else if message.name == "debug" {
            if let body = message.body as? String {
                print("==> \(body)")
            }
        }
        else if message.name == "lok" {
            if let body = message.body as? String {
                COWrapper.LOG_DBG("To Online: \(message.body)")

                if body == "HULLO" {
                    // Now we know that the JS has started completely
                    COWrapper.handleHULLO(with: document)
                    return
                }
                else if body == "BYE" {
                    COWrapper.LOG_TRC("Document window terminating on JavaScript side. Closing our end of the socket.")
                    //self.bye()
                    return
                }
                else if body.starts(with: "MODIFIED ") {
                    document?.isModified = body.hasSuffix("true")
                    return
                }
                else if body == "SLIDESHOW" {
                    COWrapper.LOG_ERR("TODO: Implement slideshow")
                    /*

                    // Create the SVG for the slideshow
                    // You need to wrap the C++ functions used here
                    // Example:
                    // self.slideshowFile = FileUtil.createRandomTmpDir() + "/slideshow.svg"
                    // self.slideshowURL = URL(fileURLWithPath: self.slideshowFile)
                    // DocumentData.get(self.document.appDocId).loKitDocument.saveAs(self.slideshowURL.absoluteString, "svg", nil)

                    // Add a new full-screen WebView displaying the slideshow
                    let configuration = WKWebViewConfiguration()
                    let userContentController = WKUserContentController()
                    userContentController.add(self, name: "lok")
                    configuration.userContentController = userContentController

                    self.slideshowWebView = WKWebView(frame: .zero, configuration: configuration)
                    self.slideshowWebView?.becomeFirstResponder()
                    self.slideshowWebView?.contentMode = .scaleAspectFit
                    self.slideshowWebView?.translatesAutoresizingMaskIntoConstraints = false
                    self.slideshowWebView?.navigationDelegate = self
                    self.slideshowWebView?.uiDelegate = self

                    self.webView.isHidden = true

                    self.view.addSubview(self.slideshowWebView!)
                    self.view.bringSubviewToFront(self.slideshowWebView!)

                    // Add constraints
                    if let slideshowWebView = self.slideshowWebView {
                        NSLayoutConstraint.activate([
                            slideshowWebView.leadingAnchor.constraint(equalTo: self.view.leadingAnchor),
                            slideshowWebView.trailingAnchor.constraint(equalTo: self.view.trailingAnchor),
                            slideshowWebView.topAnchor.constraint(equalTo: self.view.topAnchor),
                            slideshowWebView.bottomAnchor.constraint(equalTo: self.view.bottomAnchor)
                        ])
                    }

                    if let slideshowURL = self.slideshowURL {
                        let request = URLRequest(url: slideshowURL)
                        self.slideshowWebView?.load(request)
                    }
                     */

                    return
                }
                else if body == "EXITSLIDESHOW" {
                    COWrapper.LOG_ERR("TODO: Implement EXITSLIDESHOW")
                    /*
                    // Remove the slideshow file
                    do {
                        try FileManager.default.removeItem(atPath: self.slideshowFile)
                    } catch {
                        COOLWrapper.LOG_ERR("Failed to remove slideshow file: \(error)")
                    }

                    self.slideshowWebView?.removeFromSuperview()
                    self.slideshowWebView = nil
                    self.webView.isHidden = false
                    */
                    return
                }
                else if body == "PRINT" {
                    COWrapper.LOG_ERR("TODO: Implement PRINT")
                    /*
                    // Create the PDF to print
                    // You'll need to wrap the C++ functions used here
                    // Example:
                    // let printFile = FileUtil.createRandomTmpDir() + "/print.pdf"
                    // let printURL = URL(fileURLWithPath: printFile)
                    // DocumentData.get(self.document.appDocId).loKitDocument.saveAs(printURL.absoluteString, "pdf", nil)

                    // Present the print panel
                    let printInfo = NSPrintInfo.shared
                    printInfo.jobName = "Document" // Adjust as needed
                    let printOperation = NSPrintOperation(view: self.webView) // Adjust view as needed
                    printOperation.printInfo = printInfo
                    printOperation.run()

                    // Remove the temporary print file if needed
                    // do {
                    //     try FileManager.default.removeItem(at: printURL)
                    // } catch {
                    //     LOG_ERR("Failed to remove print file: \(error)")
                    // }
                    */

                    return
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
                    return
                }
                else if body.hasPrefix("HYPERLINK") {
                    let messageBodyItems = body.components(separatedBy: " ")
                    if messageBodyItems.count >= 2 {
                        if let url = URL(string: messageBodyItems[1]) {
                            NSWorkspace.shared.open(url)
                            return
                        }
                    }
                    return
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
                    return
                }
                else if body.hasPrefix("downloadas ") {
                    COWrapper.LOG_ERR("TODO: Implement downloadas")
                    /*
                    let messageBodyItems = body.components(separatedBy: " ")
                    var format: String?
                    if messageBodyItems.count >= 2 {
                        for item in messageBodyItems[1...] {
                            if item.hasPrefix("format=") {
                                format = String(item.dropFirst("format=".count))
                            }
                        }
                        guard let format = format else { return }

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
                            COOLWrapper.LOG_ERR("Could not create directory \(tmpFileDirectory.path)")
                            return
                        }
                        let tmpFileName = self.document.copyFileURL.deletingPathExtension().lastPathComponent + "." + adjustedFormat
                        self.downloadAsTmpURL = tmpFileDirectory.appendingPathComponent(tmpFileName)

                        // Remove any existing file
                        do {
                            try FileManager.default.removeItem(at: self.downloadAsTmpURL!)
                        } catch {
                            // File may not exist, ignore error
                        }

                        // Save the document using your C++ code
                        // Example:
                        // DocumentData.get(self.document.appDocId).loKitDocument.saveAs(self.downloadAsTmpURL!.absoluteString, adjustedFormat, nil)

                        // Verify the file was saved
                        let fileExists = FileManager.default.fileExists(atPath: self.downloadAsTmpURL!.path)
                        if !fileExists {
                            COOLWrapper.LOG_ERR("Could not save to '\(self.downloadAsTmpURL!.path)'")
                            return
                        }

                        // Present a save panel to let the user choose where to save the file
                        let savePanel = NSSavePanel()
                        savePanel.directoryURL = FileManager.default.homeDirectoryForCurrentUser
                        savePanel.nameFieldStringValue = tmpFileName
                        savePanel.begin { (result) in
                            if result == .OK, let url = savePanel.url {
                                do {
                                    try FileManager.default.copyItem(at: self.downloadAsTmpURL!, to: url)
                                    // Remove the temporary file
                                    try FileManager.default.removeItem(at: self.downloadAsTmpURL!)
                                } catch {
                                    COOLWrapper.LOG_ERR("Error during file save: \(error)")
                                }
                            }
                        }
                        return
                    }
                    */
                    return
                }
                else {
                    // Just send the message
                    COWrapper.handleMessage(with: document, message: body)
                }
            }
        }
        else {
            if let body = message.body as? String {
                COWrapper.LOG_ERR("Unrecognized kind of message received from WebView: \(message.name):\(body)")
            }
            else {
                COWrapper.LOG_ERR("Unrecognized kind of message received from WebView: \(message.name)")
            }
        }
    }
}
