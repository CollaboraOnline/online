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

/*
 * Shortcuts for the classic toolbar & the Notebookbar.
 * This is a duplicate of the shortcuts defined in `MenubarShortcuts` in Control.Menubar.ts.
 * Once Control.TopToolbar.js and Control.Notebookbar*.js are converted to TypeScript, we can remove this duplication.
 */

/* global app _ L */

L.Control.Shortcuts = {
	shortcuts: {
		SAVE: 'Ctrl + S',
		UNDO: 'Ctrl + Z',
		REDO: 'Ctrl + Y',
		PRINT: 'Ctrl + P',
		CUT: 'Ctrl + X',
		COPY: 'Ctrl + C',
		PASTE: 'Ctrl + V',
		PASTE_SPECIAL: 'Ctrl + Shift + Alt + V',
		SELECT_ALL: 'Ctrl + A',
		COMMENT: 'Ctrl + Alt + C',
		FOOTNOTE: 'Ctrl + Alt + F',
		ENDNOTE: 'Ctrl + Alt + D',
		BOLD: 'Ctrl + B',
		ITALIC: 'Ctrl + I',
		UNDERLINE: 'Ctrl + U',
		DOUBLE_UNDERLINE: 'Ctrl + D',
		STRIKETHROUGH: 'Ctrl + Alt + 5',
		SUPERSCRIPT: 'Ctrl + Shift + P',
		SUBSCRIPT: 'Ctrl + Shift + B',
		LEFT: 'Ctrl + L',
		CENTERED: 'Ctrl + E',
		RIGHT: 'Ctrl + R',
		JUSTIFIED: 'Ctrl + J',
		KEYBOARD_SHORTCUTS: 'Ctrl + Shift + ?',
	},

	addShortcut: function (text, shortcut) {
		// localize shortcut
		if (
			String.locale.startsWith('de') ||
			String.locale.startsWith('dsb') ||
			String.locale.startsWith('hsb')
		) {
			shortcut = shortcut.replace('Ctrl', 'Strg');
		}
		if (String.locale.startsWith('lt')) {
			shortcut = shortcut.replace('Ctrl', 'Vald');
		}
		if (String.locale.startsWith('sl')) {
			shortcut = shortcut
				.replace('Ctrl', 'Krmilka')
				.replace('Alt', 'izmenjalka')
				.replace('Shift', 'dvigalka');
		}

		var newText =
			_(text).replace('~', '') +
			' (' +
			app.util.replaceCtrlAltInMac(shortcut) +
			')';

		return newText;
	},
};
