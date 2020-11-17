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
    BOOL lastWasNewline;
}

- (instancetype)initForWebView:(nonnull WKWebView *)webView;

@end

@implementation _COWVKMKeyInputControl

- (instancetype)initForWebView:(nonnull WKWebView *)webView {
    self = [super init];

    self->webView = webView;
    self->lastWasNewline = NO;
    self.delegate = self;

    return self;
}

- (NSString*) describeUIPresses:(NSSet<UIPress *> *)presses {
    NSString *result = @"";

    if (@available(iOS 13.4, *)) {
        NSString *comma = @"";
        NSString *dash = @"";

        for (UIPress *press in presses) {
            result = [result stringByAppendingString:comma];
            if ([press key].modifierFlags & UIKeyModifierShift) {
                result = [result stringByAppendingString:@"Shift"];
                dash = @"-";
            }
            if ([press key].modifierFlags & UIKeyModifierControl) {
                result = [result stringByAppendingString:dash];
                dash = @"-";
                result = [result stringByAppendingString:@"Control"];
            }
            if ([press key].modifierFlags & UIKeyModifierAlternate) {
                result = [result stringByAppendingString:dash];
                dash = @"-";
                result = [result stringByAppendingString:@"Option"];
            }
            if ([press key].modifierFlags & UIKeyModifierCommand) {
                result = [result stringByAppendingString:dash];
                dash = @"-";
                result = [result stringByAppendingString:@"Command"];
            }
            NSString *characters = [[press key] charactersIgnoringModifiers];
            if (![characters isEqualToString:@""]) {
                result = [result stringByAppendingString:dash];
                result = [result stringByAppendingString: characters];
            }
            dash = @"";
            comma = @",";
        }
    }

    return result;
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

- (void)sendUnoCommand:(NSString *)command {
    NSString *message = [NSString stringWithFormat:@"{id: 'COKbdMgr', command: 'unoCommand', uno: '%@'}", command];
    [self postMessage:message];
}

- (BOOL)textView:(UITextView *)textView shouldChangeTextInRange:(NSRange)range replacementText:(NSString *)text {
    NSLog(@"COKbdMgr: shouldChange({%lu, %lu}, '%@'), self.text:%lu:'%@' selectedRange:{%lu, %lu}",
          (unsigned long)range.location, (unsigned long)range.length,
          text, self.text.length, self.text,
          (unsigned long)self.selectedRange.location, (unsigned long)self.selectedRange.length);

    NSMutableString *quotedText = [NSMutableString string];

    int location = range.location;

    if (location < self.text.length && location + range.length == self.text.length) {
        // To guard against possible mismatch between our self.text and the _textArea.value in
        // TextInput.js, we indicate deletion or replacement from the end with negative location.
        location = location - self.text.length;
    }
    else if (range.location == 0 && range.length == 0 && text.length == 0) {
        // Backspace without anything known about preceding text
        location = -1;
    }

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

    [message appendFormat:@"{id: 'COKbdMgr', command: 'replaceText', location: %d, length: %lu, text: '", location, range.length];
    [message appendString:quotedText];
    [message appendString:@"'}"];

    [self postMessage:message];

    self->lastWasNewline = (range.length == 0 && [text isEqualToString:@"\n"]);

    return YES;
}

- (void)textViewDidChange:(UITextView *)textView {
    NSLog(@"COKbdMgr: didChange: self.text is now:%lu:'%@'", self.text.length, self.text);

    // Hack to match the logic in loleaflet's manipulation of the _textArea.value in TextInput.js.
    // Probably means that the local testbed here (COKbdMgrTest's test.html) doesn't necessarily
    // handle adding newlines properly. Oh well.
    if (self->lastWasNewline) {
        self.text = @"";
        NSLog(@"          Made self.text empty to match TextInput.js");
    }
}

- (BOOL)canBecomeFirstResponder {
    return YES;
}

- (BOOL)canPerformAction:(SEL)action withSender:(id)sender
{
    // We don't want any of the default UIResponder actions, as the UITextView has no idea about the
    // real contents of the document or selection anyway.

    // NSLog(@"COKbdMgr: canPerformAction:%@", NSStringFromSelector(action));
    return NO;
}

- (void)pressesBegan:(NSSet<UIPress*>*)presses
           withEvent:(UIPressesEvent*)event {

    NSLog(@"COKbdMgr: pressesBegan: %@", [self describeUIPresses:presses]);

    if (@available(iOS 13.4, *)) {
        for (UIPress *press in presses) {
            if ([press key].modifierFlags & UIKeyModifierCommand
                && [[[press key] charactersIgnoringModifiers] isEqualToString:@"a"]) {
                [self sendUnoCommand:@"SelectAll"];
                return;
            } else if ([press key].modifierFlags & UIKeyModifierCommand
                       && [[[press key] charactersIgnoringModifiers] isEqualToString:@"c"]) {
                [self sendUnoCommand:@"Copy"];
                return;
            } else if ([press key].modifierFlags & UIKeyModifierCommand
                       && [[[press key] charactersIgnoringModifiers] isEqualToString:@"s"]) {
                [self sendUnoCommand:@"Save"];
                return;
            } else if ([press key].modifierFlags & UIKeyModifierCommand
                       && [[[press key] charactersIgnoringModifiers] isEqualToString:@"v"]) {
                [self sendUnoCommand:@"Paste"];
                return;
            } else if ([press key].modifierFlags & UIKeyModifierCommand
                       && [[[press key] charactersIgnoringModifiers] isEqualToString:@"x"]) {
                [self sendUnoCommand:@"Cut"];
                return;
            } else if ([press key].modifierFlags & UIKeyModifierCommand
                       && [[[press key] charactersIgnoringModifiers] isEqualToString:@"z"]) {
                [self sendUnoCommand:@"Undo"];
                return;
            }
        }
    }

    [super pressesBegan:presses withEvent:event];
}

@synthesize hasText;

@end

@interface CollaboraOnlineWebViewKeyboardManager () <WKScriptMessageHandler> {
    WKWebView *webView;
    _COWVKMKeyInputControl *control;
    BOOL lastCommandIsHide;
    BOOL lastActionIsDisplay;
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

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(keyboardDidShow:)
                                                 name:UIKeyboardDidShowNotification
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

        lastCommandIsHide = NO;
        lastActionIsDisplay = YES;

        NSLog(@"COKbdMgr: lastCommandIsHide:=NO lastActionIsDisplay:=YES");

        [self->webView addSubview:control];
        NSLog(@"COKbdMgr: Added _COWVKMKeyInputControl to webView");
    }
    control.text = text;
    control.selectedRange = NSMakeRange(location, 0);
    [control becomeFirstResponder];
}

- (void)hideKeyboard {
    // At least for spreadsheet documents, loleaflet calls us to hide the keyboard like crazy even
    // if it immediately then calls us to show it again. That used to mess things up very badly. Try
    // to make some sense out of it by not trusting a hide request until we see that it hasn't been
    // folllowed by a display request within 100 ms.
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100000000ll), dispatch_get_main_queue(), ^{
            if (!self->lastCommandIsHide) {
                NSLog(@"COKbdMgr: lastCommandIsHide==NO Ignoring hide command that was quickly followed by a display command");
                return;
            }
            if (self->lastActionIsDisplay) {
                NSLog(@"COKbdMgr: lastActionIsDisplay==YES Ignoring hide command that quickly followed a display command");
                return;
            }
            if (self->control != nil) {
                self->lastActionIsDisplay = NO;
                [self->control removeFromSuperview];
                NSLog(@"COKbdMgr: lastActionIsDisplay:=NO Removed _COWVKMKeyInputControl from webView");
                self->control = nil;
            }
        });
}

- (void)userContentController:(nonnull WKUserContentController *)userContentController
      didReceiveScriptMessage:(nonnull WKScriptMessage *)message {
    if (![message.name isEqualToString:@"CollaboraOnlineWebViewKeyboardManager"]) {
        NSLog(@"COKbdMgr: Received unrecognized script message name: %@ %@", message.name, message.body);
        return;
    }

    if ([message.body isKindOfClass:[NSDictionary class]]) {
        NSString *stringCommand = message.body[@"command"];
        lastCommandIsHide = NO;
        if ([stringCommand isEqualToString:@"display"]) {
            NSString *type = message.body[@"type"];
            NSString *text = message.body[@"text"];
            NSNumber *location = message.body[@"location"];
            NSLog(@"COKbdMgr: command=display type=%@ text=%@ location=%@", type, text, location);
            if (text == nil)
                text = @"";
            [self displayKeyboardOfType:type withText:text at:(location != nil ? [location unsignedIntegerValue] : UINT_MAX)];
        } else if ([stringCommand isEqualToString:@"hide"]) {
            lastCommandIsHide = YES;
            NSLog(@"COKbdMgr: command=hide lastCommandIsHide:=YES");
            [self hideKeyboard];
        } else if (stringCommand == nil) {
            NSLog(@"COKbdMgr: No 'command' in %@", message.body);
        } else {
            NSLog(@"COKbdMgr: Received unrecognized command:%@", stringCommand);
        }
    } else {
        NSLog(@"COKbdMgr: Received unrecognized message body of type %@: %@, should be a dictionary (JS object)", [message.body class], message.body);
    }
}

- (void)keyboardDidHide:(NSNotification *)notification {
    NSLog(@"COKbdMgr: didHide");
    if (control != nil) {
        [control removeFromSuperview];
        NSLog(@"COKbdMgr: Removed _COWVKMKeyInputControl from webView");
        control = nil;
    }
}

- (void)keyboardDidShow:(NSNotification *)notification {
    NSLog(@"COKbdMgr: didShow");
}

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
