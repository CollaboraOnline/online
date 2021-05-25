/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.DocumentNameInput
 */

/* global $ */
L.Control.DocumentNameInput = L.Control.extend({

	onAdd: function (map) {
		this.map = map;

		map.on('doclayerinit', this.onDocLayerInit, this);
		map.on('wopiprops', this.onWopiProps, this);
		map.on('resize', this.onResize, this);
	},

	documentNameConfirm: function() {
		var value = $('#document-name-input').val();
		if (value !== null && value != '' && value != this.map['wopi'].BaseFileName) {
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
			} else {
				// saveAs for rename
				this.map.saveAs(value);
			}
		}
		this.map._onGotFocus();
	},

	documentNameCancel: function() {
		$('#document-name-input').val(this.map['wopi'].BreadcrumbDocName);
		this._setNameInputWidth();
		this.map._onGotFocus();
	},

	onDocumentNameKeyPress: function(e) {
		var tail = (e.keyCode !== 13 && e.keyCode !== 27) ? 'X' : null;
		this._setNameInputWidth(tail);
		if (e.keyCode === 13) { // Enter key
			this.documentNameConfirm();
		} else if (e.keyCode === 27) { // Escape key
			this.documentNameCancel();
		}
	},

	onDocumentNameFocus: function() {
		// hide the caret in the main document
		this.map._onLostFocus();
		var name = this.map['wopi'].BaseFileName;
		var extn = name.lastIndexOf('.');
		if (extn < 0)
			extn = name.length;
		$('#document-name-input').val(name);
		$('#document-name-input')[0].setSelectionRange(0, extn);
	},

	onDocLayerInit: function() {
		this._setNameInputWidth();

		// FIXME: Android app would display a temporary filename, not the actual filename
		if (window.ThisIsTheAndroidApp) {
			$('#document-name-input').hide();
		} else {
			$('#document-name-input').show();
		}

		if (window.ThisIsAMobileApp) {
			// We can now set the document name in the menu bar
			$('#document-name-input').prop('disabled', false);
			$('#document-name-input').removeClass('editable');
			$('#document-name-input').focus(function() { $(this).blur(); });
			// Call decodeURIComponent twice: Reverse both our encoding and the encoding of
			// the name in the file system.
			$('#document-name-input').val(decodeURIComponent(decodeURIComponent(this.map.options.doc.replace(/.*\//, '')))
							  // To conveniently see the initial visualViewport scale and size, un-comment the following line.
							  // + ' (' + window.visualViewport.scale + '*' + window.visualViewport.width + 'x' + window.visualViewport.height + ')'
							  // TODO: Yes, it would be better to see it change as you rotate the device or invoke Split View.
							 );
		}
	},

	onWopiProps: function(e) {
		if (e.BaseFileName !== null)
			// set the document name into the name field
			$('#document-name-input').val(e.BreadcrumbDocName !== undefined ? e.BreadcrumbDocName : e.BaseFileName);
		if (e.UserCanNotWriteRelative === false) {
			// Save As allowed
			$('#document-name-input').prop('disabled', false);
			$('#document-name-input').addClass('editable');
			$('#document-name-input').off('keypress', this.onDocumentNameKeyPress).on('keypress', this.onDocumentNameKeyPress.bind(this));
			$('#document-name-input').off('focus', this.onDocumentNameFocus).on('focus', this.onDocumentNameFocus.bind(this));
			$('#document-name-input').off('blur', this.documentNameCancel).on('blur', this.documentNameCancel.bind(this));
		} else {
			$('#document-name-input').prop('disabled', true);
			$('#document-name-input').removeClass('editable');
			$('#document-name-input').off('keypress', this.onDocumentNameKeyPress);
		}
	},

	onResize: function() {
		this._setNameInputWidth();
	},

	_getMaxAvailableWidth: function() {
		var x = $('#document-titlebar').prop('offsetLeft') + $('.document-title').prop('offsetLeft') + $('#document-name-input').prop('offsetLeft');
		var containerWidth = parseInt($('.main-nav').css('width'));
		var maxWidth = Math.max(containerWidth - x - 30, 0);
		maxWidth = Math.max(maxWidth, 300); // input field at least 300px
		return maxWidth;
	},

	_setNameInputWidth: function(tail) {
		var documentNameInput = $('#document-name-input');
		var content = (typeof tail === 'string') ? documentNameInput.val() + tail : documentNameInput.val();
		var font = documentNameInput.css('font');
		var textWidth = L.getTextWidth(content, font) + 24;
		var maxWidth = this._getMaxAvailableWidth();
		//console.log('_setNameInputWidth: textWidth: ' + textWidth + ', maxWidth: ' + maxWidth);
		textWidth = Math.min(textWidth, maxWidth);
		documentNameInput.css('width', textWidth + 'px');
	}
});

L.control.documentNameInput = function () {
	return new L.Control.DocumentNameInput();
};
