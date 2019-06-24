/* -*- js-indent-level: 8 -*- */
/*
 * L.Clipboard is used to abstract our storage and management of
 * local & remote clipboard data.
 */
/* global _ vex */

// Get all interesting clipboard related events here, and handle
// download logic in one place ...
// We keep track of the current selection content if it is simple
// So we can do synchronous copy/paste in the callback if possible.
L.Clipboard = L.Class.extend({
	initialize: function(map) {
		this._map = map;
		this._selectionContent = '';
		this._selected = '';
		this._accessKey = '';
	},

	stripHTML: function(html) { // grim.
		var tmp = document.createElement('div');
		tmp.innerHTML = html;
		return tmp.textContent || tmp.innerText || '';
	},

	clipboardSet: function(event, text) {
		if (event.clipboardData) { // Standard
			event.clipboardData.setData('text/html', text);
		}
		else if (window.clipboardData) { // IE 11 - poor clipboard API
			window.clipboardData.setData('Text', this.stripHTML(text));
		}
	},

	setKey: function(key) {
		this._accessKey = key;
	},

	_getMetaOrigin: function (html) {
		var match = '<meta name="origin" content="';
		var start = html.indexOf(match);
		if (start < 0) {
			return '';
		}
		var end = html.indexOf('"', start + match.length);
		if (end < 0) {
			return '';
		}
		var meta = html.substring(start + match.length, end);

		// quick sanity checks that it one of ours.
		if (meta.indexOf('%2Fclipboard%3FWOPISrc%3D') > 0 &&
		    meta.indexOf('%26ServerId%3D') > 0 &&
		    meta.indexOf('%26ViewId%3D') > 0 &&
		    meta.indexOf('%26Tag%3D') > 0)
			return decodeURIComponent(meta);
		else
			console.log('Mis-understood foreign origin: "' + meta + '"');
		return '';
	},

	// FIXME: used ? - sometimes our smart-paste fails & we need to try again.
	// pasteresult: message
	pasteResult : function(state)
	{
		console.log('Paste state: ' + state);
		if (state === 'fallback') {
			if (this._pasteFallback != null) {
				console.log('Paste failed- falling back to HTML');
				this._map._socket.sendMessage(this._pasteFallback);
			} else {
				console.log('No paste fallback present.');
			}
		}

		this._pasteFallback = null;
	},

	_readContentSync: function(dataTransfer) {
		var content = [];
		var types = dataTransfer.types;
		for (var t = 0; t < types.length; ++t) {
			var data = dataTransfer.getData(types[t]);
			content.push(types[t] + '\n');
			content.push(data.length.toString(16) + '\n');
			content.push(data);
			content.push('\n');
		}
		return new Blob(content);
	},

	dataTransferToDocument: function (dataTransfer, preferInternal) {
		// Look for our HTML meta magic.
		//   cf. ClientSession.cpp /textselectioncontent:/
		this._startProgress();
		this._downloadProgress._onStartDownload();

		var pasteHtml = dataTransfer.getData('text/html');
		var meta = this._getMetaOrigin(pasteHtml);
		var id = this._map.options.webserver + this._map.options.serviceRoot +
		    '/clipboard?WOPISrc='+ encodeURIComponent(this._map.options.doc) +
			'&ServerId=' + this._map._socket.WSDServer.Id + '&ViewId=' + this._viewId +
			'&Tag=' + this._accessKey;

		// for the paste, we might prefer the internal LOK's copy/paste
		if (meta.indexOf(id) > 0 && preferInternal === true) {
			// Home from home: short-circuit internally.
			console.log('short-circuit, internal paste');
			this._map._socket.sendMessage('uno .uno:Paste');
			return;
		}

		console.log('Mismatching index\n\t"' + meta + '" vs. \n\t"' + id + '"');
		this._pasteFallback = null;

		// Suck HTML content out of dataTransfer now while it feels like working.
		var content = this._readContentSync(dataTransfer);

		// Images get a look in only if we have no content and are async
		if (content == null && pasteHtml == '')
		{
			var types = dataTransfer.types;

			console.log('Attempting to paste image(s)');

			// first try to transfer images
			// TODO if we have both Files and a normal mimetype, should we handle
			// both, or prefer one or the other?
			for (var t = 0; t < types.length; ++t) {
				console.log('\ttype' + types[t]);
				if (types[t] === 'Files') {
					var files = dataTransfer.files;
					for (var f = 0; f < files.length; ++f) {
						var file = files[f];
						if (file.type.match(/image.*/)) {
							var reader = new FileReader();
							reader.onload = this._onFileLoadFunc(file);
							reader.readAsArrayBuffer(file);
						}
					}
				}
			}
			return;
		}

		if (content != null) {
			console.log('Normal HTML, so smart paste not possible');

			var formData = new FormData();
			formData.append('file', content);

			var that = this;
			var request = new XMLHttpRequest();

			request.onreadystatechange = function() {
				if (request.status == 200 && request.readyState == 4) {
					that._map._socket.sendMessage('uno .uno:Paste');
					that._downloadProgress._onClose();
				}
			}

			request.upload.addEventListener('progress', function (e) {
				if (e.lengthComputable) {
					var progress = { statusType: 'setvalue', value: e.loaded / e.total * 100 };
					that._downloadProgress._onUpdateProgress(progress);
				}
			}, false);

			var isAsync = true;
			request.open('POST', id, isAsync);
			request.send(formData);

			this._pasteFallback = null;
		} else {
			console.log('Nothing we can paste on the clipboard');
		}
	},

	copy: function(e) {
		console.log('Copy');
		if (this._map._clipboardContainer.getValue() !== '') {
			this.clipboardSet(e, this._map._clipboardContainer.getValue());
		} else if (this._selectionTextContent) {
			this.clipboardSet(e, this._selectionTextContent);

			// remember the copied text, for rich copy/paste inside a document
			this._selectionTextHash = this._selectionTextContent;
		}

		this._map._socket.sendMessage('uno .uno:Copy');
	},

	cut: function(e) {
		console.log('Cut');
		if (this._map._clipboardContainer.getValue() !== '') {
			this.clipboardSet(e, this._map._clipboardContainer.getValue());
		} else if (this._selectionTextContent) {
			this.clipboardSet(e, this._selectionTextContent);

			// remember the copied text, for rich copy/paste inside a document
			this._selectionTextHash = this._selectionTextContent;
		}

		this._map._socket.sendMessage('uno .uno:Cut');
	},

	paste: function(e) {
		console.log('Paste');
		if (e.clipboardData) { // Standard
			this.dataTransferToDocument(e.clipboardData, /* preferInternal = */ true);
		}
		else if (window.clipboardData) { // IE 11
			this.dataTransferToDocument(window.clipboardData, /* preferInternal = */ true);
		}
	},

	clearSelection: function() {
		this._selectionContent = '';
		this._selected = '';
	},

	setSelection: function(content) {
		this._selectionContent = content;
	},

	// textselectioncontent: message
	setTextSelectionContent: function(text) {
		this.setSelection(text);
	},

	// complexselection: message
	onComplexSelection: function (text) {
		// Put in the clipboard a helpful explanation of what the user should do.
		// Currently we don't have a payload, though we might in the future
		text = _('Please use the following link to download the selection from you document and paste into other applications on your device')
									+ ': '; //FIXME: MISSING URL
		this.setSelection(text);

		//TODO: handle complex selection download.
	},

	_startProgress: function() {
		if (!this._downloadProgress) {
			this._downloadProgress = L.control.downloadProgress();
		}
		if (!this._downloadProgress.isVisible()) {
			this._downloadProgress.addTo(this._map);
			this._downloadProgress.show();
		}
	},

	_onDownloadOnLargeCopyPaste: function () {
		if (!this._downloadProgress) {
			this._warnFirstLargeCopyPaste();
			this._startProgress();
		}
		else {
			this._warnLargeCopyPasteAlreadyStarted();
			//this._downloadProgress._onComplete();
		}
	},

	_warnFirstLargeCopyPaste: function () {
		var self = this;
		vex.dialog.alert({
			message: _('<p>When copying larger pieces of your document, to share them with other applications ' +
				       'on your device for security reasons, please select the "Start download" button below. ' +
				       'A progress bar will show you the download advance. When it is complete select ' +
				       'the "Confirm copy to clipboard" button in order to copy the downloaded data to your clipboard. ' +
				       'At any time you can cancel the download by selecting the top right "X" button.</p>'),
			callback: function () {
				self._map.focus();
			}
		});
	},

	_warnLargeCopyPasteAlreadyStarted: function () {
		var self = this;
		vex.dialog.alert({
			message: _('<p>A download  due to a large copy/paste operation has already started. ' +
				       'Please, wait for the current download to complete before starting a new one</p>'),
			callback: function () {
				self._map.focus();
			}
		});
	},

});

L.clipboard = function(map) {
	return new L.Clipboard(map);
};
