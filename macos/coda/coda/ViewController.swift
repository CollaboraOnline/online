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

    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        // setup jsHandler as the entry point co call back from JavaScript
        let contentController = WKUserContentController()
        contentController.add(self, name: "jsHandler")

        let config = WKWebViewConfiguration()
        config.userContentController = contentController

        // create the web view
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self

        // add it to the view controller's view
        self.view.addSubview(webView)

        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: self.view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: self.view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: self.view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: self.view.bottomAnchor)
        ])

        // load the local HTML file
        if let htmlPath = Bundle.main.path(forResource: "cool", ofType: "html") {
            let htmlURL = URL(fileURLWithPath: htmlPath)
            webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        }
    }

    // Send 'hello' message once the content finishes loading
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("receiveMessage('hello');", completionHandler: nil)
    }

    // Receive message from JavaScript
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "jsHandler", let response = message.body as? String {
            print("Received message from JS: \(response)")
        }
    }
}
