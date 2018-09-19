// -*- Mode: ObjC; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This file is part of the LibreOffice project.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#import "config.h"

#import <string>
#import <vector>

#import <poll.h>

#import "ios.h"
#import "FakeSocket.hpp"

#import "DocumentViewController.h"

@interface DocumentViewController() <WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler> {
    BOOL waitingForInitialLoad;
}

@end

@implementation DocumentViewController

- (void)viewDidLoad {
    [super viewDidLoad];

    WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
    WKUserContentController *userContentController = [[WKUserContentController alloc] init];

    [userContentController addScriptMessageHandler:self name:@"debug"];
    [userContentController addScriptMessageHandler:self name:@"lool"];
    [userContentController addScriptMessageHandler:self name:@"error"];

    configuration.userContentController = userContentController;

    self.webView = [[WKWebView alloc] initWithFrame:CGRectZero configuration:configuration];
    self.webView.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:self.webView];

    self.webView.navigationDelegate = self;
    self.webView.UIDelegate = self;

    WKWebView *webViewP = self.webView;
    NSDictionary *views = NSDictionaryOfVariableBindings(webViewP);
    [self.view addConstraints:[NSLayoutConstraint constraintsWithVisualFormat:@"H:|-0-[webViewP(>=0)]-0-|"
                                                                      options:0
                                                                      metrics:nil
                                                                        views:views]];
    [self.view addConstraints:[NSLayoutConstraint constraintsWithVisualFormat:@"V:|-0-[webViewP(>=0)]-0-|"
                                                                      options:0
                                                                      metrics:nil
                                                                        views:views]];
}

- (void)viewWillAppear:(BOOL)animated {
    [super viewWillAppear:animated];

    // Access the document
    [self.document openWithCompletionHandler:^(BOOL success) {
        if (success) {
            // Display the content of the document

        } else {
            // Make sure to handle the failed import appropriately, e.g., by presenting an error message to the user.
        }
    }];
}

- (IBAction)dismissDocumentViewController {
    [self dismissViewControllerAnimated:YES completion:^ {
        [self.document closeWithCompletionHandler:nil];
    }];
}

- (void)webView:(WKWebView *)webView didCommitNavigation:(WKNavigation *)navigation {
    NSLog(@"didCommitNavigation: %@", navigation);
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    NSLog(@"didFailNavigation: %@", navigation);
}

- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    NSLog(@"didFailProvisionalNavigation: %@", navigation);
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    NSLog(@"didFinishNavigation: %@", navigation);
}

- (void)webView:(WKWebView *)webView didReceiveServerRedirectForProvisionalNavigation:(WKNavigation *)navigation {
    NSLog(@"didReceiveServerRedirectForProvisionalNavigation: %@", navigation);
}

- (void)webView:(WKWebView *)webView didStartProvisionalNavigation:(WKNavigation *)navigation {
    NSLog(@"didStartProvisionalNavigation: %@", navigation);
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    NSLog(@"decidePolicyForNavigationAction: %@", navigationAction);
    decisionHandler(WKNavigationActionPolicyAllow);
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationResponse:(WKNavigationResponse *)navigationResponse decisionHandler:(void (^)(WKNavigationResponsePolicy))decisionHandler {
    NSLog(@"decidePolicyForNavigationResponse: %@", navigationResponse);
    decisionHandler(WKNavigationResponsePolicyAllow);
}

- (WKWebView *)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration forNavigationAction:(WKNavigationAction *)navigationAction windowFeatures:(WKWindowFeatures *)windowFeatures {
    NSLog(@"createWebViewWithConfiguration");
    return webView;
}

- (void)webView:(WKWebView *)webView runJavaScriptAlertPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completionHandler {
    NSLog(@"runJavaScriptAlertPanelWithMessage: %@", message);
    //    UIAlertView *alert = [[UIAlertView alloc] initWithTitle:@""
    //                                                    message:message
    //                                                   delegate:nil
    //                                          cancelButtonTitle:nil
    //                                          otherButtonTitles:@"OK", nil];
    //    [alert show];
    completionHandler();
}

- (void)webView:(WKWebView *)webView runJavaScriptConfirmPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL result))completionHandler {
    NSLog(@"runJavaScriptConfirmPanelWithMessage: %@", message);
    completionHandler(YES);
}

- (void)webView:(WKWebView *)webView runJavaScriptTextInputPanelWithPrompt:(NSString *)prompt defaultText:(NSString *)defaultText initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(NSString *result))completionHandler {
    NSLog(@"runJavaScriptTextInputPanelWithPrompt: %@", prompt);
    completionHandler(@"Something happened.");
}

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    int rc;
    struct pollfd p;

    if ([message.name isEqualToString:@"error"]) {
        NSLog(@"Error from WebView: %@", message.body);
    } else if ([message.name isEqualToString:@"debug"]) {
        NSLog(@"===== %@", message.body);
    } else if ([message.name isEqualToString:@"lool"]) {
        NSLog(@"===== To Online: %@", message.body);

        if ([message.body isEqualToString:@"HULLO"]) {
            // Now we know that the JS has started completely

            // Contact the permanently (during app lifetime) listening LOOLWSD server
            // "public" socket
            assert(loolwsd_server_socket_fd != -1);
            rc = fakeSocketConnect(self.document->fakeClientFd, loolwsd_server_socket_fd);
            assert(rc != -1);

            // Start another thread to read responses and forward them to the JavaScript
            dispatch_async(dispatch_get_global_queue( DISPATCH_QUEUE_PRIORITY_DEFAULT, 0),
                           ^{
                               while (true) {
                                   struct pollfd p;
                                   p.fd = self.document->fakeClientFd;
                                   p.events = POLLIN;
                                   if (fakeSocketPoll(&p, 1, -1) == 1) {
                                       int n = fakeSocketAvailableDataLength(self.document->fakeClientFd);
                                       if (n == 0)
                                           return;
                                       std::vector<char> buf(n);
                                       n = fakeSocketRead(self.document->fakeClientFd, buf.data(), n);
                                       [self.document send2JS:buf.data() length:n];
                                   }
                                   else
                                       break;
                               }
                               assert(false);
                           });

            // First we simply send it the URL. This corresponds to the GET request with Upgrade to
            // WebSocket.
            std::string url([[[self.document fileURL] absoluteString] UTF8String]);
            p.fd = self.document->fakeClientFd;
            p.events = POLLOUT;
            fakeSocketPoll(&p, 1, -1);
            fakeSocketWrite(self.document->fakeClientFd, url.c_str(), url.size());

            return;
        }

        const char *buf = [message.body UTF8String];
        p.fd = self.document->fakeClientFd;
        p.events = POLLOUT;
        fakeSocketPoll(&p, 1, -1);
        fakeSocketWrite(self.document->fakeClientFd, buf, strlen(buf));
    } else {
        NSLog(@"Unrecognized kind of message received from WebView: %@: %@", message.name, message.body);
    }
}

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
