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
final class BackstageViewController: NSViewController, WKScriptMessageHandler {

    /** Callback invoked with the selected template kind when a button is clicked in the web view. */
    var onSelect: ((DocumentController.NewKind) -> Void)?

    /** Embedded web view hosting the HTML UI for the 3-button chooser. */
    private var webView: WKWebView!

    /** Creates an empty root view to host the web view. */
    override func loadView() {
        self.view = NSView()
    }

    /**
     * Builds the WKWebView, installs the “newDoc” JS bridge, and loads the HTML from the app bundle.
     */
    override func viewDidLoad() {
        super.viewDidLoad()

        let cfg = WKWebViewConfiguration()
        cfg.userContentController.add(self, name: "backstage")
        webView = WKWebView(frame: .zero, configuration: cfg)
        webView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        // Load create-new-document.html from the bundle, allowing read access to its folder for relative assets.
        guard let url = Bundle.main.url(forResource: "cool", withExtension: "html") else {
            NSLog("BackstageViewController: cool.html not found in bundle")
            webView.loadHTMLString("<p>Missing <code>cool.html</code> in the bundle.</p>", baseURL: nil)
            return
        }

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!

        // Make sure cool.html starts as the startup Backstage
        components.queryItems = [
            URLQueryItem(name: "starterMode", value: "true")
        ]

        // And also add common parameters, like "lang" or "darkTheme"
        Document.addCommonCOOLQueryItems(to: &components)

        // Allow access for additional resources
        let dir = url.deletingLastPathComponent()
        let finalURL = components.url!
        webView.loadFileURL(finalURL, allowingReadAccessTo: dir)
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
}
