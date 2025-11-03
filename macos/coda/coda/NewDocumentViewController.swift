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

/**
 * Presents a WKWebView-based “New…” dialog and forwards the user’s choice back to the controller.
 */
final class NewDocumentViewController: NSViewController, WKScriptMessageHandler {

    /** Callback invoked with the selected template kind when a button is clicked in the web view. */
    var onSelect: ((DocumentController.NewKind) -> Void)?

    /** Embedded web view hosting the HTML UI for the 3-button chooser. */
    private var webView: WKWebView!

    /** Creates an empty root view to host the web view. */
    override func loadView() {
        self.view = NSView()
    }

    /**
     * Builds the WKWebView, installs the “newDoc” JS bridge, and loads the inline HTML.
     */
    override func viewDidLoad() {
        super.viewDidLoad()

        let cfg = WKWebViewConfiguration()
        cfg.userContentController.add(self, name: "newDoc")
        webView = WKWebView(frame: .zero, configuration: cfg)
        webView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        webView.loadHTMLString(Self.html, baseURL: nil)
    }

    /**
     * Receives “newDoc” messages from HTML buttons and forwards the selection via `onSelect`
     */
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "newDoc", let s = message.body as? String else { return }
        switch s {
        case "text":         onSelect?(.text)
        case "spreadsheet":  onSelect?(.spreadsheet)
        case "presentation": onSelect?(.presentation)
        default: break
        }
    }

    /**
     * Removes the message handler to avoid leaks or lingering callbacks after deallocation.
     */
    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "newDoc")
    }

    /** Inline HTML/CSS/JS for the 3-button chooser; posts “newDoc” messages back to Swift. */
    static let html = """
    <!doctype html>
    <meta charset="utf-8">
    <meta name="viewport" content="initial-scale=1">
    <style>
      :root { color-scheme: light dark; }
      body   { font: 14px -apple-system, system-ui; margin: 24px; display: grid; gap: 14px; }
      h2     { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
      button { padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(0,0,0,.2); cursor: default; }
      button:hover { filter: brightness(1.03); }
    </style>
    <body>
      <h2>Create</h2>
      <button onclick="window.webkit.messageHandlers.newDoc.postMessage('text')">New Document</button>
      <button onclick="window.webkit.messageHandlers.newDoc.postMessage('spreadsheet')">New Spreadsheet</button>
      <button onclick="window.webkit.messageHandlers.newDoc.postMessage('presentation')">New Presentation</button>
    </body>
    """
}
