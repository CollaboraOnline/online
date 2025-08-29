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
 * L.Control.DocumentNameInput
 */

/* global $ _ */
L.Control.DocumentNameInput = L.Control.extend({

	onAdd: function (map) {
		this.map = map;
		if (window.mode.isMobile())
			this.progressBar = document.getElementById('mobile-progress-bar');
		else
			this.progressBar = document.getElementById('document-name-input-progress-bar');

		// Pre-bind handlers so they can be consistently added/removed
		this._docNameKeyPressHandler = this.onDocumentNameKeyPress.bind(this);
		this._docNameFocusHandler = this.onDocumentNameFocus.bind(this);
		this._docNameBlurHandler = this.documentNameCancel.bind(this);

		map.on('doclayerinit', this.onDocLayerInit, this);
		map.on('wopiprops', this.onWopiProps, this);
	},

	documentNameConfirm: function(value) {
		if (value !== null && value != '' && value != this.map['wopi'].BaseFileName) {
			this._renaming = true;
			if (this.map['wopi'].UserCanRename && this.map['wopi'].SupportsRename) {
				if (value.lastIndexOf('.') > 0) {
					var fname = this.map['wopi'].BaseFileName;
					var ext = fname.substr(fname.lastIndexOf('.')+1, fname.length);
					// check format conversion
					if (ext != value.substr(value.lastIndexOf('.')+1, value.length)) {
						this.map.saveAs(value);
					} else {
						// same extension, just rename the file
						// file name must be without the extension for rename
						value = value.substr(0, value.lastIndexOf('.'));
						this.map.renameFile(value);
					}
				}
				else {
					// when user doesn't specify any extension
					this.map.renameFile(value);
				}
			} else {
				// saveAs for rename
				this.map.saveAs(value);
			}
		}
		this.map._onGotFocus();
	},

	documentNameCancel: function() {
		if (this._renaming)
			return;

		var input = document.getElementById('document-name-input');
		if (!input) {
			console.warn('Element #document-name-input not found');
		} else {
			input.value = this.map['wopi'].BreadcrumbDocName;
		}
		this.map._onGotFocus();
	},

	disableDocumentNameInput : function() {
		var input = document.getElementById('document-name-input');
		if (!input) {
			console.warn('Element #document-name-input not found');
			return;
		}
		input.disabled = true;
		input.classList.remove('editable');
		input.removeEventListener('keypress', this._docNameKeyPressHandler);
		input.removeEventListener('focus', this._docNameFocusHandler);
		input.removeEventListener('blur', this._docNameBlurHandler);
	},

	enableDocumentNameInput : function() {
		var input = document.getElementById('document-name-input');
		if (!input) {
			console.warn('Element #document-name-input not found');
			return;
		}
		input.disabled = false;
		input.classList.add('editable');
		// emulate jQuery off(...).on(...)
		input.removeEventListener('keypress', this._docNameKeyPressHandler);
		input.addEventListener('keypress', this._docNameKeyPressHandler);
		input.removeEventListener('focus', this._docNameFocusHandler);
		input.addEventListener('focus', this._docNameFocusHandler);
		input.removeEventListener('blur', this._docNameBlurHandler);
		input.addEventListener('blur', this._docNameBlurHandler);
	},

	onDocumentNameKeyPress: function(e) {
		if (e.keyCode === 13) { // Enter key
			var input = document.getElementById('document-name-input');
			var value = input ? input.value : '';
			this.documentNameConfirm(value);
		} else if (e.keyCode === 27) { // Escape key
			this.documentNameCancel();
		}
	},

	onDocumentNameFocus: function() {
		// hide the caret in the main document
		delete this._renaming;
		this.map._onLostFocus();
		var name = this.map['wopi'].BaseFileName;
		var extn = name.lastIndexOf('.');
		if (extn < 0)
			extn = name.length;
		var input = document.getElementById('document-name-input');
		if (!input) {
			console.warn('Element #document-name-input not found');
			return;
		}
		input.value = name;
		try { input.setSelectionRange(0, extn); } catch (ignore) { /* intentionally ignored */ }
	},

	onDocLayerInit: function() {

		var el = document.getElementById('document-name-input');

		try {
			var fileNameFullPath = new URL(
				new URLSearchParams(window.location.search).get('WOPISrc')
			)
				.pathname
				.replace('/wopi/files', '');

			var basePath = fileNameFullPath.replace(this.map['wopi'].BaseFileName , '').replace(/\/$/, '');
			var title = this.map['wopi'].BaseFileName + '\n' + _('Path') + ': ' + basePath;

			if (el) {
				el.title = title;
			}
		} catch (e) {
			// purposely ignore the error for legacy browsers
		}

		// FIXME: Android app would display a temporary filename, not the actual filename
		if (window.ThisIsTheAndroidApp) {
			if (el) el.style.display = 'none';
		} else if (el) {
			el.style.display = '';
		}

		if (window.ThisIsAMobileApp) {
			// We can now set the document name in the menu bar
			if (el) {
				el.disabled = false;
				el.classList.remove('editable');
				el.addEventListener('focus', function(ev) { ev.target.blur(); });
			}
			// Call decodeURIComponent twice: Reverse both our encoding and the encoding of
			// the name in the file system.
			if (el) {
				el.value = decodeURIComponent(decodeURIComponent(this.map.options.doc.replace(/.*\//, '')));
			}
		}

		if (this.map.isReadOnlyMode()) {
			this.disableDocumentNameInput();
		}
	},

	onWopiProps: function(e) {
		if (e.BaseFileName !== null) {
			// set the document name into the name field
			var input = document.getElementById('document-name-input');
			if (!input) {
				console.warn('Element #document-name-input not found');
			} else {
				input.value = e.BreadcrumbDocName !== undefined ? e.BreadcrumbDocName : e.BaseFileName;
				input.setAttribute('data-cooltip', input.value);
				L.control.attachTooltipEventListener(input, this.map);
			}
		}
		if (!e.UserCanNotWriteRelative && !this.map.isReadOnlyMode()) {
			// Save As allowed
			this.enableDocumentNameInput();
		} else {
			this.disableDocumentNameInput();
		}
	},

	showProgressBar: function() {
		this.disableDocumentNameInput();
		this.progressBar.style.display = 'block';
	},

	hideProgressBar: function() {
		this.enableDocumentNameInput();
		this.progressBar.style.display = 'none';
	},

	setProgressBarValue: function(value) {
		this.progressBar.value = value;
	},

	showLoadingAnimation : function() {
		this.disableDocumentNameInput();
		var bar = document.getElementById('document-name-input-loading-bar');
		if (!bar) {
			console.warn('Element #document-name-input-loading-bar not found');
		} else {
			bar.style.display = 'block';
		}
	},

	hideLoadingAnimation : function() {
		this.enableDocumentNameInput();
		var bar = document.getElementById('document-name-input-loading-bar');
		if (!bar) {
			console.warn('Element #document-name-input-loading-bar not found');
		} else {
			bar.style.display = 'none';
		}
	},

	_getMaxAvailableWidth: function() {
		var titlebar = document.getElementById('document-titlebar');
		var nameInput = document.getElementById('document-name-input');
		if (!titlebar) console.warn('Element #document-titlebar not found');
		if (!nameInput) console.warn('Element #document-name-input not found');
		var x = (titlebar ? titlebar.offsetLeft : 0) + $('.document-title').prop('offsetLeft') + (nameInput ? nameInput.offsetLeft : 0);
		var containerWidth = parseInt($('.main-nav').css('width'));
		var maxWidth = Math.max(containerWidth - x - 30, 0);
		maxWidth = Math.max(maxWidth, 300); // input field at least 300px
		return maxWidth;
	},

});

L.control.documentNameInput = function () {
	return new L.Control.DocumentNameInput();
};
