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

/* global app _ brandProductName JSDialog CoolClipboardBase */

// Get all interesting clipboard related events here, and handle
// download logic in one place ...
// We keep track of the current selection content if it is simple
// So we can do synchronous copy/paste in the callback if possible.
window.L.Clipboard = class Clipboard extends CoolClipboardBase {
	constructor(map) {
		super(map);
	}

	clearSelection() {
		this._selectionContent = '';
		this._selectionPlainTextContent = '';
		this._selectionType = null;
		this._scheduleHideDownload();
	}

	// textselectioncontent: message
	setTextSelectionHTML(html, plainText = '') {
		this._selectionType = 'text';
		this._selectionContent = html;
		this._selectionPlainTextContent = plainText;
		if (window.L.Browser.cypressTest) {
			this._dummyDiv.innerHTML = html;
			this._dummyPlainDiv.innerText = plainText;
		}
		this._scheduleHideDownload();
	}

	// Sets the selection type without having the selection content (async clipboard).
	setTextSelectionType(selectionType) {
		this._selectionType = selectionType;
	}

	// sets the selection to some (cell formula) text)
	setTextSelectionText(text) {
		// Usually 'text' is what we see in the formulabar
		// In case of actual formula we don't wish to put formula into client clipboard
		// Putting formula in clipboard means user will paste formula outside of online
		// Pasting inside online is handled by internal paste
		if (this._map.getDocType() === 'spreadsheet' && text.startsWith('=')) {
			app.socket.sendMessage('gettextselection mimetype=text/html');
			return;
		}
		this._selectionType = 'text';
		this._selectionContent = this._originWrapBody(text);
		this._selectionPlainTextContent = text;
		this._scheduleHideDownload();
	}

	setActionCopy(isActionCopy) {
		this._isActionCopy = isActionCopy;
	}

	isActionCopy() {
		return this._isActionCopy;
	}

	// complexselection: message
	onComplexSelection(/*text*/) {
		// Mark this selection as complex.
		this._selectionType = 'complex';
		this._scheduleHideDownload();
	}

	_startProgress(isLargeCopy) {
		if (!this._downloadProgress) {
			this._downloadProgress = window.L.control.downloadProgress();
			this._map.addControl(this._downloadProgress);
		}
		this._downloadProgress.show(isLargeCopy);
	}

	_onDownloadOnLargeCopyPaste() {
		if (this._downloadProgress && this._downloadProgress.isStarted()) {
			// Need to show this only when a download is really in progress and we block it.
			// Otherwise, it's easier to flash the widget or something.
			this._warnLargeCopyPasteAlreadyStarted();
		} else {
			this._startProgress(true);
		}
	}

	_downloadProgressStatus() {
		if (this._downloadProgress)
			return this._downloadProgress.currentStatus();
	}

	// Download button is still shown after selection changed -> user has changed their mind...
	_scheduleHideDownload() {
		if (!this._downloadProgress || this._downloadProgress.isClosed())
			return;

		if (['downloadButton', 'confirmPasteButton'].includes(this._downloadProgressStatus()))
			this._stopHideDownload();
	}

	// useful if we did an internal paste already and don't want that.
	_stopHideDownload() {
		if (!this._downloadProgress || this._downloadProgress.isClosed())
			return;
		this._downloadProgress._onClose();
	}

	_warnCopyPaste() {
		var id = 'copy_paste_warning';
		if (!JSDialog.shouldShowAgain(id))
			return;

		this._map.uiManager.showYesNoButton(
				id + '-box',
				/*title=*/'',
				/*message=*/'',
				/*yesButtonText=*/_('OK'),
				/*noButtonText=*/_('Don’t show this again'),
				/*yesFunction=*/null,
				/*noFunction=*/function () {JSDialog.setShowAgain(id, false);},
				/*cancellable=*/true);
		this._warnCopyPasteImpl(id);
	}

	_warnCopyPasteImpl(id) {
		var box = document.getElementById(id + '-box');

		// TODO: do it JSDialog native...
		if (!box) {
			setTimeout(() => { this._warnCopyPasteImpl(id) }, 10);
			return;
		}

		var innerDiv = window.L.DomUtil.create('div', '', null);
		box.insertBefore(innerDiv, box.firstChild);

		if (window.mode.isMobile() || window.mode.isTablet()) {
			const p = document.createElement('p');
			p.textContent = _('Your browser has very limited access to the clipboard, so please use the paste buttons on your on-screen keyboard instead.');
			innerDiv.appendChild(p);
		}
		else {
			const ctrlText = app.util.replaceCtrlAltInMac('Ctrl');
			const p = document.createElement('p');
			p.textContent = 'Your browser has very limited access to the clipboard, so use these keyboard shortcuts:';
			innerDiv.appendChild(p);

			const table = document.createElement('table');
			table.className = 'warn-copy-paste';
			innerDiv.appendChild(table);

			let row = document.createElement('tr');
			table.appendChild(row);

			// Add three cells for copy & cut & paste.
			for (let i = 0; i < 3; i++) {
				const cell = document.createElement('td');
				row.appendChild(cell);

				let kbd = document.createElement('kbd');
				kbd.textContent = ctrlText;
				cell.appendChild(kbd);

				const span = document.createElement('span');
				span.textContent = '+';
				span.className = 'kbd--plus';
				cell.appendChild(span);

				kbd = document.createElement('kbd');
				kbd.textContent = i === 0 ? 'C': (i === 1 ? 'X': 'V');
				cell.appendChild(kbd);
			}

			// Add table headers as second row.
			row = document.createElement('tr');
			table.appendChild(row);
			for (let i = 0; i < 3; i++) {
				const cell = document.createElement('td');
				cell.textContent = i === 0 ? 'Copy': (i === 1 ? 'Cut': 'Paste');
				row.appendChild(cell);
			}
		}
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
