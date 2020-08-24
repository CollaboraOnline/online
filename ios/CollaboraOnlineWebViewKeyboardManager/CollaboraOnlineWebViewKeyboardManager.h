// -*- Mode: ObjC; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#import <WebKit/WebKit.h>

@interface CollaboraOnlineWebViewKeyboardManager : NSObject

/**
 * @param webView The WKWebView that displays Collabora Online's loleaflet.html. Will not do
 * anything useful for WKWebViews not displaying that. The loleaflet.html can be in an arbitrarily
 * deeply nested iframe.
 */
- (nonnull CollaboraOnlineWebViewKeyboardManager *)initForWebView:(nonnull WKWebView *)webView;

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
