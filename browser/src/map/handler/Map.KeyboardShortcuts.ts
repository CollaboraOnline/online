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
    callback: shortcutCallback;

    constructor(docType: string, eventType: string, modifier: Mod, key: string, unoAction: string, dispatchAction: string, viewType: ViewType = ViewType.Edit | ViewType.ReadOnly, callback: shortcutCallback = null) {
        this.docType = docType;
        this.eventType = eventType;
        this.modifier = modifier;
        this.key = key;
        this.unoAction = unoAction;
        this.dispatchAction = dispatchAction;
        this.viewType = viewType;
        this.callback = callback;
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
                this.map.dispatch(action);
            } else if (shortcut.callback) {
                shortcut.callback();
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
    // disable multi-sheet selection shortcuts in Calc
    new ShortcutDescriptor('spreadsheet', 'keydown', Mod.CTRL | Mod.SHIFT, 'PageUp', undefined, undefined),
    new ShortcutDescriptor('spreadsheet', 'keydown', Mod.CTRL | Mod.SHIFT, 'PageDown', undefined, undefined),

    new ShortcutDescriptor(null, 'keydown', 0, 'F1', null, null, null, (() => {
        app.map.showHelp('online-help-content');
    })),

    new ShortcutDescriptor(null, 'keydown', Mod.ALT, 'F1', null, null, null, () => {
        const tabsContainer = document.getElementsByClassName('notebookbar-tabs-container')[0].children[0];
        let elementToFocus: HTMLButtonElement;
        if (tabsContainer) {
            for (let i = 0; i < tabsContainer.children.length; i++) {
                if (tabsContainer.children[i].classList.contains('selected')) {
                    elementToFocus = tabsContainer.children[i] as HTMLButtonElement;
                    break;
                }
            }
        }
        if (!elementToFocus)
            elementToFocus = document.getElementById('Home-tab-label') as HTMLButtonElement;

        elementToFocus.focus();
    }),

    // disable F2 in Writer, formula bar is unsupported, and messes with further input
    new ShortcutDescriptor('text', 'keydown', 0, 'F2', null, null, null),

    // Disable F5 or assign it something to prevent browser refresh.
    new ShortcutDescriptor('text', 'keydown', 0, 'F5', null, null, null),
    new ShortcutDescriptor('spreadsheet', 'keydown', 0, 'F5', null, null, null),
    new ShortcutDescriptor('drawing', 'keydown', 0, 'F5', null, null, null),

    new ShortcutDescriptor('presentation', 'keydown', 0, 'F5', null, null, null, () => {
        app.map.fire('fullscreen');
    }),

    new ShortcutDescriptor('presentation', 'keydown', 0, 'PageUp', null, null, ViewType.ReadOnly, () => {
        const partToSelect = 'prev';
        app.map._docLayer._preview._scrollViewByDirection(partToSelect);
        if (app.file.fileBasedView)
            app.map._docLayer._checkSelectedPart();
    }),

    new ShortcutDescriptor('drawing', 'keydown', 0, 'PageUp', null, null, ViewType.ReadOnly, () => {
        const partToSelect = 'prev';
        app.map._docLayer._preview._scrollViewByDirection(partToSelect);
        if (app.file.fileBasedView)
            app.map._docLayer._checkSelectedPart();
    }),

    new ShortcutDescriptor('presentation', 'keydown', 0, 'PageDown', null, null, ViewType.ReadOnly, () => {
        const partToSelect = 'next';
        app.map._docLayer._preview._scrollViewByDirection(partToSelect);
        if (app.file.fileBasedView)
            app.map._docLayer._checkSelectedPart();
    }),

    new ShortcutDescriptor('drawing', 'keydown', 0, 'PageDown', null, null, ViewType.ReadOnly, () => {
        const partToSelect = 'next';
        app.map._docLayer._preview._scrollViewByDirection(partToSelect);
        if (app.file.fileBasedView)
            app.map._docLayer._checkSelectedPart();
    }),

    new ShortcutDescriptor('drawing', 'keydown', 0, 'End', null, null, ViewType.ReadOnly, () => {
        if (app && app.file.fileBasedView === true) {
            const partToSelect = app.map._docLayer._parts -1;
            app.map._docLayer._preview._scrollViewToPartPosition(partToSelect);
            app.map._docLayer._checkSelectedPart();
        }
    }),

    new ShortcutDescriptor('drawing', 'keydown', 0, 'Home', null, null, ViewType.ReadOnly, () => {
        if (app && app.file.fileBasedView === true) {
            const partToSelect = 0;
            app.map._docLayer._preview._scrollViewToPartPosition(partToSelect);
            app.map._docLayer._checkSelectedPart();
        }
    })

));

// German shortcuts.
keyboardShortcuts.definitions.set('de', new Array<ShortcutDescriptor>(
    new ShortcutDescriptor(null, 'keydown', 0, 'F12', null, null, null, () => {
        if (app.map && app.map.uiManager.getCurrentMode() === 'notebookbar') {
            app.map.openSaveAs(); // Opens save as dialog if integrator supports it.
        }
    }),

    new ShortcutDescriptor('presentation', 'keydown', Mod.SHIFT, 'F9', '.uno:GridVisible', null),
    new ShortcutDescriptor('presentation', 'keydown', Mod.SHIFT, 'F3', '.uno:ChangeCaseRotateCase', null),

    new ShortcutDescriptor('presentation', 'keydown', Mod.SHIFT, 'F5', null, null, null, () => { // Already available without this shortcut.
        app.map.fire('fullscreen', { startSlideNumber: app.map.getCurrentPartNumber() });
    }),

    new ShortcutDescriptor('text', 'keydown', Mod.SHIFT, 'F3', '.uno:ChangeCaseRotateCase', null),
    new ShortcutDescriptor('spreadsheet', 'keydown', Mod.SHIFT, 'F3', '.uno:FunctionDialog', null),

    new ShortcutDescriptor('spreadsheet', 'keydown', Mod.SHIFT, 'F2', null, null, null, () => {
        app.map.insertComment();
    }),

    new ShortcutDescriptor('spreadsheet', 'keydown', 0, 'F4', null, null, null, () => {
        if (app.map._docLayer.insertMode === true) {
            app.map.sendUnoCommand('.uno:ToggleRelative');
        }
    }),

    new ShortcutDescriptor('spreadsheet', 'keydown', 0, 'F9', '.uno:Calculate', null),
    new ShortcutDescriptor('text', 'keydown', 0, 'F5', '.uno:GoToPage', null),

    new ShortcutDescriptor('spreadsheet', 'keydown', 0, 'F5', null, null, null, () => {
        document.getElementById('addressInput').focus();
    }),

    new ShortcutDescriptor('spreadsheet', 'keydown', Mod.ALT, '0', '.uno:FormatCellDialog', null)
));

(window as any).KeyboardShortcuts = keyboardShortcuts;
