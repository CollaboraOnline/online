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

#import <CollaboraOnlineWebViewKeyboardManager/CollaboraOnlineWebViewKeyboardManager.h>

@interface _COWVKMKeyInputControl : UITextView<UITextViewDelegate> {
    WKWebView *webView;
}

- (instancetype)initForWebView:(nonnull WKWebView *)webView;

@end

@implementation _COWVKMKeyInputControl

- (instancetype)initForWebView:(nonnull WKWebView *)webView {
    self = [super init];

    self->webView = webView;
    self.delegate = self;

    return self;
}

- (void)postMessage:(NSString *)message {

    NSMutableString *js = [NSMutableString string];

    [js appendString:@""
       "{"
       "     const message = "];

    [js appendString:message];

    // We check if window.COKbdMgrCallback is a function, and in that case call that directly.
    // Otherwise we iterate over iframes and post a message that the event listener that we install
    // will receive and handle, and recurse.

    [js appendString:@";"
        "     if (typeof window.COKbdMgrCallback === 'function') {"
        "         window.COKbdMgrCallback(message);"
        "     } else {"
        "         const iframes = document.getElementsByTagName('iframe');"
        "         for (let i = 0; i < iframes.length; i++) {"
        "             iframes[i].contentWindow.postMessage(message, '*');"
        "         };"
        "     }"
        "}"];

    [webView evaluateJavaScript:js
              completionHandler:^(id _Nullable obj, NSError *_Nullable error) {
                if (error) {
                    if (error.userInfo[@"WKJavaScriptExceptionMessage"])
                        NSLog(@"Error when executing JavaScript: %@: %@", error.localizedDescription, error.userInfo[@"WKJavaScriptExceptionMessage"]);
                    else
                        NSLog(@"Error when executing JavaScript: %@", error.localizedDescription);
                }
              }];
}

- (BOOL)textView:(UITextView *)textView shouldChangeTextInRange:(NSRange)range replacementText:(NSString *)text {
    NSLog(@"COKbdMgr: shouldChangeTextInRange({%lu, %lu}, '%@')", (unsigned long)range.location, (unsigned long)range.length, text);
    NSLog(@"self.text is now length %lu '%@'", self.text.length, self.text);

    NSMutableString *quotedText = [NSMutableString string];

    for (unsigned i = 0; i < text.length; i++) {
        const unichar c = [text characterAtIndex:i];
        if (c == '\'' || c == '\\') {
            [quotedText appendString:@"\\"];
            [quotedText appendFormat:@"%c", c];
        } else if (c < ' ' || c >= 0x7F) {
            [quotedText appendFormat:@"\\u%04X", c];
        } else {
            [quotedText appendFormat:@"%c", c];
        }
    }

    NSMutableString *message = [NSMutableString string];

    [message appendFormat:@"{id: 'COKbdMgr', command: 'replaceText', location: %lu, length: %lu, text: '", range.location, range.length];
    [message appendString:quotedText];
    [message appendString:@"'}"];

    [self postMessage:message];

    return YES;
}

- (BOOL)canBecomeFirstResponder {
    return YES;
}

@synthesize hasText;

@end

@interface CollaboraOnlineWebViewKeyboardManager () <WKScriptMessageHandler> {
    WKWebView *webView;
    _COWVKMKeyInputControl *control;
}

@end

@implementation CollaboraOnlineWebViewKeyboardManager

- (CollaboraOnlineWebViewKeyboardManager *)initForWebView:(nonnull WKWebView *)webView {
    self->webView = webView;

    [webView.configuration.userContentController
        addScriptMessageHandler:self
                           name:@"CollaboraOnlineWebViewKeyboardManager"];

    NSString *script = @"window.addEventListener('message', function(event) {"
        "    if (event.data.id === 'COKbdMgr') {"
        "        if (typeof window.COKbdMgrCallback === 'function') {"
        "            window.COKbdMgrCallback(event.data);"
        "         } else {"
        "             const iframes = document.getElementsByTagName('iframe');"
        "             for (let i = 0; i < iframes.length; i++) {"
        "                 iframes[i].contentWindow.postMessage(event.data, '*');"
        "             };"
        "          }"
        "    }"
        "});";

    WKUserScript *userScript = [[WKUserScript alloc] initWithSource:script
                                                      injectionTime:WKUserScriptInjectionTimeAtDocumentEnd
                                                   forMainFrameOnly:NO];

    [webView.configuration.userContentController addUserScript:userScript];

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(keyboardDidHide:)
                                                 name:UIKeyboardDidHideNotification
                                               object:nil];

    return self;
}

- (void)displayKeyboardOfType:(NSString *)type withText:(NSString *)text at:(NSUInteger)location {
    if (control == nil) {
        control = [[_COWVKMKeyInputControl alloc] initForWebView:self->webView];
        if (type != nil) {
            UIKeyboardType keyboardType = UIKeyboardTypeDefault;
            if ([type caseInsensitiveCompare:@"default"] == NSOrderedSame)
                ;
            else if ([type caseInsensitiveCompare:@"asciicapable"] == NSOrderedSame)
                keyboardType = UIKeyboardTypeASCIICapable;
            else if ([type caseInsensitiveCompare:@"numbersandpunctuation"] == NSOrderedSame)
                keyboardType = UIKeyboardTypeNumbersAndPunctuation;
            else if ([type caseInsensitiveCompare:@"url"] == NSOrderedSame)
                keyboardType = UIKeyboardTypeURL;
            else if ([type caseInsensitiveCompare:@"numberpad"] == NSOrderedSame)
                keyboardType = UIKeyboardTypeNumberPad;
            else if ([type caseInsensitiveCompare:@"phonepad"] == NSOrderedSame)
                keyboardType = UIKeyboardTypePhonePad;
            else if ([type caseInsensitiveCompare:@"namephonepad"] == NSOrderedSame)
                keyboardType = UIKeyboardTypeNamePhonePad;
            else if ([type caseInsensitiveCompare:@"emailaddress"] == NSOrderedSame)
                keyboardType = UIKeyboardTypeEmailAddress;
            else if ([type caseInsensitiveCompare:@"decimalpad"] == NSOrderedSame)
                keyboardType = UIKeyboardTypeDecimalPad;
            else if ([type caseInsensitiveCompare:@"asciicapablenumberpad"] == NSOrderedSame)
                keyboardType = UIKeyboardTypeASCIICapableNumberPad;
            else if ([type caseInsensitiveCompare:@"alphabet"] == NSOrderedSame)
                keyboardType = UIKeyboardTypeAlphabet;
            else
                NSLog(@"COKbdMgr: Unrecognized keyboard type %@", type);
            if (keyboardType != UIKeyboardTypeDefault)
                control.keyboardType = keyboardType;
        }
        // Don't auto-capitalize start of input as we have no idea about the context into which it
        // will be added.
        control.autocapitalizationType = UITextAutocapitalizationTypeNone;

        control.text = text;
        control.selectedRange = NSMakeRange(location, 0);

        [self->webView addSubview:control];
        // NSLog(@"COKbdMgr: added _COWVKMKeyInputControl to webView");
        [control becomeFirstResponder];
    }
}

- (void)hideKeyboard {
    if (control != nil) {
        [control removeFromSuperview];
        // NSLog(@"COKbdMgr: removed _COWVKMKeyInputControl from webView");
        control = nil;
    }
}

- (void)userContentController:(nonnull WKUserContentController *)userContentController
      didReceiveScriptMessage:(nonnull WKScriptMessage *)message {
    if (![message.name isEqualToString:@"CollaboraOnlineWebViewKeyboardManager"]) {
        NSLog(@"Received unrecognized script message name: %@ %@", message.name, message.body);
        return;
    }

    if ([message.body isKindOfClass:[NSDictionary class]]) {
        NSString *stringCommand = message.body[@"command"];
        if ([stringCommand isEqualToString:@"display"]) {
            NSString *type = message.body[@"type"];
            NSString *text = message.body[@"text"];
            NSNumber *location = message.body[@"location"];
            [self displayKeyboardOfType:type withText:text at:(location != nil ? [location unsignedIntegerValue] : UINT_MAX)];
        } else if ([stringCommand isEqualToString:@"hide"]) {
            [self hideKeyboard];
        } else if (stringCommand == nil) {
            NSLog(@"No 'command' in %@", message.body);
        } else {
            NSLog(@"Received unrecognized command:%@", stringCommand);
        }
    } else {
        NSLog(@"Received unrecognized message body of type %@: %@, should be a dictionary (JS object)", [message.body class], message.body);
    }
}

- (void)keyboardDidHide:(NSNotification *)notification {
    if (control != nil) {
        [control removeFromSuperview];
        control = nil;
    }
}

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
