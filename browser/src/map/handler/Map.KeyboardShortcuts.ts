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

class ShortcutDescriptor {
    docType: string; // if undefined then all apps match
    eventType: string;
    modifier: Mod;
    key: string;
    unoAction: string;
    dispatchAction: string;

    constructor(docType: string, eventType: string, modifier: Mod, key: string, unoAction: string, dispatchAction: string) {
        this.docType = docType;
        this.eventType = eventType;
        this.modifier = modifier;
        this.key = key;
        this.unoAction = unoAction;
        this.dispatchAction = dispatchAction;
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

        const shortcuts = descriptors.filter((descriptor: ShortcutDescriptor) => {
            return (!descriptor.docType || descriptor.docType === docType) &&
                descriptor.eventType === eventType &&
                descriptor.modifier === modifier &&
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
                this.map.dispatch(action);
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

keyboardShortcuts.definitions.set('default', new Array<ShortcutDescriptor>(
    // disable multi-sheet selection shortcuts in Calc
    new ShortcutDescriptor('spreadsheet', 'keydown', Mod.CTRL | Mod.SHIFT, 'PageUp', undefined, undefined),
    new ShortcutDescriptor('spreadsheet', 'keydown', Mod.CTRL | Mod.SHIFT, 'PageDown', undefined, undefined),
));

(window as any).KeyboardShortcuts = keyboardShortcuts;
