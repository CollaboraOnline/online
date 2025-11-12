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

        let baseURL = Bundle.main.resourceURL
        webView.loadHTMLString(Self.html, baseURL: baseURL)
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
      body   { margin: 24px; display: grid; gap: 14px; background-color: rgb(250,250,250); }
      .intro { display: flex; align-items: center; gap: 20px; }
      .intro-text { display: flex; flex-direction: column; justify-content: center; }
      .header { font-family: carlito; font-size: 24px; color: black; font-weight: 700; }
      .subtitle { fotn-family: carlito; font-size: 24px; color: black; font-weight: 400; }
      .subtext { font-family: carlito; font-size: 16px; color: black; font-weight: 400; }
      .btn-group { margins: 10px; }
      .btn-group button { background-color: rgb(250,250,250); margin: 10px; width: 272px; height: 188px; float: left; padding: 10px 14px; border-radius: 8px; border: none; cursor: pointer; }
      .btn-group button:hover { border: 1px solid rgb(132,184,234); }
    </style>
    <body>
      <div class="intro">
        <img src="images/logo.png" alt="logo icon" style="float: left; ">
        <div class="intro-text">
          <span class="header">Let's get started!</span><br />
          <span class="subtitle">Start a new document from one of the following templates.</span>
        </div>
      </div>
      <div class="btn-group">
        <button onclick="window.webkit.messageHandlers.newDoc.postMessage('spreadsheet')">
          <img src="images/x-office-spreadsheet.svg" alt="icon" width="56" height="64"><br />
          <span class="header">Spreadsheet</span><br />
          <span class="subtext">Great for tracking budgets, project<br />
          tasks, or contact lists.</span>
        </button>
        <button onclick="window.webkit.messageHandlers.newDoc.postMessage('text')">
          <img src="images/x-office-document.svg" alt="icon" width="56" height="64"><br />
          <span class="header">Text Document</span><br />
          <span class="subtext">Ideal for notes, reports,<br />
          or formatted letters.</span>
        </button>
        <button onclick="window.webkit.messageHandlers.newDoc.postMessage('presentation')">
          <img src="images/x-office-presentation.svg" alt="icon" width="56" height="64"><br />
          <span class="header">Presentation</span><br />
          <span class="subtext">Perfect for slideshows, pitches,<br />
          or visual reports.</span>
        </button>
      </div>
    </body>
    """
}
