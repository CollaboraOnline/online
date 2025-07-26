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
	private shortcutMap: Map<string, string> = new Map();

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
	public HYPERLINK = 'Ctrl + K';
	public CLEAR_FORMATTING = 'Ctrl + M';
	public INSERT_TABLE = 'Ctrl + F12';
	public INSERT_PAGEBREAK = 'Ctrl + Return';
	public FIND = 'Ctrl + F';
	public FIND_REPLACE = 'Ctrl + H';
	public FORMAT_CELL = 'Ctrl + 1';

	constructor() {
		this.shortcutMap.set('.uno:Save', this.SAVE);
		this.shortcutMap.set('save', this.SAVE);
		this.shortcutMap.set('.uno:Undo', this.UNDO);
		this.shortcutMap.set('.uno:Redo', this.REDO);
		this.shortcutMap.set('.uno:Print', this.PRINT);
		this.shortcutMap.set('print', this.PRINT);
		this.shortcutMap.set('.uno:Cut', this.CUT);
		this.shortcutMap.set('.uno:Copy', this.COPY);
		this.shortcutMap.set('.uno:Paste', this.PASTE);
		this.shortcutMap.set('.uno:PasteSpecial', this.PASTE_SPECIAL);
		this.shortcutMap.set('.uno:SelectAll', this.SELECT_ALL);
		this.shortcutMap.set('.uno:InsertAnnotation', this.COMMENT);
		this.shortcutMap.set('insertcomment', this.COMMENT);
		this.shortcutMap.set('.uno:InsertFootnote', this.FOOTNOTE);
		this.shortcutMap.set('.uno:InsertEndnote', this.ENDNOTE);
		this.shortcutMap.set('.uno:Bold', this.BOLD);
		this.shortcutMap.set('.uno:Italic', this.ITALIC);
		this.shortcutMap.set('.uno:Underline', this.UNDERLINE);
		this.shortcutMap.set('.uno:UnderlineDouble', this.DOUBLE_UNDERLINE);
		this.shortcutMap.set('.uno:Strikeout', this.STRIKETHROUGH);
		this.shortcutMap.set('.uno:SuperScript', this.SUPERSCRIPT);
		this.shortcutMap.set('.uno:SubScript', this.SUBSCRIPT);
		this.shortcutMap.set('.uno:LeftPara', this.LEFT);
		this.shortcutMap.set('.uno:AlignLeft', this.LEFT);
		this.shortcutMap.set('.uno:CommonAlignLeft', this.LEFT);
		this.shortcutMap.set('.uno:AlignHorizontalCenter', this.CENTERED);
		this.shortcutMap.set('.uno:CenterPara', this.CENTERED);
		this.shortcutMap.set('.uno:CommonAlignHorizontalCenter', this.CENTERED);
		this.shortcutMap.set('.uno:AlignRight', this.RIGHT);
		this.shortcutMap.set('.uno:RightPara', this.RIGHT);
		this.shortcutMap.set('.uno:CommonAlignRight', this.RIGHT);
		this.shortcutMap.set('.uno:AlignBlock', this.JUSTIFIED);
		this.shortcutMap.set('.uno:JustifyPara', this.JUSTIFIED);
		this.shortcutMap.set('.uno:CommonAlignJustified', this.JUSTIFIED);
		this.shortcutMap.set('.uno:KeyboardShortcuts', this.KEYBOARD_SHORTCUTS);
		this.shortcutMap.set('keyboard-shortcuts', this.KEYBOARD_SHORTCUTS);
		this.shortcutMap.set('hyperlinkdialog', this.HYPERLINK);
		this.shortcutMap.set('inserthyperlink', this.HYPERLINK);
		this.shortcutMap.set('.uno:ResetAttributes', this.CLEAR_FORMATTING);
		this.shortcutMap.set('.uno:InsertTable', this.INSERT_TABLE);
		this.shortcutMap.set('.uno:InsertPagebreak', this.INSERT_PAGEBREAK);
		this.shortcutMap.set('search', this.FIND);
		this.shortcutMap.set('.uno:SearchDialog', this.FIND_REPLACE);
		this.shortcutMap.set('.uno:FormatCellDialog', this.FORMAT_CELL);
	}

	public hasShortcut(command: string): boolean {
		return this.shortcutMap.has(command);
	}

	/**
	 * Returns the text with appended shortcut for a given text and UNO Command.
	 * @param {string} text - The text to localize.
	 * @param {string} shortcut - The shortcut to localize.
	 * @returns {string} - The localized text with the shortcut.
	 */
	public getShortcut(text: string, command: string): string {
		let shortcut = this.shortcutMap.get(command);
		if (!shortcut) return text;

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
