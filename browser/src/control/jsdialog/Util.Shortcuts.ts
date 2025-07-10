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
 */

declare var JSDialog: any;

class ShortcutsUtil {
	// Available Shortcuts
	public SAVE = 'Ctrl + S';
	public UNDO = 'Ctrl + Z';
	public REDO = 'Ctrl + Y';
	public PRINT = 'Ctrl + P';
	public CUT = 'Ctrl + X';
	public COPY = 'Ctrl + C';
	public PASTE = 'Ctrl + V';
	public PASTE_SPECIAL = 'Ctrl + Shift + Alt + V';
	public SELECT_ALL = 'Ctrl + A';
	public COMMENT = 'Ctrl + Alt + C';
	public FOOTNOTE = 'Ctrl + Alt + F';
	public ENDNOTE = 'Ctrl + Alt + D';
	public BOLD = 'Ctrl + B';
	public ITALIC = 'Ctrl + I';
	public UNDERLINE = 'Ctrl + U';
	public DOUBLE_UNDERLINE = 'Ctrl + D';
	public STRIKETHROUGH = 'Ctrl + Alt + 5';
	public SUPERSCRIPT = 'Ctrl + Shift + P';
	public SUBSCRIPT = 'Ctrl + Shift + B';
	public LEFT = 'Ctrl + L';
	public CENTERED = 'Ctrl + E';
	public RIGHT = 'Ctrl + R';
	public JUSTIFIED = 'Ctrl + J';
	public KEYBOARD_SHORTCUTS = 'Ctrl + Shift + ?';

	public getShortcut(text: string, shortcut: string): string {
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
	}
}

JSDialog.ShortcutsUtil = new ShortcutsUtil();
