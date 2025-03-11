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
declare var app: any;

function isCtrlKey (e: KeyboardEvent) {
    if ((window as any).ThisIsTheiOSApp || L.Browser.mac)
        return e.metaKey;
    else
        return e.ctrlKey;
}

enum Mod {
    NONE    = 0,
    CTRL    = 1,
    ALT     = 2,
    SHIFT   = 4,
}

enum ViewType {
    Edit = 0,
    ReadOnly = 1,
}

type shortcutCallback = () => void;

class ShortcutDescriptor {
    docType: string; // if undefined then all apps match
    eventType: string;
    modifier: Mod;
    key: string;
    unoAction: string;
    dispatchAction: string;
    viewType: ViewType;

    constructor({
        docType = null,
        eventType,
        modifier = Mod.NONE,
        key,
        unoAction = null,
        dispatchAction = null,
        viewType = null,
    }: {
        docType?: string,
        eventType: string,
        modifier?: Mod,
        key: string,
        unoAction?: string,
        dispatchAction?: string,
        viewType?: ViewType,
    }) {
        this.docType = docType;
        this.eventType = eventType;
        this.modifier = modifier;
        this.key = key;
        this.unoAction = unoAction;
        this.dispatchAction = dispatchAction;
        this.viewType = viewType;
    }
}

class KeyboardShortcuts {
    map: any;
    definitions: Map<string, Array<ShortcutDescriptor>>;

    constructor() {
        this.definitions = new Map<string, Array<ShortcutDescriptor>>();
    }

    private findShortcut(language: string, eventType: string, modifier: Mod, key: string)
        : ShortcutDescriptor | undefined {
        const descriptors = this.definitions.get(language);
        if (!descriptors) {
            return undefined;
        }

        const docType = this.map._docLayer ? this.map._docLayer._docType : '';
        const viewType = this.map.isEditMode() ? ViewType.Edit : ViewType.ReadOnly;

        const shortcuts = descriptors.filter((descriptor: ShortcutDescriptor) => {
            return (!descriptor.docType || descriptor.docType === docType) &&
                descriptor.eventType === eventType &&
                descriptor.modifier === modifier &&
                (descriptor.viewType === null || descriptor.viewType === viewType) &&
                descriptor.key === key;
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
        const key = event.key;
        const modifier = (ctrl ? Mod.CTRL : Mod.NONE) |
            (shift ? Mod.SHIFT : Mod.NONE) |
            (alt ? Mod.ALT : Mod.NONE);

        const shortcut = this.findShortcut(language, eventType, modifier, key);

        if (shortcut) {
            let action = 'disabled';
            if (shortcut.unoAction) {
                action = shortcut.unoAction;
                this.map.sendUnoCommand(action);
            } else if (shortcut.dispatchAction) {
                action = shortcut.dispatchAction;
                app.dispatcher.dispatch(action);
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
            shortcuts.forEach((shortcut) => {
                // throws an exception if finds duplicated
                this.findShortcut(language,
                    shortcut.eventType, shortcut.modifier, shortcut.key);
            });
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

    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'PageUp' }),
    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'PageDown' }),
    new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', key: 'F5' }),


    new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'F2' }),
    new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'F3', unoAction: '.uno:ExpandGlossary' }),
    new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', modifier: Mod.CTRL, key: 'F3' }),
    new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'F5' }),


    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', key: 'F5', dispatchAction: 'presentation' }),
    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', key: 'PageUp', dispatchAction: 'previouspart', viewType: ViewType.ReadOnly }),
    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', key: 'PageDown', dispatchAction: 'nextpart', viewType: ViewType.ReadOnly }),


    new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'F5' }),
    new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'PageUp', dispatchAction: 'previouspart', viewType: ViewType.ReadOnly }),
    new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'PageDown', dispatchAction: 'nextpart', viewType: ViewType.ReadOnly }),
    new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'End', dispatchAction: 'lastpart', viewType: ViewType.ReadOnly }),
    new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'Home', dispatchAction: 'firstpart', viewType: ViewType.ReadOnly }),


    new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.ALT | Mod.CTRL, key: 'p', dispatchAction: 'userlist' }),
));

// German shortcuts.
keyboardShortcuts.definitions.set('de', new Array<ShortcutDescriptor>(
    new ShortcutDescriptor({ eventType: 'keydown', key: 'F12', dispatchAction: 'saveas' }),

    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F9', unoAction: '.uno:GridVisible' }),
    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F3', unoAction: '.uno:ChangeCaseRotateCase' }),
    new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F5', dispatchAction: 'presentation' }), // Already available without this shortcut.

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
