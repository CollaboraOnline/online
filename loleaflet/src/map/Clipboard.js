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
		this._accessKey = [ '', '' ];
	},

	stripHTML: function(html) { // grim.
		var tmp = document.createElement('div');
		tmp.innerHTML = html;
		return tmp.textContent || tmp.innerText || '';
	},

	setKey: function(key) {
		if (this._accessKey[0] === key)
			return;
		this._accessKey[1] = this._accessKey[0];
		this._accessKey[0] = key;
	},

	getMetaBase: function() {
		return this._map.options.webserver + this._map.options.serviceRoot;
	},

	getMetaPath: function(idx) {
		if (!idx)
			idx = 0;
		return '/clipboard?WOPISrc='+ encodeURIComponent(this._map.options.doc) +
			'&ServerId=' + this._map._socket.WSDServer.Id +
			'&ViewId=' + this._map._docLayer._viewId +
			'&Tag=' + this._accessKey[idx];
	},

	getStubHtml: function() {
		var lang = 'en_US'; // FIXME: l10n
		var encodedOrigin = encodeURIComponent(this.getMetaPath());
		return '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN">\n' +
			'<html>\n' +
			'  <head>\n' +
			'     <meta http-equiv="content-type" content="text/html; charset=utf-8"/>\n' +
			'     <meta name="origin" content="' + encodedOrigin + '"/>\n' +
			'  </head>\n' +
			'  <body lang="' + lang + ' dir="ltr">\n' +
			'    <p>' + _('When pasting outside the suite it is necessary to first click the \'download\' button') + '</p>\n' +
			'  </body>\n' +
			'</html>';
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
		if (meta.indexOf('%2Fclipboard%3FWOPISrc%3D') >= 0 &&
		    meta.indexOf('%26ServerId%3D') > 0 &&
		    meta.indexOf('%26ViewId%3D') > 0 &&
		    meta.indexOf('%26Tag%3D') > 0)
			return decodeURIComponent(meta);
		else
			console.log('Mis-understood foreign origin: "' + meta + '"');
		return '';
	},

	_readContentSync: function(dataTransfer) {
		var content = [];
		var types = dataTransfer.types;
		var data = null;
		if (types == null) { // IE
			data = dataTransfer.getData('text');
			content.push('text/plain\n');
			content.push(data.length.toString(16) + '\n');
			content.push(data);
			content.push('\n');
		} else {
			for (var t = 0; t < types.length; ++t) {
				data = dataTransfer.getData(types[t]);
				content.push((types[t] == 'text' ? 'text/plain' : types[t]) + '\n');
				content.push(data.length.toString(16) + '\n');
				content.push(data);
				content.push('\n');
			}
		}
		return new Blob(content);
	},

	dataTransferToDocument: function (dataTransfer, preferInternal) {
		// Look for our HTML meta magic.
		//   cf. ClientSession.cpp /textselectioncontent:/

		var pasteHtml = null;
		if (dataTransfer.types == null) { // IE
			pasteHtml = dataTransfer.getData('text');
		} else {
			pasteHtml = dataTransfer.getData('text/html');
		}
		var meta = this._getMetaOrigin(pasteHtml);
		var id = this.getMetaPath(0);
		var idOld = this.getMetaPath(1);

		// for the paste, we always prefer the internal LOK's copy/paste
		if (preferInternal === true &&
		    (meta.indexOf(id) >= 0 || meta.indexOf(idOld) >= 0))
		{
			// Home from home: short-circuit internally.
			console.log('short-circuit, internal paste');
			this._map._socket.sendMessage('uno .uno:Paste');
			return;
		}

		this._startProgress();
		this._downloadProgress._onStartDownload();

		console.log('Mismatching index\n\t"' + meta + '" vs. \n\t"' + id + '"');

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
					that._downloadProgress._onComplete();
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
		} else {
			console.log('Nothing we can paste on the clipboard');
		}
	},

	populateClipboard: function(e,t) {
		var text;
		if (t === null) {
			console.log('Copy/Cut with no selection!');
			text = this.getStubHtml();
		} else if (t === 'complex') {
			console.log('Copy/Cut with complex/graphical selection');
			text = this.getStubHtml();
		} else {
			console.log('Copy/Cut with simple text selection');
			text = this._selectionContent;
		}

		if (e.clipboardData) { // Standard
			e.clipboardData.setData('text/html', text);
			console.log('Put "' + text + '" on the clipboard');
		}
		else if (window.clipboardData) { // IE 11 - poor clipboard API
			window.clipboardData.setData('Text', this.stripHTML(text));
		}
	},

	copy: function(e,t) {
		console.log('Copy');
		this.populateClipboard(e,t);
		this._map._socket.sendMessage('uno .uno:Copy');
	},

	cut: function(e,t) {
		console.log('Cut');
		this.populateClipboard(e,t);
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
