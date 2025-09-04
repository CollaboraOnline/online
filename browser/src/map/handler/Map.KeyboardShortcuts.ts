// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare var L: any;

function isCtrlKey (e: KeyboardEvent) {
    if ((window as any).ThisIsTheiOSApp || L.Browser.mac)
        return e.metaKey;
    else
        return e.ctrlKey;
}

function isMacCtrlKey (e: KeyboardEvent) {
    if ((window as any).ThisIsTheiOSApp || L.Browser.mac)
        return e.ctrlKey;
    else
        return false;
}

enum Mod {
    NONE    = 0,
    CTRL    = 1,
    ALT     = 2,
    SHIFT   = 4,
    MACCTRL = 8, // Ctrl (*not Cmd*) on a Mac
}

enum ViewType {
    Edit = 0,
    ReadOnly = 1,
}

enum Platform {
    ANDROIDAPP  = 1,
    IOSAPP      = 2,
    MAC         = 4,
    WINDOWS     = 8,
    LINUX       = 16, // There is no "Linux" option, so just !mac && !windows
    CHROMEOSAPP = 32,
}

type shortcutCallback = () => void;

class ShortcutDescriptor {
    docType: string; // if undefined then all apps match
    eventType: string | readonly string[];
    modifier: Mod;
    code: string | null;
    key: string | null;
    unoAction: string;
    dispatchAction: string;
    viewType: ViewType;
    preventDefault: boolean;
    platform: Platform;

    constructor({
        docType = null,
        eventType,
        modifier = Mod.NONE,
        code = null,
        key = null,
        unoAction = null,
        dispatchAction = null,
        viewType = null,
        preventDefault = true,
        platform = null,
    }: {
        /** The type of document to register this keybind in. If omitted, the keybind will be registered for all document types */
        docType?: 'text' | 'presentation' | 'drawing' | 'spreadsheet',
        /** The event type or types to register this keybind for. Generally you probably want this to be 'keydown' */
        eventType: string | readonly string[],
        /** A bitfield of modifiers you want to be active. For example, Mod.CTRL | Mod.SHIFT would mean that *both* control and shift would need to be held while pressing the keybind.

        On Mac, command is seen as Mod.CTRL and there is a separate Mod.MACCTRL to read control

        If ommitted, no modifier will be required

        @default Mod.NONE */
        modifier?: Mod,

        code?: string,

        /** You must provide at least one of 'key' or 'code'. If you provide both, either a matching key or a matching code will trigger the binding.

        When adding shortcuts using 'key' you should always test in multiple browsers and systems or ask for review from someone who can. Sometimes, particularly on keybinds that trigger "dead keys" (accents for letters), there are inconsistencies in different browsers. It's also possible for multiple different key combinations to trigger the same typed glyph - leading to this munging different keybinds together */
        key?: string,
        /** The uno command, including its .uno: prefix, to run when this keybind is pressed

        If both the unoAction and dispatchAction are provided, only the unoAction will trigger. The dispatchAction will be ignored.

        If ommitted, no uno command will be run when this keybind is pressed */
        unoAction?: string,
        /** The action to dispatch when the keybind is pressed

        If both the unoAction and dispatchAction are provided, only the unoAction will trigger. The dispatchAction will be ignored.

        If ommitted, no action will be dispatched when this keybind is pressed */
        dispatchAction?: string,
        /** The view type (Edit or ReadOnly) to restrict this keybind to

        If ommitted, the keybind will be active in both Edit and ReadOnly view types */
        viewType?: ViewType,
        /** Whether to prevent the default system binding. This is important if you're overriding a system binding, and not generally harmful otherwise

        Note that all keypresses which include a control (or a command on mac) are already preventDefaulted elsewhere to be sent to core. If you want to stop this, you should manually register a binding without any action but with this option set to false

        Note that some browsers may not allow you to preventDefault some events. For example, Safari will not allow you to preventDefault the command+r keybind to refresh the current tab

        @default true
        */
        preventDefault?: boolean,
        /** A bitfield of platforms you want this keybind to be active on

        A user on any provided platform will get the keybind, so providing Platform.WINDOWS | Platform.LINUX would bind the key for both Windows *and* Linux (but not iOS, Android or Chromebook).

        Platforms are detected in a mutually-exclusive fashion - that is: although, for example, Chromebook app users are necessarily using the Android app, they will only ever be registered as their most specific possible platform.

        There will never be a platformless user. If a platform can't be detected, the user will be assumed to be using Linux. This is probably an OK assumption, given Windows and MacOS already have specific detections earlier.

        If ommitted, the keybind will be active on all platforms
        */
        platform?: Platform,
    }) {
        app.console.assert(code !== null || key !== null, 'registering a keyboard shortcut without specifying either a key or a code - this will result in an untriggerable shortcut');

        this.docType = docType;
        this.eventType = eventType;
        this.modifier = modifier;
        this.code = code;
        this.key = key;
        this.unoAction = unoAction;
        this.dispatchAction = dispatchAction;
        this.viewType = viewType;
        this.preventDefault = preventDefault;
        this.platform = platform;
    }
}

class KeyboardShortcuts {
    map: any;
    definitions: Map<string, Array<ShortcutDescriptor>>;

    constructor() {
        this.definitions = new Map<string, Array<ShortcutDescriptor>>();
    }

    private findShortcut(language: string, eventType: string, modifier: Mod, code: string | undefined, key: string | undefined, platform: Platform)
        : ShortcutDescriptor | undefined {
        const descriptors = this.definitions.get(language);
        if (!descriptors) {
            return undefined;
        }

        const docType = this.map._docLayer ? this.map._docLayer._docType : '';
        const viewType = this.map.isEditMode() ? ViewType.Edit : ViewType.ReadOnly;

        const shortcuts = descriptors.filter((descriptor: ShortcutDescriptor) => {
            const keyMatches = descriptor.key === key;
            const codeMatches = descriptor.code === code;

            return (!descriptor.docType || descriptor.docType === docType) &&
                (Array.isArray(descriptor.eventType) ? descriptor.eventType.includes(eventType) : descriptor.eventType === eventType) &&
                descriptor.modifier === modifier &&
                (descriptor.viewType === null || descriptor.viewType === viewType) &&
                (!descriptor.platform || (descriptor.platform & platform)) &&
                (keyMatches || codeMatches);
        });

        if (shortcuts.length > 1) {
            throw 'Multiple definitions of the same keyboard shortcut';
        }

        if (shortcuts.length) {
            return shortcuts[0];
        }

        return undefined;
    }

    /// returns true if handled action
    private processEventImpl(language: string, event: KeyboardEvent) : boolean {
        const eventType = event.type;
        const ctrl = isCtrlKey(event);
        const shift = event.shiftKey;
        const alt = event.altKey;
        const code = event.code;
        const key = event.key;
        const macctrl = isMacCtrlKey(event);
        const modifier = (ctrl ? Mod.CTRL : Mod.NONE) |
            (shift ? Mod.SHIFT : Mod.NONE) |
            (alt ? Mod.ALT : Mod.NONE) |
            (macctrl ? Mod.MACCTRL : Mod.NONE);
        const platform = window.mode.isChromebook() ? Platform.CHROMEOSAPP :
                         window.ThisIsTheAndroidApp ? Platform.ANDROIDAPP : // Cannot come before window.mode.isChromebook() as all Chromebook app users are necessarily also Android app users
                         window.ThisIsTheiOSApp ? Platform.IOSAPP :
                         L.Browser.mac ? Platform.MAC :
                         L.Browser.win ? Platform.WINDOWS :
                         Platform.LINUX;

        const shortcut = this.findShortcut(language, eventType, modifier, code, key, platform);

        if (shortcut) {
            let action = 'disabled';
            if (shortcut.unoAction) {
                action = shortcut.unoAction;
                this.map.sendUnoCommand(action);
            } else if (shortcut.dispatchAction) {
                action = shortcut.dispatchAction;
                app.dispatcher.dispatch(action);
            }

            if (shortcut.preventDefault) {
                event.preventDefault();
            }

            console.debug('handled keyboard shortcut: ' + action);
            return true;
        }

        return false;
    }

    // has to be called before use
    public initialize(map: any) {
        this.map = map;

        // in cypress it can fail on load to not allow for duplicated shortcuts
        if (L.Browser.cypressTest) {
            this.map.on('docloaded', () => { keyboardShortcuts.verifyShortcuts(); });
        }
    }

    public processEvent(language: string, event: KeyboardEvent) : boolean {
        if (!this.map) {
            throw 'KeyboardShortcuts not initialized';
        }

        if (this.processEventImpl(language, event)) {
            return true;
        }

        return this.processEventImpl('default', event);
    }

    public verifyShortcuts() : void {
        console.debug('KeyboardShortcuts.verifyShortcuts start');

        this.definitions.forEach((shortcuts, language) => {
            for (let i = 0; i < shortcuts.length - 1; i++) {

                for (let j = i + 1; j < shortcuts.length; j++) {
                    let eventTypeCheck = false;
                    if (!Array.isArray(shortcuts[j].eventType) && !Array.isArray(shortcuts[i].eventType))
                        eventTypeCheck = shortcuts[i].eventType === shortcuts[j].eventType;
                    else if (Array.isArray(shortcuts[j].eventType) && Array.isArray(shortcuts[i].eventType))
                        eventTypeCheck = (shortcuts[i].eventType as Array<string>).some(item => (shortcuts[j].eventType as Array<string>).includes(item));
                    else if (Array.isArray(shortcuts[j].eventType))
                        eventTypeCheck = (shortcuts[j].eventType as Array<string>).includes(shortcuts[i].eventType as string);
                    else (Array.isArray(shortcuts[i].eventType))
                        eventTypeCheck = (shortcuts[i].eventType as Array<string>).includes(shortcuts[j].eventType as string);

                    if (
                        eventTypeCheck &&
                        (shortcuts[i].key === shortcuts[j].key || shortcuts[i].code === shortcuts[j].code) &&
                        shortcuts[i].modifier === shortcuts[j].modifier &&
                        shortcuts[i].docType === shortcuts[j].docType &&
                        shortcuts[i].platform === shortcuts[j].platform
                    )
                        console.warn('2 shortcuts with the same properties.');
                }
            }
        });

        console.debug('KeyboardShortcuts.verifyShortcuts finished');
    }
}

const keyboardShortcuts = new KeyboardShortcuts();

// Default shortcuts.
keyboardShortcuts.definitions.set('default', new Array<ShortcutDescriptor>(
    /*
        Disable F5 or assign it something to prevent browser refresh.
        Disable multi-sheet selection shortcuts in Calc.
        Disable F2 in Writer, formula bar is unsupported, and messes with further input.
    */
    new ShortcutDescriptor({ eventType: 'keydown', key: 'F1', dispatchAction: 'showhelp' }),
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.ALT, key: 'F1', dispatchAction: 'focustonotebookbar' }),
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'f', dispatchAction: 'home-search' }),

    // Calc.
    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'PageUp' }),
    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'PageDown' }),
    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', key: 'F5' }),
    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.CTRL, key: ',', unoAction: '.uno:InsertCurrentDate' }),

    // Writer.
    new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'F2' }),
    new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'F3', unoAction: '.uno:ExpandGlossary' }),
    new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', modifier: Mod.CTRL, key: 'F3' }),
    new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'F5' }),

    // Impress.
    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', key: 'F5', dispatchAction: 'presentation' }),
    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', key: 'PageUp', dispatchAction: 'previouspart', viewType: ViewType.ReadOnly }),
    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', key: 'PageDown', dispatchAction: 'nextpart', viewType: ViewType.ReadOnly }),

    // Draw.
    new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'F5' }),
    new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'PageUp', dispatchAction: 'previouspart', viewType: ViewType.ReadOnly }),
    new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'PageDown', dispatchAction: 'nextpart', viewType: ViewType.ReadOnly }),
    new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'End', dispatchAction: 'lastpart', viewType: ViewType.ReadOnly }),
    new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'Home', dispatchAction: 'firstpart', viewType: ViewType.ReadOnly }),


    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.ALT | Mod.CTRL, key: 'p', dispatchAction: 'userlist' }),

    // Passthrough some system shortcuts
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'I', preventDefault: false, platform: Platform.WINDOWS | Platform.LINUX }), // Open browser developer tools on Non-MacOS - shift means the I here is capital
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL | Mod.ALT, code: 'keyI', preventDefault: false, platform: Platform.MAC }), // Open browser developer tools on MacOS - registered with keyCode as alt+i triggers a dead key on MacOS
    new ShortcutDescriptor({ eventType: ['keydown', 'keypress'], modifier: Mod.CTRL | Mod.MACCTRL, key: ' ', preventDefault: false, platform: Platform.MAC | Platform.IOSAPP }), // On MacOS, open system emoji picker - bound to keypress as well as keydown since as that is needed on webkit browsers (such as Safari or Orion)
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'r', preventDefault: false, platform: Platform.MAC }), // Refresh browser tab
	new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'R', preventDefault: false, platform: Platform.WINDOWS | Platform.LINUX }), // Refresh browser tab & clear cache
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'm', preventDefault: false, platform: Platform.MAC }), // On MacOS, minimize window
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'q', preventDefault: false, platform: Platform.MAC }), // On MacOS, quit browser
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'w', preventDefault: false }), // Close current tab
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'n', preventDefault: false }), // Open new browser window
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 't', preventDefault: false }), // Open new browser tab
));

// German shortcuts.
keyboardShortcuts.definitions.set('de', new Array<ShortcutDescriptor>(
    new ShortcutDescriptor({ eventType: 'keydown', key: 'F12', dispatchAction: 'saveas' }),

    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F9', unoAction: '.uno:GridVisible' }),
    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F3', unoAction: '.uno:ChangeCaseRotateCase' }),
    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F5', dispatchAction: 'presentation' }), // Already available without this shortcut.
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.SHIFT | Mod.CTRL, key: 'F', unoAction: '.uno:Bold' }),
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.SHIFT | Mod.CTRL, key: 'K', unoAction: '.uno:Italic' }),
    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.SHIFT | Mod.CTRL, key: 'U', unoAction: '.uno:Underline' }),

    new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F3', unoAction: '.uno:ChangeCaseRotateCase' }),
    new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'F5', unoAction: '.uno:GoToPage' }),
    new ShortcutDescriptor({ docType: 'text', eventType: 'keydown',  modifier: Mod.ALT | Mod.CTRL, key: 's', dispatchAction: 'home-search' }),

    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F3', unoAction: '.uno:FunctionDialog' }),
    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F2', dispatchAction: 'insertcomment' }),
    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', key: 'F4', dispatchAction: 'togglerelative' }),
    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', key: 'F9', unoAction: '.uno:Calculate' }),
    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', key: 'F5', dispatchAction: 'focusonaddressinput' }),
    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.ALT, key: '0', unoAction: '.uno:FormatCellDialog' })
));

(window as any).KeyboardShortcuts = keyboardShortcuts;
