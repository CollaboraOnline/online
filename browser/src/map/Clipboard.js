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

/* global app _ brandProductName CoolClipboardBase */

// Get all interesting clipboard related events here, and handle
// download logic in one place ...
// We keep track of the current selection content if it is simple
// So we can do synchronous copy/paste in the callback if possible.
window.L.Clipboard = class Clipboard extends CoolClipboardBase {
	constructor(map) {
		super(map);
	}

	_substProductName(msg) {
		var productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'Collabora Online Development Edition (unbranded)';
		return msg.replace('{productname}', productName);
	}

	_warnLargeCopyPasteAlreadyStarted() {
		this._map.uiManager.showInfoModal('large copy paste started warning');
		const container = document.getElementById('large copy paste started warning');
		container.replaceChildren();
		const p = document.createElement('p');
		p.textContent = _('A download due to a large copy/paste operation has already started. Please, wait for the current download or cancel it before starting a new one');
		container.appendChild(p);
	}

	isPasteSpecialDialogOpen() {
		if (!this.pasteSpecialDialogId)
			return false;
		else {
			var result = document.getElementById(this.pasteSpecialDialogId);
			return result !== undefined && result !== null ? true: false;
		}
	}

	isCopyPasteDialogReadyForCopy() {
		return this._downloadProgress && this._downloadProgress.isComplete();
	}

	_openPasteSpecialPopup() {
		// We will use this for closing the dialog.
		this.pasteSpecialDialogId = this._map.uiManager.generateModalId('paste_special_dialog') + '-box';

		var id = 'paste_special_dialog';
		this._map.uiManager.showYesNoButton(id + '-box', /*title=*/'', /*message=*/'', /*yesButtonText=*/_('Paste from this document'), /*noButtonText=*/_('Cancel paste special'), /*yesFunction=*/function() {
			app.socket.sendMessage('uno .uno:PasteSpecial');
		}, /*noFunction=*/null, /*cancellable=*/true);

		this._openPasteSpecialPopupImpl(id);
	}

	_openPasteSpecialPopupImpl(id) {
		var box = document.getElementById(id + '-box');

		// TODO: do it JSDialog native...
		if (!box) {
			setTimeout(() => { this._openPasteSpecialPopupImpl(id) }, 10);
			return;
		}

		var innerDiv = window.L.DomUtil.create('div', '', null);
		box.insertBefore(innerDiv, box.firstChild);

		const ctrlText = app.util.replaceCtrlAltInMac('Ctrl');

		let p = document.createElement('p');
		p.textContent = _('Your browser has very limited access to the clipboard');
		innerDiv.appendChild(p);
		p = document.createElement('p');
		innerDiv.appendChild(p);
		const bold = document.createElement('b');
		bold.textContent = _('Please use following combination to see more options:');
		p.appendChild(bold);

		p = document.createElement('p');
		innerDiv.appendChild(p);
		let kbd = document.createElement('kbd');
		kbd.textContent = ctrlText;
		p.appendChild(kbd);
		const span = document.createElement('span');
		span.className = 'kbd--plus';
		span.textContent = '+';
		p.appendChild(span);
		kbd = document.createElement('kbd');
		kbd.textContent = 'V';
		p.appendChild(kbd);

		p = document.createElement('p');
		innerDiv.appendChild(p);
		p.textContent = _('Close popup to ignore paste special');

		// Drop the not wanted whitespace between the dialog body and the button row at the
		// bottom.
		var label = document.getElementById('modal-dialog-' + id + '-box-label');
		label.style.display = 'none';
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
