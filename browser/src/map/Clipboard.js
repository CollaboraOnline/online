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
 * window.L.Clipboard is used to abstract our storage and management of
 * local & remote clipboard data.
 */

/* global CoolClipboardBase */

// Get all interesting clipboard related events here, and handle
// download logic in one place ...
// We keep track of the current selection content if it is simple
// So we can do synchronous copy/paste in the callback if possible.
window.L.Clipboard = class Clipboard extends CoolClipboardBase {
	constructor(map) {
		super(map);
	}

	// Check if the paste special mode is enabled, and if so disable it.
	_checkAndDisablePasteSpecial() {
		if (this._navigatorClipboardPasteSpecial) {
			this._navigatorClipboardPasteSpecial = false;
			return true;
		}

		if (this.isPasteSpecialDialogOpen()) {
			this._map.jsdialog.closeDialog(this.pasteSpecialDialogId, false);
			return true;
		}

		return false;
	}
};

window.L.clipboard = function(map) {
	if (window.ThisIsTheAndroidApp)
		window.app.console.log('======> Assertion failed!? No window.L.Clipboard object should be needed in the Android app');
	return new window.L.Clipboard(map);
};
