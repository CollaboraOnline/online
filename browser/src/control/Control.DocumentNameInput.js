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

		const nameInput = document.getElementById('document-name-input');
		if (!nameInput) {
			console.warn("HTML element with ID document-name-input doesn't exist.");
			return;
		}
		nameInput.value = this.map['wopi'].BreadcrumbDocName;
		this.map._onGotFocus();
	},

	disableDocumentNameInput : function() {
		const nameInput = document.getElementById('document-name-input');
		if (!nameInput) {
			console.warn("HTML element with ID document-name-input doesn't exist.");
			return;
		}
		nameInput.disabled = true;
		nameInput.classList.remove('editable');
		nameInput.removeEventListener('keypress', this.onDocumentNameKeyPress);
	},

	enableDocumentNameInput : function() {
		const nameInput = document.getElementById('document-name-input');
		if (!nameInput) {
			console.warn("HTML element with ID document-name-input doesn't exist.");
			return;
		}
		nameInput.disabled = false;
		nameInput.classList.add('editable');
		nameInput.removeEventListener('keypress', this.onDocumentNameKeyPress);
		nameInput.addEventListener('keypress', this.onDocumentNameKeyPress.bind(this));
		nameInput.removeEventListener('focus', this.onDocumentNameFocus);
		nameInput.addEventListener('focus', this.onDocumentNameFocus.bind(this));
		nameInput.removeEventListener('blur', this.documentNameCancel);
		nameInput.addEventListener('blur', this.documentNameCancel.bind(this));
	},

	onDocumentNameKeyPress: function(e) {
		if (e.keyCode === 13) { // Enter key
			const nameInput = document.getElementById('document-name-input');
			if (!nameInput) {
				console.warn("HTML element with ID document-name-input doesn't exist.");
				return;
			}
			this.documentNameConfirm(nameInput.value);
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
		const nameInput = document.getElementById('document-name-input');
		if (!nameInput) {
			console.warn("HTML element with ID document-name-input doesn't exist.");
			return;
		}
		nameInput.value = name;
		nameInput.setSelectionRange(0, extn);
	},

	onDocLayerInit: function() {

		const el = document.getElementById('document-name-input');
		if (!el) {
			console.warn("HTML element with ID document-name-input doesn't exist.");
			return;
		}

		try {
			var fileNameFullPath = new URL(
				new URLSearchParams(window.location.search).get('WOPISrc')
			)
				.pathname
				.replace('/wopi/files', '');

			var basePath = fileNameFullPath.replace(this.map['wopi'].BaseFileName , '').replace(/\/$/, '');
			var title = this.map['wopi'].BaseFileName + '\n' + _('Path') + ': ' + basePath;

			el.title = title;
		} catch (e) {
			// purposely ignore the error for legacy browsers
		}

		// FIXME: Android app would display a temporary filename, not the actual filename
		if (window.ThisIsTheAndroidApp) {
			el.style.display = 'none';
		} else {
			el.style.display = '';
		}

		if (window.ThisIsAMobileApp) {
			// We can now set the document name in the menu bar
			el.disabled = false;
			el.classList.remove('editable');
			el.addEventListener('focus', function() { this.blur(); });
			// Call decodeURIComponent twice: Reverse both our encoding and the encoding of
			// the name in the file system.
			el.value = decodeURIComponent(decodeURIComponent(this.map.options.doc.replace(/.*\//, '')))
							  // To conveniently see the initial visualViewport scale and size, un-comment the following line.
							  // + ' (' + window.visualViewport.scale + '*' + window.visualViewport.width + 'x' + window.visualViewport.height + ')'
							  // TODO: Yes, it would be better to see it change as you rotate the device or invoke Split View.
							 ;
		}

		if (this.map.isReadOnlyMode()) {
			this.disableDocumentNameInput();
		}
	},

	onWopiProps: function(e) {
		if (e.BaseFileName !== null) {
			// set the document name into the name field
			var input = L.DomUtil.get('document-name-input');
			if (!input) {
				console.warn("HTML element with ID document-name-input doesn't exist.");
				return;
			}
			input.value = e.BreadcrumbDocName !== undefined ? e.BreadcrumbDocName : e.BaseFileName;
			input.setAttribute('data-cooltip', input.value);
			L.control.attachTooltipEventListener(input, this.map);
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
		const loadingBar = document.getElementById('document-name-input-loading-bar');
		if (!loadingBar) {
			console.warn("HTML element with ID document-name-input-loading-bar doesn't exist.");
			return;
		}
		loadingBar.style.display = 'block';
	},

	hideLoadingAnimation : function() {
		this.enableDocumentNameInput();
		const loadingBar = document.getElementById('document-name-input-loading-bar');
		if (!loadingBar) {
			console.warn("HTML element with ID document-name-input-loading-bar doesn't exist.");
			return;
		}
		loadingBar.style.display = 'none';
	},

	_getMaxAvailableWidth: function() {
		const titlebar = document.getElementById('document-titlebar');
		const nameInput = document.getElementById('document-name-input');
		if (!titlebar || !nameInput) {
			console.warn("HTML element with ID document-titlebar or document-name-input doesn't exist.");
			return 300;
		}
		var x = titlebar.offsetLeft + $('.document-title').prop('offsetLeft') + nameInput.offsetLeft;
		var containerWidth = parseInt($('.main-nav').css('width'));
		var maxWidth = Math.max(containerWidth - x - 30, 0);
		maxWidth = Math.max(maxWidth, 300); // input field at least 300px
		return maxWidth;
	},

});

L.control.documentNameInput = function () {
	return new L.Control.DocumentNameInput();
};
