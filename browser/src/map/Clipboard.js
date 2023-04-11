/* -*- js-indent-level: 8 -*- */
/*
 * L.Clipboard is used to abstract our storage and management of
 * local & remote clipboard data.
 */
/* global app _ brandProductName $ */

// Get all interesting clipboard related events here, and handle
// download logic in one place ...
// We keep track of the current selection content if it is simple
// So we can do synchronous copy/paste in the callback if possible.
L.Clipboard = L.Class.extend({
	initialize: function(map) {
		this._map = map;
		this._selectionContent = '';
		this._selectionType = null;
		this._accessKey = [ '', '' ];
		this._clipboardSerial = 0; // incremented on each operation
		this._failedTimer = null;
		this._dummyDivName = 'copy-paste-container';
		this._unoCommandForCopyCutPaste = null;

		var div = document.createElement('div');
		this._dummyDiv = div;

		div.setAttribute('id', this._dummyDivName);
		div.setAttribute('style', 'user-select: text !important');
		div.style.opacity = '0';
		div.setAttribute('contenteditable', 'true');
		div.setAttribute('type', 'text');
		div.setAttribute('style', 'position: fixed; left: 0px; top: -200px; width: 15000px; height: 200px; ' +
				 'overflow: hidden; z-index: -1000, -webkit-user-select: text !important; display: block; ' +
				 'font-size: 6pt">');

		// so we get events to where we want them.
		var parent = document.getElementById('map');
		parent.appendChild(div);

		// sensible default content.
		this._resetDiv();

		var that = this;
		var beforeSelect = function(ev) { return that._beforeSelect(ev); };

		document.oncut = function(ev)   { return that.cut(ev); };
		document.oncopy = function(ev)  { return that.copy(ev); };
		document.onpaste = function(ev) { return that.paste(ev); };
		document.onbeforecut = beforeSelect;
		document.onbeforecopy = beforeSelect;
		document.onbeforepaste = beforeSelect;
	},

	// We can do a much better job when we fetch text/plain too.
	stripHTML: function(html) {
		var tmp = new DOMParser().parseFromString(html, 'text/html').body;
		// attempt to cleanup unwanted elements
		var styles = tmp.querySelectorAll('style');
		for (var i = 0; i < styles.length; i++) {
			styles[i].parentNode.removeChild(styles[i]);
		}
		return tmp.textContent.trim() || tmp.innerText.trim() || '';
	},

	setKey: function(key) {
		if (this._accessKey[0] === key)
			return;
		this._accessKey[1] = this._accessKey[0];
		this._accessKey[0] = key;
	},

	getMetaBase: function() {
		return window.makeHttpUrl('');
	},

	getMetaPath: function(idx) {
		if (!idx)
			idx = 0;

		var metaPath = '/cool/clipboard?WOPISrc=' + encodeURIComponent(this._map.options.doc) +
			'&ServerId=' + app.socket.WSDServer.Id +
			'&ViewId=' + this._map._docLayer._viewId +
			'&Tag=' + this._accessKey[idx];

		if (window.routeToken !== '')
			metaPath += '&RouteToken='+window.routeToken;

		return metaPath;
	},

	getMetaURL: function(idx) {
		return this.getMetaBase() + this.getMetaPath(idx);
	},

	// Returns the marker used to identify stub messages.
	_getHtmlStubMarker: function() {
		return '<title>Stub HTML Message</title>';
	},

	// Returns true if the argument is a stub html.
	_isStubHtml: function(text) {
		return text.indexOf(this._getHtmlStubMarker()) > 0;
	},

	// wrap some content with our stub magic
	_originWrapBody: function(body, isStub) {
		var encodedOrigin = encodeURIComponent(this.getMetaURL());
		var text =  '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN">\n' +
		            '<html>\n' +
		            '  <head>\n';
		if (isStub)
			text += '    ' + this._getHtmlStubMarker() + '\n';
		text +=     '    <meta http-equiv="content-type" content="text/html; charset=utf-8"/>\n' +
			    '    <meta name="origin" content="' + encodedOrigin + '"/>\n' +
			    '  </head>\n'
			    + body +
			'</html>';
		return text;
	},

	// what an empty clipboard has on it
	_getStubHtml: function() {
		var lang = 'en_US'; // FIXME: l10n
		return this._substProductName(this._originWrapBody(
		    '  <body lang="' + lang + '" dir="ltr">\n' +
		    '    <p>' + _('To paste outside %productName, please first click the \'download\' button') + '</p>\n' +
		    '  </body>\n', true
		));
	},

	// used for DisableCopy mode to fill the clipboard
	_getDisabledCopyStubHtml: function() {
		var lang = 'en_US'; // FIXME: l10n
		return this._substProductName(this._originWrapBody(
		    '  <body lang="' + lang + '" dir="ltr">\n' +
		    '    <p>' + _('Copying from the document disabled') + '</p>\n' +
		    '  </body>\n', true
		));
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
			window.app.console.log('Mis-understood foreign origin: "' + meta + '"');
		return '';
	},

	_encodeHtmlToBlob: function(text) {
		var content = [];
		var data = new Blob([text]);
		content.push('text/html\n');
		content.push(data.size.toString(16) + '\n');
		content.push(data);
		content.push('\n');
		return new Blob(content);
	},

	_readContentSyncToBlob: function(dataTransfer) {
		var content = [];
		var types = dataTransfer.types;
		for (var t = 0; t < types.length; ++t) {
			if (types[t] === 'Files')
				continue; // images handled elsewhere.
			var dataStr = dataTransfer.getData(types[t]);
			// Avoid types that has no content.
			if (!dataStr.length)
				continue;
			var data = new Blob([dataStr]);
			window.app.console.log('type ' + types[t] + ' length ' + data.size +
				    ' -> 0x' + data.size.toString(16) + '\n');
			content.push((types[t] === 'text' ? 'text/plain' : types[t]) + '\n');
			content.push(data.size.toString(16) + '\n');
			content.push(data);
			content.push('\n');
		}
		if (content.length > 0)
			return new Blob(content, {type : 'application/octet-stream', endings: 'transparent'});
		else
			return null;
	},

	// Abstract async post & download for our progress wrappers
	// type: GET or POST
	// url:  where to get / send the data
	// optionalFormData: used for POST for form data
	// forClipboard: a boolean telling if we need the "Confirm copy to clipboard" link in the end
	// completeFn: called on completion - with response.
	// progressFn: allows splitting the progress bar up.
	_doAsyncDownload: function(type,url,optionalFormData,forClipboard,completeFn,progressFn,onErrorFn) {
		try {
			var that = this;
			var request = new XMLHttpRequest();

			// avoid to invoke the following code if the download widget depends on user interaction
			if (!that._downloadProgress || !that._downloadProgress.isVisible()) {
				that._startProgress();
				that._downloadProgress.startProgressMode();
			}
			request.onload = function() {
				that._downloadProgress._onComplete();
				if (!forClipboard) {
					that._downloadProgress._onClose();
				}

				// For some reason 400 error from the server doesn't
				// invoke onerror callback, but we do get here with
				// size==0, which signifies no response from the server.
				// So we check the status code instead.
				if (this.status == 200) {
					completeFn(this.response);
				} else if (onErrorFn) {
					onErrorFn(this.response);
				}
			};
			request.onerror = function() {
				if (onErrorFn)
					onErrorFn();
				that._downloadProgress._onComplete();
				that._downloadProgress._onClose();
			};

			request.upload.addEventListener('progress', function (e) {
				if (e.lengthComputable) {
					var percent = progressFn(e.loaded / e.total * 100);
					var progress = { statusType: 'setvalue', value: percent };
					that._downloadProgress._onUpdateProgress(progress);
				}
			}, false);

			if ('processCoolUrl' in window) {
				url = window.processCoolUrl({ url: url, type: 'clipboard' });
			}

			request.open(type, url, true /* isAsync */);
			request.timeout = 30 * 1000; // 30 secs ...
			request.responseType = 'blob';
			if (optionalFormData !== null)
				request.send(optionalFormData);
			else
				request.send();
		} catch (error) {
			if (onErrorFn)
				onErrorFn();
		}
	},

	// Suck the data from one server to another asynchronously ...
	_dataTransferDownloadAndPasteAsync: function(src, dest, fallbackHtml) {
		var that = this;
		// FIXME: add a timestamp in the links (?) ignore old / un-responsive servers (?)
		that._doAsyncDownload(
			'GET', src, null, false,
			function(response) {
				window.app.console.log('download done - response ' + response);
				var formData = new FormData();
				formData.append('data', response, 'clipboard');
				that._doAsyncDownload(
					'POST', dest, formData, false,
					function() {
						if (this.isPasteSpecialDialogOpen()) {
							this._map.jsdialog.closeDialog(this.pasteSpecialDialogId, false);
							window.app.console.log('up-load done, now paste special');
							app.socket.sendMessage('uno .uno:PasteSpecial');
						} else {
							window.app.console.log('up-load done, now paste');
							app.socket.sendMessage('uno .uno:Paste');
						}

					},
					function(progress) { return 50 + progress/2; }
				);
			},
			function(progress) { return progress/2; },
			function() {
				window.app.console.log('failed to download clipboard using fallback html');

				// If it's the stub, avoid pasting.
				if (that._isStubHtml(fallbackHtml))
				{
					// Let the user know they haven't really copied document content.
					this._map.uiManager.showInfoModal('data transfer warning', '', _('Failed to download clipboard, please re-copy'));
					return;
				}

				var formData = new FormData();
				formData.append('data', new Blob([fallbackHtml]), 'clipboard');
				that._doAsyncDownload(
					'POST', dest, formData, false,
					function() {
						if (this.isPasteSpecialDialogOpen()) {
							this._map.jsdialog.closeDialog(this.pasteSpecialDialogId, false);
							window.app.console.log('up-load of fallback done, now paste special');
							app.socket.sendMessage('uno .uno:PasteSpecial');
						} else {
							window.app.console.log('up-load of fallback done, now paste');
							app.socket.sendMessage('uno .uno:Paste');
						}

					},
					function(progress) { return 50 + progress/2; },
					function() {
						that.dataTransferToDocumentFallback(null, fallbackHtml);
					}
				);
			}
		);
	},

	_onFileLoadFunc: function(file) {
		var socket = app.socket;
		return function(e) {
			var blob = new Blob(['paste mimetype=' + file.type + '\n', e.target.result]);
			socket.sendMessage(blob);
		};
	},

	_asyncReadPasteImage: function(file) {
		if (file.type.match(/image.*/)) {
			var reader = new FileReader();
			reader.onload = this._onFileLoadFunc(file);
			reader.readAsArrayBuffer(file);
			return true;
		}
		return false;
	},

	// Returns true if it finished synchronously, and false if it have started an async operation
	// that will likely end at a later time (required to avoid closing progress bar in paste(ev))
	dataTransferToDocument: function (dataTransfer, preferInternal, htmlText, usePasteKeyEvent) {
		// Look for our HTML meta magic.
		//   cf. ClientSession.cpp /textselectioncontent:/

		var meta = this._getMetaOrigin(htmlText);
		var id = this.getMetaPath(0);
		var idOld = this.getMetaPath(1);

		// for the paste, we always prefer the internal LOK's copy/paste
		if (preferInternal === true &&
		    (meta.indexOf(id) >= 0 || meta.indexOf(idOld) >= 0))
		{
			// Home from home: short-circuit internally.
			window.app.console.log('short-circuit, internal paste');
			this._doInternalPaste(this._map, usePasteKeyEvent);
			return true;
		}

		// Do we have a remote Online we can suck rich data from ?
		if (meta !== '')
		{
			window.app.console.log('Transfer between servers\n\t"' + meta + '" vs. \n\t"' + id + '"');
			this._dataTransferDownloadAndPasteAsync(meta, this.getMetaURL(), htmlText);
			return false; // just started async operation - did not finish yet
		}

		// Fallback.
		this.dataTransferToDocumentFallback(dataTransfer, htmlText, usePasteKeyEvent);
		return true;
	},

	dataTransferToDocumentFallback: function(dataTransfer, htmlText, usePasteKeyEvent) {

		var content;
		if (dataTransfer) {
			// Suck HTML content out of dataTransfer now while it feels like working.
			content = this._readContentSyncToBlob(dataTransfer);
		}

		// Fallback on the html.
		if (!content && htmlText != '') {
			content = this._encodeHtmlToBlob(htmlText);
		}

		// FIXME: do we want this section ?

		// Images get a look in only if we have no content and are async
		var htmlImage = htmlText.substring(0, 4) === '<img';
		if (((content == null && htmlText === '') || htmlImage) && dataTransfer != null)
		{
			var types = dataTransfer.types;

			window.app.console.log('Attempting to paste image(s)');

			// first try to transfer images
			// TODO if we have both Files and a normal mimetype, should we handle
			// both, or prefer one or the other?
			for (var t = 0; t < types.length; ++t) {
				window.app.console.log('\ttype' + types[t]);
				if (types[t] === 'Files') {
					var files = dataTransfer.files;
					if (files !== null)
					{
						for (var f = 0; f < files.length; ++f)
							this._asyncReadPasteImage(files[f]);
					}
					else // IE / Edge
						this._asyncReadPasteImage(dataTransfer.items[t].getAsFile());
				}
			}
			return;
		}

		if (content != null) {
			window.app.console.log('Normal HTML, so smart paste not possible');

			var formData = new FormData();
			formData.append('file', content);

			var that = this;
			this._doAsyncDownload('POST', this.getMetaURL(), formData, false,
				function() {
					window.app.console.log('Posted ' + content.size + ' bytes successfully');
					that._doInternalPaste(that._map, usePasteKeyEvent);
				},
				function(progress) { return progress; }
					    );
		} else {
			window.app.console.log('Nothing we can paste on the clipboard');
		}
	},

	_checkSelection: function() {
		var checkSelect = document.getSelection();
		if (checkSelect && checkSelect.isCollapsed)
			window.app.console.log('Error: collapsed selection - cannot copy/paste');
	},

	_getHtmlForClipboard: function() {
		var text;

		if ($('.ui-edit').is(':focus'))
			return $('.ui-edit').value();

		if ($('.w2ui-input').is(':focus'))
			return $('.w2ui-input').value();

		if (this._selectionType === 'complex' ||
		    this._map._docLayer.hasGraphicSelection()) {
			window.app.console.log('Copy/Cut with complex/graphical selection');
			if (this._selectionType === 'text' && this._selectionContent !== '')
			{ // back here again having downloaded it ...
				text = this._selectionContent;
				window.app.console.log('Use downloaded selection.');
			}
			else
			{
				window.app.console.log('Downloaded that selection.');
				text = this._getStubHtml();
				this._onDownloadOnLargeCopyPaste();
				this._downloadProgress.setURI( // richer, bigger HTML ...
					this.getMetaURL() + '&MimeType=text/html');
			}
		} else if (this._selectionType === null) {
			window.app.console.log('Copy/Cut with no selection!');
			text = this._getStubHtml();
		} else {
			window.app.console.log('Copy/Cut with simple text selection');
			text = this._selectionContent;
		}
		return text;
	},

	// returns whether we shold stop processing the event
	populateClipboard: function(ev) {
		this._checkSelection();

		var text = this._getHtmlForClipboard();
		//this._stopHideDownload(); - this confuses the browser ruins copy/cut on iOS

		var plainText = this.stripHTML(text);
		if (ev.clipboardData) { // Standard
			if (this._unoCommandForCopyCutPaste === '.uno:CopyHyperlinkLocation') {
				var ess = 's';
				var re = new RegExp('^(.*)(<a href=")([^"]+)(">.*</a>)(</p>\n</body>\n</html>)$', ess);
				var match = re.exec(text);
				if (match !== null && match.length === 6) {
					text = match[1] + match[3] + match[5];
					plainText = this.stripHTML(text);
				}
			}
			// if copied content is graphical then plainText is null and it does not work on mobile.
			ev.clipboardData.setData('text/plain', plainText ? plainText: ' ');
			ev.clipboardData.setData('text/html', text);
			window.app.console.log('Put "' + text + '" on the clipboard');
			this._clipboardSerial++;
		}

		return true; // prevent default
	},

	_isAnyInputFieldSelected: function() {
		if ($('#search-input').is(':focus'))
			return true;

		if ($('.ui-edit').is(':focus'))
			return true;

		if ($('.ui-textarea').is(':focus'))
			return true;

		if ($('.w2ui-input').is(':focus'))
			return true;

		if (this._map.uiManager.isAnyDialogOpen() && !this.isPasteSpecialDialogOpen())
			return true;

		if ($('.annotation-active').length && $('.cool-annotation-edit').is(':visible'))
		    return true;

		return false;
	},

	_isFormulabarSelected: function() {
		if ($('#sc_input_window').is(':focus'))
			return true;
		return false;
	},

	// Does the selection of text before an event comes in
	_beforeSelect: function(ev) {
		window.app.console.log('Got event ' + ev.type + ' setting up selection');

		if (this._isAnyInputFieldSelected())
			return;

		this._beforeSelectImpl();
	},

	_beforeSelectImpl: function() {
		// We need some spaces in there ...
		this._resetDiv();

		var sel = document.getSelection();
		if (!sel)
			return;

		var selected = false;
		var selectRange;

		if (!selected)
		{
			sel.removeAllRanges();
			selectRange = document.createRange();
			selectRange.selectNodeContents(this._dummyDiv);
			sel.addRange(selectRange);

			var checkSelect = document.getSelection();
			if (checkSelect.isCollapsed)
				window.app.console.log('Error: failed to select - cannot copy/paste');
		}

		return false;
	},

	_resetDiv: function() {
		// cleanup the content:
		this._dummyDiv.innerHTML =
			'<b style="font-weight:normal; background-color: transparent; color: transparent;"><span>&nbsp;&nbsp;</span></b>';
	},

	// Try-harder fallbacks for emitting cut/copy/paste events.
	_execOnElement: function(operation) {
		var serial = this._clipboardSerial;

		this._resetDiv();

		var success = false;
		var active = null;

		// selection can change focus.
		active = document.activeElement;

		success = (document.execCommand(operation) &&
			   serial !== this._clipboardSerial);

		// try to restore focus if we need to.
		if (active !== null && active !== document.activeElement)
			active.focus();

		window.app.console.log('fallback ' + operation + ' ' + (success?'success':'fail'));

		return success;
	},

	// Encourage browser(s) to actually execute the command
	_execCopyCutPaste: function(operation, cmd) {
		var serial = this._clipboardSerial;

		this._unoCommandForCopyCutPaste = cmd;
		if (document.execCommand(operation) &&
		    serial !== this._clipboardSerial) {
			window.app.console.log('copied successfully');
			this._unoCommandForCopyCutPaste = null;
			return;
		}
		this._unoCommandForCopyCutPaste = null;

		// try a hidden div
		if (this._execOnElement(operation)) {
			window.app.console.log('copied on element successfully');
			return;
		}

		// see if we have help for paste
		if (operation === 'paste')
		{
			try {
				window.app.console.warn('Asked parent for a paste event');
				this._map.fire('postMessage', {msgId: 'UI_Paste'});
			} catch (error) {
				window.app.console.warn('Failed to post-message: ' + error);
			}
		}

		// wait and see if we get some help
		var that = this;
		clearTimeout(this._failedTimer);
		setTimeout(function() {
			if (that._clipboardSerial !== serial)
			{
				window.app.console.log('successful ' + operation);
				if (operation === 'paste')
					that._stopHideDownload();
			}
			else
			{
				window.app.console.log('help did not arrive for ' + operation);
				that._warnCopyPaste();
			}
		}, 150 /* ms */);
	},

	// Pull UNO clipboard commands out from menus and normal user input.
	// We try to massage and re-emit these, to get good security event / credentials.
	filterExecCopyPaste: function(cmd) {
		if (window.ThisIsAMobileApp) {
			// We do native copy/paste in the iOS and Android cases
			return false;
		}

		if (this._map['wopi'].DisableCopy && (cmd === '.uno:Copy' || cmd === '.uno:Cut')) {
			// perform internal operations
			app.socket.sendMessage('uno ' + cmd);
			return true;
		}

		if (cmd === '.uno:Copy' || (L.Browser.mobile && L.Browser.safari && cmd === '.uno:CopyHyperlinkLocation')) {
			this._execCopyCutPaste('copy', cmd);
		} else if (cmd === '.uno:Cut') {
			this._execCopyCutPaste('cut', cmd);
		} else if (cmd === '.uno:Paste') {
			this._execCopyCutPaste('paste', cmd);
		} else if (cmd === '.uno:PasteSpecial') {
			this._openPasteSpecialPopup();
		} else {
			return false;
		}
		window.app.console.log('filtered uno command ' + cmd);
		return true;
	},

	_doCopyCut: function(ev, unoName) {
		window.app.console.log(unoName);

		if (this._isAnyInputFieldSelected())
			return;

		if (this._downloadProgressStatus() === 'downloadButton')
			this._stopHideDownload(); // Terminate pending confirmation

		var preventDefault = true;

		if (this._map['wopi'].DisableCopy === true)
		{
			var text = this._getDisabledCopyStubHtml();
			var plainText = this.stripHTML(text);
			if (ev.clipboardData) {
				window.app.console.log('Copying disabled: put stub message on the clipboard');
				ev.clipboardData.setData('text/plain', plainText ? plainText: ' ');
				ev.clipboardData.setData('text/html', text);
				this._clipboardSerial++;
			}
		} else {
			preventDefault = this.populateClipboard(ev);
		}

		app.socket.sendMessage('uno .uno:' + unoName);
		if (preventDefault) {
			ev.preventDefault();
			return false;
		}
	},

	_doInternalPaste: function(map, usePasteKeyEvent) {
		if (usePasteKeyEvent) {
			// paste into dialog
			var KEY_PASTE = 1299;
			map._textInput._sendKeyEvent(0, KEY_PASTE);
		} else if (this.isPasteSpecialDialogOpen()) {
			this._map.jsdialog.closeDialog(this.pasteSpecialDialogId, false);
			app.socket.sendMessage('uno .uno:PasteSpecial');
		} else {
			// paste into document
			app.socket.sendMessage('uno .uno:Paste');
		}
	},

	cut:  function(ev) { return this._doCopyCut(ev, 'Cut'); },

	copy: function(ev) { return this._doCopyCut(ev, 'Copy'); },

	paste: function(ev) {
		if (this._map.isReadOnlyMode())
			return;

		window.app.console.log('Paste');

		if (this._isAnyInputFieldSelected() && !this._isFormulabarSelected())
			return;

		// If the focus is in the search box, paste there.
		if (this._map.isSearching())
			return;

		if (this._downloadProgressStatus() === 'downloadButton')
			this._stopHideDownload(); // Terminate pending confirmation

		if (this._map._activeDialog)
			ev.usePasteKeyEvent = true;

		if (ev.clipboardData) {
			ev.preventDefault();
			var usePasteKeyEvent = ev.usePasteKeyEvent;
			// Always capture the html content separate as we may lose it when we
			// pass the clipboard data to a different context (async calls, f.e.).
			var htmlText = ev.clipboardData.getData('text/html');
			var hasFinished = this.dataTransferToDocument(ev.clipboardData, /* preferInternal = */ true, htmlText, usePasteKeyEvent);
			this._map._textInput._abortComposition(ev);
			this._clipboardSerial++;
			if (hasFinished)
				this._stopHideDownload();
		}
		return false;
	},

	clearSelection: function() {
		this._selectionContent = '';
		this._selectionType = null;
		this._scheduleHideDownload(15);
	},

	// textselectioncontent: message
	setTextSelectionHTML: function(html) {
		this._selectionType = 'text';
		this._selectionContent = html;
		if (L.Browser.cypressTest) {
			this._dummyDiv.innerHTML = html;
		}
		this._scheduleHideDownload(15);
	},

	// sets the selection to some (cell formula) text)
	setTextSelectionText: function(text) {
		this._selectionType = 'text';
		this._selectionContent = this._originWrapBody(
			'<body>' + text + '</body>');
		this._scheduleHideDownload(15);
	},

	// complexselection: message
	onComplexSelection: function (/*text*/) {
		// Mark this selection as complex.
		this._selectionType = 'complex';
		this._scheduleHideDownload(15);
	},

	_startProgress: function() {
		if (!this._downloadProgress) {
			this._downloadProgress = L.control.downloadProgress();
		}
		if (!this._downloadProgress.isVisible()) {
			this._downloadProgress.addTo(this._map);
		}
		this._downloadProgress.show();
	},

	_onDownloadOnLargeCopyPaste: function () {
		if (!this._downloadProgress || this._downloadProgress.isClosed()) {
			this._warnFirstLargeCopyPaste();
			this._startProgress();
		}
		else if (this._downloadProgress.isStarted()) {
			// Need to show this only when a download is really in progress and we block it.
			// Otherwise, it's easier to flash the widget or something.
			this._warnLargeCopyPasteAlreadyStarted();
		}
	},

	_downloadProgressStatus: function() {
		if (this._downloadProgress && this._downloadProgress.isVisible())
			return this._downloadProgress.currentStatus();
	},

	// Download button is still shown after selection changed -> user has changed their mind...
	_scheduleHideDownload: function(s) {
		if (!this._downloadProgress || !this._downloadProgress.isVisible())
			return;

		// If no other copy/paste things occurred then ...
		var that = this;
		var serial = this._clipboardSerial;
		if (!this._hideDownloadTimer)
			this._hideDownloadTimer = setTimeout(function() {
				that._hideDownloadTimer = null;
				if (serial == that._clipboardSerial && that._downloadProgressStatus() === 'downloadButton')
					that._stopHideDownload();
			}, 1000 * s);
	},

	// useful if we did an internal paste already and don't want that.
	_stopHideDownload: function() {
		clearTimeout(this._hideDownloadTimer);
		this._hideDownloadTimer = null;

		if (!this._downloadProgress ||
		    !this._downloadProgress.isVisible() ||
		    this._downloadProgress.isClosed())
			return;
		this._downloadProgress._onClose();
	},

	_userAlreadyWarned: function (warning) {
		var itemKey = warning;
		var storage = localStorage;
		if (storage && !storage.getItem(itemKey)) {
			storage.setItem(itemKey, '1');
			return false;
		} else if (!storage)
			return false;

		return true;
	},

	_warnCopyPaste: function() {
		var msg;
		if (window.mode.isMobile() || window.mode.isTablet()) {
			msg = _('<p>Please use the copy/paste buttons on your on-screen keyboard.</p>');
		} else {
			msg = _('<p>Your browser has very limited access to the clipboard, so use these keyboard shortcuts:</p><table class="warn-copy-paste"><tr><td><kbd>Ctrl</kbd><span class="kbd--plus">+</span><kbd>C</kbd></td><td><kbd>Ctrl</kbd><span class="kbd--plus">+</span><kbd>X</kbd></td><td><kbd>Ctrl</kbd><span class="kbd--plus">+</span><kbd>V</kbd></td></tr><tr><td>Copy</td><td>Cut</td><td>Paste</td></tr></table>');
			msg = L.Util.replaceCtrlAltInMac(msg);
		}

		var id = 'copy_paste_warning';
		this._map.uiManager.showYesNoButton(id + '-box', '', '', _('OK'), null, null, null, true);
		var box = document.getElementById(id + '-box');
		var innerDiv = L.DomUtil.create('div', '', null);
		box.insertBefore(innerDiv, box.firstChild);
		innerDiv.innerHTML = msg;
	},

	_substProductName: function (msg) {
		var productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'Collabora Online Development Edition (unbranded)';
		return msg.replace('%productName', productName);
	},

	_warnFirstLargeCopyPaste: function () {
		if (this._userAlreadyWarned('warnedAboutLargeCopy'))
			return;

		var msg = _('<p>If you would like to share larger elements of your document with other applications ' +
			    'it is necessary to first download them onto your device. To do that press the ' +
			    '"Start download" button below, and when complete click "Confirm copy to clipboard".</p>' +
			    '<p>If you are copy and pasting between documents inside %productName, ' +
			    'there is no need to download.</p>');

		this._map.uiManager.showInfoModal('large_copy_paste_warning');
		document.getElementById('large_copy_paste_warning').innerHTML = this._substProductName(msg);
		document.getElementById('large_copy_paste_warning').tabIndex = 0;
		document.getElementById('large_copy_paste_warning').focus(); // We hid the OK button, we need to set focus manually on the popup.
	},

	_warnLargeCopyPasteAlreadyStarted: function () {
		this._map.uiManager.showInfoModal('large copy paste started warning');
		document.getElementById('large copy paste started warning').innerHTML = _('<p>A download due to a large copy/paste operation has already started. ' +
		'Please, wait for the current download or cancel it before starting a new one</p>');
	},

	isPasteSpecialDialogOpen: function() {
		return document.getElementById('paste_special_dialog') ? true: false;
	},

	_openPasteSpecialPopup: function () {
		var msg = _('<p>Your browser has very limited access to the clipboard</p><p>Please press now: <kbd>Ctrl</kbd><span class="kbd--plus">+</span><kbd>V</kbd> to see more options</p><p>Close popup to ignore paste special</p>');
		msg = L.Util.replaceCtrlAltInMac(msg);

		// We will use this for closing the dialog.
		this.pasteSpecialDialogId = this._map.uiManager.generateModalId('paste_special_dialog');

		var id = 'paste_special_dialog';
		this._map.uiManager.showYesNoButton(id + '-box', '', '', _('OK'), null, null, null, true);
		var box = document.getElementById(id + '-box');
		var innerDiv = L.DomUtil.create('div', '', null);
		box.insertBefore(innerDiv, box.firstChild);
		innerDiv.innerHTML = msg;
	},
});

L.clipboard = function(map) {
	if (window.ThisIsAMobileApp)
		window.app.console.log('======> Assertion failed!? No L.Clipboard object should be needed in a mobile app');
	return new L.Clipboard(map);
};
