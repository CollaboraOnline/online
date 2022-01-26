/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.FileInserter is handling the fileInserter action
 */

/* global app _ Uint8Array errorMessages */

L.Map.mergeOptions({
	fileInserter: true
});

L.Map.FileInserter = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
		this._childId = null;
		this._toInsert = {};
		this._toInsertURL = {};
		this._toInsertBackground = {};
		var parser = document.createElement('a');
		parser.href = window.host;
	},

	getWopiUrl: function (map) {
		return window.makeHttpUrlWopiSrc('/' + map.options.urlPrefix + '/', map.options.doc, '/insertfile');
	},

	addHooks: function () {
		this._map.on('insertfile', this._onInsertFile, this);
		this._map.on('inserturl', this._onInsertURL, this);
		this._map.on('childid', this._onChildIdMsg, this);
		this._map.on('selectbackground', this._onSelectBackground, this);
	},

	removeHooks: function () {
		this._map.off('insertfile', this._onInsertFile, this);
		this._map.off('inserturl', this._onInsertURL, this);
		this._map.off('childid', this._onChildIdMsg, this);
		this._map.off('selectbackground', this._onSelectBackground, this);
	},

	_onInsertFile: function (e) {
		if (!this._childId) {
			app.socket.sendMessage('getchildid');
			this._toInsert[Date.now()] = e.file;
		}
		else {
			this._sendFile(Date.now(), e.file, 'graphic');
		}
	},

	_onInsertURL: function (e) {
		if (!this._childId) {
			app.socket.sendMessage('getchildid');
			this._toInsertURL[Date.now()] = e.url;
		}
		else {
			this._sendURL(Date.now(), e.url);
		}
	},

	_onSelectBackground: function (e) {
		if (!this._childId) {
			app.socket.sendMessage('getchildid');
			this._toInsertBackground[Date.now()] = e.file;
		}
		else {
			this._sendFile(Date.now(), e.file, 'selectbackground');
		}
	},

	_onChildIdMsg: function (e) {
		// When childId is not created (usually when we insert file/URL very first time), we send message to get child ID
		// and store the file(s) into respective arrays (look at _onInsertFile, _onInsertURL, _onSelectBackground)
		// When we receive the childId we empty all the array and insert respective file/URL from here

		this._childId = e.id;
		for (var name in this._toInsert) {
			this._sendFile(name, this._toInsert[name], 'graphic');
		}
		this._toInsert = {};

		for (name in this._toInsertURL) {
			this._sendURL(name, this._toInsertURL[name]);
		}
		this._toInsertURL = {};

		for (name in this._toInsertBackground) {
			this._sendFile(name, this._toInsertBackground[name], 'selectbackground');
		}
		this._toInsertBackground = {};
	},

	_sendFile: function (name, file, type) {
		var socket = app.socket;
		var map = this._map;
		var url = this.getWopiUrl(map);

		if ('processCoolUrl' in window) {
			url = window.processCoolUrl({ url: url, type: 'insertfile' });
		}

		if (!(file.filename && file.url) && (file.name === '' || file.size === 0)) {
			var errMsg =  _('The file of type: %0 cannot be uploaded to server since the file has no name');
			if (file.size === 0)
				errMsg = _('The file of type: %0 cannot be uploaded to server since the file is empty');
			errMsg = errMsg.replace('%0', file.type);
			map.fire('error', {msg: errMsg});
			return;
		}

		this._toInsertBackground = {};

		if (window.ThisIsAMobileApp) {
			// Pass the file contents as a base64-encoded parameter in an insertfile message
			var reader = new FileReader();
			reader.onload = (function(aFile) {
				return function(e) {
					var byteBuffer = new Uint8Array(e.target.result);
					var strBytes = '';
					for (var i = 0; i < byteBuffer.length; i++) {
						strBytes += String.fromCharCode(byteBuffer[i]);
					}
					window.postMobileMessage('insertfile name=' + aFile.name + ' type=' + type +
										       ' data=' + window.btoa(strBytes));
				};
			})(file);
			reader.onerror = function(e) {
				window.postMobileError('Error when reading file: ' + e);
			};
			reader.onprogress = function(e) {
				window.postMobileDebug('FileReader progress: ' + Math.round(e.loaded*100 / e.total) + '%');
			};
			reader.readAsArrayBuffer(file);
		} else {
			var xmlHttp = new XMLHttpRequest();
			this._map.showBusy(_('Uploading...'), false);
			xmlHttp.onreadystatechange = function () {
				if (xmlHttp.readyState === 4) {
					map.hideBusy();
					if (xmlHttp.status === 200) {
						socket.sendMessage('insertfile name=' + name + ' type=' + type);
					}
					else if (xmlHttp.status === 404) {
						map.fire('error', {msg: errorMessages.uploadfile.notfound});
					}
					else if (xmlHttp.status === 413) {
						map.fire('error', {msg: errorMessages.uploadfile.toolarge});
					}
					else {
						var msg = _('Uploading file to server failed with status: %0');
						msg = msg.replace('%0', xmlHttp.status);
						map.fire('error', {msg: msg});
					}
				}
			};
			xmlHttp.open('POST', url, true);
			var formData = new FormData();
			formData.append('name', name);
			formData.append('childid', this._childId);
			if (file.filename && file.url) {
				formData.append('url', file.url);
				formData.append('filename', file.filename);
			} else {
				formData.append('file', file);
			}
			xmlHttp.send(formData);

			// Set it to null in case server restarts/shuts down or the user reconnects after being idle
			// these change the childId but it would be cached already with the old one if a previous insertfile is made.
			// in that case we would get http error 400 because of the wrong childId.
			// when it's null we ask for a new childId before uploading.
			this._childId = null;
		}
	},

	_sendURL: function (name, url) {
		app.socket.sendMessage('insertfile name=' + encodeURIComponent(url) + ' type=graphicurl');
	}
});

L.Map.addInitHook('addHandler', 'fileInserter', L.Map.FileInserter);
