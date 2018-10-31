/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.FileInserter is handling the fileInserter action
 */

/* global _ */

L.Map.mergeOptions({
	fileInserter: true
});

L.Map.FileInserter = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
		this._childId = null;
		this._toInsert = {};
		this._toInsertURL = {};
		var parser = document.createElement('a');
		parser.href = map.options.server;
		var wopiSrc = '';
		if (map.options.wopiSrc != '') {
			wopiSrc = '?WOPISrc=' + map.options.wopiSrc;
		}
		this._url = map.options.webserver + map.options.serviceRoot + '/' + map.options.urlPrefix +
			'/' + encodeURIComponent(map.options.doc) + '/insertfile' + wopiSrc;
	},

	addHooks: function () {
		this._map.on('insertfile', this._onInsertFile, this);
		this._map.on('inserturl', this._onInsertURL, this);
		this._map.on('childid', this._onChildIdMsg, this);
	},

	removeHooks: function () {
		this._map.off('insertfile', this._onInsertFile, this);
		this._map.off('inserturl', this._onInsertURL, this);
		this._map.off('childid', this._onChildIdMsg, this);
	},

	_onInsertFile: function (e) {
		if (!this._childId) {
			this._map._socket.sendMessage('getchildid');
			this._toInsert[Date.now()] = e.file;
		}
		else {
			this._sendFile(Date.now(), e.file);
		}
	},

	_onInsertURL: function (e) {
		if (!this._childId) {
			this._map._socket.sendMessage('getchildid');
			this._toInsertURL[Date.now()] = e.url;
		}
		else {
			this._sendURL(Date.now(), e.url);
		}
	},

	_onChildIdMsg: function (e) {
		this._childId = e.id;
		for (var name in this._toInsert) {
			this._sendFile(name, this._toInsert[name]);
		}
		this._toInsert = {};

		for (name in this._toInsertURL) {
			this._sendURL(name, this._toInsertURL[name]);
		}
		this._toInsertURL = {};
	},

	_sendFile: function (name, file) {
		var url = this._url;
		var socket = this._map._socket;
		var map = this._map;
		if (window.ThisIsAMobileApp) {
			console.log('FIXME: image insertion in mobile app');
		} else {
			var xmlHttp = new XMLHttpRequest();
			this._map.showBusy(_('Uploading...'), false);
			xmlHttp.onreadystatechange = function () {
				if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
					map.hideBusy();
					socket.sendMessage('insertfile name=' + name + ' type=graphic');
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
		}
	},

	_sendURL: function (name, url) {
		this._map._socket.sendMessage('insertfile name=' + encodeURIComponent(url) + ' type=graphicurl');
	}
});

L.Map.addInitHook('addHandler', 'fileInserter', L.Map.FileInserter);
