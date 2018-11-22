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
#import "Log.hpp"
#import "Util.hpp"

#import "DocumentViewController.h"

@interface DocumentViewController() <WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler> {
    int closeNotificationPipeForForwardingThread[2];
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
            [self.document closeWithCompletionHandler:^(BOOL success){
                    LOG_TRC("close completion handler gets " << (success?"YES":"NO"));
                    }];
    }];
}

- (void)webView:(WKWebView *)webView didCommitNavigation:(WKNavigation *)navigation {
    LOG_TRC("didCommitNavigation: " << [[navigation description] UTF8String]);
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    LOG_TRC("didFailNavigation: " << [[navigation description] UTF8String]);
}

- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    LOG_TRC("didFailProvisionalNavigation: " << [[navigation description] UTF8String]);
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    LOG_TRC("didFinishNavigation: " << [[navigation description] UTF8String]);
}

- (void)webView:(WKWebView *)webView didReceiveServerRedirectForProvisionalNavigation:(WKNavigation *)navigation {
    LOG_TRC("didReceiveServerRedirectForProvisionalNavigation: " << [[navigation description] UTF8String]);
}

- (void)webView:(WKWebView *)webView didStartProvisionalNavigation:(WKNavigation *)navigation {
    LOG_TRC("didStartProvisionalNavigation: " << [[navigation description] UTF8String]);
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    LOG_TRC("decidePolicyForNavigationAction: " << [[navigationAction description] UTF8String]);
    decisionHandler(WKNavigationActionPolicyAllow);
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationResponse:(WKNavigationResponse *)navigationResponse decisionHandler:(void (^)(WKNavigationResponsePolicy))decisionHandler {
    LOG_TRC("decidePolicyForNavigationResponse: " << [[navigationResponse description] UTF8String]);
    decisionHandler(WKNavigationResponsePolicyAllow);
}

- (WKWebView *)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration forNavigationAction:(WKNavigationAction *)navigationAction windowFeatures:(WKWindowFeatures *)windowFeatures {
    LOG_TRC("createWebViewWithConfiguration");
    return webView;
}

- (void)webView:(WKWebView *)webView runJavaScriptAlertPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completionHandler {
    LOG_TRC("runJavaScriptAlertPanelWithMessage: " << [message UTF8String]);
    //    UIAlertView *alert = [[UIAlertView alloc] initWithTitle:@""
    //                                                    message:message
    //                                                   delegate:nil
    //                                          cancelButtonTitle:nil
    //                                          otherButtonTitles:@"OK", nil];
    //    [alert show];
    completionHandler();
}

- (void)webView:(WKWebView *)webView runJavaScriptConfirmPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL result))completionHandler {
    LOG_TRC("runJavaScriptConfirmPanelWithMessage: " << [message UTF8String]);
    completionHandler(YES);
}

- (void)webView:(WKWebView *)webView runJavaScriptTextInputPanelWithPrompt:(NSString *)prompt defaultText:(NSString *)defaultText initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(NSString *result))completionHandler {
    LOG_TRC("runJavaScriptTextInputPanelWithPrompt: " << [prompt UTF8String]);
    completionHandler(@"Something happened.");
}

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    int rc;
    struct pollfd p;

    if ([message.name isEqualToString:@"error"]) {
        LOG_ERR("Error from WebView: " << [message.body UTF8String]);
    } else if ([message.name isEqualToString:@"debug"]) {
        LOG_TRC_NOFILE("==> " << [message.body UTF8String]);
    } else if ([message.name isEqualToString:@"lool"]) {
        LOG_TRC("To Online: " << [message.body UTF8String]);

        if ([message.body isEqualToString:@"HULLO"]) {
            // Now we know that the JS has started completely

            // Contact the permanently (during app lifetime) listening LOOLWSD server
            // "public" socket
            assert(loolwsd_server_socket_fd != -1);
            rc = fakeSocketConnect(self.document->fakeClientFd, loolwsd_server_socket_fd);
            assert(rc != -1);

            // Create a socket pair to notify the below thread when the document has been closed
            fakeSocketPipe2(closeNotificationPipeForForwardingThread);

            // Start another thread to read responses and forward them to the JavaScript
            dispatch_async(dispatch_get_global_queue( DISPATCH_QUEUE_PRIORITY_DEFAULT, 0),
                           ^{
                               Util::setThreadName("app2js");
                               while (true) {
                                   struct pollfd p[2];
                                   p[0].fd = self.document->fakeClientFd;
                                   p[0].events = POLLIN;
                                   p[1].fd = self->closeNotificationPipeForForwardingThread[1];
                                   p[1].events = POLLIN;
                                   if (fakeSocketPoll(p, 2, -1) > 0) {
                                       if (p[1].revents == POLLIN) {
                                           // The code below handling the "BYE" fake Websocket
                                           // message has closed the other end of the
                                           // closeNotificationPipeForForwardingThread. Let's close
                                           // the other end too just for cleanliness, even if a
                                           // FakeSocket as such is not a system resource so nothing
                                           // is saved by closing it.
                                           fakeSocketClose(self->closeNotificationPipeForForwardingThread[1]);

                                           // Close our end of the fake socket connection to the
                                           // ClientSession thread, so that it terminates
                                           fakeSocketClose(self.document->fakeClientFd);

                                           return;
                                       }
                                       if (p[0].revents == POLLIN) {
                                           int n = fakeSocketAvailableDataLength(self.document->fakeClientFd);
                                           if (n == 0)
                                               return;
                                           std::vector<char> buf(n);
                                           n = fakeSocketRead(self.document->fakeClientFd, buf.data(), n);
                                           [self.document send2JS:buf.data() length:n];
                                       }
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
        } else if ([message.body isEqualToString:@"BYE"]) {
            LOG_TRC("Document window terminating on JavaScript side. Closing our end of the socket.");

            // Close one end of the socket pair, that will wake up the forwarding thread above
            fakeSocketClose(closeNotificationPipeForForwardingThread[0]);

            [self dismissDocumentViewController];
            return;
        }

        const char *buf = [message.body UTF8String];
        p.fd = self.document->fakeClientFd;
        p.events = POLLOUT;
        fakeSocketPoll(&p, 1, -1);
        fakeSocketWrite(self.document->fakeClientFd, buf, strlen(buf));
    } else {
        LOG_ERR("Unrecognized kind of message received from WebView: " << [message.name UTF8String] << ":" << [message.body UTF8String]);
    }
}

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
